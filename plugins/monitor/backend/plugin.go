package monitor

import (
	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

// Plugin is the monitor plugin
type Plugin struct {
	sdk.BaseBuiltinPlugin
	service *Service
}

// NewPlugin creates a new monitor plugin
func NewPlugin() *Plugin {
	return &Plugin{}
}

// ID returns the plugin ID
func (p *Plugin) ID() string {
	return "monitor"
}

// Name returns the plugin name
func (p *Plugin) Name() string {
	return "System Monitor"
}

// Version returns the plugin version
func (p *Plugin) Version() string {
	return "1.0.0"
}

// Description returns the plugin description
func (p *Plugin) Description() string {
	return "System monitoring and performance metrics"
}

// Dependencies returns plugin dependencies
func (p *Plugin) Dependencies() []string {
	return nil
}

// Init initializes the plugin
func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	p.BaseBuiltinPlugin.Init(ctx)
	p.service = NewService(ctx.DB(), ctx.Logger())
	return nil
}

// Migrate runs database migrations
func (p *Plugin) Migrate(db *gorm.DB) error {
	// No models to migrate for monitor plugin
	return nil
}

// RegisterRoutes registers the plugin routes
func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	// Dashboard routes
	rg.GET("/dashboard", p.getDashboardOverview)
	rg.GET("/dashboard/stats", p.getDashboardStats)

	// Monitor routes
	monitor := rg.Group("/monitor")
	{
		monitor.GET("/system", p.getSystemInfo)
		monitor.GET("/metrics", p.getMetrics)
		monitor.GET("/history/:metric", p.getHistory)
		monitor.GET("/processes", p.getProcesses)
		monitor.POST("/process/:pid/kill", p.killProcess)
	}
}

// GetMenuItems returns menu items for this plugin
func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{
		{
			ID:    "dashboard",
			Title: "Dashboard",
			Icon:  "layout-dashboard",
			Path:  "/",
			Order: 0,
		},
	}
}

// GetFrontendRoutes returns frontend routes for this plugin
func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{
			Path:      "/",
			Component: "monitor/frontend/pages/Dashboard",
			Title:     "Dashboard",
		},
		{
			Path:      "/dashboard",
			Component: "monitor/frontend/pages/Dashboard",
			Title:     "Dashboard",
		},
	}
}
