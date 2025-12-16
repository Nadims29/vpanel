package sdk

import (
	"context"
	"time"
)

// APIClient provides access to VPanel system APIs.
// All methods are safe to call from plugins.
type APIClient struct {
	// Settings API
	settings SettingsAPI

	// File API
	files FileAPI

	// HTTP API
	http HTTPAPI

	// Notification API
	notifications NotificationAPI

	// Exec API
	exec ExecAPI

	// Docker API
	docker DockerAPI

	// Database API
	database DatabaseAPI
}

// NewAPIClient creates a new API client with the provided implementations.
func NewAPIClient(
	settings SettingsAPI,
	files FileAPI,
	http HTTPAPI,
	notifications NotificationAPI,
	exec ExecAPI,
	docker DockerAPI,
	database DatabaseAPI,
) *APIClient {
	return &APIClient{
		settings:      settings,
		files:         files,
		http:          http,
		notifications: notifications,
		exec:          exec,
		docker:        docker,
		database:      database,
	}
}

// Settings returns the settings API.
func (c *APIClient) Settings() SettingsAPI {
	return c.settings
}

// Files returns the file API.
func (c *APIClient) Files() FileAPI {
	return c.files
}

// HTTP returns the HTTP client API.
func (c *APIClient) HTTP() HTTPAPI {
	return c.http
}

// Notifications returns the notification API.
func (c *APIClient) Notifications() NotificationAPI {
	return c.notifications
}

// Exec returns the command execution API.
func (c *APIClient) Exec() ExecAPI {
	return c.exec
}

// Docker returns the Docker API.
func (c *APIClient) Docker() DockerAPI {
	return c.docker
}

// Database returns the database API.
func (c *APIClient) Database() DatabaseAPI {
	return c.database
}

// SettingsAPI provides access to plugin settings.
type SettingsAPI interface {
	// Get retrieves a setting value by key.
	Get(key string) (string, error)

	// Set stores a setting value.
	Set(key, value string) error

	// Delete removes a setting.
	Delete(key string) error

	// GetAll retrieves all settings for the plugin.
	GetAll() (map[string]string, error)
}

// FileAPI provides file system operations.
type FileAPI interface {
	// Read reads a file from the plugin's data directory.
	Read(path string) ([]byte, error)

	// Write writes data to a file in the plugin's data directory.
	Write(path string, data []byte) error

	// Delete deletes a file from the plugin's data directory.
	Delete(path string) error

	// Exists checks if a file exists.
	Exists(path string) (bool, error)

	// List lists files in a directory.
	List(path string) ([]FileInfo, error)

	// Mkdir creates a directory.
	Mkdir(path string) error
}

// FileInfo contains file metadata.
type FileInfo struct {
	Name    string
	Size    int64
	IsDir   bool
	ModTime time.Time
}

// HTTPAPI provides HTTP client functionality.
type HTTPAPI interface {
	// Get performs an HTTP GET request.
	Get(url string, headers map[string]string) (*HTTPResponse, error)

	// Post performs an HTTP POST request.
	Post(url string, body []byte, headers map[string]string) (*HTTPResponse, error)

	// Put performs an HTTP PUT request.
	Put(url string, body []byte, headers map[string]string) (*HTTPResponse, error)

	// Delete performs an HTTP DELETE request.
	Delete(url string, headers map[string]string) (*HTTPResponse, error)
}

// HTTPResponse represents an HTTP response.
type HTTPResponse struct {
	StatusCode int
	Headers    map[string][]string
	Body       []byte
}

// NotificationAPI provides notification functionality.
type NotificationAPI interface {
	// Send sends a notification.
	Send(title, message string, opts ...NotificationOption) error

	// SendEmail sends an email notification.
	SendEmail(to, subject, body string) error

	// SendWebhook sends a webhook notification.
	SendWebhook(url string, payload interface{}) error
}

// NotificationOption is a functional option for notifications.
type NotificationOption func(*NotificationOptions)

// NotificationOptions contains notification options.
type NotificationOptions struct {
	Type     string // info, warning, error, success
	Priority string // low, normal, high
	Actions  []NotificationAction
}

// NotificationAction represents a notification action.
type NotificationAction struct {
	Label string
	URL   string
}

// WithType sets the notification type.
func WithType(t string) NotificationOption {
	return func(o *NotificationOptions) {
		o.Type = t
	}
}

// WithPriority sets the notification priority.
func WithPriority(p string) NotificationOption {
	return func(o *NotificationOptions) {
		o.Priority = p
	}
}

// ExecAPI provides command execution functionality.
type ExecAPI interface {
	// Run executes a command and returns the output.
	Run(command string, args ...string) (string, error)

	// RunWithContext executes a command with context.
	RunWithContext(ctx context.Context, command string, args ...string) (string, error)

	// RunBackground starts a command in the background.
	RunBackground(command string, args ...string) (int, error)
}

// DockerAPI provides Docker-related functionality.
type DockerAPI interface {
	// ListContainers returns all containers.
	ListContainers(all bool) ([]ContainerInfo, error)

	// GetContainer returns container details.
	GetContainer(id string) (*ContainerInfo, error)

	// StartContainer starts a container.
	StartContainer(id string) error

	// StopContainer stops a container.
	StopContainer(id string) error

	// RestartContainer restarts a container.
	RestartContainer(id string) error

	// GetContainerLogs returns container logs.
	GetContainerLogs(id string, tail int) (string, error)

	// ListImages returns all images.
	ListImages() ([]ImageInfo, error)

	// ListNetworks returns all networks.
	ListNetworks() ([]NetworkInfo, error)

	// ListVolumes returns all volumes.
	ListVolumes() ([]VolumeInfo, error)
}

// ContainerInfo contains container information.
type ContainerInfo struct {
	ID      string
	Name    string
	Image   string
	State   string
	Status  string
	Created time.Time
	Ports   []PortBinding
	Labels  map[string]string
}

// PortBinding represents a port binding.
type PortBinding struct {
	HostIP   string
	HostPort string
	Port     string
	Protocol string
}

// ImageInfo contains image information.
type ImageInfo struct {
	ID      string
	Tags    []string
	Size    int64
	Created time.Time
}

// NetworkInfo contains network information.
type NetworkInfo struct {
	ID     string
	Name   string
	Driver string
	Scope  string
}

// VolumeInfo contains volume information.
type VolumeInfo struct {
	Name       string
	Driver     string
	Mountpoint string
	CreatedAt  time.Time
}

// DatabaseAPI provides database-related functionality.
type DatabaseAPI interface {
	// Query executes a query and returns results.
	Query(query string, args ...interface{}) ([]map[string]interface{}, error)

	// Exec executes a statement.
	Exec(query string, args ...interface{}) (int64, error)

	// Transaction executes operations in a transaction.
	Transaction(fn func(tx DatabaseTx) error) error
}

// DatabaseTx represents a database transaction.
type DatabaseTx interface {
	Query(query string, args ...interface{}) ([]map[string]interface{}, error)
	Exec(query string, args ...interface{}) (int64, error)
}
