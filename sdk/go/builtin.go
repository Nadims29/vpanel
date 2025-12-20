// Package sdk provides the VPanel plugin SDK for developing plugins.
package sdk

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// BuiltinPlugin is the interface that all builtin plugins must implement.
// Builtin plugins are compiled into the main binary and loaded at startup.
type BuiltinPlugin interface {
	// Metadata methods
	ID() string
	Name() string
	Version() string
	Description() string

	// Lifecycle methods
	Init(ctx *PluginContext) error
	Start() error
	Stop() error

	// Route registration
	RegisterRoutes(group *gin.RouterGroup)

	// Frontend configuration
	GetFrontendRoutes() []FrontendRoute
	GetMenuItems() []MenuItem

	// Database migration
	Migrate(db *gorm.DB) error

	// Dependencies returns a list of plugin IDs this plugin depends on
	Dependencies() []string
}

// PluginContext provides runtime context to plugins.
type PluginContext struct {
	pluginID  string
	dataDir   string
	configDir string
	logger    Logger
	db        *gorm.DB
	api       *APIClient

	// Plugin registry for accessing other plugins
	registry PluginRegistry
}

// PluginRegistry provides access to other registered plugins.
type PluginRegistry interface {
	// GetPlugin returns a plugin by ID
	GetPlugin(id string) (BuiltinPlugin, bool)

	// ListPlugins returns all registered plugins
	ListPlugins() []BuiltinPlugin
}

// NewPluginContext creates a new plugin context.
func NewPluginContext(
	pluginID, dataDir, configDir string,
	logger Logger,
	db *gorm.DB,
	api *APIClient,
	registry PluginRegistry,
) *PluginContext {
	return &PluginContext{
		pluginID:  pluginID,
		dataDir:   dataDir,
		configDir: configDir,
		logger:    logger,
		db:        db,
		api:       api,
		registry:  registry,
	}
}

// PluginID returns the plugin's unique identifier.
func (c *PluginContext) PluginID() string {
	return c.pluginID
}

// DataDir returns the plugin's data directory.
func (c *PluginContext) DataDir() string {
	return c.dataDir
}

// ConfigDir returns the plugin's configuration directory.
func (c *PluginContext) ConfigDir() string {
	return c.configDir
}

// Logger returns the logger for this plugin.
func (c *PluginContext) Logger() Logger {
	return c.logger
}

// DB returns the database connection.
func (c *PluginContext) DB() *gorm.DB {
	return c.db
}

// API returns the API client.
func (c *PluginContext) API() *APIClient {
	return c.api
}

// Registry returns the plugin registry.
func (c *PluginContext) Registry() PluginRegistry {
	return c.registry
}

// FrontendRoute defines a frontend route for a plugin.
type FrontendRoute struct {
	// Path is the route path (e.g., "/docker/containers")
	Path string `json:"path"`

	// Component is the component path relative to the plugin's frontend directory
	Component string `json:"component"`

	// Title is the page title
	Title string `json:"title"`

	// Permissions required to access this route
	Permissions []string `json:"permissions,omitempty"`

	// Exact match for the route path
	Exact bool `json:"exact,omitempty"`
}

// BaseBuiltinPlugin provides a default implementation of BuiltinPlugin.
// Plugins can embed this struct to get default implementations.
type BaseBuiltinPlugin struct {
	ctx *PluginContext
}

// Init initializes the base plugin.
func (p *BaseBuiltinPlugin) Init(ctx *PluginContext) error {
	p.ctx = ctx
	return nil
}

// Start provides a default no-op implementation.
func (p *BaseBuiltinPlugin) Start() error {
	return nil
}

// Stop provides a default no-op implementation.
func (p *BaseBuiltinPlugin) Stop() error {
	return nil
}

// GetFrontendRoutes returns an empty list by default.
func (p *BaseBuiltinPlugin) GetFrontendRoutes() []FrontendRoute {
	return nil
}

// GetMenuItems returns an empty list by default.
func (p *BaseBuiltinPlugin) GetMenuItems() []MenuItem {
	return nil
}

// Migrate provides a default no-op implementation.
func (p *BaseBuiltinPlugin) Migrate(db *gorm.DB) error {
	return nil
}

// Dependencies returns an empty list by default.
func (p *BaseBuiltinPlugin) Dependencies() []string {
	return nil
}

// Context returns the plugin context.
func (p *BaseBuiltinPlugin) Context() *PluginContext {
	return p.ctx
}

// Log returns the logger.
func (p *BaseBuiltinPlugin) Log() Logger {
	if p.ctx == nil {
		return &DefaultLogger{}
	}
	return p.ctx.Logger()
}

// DB returns the database connection.
func (p *BaseBuiltinPlugin) DB() *gorm.DB {
	if p.ctx == nil {
		return nil
	}
	return p.ctx.DB()
}
