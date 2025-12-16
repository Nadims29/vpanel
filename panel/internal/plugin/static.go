package plugin

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/vpanel/server/pkg/logger"
)

// StaticServer serves static files for plugins.
type StaticServer struct {
	manager *Manager
	log     *logger.Logger
}

// NewStaticServer creates a new static file server.
func NewStaticServer(manager *Manager, log *logger.Logger) *StaticServer {
	return &StaticServer{
		manager: manager,
		log:     log,
	}
}

// RegisterRoutes registers static file routes for all plugins.
func (s *StaticServer) RegisterRoutes(rg *gin.RouterGroup) {
	// Plugin static files: /api/plugin/:plugin_id/static/*filepath
	rg.GET("/:plugin_id/static/*filepath", s.ServeStatic)

	// Plugin API proxy: /api/plugin/:plugin_id/api/*path
	rg.Any("/:plugin_id/api/*path", s.ProxyPluginAPI)
}

// ServeStatic serves static files for a specific plugin.
func (s *StaticServer) ServeStatic(c *gin.Context) {
	pluginID := c.Param("plugin_id")
	filePath := c.Param("filepath")

	// Get the plugin
	lp, exists := s.manager.Get(pluginID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plugin not found"})
		return
	}

	if !lp.Enabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Plugin is disabled"})
		return
	}

	// Construct the static file path
	staticDir := filepath.Join(lp.ConfigDir, "assets")

	// Security: Clean and validate the path
	cleanPath := filepath.Clean(filePath)
	if strings.Contains(cleanPath, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path"})
		return
	}

	fullPath := filepath.Join(staticDir, cleanPath)

	// Ensure the path is within the static directory
	if !strings.HasPrefix(fullPath, staticDir) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Check if file exists
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Try serving index.html for SPA support
			indexPath := filepath.Join(staticDir, "index.html")
			if _, indexErr := os.Stat(indexPath); indexErr == nil {
				c.File(indexPath)
				return
			}
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error accessing file"})
		return
	}

	// If it's a directory, try to serve index.html
	if info.IsDir() {
		indexPath := filepath.Join(fullPath, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			c.File(indexPath)
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Directory listing not allowed"})
		return
	}

	// Set appropriate content type
	contentType := getContentType(fullPath)
	if contentType != "" {
		c.Header("Content-Type", contentType)
	}

	c.File(fullPath)
}

// ProxyPluginAPI proxies API requests to plugin handlers.
func (s *StaticServer) ProxyPluginAPI(c *gin.Context) {
	pluginID := c.Param("plugin_id")
	path := c.Param("path")

	// Get the plugin
	lp, exists := s.manager.Get(pluginID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plugin not found"})
		return
	}

	if !lp.Enabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Plugin is disabled"})
		return
	}

	if lp.Instance == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "Plugin has no API handlers"})
		return
	}

	// Get the plugin's routes
	routes := lp.Instance.GetRoutes()

	// Find matching route
	for _, route := range routes {
		if matchRoute(route.Path, path) && route.Method == c.Request.Method {
			route.Handler(c)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
}

// matchRoute checks if a path matches a route pattern.
func matchRoute(pattern, path string) bool {
	// Simple path matching - could be enhanced with parameter support
	pattern = strings.TrimPrefix(pattern, "/")
	path = strings.TrimPrefix(path, "/")

	// Exact match
	if pattern == path {
		return true
	}

	// Pattern matching with wildcards
	patternParts := strings.Split(pattern, "/")
	pathParts := strings.Split(path, "/")

	if len(patternParts) != len(pathParts) {
		return false
	}

	for i, part := range patternParts {
		if strings.HasPrefix(part, ":") || strings.HasPrefix(part, "*") {
			continue // Parameter placeholder
		}
		if part != pathParts[i] {
			return false
		}
	}

	return true
}

// getContentType returns the content type for a file based on extension.
func getContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	contentTypes := map[string]string{
		".html": "text/html; charset=utf-8",
		".css":  "text/css; charset=utf-8",
		".js":   "application/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".svg":  "image/svg+xml",
		".ico":  "image/x-icon",
		".woff": "font/woff",
		".woff2": "font/woff2",
		".ttf":  "font/ttf",
		".eot":  "application/vnd.ms-fontobject",
		".map":  "application/json",
		".txt":  "text/plain; charset=utf-8",
		".xml":  "application/xml; charset=utf-8",
		".pdf":  "application/pdf",
		".zip":  "application/zip",
	}
	return contentTypes[ext]
}

// PluginMenuResponse represents the menu response for a plugin.
type PluginMenuResponse struct {
	PluginID string    `json:"plugin_id"`
	Menus    []MenuDef `json:"menus"`
}

// GetPluginMenus returns all menus from enabled plugins.
func (s *StaticServer) GetPluginMenus() []PluginMenuResponse {
	plugins := s.manager.List()
	var result []PluginMenuResponse

	for _, lp := range plugins {
		if !lp.Enabled {
			continue
		}

		if len(lp.Manifest.Menus) > 0 {
			result = append(result, PluginMenuResponse{
				PluginID: lp.Manifest.ID,
				Menus:    lp.Manifest.Menus,
			})
		}
	}

	return result
}

// PluginPageResponse represents a page from a plugin.
type PluginPageResponse struct {
	PluginID  string `json:"plugin_id"`
	Path      string `json:"path"`
	Title     string `json:"title"`
	IframeSrc string `json:"iframe_src"`
}

// GetPluginPages returns all pages from enabled plugins.
func (s *StaticServer) GetPluginPages() []PluginPageResponse {
	plugins := s.manager.List()
	var result []PluginPageResponse

	for _, lp := range plugins {
		if !lp.Enabled {
			continue
		}

		// Check if the plugin has a static index.html
		staticDir := filepath.Join(lp.ConfigDir, "assets")
		indexPath := filepath.Join(staticDir, "index.html")

		if _, err := os.Stat(indexPath); err == nil {
			result = append(result, PluginPageResponse{
				PluginID:  lp.Manifest.ID,
				Path:      "/plugins/" + lp.Manifest.ID,
				Title:     lp.Manifest.Name,
				IframeSrc: "/api/plugin/" + lp.Manifest.ID + "/static/index.html",
			})
		}
	}

	return result
}
