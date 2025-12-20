package apps

import (
	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

type Plugin struct {
	sdk.BaseBuiltinPlugin
}

func NewPlugin() *Plugin { return &Plugin{} }

func (p *Plugin) ID() string             { return "apps" }
func (p *Plugin) Name() string           { return "Applications" }
func (p *Plugin) Version() string        { return "1.0.0" }
func (p *Plugin) Description() string    { return "Git-based application deployment" }
func (p *Plugin) Dependencies() []string { return []string{"docker", "nginx"} }

func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	return p.BaseBuiltinPlugin.Init(ctx)
}

func (p *Plugin) Migrate(db *gorm.DB) error { return nil }

func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	apps := rg.Group("/apps")
	{
		apps.GET("", p.list)
		apps.POST("", p.create)
		apps.GET("/:id", p.get)
		apps.PUT("/:id", p.update)
		apps.DELETE("/:id", p.delete)
		apps.POST("/:id/deploy", p.deploy)
		apps.POST("/:id/start", p.start)
		apps.POST("/:id/stop", p.stop)
		apps.GET("/:id/logs", p.logs)
		apps.GET("/runtimes", p.listRuntimes)
	}
}

func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{{ID: "apps", Title: "Apps", Icon: "package", Path: "/apps", Order: 25}}
}

func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{Path: "/apps", Component: "apps/frontend/pages/List", Title: "Apps"},
		{Path: "/apps/create", Component: "apps/frontend/pages/Create", Title: "Create App"},
		{Path: "/apps/runtimes", Component: "apps/frontend/pages/Runtimes", Title: "Runtimes"},
		{Path: "/apps/:id", Component: "apps/frontend/pages/Detail", Title: "App Detail"},
	}
}

func (p *Plugin) list(c *gin.Context)   { c.JSON(200, gin.H{"success": true, "data": []interface{}{}}) }
func (p *Plugin) create(c *gin.Context) { c.JSON(201, gin.H{"success": true}) }
func (p *Plugin) get(c *gin.Context)    { c.JSON(200, gin.H{"success": true, "data": nil}) }
func (p *Plugin) update(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) delete(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) deploy(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) start(c *gin.Context)  { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) stop(c *gin.Context)   { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) logs(c *gin.Context)   { c.JSON(200, gin.H{"success": true, "data": ""}) }
func (p *Plugin) listRuntimes(c *gin.Context) {
	c.JSON(200, gin.H{"success": true, "data": []interface{}{}})
}
