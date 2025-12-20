package auth

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vpanel/core/pkg/response"
)

// Middleware provides authentication and authorization middleware
type Middleware struct {
	svc         *Service
	rateLimiter *RateLimiter
}

// NewMiddleware creates new auth middleware
func NewMiddleware(svc *Service) *Middleware {
	return &Middleware{
		svc:         svc,
		rateLimiter: NewRateLimiter(100, time.Minute),
	}
}

// RequireAuth validates JWT token and sets user context
func (m *Middleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			response.Unauthorized(c, "Authentication required")
			c.Abort()
			return
		}

		claims, err := m.svc.ValidateToken(token)
		if err != nil {
			switch err {
			case ErrTokenExpired:
				response.Error(c, http.StatusUnauthorized, "TOKEN_EXPIRED", "Token has expired")
			default:
				response.Unauthorized(c, "Invalid token")
			}
			c.Abort()
			return
		}

		// Validate session is still active
		session, err := m.svc.ValidateSession(claims.SessionID)
		if err != nil {
			switch err {
			case ErrSessionNotFound:
				response.Unauthorized(c, "Session not found")
			case ErrSessionExpired:
				response.Error(c, http.StatusUnauthorized, "SESSION_EXPIRED", "Session has expired")
			default:
				response.Unauthorized(c, "Invalid session")
			}
			c.Abort()
			return
		}

		// Check if user account is still active
		if !session.User.IsActive() {
			response.Forbidden(c, "Account is inactive")
			c.Abort()
			return
		}

		// Set user context
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Set("session_id", claims.SessionID)
		c.Set("permissions", claims.Permissions)
		c.Set("user", &session.User)

		c.Next()
	}
}

// RequireAPIKey validates API key authentication
func (m *Middleware) RequireAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			// Try Authorization header with ApiKey scheme
			auth := c.GetHeader("Authorization")
			if strings.HasPrefix(auth, "ApiKey ") {
				apiKey = strings.TrimPrefix(auth, "ApiKey ")
			}
		}

		if apiKey == "" {
			response.Unauthorized(c, "API key required")
			c.Abort()
			return
		}

		user, key, err := m.svc.ValidateAPIKey(apiKey)
		if err != nil {
			switch err {
			case ErrAPIKeyExpired:
				response.Unauthorized(c, "API key has expired")
			case ErrAPIKeyInactive:
				response.Unauthorized(c, "API key is inactive")
			default:
				response.Unauthorized(c, "Invalid API key")
			}
			c.Abort()
			return
		}

		// Check if user account is still active
		if !user.IsActive() {
			response.Forbidden(c, "Account is inactive")
			c.Abort()
			return
		}

		// Update last used IP
		m.svc.db.Model(key).Update("last_used_ip", c.ClientIP())

		// Set user context
		c.Set("user_id", user.ID)
		c.Set("username", user.Username)
		c.Set("role", user.Role)
		c.Set("permissions", key.Permissions)
		c.Set("api_key_id", key.ID)
		c.Set("user", user)
		c.Set("auth_type", "api_key")

		c.Next()
	}
}

// RequireAuthOrAPIKey allows either JWT or API key authentication
func (m *Middleware) RequireAuthOrAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for API key first
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			auth := c.GetHeader("Authorization")
			if strings.HasPrefix(auth, "ApiKey ") {
				apiKey = strings.TrimPrefix(auth, "ApiKey ")
			}
		}

		if apiKey != "" {
			m.RequireAPIKey()(c)
			return
		}

		// Fall back to JWT
		m.RequireAuth()(c)
	}
}

// RequireRole validates that user has one of the required roles
func (m *Middleware) RequireRole(roles ...string) gin.HandlerFunc {
	roleSet := make(map[string]bool)
	for _, role := range roles {
		roleSet[role] = true
	}

	return func(c *gin.Context) {
		role := c.GetString("role")

		// Admin role has access to everything
		if role == string(RoleAdmin) {
			c.Next()
			return
		}

		if !roleSet[role] {
			response.Forbidden(c, "Insufficient role permissions")
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAdmin validates that user has admin role
func (m *Middleware) RequireAdmin() gin.HandlerFunc {
	return m.RequireRole(string(RoleAdmin))
}

// RequireOperator validates that user has operator or admin role
func (m *Middleware) RequireOperator() gin.HandlerFunc {
	return m.RequireRole(string(RoleAdmin), string(RoleOperator))
}

// RequirePermission validates that user has specific permission
func (m *Middleware) RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Admin role bypasses permission checks
		if c.GetString("role") == string(RoleAdmin) {
			c.Next()
			return
		}

		// Check user's effective permissions (includes role permissions)
		if m.checkPermission(c, permission) {
			c.Next()
			return
		}

		response.Forbidden(c, "Permission denied: "+permission)
		c.Abort()
	}
}

// checkPermission checks if user has a specific permission
func (m *Middleware) checkPermission(c *gin.Context, permission string) bool {
	// First check user's direct permissions
	permissions, exists := c.Get("permissions")
	if exists {
		permList := m.extractPermissions(permissions)
		if m.hasPermission(permList, permission) {
			return true
		}
	}

	// Then check role-based permissions
	roleName := c.GetString("role")
	if roleName != "" {
		var role Role
		if err := m.svc.db.First(&role, "name = ?", roleName).Error; err == nil {
			if m.hasPermission(role.Permissions, permission) {
				return true
			}
		}
	}

	return false
}

// extractPermissions extracts permission list from interface{}
func (m *Middleware) extractPermissions(permissions interface{}) []string {
	switch p := permissions.(type) {
	case []string:
		return p
	case StringArray:
		return []string(p)
	default:
		return nil
	}
}

// hasPermission checks if permission exists in the list (supports wildcards)
func (m *Middleware) hasPermission(permList []string, permission string) bool {
	for _, p := range permList {
		// Exact match or wildcard
		if p == permission || p == "*" {
			return true
		}

		// Support category wildcards like "docker:*"
		if strings.HasSuffix(p, ":*") {
			prefix := strings.TrimSuffix(p, "*")
			if strings.HasPrefix(permission, prefix) {
				return true
			}
		}
	}
	return false
}

// RequireAnyPermission validates that user has at least one of the specified permissions
func (m *Middleware) RequireAnyPermission(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Admin role bypasses permission checks
		if c.GetString("role") == string(RoleAdmin) {
			c.Next()
			return
		}

		for _, required := range permissions {
			if m.checkPermission(c, required) {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "Insufficient permissions")
		c.Abort()
	}
}

// RequireAllPermissions validates that user has all of the specified permissions
func (m *Middleware) RequireAllPermissions(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Admin role bypasses permission checks
		if c.GetString("role") == string(RoleAdmin) {
			c.Next()
			return
		}

		for _, required := range permissions {
			if !m.checkPermission(c, required) {
				response.Forbidden(c, "Missing permission: "+required)
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// RateLimit applies rate limiting to requests
func (m *Middleware) RateLimit(requests int, window time.Duration) gin.HandlerFunc {
	limiter := NewRateLimiter(requests, window)

	return func(c *gin.Context) {
		// Use user ID if authenticated, otherwise use IP
		key := c.ClientIP()
		if userID := c.GetString("user_id"); userID != "" {
			key = "user:" + userID
		}

		if !limiter.Allow(key) {
			c.Header("Retry-After", "60")
			response.Error(c, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.")
			c.Abort()
			return
		}

		c.Next()
	}
}

// IPWhitelist only allows requests from specified IPs
func (m *Middleware) IPWhitelist(allowedIPs []string) gin.HandlerFunc {
	ipSet := make(map[string]bool)
	for _, ip := range allowedIPs {
		ipSet[ip] = true
	}

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		if !ipSet[clientIP] {
			response.Forbidden(c, "IP not allowed")
			c.Abort()
			return
		}

		c.Next()
	}
}

// IPBlacklist blocks requests from blacklisted IPs in database
func (m *Middleware) IPBlacklist() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		if m.svc.isIPBlacklisted(clientIP) {
			response.Forbidden(c, "IP address is blocked")
			c.Abort()
			return
		}

		c.Next()
	}
}

// AuditLog logs all requests for auditing
func (m *Middleware) AuditLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		// Only log authenticated requests
		userID := c.GetString("user_id")
		if userID == "" {
			return
		}

		duration := time.Since(start).Milliseconds()

		m.svc.RecordAudit(AuditLog{
			UserID:   userID,
			Username: c.GetString("username"),
			Action:   c.Request.Method + " " + c.FullPath(),
			Resource: "api",
			Details: JSON{
				"path":        c.Request.URL.Path,
				"method":      c.Request.Method,
				"status_code": c.Writer.Status(),
				"query":       c.Request.URL.RawQuery,
			},
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			Status:    getAuditStatus(c.Writer.Status()),
			Duration:  duration,
			RequestID: c.GetString("request_id"),
		})
	}
}

// RequestID adds a unique request ID to each request
func (m *Middleware) RequestID() gin.HandlerFunc {
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

// SecurityHeaders adds security headers to responses
func (m *Middleware) SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		// Only add HSTS in production with TLS
		// c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		c.Next()
	}
}

// Helper functions

func extractToken(c *gin.Context) string {
	// Check Authorization header
	auth := c.GetHeader("Authorization")
	if auth != "" {
		if strings.HasPrefix(auth, "Bearer ") {
			return strings.TrimPrefix(auth, "Bearer ")
		}
		// Support just the token without Bearer prefix
		if len(auth) > 20 {
			return auth
		}
	}

	// Check query parameter (for WebSocket connections)
	if token := c.Query("token"); token != "" {
		return token
	}

	// Check cookie
	if token, err := c.Cookie("access_token"); err == nil && token != "" {
		return token
	}

	return ""
}

func getAuditStatus(statusCode int) string {
	if statusCode >= 200 && statusCode < 300 {
		return string(AuditStatusSuccess)
	}
	if statusCode >= 400 && statusCode < 500 {
		return string(AuditStatusWarning)
	}
	return string(AuditStatusFailure)
}

func generateRequestID() string {
	token, _ := GenerateSecureToken(16)
	return token[:32]
}

// RateLimiter implements a simple token bucket rate limiter
type RateLimiter struct {
	mu      sync.Mutex
	tokens  map[string]*tokenBucket
	maxReqs int
	window  time.Duration
	cleanup time.Time
}

type tokenBucket struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxRequests int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		tokens:  make(map[string]*tokenBucket),
		maxReqs: maxRequests,
		window:  window,
		cleanup: time.Now(),
	}
}

// Allow checks if a request is allowed
func (r *RateLimiter) Allow(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Cleanup old entries periodically
	if time.Since(r.cleanup) > r.window*2 {
		r.cleanupOld()
		r.cleanup = time.Now()
	}

	bucket, exists := r.tokens[key]
	now := time.Now()

	if !exists || now.Sub(bucket.lastReset) >= r.window {
		r.tokens[key] = &tokenBucket{
			tokens:    r.maxReqs - 1,
			lastReset: now,
		}
		return true
	}

	if bucket.tokens <= 0 {
		return false
	}

	bucket.tokens--
	return true
}

func (r *RateLimiter) cleanupOld() {
	threshold := time.Now().Add(-r.window * 2)
	for key, bucket := range r.tokens {
		if bucket.lastReset.Before(threshold) {
			delete(r.tokens, key)
		}
	}
}

// GetRemainingTokens returns the number of remaining requests for a key
func (r *RateLimiter) GetRemainingTokens(key string) int {
	r.mu.Lock()
	defer r.mu.Unlock()

	bucket, exists := r.tokens[key]
	if !exists {
		return r.maxReqs
	}

	if time.Since(bucket.lastReset) >= r.window {
		return r.maxReqs
	}

	return bucket.tokens
}
