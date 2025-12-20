package files

import (
	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

// Plugin is the file manager plugin
type Plugin struct {
	sdk.BaseBuiltinPlugin
	service *Service
}

// NewPlugin creates a new files plugin
func NewPlugin() *Plugin {
	return &Plugin{}
}

func (p *Plugin) ID() string             { return "files" }
func (p *Plugin) Name() string           { return "File Manager" }
func (p *Plugin) Version() string        { return "1.0.0" }
func (p *Plugin) Description() string    { return "File management and editing" }
func (p *Plugin) Dependencies() []string { return nil }

func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	p.BaseBuiltinPlugin.Init(ctx)
	p.service = NewService(ctx.Logger())
	return nil
}

func (p *Plugin) Migrate(db *gorm.DB) error {
	return nil
}

func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	files := rg.Group("/files")
	{
		files.GET("/list", p.list)
		files.GET("/read", p.read)
		files.POST("/write", p.write)
		files.POST("/mkdir", p.mkdir)
		files.POST("/rename", p.rename)
		files.POST("/copy", p.copyFile)
		files.POST("/move", p.moveFile)
		files.DELETE("/delete", p.delete)
		files.POST("/upload", p.upload)
		files.GET("/download", p.download)
		files.POST("/compress", p.compress)
		files.POST("/decompress", p.decompress)
		files.GET("/permissions", p.getPermissions)
		files.POST("/permissions", p.setPermissions)
		files.GET("/search", p.search)
	}
}

func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{
		{ID: "files", Title: "Files", Icon: "folder", Path: "/files", Order: 60},
	}
}

func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{Path: "/files", Component: "files/frontend/pages/FileManager", Title: "File Manager"},
	}
}
