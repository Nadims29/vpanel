package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vpanel/core/internal/auth"
	"github.com/vpanel/core/internal/config"
	"github.com/vpanel/core/internal/database"
	"github.com/vpanel/core/internal/license"
	"github.com/vpanel/core/internal/middleware"
	"github.com/vpanel/core/internal/plugin"
	"github.com/vpanel/core/internal/update"
	"github.com/vpanel/core/pkg/logger"

	// Import builtin plugins
	"github.com/vpanel/plugins"
)

// Version information (set via ldflags)
var (
	Version   = "dev"
	BuildTime = "unknown"
	GitCommit = "unknown"
)

func main() {
	// Parse command line arguments
	var configPath string
	args := os.Args[1:]

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "version", "--version", "-v":
			fmt.Printf("VPanel Server v%s\n", Version)
			fmt.Printf("Build Time: %s\n", BuildTime)
			fmt.Printf("Git Commit: %s\n", GitCommit)
			os.Exit(0)
		case "--help", "-h":
			printHelp()
			os.Exit(0)
		case "-c", "--config":
			if i+1 < len(args) {
				configPath = args[i+1]
				i++
			}
		}
	}

	// Initialize logger
	log := logger.New(logger.Config{
		Level:      "info",
		Format:     "json",
		OutputPath: "logs/vpanel.log",
	})
	defer func() { _ = log.Sync() }()

	log.Info("Starting VPanel Server", "version", Version, "build_time", BuildTime)

	// Load configuration
	cfg, err := config.LoadWithPath(configPath)
	if err != nil {
		log.Fatal("Failed to load configuration", "error", err)
	}

	// Initialize database
	db, err := database.New(cfg.Database)
	if err != nil {
		log.Fatal("Failed to connect to database", "error", err)
	}

	// Auto migrate core models
	if err := database.AutoMigrate(db); err != nil {
		log.Fatal("Failed to migrate database", "error", err)
	}

	// Seed default data
	if err := database.Seed(db); err != nil {
		log.Fatal("Failed to seed database", "error", err)
	}

	// Initialize auth service
	authService := auth.NewService(db, cfg, log)
	authHandlers := auth.NewHandlers(authService)

	// Initialize license service
	licenseService := license.NewService(db, cfg, log)
	licenseHandlers := license.NewHandlers(licenseService)

	// Initialize update service
	updateService := update.NewService(log, Version, BuildTime, GitCommit, cfg.Plugin.MarketURL, cfg.Storage.DataDir)
	updateHandlers := update.NewHandlers(updateService)

	// Initialize plugin manager
	pm := plugin.NewManager(
		plugin.Config{DataDir: cfg.Plugin.DataDirectory},
		log,
		db,
		nil, // API client will be set up later
	)

	// Register all builtin plugins
	for _, p := range plugins.BuiltinPlugins() {
		if err := pm.Register(p); err != nil {
			log.Warn("Failed to register plugin", "plugin", p.ID(), "error", err)
		}
	}

	// Initialize all plugins
	if err := pm.InitAll(); err != nil {
		log.Warn("Some plugins failed to initialize", "error", err)
	}

	// Start all plugins
	if err := pm.StartAll(); err != nil {
		log.Warn("Some plugins failed to start", "error", err)
	}

	// Setup Gin
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	// Disable trailing slash redirect to prevent redirect loops
	router.RedirectTrailingSlash = false
	router.RedirectFixedPath = false
	router.Use(gin.Recovery())
	router.Use(middleware.Logger(log))
	router.Use(middleware.CORS(cfg.Server.CORS))
	router.Use(middleware.RateLimit(cfg.Server.RateLimit))

	// Initialize plugin handlers
	pluginHandlers := plugin.NewHandlers(pm)

	// Setup routes
	setupRoutes(router, authHandlers, authService, licenseHandlers, updateHandlers, pm, pluginHandlers)

	// Serve static files
	setupStatic(router, cfg.Server.WebDir)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server
	go func() {
		log.Info("Server starting", "port", cfg.Server.Port, "mode", cfg.Server.Mode)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Failed to start server", "error", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Stop plugins
	pm.StopAll()

	// Shutdown server
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("Server forced to shutdown", "error", err)
	}

	log.Info("Server exited")
}

func setupRoutes(
	r *gin.Engine,
	authHandlers *auth.Handlers,
	authService *auth.Service,
	licenseHandlers *license.Handlers,
	updateHandlers *update.Handlers,
	pm *plugin.Manager,
	pluginHandlers *plugin.Handlers,
) {
	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"status":  "healthy",
			"version": Version,
		})
	})

	r.GET("/api/version", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success":    true,
			"version":    Version,
			"build_time": BuildTime,
			"git_commit": GitCommit,
		})
	})

	// Public routes (no auth required)
	public := r.Group("/api")
	{
		public.POST("/auth/login", authHandlers.Login)
		public.POST("/auth/register", authHandlers.Register)
		public.POST("/auth/refresh", authHandlers.RefreshToken)
	}

	// Protected routes (auth required)
	api := r.Group("/api")
	api.Use(middleware.Auth(authService))
	{
		// Core auth routes
		api.GET("/profile", authHandlers.Profile)
		api.PUT("/profile", authHandlers.UpdateProfile)
		api.POST("/auth/logout", authHandlers.Logout)
		api.POST("/auth/password", authHandlers.ChangePassword)

		// User permissions (for frontend permission checks)
		api.GET("/profile/permissions", authHandlers.GetMyPermissions)

		// System settings routes
		api.GET("/settings", authHandlers.GetSystemSettings)
		api.PUT("/settings", authHandlers.UpdateSystemSettings)

		// License routes
		api.GET("/license", licenseHandlers.GetLicenseInfo)
		api.POST("/license/activate", licenseHandlers.ActivateLicense)
		api.POST("/license/deactivate", licenseHandlers.DeactivateLicense)
		api.POST("/license/refresh", licenseHandlers.RefreshLicense)

		// Plugin management routes
		pluginHandlers.RegisterRoutes(api)

		// Update management routes
		updateHandlers.RegisterRoutes(api)

		// Register all plugin API routes
		pm.RegisterRoutes(api)
	}

	// Admin routes (auth + admin role required)
	admin := r.Group("/api/admin")
	admin.Use(middleware.Auth(authService))
	admin.Use(middleware.RequireRole("admin", "super_admin"))
	{
		// User management
		admin.GET("/users", authHandlers.AdminListUsers)
		admin.POST("/users", authHandlers.AdminCreateUser)
		admin.PUT("/users/:id/password", authHandlers.AdminResetUserPassword)
		admin.POST("/users/:id/mfa/enable", authHandlers.AdminEnableUserMFA)
		admin.POST("/users/:id/mfa/disable", authHandlers.AdminDisableUserMFA)
		admin.POST("/users/:id/mfa/reset", authHandlers.AdminResetUserMFA)
		admin.PUT("/users/:id/role", authHandlers.AdminAssignUserRole)
		admin.GET("/users/:id", authHandlers.AdminGetUser)
		admin.PUT("/users/:id", authHandlers.AdminUpdateUser)
		admin.DELETE("/users/:id", authHandlers.AdminDeleteUser)

		// Role management
		admin.GET("/roles", authHandlers.AdminListRoles)
		admin.POST("/roles", authHandlers.AdminCreateRole)
		admin.GET("/roles/:id", authHandlers.AdminGetRole)
		admin.PUT("/roles/:id", authHandlers.AdminUpdateRole)
		admin.DELETE("/roles/:id", authHandlers.AdminDeleteRole)
		admin.GET("/roles/:id/users", authHandlers.AdminGetRoleUsers)

		// Permission management
		admin.GET("/permissions", authHandlers.AdminListPermissions)

		// Audit logs
		admin.GET("/audit-logs", authHandlers.AdminGetAuditLogs)
		admin.GET("/audit-logs/stats", authHandlers.AdminGetAuditStats)
		admin.GET("/audit-logs/actions", authHandlers.AdminGetAuditActions)
		admin.GET("/audit-logs/resources", authHandlers.AdminGetAuditResources)
	}
}

func setupStatic(r *gin.Engine, webDir string) {
	paths := []string{
		webDir,
		"/var/lib/vpanel/web",
		"./web/dist",
		"../web/dist",
	}

	for _, p := range paths {
		if _, err := os.Stat(p + "/index.html"); err == nil {
			r.Static("/assets", p+"/assets")
			r.StaticFile("/favicon.ico", p+"/favicon.ico")
			r.NoRoute(func(c *gin.Context) {
				c.File(p + "/index.html")
			})
			return
		}
	}

	// Fallback
	r.NoRoute(func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html", []byte(embeddedHTML))
	})
}

func printHelp() {
	fmt.Println(`VPanel Server - Plugin-based Server Management

Usage:
  vpanel-server [options] [command]

Commands:
  (none)           Start the server
  version          Show version information

Options:
  -c, --config     Path to config file (default: config.yaml)
  -h, --help       Show this help message

Environment Variables:
  VPANEL_CONFIG    Path to config file
  VPANEL_PORT      Server port (default: 8080)
  VPANEL_MODE      Server mode: debug, release`)
}

const embeddedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPanel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
            color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { text-align: center; padding: 2rem; }
        h1 {
            font-size: 4rem;
            margin-bottom: 1rem;
            background: linear-gradient(90deg, #06b6d4, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        p { color: #94a3b8; font-size: 1.2rem; }
        .status {
            background: rgba(6, 182, 212, 0.1);
            border: 1px solid rgba(6, 182, 212, 0.3);
            border-radius: 16px;
            padding: 2rem;
            margin-top: 2rem;
        }
        .badge {
            display: inline-block;
            background: linear-gradient(90deg, #06b6d4, #8b5cf6);
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="badge">Server Running</div>
        <h1>VPanel</h1>
        <p>Plugin-based Server Management Platform</p>
        <div class="status">
            <h3>API Available</h3>
            <p>Frontend assets not found. API is accessible at /api</p>
        </div>
    </div>
</body>
</html>`
