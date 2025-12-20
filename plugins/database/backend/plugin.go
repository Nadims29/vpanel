package database

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

func (p *Plugin) ID() string             { return "database" }
func (p *Plugin) Name() string           { return "Database Management" }
func (p *Plugin) Version() string        { return "1.0.0" }
func (p *Plugin) Description() string    { return "MySQL, PostgreSQL, Redis database management" }
func (p *Plugin) Dependencies() []string { return []string{"docker"} }

func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	p.BaseBuiltinPlugin.Init(ctx)
	p.service = NewService(ctx.DB(), ctx.Logger())
	return nil
}

func (p *Plugin) Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&DatabaseServer{}, &DatabaseBackup{})
}

func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	db := rg.Group("/database")
	{
		db.GET("/servers", p.listServers)
		db.POST("/servers", p.createServer)
		db.DELETE("/servers/:id", p.deleteServer)
		db.GET("/servers/:id/databases", p.listDatabases)
		db.POST("/servers/:id/databases", p.createDatabase)
		db.DELETE("/servers/:id/databases/:db", p.deleteDatabase)
		db.GET("/servers/:id/users", p.listUsers)
		db.POST("/servers/:id/users", p.createUser)
		db.DELETE("/servers/:id/users/:user", p.deleteUser)
		db.POST("/servers/:id/backup", p.backup)
		db.POST("/servers/:id/restore", p.restore)
		db.GET("/backups", p.listBackups)
		db.GET("/backups/:id", p.getBackup)
		db.DELETE("/backups/:id", p.deleteBackup)
	}
}

func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{
		{
			ID: "database", Title: "Database", Icon: "database", Path: "/database", Order: 30,
			Children: []sdk.MenuItem{
				{ID: "db-servers", Title: "Servers", Path: "/database/servers", Order: 0},
				{ID: "db-backups", Title: "Backups", Path: "/database/backups", Order: 1},
			},
		},
	}
}

func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{Path: "/database/servers", Component: "database/frontend/pages/Servers", Title: "Servers"},
		{Path: "/database/backups", Component: "database/frontend/pages/Backups", Title: "Backups"},
	}
}
