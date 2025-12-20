// Package auth provides authentication, authorization, and user management
// functionality for the VPanel core system.
//
// Features:
//   - JWT-based authentication with access and refresh tokens
//   - TOTP-based two-factor authentication (MFA)
//   - Role-based access control (RBAC)
//   - Permission-based access control
//   - Session management with multiple device support
//   - API key authentication for programmatic access
//   - Password policy enforcement with history checking
//   - IP blacklisting and rate limiting
//   - Comprehensive audit logging
//   - Account lockout on failed login attempts
//
// Usage:
//
//	// Initialize the auth module
//	cfg, _ := config.Load()
//	db, _ := database.New(cfg.Database)
//	log := logger.New(logger.Config{Level: "info"})
//
//	// Create auth service and handlers
//	authService := auth.NewService(db, cfg, log)
//	authHandlers := auth.NewHandlers(authService)
//	authMiddleware := auth.NewMiddleware(authService)
//
//	// Setup routes
//	router := gin.Default()
//	public := router.Group("/api/v1")
//	protected := router.Group("/api/v1")
//	protected.Use(authMiddleware.RequireAuth())
//	admin := router.Group("/api/v1/admin")
//	admin.Use(authMiddleware.RequireAuth(), authMiddleware.RequireAdmin())
//
//	authHandlers.RegisterRoutes(public, protected, admin)
package auth

import (
	"github.com/vpanel/core/internal/config"
	"github.com/vpanel/core/pkg/logger"
	"gorm.io/gorm"
)

// Module represents the auth module with all its components
type Module struct {
	Service    *Service
	Handlers   *Handlers
	Middleware *Middleware
}

// NewModule creates a new auth module with all components initialized
func NewModule(db *gorm.DB, cfg *config.Config, log *logger.Logger) *Module {
	service := NewService(db, cfg, log)
	handlers := NewHandlers(service)
	middleware := NewMiddleware(service)

	return &Module{
		Service:    service,
		Handlers:   handlers,
		Middleware: middleware,
	}
}

// DefaultRoles returns the default system roles
func DefaultRoles() []Role {
	return []Role{
		{
			BaseModel:   BaseModel{ID: "role-admin"},
			Name:        string(RoleAdmin),
			DisplayName: "Administrator",
			Description: "Full system access with all permissions",
			Permissions: StringArray{"*"},
			IsSystem:    true,
			Priority:    100,
		},
		{
			BaseModel:   BaseModel{ID: "role-operator"},
			Name:        string(RoleOperator),
			DisplayName: "Operator",
			Description: "Operational access without administrative functions",
			Permissions: StringArray{
				"sites:read", "sites:write",
				"docker:read", "docker:write",
				"files:read", "files:write",
				"database:read", "database:write",
				"monitor:read",
				"cron:read", "cron:write",
			},
			IsSystem: true,
			Priority: 50,
		},
		{
			BaseModel:   BaseModel{ID: "role-user"},
			Name:        string(RoleUser),
			DisplayName: "User",
			Description: "Standard user access",
			Permissions: StringArray{
				"sites:read",
				"files:read",
				"monitor:read",
			},
			IsSystem: true,
			Priority: 10,
		},
		{
			BaseModel:   BaseModel{ID: "role-readonly"},
			Name:        string(RoleReadOnly),
			DisplayName: "Read Only",
			Description: "View-only access",
			Permissions: StringArray{
				"sites:read",
				"docker:read",
				"files:read",
				"database:read",
				"monitor:read",
				"cron:read",
			},
			IsSystem: true,
			Priority: 5,
		},
		{
			BaseModel:   BaseModel{ID: "role-api-client"},
			Name:        string(RoleAPIClient),
			DisplayName: "API Client",
			Description: "API access only",
			Permissions: StringArray{}, // Permissions set per API key
			IsSystem:    true,
			Priority:    1,
		},
	}
}

// DefaultPermissions returns the default system permissions
func DefaultPermissions() []Permission {
	return []Permission{
		// Sites
		{Name: "sites:read", DisplayName: "View Sites", Category: "sites", IsSystem: true},
		{Name: "sites:write", DisplayName: "Manage Sites", Category: "sites", IsSystem: true},
		{Name: "sites:delete", DisplayName: "Delete Sites", Category: "sites", IsSystem: true},

		// Docker
		{Name: "docker:read", DisplayName: "View Docker", Category: "docker", IsSystem: true},
		{Name: "docker:write", DisplayName: "Manage Docker", Category: "docker", IsSystem: true},

		// Files
		{Name: "files:read", DisplayName: "View Files", Category: "files", IsSystem: true},
		{Name: "files:write", DisplayName: "Manage Files", Category: "files", IsSystem: true},
		{Name: "files:delete", DisplayName: "Delete Files", Category: "files", IsSystem: true},

		// Database
		{Name: "database:read", DisplayName: "View Databases", Category: "database", IsSystem: true},
		{Name: "database:write", DisplayName: "Manage Databases", Category: "database", IsSystem: true},

		// Monitor
		{Name: "monitor:read", DisplayName: "View Monitoring", Category: "monitor", IsSystem: true},

		// Cron
		{Name: "cron:read", DisplayName: "View Cron Jobs", Category: "cron", IsSystem: true},
		{Name: "cron:write", DisplayName: "Manage Cron Jobs", Category: "cron", IsSystem: true},

		// Firewall
		{Name: "firewall:read", DisplayName: "View Firewall", Category: "firewall", IsSystem: true},
		{Name: "firewall:write", DisplayName: "Manage Firewall", Category: "firewall", IsSystem: true},

		// Terminal
		{Name: "terminal:access", DisplayName: "Access Terminal", Category: "terminal", IsSystem: true},

		// Users (admin)
		{Name: "users:read", DisplayName: "View Users", Category: "users", IsSystem: true},
		{Name: "users:write", DisplayName: "Manage Users", Category: "users", IsSystem: true},
		{Name: "users:delete", DisplayName: "Delete Users", Category: "users", IsSystem: true},

		// Settings (admin)
		{Name: "settings:read", DisplayName: "View Settings", Category: "settings", IsSystem: true},
		{Name: "settings:write", DisplayName: "Manage Settings", Category: "settings", IsSystem: true},

		// Plugins (admin)
		{Name: "plugins:read", DisplayName: "View Plugins", Category: "plugins", IsSystem: true},
		{Name: "plugins:write", DisplayName: "Manage Plugins", Category: "plugins", IsSystem: true},

		// Audit (admin)
		{Name: "audit:read", DisplayName: "View Audit Logs", Category: "audit", IsSystem: true},
	}
}

// SeedDefaultData seeds the default roles and permissions into the database
func SeedDefaultData(db *gorm.DB) error {
	// Seed roles
	for _, role := range DefaultRoles() {
		var existing Role
		if err := db.Where("name = ?", role.Name).First(&existing).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				if err := db.Create(&role).Error; err != nil {
					return err
				}
			}
		}
	}

	// Seed permissions
	for _, perm := range DefaultPermissions() {
		var existing Permission
		if err := db.Where("name = ?", perm.Name).First(&existing).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				if err := db.Create(&perm).Error; err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// Constants for context keys
const (
	ContextKeyUserID      = "user_id"
	ContextKeyUsername    = "username"
	ContextKeyRole        = "role"
	ContextKeySessionID   = "session_id"
	ContextKeyPermissions = "permissions"
	ContextKeyUser        = "user"
	ContextKeyAPIKeyID    = "api_key_id"
	ContextKeyAuthType    = "auth_type"
	ContextKeyRequestID   = "request_id"
)

// AuthType represents the type of authentication used
type AuthType string

const (
	AuthTypeJWT    AuthType = "jwt"
	AuthTypeAPIKey AuthType = "api_key"
)
