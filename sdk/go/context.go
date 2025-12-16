package sdk

// Context provides the runtime context for plugins.
// It contains references to system APIs and plugin-specific resources.
type Context struct {
	// PluginID is the unique identifier for this plugin
	PluginID string

	// DataDir is the plugin's data directory for storing persistent data
	DataDir string

	// ConfigDir is the plugin's configuration directory
	ConfigDir string

	// Logger provides logging functionality
	Logger Logger

	// API provides access to VPanel system APIs
	API *APIClient

	// Hooks provides access to the hook/event system
	Hooks *HookManager

	// UI provides access to UI extension APIs
	UI *UIManager
}

// NewContext creates a new Context with the given parameters.
// This is typically called by the plugin manager when loading a plugin.
func NewContext(pluginID, dataDir, configDir string, logger Logger, api *APIClient) *Context {
	return &Context{
		PluginID:  pluginID,
		DataDir:   dataDir,
		ConfigDir: configDir,
		Logger:    logger,
		API:       api,
		Hooks:     NewHookManager(),
		UI:        NewUIManager(pluginID),
	}
}

// Logger defines the logging interface available to plugins.
type Logger interface {
	// Debug logs a debug message
	Debug(msg string, args ...interface{})

	// Info logs an info message
	Info(msg string, args ...interface{})

	// Warn logs a warning message
	Warn(msg string, args ...interface{})

	// Error logs an error message
	Error(msg string, args ...interface{})
}

// DefaultLogger provides a no-op logger implementation.
type DefaultLogger struct{}

func (l *DefaultLogger) Debug(msg string, args ...interface{}) {}
func (l *DefaultLogger) Info(msg string, args ...interface{})  {}
func (l *DefaultLogger) Warn(msg string, args ...interface{})  {}
func (l *DefaultLogger) Error(msg string, args ...interface{}) {}
