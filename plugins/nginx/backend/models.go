package nginx

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StringArray []string

func (s StringArray) Value() (driver.Value, error) { return json.Marshal(s) }
func (s *StringArray) Scan(v interface{}) error {
	if v == nil {
		*s = []string{}
		return nil
	}
	return json.Unmarshal(v.([]byte), s)
}

type NginxInstance struct {
	ID            string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	Name          string         `gorm:"type:varchar(100);not null" json:"name"`
	Type          string         `gorm:"type:varchar(20);default:'local'" json:"type"`
	Description   string         `gorm:"type:varchar(500)" json:"description"`
	ContainerID   string         `gorm:"type:varchar(64)" json:"container_id"`
	ContainerName string         `gorm:"type:varchar(100)" json:"container_name"`
	Image         string         `gorm:"type:varchar(255)" json:"image"`
	ConfigPath    string         `gorm:"type:varchar(500)" json:"config_path"`
	SitesPath     string         `gorm:"type:varchar(500)" json:"sites_path"`
	SitesEnabled  string         `gorm:"type:varchar(500)" json:"sites_enabled"`
	LogPath       string         `gorm:"type:varchar(500)" json:"log_path"`
	Status        string         `gorm:"type:varchar(20);default:'unknown'" json:"status"`
	Version       string         `gorm:"type:varchar(50)" json:"version"`
	IsDefault     bool           `gorm:"default:false" json:"is_default"`
}

func (m *NginxInstance) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

type NginxSite struct {
	ID           string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	InstanceID   string         `gorm:"type:varchar(36);index" json:"instance_id"`
	Name         string         `gorm:"type:varchar(100);not null" json:"name"`
	Domain       string         `gorm:"type:varchar(255);not null" json:"domain"`
	Aliases      StringArray    `gorm:"type:text" json:"aliases"`
	Port         int            `gorm:"default:80" json:"port"`
	SSLEnabled   bool           `gorm:"default:false" json:"ssl_enabled"`
	SSLCertID    string         `gorm:"type:varchar(36)" json:"ssl_cert_id"`
	ProxyEnabled bool           `gorm:"default:false" json:"proxy_enabled"`
	ProxyTarget  string         `gorm:"type:varchar(500)" json:"proxy_target"`
	RootPath     string         `gorm:"type:varchar(500)" json:"root_path"`
	Config       string         `gorm:"type:text" json:"config"`
	Enabled      bool           `gorm:"default:true" json:"enabled"`
}

func (m *NginxSite) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

type SSLCertificate struct {
	ID          string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Name        string         `gorm:"type:varchar(100)" json:"name"`
	Domain      string         `gorm:"type:varchar(255);not null" json:"domain"`
	Domains     StringArray    `gorm:"type:text" json:"domains"`
	Type        string         `gorm:"type:varchar(50);default:'letsencrypt'" json:"type"`
	Status      string         `gorm:"type:varchar(20);default:'pending'" json:"status"`
	CertPath    string         `gorm:"type:varchar(500)" json:"cert_path"`
	KeyPath     string         `gorm:"type:varchar(500)" json:"key_path"`
	ExpiresAt   time.Time      `json:"expires_at"`
	AutoRenew   bool           `gorm:"default:true" json:"auto_renew"`
	LastRenewed *time.Time     `json:"last_renewed"`
}

func (m *SSLCertificate) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}
