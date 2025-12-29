package update

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handlers provides HTTP handlers for update operations.
type Handlers struct {
	service *Service
}

// NewHandlers creates new update handlers.
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// GetVersion returns the current version information.
func (h *Handlers) GetVersion(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    h.service.GetCurrentVersion(),
	})
}

// GetStatus returns the current update status.
func (h *Handlers) GetStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    h.service.GetStatus(),
	})
}

// CheckUpdate checks for available updates.
func (h *Handlers) CheckUpdate(c *gin.Context) {
	result, err := h.service.CheckUpdate()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "UPDATE_CHECK_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// PerformUpdate performs the update.
func (h *Handlers) PerformUpdate(c *gin.Context) {
	// Start the update in a goroutine
	go func() {
		_ = h.service.PerformUpdate()
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Update started",
		"data":    h.service.GetStatus(),
	})
}

// RegisterRoutes registers update-related routes.
func (h *Handlers) RegisterRoutes(rg *gin.RouterGroup) {
	update := rg.Group("/update")
	{
		update.GET("/version", h.GetVersion)
		update.GET("/status", h.GetStatus)
		update.POST("/check", h.CheckUpdate)
		update.POST("/perform", h.PerformUpdate)
	}
}

