package sdk

import "time"

// Common types used throughout the SDK.
// Note: FileInfo, HTTPResponse, and Event are defined in api.go and hooks.go

// Manifest describes a plugin's metadata and configuration.
type Manifest struct {
	// Required fields
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Author      string `json:"author"`

	// Optional metadata
	Homepage string   `json:"homepage,omitempty"`
	License  string   `json:"license,omitempty"`
	Icon     string   `json:"icon,omitempty"`
	Category string   `json:"category,omitempty"`
	Tags     []string `json:"tags,omitempty"`

	// Compatibility
	MinVersion   string   `json:"min_version,omitempty"`
	Dependencies []string `json:"dependencies,omitempty"`

	// Permissions required by the plugin
	Permissions []string `json:"permissions,omitempty"`

	// UI configuration
	Menus    []MenuItem     `json:"menus,omitempty"`
	Settings []SettingField `json:"settings,omitempty"`

	// Route definitions
	Routes []RouteDefinition `json:"routes,omitempty"`
}

// RouteDefinition defines an HTTP route provided by the plugin.
type RouteDefinition struct {
	Method      string `json:"method"`
	Path        string `json:"path"`
	Handler     string `json:"handler"`
	Description string `json:"description,omitempty"`
}

// Permission constants for plugin permissions.
const (
	// Docker permissions
	PermDockerRead   = "docker.read"
	PermDockerWrite  = "docker.write"
	PermDockerExec   = "docker.exec"
	PermDockerDelete = "docker.delete"

	// File permissions
	PermFileRead   = "files.read"
	PermFileWrite  = "files.write"
	PermFileDelete = "files.delete"

	// Database permissions
	PermDatabaseRead   = "database.read"
	PermDatabaseWrite  = "database.write"
	PermDatabaseAdmin  = "database.admin"

	// Nginx permissions
	PermNginxRead  = "nginx.read"
	PermNginxWrite = "nginx.write"

	// Settings permissions
	PermSettingsRead  = "settings.read"
	PermSettingsWrite = "settings.write"

	// User permissions
	PermUserRead  = "users.read"
	PermUserWrite = "users.write"

	// System permissions
	PermSystemExec   = "system.exec"
	PermSystemAdmin  = "system.admin"
	PermNotifications = "notifications"
	PermHTTP         = "http"
)

// Status constants for plugin status.
const (
	StatusEnabled  = "enabled"
	StatusDisabled = "disabled"
	StatusRunning  = "running"
	StatusStopped  = "stopped"
	StatusError    = "error"
)

// PluginState represents the current state of a plugin.
type PluginState struct {
	Status    string    `json:"status"`
	Enabled   bool      `json:"enabled"`
	LoadedAt  time.Time `json:"loaded_at"`
	Error     string    `json:"error,omitempty"`
	Resources *ResourceUsage `json:"resources,omitempty"`
}

// ResourceUsage represents resource usage by a plugin.
type ResourceUsage struct {
	MemoryMB    float64 `json:"memory_mb"`
	CPUPercent  float64 `json:"cpu_percent"`
	Goroutines  int     `json:"goroutines"`
	LastUpdated time.Time `json:"last_updated"`
}

// Result represents a generic API result.
type Result struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Code    string      `json:"code,omitempty"`
}

// NewResult creates a success result.
func NewResult(data interface{}) *Result {
	return &Result{
		Success: true,
		Data:    data,
	}
}

// NewErrorResult creates an error result.
func NewErrorResult(err string, code string) *Result {
	return &Result{
		Success: false,
		Error:   err,
		Code:    code,
	}
}

// PaginatedResult represents a paginated API result.
type PaginatedResult struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Total   int64       `json:"total"`
	Page    int         `json:"page"`
	PerPage int         `json:"per_page"`
	Pages   int         `json:"pages"`
}

// NewPaginatedResult creates a paginated result.
func NewPaginatedResult(data interface{}, total int64, page, perPage int) *PaginatedResult {
	pages := int(total) / perPage
	if int(total)%perPage > 0 {
		pages++
	}
	return &PaginatedResult{
		Success: true,
		Data:    data,
		Total:   total,
		Page:    page,
		PerPage: perPage,
		Pages:   pages,
	}
}
