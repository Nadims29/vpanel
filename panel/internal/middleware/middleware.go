package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vpanel/server/internal/config"
	"github.com/vpanel/server/internal/services"
	"github.com/vpanel/server/pkg/logger"
	"github.com/vpanel/server/pkg/response"
)

// Logger returns a logger middleware
func Logger(log *logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		log.Info("Request",
			"status", status,
			"method", c.Request.Method,
			"path", path,
			"query", query,
			"ip", c.ClientIP(),
			"latency", latency.String(),
			"user_agent", c.Request.UserAgent(),
		)
	}
}

// CORS returns a CORS middleware
func CORS(cfg config.CORSConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !cfg.Enabled {
			c.Next()
			return
		}

		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		allowed := false
		for _, o := range cfg.AllowedOrigins {
			if o == "*" || o == origin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", strings.Join(cfg.AllowedMethods, ", "))
		c.Header("Access-Control-Allow-Headers", strings.Join(cfg.AllowedHeaders, ", "))
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// RateLimit returns a rate limiting middleware
func RateLimit(cfg config.RateLimitConfig) gin.HandlerFunc {
	if !cfg.Enabled {
		return func(c *gin.Context) { c.Next() }
	}

	type visitor struct {
		count    int
		lastSeen time.Time
	}

	var (
		visitors = make(map[string]*visitor)
		mu       sync.Mutex
	)

	// Cleanup old entries periodically
	go func() {
		for {
			time.Sleep(time.Minute)
			mu.Lock()
			for ip, v := range visitors {
				if time.Since(v.lastSeen) > time.Duration(cfg.Window)*time.Second {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()

		mu.Lock()
		v, exists := visitors[ip]
		if !exists {
			visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
			mu.Unlock()
			c.Next()
			return
		}

		// Reset if window has passed
		if time.Since(v.lastSeen) > time.Duration(cfg.Window)*time.Second {
			v.count = 1
			v.lastSeen = time.Now()
			mu.Unlock()
			c.Next()
			return
		}

		v.count++
		v.lastSeen = time.Now()

		if v.count > cfg.Requests {
			mu.Unlock()
			response.TooManyRequests(c, "Rate limit exceeded")
			c.Abort()
			return
		}

		mu.Unlock()
		c.Next()
	}
}

// Auth returns an authentication middleware
func Auth(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		// First, try to get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			// Extract token from "Bearer <token>"
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			}
		}

		// If no token in header, try query parameter (for WebSocket)
		if token == "" {
			token = c.Query("token")
		}

		// If still no token, return unauthorized
		if token == "" {
			response.Unauthorized(c, "Missing authorization token")
			c.Abort()
			return
		}

		// Validate token
		claims, err := authService.ValidateToken(token)
		if err != nil {
			response.Unauthorized(c, "Invalid or expired token")
			c.Abort()
			return
		}

		// Set user ID and role in context
		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		c.Set("username", claims.Username)
		c.Next()
	}
}

// RequireRole returns a role-checking middleware
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		roleStr, ok := userRole.(string)
		if !ok {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		// Check if user has any of the required roles
		for _, role := range roles {
			if roleStr == role {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "Insufficient permissions")
		c.Abort()
	}
}

// RequirePermission returns a permission-checking middleware
func RequirePermission(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userPerms, exists := c.Get("user_permissions")
		if !exists {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		perms, ok := userPerms.([]string)
		if !ok {
			response.Forbidden(c, "Access denied")
			c.Abort()
			return
		}

		// Check if user has all required permissions
		for _, required := range permissions {
			found := false
			for _, perm := range perms {
				if perm == required || perm == "*" {
					found = true
					break
				}
			}
			if !found {
				response.Forbidden(c, "Missing required permission: "+required)
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// RequestID adds a unique request ID to each request
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}

		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// Secure adds security headers
func Secure() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;")
		c.Next()
	}
}

// Recovery returns a panic recovery middleware
func Recovery(log *logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Error("Panic recovered",
					"error", err,
					"path", c.Request.URL.Path,
					"method", c.Request.Method,
				)

				response.InternalError(c, "Internal server error")
				c.Abort()
			}
		}()
		c.Next()
	}
}

// Audit logs user actions for auditing
func Audit(auditService *services.AuditService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip certain paths that don't need auditing
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/health") ||
			strings.HasPrefix(path, "/assets") ||
			strings.HasPrefix(path, "/api/monitor") ||
			strings.HasPrefix(path, "/api/dashboard") ||
			strings.HasPrefix(path, "/api/logs/audit") {
			c.Next()
			return
		}

		// Skip GET requests (read-only, no audit needed for most)
		method := c.Request.Method
		if method == "GET" && !strings.Contains(path, "/download") {
			c.Next()
			return
		}

		c.Next()

		// Log after request is processed
		userID, _ := c.Get("user_id")
		username, _ := c.Get("username")

		userIDStr := ""
		if userID != nil {
			userIDStr = userID.(string)
		}
		usernameStr := ""
		if username != nil {
			usernameStr = username.(string)
		}

		// Determine action and resource from path and method
		action := getActionFromMethod(method)
		resource, resourceID := getResourceFromPath(path)

		// Determine status
		status := "success"
		if c.Writer.Status() >= 400 {
			status = "failed"
		}

		// Build details
		details := map[string]interface{}{
			"method":      method,
			"path":        path,
			"status_code": c.Writer.Status(),
		}

		// Log the audit entry
		auditService.Log(
			userIDStr,
			usernameStr,
			action,
			resource,
			resourceID,
			c.ClientIP(),
			c.Request.UserAgent(),
			status,
			details,
		)
	}
}

// getActionFromMethod returns the action type based on HTTP method
func getActionFromMethod(method string) string {
	switch method {
	case "POST":
		return "create"
	case "PUT", "PATCH":
		return "update"
	case "DELETE":
		return "delete"
	default:
		return "view"
	}
}

// getResourceFromPath extracts resource type and ID from API path
func getResourceFromPath(path string) (string, string) {
	// Remove /api prefix
	path = strings.TrimPrefix(path, "/api")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) == 0 {
		return "unknown", ""
	}

	resource := parts[0]
	resourceID := ""

	if len(parts) > 1 {
		// Check if second part looks like an ID (UUID or number)
		if len(parts[1]) > 0 && (len(parts[1]) == 36 || isNumeric(parts[1])) {
			resourceID = parts[1]
		}
	}

	// Map common paths to resource names
	resourceMap := map[string]string{
		"auth":       "auth",
		"docker":     "container",
		"containers": "container",
		"images":     "image",
		"networks":   "network",
		"volumes":    "volume",
		"compose":    "compose",
		"nginx":      "site",
		"sites":      "site",
		"certs":      "certificate",
		"database":   "database",
		"files":      "file",
		"terminal":   "terminal",
		"cron":       "cron",
		"firewall":   "firewall",
		"plugins":    "plugin",
		"settings":   "settings",
		"users":      "user",
		"nodes":      "node",
	}

	if mapped, ok := resourceMap[resource]; ok {
		resource = mapped
	}

	return resource, resourceID
}

// isNumeric checks if a string contains only numeric characters
func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(s) > 0
}

func generateRequestID() string {
	// Simple implementation - should use UUID in production
	return time.Now().Format("20060102150405.000000")
}
