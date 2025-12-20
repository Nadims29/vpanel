package auth

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
	if j == nil {
		return nil, nil
	}
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
	if s == nil {
		return nil, nil
	}
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

// UserStatus represents user account status
type UserStatus string

const (
	UserStatusActive    UserStatus = "active"
	UserStatusInactive  UserStatus = "inactive"
	UserStatusLocked    UserStatus = "locked"
	UserStatusPending   UserStatus = "pending"
	UserStatusSuspended UserStatus = "suspended"
)

// UserRole represents user role
type UserRole string

const (
	RoleAdmin     UserRole = "admin"
	RoleOperator  UserRole = "operator"
	RoleUser      UserRole = "user"
	RoleReadOnly  UserRole = "readonly"
	RoleAPIClient UserRole = "api_client"
)

// User represents a system user
type User struct {
	BaseModel
	Username            string      `gorm:"uniqueIndex;type:varchar(100);not null" json:"username"`
	Email               string      `gorm:"uniqueIndex;type:varchar(255);not null" json:"email"`
	Password            string      `gorm:"type:varchar(255);not null" json:"-"`
	DisplayName         string      `gorm:"type:varchar(100)" json:"display_name"`
	Avatar              string      `gorm:"type:varchar(500)" json:"avatar"`
	Role                string      `gorm:"type:varchar(50);default:'user'" json:"role"`
	Status              string      `gorm:"type:varchar(20);default:'active'" json:"status"`
	MFAEnabled          bool        `gorm:"default:false" json:"mfa_enabled"`
	MFASecret           string      `gorm:"type:varchar(100)" json:"-"`
	MFARecoveryCodes    StringArray `gorm:"type:text" json:"-"`
	LastLoginAt         *time.Time  `json:"last_login_at"`
	LastLoginIP         string      `gorm:"type:varchar(45)" json:"last_login_ip"`
	LastPasswordChange  *time.Time  `json:"last_password_change"`
	PasswordExpiresAt   *time.Time  `json:"password_expires_at"`
	FailedLoginAttempts int         `gorm:"default:0" json:"-"`
	LockedUntil         *time.Time  `json:"-"`
	Permissions         StringArray `gorm:"type:text" json:"permissions"`
	Preferences         JSON        `gorm:"type:text" json:"preferences"`
	Metadata            JSON        `gorm:"type:text" json:"metadata,omitempty"`
	PasswordHistory     StringArray `gorm:"type:text" json:"-"`
	Sessions            []Session   `gorm:"foreignKey:UserID" json:"-"`
	APIKeys             []APIKey    `gorm:"foreignKey:UserID" json:"-"`
	EmailVerified       bool        `gorm:"default:false" json:"email_verified"`
	EmailVerifyToken    string      `gorm:"type:varchar(100)" json:"-"`
	PasswordResetToken  string      `gorm:"type:varchar(100)" json:"-"`
	PasswordResetExpiry *time.Time  `json:"-"`
}

// TableName returns the table name for User
func (User) TableName() string {
	return "users"
}

// IsAdmin checks if user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == string(RoleAdmin)
}

// IsActive checks if user account is active
func (u *User) IsActive() bool {
	return u.Status == string(UserStatusActive)
}

// IsLocked checks if user account is locked
func (u *User) IsLocked() bool {
	if u.Status == string(UserStatusLocked) {
		return true
	}
	if u.LockedUntil != nil && u.LockedUntil.After(time.Now()) {
		return true
	}
	return false
}

// HasPermission checks if user has a specific permission
func (u *User) HasPermission(permission string) bool {
	if u.IsAdmin() {
		return true
	}
	for _, p := range u.Permissions {
		if p == permission || p == "*" {
			return true
		}
	}
	return false
}

// SafeUser returns user without sensitive fields for API response
type SafeUser struct {
	ID                 string      `json:"id"`
	Username           string      `json:"username"`
	Email              string      `json:"email"`
	DisplayName        string      `json:"display_name"`
	Avatar             string      `json:"avatar"`
	Role               string      `json:"role"`
	Status             string      `json:"status"`
	MFAEnabled         bool        `json:"mfa_enabled"`
	LastLoginAt        *time.Time  `json:"last_login_at"`
	LastLoginIP        string      `json:"last_login_ip"`
	LastPasswordChange *time.Time  `json:"last_password_change"`
	Permissions        StringArray `json:"permissions"`
	Preferences        JSON        `json:"preferences"`
	EmailVerified      bool        `json:"email_verified"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
}

// ToSafe converts User to SafeUser
func (u *User) ToSafe() *SafeUser {
	return &SafeUser{
		ID:                 u.ID,
		Username:           u.Username,
		Email:              u.Email,
		DisplayName:        u.DisplayName,
		Avatar:             u.Avatar,
		Role:               u.Role,
		Status:             u.Status,
		MFAEnabled:         u.MFAEnabled,
		LastLoginAt:        u.LastLoginAt,
		LastLoginIP:        u.LastLoginIP,
		LastPasswordChange: u.LastPasswordChange,
		Permissions:        u.Permissions,
		Preferences:        u.Preferences,
		EmailVerified:      u.EmailVerified,
		CreatedAt:          u.CreatedAt,
		UpdatedAt:          u.UpdatedAt,
	}
}

// Session represents a user session
type Session struct {
	BaseModel
	UserID       string    `gorm:"type:varchar(36);index;not null" json:"user_id"`
	Token        string    `gorm:"type:varchar(500);uniqueIndex;not null" json:"-"`
	RefreshToken string    `gorm:"type:varchar(500);uniqueIndex;not null" json:"-"`
	IPAddress    string    `gorm:"type:varchar(45)" json:"ip_address"`
	UserAgent    string    `gorm:"type:varchar(500)" json:"user_agent"`
	DeviceInfo   string    `gorm:"type:varchar(255)" json:"device_info"`
	Location     string    `gorm:"type:varchar(255)" json:"location"`
	ExpiresAt    time.Time `json:"expires_at"`
	LastActivity time.Time `json:"last_activity"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	User         User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName returns the table name for Session
func (Session) TableName() string {
	return "sessions"
}

// IsExpired checks if session has expired
func (s *Session) IsExpired() bool {
	return s.ExpiresAt.Before(time.Now())
}

// APIKey represents an API key for programmatic access
type APIKey struct {
	BaseModel
	UserID      string      `gorm:"type:varchar(36);index;not null" json:"user_id"`
	Name        string      `gorm:"type:varchar(100);not null" json:"name"`
	KeyHash     string      `gorm:"type:varchar(255);not null" json:"-"`
	KeyPrefix   string      `gorm:"type:varchar(10)" json:"key_prefix"`
	Permissions StringArray `gorm:"type:text" json:"permissions"`
	ExpiresAt   *time.Time  `json:"expires_at"`
	LastUsedAt  *time.Time  `json:"last_used_at"`
	LastUsedIP  string      `gorm:"type:varchar(45)" json:"last_used_ip"`
	IsActive    bool        `gorm:"default:true" json:"is_active"`
	RateLimit   int         `gorm:"default:1000" json:"rate_limit"`
	Metadata    JSON        `gorm:"type:text" json:"metadata"`
	User        User        `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName returns the table name for APIKey
func (APIKey) TableName() string {
	return "api_keys"
}

// IsExpired checks if API key has expired
func (k *APIKey) IsExpired() bool {
	if k.ExpiresAt == nil {
		return false
	}
	return k.ExpiresAt.Before(time.Now())
}

// LoginAttempt records login attempts
type LoginAttempt struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"type:varchar(100);index" json:"username"`
	UserID    string    `gorm:"type:varchar(36);index" json:"user_id"`
	IPAddress string    `gorm:"type:varchar(45);index" json:"ip_address"`
	UserAgent string    `gorm:"type:varchar(500)" json:"user_agent"`
	Success   bool      `json:"success"`
	Reason    string    `gorm:"type:varchar(255)" json:"reason"`
	Location  string    `gorm:"type:varchar(255)" json:"location"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

// TableName returns the table name for LoginAttempt
func (LoginAttempt) TableName() string {
	return "login_attempts"
}

// AuditAction represents the type of auditable action
type AuditAction string

const (
	AuditActionLogin          AuditAction = "login"
	AuditActionLogout         AuditAction = "logout"
	AuditActionPasswordChange AuditAction = "password_change"
	AuditActionMFAEnable      AuditAction = "mfa_enable"
	AuditActionMFADisable     AuditAction = "mfa_disable"
	AuditActionProfileUpdate  AuditAction = "profile_update"
	AuditActionUserCreate     AuditAction = "user_create"
	AuditActionUserUpdate     AuditAction = "user_update"
	AuditActionUserDelete     AuditAction = "user_delete"
	AuditActionAPIKeyCreate   AuditAction = "api_key_create"
	AuditActionAPIKeyDelete   AuditAction = "api_key_delete"
	AuditActionSessionRevoke  AuditAction = "session_revoke"
	AuditActionPermChange     AuditAction = "permission_change"
	AuditActionRoleChange     AuditAction = "role_change"
)

// AuditStatus represents the status of an audited action
type AuditStatus string

const (
	AuditStatusSuccess AuditStatus = "success"
	AuditStatusFailure AuditStatus = "failure"
	AuditStatusWarning AuditStatus = "warning"
)

// AuditLog records user actions for auditing
type AuditLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     string    `gorm:"type:varchar(36);index" json:"user_id"`
	Username   string    `gorm:"type:varchar(100)" json:"username"`
	Action     string    `gorm:"type:varchar(100);index" json:"action"`
	Resource   string    `gorm:"type:varchar(100);index" json:"resource"`
	ResourceID string    `gorm:"type:varchar(36)" json:"resource_id"`
	Details    JSON      `gorm:"type:text" json:"details"`
	OldValue   JSON      `gorm:"type:text" json:"old_value,omitempty"`
	NewValue   JSON      `gorm:"type:text" json:"new_value,omitempty"`
	IPAddress  string    `gorm:"type:varchar(45)" json:"ip_address"`
	UserAgent  string    `gorm:"type:varchar(500)" json:"user_agent"`
	Status     string    `gorm:"type:varchar(20)" json:"status"`
	Duration   int64     `json:"duration_ms"`
	RequestID  string    `gorm:"type:varchar(36)" json:"request_id"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}

// TableName returns the table name for AuditLog
func (AuditLog) TableName() string {
	return "audit_logs"
}

// SystemSetting represents a system setting
type SystemSetting struct {
	Key         string    `gorm:"primaryKey;type:varchar(100)" json:"key"`
	Value       string    `gorm:"type:text" json:"value"`
	Type        string    `gorm:"type:varchar(20)" json:"type"`
	Category    string    `gorm:"type:varchar(50);index" json:"category"`
	Description string    `gorm:"type:varchar(500)" json:"description"`
	IsSecret    bool      `gorm:"default:false" json:"is_secret"`
	UpdatedAt   time.Time `json:"updated_at"`
	UpdatedBy   string    `gorm:"type:varchar(36)" json:"updated_by"`
}

// TableName returns the table name for SystemSetting
func (SystemSetting) TableName() string {
	return "system_settings"
}

// Role represents a user role with permissions
type Role struct {
	BaseModel
	Name        string      `gorm:"uniqueIndex;type:varchar(50);not null" json:"name"`
	DisplayName string      `gorm:"type:varchar(100)" json:"display_name"`
	Description string      `gorm:"type:varchar(500)" json:"description"`
	Permissions StringArray `gorm:"type:text" json:"permissions"`
	IsSystem    bool        `gorm:"default:false" json:"is_system"`
	Priority    int         `gorm:"default:0" json:"priority"`
}

// TableName returns the table name for Role
func (Role) TableName() string {
	return "roles"
}

// Permission represents a permission definition
type Permission struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"uniqueIndex;type:varchar(100);not null" json:"name"`
	DisplayName string `gorm:"type:varchar(100)" json:"display_name"`
	Description string `gorm:"type:varchar(500)" json:"description"`
	Category    string `gorm:"type:varchar(50);index" json:"category"`
	IsSystem    bool   `gorm:"default:false" json:"is_system"`
}

// TableName returns the table name for Permission
func (Permission) TableName() string {
	return "permissions"
}

// PasswordResetRequest represents a password reset request
type PasswordResetRequest struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    string     `gorm:"type:varchar(36);index;not null" json:"user_id"`
	Token     string     `gorm:"type:varchar(100);uniqueIndex;not null" json:"-"`
	IPAddress string     `gorm:"type:varchar(45)" json:"ip_address"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at"`
	CreatedAt time.Time  `json:"created_at"`
}

// TableName returns the table name for PasswordResetRequest
func (PasswordResetRequest) TableName() string {
	return "password_reset_requests"
}

// IsExpired checks if the reset request has expired
func (r *PasswordResetRequest) IsExpired() bool {
	return r.ExpiresAt.Before(time.Now())
}

// IsUsed checks if the reset request has been used
func (r *PasswordResetRequest) IsUsed() bool {
	return r.UsedAt != nil
}

// IPBlacklist represents blocked IP addresses
type IPBlacklist struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	IPAddress string     `gorm:"type:varchar(45);uniqueIndex;not null" json:"ip_address"`
	Reason    string     `gorm:"type:varchar(500)" json:"reason"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedBy string     `gorm:"type:varchar(36)" json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
}

// TableName returns the table name for IPBlacklist
func (IPBlacklist) TableName() string {
	return "ip_blacklist"
}

// IsActive checks if the IP is still blocked
func (b *IPBlacklist) IsActive() bool {
	if b.ExpiresAt == nil {
		return true
	}
	return b.ExpiresAt.After(time.Now())
}

// LoginRequest represents login request data
type LoginRequest struct {
	Username   string `json:"username" binding:"required"`
	Password   string `json:"password" binding:"required"`
	MFACode    string `json:"mfa_code"`
	RememberMe bool   `json:"remember_me"`
}

// RegisterRequest represents registration request data
type RegisterRequest struct {
	Username    string `json:"username" binding:"required,min=3,max=50,alphanum"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8,max=128"`
	DisplayName string `json:"display_name" binding:"max=100"`
}

// ChangePasswordRequest represents password change request data
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8,max=128"`
}

// UpdateProfileRequest represents profile update request data
type UpdateProfileRequest struct {
	DisplayName string `json:"display_name" binding:"max=100"`
	Email       string `json:"email" binding:"omitempty,email"`
	Avatar      string `json:"avatar" binding:"max=500"`
	Preferences JSON   `json:"preferences"`
}

// MFASetupResponse represents MFA setup response data
type MFASetupResponse struct {
	Secret        string   `json:"secret"`
	QRCode        string   `json:"qr_code"`
	RecoveryCodes []string `json:"recovery_codes"`
}

// CreateAPIKeyRequest represents API key creation request
type CreateAPIKeyRequest struct {
	Name        string      `json:"name" binding:"required,min=1,max=100"`
	Permissions StringArray `json:"permissions"`
	ExpiresAt   *time.Time  `json:"expires_at"`
	RateLimit   int         `json:"rate_limit"`
}

// CreateAPIKeyResponse represents API key creation response
type CreateAPIKeyResponse struct {
	APIKey    *APIKey `json:"api_key"`
	SecretKey string  `json:"secret_key"` // Only shown once on creation
}

// SessionInfo represents session information for API response
type SessionInfo struct {
	ID           string    `json:"id"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	DeviceInfo   string    `json:"device_info"`
	Location     string    `json:"location"`
	LastActivity time.Time `json:"last_activity"`
	CreatedAt    time.Time `json:"created_at"`
	IsCurrent    bool      `json:"is_current"`
}
