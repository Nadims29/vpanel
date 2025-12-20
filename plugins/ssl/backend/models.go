package ssl

import (
	"database/sql/driver"
	"encoding/json"
	"math"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StringArray is a custom type for storing string arrays in JSON format
type StringArray []string

func (s StringArray) Value() (driver.Value, error) { return json.Marshal(s) }
func (s *StringArray) Scan(v interface{}) error {
	if v == nil {
		*s = []string{}
		return nil
	}
	switch data := v.(type) {
	case []byte:
		return json.Unmarshal(data, s)
	case string:
		return json.Unmarshal([]byte(data), s)
	}
	return nil
}

// CertificateType represents the type of SSL certificate
type CertificateType string

const (
	CertTypeLetsEncrypt CertificateType = "letsencrypt"
	CertTypeCustom      CertificateType = "custom"
	CertTypeSelfSigned  CertificateType = "selfsigned"
	CertTypeACME        CertificateType = "acme"
)

// CertificateStatus represents the status of SSL certificate
type CertificateStatus string

const (
	CertStatusPending  CertificateStatus = "pending"
	CertStatusActive   CertificateStatus = "active"
	CertStatusExpired  CertificateStatus = "expired"
	CertStatusExpiring CertificateStatus = "expiring"
	CertStatusError    CertificateStatus = "error"
	CertStatusRevoked  CertificateStatus = "revoked"
)

// ChallengeType represents ACME challenge types
type ChallengeType string

const (
	ChallengeHTTP01   ChallengeType = "http-01"
	ChallengeDNS01    ChallengeType = "dns-01"
	ChallengeTLSALPN  ChallengeType = "tls-alpn"
)

// SSLCertificate represents an SSL certificate
type SSLCertificate struct {
	ID            string            `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	DeletedAt     gorm.DeletedAt    `gorm:"index" json:"-"`
	NodeID        string            `gorm:"type:varchar(36);index" json:"node_id,omitempty"`
	Name          string            `gorm:"type:varchar(100)" json:"name"`
	Domain        string            `gorm:"type:varchar(255);not null;index" json:"domain"`
	Domains       StringArray       `gorm:"type:text" json:"domains"`
	IsWildcard    bool              `gorm:"default:false" json:"is_wildcard"`
	Type          CertificateType   `gorm:"type:varchar(50);default:'letsencrypt'" json:"type"`
	Status        CertificateStatus `gorm:"type:varchar(20);default:'pending'" json:"status"`
	ChallengeType ChallengeType     `gorm:"type:varchar(20);default:'http-01'" json:"challenge_type"`

	// Certificate file paths
	CertPath      string `gorm:"type:varchar(500)" json:"cert_path"`
	KeyPath       string `gorm:"type:varchar(500)" json:"key_path"`
	ChainPath     string `gorm:"type:varchar(500)" json:"chain_path"`
	FullchainPath string `gorm:"type:varchar(500)" json:"fullchain_path"`

	// Certificate details
	Issuer       string `gorm:"type:varchar(255)" json:"issuer"`
	Subject      string `gorm:"type:varchar(255)" json:"subject"`
	SerialNumber string `gorm:"type:varchar(100)" json:"serial_number"`
	Fingerprint  string `gorm:"type:varchar(100)" json:"fingerprint"`
	KeyAlgorithm string `gorm:"type:varchar(50)" json:"key_algorithm"`
	KeySize      int    `gorm:"default:2048" json:"key_size"`
	IssuedAt     *time.Time `json:"issued_at,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`

	// Auto renewal
	AutoRenew      bool       `gorm:"default:true" json:"auto_renew"`
	RenewBefore    int        `gorm:"default:30" json:"renew_before"` // Days before expiry
	LastRenewed    *time.Time `json:"last_renewed,omitempty"`
	LastRenewError string     `gorm:"type:text" json:"last_renew_error,omitempty"`
	RenewCount     int        `gorm:"default:0" json:"renew_count"`

	// ACME account
	ACMEEmail string `gorm:"type:varchar(255)" json:"acme_email,omitempty"`

	// Usage tracking
	UsedBy     StringArray `gorm:"type:text" json:"used_by,omitempty"`
	UsageCount int         `gorm:"default:0" json:"usage_count"`
}

func (m *SSLCertificate) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// DaysRemaining returns the number of days until certificate expiry
func (m *SSLCertificate) DaysRemaining() int {
	if m.ExpiresAt == nil {
		return 0
	}
	days := time.Until(*m.ExpiresAt).Hours() / 24
	return int(math.Max(0, days))
}

// UpdateStatus updates the certificate status based on expiry
func (m *SSLCertificate) UpdateStatus() {
	if m.ExpiresAt == nil {
		return
	}
	
	days := m.DaysRemaining()
	if days <= 0 {
		m.Status = CertStatusExpired
	} else if days <= m.RenewBefore {
		m.Status = CertStatusExpiring
	} else if m.Status == CertStatusPending {
		// Keep pending status
	} else {
		m.Status = CertStatusActive
	}
}

// SSLStats represents SSL certificate statistics
type SSLStats struct {
	Total      int `json:"total"`
	Active     int `json:"active"`
	Expiring   int `json:"expiring"`
	Expired    int `json:"expired"`
	LetsEncrypt int `json:"letsencrypt"`
	Custom     int `json:"custom"`
	SelfSigned int `json:"self_signed"`
}

// SSLValidation represents certificate validation result
type SSLValidation struct {
	Valid         bool     `json:"valid"`
	Issues        []string `json:"issues"`
	DaysRemaining int      `json:"days_remaining"`
}

// CreateLetsEncryptRequest represents a request to create Let's Encrypt certificate
type CreateLetsEncryptRequest struct {
	Domain        string   `json:"domain" binding:"required"`
	Domains       []string `json:"domains"`
	Email         string   `json:"email"`
	ChallengeType string   `json:"challenge_type"`
	AutoRenew     *bool    `json:"auto_renew"`
	RenewBefore   int      `json:"renew_before"`
}

// CreateCustomCertRequest represents a request to upload custom certificate
type CreateCustomCertRequest struct {
	Name        string `json:"name"`
	Domain      string `json:"domain" binding:"required"`
	Certificate string `json:"certificate" binding:"required"`
	PrivateKey  string `json:"private_key" binding:"required"`
	Chain       string `json:"chain"`
}

// CreateSelfSignedRequest represents a request to create self-signed certificate
type CreateSelfSignedRequest struct {
	Domain       string   `json:"domain" binding:"required"`
	Domains      []string `json:"domains"`
	ValidDays    int      `json:"valid_days"`
	KeyType      string   `json:"key_type"`
	KeySize      int      `json:"key_size"`
	CommonName   string   `json:"common_name"`
	Organization string   `json:"organization"`
}

// UpdateCertificateRequest represents a certificate update request
type UpdateCertificateRequest struct {
	Name        *string `json:"name"`
	AutoRenew   *bool   `json:"auto_renew"`
	RenewBefore *int    `json:"renew_before"`
}

// ListCertificatesParams represents query parameters for listing certificates
type ListCertificatesParams struct {
	Status string `form:"status"`
	Type   string `form:"type"`
	Domain string `form:"domain"`
	NodeID string `form:"node_id"`
}

