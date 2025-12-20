package nginx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (p *Plugin) status(c *gin.Context) {
	status, err := p.service.GetStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": status})
}

func (p *Plugin) reload(c *gin.Context) {
	if err := p.service.ReloadNginx(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Nginx reloaded"})
}

// Instance handlers
func (p *Plugin) listInstances(c *gin.Context) {
	instances, err := p.service.ListInstances()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": instances})
}

func (p *Plugin) createInstance(c *gin.Context) {
	var instance NginxInstance
	if err := c.ShouldBindJSON(&instance); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if err := p.service.CreateInstance(&instance); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": instance})
}

func (p *Plugin) getInstance(c *gin.Context) {
	instance, err := p.service.GetInstance(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": instance})
}

func (p *Plugin) updateInstance(c *gin.Context) {
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if err := p.service.UpdateInstance(c.Param("id"), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Updated"})
}

func (p *Plugin) deleteInstance(c *gin.Context) {
	if err := p.service.DeleteInstance(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Deleted"})
}

func (p *Plugin) startInstance(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true}) }
func (p *Plugin) stopInstance(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }
func (p *Plugin) reloadInstance(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// Site handlers
func (p *Plugin) listSites(c *gin.Context) {
	sites, err := p.service.ListSites(c.Query("instance_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": sites})
}

func (p *Plugin) createSite(c *gin.Context) {
	var site NginxSite
	if err := c.ShouldBindJSON(&site); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if err := p.service.CreateSite(&site); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": site})
}

func (p *Plugin) getSite(c *gin.Context) {
	site, err := p.service.GetSite(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": site})
}

func (p *Plugin) updateSite(c *gin.Context) {
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if err := p.service.UpdateSite(c.Param("id"), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Updated"})
}

func (p *Plugin) deleteSite(c *gin.Context) {
	if err := p.service.DeleteSite(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Deleted"})
}

func (p *Plugin) enableSite(c *gin.Context) {
	if err := p.service.EnableSite(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Enabled"})
}

func (p *Plugin) disableSite(c *gin.Context) {
	if err := p.service.DisableSite(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Disabled"})
}

// Certificate handlers
func (p *Plugin) listCertificates(c *gin.Context) {
	certs, err := p.service.ListCertificates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": certs})
}

func (p *Plugin) createCertificate(c *gin.Context) {
	var cert SSLCertificate
	if err := c.ShouldBindJSON(&cert); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if err := p.service.CreateCertificate(&cert); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": cert})
}

func (p *Plugin) deleteCertificate(c *gin.Context) {
	if err := p.service.DeleteCertificate(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Deleted"})
}

// Log handlers
func (p *Plugin) accessLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}})
}

func (p *Plugin) errorLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}})
}
