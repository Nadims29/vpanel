package terminal

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

func (p *Plugin) ID() string             { return "terminal" }
func (p *Plugin) Name() string           { return "Terminal" }
func (p *Plugin) Version() string        { return "1.0.0" }
func (p *Plugin) Description() string    { return "Web-based terminal access" }
func (p *Plugin) Dependencies() []string { return nil }

func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	p.BaseBuiltinPlugin.Init(ctx)
	p.service = NewService(ctx.Logger())
	return nil
}

func (p *Plugin) Migrate(db *gorm.DB) error { return nil }

func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/terminal/ws", p.websocket)
	rg.GET("/terminal/sessions", p.listSessions)
	rg.DELETE("/terminal/sessions/:id", p.closeSession)
}

func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{{ID: "terminal", Title: "Terminal", Icon: "terminal", Path: "/terminal", Order: 70}}
}

func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{{Path: "/terminal", Component: "terminal/frontend/pages/Terminal", Title: "Terminal"}}
}
