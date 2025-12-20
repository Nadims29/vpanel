package sdk

import (
	"github.com/gin-gonic/gin"
)

// ExternalPlugin is the interface that external (dynamically loaded) plugins must implement.
// External plugins are loaded from .so files at runtime.
type ExternalPlugin interface {
	// Metadata methods
	ID() string
	Name() string
	Version() string
	Description() string
	Author() string
	Homepage() string
	License() string

	// Lifecycle methods
	Init(ctx *ExternalPluginContext) error
	Start() error
	Stop() error
	Shutdown() error

	// Route registration
	RegisterRoutes(group *gin.RouterGroup)

	// Frontend configuration
	GetFrontendRoutes() []FrontendRoute
	GetMenuItems() []MenuItem

	// Settings
	GetSettingsSchema() []SettingField

	// Event handling
	HandleEvent(event *Event) error
}

// ExternalPluginContext provides runtime context to external plugins.
// It's a simplified version of PluginContext for external plugins.
type ExternalPluginContext struct {
	pluginID  string
	dataDir   string
	configDir string
	logger    Logger
	api       *ExternalPluginAPI
}

// NewExternalPluginContext creates a new external plugin context.
func NewExternalPluginContext(
	pluginID, dataDir, configDir string,
	logger Logger,
	api *ExternalPluginAPI,
) *ExternalPluginContext {
	return &ExternalPluginContext{
		pluginID:  pluginID,
		dataDir:   dataDir,
		configDir: configDir,
		logger:    logger,
		api:       api,
	}
}

// PluginID returns the plugin's unique identifier.
func (c *ExternalPluginContext) PluginID() string {
	return c.pluginID
}

// DataDir returns the plugin's data directory.
func (c *ExternalPluginContext) DataDir() string {
	return c.dataDir
}

// ConfigDir returns the plugin's configuration directory.
func (c *ExternalPluginContext) ConfigDir() string {
	return c.configDir
}

// Logger returns the logger for this plugin.
func (c *ExternalPluginContext) Logger() Logger {
	return c.logger
}

// API returns the API client.
func (c *ExternalPluginContext) API() *ExternalPluginAPI {
	return c.api
}

// ExternalPluginAPI provides sandboxed API access to external plugins.
// Unlike BuiltinPlugin, external plugins have restricted access for security.
type ExternalPluginAPI struct {
	// Settings operations (scoped to plugin)
	GetSetting    func(key string) (string, error)
	SetSetting    func(key, value string) error
	DeleteSetting func(key string) error

	// File operations (scoped to plugin data directory)
	ReadFile   func(path string) ([]byte, error)
	WriteFile  func(path string, data []byte) error
	DeleteFile func(path string) error
	ListFiles  func(path string) ([]FileInfo, error)

	// HTTP client (with rate limiting)
	HTTPGet  func(url string, headers map[string]string) (*HTTPResponse, error)
	HTTPPost func(url string, body []byte, headers map[string]string) (*HTTPResponse, error)

	// Notifications
	SendNotification func(title, message, level string) error

	// Execute commands (if permitted)
	Execute func(command string, args ...string) (string, error)
}

// BaseExternalPlugin provides a default implementation of ExternalPlugin.
// External plugin developers can embed this struct to get default implementations.
type BaseExternalPlugin struct {
	ctx *ExternalPluginContext
}

// Init initializes the base plugin.
func (p *BaseExternalPlugin) Init(ctx *ExternalPluginContext) error {
	p.ctx = ctx
	return nil
}

// Start provides a default no-op implementation.
func (p *BaseExternalPlugin) Start() error {
	return nil
}

// Stop provides a default no-op implementation.
func (p *BaseExternalPlugin) Stop() error {
	return nil
}

// Shutdown provides a default no-op implementation.
func (p *BaseExternalPlugin) Shutdown() error {
	return nil
}

// Author returns empty string by default.
func (p *BaseExternalPlugin) Author() string {
	return ""
}

// Homepage returns empty string by default.
func (p *BaseExternalPlugin) Homepage() string {
	return ""
}

// License returns empty string by default.
func (p *BaseExternalPlugin) License() string {
	return ""
}

// RegisterRoutes provides a default no-op implementation.
func (p *BaseExternalPlugin) RegisterRoutes(group *gin.RouterGroup) {}

// GetFrontendRoutes returns an empty list by default.
func (p *BaseExternalPlugin) GetFrontendRoutes() []FrontendRoute {
	return nil
}

// GetMenuItems returns an empty list by default.
func (p *BaseExternalPlugin) GetMenuItems() []MenuItem {
	return nil
}

// GetSettingsSchema returns an empty list by default.
func (p *BaseExternalPlugin) GetSettingsSchema() []SettingField {
	return nil
}

// HandleEvent provides a default no-op implementation.
func (p *BaseExternalPlugin) HandleEvent(event *Event) error {
	return nil
}

// Context returns the plugin context.
func (p *BaseExternalPlugin) Context() *ExternalPluginContext {
	return p.ctx
}

// Log returns the logger.
func (p *BaseExternalPlugin) Log() Logger {
	if p.ctx == nil {
		return &DefaultLogger{}
	}
	return p.ctx.Logger()
}

// PluginManifest describes a plugin's metadata from manifest.json
type PluginManifest struct {
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
	MinCoreVersion string   `json:"min_core_version,omitempty"`
	Dependencies   []string `json:"dependencies,omitempty"`

	// Permissions required by the plugin
	Permissions []string `json:"permissions,omitempty"`

	// UI configuration
	Menus  []MenuItem     `json:"menus,omitempty"`
	Routes []FrontendRoute `json:"routes,omitempty"`

	// Settings schema
	Settings []SettingField `json:"settings,omitempty"`

	// Build information
	EntryPoint string `json:"entry_point,omitempty"` // .so file name
	HasBackend bool   `json:"has_backend,omitempty"`
	HasFrontend bool  `json:"has_frontend,omitempty"`
}

// PluginType defines the type of plugin
type PluginType string

const (
	PluginTypeBuiltin  PluginType = "builtin"
	PluginTypeExternal PluginType = "external"
)

// PluginStatus defines the status of a plugin
type PluginStatus string

const (
	PluginStatusEnabled  PluginStatus = "enabled"
	PluginStatusDisabled PluginStatus = "disabled"
	PluginStatusError    PluginStatus = "error"
	PluginStatusLoading  PluginStatus = "loading"
)

// PluginInfo contains complete plugin information for API responses
type PluginInfo struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Version     string            `json:"version"`
	Description string            `json:"description"`
	Author      string            `json:"author"`
	Homepage    string            `json:"homepage,omitempty"`
	License     string            `json:"license,omitempty"`
	Icon        string            `json:"icon,omitempty"`
	Category    string            `json:"category,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Type        PluginType        `json:"type"`
	Status      PluginStatus      `json:"status"`
	Enabled     bool              `json:"enabled"`
	Permissions []string          `json:"permissions,omitempty"`
	Dependencies []string         `json:"dependencies,omitempty"`
	Settings    []SettingField    `json:"settings,omitempty"`
	Menus       []MenuItem        `json:"menus,omitempty"`
	Routes      []FrontendRoute   `json:"routes,omitempty"`
	Error       string            `json:"error,omitempty"`
	InstalledAt string            `json:"installed_at,omitempty"`
	UpdatedAt   string            `json:"updated_at,omitempty"`
}

// MarketPlugin represents a plugin available in the marketplace
type MarketPlugin struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	Author      string   `json:"author"`
	Homepage    string   `json:"homepage,omitempty"`
	License     string   `json:"license,omitempty"`
	Icon        string   `json:"icon,omitempty"`
	Category    string   `json:"category,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Downloads   int      `json:"downloads"`
	Rating      float64  `json:"rating"`
	Verified    bool     `json:"verified"`
	DownloadURL string   `json:"download_url"`
	Installed   bool     `json:"installed"`
	UpdateAvailable bool `json:"update_available,omitempty"`
}

// CoreInfo contains information about the VPanel core
type CoreInfo struct {
	Version   string `json:"version"`
	BuildTime string `json:"build_time"`
	GitCommit string `json:"git_commit"`
	GoVersion string `json:"go_version"`
}

