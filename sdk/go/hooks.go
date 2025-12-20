package sdk

import (
	"sync"
)

// Hook event names for VPanel system events.
const (
	// Container events
	HookContainerCreate  = "container.create"
	HookContainerStart   = "container.start"
	HookContainerStop    = "container.stop"
	HookContainerRemove  = "container.remove"
	HookContainerRestart = "container.restart"

	// Nginx events
	HookSiteCreated  = "nginx.site.created"
	HookSiteUpdated  = "nginx.site.updated"
	HookSiteDeleted  = "nginx.site.deleted"
	HookSiteEnabled  = "nginx.site.enabled"
	HookSiteDisabled = "nginx.site.disabled"
	HookNginxReload  = "nginx.reload"

	// Database events
	HookDatabaseCreated = "database.created"
	HookDatabaseDeleted = "database.deleted"
	HookBackupCompleted = "backup.completed"
	HookBackupFailed    = "backup.failed"

	// User events
	HookUserLogin       = "user.login"
	HookUserLogout      = "user.logout"
	HookUserCreated     = "user.created"
	HookUserUpdated     = "user.updated"
	HookUserDeleted     = "user.deleted"
	HookPasswordChanged = "user.password.changed"

	// App events
	HookAppDeployed  = "app.deployed"
	HookAppStarted   = "app.started"
	HookAppStopped   = "app.stopped"
	HookAppRestarted = "app.restarted"
	HookAppDeleted   = "app.deleted"

	// System events
	HookSystemStartup  = "system.startup"
	HookSystemShutdown = "system.shutdown"
	HookCronJobRun     = "cron.job.run"
	HookCronJobFailed  = "cron.job.failed"

	// File events
	HookFileCreated  = "file.created"
	HookFileModified = "file.modified"
	HookFileDeleted  = "file.deleted"

	// Alert events
	HookAlertTriggered   = "alert.triggered"
	HookAlertResolved    = "alert.resolved"
	HookAlertAcknowledged = "alert.acknowledged"

	// Plugin events
	HookPluginEnabled  = "plugin.enabled"
	HookPluginDisabled = "plugin.disabled"
)

// Event represents an event from the VPanel system.
type Event struct {
	// Type is the event type (e.g., "container.start")
	Type string `json:"type"`

	// Source indicates the origin of the event
	Source string `json:"source"`

	// Timestamp is when the event occurred
	Timestamp int64 `json:"timestamp"`

	// Payload contains event-specific data
	Payload interface{} `json:"payload,omitempty"`

	// Data contains event-specific data (alternative to Payload)
	Data map[string]interface{} `json:"data,omitempty"`

	// Metadata contains additional event information
	Metadata map[string]string `json:"metadata,omitempty"`
}

// EventHandler is a function that handles events.
type EventHandler func(event *Event) error

// HookManager manages event hooks for a plugin.
type HookManager struct {
	handlers map[string][]EventHandler
	mu       sync.RWMutex
}

// NewHookManager creates a new HookManager.
func NewHookManager() *HookManager {
	return &HookManager{
		handlers: make(map[string][]EventHandler),
	}
}

// On registers an event handler for the specified event type.
func (m *HookManager) On(eventType string, handler EventHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.handlers[eventType] = append(m.handlers[eventType], handler)
}

// Off removes all handlers for the specified event type.
func (m *HookManager) Off(eventType string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.handlers, eventType)
}

// Once registers a one-time event handler.
func (m *HookManager) Once(eventType string, handler EventHandler) {
	var onceHandler EventHandler
	onceHandler = func(event *Event) error {
		m.RemoveHandler(eventType, onceHandler)
		return handler(event)
	}
	m.On(eventType, onceHandler)
}

// RemoveHandler removes a specific handler from an event type.
func (m *HookManager) RemoveHandler(eventType string, handler EventHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()

	handlers := m.handlers[eventType]
	for i, h := range handlers {
		// Compare function pointers
		if &h == &handler {
			m.handlers[eventType] = append(handlers[:i], handlers[i+1:]...)
			break
		}
	}
}

// Emit dispatches an event to all registered handlers.
// This is typically called by the plugin manager.
func (m *HookManager) Emit(event *Event) []error {
	m.mu.RLock()
	handlers := m.handlers[event.Type]
	m.mu.RUnlock()

	var errors []error
	for _, handler := range handlers {
		if err := handler(event); err != nil {
			errors = append(errors, err)
		}
	}
	return errors
}

// HasHandlers checks if there are any handlers for an event type.
func (m *HookManager) HasHandlers(eventType string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return len(m.handlers[eventType]) > 0
}

// GetRegisteredEvents returns all event types with handlers.
func (m *HookManager) GetRegisteredEvents() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	events := make([]string, 0, len(m.handlers))
	for event := range m.handlers {
		events = append(events, event)
	}
	return events
}

// ContainerEventPayload is the payload for container events.
type ContainerEventPayload struct {
	ContainerID   string
	ContainerName string
	Image         string
	Action        string
}

// SiteEventPayload is the payload for nginx site events.
type SiteEventPayload struct {
	SiteID     string
	SiteName   string
	Domain     string
	InstanceID string
}

// DatabaseEventPayload is the payload for database events.
type DatabaseEventPayload struct {
	ServerID     string
	ServerName   string
	DatabaseName string
	Type         string
}

// BackupEventPayload is the payload for backup events.
type BackupEventPayload struct {
	BackupID   string
	ServerID   string
	Database   string
	FilePath   string
	FileSize   int64
	Error      string
}

// UserEventPayload is the payload for user events.
type UserEventPayload struct {
	UserID    string
	Username  string
	Email     string
	IPAddress string
	Action    string
}

// AppEventPayload is the payload for app events.
type AppEventPayload struct {
	AppID        string
	AppName      string
	DeploymentID string
	Status       string
}

// AlertEventPayload is the payload for alert events.
type AlertEventPayload struct {
	AlertID  string
	Type     string
	Severity string
	Title    string
	Message  string
}
