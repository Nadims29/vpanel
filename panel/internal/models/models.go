package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BaseModel contains common columns for all models
type BaseModel struct {
	ID        string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates UUID before creating record
func (m *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// JSON type for storing JSON data
type JSON map[string]interface{}

func (j JSON) Value() (driver.Value, error) {
	return json.Marshal(j)
}

func (j *JSON) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSON)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// StringArray type for storing string arrays
type StringArray []string

func (s StringArray) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *StringArray) Scan(value interface{}) error {
	if value == nil {
		*s = []string{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, s)
}

// ===============================
// User & Authentication Models
// ===============================

// User represents a system user
type User struct {
	BaseModel
	Username    string      `gorm:"uniqueIndex;type:varchar(100);not null" json:"username"`
	Email       string      `gorm:"uniqueIndex;type:varchar(255);not null" json:"email"`
	Password    string      `gorm:"type:varchar(255);not null" json:"-"`
	DisplayName string      `gorm:"type:varchar(100)" json:"display_name"`
	Avatar      string      `gorm:"type:varchar(500)" json:"avatar"`
	Role        string      `gorm:"type:varchar(50);default:'user'" json:"role"` // admin, user, viewer
	Status      string      `gorm:"type:varchar(20);default:'active'" json:"status"` // active, inactive, locked
	MFAEnabled  bool        `gorm:"default:false" json:"mfa_enabled"`
	MFASecret   string      `gorm:"type:varchar(100)" json:"-"`
	LastLoginAt *time.Time  `json:"last_login_at"`
	LastLoginIP string      `gorm:"type:varchar(45)" json:"last_login_ip"`
	Permissions StringArray `gorm:"type:text" json:"permissions"`
	Preferences JSON        `gorm:"type:text" json:"preferences"`
}

// Session represents a user session
type Session struct {
	BaseModel
	UserID       string    `gorm:"type:varchar(36);index;not null" json:"user_id"`
	Token        string    `gorm:"type:varchar(500);uniqueIndex;not null" json:"-"`
	RefreshToken string    `gorm:"type:varchar(500);uniqueIndex;not null" json:"-"`
	IPAddress    string    `gorm:"type:varchar(45)" json:"ip_address"`
	UserAgent    string    `gorm:"type:varchar(500)" json:"user_agent"`
	ExpiresAt    time.Time `json:"expires_at"`
	User         User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// OAuthConnection represents an OAuth provider connection
type OAuthConnection struct {
	BaseModel
	UserID       string `gorm:"type:varchar(36);index;not null" json:"user_id"`
	Provider     string `gorm:"type:varchar(50);not null" json:"provider"` // github, google
	ProviderID   string `gorm:"type:varchar(255);not null" json:"provider_id"`
	AccessToken  string `gorm:"type:text" json:"-"`
	RefreshToken string `gorm:"type:text" json:"-"`
	ExpiresAt    *time.Time `json:"expires_at"`
	User         User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// LoginAttempt records login attempts
type LoginAttempt struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"type:varchar(100);index" json:"username"`
	IPAddress string    `gorm:"type:varchar(45);index" json:"ip_address"`
	Success   bool      `json:"success"`
	Reason    string    `gorm:"type:varchar(255)" json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

// ===============================
// Node & Agent Models (Community Edition - Simplified)
// Full multi-node management is available in VPanel Cloud (Enterprise Edition)
// ===============================

// Note: Multi-node management with agents is available in VPanel Cloud
// The NodeID field in other models is kept for forward compatibility
// but is empty ("") in the community edition (single-node mode)

// ===============================
// Docker Models
// ===============================

// DockerComposeProject represents a Docker Compose project
type DockerComposeProject struct {
	BaseModel
	NodeID      string `gorm:"type:varchar(36);index" json:"node_id"`
	Name        string `gorm:"type:varchar(100);not null" json:"name"`
	Path        string `gorm:"type:varchar(500)" json:"path"`
	Content     string `gorm:"type:text" json:"content"`
	Status      string `gorm:"type:varchar(20);default:'stopped'" json:"status"` // running, stopped, partial
	Description string `gorm:"type:varchar(500)" json:"description"`
}

// ===============================
// Nginx Models
// ===============================

// NginxInstanceType represents the type of nginx instance
type NginxInstanceType string

const (
	NginxInstanceTypeLocal  NginxInstanceType = "local"  // Local system nginx
	NginxInstanceTypeDocker NginxInstanceType = "docker" // Docker container nginx
)

// NginxInstance represents an Nginx instance (local or Docker container)
type NginxInstance struct {
	BaseModel
	NodeID        string            `gorm:"type:varchar(36);index" json:"node_id"`
	Name          string            `gorm:"type:varchar(100);not null" json:"name"`
	Type          NginxInstanceType `gorm:"type:varchar(20);not null;default:'local'" json:"type"`
	Description   string            `gorm:"type:varchar(500)" json:"description"`
	
	// Docker specific fields
	ContainerID   string `gorm:"type:varchar(64)" json:"container_id"`
	ContainerName string `gorm:"type:varchar(100)" json:"container_name"`
	Image         string `gorm:"type:varchar(255)" json:"image"`
	
	// Paths for configuration
	ConfigPath    string `gorm:"type:varchar(500)" json:"config_path"`       // /etc/nginx or container mount path
	SitesPath     string `gorm:"type:varchar(500)" json:"sites_path"`        // sites-available path
	SitesEnabled  string `gorm:"type:varchar(500)" json:"sites_enabled"`     // sites-enabled path
	LogPath       string `gorm:"type:varchar(500)" json:"log_path"`          // /var/log/nginx
	
	// Status
	Status        string `gorm:"type:varchar(20);default:'unknown'" json:"status"` // running, stopped, error
	Version       string `gorm:"type:varchar(50)" json:"version"`
	IsDefault     bool   `gorm:"default:false" json:"is_default"`
	
	// Runtime info
	PID           int    `gorm:"default:0" json:"pid"`
	Uptime        string `gorm:"-" json:"uptime,omitempty"`
}

// NginxSite represents an Nginx site configuration
type NginxSite struct {
	BaseModel
	NodeID       string `gorm:"type:varchar(36);index" json:"node_id"`
	InstanceID   string `gorm:"type:varchar(36);index" json:"instance_id"` // Reference to NginxInstance
	Name         string `gorm:"type:varchar(100);not null" json:"name"`
	Domain       string `gorm:"type:varchar(255);not null" json:"domain"`
	Aliases      StringArray `gorm:"type:text" json:"aliases"`
	Port         int    `gorm:"default:80" json:"port"`
	SSLEnabled   bool   `gorm:"default:false" json:"ssl_enabled"`
	SSLCertID    string `gorm:"type:varchar(36)" json:"ssl_cert_id"`
	ProxyEnabled bool   `gorm:"default:false" json:"proxy_enabled"`
	ProxyTarget  string `gorm:"type:varchar(500)" json:"proxy_target"`
	RootPath     string `gorm:"type:varchar(500)" json:"root_path"`
	PHPEnabled   bool   `gorm:"default:false" json:"php_enabled"`
	PHPVersion   string `gorm:"type:varchar(20)" json:"php_version"`
	Config       string `gorm:"type:text" json:"config"`
	Enabled      bool   `gorm:"default:true" json:"enabled"`
	
	// Relations
	Instance     *NginxInstance `gorm:"foreignKey:InstanceID" json:"instance,omitempty"`
}

// SSLCertificate represents an SSL certificate
type SSLCertificate struct {
	BaseModel
	NodeID      string    `gorm:"type:varchar(36);index" json:"node_id"`
	Domain      string    `gorm:"type:varchar(255);not null" json:"domain"`
	Type        string    `gorm:"type:varchar(50)" json:"type"` // letsencrypt, custom
	CertPath    string    `gorm:"type:varchar(500)" json:"cert_path"`
	KeyPath     string    `gorm:"type:varchar(500)" json:"key_path"`
	ChainPath   string    `gorm:"type:varchar(500)" json:"chain_path"`
	ExpiresAt   time.Time `json:"expires_at"`
	AutoRenew   bool      `gorm:"default:true" json:"auto_renew"`
	LastRenewed *time.Time `json:"last_renewed"`
}

// ===============================
// Database Models
// ===============================

// DatabaseServer represents a database server connection
type DatabaseServer struct {
	BaseModel
	NodeID      string `gorm:"type:varchar(36);index" json:"node_id"`
	Name        string `gorm:"type:varchar(100);not null" json:"name"`
	Type        string `gorm:"type:varchar(50);not null" json:"type"` // mysql, postgres, redis, mongodb, mariadb
	Host        string `gorm:"type:varchar(255)" json:"host"`
	Port        int    `json:"port"`
	Username    string `gorm:"type:varchar(100)" json:"username"`
	Password    string `gorm:"type:varchar(255)" json:"-"`
	Status      string `gorm:"type:varchar(20);default:'unknown'" json:"status"` // online, offline, error
	ContainerID string `gorm:"type:varchar(64)" json:"container_id"`             // Docker container ID if local
	IsLocal     bool   `gorm:"default:false" json:"is_local"`                    // Whether this is a locally managed server
}

// DatabaseBackup represents a database backup
type DatabaseBackup struct {
	BaseModel
	ServerID    string    `gorm:"type:varchar(36);index;not null" json:"server_id"`
	Database    string    `gorm:"type:varchar(100)" json:"database"`
	FileName    string    `gorm:"type:varchar(255)" json:"file_name"`
	FilePath    string    `gorm:"type:varchar(500)" json:"file_path"`
	FileSize    int64     `json:"file_size"`
	Type        string    `gorm:"type:varchar(20)" json:"type"` // manual, scheduled
	Status      string    `gorm:"type:varchar(20)" json:"status"` // completed, failed, in_progress
	Error       string    `gorm:"type:text" json:"error"`
	CompletedAt *time.Time `json:"completed_at"`
}

// DeployTask represents a database deployment task
type DeployTask struct {
	BaseModel
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Type        string    `gorm:"type:varchar(50);not null" json:"type"`   // mysql, postgresql, etc.
	Status      string    `gorm:"type:varchar(20)" json:"status"`          // pending, running, completed, failed
	Progress    int       `json:"progress"`                                // 0-100
	CurrentStep string    `gorm:"type:varchar(100)" json:"current_step"`   // Current step description
	Steps       JSON      `gorm:"type:json" json:"steps"`                  // Array of step objects
	Error       string    `gorm:"type:text" json:"error"`
	ServerID    string    `gorm:"type:varchar(36)" json:"server_id"`       // Created server ID (when completed)
	CompletedAt *time.Time `json:"completed_at"`
}

// ===============================
// Cron Job Models
// ===============================

// CronJob represents a scheduled task
type CronJob struct {
	BaseModel
	NodeID      string     `gorm:"type:varchar(36);index" json:"node_id"`
	Name        string     `gorm:"type:varchar(100);not null" json:"name"`
	Schedule    string     `gorm:"type:varchar(100);not null" json:"schedule"` // cron expression
	Command     string     `gorm:"type:text;not null" json:"command"`
	User        string     `gorm:"type:varchar(100);default:'root'" json:"user"`
	Enabled     bool       `gorm:"default:true" json:"enabled"`
	Timeout     int        `gorm:"default:3600" json:"timeout"` // seconds
	LastRunAt   *time.Time `json:"last_run_at"`
	NextRunAt   *time.Time `json:"next_run_at"`
	LastStatus  string     `gorm:"type:varchar(20)" json:"last_status"` // success, failed, timeout
	Description string     `gorm:"type:varchar(500)" json:"description"`
}

// CronJobLog represents a cron job execution log
type CronJobLog struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	JobID     string     `gorm:"type:varchar(36);index;not null" json:"job_id"`
	StartedAt time.Time  `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at"`
	Duration  int        `json:"duration"` // milliseconds
	Status    string     `gorm:"type:varchar(20)" json:"status"` // success, failed, timeout
	Output    string     `gorm:"type:text" json:"output"`
	Error     string     `gorm:"type:text" json:"error"`
	ExitCode  int        `json:"exit_code"`
}

// ===============================
// Firewall Models
// ===============================

// FirewallRule represents a firewall rule
type FirewallRule struct {
	BaseModel
	NodeID      string `gorm:"type:varchar(36);index" json:"node_id"`
	Name        string `gorm:"type:varchar(100)" json:"name"`
	Direction   string `gorm:"type:varchar(10);not null" json:"direction"` // in, out
	Action      string `gorm:"type:varchar(10);not null" json:"action"` // allow, deny
	Protocol    string `gorm:"type:varchar(10)" json:"protocol"` // tcp, udp, icmp, all
	Port        string `gorm:"type:varchar(100)" json:"port"` // single port, range, or comma-separated
	Source      string `gorm:"type:varchar(255)" json:"source"`
	Destination string `gorm:"type:varchar(255)" json:"destination"`
	Priority    int    `gorm:"default:100" json:"priority"`
	Enabled     bool   `gorm:"default:true" json:"enabled"`
	Description string `gorm:"type:varchar(500)" json:"description"`
}

// ===============================
// Plugin Models
// ===============================

// Plugin represents an installed plugin
type Plugin struct {
	BaseModel
	PluginID    string `gorm:"type:varchar(100);uniqueIndex;not null" json:"plugin_id"`
	Name        string `gorm:"type:varchar(100);not null" json:"name"`
	Version     string `gorm:"type:varchar(50);not null" json:"version"`
	Description string `gorm:"type:varchar(500)" json:"description"`
	Author      string `gorm:"type:varchar(100)" json:"author"`
	Homepage    string `gorm:"type:varchar(255)" json:"homepage"`
	Icon        string `gorm:"type:varchar(255)" json:"icon"`
	Category    string `gorm:"type:varchar(50)" json:"category"`
	Enabled     bool   `gorm:"default:true" json:"enabled"`
	Settings    JSON   `gorm:"type:text" json:"settings"`
	Permissions StringArray `gorm:"type:text" json:"permissions"`
}

// PluginSetting represents a plugin-specific setting
type PluginSetting struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	PluginID  string    `gorm:"type:varchar(100);index;not null" json:"plugin_id"`
	Key       string    `gorm:"type:varchar(255);index;not null" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ===============================
// Software Models
// ===============================

// Software represents installed software
type Software struct {
	BaseModel
	NodeID         string `gorm:"type:varchar(36);index" json:"node_id"`
	Name           string `gorm:"type:varchar(100);not null" json:"name"`
	Version        string `gorm:"type:varchar(50)" json:"version"`
	LatestVersion  string `gorm:"type:varchar(50)" json:"latest_version"`
	Status         string `gorm:"type:varchar(20)" json:"status"` // installed, running, stopped
	ServiceName    string `gorm:"type:varchar(100)" json:"service_name"`
	Port           int    `json:"port"`
	ConfigPath     string `gorm:"type:varchar(500)" json:"config_path"`
	DataPath       string `gorm:"type:varchar(500)" json:"data_path"`
	AutoStart      bool   `gorm:"default:true" json:"auto_start"`
}

// ===============================
// Log & Audit Models
// ===============================

// AuditLog records user actions for auditing
type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"type:varchar(36);index" json:"user_id"`
	Username  string    `gorm:"type:varchar(100)" json:"username"`
	Action    string    `gorm:"type:varchar(100);index" json:"action"`
	Resource  string    `gorm:"type:varchar(100)" json:"resource"`
	ResourceID string   `gorm:"type:varchar(36)" json:"resource_id"`
	Details   JSON      `gorm:"type:text" json:"details"`
	IPAddress string    `gorm:"type:varchar(45)" json:"ip_address"`
	UserAgent string    `gorm:"type:varchar(500)" json:"user_agent"`
	Status    string    `gorm:"type:varchar(20)" json:"status"` // success, failed
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

// ===============================
// Settings Models
// ===============================

// SystemSetting represents a system setting
type SystemSetting struct {
	Key       string    `gorm:"primaryKey;type:varchar(100)" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	Type      string    `gorm:"type:varchar(20)" json:"type"` // string, int, bool, json
	Category  string    `gorm:"type:varchar(50);index" json:"category"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Notification represents a notification setting
type Notification struct {
	BaseModel
	Name     string `gorm:"type:varchar(100);not null" json:"name"`
	Type     string `gorm:"type:varchar(50);not null" json:"type"` // email, webhook, telegram, slack
	Config   JSON   `gorm:"type:text" json:"config"`
	Enabled  bool   `gorm:"default:true" json:"enabled"`
	Events   StringArray `gorm:"type:text" json:"events"` // events to notify about
}

// Alert represents an alert
type Alert struct {
	BaseModel
	NodeID     string     `gorm:"type:varchar(36);index" json:"node_id"`
	Type       string     `gorm:"type:varchar(50);not null" json:"type"` // cpu, memory, disk, service
	Severity   string     `gorm:"type:varchar(20);not null" json:"severity"` // info, warning, critical
	Title      string     `gorm:"type:varchar(255);not null" json:"title"`
	Message    string     `gorm:"type:text" json:"message"`
	Status     string     `gorm:"type:varchar(20);default:'active'" json:"status"` // active, acknowledged, resolved
	ResolvedAt *time.Time `json:"resolved_at"`
	ResolvedBy string     `gorm:"type:varchar(36)" json:"resolved_by"`
}

// ===============================
// Apps Models (GitHub Deploy)
// ===============================

// App represents a deployed application from Git repository
type App struct {
	BaseModel
	Name           string     `gorm:"type:varchar(100);not null;uniqueIndex" json:"name"`
	Description    string     `gorm:"type:varchar(500)" json:"description"`
	Status         string     `gorm:"type:varchar(20);default:'stopped'" json:"status"` // stopped, building, running, failed

	// Git configuration
	GitURL         string     `gorm:"type:varchar(500);not null" json:"git_url"`
	GitBranch      string     `gorm:"type:varchar(100);default:'main'" json:"git_branch"`
	GitToken       string     `gorm:"type:varchar(500)" json:"-"` // Private repo token (hidden in JSON)

	// Build configuration
	DockerfilePath string     `gorm:"type:varchar(255);default:'Dockerfile'" json:"dockerfile_path"`
	BuildContext   string     `gorm:"type:varchar(255);default:'.'" json:"build_context"`

	// Runtime configuration
	Port           int        `gorm:"default:3000" json:"port"`
	EnvVars        JSON       `gorm:"type:text" json:"env_vars"` // {"KEY": "value"}

	// Deployment info (reuse Docker container)
	ContainerID    string     `gorm:"type:varchar(64)" json:"container_id"`
	HostPort       int        `json:"host_port"` // Mapped host port
	ImageTag       string     `gorm:"type:varchar(255)" json:"image_tag"`
	LastDeployAt   *time.Time `json:"last_deploy_at"`

	// Domain binding (reuse Nginx Site)
	Domain         string     `gorm:"type:varchar(255)" json:"domain"`
	NginxSiteID    string     `gorm:"type:varchar(36)" json:"nginx_site_id"`
}

// AppDeployment represents a deployment record
type AppDeployment struct {
	BaseModel
	AppID      string     `gorm:"type:varchar(36);index" json:"app_id"`
	CommitHash string     `gorm:"type:varchar(40)" json:"commit_hash"`
	CommitMsg  string     `gorm:"type:varchar(500)" json:"commit_msg"`
	Status     string     `gorm:"type:varchar(20)" json:"status"` // pending, cloning, building, deploying, success, failed
	Progress   int        `json:"progress"`                       // 0-100
	Logs       string     `gorm:"type:text" json:"logs"`
	Error      string     `gorm:"type:text" json:"error"`
	Duration   int        `json:"duration"` // seconds
	FinishedAt *time.Time `json:"finished_at"`
}

