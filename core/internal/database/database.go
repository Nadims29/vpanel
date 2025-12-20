package database

import (
	"github.com/vpanel/core/internal/auth"
	"github.com/vpanel/core/internal/config"
	"github.com/vpanel/core/internal/license"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// New creates a new database connection
func New(cfg config.DatabaseConfig) (*gorm.DB, error) {
	var dialector gorm.Dialector

	switch cfg.Driver {
	case "postgres":
		dialector = postgres.Open(cfg.DSN())
	case "sqlite":
		dialector = sqlite.Open(cfg.Database)
	default:
		dialector = sqlite.Open(cfg.Database)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}

	return db, nil
}

// AutoMigrate runs automatic migrations for core models
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&auth.User{},
		&auth.Session{},
		&auth.APIKey{},
		&auth.LoginAttempt{},
		&auth.AuditLog{},
		&auth.SystemSetting{},
		&auth.Role{},
		&auth.Permission{},
		&auth.PasswordResetRequest{},
		&auth.IPBlacklist{},
		&license.License{},
	)
}

// Seed seeds default data
func Seed(db *gorm.DB) error {
	// Seed default roles and permissions
	if err := auth.SeedDefaultData(db); err != nil {
		return err
	}

	// Create default admin user if not exists
	var count int64
	db.Model(&auth.User{}).Count(&count)
	if count == 0 {
		hashedPassword, err := auth.HashPassword("admin123")
		if err != nil {
			return err
		}

		admin := &auth.User{
			Username:    "admin",
			Email:       "admin@localhost",
			Password:    hashedPassword,
			DisplayName: "Administrator",
			Role:        "admin",
			Status:      "active",
			Permissions: auth.StringArray{"*"}, // Admin has all permissions
		}

		if err := db.Create(admin).Error; err != nil {
			return err
		}
	}

	return nil
}
