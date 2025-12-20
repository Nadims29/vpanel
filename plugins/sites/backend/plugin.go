package sites

import (
	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

type Plugin struct {
	sdk.BaseBuiltinPlugin
}

func NewPlugin() *Plugin { return &Plugin{} }

func (p *Plugin) ID() string             { return "sites" }
func (p *Plugin) Name() string           { return "Sites & Domains" }
func (p *Plugin) Version() string        { return "1.0.0" }
func (p *Plugin) Description() string    { return "Domain and site management" }
func (p *Plugin) Dependencies() []string { return []string{"nginx", "apps"} }

func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	return p.BaseBuiltinPlugin.Init(ctx)
}

func (p *Plugin) Migrate(db *gorm.DB) error { return nil }

func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	sites := rg.Group("/sites")
	{
		sites.GET("", p.list)
		sites.POST("", p.create)
		sites.GET("/:id", p.get)
		sites.PUT("/:id", p.update)
		sites.DELETE("/:id", p.delete)
	}
}

func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{{ID: "sites", Title: "Sites", Icon: "globe", Path: "/sites", Order: 15}}
}

func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{Path: "/sites", Component: "sites/frontend/pages/List", Title: "Sites"},
		{Path: "/sites/add", Component: "sites/frontend/pages/Add", Title: "Add Site"},
		{Path: "/sites/:id", Component: "sites/frontend/pages/Detail", Title: "Site Detail"},
	}
}

func (p *Plugin) list(c *gin.Context)   { c.JSON(200, gin.H{"success": true, "data": []interface{}{}}) }
func (p *Plugin) create(c *gin.Context) { c.JSON(201, gin.H{"success": true}) }
func (p *Plugin) get(c *gin.Context)    { c.JSON(200, gin.H{"success": true, "data": nil}) }
func (p *Plugin) update(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) delete(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
