package ssl

import (
	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

// Plugin implements the SSL certificate management plugin
type Plugin struct {
	sdk.BaseBuiltinPlugin
	service *Service
}

// NewPlugin creates a new SSL plugin instance
func NewPlugin() *Plugin {
	return &Plugin{}
}

// ID returns the plugin identifier
func (p *Plugin) ID() string { return "ssl" }

// Name returns the plugin display name
func (p *Plugin) Name() string { return "SSL Certificates" }

// Version returns the plugin version
func (p *Plugin) Version() string { return "1.0.0" }

// Description returns the plugin description
func (p *Plugin) Description() string {
	return "SSL/TLS certificate management with Let's Encrypt, custom certificates, and self-signed support"
}

// Dependencies returns the plugin dependencies
func (p *Plugin) Dependencies() []string { return nil }

// Init initializes the plugin
func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	if err := p.BaseBuiltinPlugin.Init(ctx); err != nil {
		return err
	}
	p.service = NewService(ctx.DB(), ctx.Logger(), ctx.DataDir())
	return nil
}

// Migrate runs database migrations
func (p *Plugin) Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&SSLCertificate{})
}

// RegisterRoutes registers the plugin's HTTP routes
func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	ssl := rg.Group("/ssl")
	{
		// List and lookup
		ssl.GET("", p.list)
		ssl.GET("/stats", p.stats)
		ssl.GET("/lookup", p.lookup)

		// Create certificates
		ssl.POST("/letsencrypt", p.createLetsEncrypt)
		ssl.POST("/custom", p.createCustom)
		ssl.POST("/selfsigned", p.createSelfSigned)

		// Check expiring
		ssl.POST("/check-expiring", p.checkExpiring)

		// Certificate operations
		ssl.GET("/:id", p.get)
		ssl.PUT("/:id", p.update)
		ssl.DELETE("/:id", p.delete)
		ssl.POST("/:id/renew", p.renew)
		ssl.GET("/:id/validate", p.validate)
	}
}

// GetMenuItems returns the plugin's menu items
func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{
		{
			ID:    "ssl",
			Title: "SSL Certificates",
			Icon:  "shield-check",
			Path:  "/ssl",
			Order: 18,
		},
	}
}

// GetFrontendRoutes returns the plugin's frontend routes
func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{Path: "/ssl", Component: "ssl/List", Title: "SSL Certificates"},
		{Path: "/ssl/add", Component: "ssl/Add", Title: "Add Certificate"},
		{Path: "/ssl/:id", Component: "ssl/Detail", Title: "Certificate Details"},
	}
}

