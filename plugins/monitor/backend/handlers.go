package monitor

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// getDashboardOverview returns dashboard overview
func (p *Plugin) getDashboardOverview(c *gin.Context) {
	metrics, err := p.service.GetMetrics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Get counts from database or other plugins
	// These would come from other plugins in the full implementation
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"containers": 0,
			"running":    0,
			"sites":      0,
			"databases":  0,
			"alerts":     0,
			"metrics":    metrics,
		},
	})
}

// getDashboardStats returns dashboard statistics
func (p *Plugin) getDashboardStats(c *gin.Context) {
	systemInfo, err := p.service.GetSystemInfo()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	metrics, _ := p.service.GetMetrics()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"system":  systemInfo,
			"metrics": metrics,
		},
	})
}

// getSystemInfo returns system information
func (p *Plugin) getSystemInfo(c *gin.Context) {
	info, err := p.service.GetSystemInfo()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    info,
	})
}

// getMetrics returns current system metrics
func (p *Plugin) getMetrics(c *gin.Context) {
	metrics, err := p.service.GetMetrics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    metrics,
	})
}

// getHistory returns metric history (placeholder)
func (p *Plugin) getHistory(c *gin.Context) {
	metric := c.Param("metric")

	// In a full implementation, this would return historical data
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"metric":  metric,
		"data":    []interface{}{},
	})
}

// getProcesses returns list of processes
func (p *Plugin) getProcesses(c *gin.Context) {
	processes, err := p.service.GetProcesses()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    processes,
	})
}

// killProcess kills a process by PID
func (p *Plugin) killProcess(c *gin.Context) {
	pidStr := c.Param("pid")
	pid, err := strconv.ParseInt(pidStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid PID",
		})
		return
	}

	if err := p.service.KillProcess(int32(pid)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Process killed",
	})
}
