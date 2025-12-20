package firewall

import (
	"os/exec"

	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

// Check if Fail2Ban is installed
func isFail2BanInstalled() bool {
	_, err := exec.LookPath("fail2ban-client")
	return err == nil
}

type Plugin struct {
	sdk.BaseBuiltinPlugin
}

func NewPlugin() *Plugin { return &Plugin{} }

func (p *Plugin) ID() string             { return "firewall" }
func (p *Plugin) Name() string           { return "Firewall" }
func (p *Plugin) Version() string        { return "1.0.0" }
func (p *Plugin) Description() string    { return "Firewall rules management" }
func (p *Plugin) Dependencies() []string { return nil }

func (p *Plugin) Init(ctx *sdk.PluginContext) error {
	return p.BaseBuiltinPlugin.Init(ctx)
}

func (p *Plugin) Migrate(db *gorm.DB) error { return nil }

func (p *Plugin) RegisterRoutes(rg *gin.RouterGroup) {
	fw := rg.Group("/firewall")
	{
		fw.GET("/status", p.status)
		fw.POST("/enable", p.enable)
		fw.POST("/disable", p.disable)
		fw.GET("/rules", p.listRules)
		fw.POST("/rules", p.createRule)
		fw.PUT("/rules/:id", p.updateRule)
		fw.DELETE("/rules/:id", p.deleteRule)

		// Fail2Ban routes
		f2b := fw.Group("/fail2ban")
		{
			f2b.GET("/status", p.fail2banStatus)
			f2b.GET("/jails", p.listFail2BanJails)
			f2b.POST("/jails/:name/unban", p.unbanIP)
		}
	}
}

func (p *Plugin) GetMenuItems() []sdk.MenuItem {
	return []sdk.MenuItem{{ID: "firewall", Title: "Firewall", Icon: "shield", Path: "/firewall/rules", Order: 55}}
}

func (p *Plugin) GetFrontendRoutes() []sdk.FrontendRoute {
	return []sdk.FrontendRoute{
		{Path: "/firewall/rules", Component: "firewall/frontend/pages/Rules", Title: "Firewall Rules"},
	}
}

func (p *Plugin) status(c *gin.Context) {
	c.JSON(200, gin.H{"success": true, "data": gin.H{"enabled": true, "activeRules": 0, "blockedIPs": 0}})
}
func (p *Plugin) enable(c *gin.Context)  { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) disable(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) listRules(c *gin.Context) {
	c.JSON(200, gin.H{"success": true, "data": []interface{}{}})
}
func (p *Plugin) createRule(c *gin.Context) { c.JSON(201, gin.H{"success": true}) }
func (p *Plugin) updateRule(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }
func (p *Plugin) deleteRule(c *gin.Context) { c.JSON(200, gin.H{"success": true}) }

// Fail2Ban handlers
func (p *Plugin) fail2banStatus(c *gin.Context) {
	installed := isFail2BanInstalled()
	c.JSON(200, gin.H{"success": true, "data": gin.H{
		"installed":   installed,
		"enabled":     false,
		"activeJails": 0,
		"bannedIPs":   0,
	}})
}

func (p *Plugin) listFail2BanJails(c *gin.Context) {
	// If Fail2Ban is not installed, return empty list
	if !isFail2BanInstalled() {
		c.JSON(200, gin.H{"success": true, "data": []interface{}{}})
		return
	}
	// TODO: Implement actual Fail2Ban jail listing
	c.JSON(200, gin.H{"success": true, "data": []interface{}{}})
}

func (p *Plugin) unbanIP(c *gin.Context) {
	if !isFail2BanInstalled() {
		c.JSON(400, gin.H{"success": false, "error": "Fail2Ban is not installed"})
		return
	}
	// TODO: Implement actual unban logic
	c.JSON(200, gin.H{"success": true})
}
