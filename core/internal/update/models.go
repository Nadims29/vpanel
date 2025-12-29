package update

import "time"

// VersionInfo represents version information from the remote server.
type VersionInfo struct {
	Version     string    `json:"version"`
	BuildTime   string    `json:"build_time"`
	GitCommit   string    `json:"git_commit"`
	ReleaseDate time.Time `json:"release_date"`
	Changelog   string    `json:"changelog"`
	DownloadURL string    `json:"download_url"`
	Checksum    string    `json:"checksum"` // SHA256
	Size        int64     `json:"size"`     // bytes
}

// UpdateStatus represents the current update status.
type UpdateStatus struct {
	State       UpdateState `json:"state"`
	Progress    int         `json:"progress"`     // 0-100
	Message     string      `json:"message"`
	Error       string      `json:"error,omitempty"`
	StartedAt   *time.Time  `json:"started_at,omitempty"`
	CompletedAt *time.Time  `json:"completed_at,omitempty"`
}

// UpdateState represents different states of the update process.
type UpdateState string

const (
	UpdateStateIdle        UpdateState = "idle"
	UpdateStateChecking    UpdateState = "checking"
	UpdateStateAvailable   UpdateState = "available"
	UpdateStateDownloading UpdateState = "downloading"
	UpdateStateInstalling  UpdateState = "installing"
	UpdateStateRestarting  UpdateState = "restarting"
	UpdateStateCompleted   UpdateState = "completed"
	UpdateStateFailed      UpdateState = "failed"
)

// CheckUpdateResponse is the response for check update API.
type CheckUpdateResponse struct {
	HasUpdate      bool         `json:"has_update"`
	CurrentVersion string       `json:"current_version"`
	LatestVersion  *VersionInfo `json:"latest_version,omitempty"`
}

// UpdateConfig contains update-related configuration.
type UpdateConfig struct {
	UpdateServerURL string `json:"update_server_url"`
	AutoCheck       bool   `json:"auto_check"`
	AutoUpdate      bool   `json:"auto_update"`
}

