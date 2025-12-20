// Package sdk provides the VPanel plugin SDK for developing plugins.
package sdk

// Plugin is the interface that all plugins must implement.
// This is the primary interface for plugin lifecycle management.
type Plugin interface {
	// OnLoad is called when the plugin is first loaded.
	// Use this to initialize resources and register hooks.
	OnLoad(ctx *Context) error

	// OnEnable is called when the plugin is enabled.
	// Use this to start background services or activate features.
	OnEnable() error

	// OnDisable is called when the plugin is disabled.
	// Use this to stop background services and release resources.
	OnDisable() error

	// OnUnload is called when the plugin is being unloaded.
	// Use this for final cleanup.
	OnUnload() error
}

// BasePlugin provides a default implementation of the Plugin interface.
// Plugins can embed this struct to get default no-op implementations.
type BasePlugin struct {
	ctx *Context
}

// OnLoad provides a default no-op implementation.
func (p *BasePlugin) OnLoad(ctx *Context) error {
	p.ctx = ctx
	return nil
}

// OnEnable provides a default no-op implementation.
func (p *BasePlugin) OnEnable() error {
	return nil
}

// OnDisable provides a default no-op implementation.
func (p *BasePlugin) OnDisable() error {
	return nil
}

// OnUnload provides a default no-op implementation.
func (p *BasePlugin) OnUnload() error {
	return nil
}

// Context returns the plugin context.
func (p *BasePlugin) Context() *Context {
	return p.ctx
}

// BasicPluginInfo contains basic plugin information.
type BasicPluginInfo struct {
	ID          string
	Name        string
	Version     string
	Description string
	Author      string
}

// GetInfo returns plugin information from the base plugin.
func (p *BasePlugin) GetInfo() *BasicPluginInfo {
	if p.ctx == nil {
		return nil
	}
	return &BasicPluginInfo{
		ID: p.ctx.PluginID,
	}
}
