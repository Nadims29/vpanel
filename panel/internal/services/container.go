package services

import (
	"time"

	"github.com/vpanel/server/internal/config"
	"github.com/vpanel/server/internal/models"
	"github.com/vpanel/server/pkg/logger"
	"gorm.io/gorm"
)

// Container holds all services
type Container struct {
	DB     *gorm.DB
	Config *config.Config
	Log    *logger.Logger

	// Core services
	Auth    *AuthService
	User    *UserService
	Node    *NodeService
	Monitor *MonitorService

	// Feature services
	Docker   *DockerService
	Nginx    *NginxService
	Database *DatabaseService
	File     *FileService
	Terminal *TerminalService
	Cron     *CronService
	Firewall *FirewallService
	Software *SoftwareService

	// Support services
	Plugin       *PluginService
	Settings     *SettingsService
	Audit        *AuditService
	Notification *NotificationService
}

// NewContainer creates a new service container
func NewContainer(db *gorm.DB, cfg *config.Config, log *logger.Logger) *Container {
	c := &Container{
		DB:     db,
		Config: cfg,
		Log:    log,
	}

	// Initialize core services
	c.Auth = NewAuthService(db, cfg, log)
	c.User = NewUserService(db, log)
	c.Node = NewNodeService(db, log)
	c.Monitor = NewMonitorService(db, log)

	// Initialize feature services
	c.Docker = NewDockerService(db, log)
	c.Nginx = NewNginxService(db, log)
	c.Database = NewDatabaseService(db, log)
	c.File = NewFileService(db, cfg, log)
	c.Terminal = NewTerminalService(log)
	c.Cron = NewCronService(db, log)
	c.Firewall = NewFirewallService(db, log)
	c.Software = NewSoftwareService(db, log)

	// Initialize support services
	c.Plugin = NewPluginService(db, log)
	c.Settings = NewSettingsService(db, log)
	c.Audit = NewAuditService(db, log)
	c.Notification = NewNotificationService(db, log)

	return c
}

// ============================================
// User Service
// ============================================

// UserService handles user operations
type UserService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewUserService creates a new user service
func NewUserService(db *gorm.DB, log *logger.Logger) *UserService {
	return &UserService{db: db, log: log}
}

// ============================================
// Node Service
// ============================================

// NodeService manages server nodes
type NodeService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewNodeService creates a new node service
func NewNodeService(db *gorm.DB, log *logger.Logger) *NodeService {
	return &NodeService{db: db, log: log}
}

// ============================================
// Nginx Service
// ============================================
// NginxService implementation is in nginx.go

// ============================================
// Database Service
// ============================================

// DatabaseService manages database servers
type DatabaseService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewDatabaseService creates a new database service
func NewDatabaseService(db *gorm.DB, log *logger.Logger) *DatabaseService {
	return &DatabaseService{db: db, log: log}
}

// ============================================
// Firewall Service
// ============================================

// FirewallService manages firewall rules with real system integration
type FirewallService struct {
	db      *gorm.DB
	log     *logger.Logger
	manager *FirewallManager
}

// NewFirewallService creates a new firewall service
func NewFirewallService(db *gorm.DB, log *logger.Logger) *FirewallService {
	return &FirewallService{
		db:      db,
		log:     log,
		manager: NewFirewallManager(db, log),
	}
}

// GetStatus returns real firewall status from the system
func (s *FirewallService) GetStatus(nodeID string) (map[string]interface{}, error) {
	// Get real system firewall status
	status, err := s.manager.GetStatus()
	if err != nil {
		return nil, err
	}

	// Add database rule counts
	var enabledCount int64
	var totalCount int64

	query := s.db.Model(&models.FirewallRule{})
	if nodeID != "" {
		query = query.Where("node_id = ?", nodeID)
	}

	query.Where("enabled = ?", true).Count(&enabledCount)
	s.db.Model(&models.FirewallRule{}).Count(&totalCount)

	status["dbRulesEnabled"] = enabledCount
	status["dbRulesTotal"] = totalCount

	// Get blocked IPs from Fail2Ban if available
	f2bStatus, _ := s.manager.GetFail2BanStatus()
	if f2bStatus != nil {
		if blockedIPs, ok := f2bStatus["bannedIPs"]; ok {
			status["blockedIPs"] = blockedIPs
		}
	}

	return status, nil
}

// EnableFirewall enables the system firewall
func (s *FirewallService) EnableFirewall(nodeID string) error {
	if err := s.manager.EnableFirewall(); err != nil {
		return err
	}

	// Sync all enabled rules to the system
	if err := s.manager.SyncRules(); err != nil {
		s.log.Warn("Failed to sync rules after enabling firewall", "error", err)
	}

	s.log.Info("Firewall enabled", "node_id", nodeID)
	return nil
}

// DisableFirewall disables the system firewall
func (s *FirewallService) DisableFirewall(nodeID string) error {
	if err := s.manager.DisableFirewall(); err != nil {
		return err
	}
	s.log.Info("Firewall disabled", "node_id", nodeID)
	return nil
}

// ListRules returns all firewall rules from database
func (s *FirewallService) ListRules(nodeID string) ([]models.FirewallRule, error) {
	var rules []models.FirewallRule
	query := s.db.Order("priority ASC, created_at DESC")

	if nodeID != "" {
		query = query.Where("node_id = ?", nodeID)
	}

	if err := query.Find(&rules).Error; err != nil {
		return nil, err
	}

	return rules, nil
}

// GetRule returns a firewall rule by ID
func (s *FirewallService) GetRule(id string) (*models.FirewallRule, error) {
	var rule models.FirewallRule
	if err := s.db.First(&rule, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

// CreateRule creates a new firewall rule and applies it to the system
func (s *FirewallService) CreateRule(rule *models.FirewallRule) error {
	// Save to database first
	if err := s.db.Create(rule).Error; err != nil {
		return err
	}

	// Apply rule to system firewall
	if rule.Enabled {
		if err := s.manager.ApplyRule(rule); err != nil {
			s.log.Warn("Failed to apply firewall rule to system", "rule_id", rule.ID, "error", err)
			// Don't return error - rule is saved, just not applied
		}
	}

	s.log.Info("Firewall rule created", "rule_id", rule.ID, "name", rule.Name, "node_id", rule.NodeID)
	return nil
}

// UpdateRule updates a firewall rule and reapplies it to the system
func (s *FirewallService) UpdateRule(id string, updates map[string]interface{}) error {
	// Get the old rule first
	oldRule, err := s.GetRule(id)
	if err != nil {
		return err
	}

	// Remove old rule from system
	if err := s.manager.RemoveRule(oldRule); err != nil {
		s.log.Warn("Failed to remove old firewall rule from system", "rule_id", id, "error", err)
	}

	// Update in database
	if err := s.db.Model(&models.FirewallRule{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return err
	}

	// Get updated rule
	newRule, err := s.GetRule(id)
	if err != nil {
		return err
	}

	// Apply new rule to system
	if newRule.Enabled {
		if err := s.manager.ApplyRule(newRule); err != nil {
			s.log.Warn("Failed to apply updated firewall rule to system", "rule_id", id, "error", err)
		}
	}

	s.log.Info("Firewall rule updated", "rule_id", id)
	return nil
}

// DeleteRule deletes a firewall rule and removes it from the system
func (s *FirewallService) DeleteRule(id string) error {
	// Get rule first to remove from system
	rule, err := s.GetRule(id)
	if err != nil {
		return err
	}

	// Remove from system firewall
	if err := s.manager.RemoveRule(rule); err != nil {
		s.log.Warn("Failed to remove firewall rule from system", "rule_id", id, "error", err)
	}

	// Delete from database
	if err := s.db.Delete(&models.FirewallRule{}, "id = ?", id).Error; err != nil {
		return err
	}

	s.log.Info("Firewall rule deleted", "rule_id", id)
	return nil
}

// GetFail2BanStatus returns real Fail2Ban status
func (s *FirewallService) GetFail2BanStatus(nodeID string) (map[string]interface{}, error) {
	return s.manager.GetFail2BanStatus()
}

// ListFail2BanJails returns all Fail2Ban jails with real status
func (s *FirewallService) ListFail2BanJails(nodeID string) ([]map[string]interface{}, error) {
	return s.manager.ListFail2BanJails()
}

// UnbanIP unbans an IP from a Fail2Ban jail
func (s *FirewallService) UnbanIP(jailName, ip, nodeID string) error {
	if err := s.manager.UnbanIP(jailName, ip); err != nil {
		return err
	}
	s.log.Info("IP unbanned", "jail", jailName, "ip", ip, "node_id", nodeID)
	return nil
}

// ListSystemRules returns the current rules from the system firewall
func (s *FirewallService) ListSystemRules() ([]map[string]interface{}, error) {
	return s.manager.ListSystemRules()
}

// SyncRules synchronizes database rules to system firewall
func (s *FirewallService) SyncRules() error {
	return s.manager.SyncRules()
}

// GetBackend returns the detected firewall backend
func (s *FirewallService) GetBackend() FirewallBackend {
	return s.manager.GetBackend()
}

// ============================================
// Software Service
// ============================================

// SoftwareService manages software installation
type SoftwareService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewSoftwareService creates a new software service
func NewSoftwareService(db *gorm.DB, log *logger.Logger) *SoftwareService {
	return &SoftwareService{db: db, log: log}
}

// ============================================
// Plugin Service
// ============================================

// PluginService manages plugins
type PluginService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewPluginService creates a new plugin service
func NewPluginService(db *gorm.DB, log *logger.Logger) *PluginService {
	return &PluginService{db: db, log: log}
}

// ============================================
// Settings Service
// ============================================

// SettingsService manages system settings
type SettingsService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewSettingsService creates a new settings service
func NewSettingsService(db *gorm.DB, log *logger.Logger) *SettingsService {
	return &SettingsService{db: db, log: log}
}

// ============================================
// Audit Service
// ============================================

// AuditService handles audit logging
type AuditService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewAuditService creates a new audit service
func NewAuditService(db *gorm.DB, log *logger.Logger) *AuditService {
	return &AuditService{db: db, log: log}
}

// AuditLogQuery represents query parameters for listing audit logs
type AuditLogQuery struct {
	Page      int
	PageSize  int
	UserID    string
	Username  string
	Action    string
	Resource  string
	Status    string
	StartDate string
	EndDate   string
	IPAddress string
	Search    string
}

// AuditLogResult represents paginated audit log results
type AuditLogResult struct {
	Logs       []models.AuditLog `json:"logs"`
	Total      int64             `json:"total"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	TotalPages int               `json:"total_pages"`
}

// List returns paginated audit logs with filtering
func (s *AuditService) List(query AuditLogQuery) (*AuditLogResult, error) {
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 || query.PageSize > 100 {
		query.PageSize = 20
	}

	var logs []models.AuditLog
	var total int64

	db := s.db.Model(&models.AuditLog{})

	// Apply filters
	if query.UserID != "" {
		db = db.Where("user_id = ?", query.UserID)
	}
	if query.Username != "" {
		db = db.Where("username LIKE ?", "%"+query.Username+"%")
	}
	if query.Action != "" {
		db = db.Where("action = ?", query.Action)
	}
	if query.Resource != "" {
		db = db.Where("resource = ?", query.Resource)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.IPAddress != "" {
		db = db.Where("ip_address LIKE ?", "%"+query.IPAddress+"%")
	}
	if query.StartDate != "" {
		db = db.Where("created_at >= ?", query.StartDate)
	}
	if query.EndDate != "" {
		db = db.Where("created_at <= ?", query.EndDate)
	}
	if query.Search != "" {
		search := "%" + query.Search + "%"
		db = db.Where("username LIKE ? OR action LIKE ? OR resource LIKE ? OR ip_address LIKE ?",
			search, search, search, search)
	}

	// Get total count
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	// Get paginated results
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(query.PageSize).Find(&logs).Error; err != nil {
		return nil, err
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return &AuditLogResult{
		Logs:       logs,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

// Log creates a new audit log entry
func (s *AuditService) Log(userID, username, action, resource, resourceID, ipAddress, userAgent, status string, details map[string]interface{}) error {
	log := models.AuditLog{
		UserID:     userID,
		Username:   username,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
		Status:     status,
		Details:    details,
	}

	if err := s.db.Create(&log).Error; err != nil {
		s.log.Error("Failed to create audit log", "error", err)
		return err
	}

	return nil
}

// GetStats returns audit log statistics
func (s *AuditService) GetStats() (map[string]interface{}, error) {
	var totalLogs int64
	var todayLogs int64
	var failedActions int64
	var uniqueUsers int64

	// Total logs
	s.db.Model(&models.AuditLog{}).Count(&totalLogs)

	// Today's logs
	today := time.Now().Format("2006-01-02")
	s.db.Model(&models.AuditLog{}).Where("DATE(created_at) = ?", today).Count(&todayLogs)

	// Failed actions
	s.db.Model(&models.AuditLog{}).Where("status = ?", "failed").Count(&failedActions)

	// Unique users (last 30 days)
	s.db.Model(&models.AuditLog{}).
		Where("created_at >= ?", time.Now().AddDate(0, 0, -30)).
		Distinct("user_id").Count(&uniqueUsers)

	// Get action distribution
	type ActionCount struct {
		Action string
		Count  int64
	}
	var actionCounts []ActionCount
	s.db.Model(&models.AuditLog{}).
		Select("action, count(*) as count").
		Group("action").
		Order("count DESC").
		Limit(10).
		Scan(&actionCounts)

	actionDistribution := make(map[string]int64)
	for _, ac := range actionCounts {
		actionDistribution[ac.Action] = ac.Count
	}

	// Get resource distribution
	type ResourceCount struct {
		Resource string
		Count    int64
	}
	var resourceCounts []ResourceCount
	s.db.Model(&models.AuditLog{}).
		Select("resource, count(*) as count").
		Group("resource").
		Order("count DESC").
		Limit(10).
		Scan(&resourceCounts)

	resourceDistribution := make(map[string]int64)
	for _, rc := range resourceCounts {
		resourceDistribution[rc.Resource] = rc.Count
	}

	return map[string]interface{}{
		"total_logs":            totalLogs,
		"today_logs":            todayLogs,
		"failed_actions":        failedActions,
		"unique_users":          uniqueUsers,
		"action_distribution":   actionDistribution,
		"resource_distribution": resourceDistribution,
	}, nil
}

// GetDistinctActions returns all distinct action types
func (s *AuditService) GetDistinctActions() ([]string, error) {
	var actions []string
	if err := s.db.Model(&models.AuditLog{}).Distinct("action").Pluck("action", &actions).Error; err != nil {
		return nil, err
	}
	return actions, nil
}

// GetDistinctResources returns all distinct resource types
func (s *AuditService) GetDistinctResources() ([]string, error) {
	var resources []string
	if err := s.db.Model(&models.AuditLog{}).Distinct("resource").Pluck("resource", &resources).Error; err != nil {
		return nil, err
	}
	return resources, nil
}

// ============================================
// Notification Service
// ============================================

// NotificationService handles notifications
type NotificationService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewNotificationService creates a new notification service
func NewNotificationService(db *gorm.DB, log *logger.Logger) *NotificationService {
	return &NotificationService{db: db, log: log}
}
