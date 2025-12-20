package database

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (p *Plugin) listServers(c *gin.Context) {
	servers, err := p.service.ListServers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": servers})
}

func (p *Plugin) createServer(c *gin.Context) {
	var server DatabaseServer
	if err := c.ShouldBindJSON(&server); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if err := p.service.CreateServer(&server); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": server})
}

func (p *Plugin) deleteServer(c *gin.Context) {
	if err := p.service.DeleteServer(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Deleted"})
}

func (p *Plugin) listDatabases(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}})
}
func (p *Plugin) createDatabase(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func (p *Plugin) deleteDatabase(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }
func (p *Plugin) listUsers(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}})
}
func (p *Plugin) createUser(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func (p *Plugin) deleteUser(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func (p *Plugin) backup(c *gin.Context) {
	backup := &DatabaseBackup{ServerID: c.Param("id"), Status: "pending"}
	if err := p.service.CreateBackup(backup); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": backup})
}

func (p *Plugin) restore(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func (p *Plugin) listBackups(c *gin.Context) {
	backups, err := p.service.ListBackups()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": backups})
}

func (p *Plugin) getBackup(c *gin.Context) {
	backup, err := p.service.GetBackup(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": backup})
}

func (p *Plugin) deleteBackup(c *gin.Context) {
	if err := p.service.DeleteBackup(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Deleted"})
}
