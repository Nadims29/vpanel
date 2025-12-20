package docker

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// getInfo returns Docker daemon info
func (p *Plugin) getInfo(c *gin.Context) {
	if !p.service.IsConnected() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Docker daemon not connected",
		})
		return
	}

	info, err := p.service.GetInfo(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": info})
}

// listContainers returns all containers
func (p *Plugin) listContainers(c *gin.Context) {
	all := c.Query("all") == "true"
	containers, err := p.service.ListContainers(c.Request.Context(), all)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": containers})
}

// getContainer returns container details
func (p *Plugin) getContainer(c *gin.Context) {
	id := c.Param("id")
	container, err := p.service.GetContainer(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": container})
}

// createContainer creates a new container
func (p *Plugin) createContainer(c *gin.Context) {
	var req CreateContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	id, err := p.service.CreateContainer(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

// startContainer starts a container
func (p *Plugin) startContainer(c *gin.Context) {
	id := c.Param("id")
	if err := p.service.StartContainer(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Container started"})
}

// stopContainer stops a container
func (p *Plugin) stopContainer(c *gin.Context) {
	id := c.Param("id")
	if err := p.service.StopContainer(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Container stopped"})
}

// restartContainer restarts a container
func (p *Plugin) restartContainer(c *gin.Context) {
	id := c.Param("id")
	if err := p.service.RestartContainer(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Container restarted"})
}

// removeContainer removes a container
func (p *Plugin) removeContainer(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := p.service.RemoveContainer(c.Request.Context(), id, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Container removed"})
}

// containerLogs returns container logs
func (p *Plugin) containerLogs(c *gin.Context) {
	id := c.Param("id")
	logs, err := p.service.GetContainerLogs(c.Request.Context(), id, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": logs})
}

// containerStats returns container stats
func (p *Plugin) containerStats(c *gin.Context) {
	id := c.Param("id")
	stats, err := p.service.GetContainerStats(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

// listImages returns all images
func (p *Plugin) listImages(c *gin.Context) {
	images, err := p.service.ListImages(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": images})
}

// pullImage pulls an image
func (p *Plugin) pullImage(c *gin.Context) {
	var req struct {
		Image string `json:"image" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := p.service.PullImage(c.Request.Context(), req.Image); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Image pulled"})
}

// removeImage removes an image
func (p *Plugin) removeImage(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := p.service.RemoveImage(c.Request.Context(), id, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Image removed"})
}

// listNetworks returns all networks
func (p *Plugin) listNetworks(c *gin.Context) {
	networks, err := p.service.ListNetworks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": networks})
}

// createNetwork creates a network
func (p *Plugin) createNetwork(c *gin.Context) {
	var req struct {
		Name   string `json:"name" binding:"required"`
		Driver string `json:"driver"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.Driver == "" {
		req.Driver = "bridge"
	}

	id, err := p.service.CreateNetwork(c.Request.Context(), req.Name, req.Driver)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

// removeNetwork removes a network
func (p *Plugin) removeNetwork(c *gin.Context) {
	id := c.Param("id")
	if err := p.service.RemoveNetwork(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Network removed"})
}

// listVolumes returns all volumes
func (p *Plugin) listVolumes(c *gin.Context) {
	volumes, err := p.service.ListVolumes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": volumes})
}

// createVolume creates a volume
func (p *Plugin) createVolume(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	volume, err := p.service.CreateVolume(c.Request.Context(), req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": volume})
}

// removeVolume removes a volume
func (p *Plugin) removeVolume(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := p.service.RemoveVolume(c.Request.Context(), id, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Volume removed"})
}

// Compose handlers

// listComposeProjects returns all compose projects
func (p *Plugin) listComposeProjects(c *gin.Context) {
	projects, err := p.service.ListComposeProjects(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": projects})
}

// createComposeProject creates a compose project
func (p *Plugin) createComposeProject(c *gin.Context) {
	var project DockerComposeProject
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := p.service.CreateComposeProject(&project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": project})
}

// removeComposeProject removes a compose project
func (p *Plugin) removeComposeProject(c *gin.Context) {
	id := c.Param("id")
	if err := p.service.RemoveComposeProject(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Project removed"})
}

// composeUp starts a compose project (placeholder)
func (p *Plugin) composeUp(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Compose up initiated"})
}

// composeDown stops a compose project (placeholder)
func (p *Plugin) composeDown(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Compose down initiated"})
}
