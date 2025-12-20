package plugin

import (
	"net/http"

	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
)

// Handlers provides HTTP handlers for plugin management.
type Handlers struct {
	manager *Manager
}

// NewHandlers creates new plugin handlers.
func NewHandlers(manager *Manager) *Handlers {
	return &Handlers{manager: manager}
}

// List returns all registered plugins with detailed info.
func (h *Handlers) List(c *gin.Context) {
	plugins := h.manager.ListPluginInfo()
	builtin, external, enabled := h.manager.GetPluginCount()
	core := h.manager.GetCoreInfo()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"plugins": plugins,
			"stats": gin.H{
				"builtin":  builtin,
				"external": external,
				"enabled":  enabled,
				"total":    builtin + external,
			},
			"core": core,
		},
	})
}

// GetMenus returns all plugin menus.
func (h *Handlers) GetMenus(c *gin.Context) {
	menus := h.manager.GetAllMenuItems()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    menus,
	})
}

// GetRoutes returns all plugin frontend routes.
func (h *Handlers) GetRoutes(c *gin.Context) {
	routes := h.manager.GetAllFrontendRoutes()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    routes,
	})
}

// Get returns a specific plugin info.
func (h *Handlers) Get(c *gin.Context) {
	id := c.Param("id")
	info := h.manager.GetPluginInfo(id)
	if info == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Plugin not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    info,
	})
}

// Enable enables a plugin.
func (h *Handlers) Enable(c *gin.Context) {
	id := c.Param("id")
	if err := h.manager.Enable(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Plugin enabled",
	})
}

// Disable disables a plugin.
func (h *Handlers) Disable(c *gin.Context) {
	id := c.Param("id")
	if err := h.manager.Disable(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Plugin disabled",
	})
}

// Install installs a new plugin.
func (h *Handlers) Install(c *gin.Context) {
	var req struct {
		Source string `json:"source" binding:"required"` // URL or file path
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request",
		})
		return
	}

	if err := h.manager.InstallPlugin(req.Source); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Plugin installed",
	})
}

// Uninstall uninstalls a plugin.
func (h *Handlers) Uninstall(c *gin.Context) {
	id := c.Param("id")

	// Check if it's a builtin plugin
	if info := h.manager.GetPluginInfo(id); info != nil {
		if info.Type == sdk.PluginTypeBuiltin {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Cannot uninstall builtin plugins",
			})
			return
		}
	}

	if err := h.manager.UninstallPlugin(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Plugin uninstalled",
	})
}

// GetSettings returns plugin settings.
func (h *Handlers) GetSettings(c *gin.Context) {
	id := c.Param("id")
	info := h.manager.GetPluginInfo(id)
	if info == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Plugin not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"schema":   info.Settings,
			"values":   gin.H{}, // TODO: Load actual values from database
		},
	})
}

// UpdateSettings updates plugin settings.
func (h *Handlers) UpdateSettings(c *gin.Context) {
	id := c.Param("id")
	info := h.manager.GetPluginInfo(id)
	if info == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Plugin not found",
		})
		return
	}

	var settings map[string]interface{}
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid settings",
		})
		return
	}

	// TODO: Save settings to database

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Settings updated",
	})
}

// Market returns available plugins from the marketplace.
func (h *Handlers) Market(c *gin.Context) {
	// TODO: Fetch plugins from market URL
	// For now, return empty list
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    []sdk.MarketPlugin{},
	})
}

// GetCore returns core version info.
func (h *Handlers) GetCore(c *gin.Context) {
	core := h.manager.GetCoreInfo()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    core,
	})
}

// RegisterRoutes registers plugin management routes.
func (h *Handlers) RegisterRoutes(rg *gin.RouterGroup) {
	plugins := rg.Group("/plugins")
	{
		plugins.GET("", h.List)
		plugins.GET("/menus", h.GetMenus)
		plugins.GET("/routes", h.GetRoutes)
		plugins.GET("/market", h.Market)
		plugins.GET("/core", h.GetCore)
		plugins.POST("/install", h.Install)
		plugins.GET("/:id", h.Get)
		plugins.POST("/:id/enable", h.Enable)
		plugins.POST("/:id/disable", h.Disable)
		plugins.DELETE("/:id", h.Uninstall)
		plugins.GET("/:id/settings", h.GetSettings)
		plugins.PUT("/:id/settings", h.UpdateSettings)
	}
}
