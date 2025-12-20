package nginx

import (
	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

type Plugin struct {
	sdk.BaseBuiltinPlugin
	service *Service
}

func NewPlugin() *Plugin { return &Plugin{} }

func (p *Plugin) ID() string             { return "nginx" }
func (p *Plugin) Name() string           { return "Nginx Management" }
func (p *Plugin) Version() string        { return "1.0.0" }
func (p *Plugin) Description() string    { return "Nginx web server management" }
func (p *Plugin) Dependencies() []string { return nil }

func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	p.BaseBuiltinPlugin.Init(ctx)
	p.service = NewService(ctx.DB(), ctx.Logger())
	return nil
}

func (p *Plugin) Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&NginxInstance{}, &NginxSite{}, &SSLCertificate{})
}

func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	nginx := rg.Group("/nginx")
	{
		nginx.GET("/status", p.status)
		nginx.POST("/reload", p.reload)

		// Instances
		nginx.GET("/instances", p.listInstances)
		nginx.POST("/instances", p.createInstance)
		nginx.GET("/instances/:id", p.getInstance)
		nginx.PUT("/instances/:id", p.updateInstance)
		nginx.DELETE("/instances/:id", p.deleteInstance)
		nginx.POST("/instances/:id/start", p.startInstance)
		nginx.POST("/instances/:id/stop", p.stopInstance)
		nginx.POST("/instances/:id/reload", p.reloadInstance)

		// Sites
		nginx.GET("/sites", p.listSites)
		nginx.POST("/sites", p.createSite)
		nginx.GET("/sites/:id", p.getSite)
		nginx.PUT("/sites/:id", p.updateSite)
		nginx.DELETE("/sites/:id", p.deleteSite)
		nginx.POST("/sites/:id/enable", p.enableSite)
		nginx.POST("/sites/:id/disable", p.disableSite)

		// SSL Certificates
		nginx.GET("/ssl/certificates", p.listCertificates)
		nginx.POST("/ssl/certificates", p.createCertificate)
		nginx.DELETE("/ssl/certificates/:id", p.deleteCertificate)

		// Logs
		nginx.GET("/logs/access", p.accessLogs)
		nginx.GET("/logs/error", p.errorLogs)
	}
}

func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{
		{
			ID: "nginx", Title: "Nginx", Icon: "globe", Path: "/nginx", Order: 20,
			Children: []sdk.MenuItem{
				{ID: "nginx-instances", Title: "Instances", Path: "/nginx/instances", Order: 0},
				{ID: "nginx-sites", Title: "Sites", Path: "/nginx/sites", Order: 1},
				{ID: "nginx-certs", Title: "Certificates", Path: "/nginx/certificates", Order: 2},
				{ID: "nginx-logs", Title: "Logs", Path: "/nginx/logs", Order: 3},
			},
		},
	}
}

func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{Path: "/nginx/instances", Component: "nginx/frontend/pages/Instances", Title: "Instances"},
		{Path: "/nginx/sites", Component: "nginx/frontend/pages/Sites", Title: "Sites"},
		{Path: "/nginx/certificates", Component: "nginx/frontend/pages/Certificates", Title: "Certificates"},
		{Path: "/nginx/logs", Component: "nginx/frontend/pages/Logs", Title: "Logs"},
	}
}
