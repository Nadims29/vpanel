package services

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
	"github.com/google/uuid"
	"github.com/vpanel/server/internal/models"
	"github.com/vpanel/server/pkg/logger"
	"gorm.io/gorm"
)

// AppsService manages application deployments from Git repositories
type AppsService struct {
	db     *gorm.DB
	log    *logger.Logger
	docker *DockerService
	nginx  *NginxService

	// Track deployment logs in memory for real-time streaming
	deployLogs   map[string]*strings.Builder
	deployLogsMu sync.RWMutex
}

// NewAppsService creates a new apps service
func NewAppsService(db *gorm.DB, log *logger.Logger, docker *DockerService, nginx *NginxService) *AppsService {
	return &AppsService{
		db:         db,
		log:        log,
		docker:     docker,
		nginx:      nginx,
		deployLogs: make(map[string]*strings.Builder),
	}
}

// ListApps returns all apps
func (s *AppsService) ListApps() ([]models.App, error) {
	var apps []models.App
	if err := s.db.Order("created_at DESC").Find(&apps).Error; err != nil {
		return nil, err
	}

	// Update status based on container state
	ctx := context.Background()
	for i := range apps {
		if apps[i].ContainerID != "" {
			info, err := s.docker.GetContainer(ctx, apps[i].ContainerID)
			if err != nil {
				apps[i].Status = "stopped"
			} else {
				apps[i].Status = info.Status
			}
		}
	}

	return apps, nil
}

// GetApp returns an app by ID
func (s *AppsService) GetApp(id string) (*models.App, error) {
	var app models.App
	if err := s.db.First(&app, "id = ?", id).Error; err != nil {
		return nil, err
	}

	// Update status based on container state
	if app.ContainerID != "" {
		ctx := context.Background()
		info, err := s.docker.GetContainer(ctx, app.ContainerID)
		if err != nil {
			app.Status = "stopped"
		} else {
			app.Status = info.Status
		}
	}

	return &app, nil
}

// CreateAppRequest represents the request for creating an app
type CreateAppRequest struct {
	Name           string            `json:"name" binding:"required"`
	Description    string            `json:"description"`
	GitURL         string            `json:"git_url" binding:"required"`
	GitBranch      string            `json:"git_branch"`
	GitToken       string            `json:"git_token"`
	DockerfilePath string            `json:"dockerfile_path"`
	BuildContext   string            `json:"build_context"`
	Port           int               `json:"port"`
	EnvVars        map[string]string `json:"env_vars"`
	Domain         string            `json:"domain"`
}

// CreateApp creates a new app
func (s *AppsService) CreateApp(req *CreateAppRequest) (*models.App, error) {
	// Set defaults
	if req.GitBranch == "" {
		req.GitBranch = "main"
	}
	if req.DockerfilePath == "" {
		req.DockerfilePath = "Dockerfile"
	}
	if req.BuildContext == "" {
		req.BuildContext = "."
	}
	if req.Port == 0 {
		req.Port = 3000
	}

	// Convert env vars to JSON
	var envVars models.JSON
	if req.EnvVars != nil {
		envVars = make(models.JSON)
		for k, v := range req.EnvVars {
			envVars[k] = v
		}
	}

	app := &models.App{
		Name:           req.Name,
		Description:    req.Description,
		Status:         "stopped",
		GitURL:         req.GitURL,
		GitBranch:      req.GitBranch,
		GitToken:       req.GitToken,
		DockerfilePath: req.DockerfilePath,
		BuildContext:   req.BuildContext,
		Port:           req.Port,
		EnvVars:        envVars,
		Domain:         req.Domain,
	}

	if err := s.db.Create(app).Error; err != nil {
		return nil, err
	}

	s.log.Info("App created", "app_id", app.ID, "name", app.Name)
	return app, nil
}

// UpdateApp updates an app
func (s *AppsService) UpdateApp(id string, updates map[string]interface{}) (*models.App, error) {
	// Don't allow updating certain fields
	delete(updates, "id")
	delete(updates, "container_id")
	delete(updates, "image_tag")
	delete(updates, "last_deploy_at")

	if err := s.db.Model(&models.App{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.GetApp(id)
}

// DeleteApp deletes an app and its resources
func (s *AppsService) DeleteApp(id string) error {
	app, err := s.GetApp(id)
	if err != nil {
		return err
	}

	ctx := context.Background()

	// Stop and remove container
	if app.ContainerID != "" {
		s.docker.StopContainer(ctx, app.ContainerID)
		s.docker.RemoveContainer(ctx, app.ContainerID, true)
	}

	// Remove image
	if app.ImageTag != "" {
		s.docker.RemoveImage(ctx, app.ImageTag, true)
	}

	// Remove nginx site if exists
	if app.NginxSiteID != "" {
		s.nginx.DeleteSite(app.NginxSiteID)
	}

	// Delete deployment records
	s.db.Where("app_id = ?", id).Delete(&models.AppDeployment{})

	// Delete app
	if err := s.db.Delete(&models.App{}, "id = ?", id).Error; err != nil {
		return err
	}

	s.log.Info("App deleted", "app_id", id, "name", app.Name)
	return nil
}

// DeployApp triggers a deployment
func (s *AppsService) DeployApp(appID string) (*models.AppDeployment, error) {
	app, err := s.GetApp(appID)
	if err != nil {
		return nil, err
	}

	// Create deployment record
	deployment := &models.AppDeployment{
		AppID:    appID,
		Status:   "pending",
		Progress: 0,
	}

	if err := s.db.Create(deployment).Error; err != nil {
		return nil, err
	}

	// Initialize log buffer
	s.deployLogsMu.Lock()
	s.deployLogs[deployment.ID] = &strings.Builder{}
	s.deployLogsMu.Unlock()

	// Update app status
	s.db.Model(app).Update("status", "building")

	// Start async deployment
	go s.runDeployment(deployment.ID, app)

	s.log.Info("Deployment started", "app_id", appID, "deployment_id", deployment.ID)
	return deployment, nil
}

// runDeployment executes the deployment process
func (s *AppsService) runDeployment(deployID string, app *models.App) {
	ctx := context.Background()
	startTime := time.Now()

	// Helper to log and update progress
	logAndUpdate := func(status string, progress int, message string) {
		s.appendLog(deployID, message)
		s.db.Model(&models.AppDeployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
			"status":   status,
			"progress": progress,
		})
	}

	// Helper to fail deployment
	failDeploy := func(err error, message string) {
		now := time.Now()
		duration := int(now.Sub(startTime).Seconds())
		errorMsg := fmt.Sprintf("%s: %v", message, err)
		s.appendLog(deployID, "❌ "+errorMsg)

		s.db.Model(&models.AppDeployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
			"status":      "failed",
			"error":       errorMsg,
			"duration":    duration,
			"finished_at": &now,
		})
		s.db.Model(app).Update("status", "failed")
		s.log.Error("Deployment failed", "deployment_id", deployID, "error", err)
	}

	// Step 1: Clone repository (0-20%)
	logAndUpdate("cloning", 5, "📦 Cloning repository...")
	logAndUpdate("cloning", 10, fmt.Sprintf("   Repository: %s", app.GitURL))
	logAndUpdate("cloning", 12, fmt.Sprintf("   Branch: %s", app.GitBranch))

	repoPath, commitHash, commitMsg, err := s.gitClone(app.GitURL, app.GitBranch, app.GitToken)
	if err != nil {
		failDeploy(err, "Failed to clone repository")
		return
	}
	defer os.RemoveAll(repoPath) // Cleanup

	logAndUpdate("cloning", 20, fmt.Sprintf("✓ Repository cloned (commit: %s)", commitHash[:8]))
	s.db.Model(&models.AppDeployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"commit_hash": commitHash,
		"commit_msg":  commitMsg,
	})

	// Step 2: Build Docker image (20-70%)
	logAndUpdate("building", 25, "🔨 Building Docker image...")
	imageTag := fmt.Sprintf("vpanel-app-%s:%d", app.Name, time.Now().Unix())

	buildContext := filepath.Join(repoPath, app.BuildContext)
	dockerfile := app.DockerfilePath

	err = s.buildImage(ctx, deployID, buildContext, dockerfile, imageTag)
	if err != nil {
		failDeploy(err, "Failed to build image")
		return
	}

	logAndUpdate("building", 70, fmt.Sprintf("✓ Image built: %s", imageTag))

	// Step 3: Stop old container (70-75%)
	if app.ContainerID != "" {
		logAndUpdate("deploying", 72, "🛑 Stopping old container...")
		s.docker.StopContainer(ctx, app.ContainerID)
		s.docker.RemoveContainer(ctx, app.ContainerID, true)
		logAndUpdate("deploying", 75, "✓ Old container removed")
	}

	// Step 4: Start new container (75-90%)
	logAndUpdate("deploying", 78, "🚀 Starting new container...")

	hostPort, err := s.getFreePort()
	if err != nil {
		failDeploy(err, "Failed to find free port")
		return
	}

	containerID, err := s.createAndStartContainer(ctx, app, imageTag, hostPort)
	if err != nil {
		failDeploy(err, "Failed to start container")
		return
	}

	logAndUpdate("deploying", 90, fmt.Sprintf("✓ Container started (port %d → %d)", app.Port, hostPort))

	// Step 5: Configure Nginx (90-95%)
	var nginxSiteID string
	if app.Domain != "" {
		logAndUpdate("deploying", 92, "🌐 Configuring domain...")
		siteID, err := s.configureNginx(app, hostPort)
		if err != nil {
			s.appendLog(deployID, fmt.Sprintf("⚠️ Warning: Failed to configure Nginx: %v", err))
		} else {
			nginxSiteID = siteID
			logAndUpdate("deploying", 95, fmt.Sprintf("✓ Domain configured: %s", app.Domain))
		}
	}

	// Step 6: Update app record and finish
	now := time.Now()
	duration := int(now.Sub(startTime).Seconds())

	s.db.Model(app).Updates(map[string]interface{}{
		"status":         "running",
		"container_id":   containerID,
		"host_port":      hostPort,
		"image_tag":      imageTag,
		"last_deploy_at": &now,
		"nginx_site_id":  nginxSiteID,
	})

	// Finalize deployment
	s.appendLog(deployID, "")
	s.appendLog(deployID, "══════════════════════════════════════════")
	s.appendLog(deployID, fmt.Sprintf("✅ Deployment completed in %ds", duration))
	s.appendLog(deployID, fmt.Sprintf("   Container: %s", containerID[:12]))
	s.appendLog(deployID, fmt.Sprintf("   Port: %d → %d", app.Port, hostPort))
	if app.Domain != "" {
		s.appendLog(deployID, fmt.Sprintf("   Domain: %s", app.Domain))
	}
	s.appendLog(deployID, "══════════════════════════════════════════")

	// Save final logs
	s.deployLogsMu.RLock()
	logs := s.deployLogs[deployID].String()
	s.deployLogsMu.RUnlock()

	s.db.Model(&models.AppDeployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"status":      "success",
		"progress":    100,
		"duration":    duration,
		"finished_at": &now,
		"logs":        logs,
	})

	s.log.Info("Deployment completed", "deployment_id", deployID, "duration", duration)
}

// gitClone clones a repository and returns the path, commit hash, and commit message
func (s *AppsService) gitClone(url, branch, token string) (string, string, string, error) {
	destPath := filepath.Join(os.TempDir(), "vpanel-apps", uuid.New().String())

	if err := os.MkdirAll(destPath, 0755); err != nil {
		return "", "", "", err
	}

	// Build URL with token for private repos
	cloneURL := url
	if token != "" {
		// Support both GitHub and GitLab token formats
		if strings.Contains(url, "github.com") {
			cloneURL = strings.Replace(url, "https://", fmt.Sprintf("https://%s@", token), 1)
		} else if strings.Contains(url, "gitlab") {
			cloneURL = strings.Replace(url, "https://", fmt.Sprintf("https://oauth2:%s@", token), 1)
		} else {
			cloneURL = strings.Replace(url, "https://", fmt.Sprintf("https://%s@", token), 1)
		}
	}

	// Clone with depth=1 for faster cloning
	cmd := exec.Command("git", "clone", "--depth=1", "--branch", branch, cloneURL, destPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		os.RemoveAll(destPath)
		return "", "", "", fmt.Errorf("git clone failed: %s", string(output))
	}

	// Get commit hash
	cmd = exec.Command("git", "rev-parse", "HEAD")
	cmd.Dir = destPath
	hashOutput, err := cmd.Output()
	if err != nil {
		return destPath, "", "", nil
	}
	commitHash := strings.TrimSpace(string(hashOutput))

	// Get commit message
	cmd = exec.Command("git", "log", "-1", "--format=%s")
	cmd.Dir = destPath
	msgOutput, err := cmd.Output()
	if err != nil {
		return destPath, commitHash, "", nil
	}
	commitMsg := strings.TrimSpace(string(msgOutput))

	return destPath, commitHash, commitMsg, nil
}

// buildImage builds a Docker image from source
func (s *AppsService) buildImage(ctx context.Context, deployID, contextPath, dockerfile, tag string) error {
	if s.docker.client == nil {
		return ErrDockerNotConnected
	}

	// Create tar archive of build context
	tarBuffer, err := s.createTar(contextPath)
	if err != nil {
		return fmt.Errorf("failed to create build context: %w", err)
	}

	// Build image
	resp, err := s.docker.client.ImageBuild(ctx, tarBuffer, types.ImageBuildOptions{
		Dockerfile: dockerfile,
		Tags:       []string{tag},
		Remove:     true,
		NoCache:    false,
	})
	if err != nil {
		return fmt.Errorf("failed to build image: %w", err)
	}
	defer resp.Body.Close()

	// Stream build output
	decoder := json.NewDecoder(resp.Body)
	for {
		var msg struct {
			Stream string `json:"stream"`
			Error  string `json:"error"`
		}
		if err := decoder.Decode(&msg); err != nil {
			if err == io.EOF {
				break
			}
			continue
		}

		if msg.Error != "" {
			return fmt.Errorf("build error: %s", msg.Error)
		}

		if msg.Stream != "" {
			stream := strings.TrimSpace(msg.Stream)
			if stream != "" && !strings.HasPrefix(stream, "---") {
				s.appendLog(deployID, "   "+stream)
			}
		}
	}

	return nil
}

// createTar creates a tar archive from a directory
func (s *AppsService) createTar(srcPath string) (io.Reader, error) {
	buf := new(bytes.Buffer)
	tw := tar.NewWriter(buf)

	err := filepath.Walk(srcPath, func(file string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip .git directory
		if fi.IsDir() && fi.Name() == ".git" {
			return filepath.SkipDir
		}

		// Create tar header
		header, err := tar.FileInfoHeader(fi, fi.Name())
		if err != nil {
			return err
		}

		// Update header name to be relative
		relPath, err := filepath.Rel(srcPath, file)
		if err != nil {
			return err
		}
		header.Name = relPath

		if err := tw.WriteHeader(header); err != nil {
			return err
		}

		// Write file content
		if !fi.IsDir() {
			f, err := os.Open(file)
			if err != nil {
				return err
			}
			defer f.Close()

			if _, err := io.Copy(tw, f); err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	if err := tw.Close(); err != nil {
		return nil, err
	}

	return buf, nil
}

// createAndStartContainer creates and starts a container for the app
func (s *AppsService) createAndStartContainer(ctx context.Context, app *models.App, imageTag string, hostPort int) (string, error) {
	if s.docker.client == nil {
		return "", ErrDockerNotConnected
	}

	containerName := fmt.Sprintf("vpanel-app-%s", app.Name)

	// Build environment variables
	var env []string
	if app.EnvVars != nil {
		for k, v := range app.EnvVars {
			if strVal, ok := v.(string); ok {
				env = append(env, fmt.Sprintf("%s=%s", k, strVal))
			}
		}
	}

	// Port mapping
	exposedPort := nat.Port(fmt.Sprintf("%d/tcp", app.Port))
	portBindings := nat.PortMap{
		exposedPort: []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", hostPort)},
		},
	}

	// Container config
	config := &container.Config{
		Image:  imageTag,
		Env:    env,
		Labels: map[string]string{"vpanel.managed": "true", "vpanel.app": app.Name},
	}

	// Host config
	hostConfig := &container.HostConfig{
		PortBindings:  portBindings,
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
	}

	// Remove existing container with same name
	s.docker.client.ContainerRemove(ctx, containerName, container.RemoveOptions{Force: true})

	// Create container
	resp, err := s.docker.client.ContainerCreate(ctx, config, hostConfig, &network.NetworkingConfig{}, nil, containerName)
	if err != nil {
		return "", err
	}

	// Start container
	if err := s.docker.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return "", err
	}

	return resp.ID[:12], nil
}

// configureNginx creates or updates Nginx site for the app
func (s *AppsService) configureNginx(app *models.App, hostPort int) (string, error) {
	// Check if site already exists
	if app.NginxSiteID != "" {
		// Update existing site
		err := s.nginx.UpdateSite(app.NginxSiteID, map[string]interface{}{
			"proxy_target": fmt.Sprintf("http://127.0.0.1:%d", hostPort),
		})
		if err != nil {
			return "", err
		}
		return app.NginxSiteID, nil
	}

	// Create new site
	site := &models.NginxSite{
		Name:         fmt.Sprintf("app-%s", app.Name),
		Domain:       app.Domain,
		Port:         80,
		ProxyEnabled: true,
		ProxyTarget:  fmt.Sprintf("http://127.0.0.1:%d", hostPort),
		Enabled:      true,
	}

	if err := s.nginx.CreateSite(site); err != nil {
		return "", err
	}

	return site.ID, nil
}

// getFreePort finds an available port
func (s *AppsService) getFreePort() (int, error) {
	// Try ports in range 32000-33000
	for port := 32000; port < 33000; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			ln.Close()
			return port, nil
		}
	}
	return 0, fmt.Errorf("no free port available")
}

// appendLog appends a log message to the deployment logs
func (s *AppsService) appendLog(deployID, message string) {
	s.deployLogsMu.Lock()
	defer s.deployLogsMu.Unlock()

	if buf, ok := s.deployLogs[deployID]; ok {
		buf.WriteString(message + "\n")
	}
}

// StartApp starts an app's container
func (s *AppsService) StartApp(id string) error {
	app, err := s.GetApp(id)
	if err != nil {
		return err
	}

	if app.ContainerID == "" {
		return fmt.Errorf("app has no container, please deploy first")
	}

	ctx := context.Background()
	if err := s.docker.StartContainer(ctx, app.ContainerID); err != nil {
		return err
	}

	s.db.Model(app).Update("status", "running")
	return nil
}

// StopApp stops an app's container
func (s *AppsService) StopApp(id string) error {
	app, err := s.GetApp(id)
	if err != nil {
		return err
	}

	if app.ContainerID == "" {
		return nil
	}

	ctx := context.Background()
	if err := s.docker.StopContainer(ctx, app.ContainerID); err != nil {
		return err
	}

	s.db.Model(app).Update("status", "stopped")
	return nil
}

// RestartApp restarts an app's container
func (s *AppsService) RestartApp(id string) error {
	app, err := s.GetApp(id)
	if err != nil {
		return err
	}

	if app.ContainerID == "" {
		return fmt.Errorf("app has no container, please deploy first")
	}

	ctx := context.Background()
	if err := s.docker.RestartContainer(ctx, app.ContainerID); err != nil {
		return err
	}

	s.db.Model(app).Update("status", "running")
	return nil
}

// GetAppLogs returns the container logs for an app
func (s *AppsService) GetAppLogs(id string, tail int) (string, error) {
	app, err := s.GetApp(id)
	if err != nil {
		return "", err
	}

	if app.ContainerID == "" {
		return "", fmt.Errorf("app has no container")
	}

	ctx := context.Background()
	return s.docker.GetContainerLogs(ctx, app.ContainerID, tail, true)
}

// ListDeployments returns all deployments for an app
func (s *AppsService) ListDeployments(appID string) ([]models.AppDeployment, error) {
	var deployments []models.AppDeployment
	if err := s.db.Where("app_id = ?", appID).Order("created_at DESC").Find(&deployments).Error; err != nil {
		return nil, err
	}
	return deployments, nil
}

// GetDeployment returns a deployment by ID
func (s *AppsService) GetDeployment(id string) (*models.AppDeployment, error) {
	var deployment models.AppDeployment
	if err := s.db.First(&deployment, "id = ?", id).Error; err != nil {
		return nil, err
	}

	// If deployment is in progress, get live logs
	if deployment.Status != "success" && deployment.Status != "failed" {
		s.deployLogsMu.RLock()
		if buf, ok := s.deployLogs[id]; ok {
			deployment.Logs = buf.String()
		}
		s.deployLogsMu.RUnlock()
	}

	return &deployment, nil
}
