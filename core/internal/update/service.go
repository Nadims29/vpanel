package update

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/vpanel/core/pkg/logger"
)

const (
	// DefaultUpdateServer is the default update server URL
	DefaultUpdateServer = "https://releases.vpanel.io"
	// UpdateCheckInterval is the interval for automatic update checks
	UpdateCheckInterval = 24 * time.Hour
)

// Service handles update operations.
type Service struct {
	log            *logger.Logger
	currentVersion string
	buildTime      string
	gitCommit      string
	updateServer   string
	binaryPath     string
	dataDir        string

	mu           sync.RWMutex
	status       UpdateStatus
	latestInfo   *VersionInfo
	httpClient   *http.Client
}

// NewService creates a new update service.
func NewService(log *logger.Logger, version, buildTime, gitCommit, updateServer, dataDir string) *Service {
	if updateServer == "" {
		updateServer = DefaultUpdateServer
	}

	// Get current binary path
	binaryPath, err := os.Executable()
	if err != nil {
		log.Warn("Failed to get executable path", "error", err)
		binaryPath = ""
	}

	return &Service{
		log:            log,
		currentVersion: version,
		buildTime:      buildTime,
		gitCommit:      gitCommit,
		updateServer:   strings.TrimSuffix(updateServer, "/"),
		binaryPath:     binaryPath,
		dataDir:        dataDir,
		status: UpdateStatus{
			State:   UpdateStateIdle,
			Message: "Ready",
		},
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetStatus returns the current update status.
func (s *Service) GetStatus() UpdateStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status
}

// GetCurrentVersion returns the current version info.
func (s *Service) GetCurrentVersion() map[string]string {
	return map[string]string{
		"version":    s.currentVersion,
		"build_time": s.buildTime,
		"git_commit": s.gitCommit,
	}
}

// CheckUpdate checks for available updates.
func (s *Service) CheckUpdate() (*CheckUpdateResponse, error) {
	s.setStatus(UpdateStateChecking, 0, "Checking for updates...")

	// Build the version check URL
	url := fmt.Sprintf("%s/api/v1/releases/latest?os=%s&arch=%s&current=%s",
		s.updateServer, runtime.GOOS, runtime.GOARCH, s.currentVersion)

	resp, err := s.httpClient.Get(url)
	if err != nil {
		s.setStatusError("Failed to connect to update server")
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		s.setStatusError("Update server returned an error")
		return nil, fmt.Errorf("update server returned status %d", resp.StatusCode)
	}

	var versionInfo VersionInfo
	if err := json.NewDecoder(resp.Body).Decode(&versionInfo); err != nil {
		s.setStatusError("Failed to parse update information")
		return nil, fmt.Errorf("failed to parse version info: %w", err)
	}

	s.mu.Lock()
	s.latestInfo = &versionInfo
	s.mu.Unlock()

	hasUpdate := s.compareVersions(s.currentVersion, versionInfo.Version) < 0

	if hasUpdate {
		s.setStatus(UpdateStateAvailable, 0, fmt.Sprintf("New version %s available", versionInfo.Version))
	} else {
		s.setStatus(UpdateStateIdle, 0, "You are running the latest version")
	}

	return &CheckUpdateResponse{
		HasUpdate:      hasUpdate,
		CurrentVersion: s.currentVersion,
		LatestVersion:  &versionInfo,
	}, nil
}

// PerformUpdate downloads and installs the update.
func (s *Service) PerformUpdate() error {
	s.mu.RLock()
	latestInfo := s.latestInfo
	s.mu.RUnlock()

	if latestInfo == nil {
		return fmt.Errorf("no update information available, please check for updates first")
	}

	if s.binaryPath == "" {
		return fmt.Errorf("cannot determine binary path")
	}

	// Start download
	now := time.Now()
	s.mu.Lock()
	s.status.StartedAt = &now
	s.mu.Unlock()

	s.setStatus(UpdateStateDownloading, 0, "Downloading update...")

	// Create temp directory for download
	tempDir := filepath.Join(s.dataDir, "temp", "update")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		s.setStatusError("Failed to create temp directory")
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// Download the update
	downloadPath := filepath.Join(tempDir, "update.tar.gz")
	if err := s.downloadFile(latestInfo.DownloadURL, downloadPath, latestInfo.Size); err != nil {
		s.setStatusError("Failed to download update")
		return fmt.Errorf("failed to download update: %w", err)
	}

	s.setStatus(UpdateStateDownloading, 100, "Download complete, verifying...")

	// Verify checksum
	if latestInfo.Checksum != "" {
		if err := s.verifyChecksum(downloadPath, latestInfo.Checksum); err != nil {
			s.setStatusError("Update verification failed")
			return fmt.Errorf("checksum verification failed: %w", err)
		}
	}

	s.setStatus(UpdateStateInstalling, 0, "Installing update...")

	// Extract the update
	extractDir := filepath.Join(tempDir, "extracted")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		s.setStatusError("Failed to create extraction directory")
		return fmt.Errorf("failed to create extraction directory: %w", err)
	}

	if err := s.extractTarGz(downloadPath, extractDir); err != nil {
		s.setStatusError("Failed to extract update")
		return fmt.Errorf("failed to extract update: %w", err)
	}

	// Find the new binary
	newBinaryPath := filepath.Join(extractDir, "vpanel-server")
	if runtime.GOOS == "windows" {
		newBinaryPath += ".exe"
	}

	if _, err := os.Stat(newBinaryPath); os.IsNotExist(err) {
		s.setStatusError("Update package is corrupted")
		return fmt.Errorf("new binary not found in update package")
	}

	s.setStatus(UpdateStateInstalling, 50, "Replacing binary...")

	// Backup current binary
	backupPath := s.binaryPath + ".backup"
	if err := s.copyFile(s.binaryPath, backupPath); err != nil {
		s.log.Warn("Failed to backup current binary", "error", err)
	}

	// Replace the binary
	if err := s.replaceBinary(newBinaryPath, s.binaryPath); err != nil {
		// Try to restore backup
		if restoreErr := s.copyFile(backupPath, s.binaryPath); restoreErr != nil {
			s.log.Error("Failed to restore backup", "error", restoreErr)
		}
		s.setStatusError("Failed to install update")
		return fmt.Errorf("failed to replace binary: %w", err)
	}

	s.setStatus(UpdateStateRestarting, 100, "Update installed, restarting...")

	// Trigger restart
	go s.restartServer()

	return nil
}

// downloadFile downloads a file from URL to the specified path.
func (s *Service) downloadFile(url, destPath string, expectedSize int64) error {
	resp, err := s.httpClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	// Track progress
	var downloaded int64
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := out.Write(buf[:n]); writeErr != nil {
				return writeErr
			}
			downloaded += int64(n)
			if expectedSize > 0 {
				progress := int(float64(downloaded) / float64(expectedSize) * 100)
				s.setStatus(UpdateStateDownloading, progress, fmt.Sprintf("Downloading... %d%%", progress))
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}

	return nil
}

// verifyChecksum verifies the SHA256 checksum of a file.
func (s *Service) verifyChecksum(filePath, expected string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}

	actual := hex.EncodeToString(h.Sum(nil))
	if actual != expected {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expected, actual)
	}

	return nil
}

// extractTarGz extracts a tar.gz file.
func (s *Service) extractTarGz(src, dest string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()

	gzr, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		target := filepath.Join(dest, header.Name)

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			outFile, err := os.Create(target)
			if err != nil {
				return err
			}
			if _, err := io.Copy(outFile, tr); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()

			// Preserve executable permissions
			if header.Mode&0111 != 0 {
				if err := os.Chmod(target, 0755); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// copyFile copies a file from src to dest.
func (s *Service) copyFile(src, dest string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return err
	}

	// Copy permissions
	sourceInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	return os.Chmod(dest, sourceInfo.Mode())
}

// replaceBinary replaces the current binary with the new one.
func (s *Service) replaceBinary(newPath, oldPath string) error {
	// On Windows, we need to rename the old file first
	if runtime.GOOS == "windows" {
		oldRenamed := oldPath + ".old"
		if err := os.Rename(oldPath, oldRenamed); err != nil {
			return err
		}
		if err := s.copyFile(newPath, oldPath); err != nil {
			// Try to restore
			os.Rename(oldRenamed, oldPath)
			return err
		}
		os.Remove(oldRenamed)
		return nil
	}

	// On Unix, we can directly copy over the binary
	return s.copyFile(newPath, oldPath)
}

// restartServer restarts the server process.
func (s *Service) restartServer() {
	s.log.Info("Restarting server for update...")

	// Give some time for the response to be sent
	time.Sleep(1 * time.Second)

	// Execute the new binary
	cmd := exec.Command(s.binaryPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()

	if err := cmd.Start(); err != nil {
		s.log.Error("Failed to start new process", "error", err)
		s.setStatusError("Failed to restart server")
		return
	}

	// Exit the current process
	os.Exit(0)
}

// setStatus updates the current status.
func (s *Service) setStatus(state UpdateState, progress int, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status.State = state
	s.status.Progress = progress
	s.status.Message = message
	s.status.Error = ""
}

// setStatusError sets an error status.
func (s *Service) setStatusError(message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status.State = UpdateStateFailed
	s.status.Error = message
	s.status.Message = "Update failed"
	now := time.Now()
	s.status.CompletedAt = &now
}

// compareVersions compares two semantic versions.
// Returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2.
func (s *Service) compareVersions(v1, v2 string) int {
	// Remove 'v' prefix if present
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")

	// Handle "dev" version
	if v1 == "dev" {
		return -1
	}
	if v2 == "dev" {
		return 1
	}

	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var n1, n2 int
		if i < len(parts1) {
			fmt.Sscanf(parts1[i], "%d", &n1)
		}
		if i < len(parts2) {
			fmt.Sscanf(parts2[i], "%d", &n2)
		}

		if n1 < n2 {
			return -1
		}
		if n1 > n2 {
			return 1
		}
	}

	return 0
}

