package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"gorm.io/gorm"
)

// PluginAPIImpl provides the full implementation of PluginAPI.
type PluginAPIImpl struct {
	pluginID string
	dataDir  string
	db       *gorm.DB
	docker   *client.Client
}

// NewPluginAPIImpl creates a new PluginAPI implementation.
func NewPluginAPIImpl(pluginID, dataDir string, db *gorm.DB, docker *client.Client) *PluginAPI {
	impl := &PluginAPIImpl{
		pluginID: pluginID,
		dataDir:  dataDir,
		db:       db,
		docker:   docker,
	}
	return impl.toPluginAPI()
}

// toPluginAPI converts the implementation to PluginAPI.
func (p *PluginAPIImpl) toPluginAPI() *PluginAPI {
	return &PluginAPI{
		GetSetting:       p.GetSetting,
		SetSetting:       p.SetSetting,
		ReadFile:         p.ReadFile,
		WriteFile:        p.WriteFile,
		HTTPGet:          p.HTTPGet,
		HTTPPost:         p.HTTPPost,
		SendNotification: p.SendNotification,
		Execute:          p.Execute,
	}
}

// GetSetting retrieves a plugin setting from the database.
func (p *PluginAPIImpl) GetSetting(key string) (string, error) {
	var setting PluginSettingModel
	err := p.db.Where("plugin_id = ? AND key = ?", p.pluginID, key).First(&setting).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", err
	}
	return setting.Value, nil
}

// SetSetting stores a plugin setting in the database.
func (p *PluginAPIImpl) SetSetting(key, value string) error {
	setting := PluginSettingModel{
		PluginID:  p.pluginID,
		Key:       key,
		Value:     value,
		UpdatedAt: time.Now(),
	}

	// Upsert: update if exists, insert if not
	result := p.db.Where("plugin_id = ? AND key = ?", p.pluginID, key).First(&PluginSettingModel{})
	if result.Error == gorm.ErrRecordNotFound {
		setting.CreatedAt = time.Now()
		return p.db.Create(&setting).Error
	}
	return p.db.Model(&PluginSettingModel{}).
		Where("plugin_id = ? AND key = ?", p.pluginID, key).
		Updates(map[string]interface{}{
			"value":      value,
			"updated_at": time.Now(),
		}).Error
}

// ReadFile reads a file from the plugin's allowed path.
func (p *PluginAPIImpl) ReadFile(path string) ([]byte, error) {
	// Security: Ensure path is within plugin's data directory
	fullPath := p.sanitizePath(path)
	if fullPath == "" {
		return nil, fmt.Errorf("invalid path: access denied")
	}
	return os.ReadFile(fullPath)
}

// WriteFile writes data to a file in the plugin's data directory.
func (p *PluginAPIImpl) WriteFile(path string, data []byte) error {
	// Security: Ensure path is within plugin's data directory
	fullPath := p.sanitizePath(path)
	if fullPath == "" {
		return fmt.Errorf("invalid path: access denied")
	}

	// Create parent directories if needed
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(fullPath, data, 0644)
}

// sanitizePath ensures the path is within the plugin's data directory.
func (p *PluginAPIImpl) sanitizePath(path string) string {
	// If path is absolute, check if it's within data directory
	if filepath.IsAbs(path) {
		// Clean the path
		cleanPath := filepath.Clean(path)
		// Check if it starts with data directory
		if strings.HasPrefix(cleanPath, p.dataDir) {
			return cleanPath
		}
		return ""
	}

	// For relative paths, join with data directory
	fullPath := filepath.Join(p.dataDir, filepath.Clean(path))
	// Ensure the result is still within data directory
	if !strings.HasPrefix(fullPath, p.dataDir) {
		return ""
	}
	return fullPath
}

// HTTPGet performs an HTTP GET request.
func (p *PluginAPIImpl) HTTPGet(url string) ([]byte, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

// HTTPPost performs an HTTP POST request.
func (p *PluginAPIImpl) HTTPPost(url string, body []byte) ([]byte, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

// SendNotification sends a notification (placeholder - would integrate with notification service).
func (p *PluginAPIImpl) SendNotification(title, message string) error {
	// Log the notification for now
	// In a full implementation, this would integrate with the notification service
	fmt.Printf("[Plugin %s] Notification: %s - %s\n", p.pluginID, title, message)
	return nil
}

// Execute runs a command and returns the output.
func (p *PluginAPIImpl) Execute(command string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, command, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), err
	}
	return string(output), nil
}

// ExtendedPluginAPI provides additional API methods beyond the basic PluginAPI.
type ExtendedPluginAPI struct {
	*PluginAPIImpl
}

// NewExtendedPluginAPI creates an extended API with additional methods.
func NewExtendedPluginAPI(pluginID, dataDir string, db *gorm.DB, docker *client.Client) *ExtendedPluginAPI {
	return &ExtendedPluginAPI{
		PluginAPIImpl: &PluginAPIImpl{
			pluginID: pluginID,
			dataDir:  dataDir,
			db:       db,
			docker:   docker,
		},
	}
}

// DeleteSetting removes a setting.
func (p *ExtendedPluginAPI) DeleteSetting(key string) error {
	return p.db.Where("plugin_id = ? AND key = ?", p.pluginID, key).
		Delete(&PluginSettingModel{}).Error
}

// GetAllSettings retrieves all settings for the plugin.
func (p *ExtendedPluginAPI) GetAllSettings() (map[string]string, error) {
	var settings []PluginSettingModel
	err := p.db.Where("plugin_id = ?", p.pluginID).Find(&settings).Error
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	return result, nil
}

// ListContainers returns all Docker containers.
func (p *ExtendedPluginAPI) ListContainers(all bool) ([]ContainerInfo, error) {
	if p.docker == nil {
		return nil, fmt.Errorf("docker client not available")
	}

	containers, err := p.docker.ContainerList(context.Background(), container.ListOptions{All: all})
	if err != nil {
		return nil, err
	}

	result := make([]ContainerInfo, len(containers))
	for i, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		result[i] = ContainerInfo{
			ID:      c.ID,
			Name:    name,
			Image:   c.Image,
			State:   c.State,
			Status:  c.Status,
			Created: time.Unix(c.Created, 0),
		}
	}
	return result, nil
}

// GetContainer returns container details.
func (p *ExtendedPluginAPI) GetContainer(id string) (*ContainerInfo, error) {
	if p.docker == nil {
		return nil, fmt.Errorf("docker client not available")
	}

	container, err := p.docker.ContainerInspect(context.Background(), id)
	if err != nil {
		return nil, err
	}

	created, _ := time.Parse(time.RFC3339, container.Created)
	return &ContainerInfo{
		ID:      container.ID,
		Name:    strings.TrimPrefix(container.Name, "/"),
		Image:   container.Config.Image,
		State:   container.State.Status,
		Status:  container.State.Status,
		Created: created,
		Labels:  container.Config.Labels,
	}, nil
}

// ContainerInfo represents container information.
type ContainerInfo struct {
	ID      string
	Name    string
	Image   string
	State   string
	Status  string
	Created time.Time
	Labels  map[string]string
}

// ListImages returns all Docker images.
func (p *ExtendedPluginAPI) ListImages() ([]ImageInfo, error) {
	if p.docker == nil {
		return nil, fmt.Errorf("docker client not available")
	}

	images, err := p.docker.ImageList(context.Background(), image.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]ImageInfo, len(images))
	for i, img := range images {
		result[i] = ImageInfo{
			ID:      img.ID,
			Tags:    img.RepoTags,
			Size:    img.Size,
			Created: time.Unix(img.Created, 0),
		}
	}
	return result, nil
}

// ImageInfo represents image information.
type ImageInfo struct {
	ID      string
	Tags    []string
	Size    int64
	Created time.Time
}

// ListNetworks returns all Docker networks.
func (p *ExtendedPluginAPI) ListNetworks() ([]NetworkInfo, error) {
	if p.docker == nil {
		return nil, fmt.Errorf("docker client not available")
	}

	networks, err := p.docker.NetworkList(context.Background(), network.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]NetworkInfo, len(networks))
	for i, n := range networks {
		result[i] = NetworkInfo{
			ID:     n.ID,
			Name:   n.Name,
			Driver: n.Driver,
			Scope:  n.Scope,
		}
	}
	return result, nil
}

// NetworkInfo represents network information.
type NetworkInfo struct {
	ID     string
	Name   string
	Driver string
	Scope  string
}

// ListVolumes returns all Docker volumes.
func (p *ExtendedPluginAPI) ListVolumes() ([]VolumeInfo, error) {
	if p.docker == nil {
		return nil, fmt.Errorf("docker client not available")
	}

	volumes, err := p.docker.VolumeList(context.Background(), volume.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]VolumeInfo, len(volumes.Volumes))
	for i, v := range volumes.Volumes {
		createdAt, _ := time.Parse(time.RFC3339, v.CreatedAt)
		result[i] = VolumeInfo{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			CreatedAt:  createdAt,
		}
	}
	return result, nil
}

// VolumeInfo represents volume information.
type VolumeInfo struct {
	Name       string
	Driver     string
	Mountpoint string
	CreatedAt  time.Time
}

// HTTPRequest performs a generic HTTP request.
func (p *ExtendedPluginAPI) HTTPRequest(method, url string, body []byte, headers map[string]string) ([]byte, int, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, 0, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	return data, resp.StatusCode, err
}

// Query executes a read-only SQL query on the plugin's data.
func (p *ExtendedPluginAPI) Query(query string, args ...interface{}) ([]map[string]interface{}, error) {
	// Only allow SELECT queries for safety
	if !strings.HasPrefix(strings.ToUpper(strings.TrimSpace(query)), "SELECT") {
		return nil, fmt.Errorf("only SELECT queries are allowed")
	}

	rows, err := p.db.Raw(query, args...).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			row[col] = values[i]
		}
		results = append(results, row)
	}

	return results, nil
}

// GetPluginData retrieves plugin-specific data from the database.
func (p *ExtendedPluginAPI) GetPluginData(key string) (interface{}, error) {
	var setting PluginSettingModel
	err := p.db.Where("plugin_id = ? AND key = ?", p.pluginID, key).First(&setting).Error
	if err != nil {
		return nil, err
	}

	var data interface{}
	if err := json.Unmarshal([]byte(setting.Value), &data); err != nil {
		// Return as string if not JSON
		return setting.Value, nil
	}
	return data, nil
}

// SetPluginData stores plugin-specific data in the database.
func (p *ExtendedPluginAPI) SetPluginData(key string, value interface{}) error {
	var valueStr string
	switch v := value.(type) {
	case string:
		valueStr = v
	default:
		data, err := json.Marshal(v)
		if err != nil {
			return err
		}
		valueStr = string(data)
	}
	return p.SetSetting(key, valueStr)
}

// PluginSettingModel is the database model for plugin settings.
type PluginSettingModel struct {
	ID        uint      `gorm:"primaryKey"`
	PluginID  string    `gorm:"type:varchar(100);index;not null"`
	Key       string    `gorm:"type:varchar(255);index;not null"`
	Value     string    `gorm:"type:text"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// TableName returns the table name for plugin settings.
func (PluginSettingModel) TableName() string {
	return "plugin_settings"
}
