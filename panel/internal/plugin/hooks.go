package plugin

import (
	"sync"
	"time"

	"github.com/vpanel/server/pkg/logger"
)

// HookType constants for system events.
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
	HookAlertTriggered    = "alert.triggered"
	HookAlertResolved     = "alert.resolved"
	HookAlertAcknowledged = "alert.acknowledged"

	// Plugin events
	HookPluginEnabled  = "plugin.enabled"
	HookPluginDisabled = "plugin.disabled"
)

// HookDispatcher manages dispatching events to plugin hooks.
type HookDispatcher struct {
	manager *Manager
	log     *logger.Logger
	mu      sync.RWMutex
	queue   chan *HookEvent
	done    chan struct{}
}

// HookEvent represents an event to be dispatched.
type HookEvent struct {
	Type      string
	Payload   interface{}
	Timestamp time.Time
	Source    string
	Metadata  map[string]string
}

// NewHookDispatcher creates a new hook dispatcher.
func NewHookDispatcher(manager *Manager, log *logger.Logger) *HookDispatcher {
	d := &HookDispatcher{
		manager: manager,
		log:     log,
		queue:   make(chan *HookEvent, 100),
		done:    make(chan struct{}),
	}

	// Start the event processing goroutine
	go d.processEvents()

	return d
}

// processEvents processes events from the queue.
func (d *HookDispatcher) processEvents() {
	for {
		select {
		case event := <-d.queue:
			d.dispatchEvent(event)
		case <-d.done:
			return
		}
	}
}

// dispatchEvent dispatches an event to all enabled plugins.
func (d *HookDispatcher) dispatchEvent(event *HookEvent) {
	d.mu.RLock()
	plugins := d.manager.List()
	d.mu.RUnlock()

	for _, lp := range plugins {
		if !lp.Enabled || lp.Instance == nil {
			continue
		}

		// Dispatch asynchronously to avoid blocking
		go func(p *LoadedPlugin) {
			e := Event{
				Type:    event.Type,
				Payload: event.Payload,
			}

			if err := p.Instance.HandleEvent(e); err != nil {
				d.log.Warn("Plugin hook handler error",
					"plugin", p.Manifest.ID,
					"event", event.Type,
					"error", err,
				)
			}
		}(lp)
	}
}

// Dispatch sends an event to be dispatched to all plugins.
// This is the main method services should use to trigger hooks.
func (d *HookDispatcher) Dispatch(hookType string, payload interface{}) {
	event := &HookEvent{
		Type:      hookType,
		Payload:   payload,
		Timestamp: time.Now(),
		Source:    "system",
	}

	select {
	case d.queue <- event:
	default:
		d.log.Warn("Hook event queue full, dropping event", "type", hookType)
	}
}

// DispatchWithMetadata dispatches an event with additional metadata.
func (d *HookDispatcher) DispatchWithMetadata(hookType string, payload interface{}, metadata map[string]string) {
	event := &HookEvent{
		Type:      hookType,
		Payload:   payload,
		Timestamp: time.Now(),
		Source:    "system",
		Metadata:  metadata,
	}

	select {
	case d.queue <- event:
	default:
		d.log.Warn("Hook event queue full, dropping event", "type", hookType)
	}
}

// DispatchSync dispatches an event synchronously and waits for all handlers.
// Use this for critical events that need immediate processing.
func (d *HookDispatcher) DispatchSync(hookType string, payload interface{}) []error {
	event := &HookEvent{
		Type:      hookType,
		Payload:   payload,
		Timestamp: time.Now(),
		Source:    "system",
	}

	d.mu.RLock()
	plugins := d.manager.List()
	d.mu.RUnlock()

	var errors []error
	var wg sync.WaitGroup
	var errMu sync.Mutex

	for _, lp := range plugins {
		if !lp.Enabled || lp.Instance == nil {
			continue
		}

		wg.Add(1)
		go func(p *LoadedPlugin) {
			defer wg.Done()

			e := Event{
				Type:    event.Type,
				Payload: event.Payload,
			}

			if err := p.Instance.HandleEvent(e); err != nil {
				errMu.Lock()
				errors = append(errors, err)
				errMu.Unlock()
				d.log.Warn("Plugin hook handler error",
					"plugin", p.Manifest.ID,
					"event", event.Type,
					"error", err,
				)
			}
		}(lp)
	}

	wg.Wait()
	return errors
}

// Close stops the hook dispatcher.
func (d *HookDispatcher) Close() {
	close(d.done)
}

// Common payload types for hooks

// ContainerEventPayload is the payload for container events.
type ContainerEventPayload struct {
	ContainerID   string `json:"container_id"`
	ContainerName string `json:"container_name"`
	Image         string `json:"image"`
	Action        string `json:"action"`
}

// SiteEventPayload is the payload for nginx site events.
type SiteEventPayload struct {
	SiteID     string `json:"site_id"`
	SiteName   string `json:"site_name"`
	Domain     string `json:"domain"`
	InstanceID string `json:"instance_id"`
}

// DatabaseEventPayload is the payload for database events.
type DatabaseEventPayload struct {
	ServerID     string `json:"server_id"`
	ServerName   string `json:"server_name"`
	DatabaseName string `json:"database_name"`
	Type         string `json:"type"`
}

// BackupEventPayload is the payload for backup events.
type BackupEventPayload struct {
	BackupID string `json:"backup_id"`
	ServerID string `json:"server_id"`
	Database string `json:"database"`
	FilePath string `json:"file_path"`
	FileSize int64  `json:"file_size"`
	Error    string `json:"error,omitempty"`
}

// UserEventPayload is the payload for user events.
type UserEventPayload struct {
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	IPAddress string `json:"ip_address"`
	Action    string `json:"action"`
}

// AppEventPayload is the payload for app events.
type AppEventPayload struct {
	AppID        string `json:"app_id"`
	AppName      string `json:"app_name"`
	DeploymentID string `json:"deployment_id,omitempty"`
	Status       string `json:"status"`
}

// AlertEventPayload is the payload for alert events.
type AlertEventPayload struct {
	AlertID  string `json:"alert_id"`
	Type     string `json:"type"`
	Severity string `json:"severity"`
	Title    string `json:"title"`
	Message  string `json:"message"`
}

// FileEventPayload is the payload for file events.
type FileEventPayload struct {
	Path      string `json:"path"`
	Operation string `json:"operation"`
	UserID    string `json:"user_id"`
}

// CronEventPayload is the payload for cron job events.
type CronEventPayload struct {
	JobID     string `json:"job_id"`
	JobName   string `json:"job_name"`
	Status    string `json:"status"`
	ExitCode  int    `json:"exit_code"`
	Duration  int    `json:"duration"` // milliseconds
	Error     string `json:"error,omitempty"`
}
