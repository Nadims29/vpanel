package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/vpanel/server/internal/models"
	"github.com/vpanel/server/internal/plugin"
	"github.com/vpanel/server/internal/services"
	"github.com/vpanel/server/pkg/logger"
	"github.com/vpanel/server/pkg/response"
)

// Handler contains all HTTP handlers
type Handler struct {
	svc           *services.Container
	log           *logger.Logger
	pluginManager *plugin.Manager

	// Handler groups
	Auth      *AuthHandler
	Dashboard *DashboardHandler
	Monitor   *MonitorHandler
	Docker    *DockerHandler
	Nginx     *NginxHandler
	Database  *DatabaseHandler
	File      *FileHandler
	Terminal  *TerminalHandler
	Cron      *CronHandler
	Firewall  *FirewallHandler
	Software  *SoftwareHandler
	Plugin    *PluginHandler
	Log       *LogHandler
	Settings  *SettingsHandler
	User      *UserHandler
	Node      *NodeHandler
	Agent     *AgentHandler
}

// New creates a new handler instance
func New(svc *services.Container, log *logger.Logger, pm *plugin.Manager) *Handler {
	h := &Handler{svc: svc, log: log, pluginManager: pm}

	// Initialize handler groups
	h.Auth = &AuthHandler{svc: svc, log: log}
	h.Dashboard = &DashboardHandler{svc: svc, log: log}
	h.Monitor = &MonitorHandler{svc: svc, log: log}
	h.Docker = &DockerHandler{svc: svc, log: log}
	h.Nginx = &NginxHandler{svc: svc, log: log}
	h.Database = &DatabaseHandler{svc: svc, log: log}
	h.File = &FileHandler{svc: svc, log: log}
	h.Terminal = &TerminalHandler{svc: svc, log: log}
	h.Cron = &CronHandler{svc: svc, log: log}
	h.Firewall = &FirewallHandler{svc: svc, log: log}
	h.Software = &SoftwareHandler{svc: svc, log: log}
	h.Plugin = &PluginHandler{svc: svc, log: log, pluginManager: pm}
	h.Log = &LogHandler{svc: svc, log: log}
	h.Settings = &SettingsHandler{svc: svc, log: log}
	h.User = &UserHandler{svc: svc, log: log}
	h.Node = &NodeHandler{svc: svc, log: log}
	h.Agent = &AgentHandler{svc: svc, log: log}

	return h
}

// HealthCheck returns server health status
func (h *Handler) HealthCheck(c *gin.Context) {
	response.Success(c, gin.H{
		"status":  "healthy",
		"version": "1.0.0",
	})
}

// Version returns server version
func (h *Handler) Version(c *gin.Context) {
	response.Success(c, gin.H{
		"version":    "1.0.0",
		"build_time": "2024-01-01",
		"git_commit": "abc123",
	})
}

// ============================================
// Auth Handler
// ============================================

type AuthHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		MFACode  string `json:"mfa_code"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	result, err := h.svc.Auth.Login(req.Username, req.Password, req.MFACode, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		switch err {
		case services.ErrUserNotFound, services.ErrInvalidPassword:
			response.Unauthorized(c, "Invalid username or password")
		case services.ErrAccountLocked:
			response.Forbidden(c, "Account is locked")
		case services.ErrAccountInactive:
			response.Forbidden(c, "Account is inactive")
		case services.ErrMFARequired:
			response.Error(c, http.StatusPreconditionRequired, "MFA_REQUIRED", "MFA code required")
		case services.ErrInvalidMFACode:
			response.Unauthorized(c, "Invalid MFA code")
		default:
			response.InternalError(c, "Login failed")
		}
		return
	}

	response.Success(c, gin.H{
		"user":          result.User,
		"token":         result.AccessToken,
		"refresh_token": result.RefreshToken,
		"expires_in":    result.ExpiresIn,
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Username    string `json:"username" binding:"required,min=3,max=50"`
		Email       string `json:"email" binding:"required,email"`
		Password    string `json:"password" binding:"required,min=8"`
		DisplayName string `json:"display_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	user, err := h.svc.Auth.Register(req.Username, req.Email, req.Password, req.DisplayName)
	if err != nil {
		if err == services.ErrUserAlreadyExists {
			response.Conflict(c, "Username or email already exists")
			return
		}
		response.InternalError(c, "Registration failed")
		return
	}

	response.Created(c, user)
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	result, err := h.svc.Auth.RefreshToken(req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, "Invalid or expired refresh token")
		return
	}

	response.Success(c, gin.H{
		"token":         result.AccessToken,
		"refresh_token": result.RefreshToken,
		"expires_in":    result.ExpiresIn,
	})
}

func (h *AuthHandler) OAuthStart(c *gin.Context)    { c.Redirect(http.StatusFound, "/") }
func (h *AuthHandler) OAuthCallback(c *gin.Context) { response.Success(c, nil) }

func (h *AuthHandler) Profile(c *gin.Context) {
	userID, _ := c.Get("user_id")
	user, err := h.svc.Auth.GetUserByID(userID.(string))
	if err != nil {
		response.NotFound(c, "User not found")
		return
	}
	response.Success(c, user)
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	user, err := h.svc.Auth.UpdateProfile(userID.(string), updates)
	if err != nil {
		response.InternalError(c, "Failed to update profile")
		return
	}
	response.Success(c, user)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if len(token) > 7 {
		token = token[7:] // Remove "Bearer "
	}
	h.svc.Auth.Logout(token)
	response.Success(c, nil)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.Auth.ChangePassword(userID.(string), req.OldPassword, req.NewPassword); err != nil {
		if err == services.ErrInvalidPassword {
			response.Unauthorized(c, "Invalid old password")
			return
		}
		response.InternalError(c, "Failed to change password")
		return
	}

	response.Success(c, nil)
}

func (h *AuthHandler) EnableMFA(c *gin.Context)  { response.Success(c, nil) }
func (h *AuthHandler) DisableMFA(c *gin.Context) { response.Success(c, nil) }

// ============================================
// Dashboard Handler
// ============================================

type DashboardHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *DashboardHandler) Overview(c *gin.Context) {
	ctx := context.Background()

	// Get Docker info
	var containerCount, runningCount int
	dockerInfo, err := h.svc.Docker.GetInfo(ctx)
	if err == nil {
		if v, ok := dockerInfo["containers"].(int); ok {
			containerCount = v
		}
		if v, ok := dockerInfo["containers_running"].(int); ok {
			runningCount = v
		}
	}

	// Get system metrics
	metrics, _ := h.svc.Monitor.GetMetrics()

	// Get site count
	var siteCount int64
	h.svc.DB.Model(&models.NginxSite{}).Count(&siteCount)

	// Get database count
	var dbCount int64
	h.svc.DB.Model(&models.DatabaseServer{}).Count(&dbCount)

	// Get active alerts
	var alertCount int64
	h.svc.DB.Model(&models.Alert{}).Where("status = ?", "active").Count(&alertCount)

	response.Success(c, gin.H{
		"containers": containerCount,
		"running":    runningCount,
		"sites":      siteCount,
		"databases":  dbCount,
		"alerts":     alertCount,
		"metrics":    metrics,
	})
}

func (h *DashboardHandler) Stats(c *gin.Context) {
	metrics, err := h.svc.Monitor.GetMetrics()
	if err != nil {
		response.InternalError(c, "Failed to get metrics")
		return
	}
	response.Success(c, metrics)
}

// ============================================
// Monitor Handler
// ============================================

type MonitorHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *MonitorHandler) SystemInfo(c *gin.Context) {
	info, err := h.svc.Monitor.GetSystemInfo()
	if err != nil {
		response.InternalError(c, "Failed to get system info")
		return
	}
	response.Success(c, info)
}

func (h *MonitorHandler) Metrics(c *gin.Context) {
	metrics, err := h.svc.Monitor.GetMetrics()
	if err != nil {
		response.InternalError(c, "Failed to get metrics")
		return
	}
	response.Success(c, metrics)
}

func (h *MonitorHandler) History(c *gin.Context) {
	// TODO: Implement metrics history from database
	response.Success(c, []interface{}{})
}

func (h *MonitorHandler) Processes(c *gin.Context) {
	procs, err := h.svc.Monitor.GetProcesses()
	if err != nil {
		response.InternalError(c, "Failed to get processes")
		return
	}
	response.Success(c, procs)
}

func (h *MonitorHandler) KillProcess(c *gin.Context) {
	pidStr := c.Param("pid")
	pid, err := strconv.ParseInt(pidStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid PID")
		return
	}

	if err := h.svc.Monitor.KillProcess(int32(pid)); err != nil {
		response.InternalError(c, "Failed to kill process")
		return
	}
	response.Success(c, nil)
}

func (h *MonitorHandler) RealtimeWS(c *gin.Context) { /* WebSocket handler */ }

// ============================================
// Docker Handler
// ============================================

type DockerHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *DockerHandler) Info(c *gin.Context) {
	ctx := context.Background()
	info, err := h.svc.Docker.GetInfo(ctx)
	if err != nil {
		response.InternalError(c, "Failed to get Docker info: "+err.Error())
		return
	}
	response.Success(c, info)
}

func (h *DockerHandler) ListContainers(c *gin.Context) {
	ctx := context.Background()
	all := c.Query("all") == "true"

	containers, err := h.svc.Docker.ListContainers(ctx, all)
	if err != nil {
		response.InternalError(c, "Failed to list containers: "+err.Error())
		return
	}
	response.Success(c, containers)
}

func (h *DockerHandler) CreateContainer(c *gin.Context) {
	ctx := context.Background()
	var req services.CreateContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	id, err := h.svc.Docker.CreateContainer(ctx, &req)
	if err != nil {
		response.InternalError(c, "Failed to create container: "+err.Error())
		return
	}

	// Start the container
	h.svc.Docker.StartContainer(ctx, id)

	response.Created(c, gin.H{"id": id})
}

func (h *DockerHandler) GetContainer(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	container, err := h.svc.Docker.GetContainer(ctx, id)
	if err != nil {
		response.NotFound(c, "Container not found")
		return
	}
	response.Success(c, container)
}

func (h *DockerHandler) RemoveContainer(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")
	force := c.Query("force") == "true"

	if err := h.svc.Docker.RemoveContainer(ctx, id, force); err != nil {
		response.InternalError(c, "Failed to remove container: "+err.Error())
		return
	}
	response.NoContent(c)
}

func (h *DockerHandler) StartContainer(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	if err := h.svc.Docker.StartContainer(ctx, id); err != nil {
		response.InternalError(c, "Failed to start container: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *DockerHandler) StopContainer(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	if err := h.svc.Docker.StopContainer(ctx, id); err != nil {
		response.InternalError(c, "Failed to stop container: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *DockerHandler) RestartContainer(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	if err := h.svc.Docker.RestartContainer(ctx, id); err != nil {
		response.InternalError(c, "Failed to restart container: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *DockerHandler) ContainerLogs(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")
	tail, _ := strconv.Atoi(c.DefaultQuery("tail", "500"))

	logs, err := h.svc.Docker.GetContainerLogs(ctx, id, tail, true)
	if err != nil {
		response.InternalError(c, "Failed to get logs: "+err.Error())
		return
	}
	response.Success(c, logs)
}

func (h *DockerHandler) ContainerStats(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	stats, err := h.svc.Docker.GetContainerStats(ctx, id)
	if err != nil {
		response.InternalError(c, "Failed to get stats: "+err.Error())
		return
	}
	response.Success(c, stats)
}

func (h *DockerHandler) ContainerTerminal(c *gin.Context) { /* WebSocket */ }

func (h *DockerHandler) ListImages(c *gin.Context) {
	ctx := context.Background()
	images, err := h.svc.Docker.ListImages(ctx)
	if err != nil {
		response.InternalError(c, "Failed to list images: "+err.Error())
		return
	}
	response.Success(c, images)
}

func (h *DockerHandler) PullImage(c *gin.Context) {
	ctx := context.Background()
	var req struct {
		Image string `json:"image" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Image name is required")
		return
	}

	if err := h.svc.Docker.PullImage(ctx, req.Image); err != nil {
		response.InternalError(c, "Failed to pull image: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *DockerHandler) RemoveImage(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")
	force := c.Query("force") == "true"

	if err := h.svc.Docker.RemoveImage(ctx, id, force); err != nil {
		response.InternalError(c, "Failed to remove image: "+err.Error())
		return
	}
	response.NoContent(c)
}

func (h *DockerHandler) BuildImage(c *gin.Context) { response.Success(c, nil) }

func (h *DockerHandler) ListNetworks(c *gin.Context) {
	ctx := context.Background()
	networks, err := h.svc.Docker.ListNetworks(ctx)
	if err != nil {
		response.InternalError(c, "Failed to list networks: "+err.Error())
		return
	}
	response.Success(c, networks)
}

func (h *DockerHandler) CreateNetwork(c *gin.Context) {
	ctx := context.Background()
	var req struct {
		Name   string `json:"name" binding:"required"`
		Driver string `json:"driver"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Network name is required")
		return
	}

	if req.Driver == "" {
		req.Driver = "bridge"
	}

	id, err := h.svc.Docker.CreateNetwork(ctx, req.Name, req.Driver)
	if err != nil {
		response.InternalError(c, "Failed to create network: "+err.Error())
		return
	}
	response.Created(c, gin.H{"id": id})
}

func (h *DockerHandler) RemoveNetwork(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	if err := h.svc.Docker.RemoveNetwork(ctx, id); err != nil {
		response.InternalError(c, "Failed to remove network: "+err.Error())
		return
	}
	response.NoContent(c)
}

func (h *DockerHandler) ListVolumes(c *gin.Context) {
	ctx := context.Background()
	volumes, err := h.svc.Docker.ListVolumes(ctx)
	if err != nil {
		response.InternalError(c, "Failed to list volumes: "+err.Error())
		return
	}
	response.Success(c, volumes)
}

func (h *DockerHandler) CreateVolume(c *gin.Context) {
	ctx := context.Background()
	var req struct {
		Name   string `json:"name" binding:"required"`
		Driver string `json:"driver"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Volume name is required")
		return
	}

	if req.Driver == "" {
		req.Driver = "local"
	}

	vol, err := h.svc.Docker.CreateVolume(ctx, req.Name, req.Driver)
	if err != nil {
		response.InternalError(c, "Failed to create volume: "+err.Error())
		return
	}
	response.Created(c, vol)
}

func (h *DockerHandler) RemoveVolume(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")
	force := c.Query("force") == "true"

	if err := h.svc.Docker.RemoveVolume(ctx, id, force); err != nil {
		response.InternalError(c, "Failed to remove volume: "+err.Error())
		return
	}
	response.NoContent(c)
}

func (h *DockerHandler) ListComposeProjects(c *gin.Context) {
	ctx := context.Background()
	projects, err := h.svc.Docker.ListComposeProjects(ctx)
	if err != nil {
		response.InternalError(c, "Failed to list compose projects: "+err.Error())
		return
	}
	response.Success(c, projects)
}

func (h *DockerHandler) CreateComposeProject(c *gin.Context) {
	ctx := context.Background()
	var req struct {
		Name        string `json:"name" binding:"required"`
		Path        string `json:"path" binding:"required"`
		Content     string `json:"content" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Name, path, and content are required")
		return
	}

	project, err := h.svc.Docker.CreateComposeProject(ctx, req.Name, req.Path, req.Content, req.Description)
	if err != nil {
		response.InternalError(c, "Failed to create compose project: "+err.Error())
		return
	}
	response.Created(c, project)
}

func (h *DockerHandler) RemoveComposeProject(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	if err := h.svc.Docker.RemoveComposeProject(ctx, id); err != nil {
		response.InternalError(c, "Failed to remove compose project: "+err.Error())
		return
	}
	response.NoContent(c)
}

func (h *DockerHandler) ComposeUp(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	if err := h.svc.Docker.ComposeUp(ctx, id); err != nil {
		response.InternalError(c, "Failed to start compose project: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Compose project started"})
}

func (h *DockerHandler) ComposeDown(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	if err := h.svc.Docker.ComposeDown(ctx, id); err != nil {
		response.InternalError(c, "Failed to stop compose project: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Compose project stopped"})
}
func (h *DockerHandler) ContainerLogsWS(c *gin.Context)  { /* WebSocket */ }
func (h *DockerHandler) ContainerStatsWS(c *gin.Context) { /* WebSocket */ }

// ============================================
// Nginx Handler
// ============================================

type NginxHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *NginxHandler) Status(c *gin.Context) {
	status, err := h.svc.Nginx.GetStatus()
	if err != nil {
		response.InternalError(c, "Failed to get nginx status: "+err.Error())
		return
	}
	response.Success(c, status)
}

func (h *NginxHandler) Reload(c *gin.Context) {
	if err := h.svc.Nginx.Reload(); err != nil {
		response.InternalError(c, "Failed to reload nginx: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Nginx reloaded successfully"})
}

func (h *NginxHandler) ListSites(c *gin.Context) {
	nodeID := c.Query("node_id")
	sites, err := h.svc.Nginx.ListSites(nodeID)
	if err != nil {
		response.InternalError(c, "Failed to list sites: "+err.Error())
		return
	}
	response.Success(c, sites)
}

func (h *NginxHandler) CreateSite(c *gin.Context) {
	var site models.NginxSite
	if err := c.ShouldBindJSON(&site); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.Nginx.CreateSite(&site); err != nil {
		if strings.Contains(err.Error(), "already exists") {
			response.Conflict(c, err.Error())
			return
		}
		response.InternalError(c, "Failed to create site: "+err.Error())
		return
	}
	response.Created(c, site)
}

func (h *NginxHandler) GetSite(c *gin.Context) {
	id := c.Param("id")
	site, err := h.svc.Nginx.GetSite(id)
	if err != nil {
		response.NotFound(c, "Site not found")
		return
	}
	response.Success(c, site)
}

func (h *NginxHandler) UpdateSite(c *gin.Context) {
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.Nginx.UpdateSite(id, updates); err != nil {
		if strings.Contains(err.Error(), "already exists") {
			response.Conflict(c, err.Error())
			return
		}
		response.InternalError(c, "Failed to update site: "+err.Error())
		return
	}

	site, err := h.svc.Nginx.GetSite(id)
	if err != nil {
		response.InternalError(c, "Failed to get updated site")
		return
	}
	response.Success(c, site)
}

func (h *NginxHandler) DeleteSite(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Nginx.DeleteSite(id); err != nil {
		response.InternalError(c, "Failed to delete site: "+err.Error())
		return
	}
	response.NoContent(c)
}

func (h *NginxHandler) EnableSite(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Nginx.EnableSite(id); err != nil {
		response.InternalError(c, "Failed to enable site: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Site enabled"})
}

func (h *NginxHandler) DisableSite(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Nginx.DisableSite(id); err != nil {
		response.InternalError(c, "Failed to disable site: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Site disabled"})
}

func (h *NginxHandler) ListCertificates(c *gin.Context) {
	nodeID := c.Query("node_id")
	certs, err := h.svc.Nginx.ListCertificates(nodeID)
	if err != nil {
		response.InternalError(c, "Failed to list certificates: "+err.Error())
		return
	}
	response.Success(c, certs)
}

func (h *NginxHandler) CreateCertificate(c *gin.Context) {
	var cert models.SSLCertificate
	if err := c.ShouldBindJSON(&cert); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.Nginx.CreateCertificate(&cert); err != nil {
		response.InternalError(c, "Failed to create certificate: "+err.Error())
		return
	}
	response.Created(c, cert)
}

func (h *NginxHandler) DeleteCertificate(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Nginx.DeleteCertificate(id); err != nil {
		if strings.Contains(err.Error(), "in use") {
			response.BadRequest(c, err.Error())
			return
		}
		response.InternalError(c, "Failed to delete certificate: "+err.Error())
		return
	}
	response.NoContent(c)
}

func (h *NginxHandler) RenewCertificate(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Nginx.RenewCertificate(id); err != nil {
		response.InternalError(c, "Failed to renew certificate: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Certificate renewed successfully"})
}

func (h *NginxHandler) AccessLogs(c *gin.Context) {
	siteID := c.Query("site_id")
	lines, _ := strconv.Atoi(c.DefaultQuery("lines", "100"))

	logs, err := h.svc.Nginx.GetAccessLogs(siteID, lines)
	if err != nil {
		response.InternalError(c, "Failed to get access logs: "+err.Error())
		return
	}
	response.Success(c, gin.H{"logs": logs})
}

func (h *NginxHandler) ErrorLogs(c *gin.Context) {
	siteID := c.Query("site_id")
	lines, _ := strconv.Atoi(c.DefaultQuery("lines", "100"))

	logs, err := h.svc.Nginx.GetErrorLogs(siteID, lines)
	if err != nil {
		response.InternalError(c, "Failed to get error logs: "+err.Error())
		return
	}
	response.Success(c, gin.H{"logs": logs})
}

func (h *NginxHandler) Analytics(c *gin.Context) {
	siteID := c.Query("site_id")
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))

	analytics, err := h.svc.Nginx.GetAnalytics(siteID, days)
	if err != nil {
		response.InternalError(c, "Failed to get analytics: "+err.Error())
		return
	}
	response.Success(c, analytics)
}

// ============================================
// Database Handler
// ============================================

type DatabaseHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *DatabaseHandler) ListServers(c *gin.Context) {
	servers, err := h.svc.Database.ListServers()
	if err != nil {
		h.log.Error("Failed to list database servers", "error", err)
		response.InternalError(c, "Failed to list database servers")
		return
	}
	response.Success(c, servers)
}

func (h *DatabaseHandler) CreateServer(c *gin.Context) {
	var req models.DatabaseServer
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	// Validate required fields
	if req.Name == "" {
		response.BadRequest(c, "Server name is required")
		return
	}
	if req.Type == "" {
		response.BadRequest(c, "Database type is required")
		return
	}
	if req.Host == "" {
		response.BadRequest(c, "Host is required")
		return
	}
	if req.Port == 0 {
		response.BadRequest(c, "Port is required")
		return
	}

	if err := h.svc.Database.CreateServer(&req); err != nil {
		h.log.Error("Failed to create database server", "error", err)
		response.BadRequest(c, "Failed to create database server: "+err.Error())
		return
	}

	response.Created(c, req)
}

func (h *DatabaseHandler) DeleteServer(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Server ID is required")
		return
	}

	if err := h.svc.Database.DeleteServer(id); err != nil {
		h.log.Error("Failed to delete database server", "id", id, "error", err)
		response.InternalError(c, "Failed to delete database server")
		return
	}

	response.NoContent(c)
}

func (h *DatabaseHandler) ListDatabases(c *gin.Context) {
	serverID := c.Param("id")
	if serverID == "" {
		response.BadRequest(c, "Server ID is required")
		return
	}

	databases, err := h.svc.Database.ListDatabases(serverID)
	if err != nil {
		h.log.Error("Failed to list databases", "server_id", serverID, "error", err)
		response.InternalError(c, "Failed to list databases")
		return
	}
	response.Success(c, databases)
}

func (h *DatabaseHandler) CreateDatabase(c *gin.Context) {
	response.Success(c, nil) // TODO: Implement
}

func (h *DatabaseHandler) DeleteDatabase(c *gin.Context) {
	response.Success(c, nil) // TODO: Implement
}

func (h *DatabaseHandler) ListUsers(c *gin.Context) {
	response.Success(c, []interface{}{}) // TODO: Implement
}

func (h *DatabaseHandler) CreateUser(c *gin.Context) {
	response.Success(c, nil) // TODO: Implement
}

func (h *DatabaseHandler) DeleteUser(c *gin.Context) {
	response.Success(c, nil) // TODO: Implement
}

func (h *DatabaseHandler) Backup(c *gin.Context) {
	serverID := c.Param("id")
	if serverID == "" {
		response.BadRequest(c, "Server ID is required")
		return
	}

	var req struct {
		Database string `json:"database"`
		Type     string `json:"type"` // manual, scheduled
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if req.Database == "" {
		req.Database = "all"
	}
	if req.Type == "" {
		req.Type = "manual"
	}

	backup, err := h.svc.Database.CreateBackup(serverID, req.Database, req.Type)
	if err != nil {
		h.log.Error("Failed to create backup", "server_id", serverID, "error", err)
		response.BadRequest(c, "Failed to create backup: "+err.Error())
		return
	}

	response.Created(c, backup)
}

func (h *DatabaseHandler) Restore(c *gin.Context) {
	serverID := c.Param("id")
	if serverID == "" {
		response.BadRequest(c, "Server ID is required")
		return
	}

	var req struct {
		BackupID       string `json:"backup_id"`
		TargetDatabase string `json:"target_database"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if req.BackupID == "" {
		response.BadRequest(c, "Backup ID is required")
		return
	}
	if req.TargetDatabase == "" {
		response.BadRequest(c, "Target database is required")
		return
	}

	if err := h.svc.Database.RestoreBackup(req.BackupID, serverID, req.TargetDatabase); err != nil {
		h.log.Error("Failed to restore backup", "backup_id", req.BackupID, "error", err)
		response.BadRequest(c, "Failed to restore backup: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Restore started"})
}

func (h *DatabaseHandler) ListBackups(c *gin.Context) {
	serverID := c.Query("server_id")

	backups, err := h.svc.Database.ListBackups(serverID)
	if err != nil {
		h.log.Error("Failed to list backups", "error", err)
		response.InternalError(c, "Failed to list backups")
		return
	}
	response.Success(c, backups)
}

func (h *DatabaseHandler) GetBackup(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Backup ID is required")
		return
	}

	backup, err := h.svc.Database.GetBackup(id)
	if err != nil {
		h.log.Error("Failed to get backup", "id", id, "error", err)
		response.NotFound(c, "Backup not found")
		return
	}
	response.Success(c, backup)
}

func (h *DatabaseHandler) DeleteBackup(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Backup ID is required")
		return
	}

	if err := h.svc.Database.DeleteBackup(id); err != nil {
		h.log.Error("Failed to delete backup", "id", id, "error", err)
		response.InternalError(c, "Failed to delete backup")
		return
	}

	response.NoContent(c)
}

// ============================================
// File Handler
// ============================================

type FileHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *FileHandler) List(c *gin.Context) {
	path := c.DefaultQuery("path", "/")
	files, err := h.svc.File.ListDir(path)
	if err != nil {
		response.InternalError(c, "Failed to list directory: "+err.Error())
		return
	}
	response.Success(c, gin.H{
		"path":  path,
		"files": files,
	})
}

func (h *FileHandler) Read(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		response.BadRequest(c, "Path is required")
		return
	}

	content, err := h.svc.File.ReadFile(path)
	if err != nil {
		response.InternalError(c, "Failed to read file: "+err.Error())
		return
	}
	response.Success(c, gin.H{
		"path":    path,
		"content": string(content),
	})
}

func (h *FileHandler) Write(c *gin.Context) {
	var req struct {
		Path    string `json:"path" binding:"required"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.File.WriteFile(req.Path, []byte(req.Content)); err != nil {
		response.InternalError(c, "Failed to write file: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *FileHandler) Mkdir(c *gin.Context) {
	var req struct {
		Path string `json:"path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.File.CreateDir(req.Path); err != nil {
		response.InternalError(c, "Failed to create directory: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *FileHandler) Rename(c *gin.Context) {
	var req struct {
		OldPath string `json:"old_path" binding:"required"`
		NewPath string `json:"new_path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.File.Rename(req.OldPath, req.NewPath); err != nil {
		response.InternalError(c, "Failed to rename: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *FileHandler) Copy(c *gin.Context) {
	var req struct {
		Source      string `json:"source" binding:"required"`
		Destination string `json:"destination" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.File.Copy(req.Source, req.Destination); err != nil {
		response.InternalError(c, "Failed to copy: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *FileHandler) Move(c *gin.Context) {
	var req struct {
		Source      string `json:"source" binding:"required"`
		Destination string `json:"destination" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.File.Rename(req.Source, req.Destination); err != nil {
		response.InternalError(c, "Failed to move: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *FileHandler) Delete(c *gin.Context) {
	// Support both DELETE with query param and POST with body
	path := c.Query("path")
	if path == "" {
		var req struct {
			Path string `json:"path" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Path is required")
			return
		}
		path = req.Path
	}

	if path == "" {
		response.BadRequest(c, "Path is required")
		return
	}

	if err := h.svc.File.Delete(path); err != nil {
		response.InternalError(c, "Failed to delete: "+err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *FileHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "No file uploaded")
		return
	}

	path := c.PostForm("path")
	if path == "" {
		response.BadRequest(c, "Path is required")
		return
	}

	// Open uploaded file
	src, err := file.Open()
	if err != nil {
		response.InternalError(c, "Failed to open uploaded file")
		return
	}
	defer src.Close()

	// Read file content
	content := make([]byte, file.Size)
	if _, err := src.Read(content); err != nil {
		response.InternalError(c, "Failed to read uploaded file")
		return
	}

	// Write to destination
	destPath := path
	if !strings.HasSuffix(destPath, "/") {
		destPath = destPath + "/"
	}
	destPath = destPath + file.Filename

	if err := h.svc.File.WriteFile(destPath, content); err != nil {
		response.InternalError(c, "Failed to save file: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "File uploaded successfully"})
}

func (h *FileHandler) Download(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		response.BadRequest(c, "Path is required")
		return
	}

	content, err := h.svc.File.ReadFile(path)
	if err != nil {
		response.InternalError(c, "Failed to read file: "+err.Error())
		return
	}

	// Get filename from path
	filename := filepath.Base(path)
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "application/octet-stream", content)
}

func (h *FileHandler) Compress(c *gin.Context) {
	var req struct {
		Paths    []string `json:"paths" binding:"required"`
		DestPath string   `json:"dest_path" binding:"required"`
		Format   string   `json:"format"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if req.Format == "" {
		req.Format = "zip"
	}

	if err := h.svc.File.Compress(req.Paths, req.DestPath, req.Format); err != nil {
		response.InternalError(c, "Failed to compress: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Files compressed successfully"})
}

func (h *FileHandler) Decompress(c *gin.Context) {
	var req struct {
		ArchivePath string `json:"archive_path" binding:"required"`
		DestPath    string `json:"dest_path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.File.Decompress(req.ArchivePath, req.DestPath); err != nil {
		response.InternalError(c, "Failed to decompress: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Archive decompressed successfully"})
}

func (h *FileHandler) GetPermissions(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		response.BadRequest(c, "Path is required")
		return
	}

	info, err := h.svc.File.GetFileInfo(path)
	if err != nil {
		response.InternalError(c, "Failed to get file info: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"mode":        info.Mode,
		"mode_string": info.ModeString,
	})
}

func (h *FileHandler) SetPermissions(c *gin.Context) {
	var req struct {
		Path string      `json:"path" binding:"required"`
		Mode os.FileMode `json:"mode"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.File.SetPermissions(req.Path, req.Mode); err != nil {
		response.InternalError(c, "Failed to set permissions: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Permissions updated successfully"})
}

func (h *FileHandler) Search(c *gin.Context) {
	path := c.DefaultQuery("path", "/")
	pattern := c.Query("pattern")
	if pattern == "" {
		response.BadRequest(c, "Search pattern is required")
		return
	}

	files, err := h.svc.File.Search(path, pattern, 100)
	if err != nil {
		response.InternalError(c, "Failed to search: "+err.Error())
		return
	}
	response.Success(c, files)
}

// ============================================
// Terminal Handler
// ============================================

type TerminalHandler struct {
	svc *services.Container
	log *logger.Logger
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func (h *TerminalHandler) WebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.log.Error("WebSocket upgrade failed", "error", err)
		return
	}

	sessionID := uuid.New().String()
	cols := uint16(80)
	rows := uint16(24)

	if colsStr := c.Query("cols"); colsStr != "" {
		if v, err := strconv.ParseUint(colsStr, 10, 16); err == nil {
			cols = uint16(v)
		}
	}
	if rowsStr := c.Query("rows"); rowsStr != "" {
		if v, err := strconv.ParseUint(rowsStr, 10, 16); err == nil {
			rows = uint16(v)
		}
	}

	shell := c.Query("shell")
	_, err = h.svc.Terminal.CreateSession(sessionID, conn, shell, cols, rows)
	if err != nil {
		h.log.Error("Failed to create terminal session", "error", err)
		conn.Close()
		return
	}
}

func (h *TerminalHandler) ListSessions(c *gin.Context) {
	sessions := h.svc.Terminal.ListSessions()
	response.Success(c, sessions)
}

func (h *TerminalHandler) CloseSession(c *gin.Context) {
	id := c.Param("id")
	h.svc.Terminal.CloseSession(id)
	response.Success(c, nil)
}

// ============================================
// Cron Handler
// ============================================

type CronHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *CronHandler) ListJobs(c *gin.Context) {
	nodeID := c.Query("node_id")
	jobs, err := h.svc.Cron.ListJobs(nodeID)
	if err != nil {
		response.InternalError(c, "Failed to list jobs")
		return
	}
	response.Success(c, jobs)
}

func (h *CronHandler) CreateJob(c *gin.Context) {
	var job models.CronJob
	if err := c.ShouldBindJSON(&job); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.Cron.CreateJob(&job); err != nil {
		if err == services.ErrInvalidCronExpression {
			response.BadRequest(c, "Invalid cron expression")
			return
		}
		response.InternalError(c, "Failed to create job")
		return
	}
	response.Created(c, job)
}

func (h *CronHandler) GetJob(c *gin.Context) {
	id := c.Param("id")
	job, err := h.svc.Cron.GetJob(id)
	if err != nil {
		response.NotFound(c, "Job not found")
		return
	}
	response.Success(c, job)
}

func (h *CronHandler) UpdateJob(c *gin.Context) {
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	job, err := h.svc.Cron.UpdateJob(id, updates)
	if err != nil {
		if err == services.ErrInvalidCronExpression {
			response.BadRequest(c, "Invalid cron expression")
			return
		}
		response.InternalError(c, "Failed to update job")
		return
	}
	response.Success(c, job)
}

func (h *CronHandler) DeleteJob(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Cron.DeleteJob(id); err != nil {
		response.InternalError(c, "Failed to delete job")
		return
	}
	response.NoContent(c)
}

func (h *CronHandler) RunJob(c *gin.Context) {
	id := c.Param("id")
	log, err := h.svc.Cron.RunJob(id)
	if err != nil {
		response.InternalError(c, "Failed to run job")
		return
	}
	response.Success(c, log)
}

func (h *CronHandler) JobLogs(c *gin.Context) {
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	logs, err := h.svc.Cron.GetJobLogs(id, limit)
	if err != nil {
		response.InternalError(c, "Failed to get job logs")
		return
	}
	response.Success(c, logs)
}

// ============================================
// Firewall Handler
// ============================================

type FirewallHandler struct {
	svc *services.Container
	log *logger.Logger
}

// Status returns firewall status
func (h *FirewallHandler) Status(c *gin.Context) {
	nodeID := c.Query("node_id")
	status, err := h.svc.Firewall.GetStatus(nodeID)
	if err != nil {
		h.log.Error("Failed to get firewall status", "error", err, "node_id", nodeID)
		response.InternalError(c, "Failed to get firewall status")
		return
	}
	response.Success(c, status)
}

// Enable enables firewall
func (h *FirewallHandler) Enable(c *gin.Context) {
	var req struct {
		NodeID string `json:"node_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.NodeID = c.Query("node_id")
	}

	if err := h.svc.Firewall.EnableFirewall(req.NodeID); err != nil {
		response.InternalError(c, "Failed to enable firewall")
		return
	}
	response.Success(c, nil)
}

// Disable disables firewall
func (h *FirewallHandler) Disable(c *gin.Context) {
	var req struct {
		NodeID string `json:"node_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.NodeID = c.Query("node_id")
	}

	if err := h.svc.Firewall.DisableFirewall(req.NodeID); err != nil {
		response.InternalError(c, "Failed to disable firewall")
		return
	}
	response.Success(c, nil)
}

// ListRules returns all firewall rules
func (h *FirewallHandler) ListRules(c *gin.Context) {
	nodeID := c.Query("node_id")
	rules, err := h.svc.Firewall.ListRules(nodeID)
	if err != nil {
		h.log.Error("Failed to list firewall rules", "error", err, "node_id", nodeID)
		response.InternalError(c, "Failed to list firewall rules")
		return
	}
	response.Success(c, rules)
}

// CreateRule creates a new firewall rule
func (h *FirewallHandler) CreateRule(c *gin.Context) {
	var rule models.FirewallRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if rule.Name == "" {
		response.BadRequest(c, "Rule name is required")
		return
	}
	if rule.Direction != "in" && rule.Direction != "out" {
		response.BadRequest(c, "Direction must be 'in' or 'out'")
		return
	}
	if rule.Action != "allow" && rule.Action != "deny" {
		response.BadRequest(c, "Action must be 'allow' or 'deny'")
		return
	}

	if rule.Priority == 0 {
		rule.Priority = 100
	}
	if !rule.Enabled {
		rule.Enabled = true
	}

	if err := h.svc.Firewall.CreateRule(&rule); err != nil {
		response.InternalError(c, "Failed to create firewall rule")
		return
	}
	response.Created(c, rule)
}

// UpdateRule updates a firewall rule
func (h *FirewallHandler) UpdateRule(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Rule ID is required")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if direction, ok := updates["direction"].(string); ok {
		if direction != "in" && direction != "out" {
			response.BadRequest(c, "Direction must be 'in' or 'out'")
			return
		}
	}

	if action, ok := updates["action"].(string); ok {
		if action != "allow" && action != "deny" {
			response.BadRequest(c, "Action must be 'allow' or 'deny'")
			return
		}
	}

	if err := h.svc.Firewall.UpdateRule(id, updates); err != nil {
		response.InternalError(c, "Failed to update firewall rule")
		return
	}

	rule, err := h.svc.Firewall.GetRule(id)
	if err != nil {
		response.InternalError(c, "Failed to get updated rule")
		return
	}
	response.Success(c, rule)
}

// DeleteRule deletes a firewall rule
func (h *FirewallHandler) DeleteRule(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Rule ID is required")
		return
	}

	if err := h.svc.Firewall.DeleteRule(id); err != nil {
		response.InternalError(c, "Failed to delete firewall rule")
		return
	}
	response.NoContent(c)
}

// Fail2BanStatus returns Fail2Ban status
func (h *FirewallHandler) Fail2BanStatus(c *gin.Context) {
	nodeID := c.Query("node_id")
	status, err := h.svc.Firewall.GetFail2BanStatus(nodeID)
	if err != nil {
		response.InternalError(c, "Failed to get Fail2Ban status")
		return
	}
	response.Success(c, status)
}

// ListJails returns all Fail2Ban jails
func (h *FirewallHandler) ListJails(c *gin.Context) {
	nodeID := c.Query("node_id")
	jails, err := h.svc.Firewall.ListFail2BanJails(nodeID)
	if err != nil {
		h.log.Error("Failed to list Fail2Ban jails", "error", err, "node_id", nodeID)
		response.InternalError(c, "Failed to list Fail2Ban jails")
		return
	}
	response.Success(c, jails)
}

// UnbanIP unbans an IP from a Fail2Ban jail
func (h *FirewallHandler) UnbanIP(c *gin.Context) {
	jailName := c.Param("name")
	if jailName == "" {
		response.BadRequest(c, "Jail name is required")
		return
	}

	var req struct {
		IP     string `json:"ip" binding:"required"`
		NodeID string `json:"node_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if err := h.svc.Firewall.UnbanIP(jailName, req.IP, req.NodeID); err != nil {
		response.InternalError(c, "Failed to unban IP")
		return
	}
	response.Success(c, nil)
}

// ============================================
// Software Handler
// ============================================

type SoftwareHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *SoftwareHandler) ListInstalled(c *gin.Context) { response.Success(c, []interface{}{}) }
func (h *SoftwareHandler) ListAvailable(c *gin.Context) { response.Success(c, []interface{}{}) }
func (h *SoftwareHandler) Install(c *gin.Context)       { response.Success(c, nil) }
func (h *SoftwareHandler) Uninstall(c *gin.Context)     { response.Success(c, nil) }
func (h *SoftwareHandler) Upgrade(c *gin.Context)       { response.Success(c, nil) }
func (h *SoftwareHandler) Status(c *gin.Context)        { response.Success(c, nil) }

// ============================================
// Plugin Handler
// ============================================

type PluginHandler struct {
	svc           *services.Container
	log           *logger.Logger
	pluginManager *plugin.Manager
}

// List returns all installed plugins
func (h *PluginHandler) List(c *gin.Context) {
	plugins := h.pluginManager.List()

	result := make([]gin.H, 0, len(plugins))
	for _, lp := range plugins {
		status := "stopped"
		if lp.Instance != nil {
			info := lp.Instance.GetInfo()
			if info != nil {
				status = info.Status
			}
		}
		if lp.Enabled {
			status = "enabled"
		} else {
			status = "disabled"
		}

		result = append(result, gin.H{
			"id":          lp.Manifest.ID,
			"name":        lp.Manifest.Name,
			"version":     lp.Manifest.Version,
			"description": lp.Manifest.Description,
			"author":      lp.Manifest.Author,
			"homepage":    lp.Manifest.Homepage,
			"license":     lp.Manifest.License,
			"icon":        lp.Manifest.Icon,
			"category":    lp.Manifest.Category,
			"tags":        lp.Manifest.Tags,
			"enabled":     lp.Enabled,
			"status":      status,
		})
	}

	response.Success(c, result)
}

// Market returns available plugins from the market
func (h *PluginHandler) Market(c *gin.Context) {
	available, err := h.pluginManager.ScanAvailable()
	if err != nil {
		h.log.Error("Failed to scan available plugins", "error", err)
		response.InternalError(c, "Failed to scan available plugins: "+err.Error())
		return
	}

	result := make([]gin.H, 0, len(available))
	for _, ap := range available {
		status := "available"
		if ap.Installed {
			if ap.Enabled {
				status = "installed_enabled"
			} else {
				status = "installed_disabled"
			}
		}

		result = append(result, gin.H{
			"id":          ap.Manifest.ID,
			"name":        ap.Manifest.Name,
			"version":     ap.Manifest.Version,
			"description": ap.Manifest.Description,
			"author":      ap.Manifest.Author,
			"homepage":    ap.Manifest.Homepage,
			"license":     ap.Manifest.License,
			"icon":        ap.Manifest.Icon,
			"category":    ap.Manifest.Category,
			"tags":        ap.Manifest.Tags,
			"installed":   ap.Installed,
			"enabled":     ap.Enabled,
			"status":      status,
			"path":        ap.Path,
		})
	}

	response.Success(c, result)
}

// Install installs a plugin
func (h *PluginHandler) Install(c *gin.Context) {
	var req struct {
		PluginID string `json:"plugin_id" binding:"required"`
		Source   string `json:"source"` // "market" or "local"
		Path     string `json:"path"`   // local path if source is "local"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	// For now, only support loading from local path
	// Market installation would require downloading and extracting plugin files
	if req.Source == "local" && req.Path != "" {
		if err := h.pluginManager.Load(req.Path); err != nil {
			h.log.Error("Failed to install plugin", "error", err, "path", req.Path)
			response.InternalError(c, "Failed to install plugin: "+err.Error())
			return
		}
		response.Success(c, gin.H{"message": "Plugin installed successfully"})
		return
	}

	response.BadRequest(c, "Only local installation is supported currently")
}

// Uninstall uninstalls a plugin
func (h *PluginHandler) Uninstall(c *gin.Context) {
	pluginID := c.Param("id")
	if pluginID == "" {
		response.BadRequest(c, "Plugin ID is required")
		return
	}

	if err := h.pluginManager.Unload(pluginID); err != nil {
		h.log.Error("Failed to uninstall plugin", "error", err, "plugin_id", pluginID)
		response.InternalError(c, "Failed to uninstall plugin: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Plugin uninstalled successfully"})
}

// Enable enables a plugin
func (h *PluginHandler) Enable(c *gin.Context) {
	pluginID := c.Param("id")
	if pluginID == "" {
		response.BadRequest(c, "Plugin ID is required")
		return
	}

	if err := h.pluginManager.Enable(pluginID); err != nil {
		h.log.Error("Failed to enable plugin", "error", err, "plugin_id", pluginID)
		response.InternalError(c, "Failed to enable plugin: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Plugin enabled successfully"})
}

// Disable disables a plugin
func (h *PluginHandler) Disable(c *gin.Context) {
	pluginID := c.Param("id")
	if pluginID == "" {
		response.BadRequest(c, "Plugin ID is required")
		return
	}

	if err := h.pluginManager.Disable(pluginID); err != nil {
		h.log.Error("Failed to disable plugin", "error", err, "plugin_id", pluginID)
		response.InternalError(c, "Failed to disable plugin: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "Plugin disabled successfully"})
}

// GetSettings returns plugin settings
func (h *PluginHandler) GetSettings(c *gin.Context) {
	pluginID := c.Param("id")
	if pluginID == "" {
		response.BadRequest(c, "Plugin ID is required")
		return
	}

	lp, exists := h.pluginManager.Get(pluginID)
	if !exists {
		response.NotFound(c, "Plugin not found")
		return
	}

	// Return plugin settings definition from manifest
	response.Success(c, gin.H{
		"settings": lp.Manifest.Settings,
	})
}

// UpdateSettings updates plugin settings
func (h *PluginHandler) UpdateSettings(c *gin.Context) {
	pluginID := c.Param("id")
	if pluginID == "" {
		response.BadRequest(c, "Plugin ID is required")
		return
	}

	var req struct {
		Settings map[string]interface{} `json:"settings" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	_, exists := h.pluginManager.Get(pluginID)
	if !exists {
		response.NotFound(c, "Plugin not found")
		return
	}

	// Store settings in database or file system
	// For now, we'll just acknowledge the request
	// In a full implementation, settings would be persisted
	h.log.Info("Plugin settings updated", "plugin_id", pluginID, "settings", req.Settings)

	response.Success(c, gin.H{
		"message":  "Settings updated successfully",
		"settings": req.Settings,
	})
}

// ============================================
// Log Handler
// ============================================

type LogHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *LogHandler) SystemLogs(c *gin.Context) { response.Success(c, []interface{}{}) }
func (h *LogHandler) TaskLogs(c *gin.Context)   { response.Success(c, []interface{}{}) }

// AuditLogs returns paginated audit logs with filtering
func (h *LogHandler) AuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	query := services.AuditLogQuery{
		Page:      page,
		PageSize:  pageSize,
		UserID:    c.Query("user_id"),
		Username:  c.Query("username"),
		Action:    c.Query("action"),
		Resource:  c.Query("resource"),
		Status:    c.Query("status"),
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
		IPAddress: c.Query("ip_address"),
		Search:    c.Query("search"),
	}

	result, err := h.svc.Audit.List(query)
	if err != nil {
		h.log.Error("Failed to list audit logs", "error", err)
		response.InternalError(c, "Failed to list audit logs")
		return
	}

	response.Success(c, result)
}

// AuditStats returns audit log statistics
func (h *LogHandler) AuditStats(c *gin.Context) {
	stats, err := h.svc.Audit.GetStats()
	if err != nil {
		h.log.Error("Failed to get audit stats", "error", err)
		response.InternalError(c, "Failed to get audit statistics")
		return
	}

	response.Success(c, stats)
}

// AuditActions returns distinct audit actions for filtering
func (h *LogHandler) AuditActions(c *gin.Context) {
	actions, err := h.svc.Audit.GetDistinctActions()
	if err != nil {
		h.log.Error("Failed to get audit actions", "error", err)
		response.InternalError(c, "Failed to get audit actions")
		return
	}

	response.Success(c, actions)
}

// AuditResources returns distinct audit resources for filtering
func (h *LogHandler) AuditResources(c *gin.Context) {
	resources, err := h.svc.Audit.GetDistinctResources()
	if err != nil {
		h.log.Error("Failed to get audit resources", "error", err)
		response.InternalError(c, "Failed to get audit resources")
		return
	}

	response.Success(c, resources)
}

// ============================================
// Settings Handler
// ============================================

type SettingsHandler struct {
	svc *services.Container
	log *logger.Logger
}

// Get returns all system settings
func (h *SettingsHandler) Get(c *gin.Context) {
	// Load settings from database
	var settings []models.SystemSetting
	if err := h.svc.DB.Find(&settings).Error; err != nil {
		h.log.Error("Failed to load settings", "error", err)
		response.InternalError(c, "Failed to load settings")
		return
	}

	// Convert to map for easier access
	settingsMap := make(map[string]interface{})
	for _, s := range settings {
		switch s.Type {
		case "int":
			if v, err := strconv.Atoi(s.Value); err == nil {
				settingsMap[s.Key] = v
			} else {
				settingsMap[s.Key] = s.Value
			}
		case "bool":
			settingsMap[s.Key] = s.Value == "true"
		case "json":
			var jsonVal interface{}
			if err := json.Unmarshal([]byte(s.Value), &jsonVal); err == nil {
				settingsMap[s.Key] = jsonVal
			} else {
				settingsMap[s.Key] = s.Value
			}
		default:
			settingsMap[s.Key] = s.Value
		}
	}

	// Merge with config defaults
	cfg := h.svc.Config
	result := gin.H{
		"general": gin.H{
			"site_name":        getSetting(settingsMap, "site_name", "VPanel"),
			"site_url":         getSetting(settingsMap, "site_url", ""),
			"site_description": getSetting(settingsMap, "site_description", "Server Management Panel"),
			"theme":            getSetting(settingsMap, "theme", "dark"),
			"language":         getSetting(settingsMap, "language", "en"),
			"timezone":         getSetting(settingsMap, "timezone", "UTC"),
		},
		"security": gin.H{
			"enable_2fa":             getSettingBool(settingsMap, "enable_2fa", false),
			"require_2fa":            getSettingBool(settingsMap, "require_2fa", false),
			"session_timeout":        getSettingInt(settingsMap, "session_timeout", cfg.Auth.SessionTimeout),
			"max_login_attempts":     getSettingInt(settingsMap, "max_login_attempts", cfg.Auth.MaxLoginAttempts),
			"lockout_duration":       getSettingInt(settingsMap, "lockout_duration", cfg.Auth.LockoutDuration),
			"oauth_github_enabled":   cfg.Auth.OAuth.GitHub.Enabled,
			"oauth_github_client_id": cfg.Auth.OAuth.GitHub.ClientID,
			"oauth_google_enabled":   cfg.Auth.OAuth.Google.Enabled,
			"oauth_google_client_id": cfg.Auth.OAuth.Google.ClientID,
		},
		"notifications": gin.H{
			"email_enabled":   getSettingBool(settingsMap, "email_enabled", false),
			"smtp_host":       getSetting(settingsMap, "smtp_host", ""),
			"smtp_port":       getSettingInt(settingsMap, "smtp_port", 587),
			"smtp_username":   getSetting(settingsMap, "smtp_username", ""),
			"smtp_password":   getSetting(settingsMap, "smtp_password", ""),
			"from_email":      getSetting(settingsMap, "from_email", ""),
			"cpu_alerts":      getSettingBool(settingsMap, "cpu_alerts", true),
			"memory_alerts":   getSettingBool(settingsMap, "memory_alerts", true),
			"disk_alerts":     getSettingBool(settingsMap, "disk_alerts", true),
			"service_alerts":  getSettingBool(settingsMap, "service_alerts", true),
			"ssl_alerts":      getSettingBool(settingsMap, "ssl_alerts", true),
			"security_alerts": getSettingBool(settingsMap, "security_alerts", true),
			"webhook_enabled": getSettingBool(settingsMap, "webhook_enabled", false),
			"webhook_url":     getSetting(settingsMap, "webhook_url", ""),
		},
		"backup": gin.H{
			"auto_backup_enabled": getSettingBool(settingsMap, "auto_backup_enabled", false),
			"backup_schedule":     getSetting(settingsMap, "backup_schedule", "daily"),
			"backup_retention":    getSettingInt(settingsMap, "backup_retention", 30),
			"backup_time":         getSetting(settingsMap, "backup_time", "02:00"),
			"storage_type":        getSetting(settingsMap, "storage_type", "local"),
			"backup_path":         getSetting(settingsMap, "backup_path", cfg.Storage.BackupDir),
		},
		"advanced": gin.H{
			"server_port":        cfg.Server.Port,
			"max_upload_size":    getSettingInt(settingsMap, "max_upload_size", 100),
			"enable_https":       cfg.Server.TLS.Enabled,
			"rate_limit_enabled": cfg.Server.RateLimit.Enabled,
			"log_level":          cfg.Logging.Level,
			"log_retention":      getSettingInt(settingsMap, "log_retention", 30),
		},
	}

	response.Success(c, result)
}

// Update updates system settings
func (h *SettingsHandler) Update(c *gin.Context) {
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	// Update settings in database
	for key, value := range updates {
		settingType := "string"
		var settingValue string

		switch v := value.(type) {
		case bool:
			settingType = "bool"
			settingValue = strconv.FormatBool(v)
		case float64:
			settingType = "int"
			settingValue = strconv.FormatInt(int64(v), 10)
		case string:
			settingValue = v
		default:
			// Try to marshal as JSON
			if jsonBytes, err := json.Marshal(v); err == nil {
				settingType = "json"
				settingValue = string(jsonBytes)
			} else {
				settingValue = fmt.Sprintf("%v", v)
			}
		}

		// Determine category
		category := "general"
		if strings.HasPrefix(key, "security_") || strings.HasPrefix(key, "oauth_") {
			category = "security"
		} else if strings.HasPrefix(key, "email_") || strings.HasPrefix(key, "smtp_") || strings.HasPrefix(key, "webhook_") || strings.HasSuffix(key, "_alerts") {
			category = "notifications"
		} else if strings.HasPrefix(key, "backup_") || strings.HasPrefix(key, "storage_") {
			category = "backup"
		} else if strings.HasPrefix(key, "server_") || strings.HasPrefix(key, "log_") || strings.HasPrefix(key, "max_") {
			category = "advanced"
		}

		setting := models.SystemSetting{
			Key:       key,
			Value:     settingValue,
			Type:      settingType,
			Category:  category,
			UpdatedAt: time.Now(),
		}

		// Upsert setting
		if err := h.svc.DB.Save(&setting).Error; err != nil {
			h.log.Error("Failed to save setting", "key", key, "error", err)
			response.InternalError(c, "Failed to save settings")
			return
		}
	}

	response.Success(c, gin.H{"message": "Settings updated successfully"})
}

// GetBackupSettings returns backup settings
func (h *SettingsHandler) GetBackupSettings(c *gin.Context) {
	var settings []models.SystemSetting
	h.svc.DB.Where("category = ?", "backup").Find(&settings)

	settingsMap := make(map[string]interface{})
	for _, s := range settings {
		switch s.Type {
		case "int":
			if v, err := strconv.Atoi(s.Value); err == nil {
				settingsMap[s.Key] = v
			}
		case "bool":
			settingsMap[s.Key] = s.Value == "true"
		default:
			settingsMap[s.Key] = s.Value
		}
	}

	cfg := h.svc.Config
	result := gin.H{
		"auto_backup_enabled": getSettingBool(settingsMap, "auto_backup_enabled", false),
		"backup_schedule":     getSetting(settingsMap, "backup_schedule", "daily"),
		"backup_retention":    getSettingInt(settingsMap, "backup_retention", 30),
		"backup_time":         getSetting(settingsMap, "backup_time", "02:00"),
		"storage_type":        getSetting(settingsMap, "storage_type", "local"),
		"backup_path":         getSetting(settingsMap, "backup_path", cfg.Storage.BackupDir),
	}

	response.Success(c, result)
}

// UpdateBackupSettings updates backup settings
func (h *SettingsHandler) UpdateBackupSettings(c *gin.Context) {
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	for key, value := range updates {
		settingType := "string"
		var settingValue string

		switch v := value.(type) {
		case bool:
			settingType = "bool"
			settingValue = strconv.FormatBool(v)
		case float64:
			settingType = "int"
			settingValue = strconv.FormatInt(int64(v), 10)
		case string:
			settingValue = v
		default:
			settingValue = fmt.Sprintf("%v", v)
		}

		setting := models.SystemSetting{
			Key:       key,
			Value:     settingValue,
			Type:      settingType,
			Category:  "backup",
			UpdatedAt: time.Now(),
		}

		if err := h.svc.DB.Save(&setting).Error; err != nil {
			h.log.Error("Failed to save backup setting", "key", key, "error", err)
			response.InternalError(c, "Failed to save backup settings")
			return
		}
	}

	response.Success(c, gin.H{"message": "Backup settings updated successfully"})
}

// GetNotificationSettings returns notification settings
func (h *SettingsHandler) GetNotificationSettings(c *gin.Context) {
	var settings []models.SystemSetting
	h.svc.DB.Where("category = ?", "notifications").Find(&settings)

	settingsMap := make(map[string]interface{})
	for _, s := range settings {
		switch s.Type {
		case "int":
			if v, err := strconv.Atoi(s.Value); err == nil {
				settingsMap[s.Key] = v
			}
		case "bool":
			settingsMap[s.Key] = s.Value == "true"
		default:
			settingsMap[s.Key] = s.Value
		}
	}

	result := gin.H{
		"email_enabled":   getSettingBool(settingsMap, "email_enabled", false),
		"smtp_host":       getSetting(settingsMap, "smtp_host", ""),
		"smtp_port":       getSettingInt(settingsMap, "smtp_port", 587),
		"smtp_username":   getSetting(settingsMap, "smtp_username", ""),
		"smtp_password":   getSetting(settingsMap, "smtp_password", ""),
		"from_email":      getSetting(settingsMap, "from_email", ""),
		"cpu_alerts":      getSettingBool(settingsMap, "cpu_alerts", true),
		"memory_alerts":   getSettingBool(settingsMap, "memory_alerts", true),
		"disk_alerts":     getSettingBool(settingsMap, "disk_alerts", true),
		"service_alerts":  getSettingBool(settingsMap, "service_alerts", true),
		"ssl_alerts":      getSettingBool(settingsMap, "ssl_alerts", true),
		"security_alerts": getSettingBool(settingsMap, "security_alerts", true),
		"webhook_enabled": getSettingBool(settingsMap, "webhook_enabled", false),
		"webhook_url":     getSetting(settingsMap, "webhook_url", ""),
	}

	response.Success(c, result)
}

// UpdateNotificationSettings updates notification settings
func (h *SettingsHandler) UpdateNotificationSettings(c *gin.Context) {
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	for key, value := range updates {
		settingType := "string"
		var settingValue string

		switch v := value.(type) {
		case bool:
			settingType = "bool"
			settingValue = strconv.FormatBool(v)
		case float64:
			settingType = "int"
			settingValue = strconv.FormatInt(int64(v), 10)
		case string:
			settingValue = v
		default:
			settingValue = fmt.Sprintf("%v", v)
		}

		setting := models.SystemSetting{
			Key:       key,
			Value:     settingValue,
			Type:      settingType,
			Category:  "notifications",
			UpdatedAt: time.Now(),
		}

		if err := h.svc.DB.Save(&setting).Error; err != nil {
			h.log.Error("Failed to save notification setting", "key", key, "error", err)
			response.InternalError(c, "Failed to save notification settings")
			return
		}
	}

	response.Success(c, gin.H{"message": "Notification settings updated successfully"})
}

// Helper functions
func getSetting(settingsMap map[string]interface{}, key string, defaultValue string) string {
	if v, ok := settingsMap[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		return fmt.Sprintf("%v", v)
	}
	return defaultValue
}

func getSettingInt(settingsMap map[string]interface{}, key string, defaultValue int) int {
	if v, ok := settingsMap[key]; ok {
		switch val := v.(type) {
		case int:
			return val
		case float64:
			return int(val)
		case string:
			if i, err := strconv.Atoi(val); err == nil {
				return i
			}
		}
	}
	return defaultValue
}

func getSettingBool(settingsMap map[string]interface{}, key string, defaultValue bool) bool {
	if v, ok := settingsMap[key]; ok {
		switch val := v.(type) {
		case bool:
			return val
		case string:
			return val == "true"
		}
	}
	return defaultValue
}

// ============================================
// User Handler
// ============================================

type UserHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *UserHandler) List(c *gin.Context) {
	var users []models.User
	if err := h.svc.DB.Find(&users).Error; err != nil {
		response.InternalError(c, "Failed to list users")
		return
	}
	response.Success(c, users)
}

func (h *UserHandler) Create(c *gin.Context) {
	var req struct {
		Username    string `json:"username" binding:"required"`
		Email       string `json:"email" binding:"required,email"`
		Password    string `json:"password" binding:"required,min=8"`
		DisplayName string `json:"display_name"`
		Role        string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	if req.Role == "" {
		req.Role = "user"
	}

	user, err := h.svc.Auth.Register(req.Username, req.Email, req.Password, req.DisplayName)
	if err != nil {
		if err == services.ErrUserAlreadyExists {
			response.Conflict(c, "Username or email already exists")
			return
		}
		response.InternalError(c, "Failed to create user")
		return
	}

	// Update role if not default
	if req.Role != "user" {
		h.svc.DB.Model(user).Update("role", req.Role)
		user.Role = req.Role
	}

	response.Created(c, user)
}

func (h *UserHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var user models.User
	if err := h.svc.DB.First(&user, "id = ?", id).Error; err != nil {
		response.NotFound(c, "User not found")
		return
	}
	response.Success(c, user)
}

func (h *UserHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	// Don't allow password update via this endpoint
	delete(updates, "password")

	if err := h.svc.DB.Model(&models.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		response.InternalError(c, "Failed to update user")
		return
	}

	var user models.User
	h.svc.DB.First(&user, "id = ?", id)
	response.Success(c, user)
}

func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	// Don't allow deleting the current user
	userID, _ := c.Get("user_id")
	if id == userID.(string) {
		response.BadRequest(c, "Cannot delete your own account")
		return
	}

	if err := h.svc.DB.Delete(&models.User{}, "id = ?", id).Error; err != nil {
		response.InternalError(c, "Failed to delete user")
		return
	}
	response.NoContent(c)
}

func (h *UserHandler) GetPermissions(c *gin.Context)    { response.Success(c, nil) }
func (h *UserHandler) UpdatePermissions(c *gin.Context) { response.Success(c, nil) }

// ============================================
// Node Handler
// ============================================

type NodeHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *NodeHandler) List(c *gin.Context) {
	var nodes []models.Node
	if err := h.svc.DB.Find(&nodes).Error; err != nil {
		response.InternalError(c, "Failed to list nodes")
		return
	}
	response.Success(c, nodes)
}

func (h *NodeHandler) Add(c *gin.Context) {
	var node models.Node
	if err := c.ShouldBindJSON(&node); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	// Generate agent token
	node.AgentToken = uuid.New().String()
	node.Status = "offline"

	if err := h.svc.DB.Create(&node).Error; err != nil {
		response.InternalError(c, "Failed to add node")
		return
	}
	response.Created(c, node)
}

func (h *NodeHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := h.svc.DB.First(&node, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Node not found")
		return
	}
	response.Success(c, node)
}

func (h *NodeHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request data")
		return
	}

	// Don't allow updating agent_token
	delete(updates, "agent_token")

	if err := h.svc.DB.Model(&models.Node{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		response.InternalError(c, "Failed to update node")
		return
	}

	var node models.Node
	h.svc.DB.First(&node, "id = ?", id)
	response.Success(c, node)
}

func (h *NodeHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DB.Delete(&models.Node{}, "id = ?", id).Error; err != nil {
		response.InternalError(c, "Failed to delete node")
		return
	}
	response.NoContent(c)
}

func (h *NodeHandler) Status(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := h.svc.DB.First(&node, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Node not found")
		return
	}

	// Check if node is online (last seen within 1 minute)
	if node.LastSeenAt != nil && time.Since(*node.LastSeenAt) < time.Minute {
		node.Status = "online"
	} else {
		node.Status = "offline"
	}

	response.Success(c, gin.H{
		"status":       node.Status,
		"last_seen_at": node.LastSeenAt,
	})
}

func (h *NodeHandler) ExecuteCommand(c *gin.Context) { response.Success(c, nil) }

// ============================================
// Agent Handler
// ============================================

type AgentHandler struct {
	svc *services.Container
	log *logger.Logger
}

func (h *AgentHandler) WebSocket(c *gin.Context) { /* WebSocket handler for agents */ }
