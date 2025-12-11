package services

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/vpanel/server/internal/models"
	"github.com/vpanel/server/pkg/logger"
	"gorm.io/gorm"
)

// DockerService manages Docker containers
type DockerService struct {
	db     *gorm.DB
	log    *logger.Logger
	client *client.Client
}

// NewDockerService creates a new docker service
func NewDockerService(db *gorm.DB, log *logger.Logger) *DockerService {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Warn("Failed to connect to Docker", "error", err)
	}
	return &DockerService{db: db, log: log, client: cli}
}

// ContainerInfo represents container information
type ContainerInfo struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	Status  string            `json:"status"`
	State   string            `json:"state"`
	Created string            `json:"created"`
	Ports   []string          `json:"ports"`
	Network string            `json:"network"`
	Command string            `json:"command"`
	Size    string            `json:"size"`
	Labels  map[string]string `json:"labels"`
	CPU     float64           `json:"cpu"`
	Memory  *MemoryInfo       `json:"memory"`
}

// MemoryInfo represents memory usage
type MemoryInfo struct {
	Used  float64 `json:"used"`
	Limit float64 `json:"limit"`
}

// GetInfo returns Docker daemon info
func (s *DockerService) GetInfo(ctx context.Context) (map[string]interface{}, error) {
	if s.client == nil {
		return nil, ErrDockerNotConnected
	}

	info, err := s.client.Info(ctx)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"containers":         info.Containers,
		"containers_running": info.ContainersRunning,
		"containers_paused":  info.ContainersPaused,
		"containers_stopped": info.ContainersStopped,
		"images":             info.Images,
		"server_version":     info.ServerVersion,
		"os":                 info.OperatingSystem,
		"architecture":       info.Architecture,
		"memory":             info.MemTotal,
		"cpus":               info.NCPU,
		"name":               info.Name,
	}, nil
}

// ListContainers returns all containers
func (s *DockerService) ListContainers(ctx context.Context, all bool) ([]ContainerInfo, error) {
	if s.client == nil {
		return nil, ErrDockerNotConnected
	}

	containers, err := s.client.ContainerList(ctx, types.ContainerListOptions{All: all})
	if err != nil {
		return nil, err
	}

	result := make([]ContainerInfo, len(containers))
	for i, c := range containers {
		// Format ports
		ports := make([]string, 0)
		for _, p := range c.Ports {
			if p.PublicPort > 0 {
				ports = append(ports, formatPort(p))
			}
		}

		// Get network name
		networkName := ""
		for name := range c.NetworkSettings.Networks {
			networkName = name
			break
		}

		// Format name (remove leading /)
		name := c.Names[0]
		if strings.HasPrefix(name, "/") {
			name = name[1:]
		}

		// Map state
		status := mapContainerState(c.State)

		result[i] = ContainerInfo{
			ID:      c.ID[:12],
			Name:    name,
			Image:   c.Image,
			Status:  status,
			State:   c.State,
			Created: formatTime(c.Created),
			Ports:   ports,
			Network: networkName,
			Command: c.Command,
			Labels:  c.Labels,
		}
	}

	return result, nil
}

// GetContainer returns container details
func (s *DockerService) GetContainer(ctx context.Context, id string) (*ContainerInfo, error) {
	if s.client == nil {
		return nil, ErrDockerNotConnected
	}

	c, err := s.client.ContainerInspect(ctx, id)
	if err != nil {
		return nil, err
	}

	// Format ports
	ports := make([]string, 0)
	for port, bindings := range c.NetworkSettings.Ports {
		for _, binding := range bindings {
			ports = append(ports, binding.HostPort+":"+port.Port()+"/"+port.Proto())
		}
	}

	// Get network name
	networkName := ""
	for name := range c.NetworkSettings.Networks {
		networkName = name
		break
	}

	status := mapContainerState(c.State.Status)

	return &ContainerInfo{
		ID:      c.ID[:12],
		Name:    strings.TrimPrefix(c.Name, "/"),
		Image:   c.Config.Image,
		Status:  status,
		State:   c.State.Status,
		Created: c.Created,
		Ports:   ports,
		Network: networkName,
		Command: strings.Join(c.Config.Cmd, " "),
		Labels:  c.Config.Labels,
	}, nil
}

// CreateContainerRequest represents container creation request
type CreateContainerRequest struct {
	Name       string            `json:"name"`
	Image      string            `json:"image"`
	Ports      []PortMapping     `json:"ports"`
	Network    string            `json:"network"`
	Env        map[string]string `json:"env"`
	Volumes    []VolumeMapping   `json:"volumes"`
	Command    []string          `json:"command"`
	Restart    string            `json:"restart"`
	AutoRemove bool              `json:"auto_remove"`
}

// PortMapping represents port mapping
type PortMapping struct {
	Host      int    `json:"host"`
	Container int    `json:"container"`
	Protocol  string `json:"protocol"`
}

// VolumeMapping represents volume mapping
type VolumeMapping struct {
	Host      string `json:"host"`
	Container string `json:"container"`
}

// CreateContainer creates a new container
func (s *DockerService) CreateContainer(ctx context.Context, req *CreateContainerRequest) (string, error) {
	if s.client == nil {
		return "", ErrDockerNotConnected
	}

	// Pull image if not exists
	_, _, err := s.client.ImageInspectWithRaw(ctx, req.Image)
	if err != nil {
		reader, err := s.client.ImagePull(ctx, req.Image, types.ImagePullOptions{})
		if err != nil {
			return "", err
		}
		defer reader.Close()
		io.Copy(io.Discard, reader)
	}

	// Build container config
	config := &container.Config{
		Image:  req.Image,
		Labels: map[string]string{"vpanel.managed": "true"},
	}

	// Add command
	if len(req.Command) > 0 {
		config.Cmd = req.Command
	}

	// Add environment variables
	if len(req.Env) > 0 {
		env := make([]string, 0, len(req.Env))
		for k, v := range req.Env {
			env = append(env, k+"="+v)
		}
		config.Env = env
	}

	// Build host config
	hostConfig := &container.HostConfig{
		AutoRemove: req.AutoRemove,
	}

	// Set restart policy
	switch req.Restart {
	case "always":
		hostConfig.RestartPolicy = container.RestartPolicy{Name: "always"}
	case "unless-stopped":
		hostConfig.RestartPolicy = container.RestartPolicy{Name: "unless-stopped"}
	case "on-failure":
		hostConfig.RestartPolicy = container.RestartPolicy{Name: "on-failure", MaximumRetryCount: 3}
	}

	// Add volume bindings
	if len(req.Volumes) > 0 {
		binds := make([]string, len(req.Volumes))
		for i, v := range req.Volumes {
			binds[i] = v.Host + ":" + v.Container
		}
		hostConfig.Binds = binds
	}

	// Network config
	networkConfig := &network.NetworkingConfig{}
	if req.Network != "" && req.Network != "bridge" {
		networkConfig.EndpointsConfig = map[string]*network.EndpointSettings{
			req.Network: {},
		}
	}

	// Create container
	resp, err := s.client.ContainerCreate(ctx, config, hostConfig, networkConfig, nil, req.Name)
	if err != nil {
		return "", err
	}

	return resp.ID[:12], nil
}

// StartContainer starts a container
func (s *DockerService) StartContainer(ctx context.Context, id string) error {
	if s.client == nil {
		return ErrDockerNotConnected
	}
	return s.client.ContainerStart(ctx, id, types.ContainerStartOptions{})
}

// StopContainer stops a container
func (s *DockerService) StopContainer(ctx context.Context, id string) error {
	if s.client == nil {
		return ErrDockerNotConnected
	}
	timeout := 10
	return s.client.ContainerStop(ctx, id, container.StopOptions{Timeout: &timeout})
}

// RestartContainer restarts a container
func (s *DockerService) RestartContainer(ctx context.Context, id string) error {
	if s.client == nil {
		return ErrDockerNotConnected
	}
	timeout := 10
	return s.client.ContainerRestart(ctx, id, container.StopOptions{Timeout: &timeout})
}

// RemoveContainer removes a container
func (s *DockerService) RemoveContainer(ctx context.Context, id string, force bool) error {
	if s.client == nil {
		return ErrDockerNotConnected
	}
	return s.client.ContainerRemove(ctx, id, types.ContainerRemoveOptions{Force: force})
}

// GetContainerLogs returns container logs
func (s *DockerService) GetContainerLogs(ctx context.Context, id string, tail int, timestamps bool) (string, error) {
	if s.client == nil {
		return "", ErrDockerNotConnected
	}

	options := types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Timestamps: timestamps,
		Tail:       "500",
	}

	if tail > 0 {
		options.Tail = string(rune(tail))
	}

	reader, err := s.client.ContainerLogs(ctx, id, options)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	buf := new(strings.Builder)
	io.Copy(buf, reader)
	return buf.String(), nil
}

// GetContainerStats returns container stats
func (s *DockerService) GetContainerStats(ctx context.Context, id string) (map[string]interface{}, error) {
	if s.client == nil {
		return nil, ErrDockerNotConnected
	}

	resp, err := s.client.ContainerStats(ctx, id, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var stats types.StatsJSON
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, err
	}

	// Calculate CPU percentage
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemUsage - stats.PreCPUStats.SystemUsage)
	cpuPercent := 0.0
	if systemDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * float64(stats.CPUStats.OnlineCPUs) * 100.0
	}

	// Calculate memory usage
	memUsage := float64(stats.MemoryStats.Usage) / 1024 / 1024 // MB
	memLimit := float64(stats.MemoryStats.Limit) / 1024 / 1024 // MB

	return map[string]interface{}{
		"cpu":     cpuPercent,
		"memory":  map[string]float64{"used": memUsage, "limit": memLimit},
		"network": map[string]uint64{"rx": 0, "tx": 0}, // TODO: calculate network stats
		"blockIO": map[string]uint64{"read": 0, "write": 0},
	}, nil
}

// ImageInfo represents image information
type ImageInfo struct {
	ID      string   `json:"id"`
	Tags    []string `json:"tags"`
	Size    int64    `json:"size"`
	Created string   `json:"created"`
}

// ListImages returns all images
func (s *DockerService) ListImages(ctx context.Context) ([]ImageInfo, error) {
	if s.client == nil {
		return nil, ErrDockerNotConnected
	}

	images, err := s.client.ImageList(ctx, types.ImageListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]ImageInfo, len(images))
	for i, img := range images {
		result[i] = ImageInfo{
			ID:      img.ID[7:19], // Remove "sha256:" prefix and truncate
			Tags:    img.RepoTags,
			Size:    img.Size,
			Created: formatTime(img.Created),
		}
	}

	return result, nil
}

// PullImage pulls an image
func (s *DockerService) PullImage(ctx context.Context, imageName string) error {
	if s.client == nil {
		return ErrDockerNotConnected
	}

	reader, err := s.client.ImagePull(ctx, imageName, types.ImagePullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()
	io.Copy(io.Discard, reader)
	return nil
}

// RemoveImage removes an image
func (s *DockerService) RemoveImage(ctx context.Context, id string, force bool) error {
	if s.client == nil {
		return ErrDockerNotConnected
	}

	_, err := s.client.ImageRemove(ctx, id, types.ImageRemoveOptions{Force: force})
	return err
}

// NetworkInfo represents network information
type NetworkInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Driver  string `json:"driver"`
	Scope   string `json:"scope"`
	Created string `json:"created"`
}

// ListNetworks returns all networks
func (s *DockerService) ListNetworks(ctx context.Context) ([]NetworkInfo, error) {
	if s.client == nil {
		return nil, ErrDockerNotConnected
	}

	networks, err := s.client.NetworkList(ctx, types.NetworkListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]NetworkInfo, len(networks))
	for i, n := range networks {
		result[i] = NetworkInfo{
			ID:      n.ID[:12],
			Name:    n.Name,
			Driver:  n.Driver,
			Scope:   n.Scope,
			Created: n.Created.Format(time.RFC3339),
		}
	}

	return result, nil
}

// CreateNetwork creates a network
func (s *DockerService) CreateNetwork(ctx context.Context, name, driver string) (string, error) {
	if s.client == nil {
		return "", ErrDockerNotConnected
	}

	resp, err := s.client.NetworkCreate(ctx, name, types.NetworkCreate{Driver: driver})
	if err != nil {
		return "", err
	}

	return resp.ID[:12], nil
}

// RemoveNetwork removes a network
func (s *DockerService) RemoveNetwork(ctx context.Context, id string) error {
	if s.client == nil {
		return ErrDockerNotConnected
	}
	return s.client.NetworkRemove(ctx, id)
}

// VolumeInfo represents volume information
type VolumeInfo struct {
	Name       string `json:"name"`
	Driver     string `json:"driver"`
	Mountpoint string `json:"mountpoint"`
	Created    string `json:"created"`
}

// ListVolumes returns all volumes
func (s *DockerService) ListVolumes(ctx context.Context) ([]VolumeInfo, error) {
	if s.client == nil {
		return nil, ErrDockerNotConnected
	}

	resp, err := s.client.VolumeList(ctx, volume.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]VolumeInfo, len(resp.Volumes))
	for i, v := range resp.Volumes {
		result[i] = VolumeInfo{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			Created:    v.CreatedAt,
		}
	}

	return result, nil
}

// CreateVolume creates a volume
func (s *DockerService) CreateVolume(ctx context.Context, name, driver string) (*VolumeInfo, error) {
	if s.client == nil {
		return nil, ErrDockerNotConnected
	}

	v, err := s.client.VolumeCreate(ctx, volume.CreateOptions{Name: name, Driver: driver})
	if err != nil {
		return nil, err
	}

	return &VolumeInfo{
		Name:       v.Name,
		Driver:     v.Driver,
		Mountpoint: v.Mountpoint,
		Created:    v.CreatedAt,
	}, nil
}

// RemoveVolume removes a volume
func (s *DockerService) RemoveVolume(ctx context.Context, name string, force bool) error {
	if s.client == nil {
		return ErrDockerNotConnected
	}
	return s.client.VolumeRemove(ctx, name, force)
}

// PruneImages removes unused images
func (s *DockerService) PruneImages(ctx context.Context) (uint64, error) {
	if s.client == nil {
		return 0, ErrDockerNotConnected
	}

	report, err := s.client.ImagesPrune(ctx, filters.Args{})
	if err != nil {
		return 0, err
	}

	return report.SpaceReclaimed, nil
}

// ComposeProjectInfo represents compose project information
type ComposeProjectInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Path        string `json:"path"`
	Status      string `json:"status"`
	Description string `json:"description"`
	Created     string `json:"created"`
	Updated     string `json:"updated"`
}

// ListComposeProjects returns all compose projects
func (s *DockerService) ListComposeProjects(ctx context.Context) ([]ComposeProjectInfo, error) {
	var projects []models.DockerComposeProject
	if err := s.db.Find(&projects).Error; err != nil {
		return nil, err
	}

	result := make([]ComposeProjectInfo, len(projects))
	for i, p := range projects {
		// Check actual status by checking if containers are running
		status := s.checkComposeStatus(ctx, p.Path, p.Name)

		result[i] = ComposeProjectInfo{
			ID:          p.ID,
			Name:        p.Name,
			Path:        p.Path,
			Status:      status,
			Description: p.Description,
			Created:     p.CreatedAt.Format(time.RFC3339),
			Updated:     p.UpdatedAt.Format(time.RFC3339),
		}
	}

	return result, nil
}

// CreateComposeProject creates a new compose project
func (s *DockerService) CreateComposeProject(ctx context.Context, name, path, content, description string) (*models.DockerComposeProject, error) {
	// Ensure directory exists
	if err := os.MkdirAll(path, 0755); err != nil {
		return nil, err
	}

	// Write docker-compose.yml file
	composeFile := filepath.Join(path, "docker-compose.yml")
	if err := os.WriteFile(composeFile, []byte(content), 0644); err != nil {
		return nil, err
	}

	project := &models.DockerComposeProject{
		Name:        name,
		Path:        path,
		Content:     content,
		Description: description,
		Status:      "stopped",
	}

	if err := s.db.Create(project).Error; err != nil {
		return nil, err
	}

	return project, nil
}

// RemoveComposeProject removes a compose project
func (s *DockerService) RemoveComposeProject(ctx context.Context, id string) error {
	var project models.DockerComposeProject
	if err := s.db.First(&project, "id = ?", id).Error; err != nil {
		return err
	}

	// Stop and remove containers first
	s.execComposeCommand(ctx, project.Path, "down", "-v")

	// Remove compose file
	composeFile := filepath.Join(project.Path, "docker-compose.yml")
	os.Remove(composeFile)

	return s.db.Delete(&project).Error
}

// ComposeUp starts a compose project
func (s *DockerService) ComposeUp(ctx context.Context, id string) error {
	var project models.DockerComposeProject
	if err := s.db.First(&project, "id = ?", id).Error; err != nil {
		return err
	}

	if err := s.execComposeCommand(ctx, project.Path, "up", "-d"); err != nil {
		return err
	}

	// Update status
	s.db.Model(&project).Update("status", "running")
	return nil
}

// ComposeDown stops a compose project
func (s *DockerService) ComposeDown(ctx context.Context, id string) error {
	var project models.DockerComposeProject
	if err := s.db.First(&project, "id = ?", id).Error; err != nil {
		return err
	}

	if err := s.execComposeCommand(ctx, project.Path, "down"); err != nil {
		return err
	}

	// Update status
	s.db.Model(&project).Update("status", "stopped")
	return nil
}

// Helper functions for compose
func (s *DockerService) execComposeCommand(ctx context.Context, workDir string, args ...string) error {
	// Try docker compose first (newer), fallback to docker-compose
	var cmd *exec.Cmd
	if _, err := exec.LookPath("docker"); err == nil {
		cmd = exec.CommandContext(ctx, "docker", append([]string{"compose"}, args...)...)
	} else if _, err := exec.LookPath("docker-compose"); err == nil {
		cmd = exec.CommandContext(ctx, "docker-compose", args...)
	} else {
		return newError("docker compose or docker-compose not found")
	}

	cmd.Dir = workDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		s.log.Error("Compose command failed", "error", err, "output", string(output))
		return err
	}
	return nil
}

func (s *DockerService) checkComposeStatus(ctx context.Context, path, projectName string) string {
	// Check if containers are running by looking for containers with the project label
	containers, err := s.client.ContainerList(ctx, types.ContainerListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("label", "com.docker.compose.project="+projectName),
		),
	})
	if err != nil {
		return "unknown"
	}

	if len(containers) == 0 {
		return "stopped"
	}

	running := 0
	for _, c := range containers {
		if c.State == "running" {
			running++
		}
	}

	if running == 0 {
		return "stopped"
	} else if running == len(containers) {
		return "running"
	} else {
		return "partial"
	}
}

// Error definitions
var ErrDockerNotConnected = newError("docker daemon not connected")

func newError(msg string) error {
	return &dockerError{msg: msg}
}

type dockerError struct {
	msg string
}

func (e *dockerError) Error() string {
	return e.msg
}

// Helper functions
func formatPort(p types.Port) string {
	if p.PublicPort > 0 {
		return string(rune(p.PublicPort)) + ":" + string(rune(p.PrivatePort)) + "/" + p.Type
	}
	return string(rune(p.PrivatePort)) + "/" + p.Type
}

func formatTime(ts int64) string {
	return time.Unix(ts, 0).Format("2006-01-02 15:04:05")
}

func mapContainerState(state string) string {
	switch state {
	case "running":
		return "running"
	case "exited":
		return "stopped"
	case "paused":
		return "paused"
	case "restarting":
		return "restarting"
	case "created":
		return "created"
	default:
		return state
	}
}
