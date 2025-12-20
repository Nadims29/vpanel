package cron

import (
	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

type Plugin struct {
	sdk.BaseBuiltinPlugin
}

func NewPlugin() *Plugin { return &Plugin{} }

func (p *Plugin) ID() string             { return "cron" }
func (p *Plugin) Name() string           { return "Cron Jobs" }
func (p *Plugin) Version() string        { return "1.0.0" }
func (p *Plugin) Description() string    { return "Scheduled task management" }
func (p *Plugin) Dependencies() []string { return nil }

func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	return p.BaseBuiltinPlugin.Init(ctx)
}

func (p *Plugin) Migrate(db *gorm.DB) error { return nil }

func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	cron := rg.Group("/cron")
	{
		cron.GET("/jobs", p.list)
		cron.POST("/jobs", p.create)
		cron.GET("/jobs/:id", p.get)
		cron.PUT("/jobs/:id", p.update)
		cron.DELETE("/jobs/:id", p.delete)
		cron.POST("/jobs/:id/run", p.run)
		cron.GET("/jobs/:id/logs", p.logs)
	}
}

func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{{ID: "cron", Title: "Cron Jobs", Icon: "clock", Path: "/cron/jobs", Order: 50}}
}

func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{Path: "/cron/jobs", Component: "cron/frontend/pages/Jobs", Title: "Cron Jobs"},
	}
}

func (p *Plugin) list(c *gin.Context)   { c.JSON(200, gin.H{"success": true, "data": []interface{}{}}) }
func (p *Plugin) create(c *gin.Context) { c.JSON(201, gin.H{"success": true}) }
func (p *Plugin) get(c *gin.Context)    { c.JSON(200, gin.H{"success": true, "data": nil}) }
func (p *Plugin) update(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) delete(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) run(c *gin.Context)    { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) logs(c *gin.Context)   { c.JSON(200, gin.H{"success": true, "data": []interface{}{}}) }
