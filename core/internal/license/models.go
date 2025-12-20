package license

import (
	"time"
)

// License represents a Pro license
type License struct {
	ID          string     `gorm:"primaryKey;type:varchar(36)" json:"id"`
	LicenseKey  string     `gorm:"type:varchar(255);uniqueIndex" json:"license_key"`
	Email       string     `gorm:"type:varchar(255)" json:"email"`
	ProductName string     `gorm:"type:varchar(100)" json:"product_name"`
	Plan        string     `gorm:"type:varchar(50)" json:"plan"`   // pro, enterprise
	Status      string     `gorm:"type:varchar(20)" json:"status"` // active, expired, revoked
	Features    string     `gorm:"type:text" json:"features"`      // JSON array of enabled features
	MaxUsers    int        `gorm:"default:0" json:"max_users"`     // 0 = unlimited
	MaxServers  int        `gorm:"default:0" json:"max_servers"`   // 0 = unlimited
	IssuedAt    time.Time  `json:"issued_at"`
	ExpiresAt   *time.Time `json:"expires_at"`
	LastCheckAt *time.Time `json:"last_check_at"`
	ActivatedAt *time.Time `json:"activated_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// TableName returns the table name for License
func (License) TableName() string {
	return "licenses"
}

// IsValid checks if the license is currently valid
func (l *License) IsValid() bool {
	if l.Status != "active" {
		return false
	}
	if l.ExpiresAt != nil && l.ExpiresAt.Before(time.Now()) {
		return false
	}
	return true
}

// IsPro checks if this is a Pro license
func (l *License) IsPro() bool {
	return l.IsValid() && (l.Plan == "pro" || l.Plan == "enterprise")
}

// IsEnterprise checks if this is an Enterprise license
func (l *License) IsEnterprise() bool {
	return l.IsValid() && l.Plan == "enterprise"
}

// LicenseInfo represents license information for API response
type LicenseInfo struct {
	IsPro         bool       `json:"is_pro"`
	IsEnterprise  bool       `json:"is_enterprise"`
	Plan          string     `json:"plan"`
	Email         string     `json:"email,omitempty"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	Features      []string   `json:"features"`
	DaysRemaining int        `json:"days_remaining"`
	MaxUsers      int        `json:"max_users"`
	MaxServers    int        `json:"max_servers"`
}

// ActivateLicenseRequest represents license activation request
type ActivateLicenseRequest struct {
	LicenseKey string `json:"license_key" binding:"required"v`
}

// CloudLicenseResponse represents response from vcloud.zsoft.cc
type CloudLicenseResponse struct {
	Valid       bool       `json:"valid"`
	Plan        string     `json:"plan"`
	Email       string     `json:"email"`
	ProductName string     `json:"product_name"`
	Features    []string   `json:"features"`
	MaxUsers    int        `json:"max_users"`
	MaxServers  int        `json:"max_servers"`
	ExpiresAt   *time.Time `json:"expires_at"`
	Message     string     `json:"message,omitempty"`
}
