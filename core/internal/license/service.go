package license

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vpanel/core/internal/config"
	"github.com/vpanel/core/pkg/logger"
	"gorm.io/gorm"
)

const (
	// CloudValidationURL is the URL for license validation
	CloudValidationURL = "https://vcloud.zsoft.cc/api/v1/license/validate"
	// CloudCheckInterval is how often to revalidate the license
	CloudCheckInterval = 24 * time.Hour
)

var (
	ErrLicenseNotFound  = errors.New("license not found")
	ErrLicenseInvalid   = errors.New("license is invalid")
	ErrLicenseExpired   = errors.New("license has expired")
	ErrLicenseRevoked   = errors.New("license has been revoked")
	ErrValidationFailed = errors.New("license validation failed")
	ErrAlreadyActivated = errors.New("a license is already activated")
)

// Service handles license operations
type Service struct {
	db     *gorm.DB
	config *config.Config
	log    *logger.Logger
}

// NewService creates a new license service
func NewService(db *gorm.DB, cfg *config.Config, log *logger.Logger) *Service {
	return &Service{
		db:     db,
		config: cfg,
		log:    log,
	}
}

// GetCurrentLicense returns the currently activated license
func (s *Service) GetCurrentLicense() (*License, error) {
	var license License
	if err := s.db.Where("status = ?", "active").First(&license).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrLicenseNotFound
		}
		return nil, err
	}
	return &license, nil
}

// GetLicenseInfo returns license information for API
func (s *Service) GetLicenseInfo() (*LicenseInfo, error) {
	license, err := s.GetCurrentLicense()
	if err != nil {
		if errors.Is(err, ErrLicenseNotFound) {
			// Return free tier info
			return &LicenseInfo{
				IsPro:        false,
				IsEnterprise: false,
				Plan:         "free",
				Features:     []string{},
			}, nil
		}
		return nil, err
	}

	// Check if license needs revalidation
	if license.LastCheckAt == nil || time.Since(*license.LastCheckAt) > CloudCheckInterval {
		go s.revalidateLicense(license)
	}

	info := &LicenseInfo{
		IsPro:        license.IsPro(),
		IsEnterprise: license.IsEnterprise(),
		Plan:         license.Plan,
		Email:        license.Email,
		ExpiresAt:    license.ExpiresAt,
		MaxUsers:     license.MaxUsers,
		MaxServers:   license.MaxServers,
	}

	// Parse features
	if license.Features != "" {
		var features []string
		if err := json.Unmarshal([]byte(license.Features), &features); err == nil {
			info.Features = features
		}
	}

	// Calculate days remaining
	if license.ExpiresAt != nil {
		remaining := time.Until(*license.ExpiresAt)
		if remaining > 0 {
			info.DaysRemaining = int(remaining.Hours() / 24)
		}
	} else {
		info.DaysRemaining = -1 // Unlimited
	}

	return info, nil
}

// TestLicenseKey is a special key for development/testing
const TestLicenseKey = "VPRO-TEST-2024-DEV-MODE"

// DevMode enables development mode (bypasses cloud validation for any VPRO- key)
const DevMode = true

// ActivateLicense activates a license key
func (s *Service) ActivateLicense(licenseKey string) (*LicenseInfo, error) {
	// Check if already activated
	existing, err := s.GetCurrentLicense()
	if err == nil && existing != nil && existing.IsValid() {
		return nil, ErrAlreadyActivated
	}

	var cloudResp *CloudLicenseResponse

	// Check for test license key (development only)
	isTestKey := licenseKey == TestLicenseKey || (DevMode && strings.HasPrefix(licenseKey, "VPRO-"))
	if isTestKey {
		s.log.Warn("Using development test license key", "key", licenseKey)
		cloudResp = &CloudLicenseResponse{
			Valid:       true,
			Plan:        "pro",
			Email:       "test@localhost",
			ProductName: "VPanel Pro (Test)",
			Features:    []string{"*"}, // All features
			MaxUsers:    0,             // Unlimited
			MaxServers:  0,             // Unlimited
			ExpiresAt:   nil,           // Never expires
		}
	} else {
		// Validate with cloud server
		var err error
		cloudResp, err = s.validateWithCloud(licenseKey)
		if err != nil {
			return nil, err
		}
	}

	if !cloudResp.Valid {
		return nil, fmt.Errorf("%w: %s", ErrLicenseInvalid, cloudResp.Message)
	}

	// Convert features to JSON
	featuresJSON, _ := json.Marshal(cloudResp.Features)

	now := time.Now()
	license := &License{
		ID:          uuid.New().String(),
		LicenseKey:  licenseKey,
		Email:       cloudResp.Email,
		ProductName: cloudResp.ProductName,
		Plan:        cloudResp.Plan,
		Status:      "active",
		Features:    string(featuresJSON),
		MaxUsers:    cloudResp.MaxUsers,
		MaxServers:  cloudResp.MaxServers,
		IssuedAt:    now,
		ExpiresAt:   cloudResp.ExpiresAt,
		LastCheckAt: &now,
		ActivatedAt: &now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// Ensure table exists (auto-migrate)
	if err := s.db.AutoMigrate(&License{}); err != nil {
		s.log.Error("Failed to migrate license table", "error", err)
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Deactivate any existing licenses
	s.db.Model(&License{}).Where("status = ?", "active").Update("status", "replaced")

	// Check if this license key already exists (re-activation)
	var existingLicense License
	if err := s.db.Where("license_key = ?", licenseKey).First(&existingLicense).Error; err == nil {
		// Update existing license
		existingLicense.Email = cloudResp.Email
		existingLicense.ProductName = cloudResp.ProductName
		existingLicense.Plan = cloudResp.Plan
		existingLicense.Status = "active"
		existingLicense.Features = string(featuresJSON)
		existingLicense.MaxUsers = cloudResp.MaxUsers
		existingLicense.MaxServers = cloudResp.MaxServers
		existingLicense.ExpiresAt = cloudResp.ExpiresAt
		existingLicense.LastCheckAt = &now
		existingLicense.UpdatedAt = now
		if existingLicense.ActivatedAt == nil {
			existingLicense.ActivatedAt = &now
		}

		if err := s.db.Save(&existingLicense).Error; err != nil {
			s.log.Error("Failed to update license", "error", err)
			return nil, fmt.Errorf("failed to update license: %w", err)
		}
		s.log.Info("License re-activated", "plan", existingLicense.Plan, "email", existingLicense.Email)
		return s.GetLicenseInfo()
	}

	// Save new license
	if err := s.db.Create(license).Error; err != nil {
		s.log.Error("Failed to save license", "error", err)
		return nil, fmt.Errorf("failed to save license: %w", err)
	}

	s.log.Info("License activated", "plan", license.Plan, "email", license.Email)

	return s.GetLicenseInfo()
}

// DeactivateLicense deactivates the current license
func (s *Service) DeactivateLicense() error {
	license, err := s.GetCurrentLicense()
	if err != nil {
		return err
	}

	license.Status = "deactivated"
	license.UpdatedAt = time.Now()

	if err := s.db.Save(license).Error; err != nil {
		return err
	}

	s.log.Info("License deactivated", "plan", license.Plan)
	return nil
}

// IsPro returns whether Pro features are available
func (s *Service) IsPro() bool {
	license, err := s.GetCurrentLicense()
	if err != nil {
		return false
	}
	return license.IsPro()
}

// IsEnterprise returns whether Enterprise features are available
func (s *Service) IsEnterprise() bool {
	license, err := s.GetCurrentLicense()
	if err != nil {
		return false
	}
	return license.IsEnterprise()
}

// HasFeature checks if a specific feature is enabled
func (s *Service) HasFeature(feature string) bool {
	license, err := s.GetCurrentLicense()
	if err != nil {
		return false
	}

	if !license.IsValid() {
		return false
	}

	var features []string
	if err := json.Unmarshal([]byte(license.Features), &features); err != nil {
		return false
	}

	for _, f := range features {
		if f == feature || f == "*" {
			return true
		}
	}

	return false
}

// validateWithCloud validates the license with vcloud.zsoft.cc
func (s *Service) validateWithCloud(licenseKey string) (*CloudLicenseResponse, error) {
	reqBody, _ := json.Marshal(map[string]string{
		"license_key": licenseKey,
		"product":     "vpanel",
	})

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(CloudValidationURL, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		s.log.Error("Failed to connect to license server", "error", err)
		return nil, fmt.Errorf("%w: could not connect to license server", ErrValidationFailed)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: server returned status %d", ErrValidationFailed, resp.StatusCode)
	}

	var cloudResp CloudLicenseResponse
	if err := json.NewDecoder(resp.Body).Decode(&cloudResp); err != nil {
		return nil, fmt.Errorf("%w: invalid response from server", ErrValidationFailed)
	}

	return &cloudResp, nil
}

// revalidateLicense revalidates the license with the cloud server
func (s *Service) revalidateLicense(license *License) {
	cloudResp, err := s.validateWithCloud(license.LicenseKey)
	if err != nil {
		s.log.Warn("Failed to revalidate license", "error", err)
		return
	}

	now := time.Now()
	license.LastCheckAt = &now

	if !cloudResp.Valid {
		license.Status = "revoked"
		s.log.Warn("License has been revoked", "email", license.Email)
	} else {
		license.Status = "active"
		license.ExpiresAt = cloudResp.ExpiresAt
		license.Plan = cloudResp.Plan

		featuresJSON, _ := json.Marshal(cloudResp.Features)
		license.Features = string(featuresJSON)
	}

	license.UpdatedAt = now
	s.db.Save(license)
}

// RefreshLicense forces a license revalidation
func (s *Service) RefreshLicense() (*LicenseInfo, error) {
	license, err := s.GetCurrentLicense()
	if err != nil {
		return nil, err
	}

	cloudResp, err := s.validateWithCloud(license.LicenseKey)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	license.LastCheckAt = &now

	if !cloudResp.Valid {
		license.Status = "revoked"
		license.UpdatedAt = now
		s.db.Save(license)
		return nil, ErrLicenseRevoked
	}

	license.Status = "active"
	license.ExpiresAt = cloudResp.ExpiresAt
	license.Plan = cloudResp.Plan

	featuresJSON, _ := json.Marshal(cloudResp.Features)
	license.Features = string(featuresJSON)
	license.UpdatedAt = now

	if err := s.db.Save(license).Error; err != nil {
		return nil, err
	}

	return s.GetLicenseInfo()
}
