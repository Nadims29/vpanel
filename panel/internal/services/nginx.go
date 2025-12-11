package services

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"text/template"
	"time"

	"github.com/vpanel/server/internal/models"
	"github.com/vpanel/server/pkg/logger"
	"gorm.io/gorm"
)

// NginxService manages Nginx configuration
type NginxService struct {
	db  *gorm.DB
	log *logger.Logger
}

// NewNginxService creates a new nginx service
func NewNginxService(db *gorm.DB, log *logger.Logger) *NginxService {
	return &NginxService{db: db, log: log}
}

// GetStatus returns nginx status
func (s *NginxService) GetStatus() (map[string]interface{}, error) {
	// Check if nginx is running
	cmd := exec.Command("nginx", "-t")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	err := cmd.Run()

	isValid := err == nil
	errorMsg := ""
	if !isValid {
		errorMsg = stderr.String()
	}

	// Check if nginx process is running
	isRunning := false
	cmd = exec.Command("pgrep", "-x", "nginx")
	if err := cmd.Run(); err == nil {
		isRunning = true
	}

	// Count sites
	var totalSites, enabledSites int64
	s.db.Model(&models.NginxSite{}).Count(&totalSites)
	s.db.Model(&models.NginxSite{}).Where("enabled = ?", true).Count(&enabledSites)

	return map[string]interface{}{
		"running":       isRunning,
		"config_valid":  isValid,
		"error":         errorMsg,
		"total_sites":   totalSites,
		"enabled_sites": enabledSites,
	}, nil
}

// Reload reloads nginx configuration
func (s *NginxService) Reload() error {
	cmd := exec.Command("nginx", "-s", "reload")
	if err := cmd.Run(); err != nil {
		s.log.Error("Failed to reload nginx", "error", err)
		return fmt.Errorf("failed to reload nginx: %w", err)
	}
	s.log.Info("Nginx reloaded successfully")
	return nil
}

// ListSites returns all nginx sites
func (s *NginxService) ListSites(nodeID string) ([]models.NginxSite, error) {
	var sites []models.NginxSite
	query := s.db.Order("created_at DESC")

	if nodeID != "" {
		query = query.Where("node_id = ?", nodeID)
	}

	if err := query.Find(&sites).Error; err != nil {
		return nil, err
	}
	return sites, nil
}

// GetSite returns a site by ID
func (s *NginxService) GetSite(id string) (*models.NginxSite, error) {
	var site models.NginxSite
	if err := s.db.First(&site, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &site, nil
}

// CreateSite creates a new nginx site
func (s *NginxService) CreateSite(site *models.NginxSite) error {
	// Validate domain
	if site.Domain == "" {
		return fmt.Errorf("domain is required")
	}

	// Check if domain already exists
	var existing models.NginxSite
	if err := s.db.Where("domain = ?", site.Domain).First(&existing).Error; err == nil {
		return fmt.Errorf("domain %s already exists", site.Domain)
	}

	// Set defaults
	if site.Port == 0 {
		site.Port = 80
	}
	if site.Name == "" {
		site.Name = site.Domain
	}
	if !site.ProxyEnabled && site.RootPath == "" {
		site.RootPath = fmt.Sprintf("/var/www/%s", site.Domain)
	}

	// Create site in database
	if err := s.db.Create(site).Error; err != nil {
		return err
	}

	// Generate and write nginx config
	if err := s.writeSiteConfig(site); err != nil {
		s.log.Error("Failed to write nginx config", "error", err, "site_id", site.ID)
		// Don't fail the creation, just log the error
	}

	s.log.Info("Nginx site created", "site_id", site.ID, "domain", site.Domain)
	return nil
}

// UpdateSite updates an existing site
func (s *NginxService) UpdateSite(id string, updates map[string]interface{}) error {
	var site models.NginxSite
	if err := s.db.First(&site, "id = ?", id).Error; err != nil {
		return err
	}

	// Check if domain is being changed and if new domain already exists
	if domain, ok := updates["domain"].(string); ok && domain != site.Domain {
		var existing models.NginxSite
		if err := s.db.Where("domain = ? AND id != ?", domain, id).First(&existing).Error; err == nil {
			return fmt.Errorf("domain %s already exists", domain)
		}
	}

	// Update in database
	if err := s.db.Model(&site).Updates(updates).Error; err != nil {
		return err
	}

	// Reload site to get updated data
	if err := s.db.First(&site, "id = ?", id).Error; err != nil {
		return err
	}

	// Regenerate config
	if err := s.writeSiteConfig(&site); err != nil {
		s.log.Error("Failed to update nginx config", "error", err, "site_id", site.ID)
	}

	s.log.Info("Nginx site updated", "site_id", site.ID)
	return nil
}

// DeleteSite deletes a site
func (s *NginxService) DeleteSite(id string) error {
	var site models.NginxSite
	if err := s.db.First(&site, "id = ?", id).Error; err != nil {
		return err
	}

	// Delete config file
	configPath := s.getSiteConfigPath(&site)
	if err := os.Remove(configPath); err != nil && !os.IsNotExist(err) {
		s.log.Warn("Failed to remove nginx config file", "error", err, "path", configPath)
	}

	// Delete from database
	if err := s.db.Delete(&site).Error; err != nil {
		return err
	}

	s.log.Info("Nginx site deleted", "site_id", site.ID, "domain", site.Domain)
	return nil
}

// EnableSite enables a site
func (s *NginxService) EnableSite(id string) error {
	return s.UpdateSite(id, map[string]interface{}{"enabled": true})
}

// DisableSite disables a site
func (s *NginxService) DisableSite(id string) error {
	return s.UpdateSite(id, map[string]interface{}{"enabled": false})
}

// ListCertificates returns all SSL certificates
func (s *NginxService) ListCertificates(nodeID string) ([]models.SSLCertificate, error) {
	var certs []models.SSLCertificate
	query := s.db.Order("expires_at ASC")

	if nodeID != "" {
		query = query.Where("node_id = ?", nodeID)
	}

	if err := query.Find(&certs).Error; err != nil {
		return nil, err
	}
	return certs, nil
}

// GetCertificate returns a certificate by ID
func (s *NginxService) GetCertificate(id string) (*models.SSLCertificate, error) {
	var cert models.SSLCertificate
	if err := s.db.First(&cert, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &cert, nil
}

// CreateCertificate creates a new SSL certificate
func (s *NginxService) CreateCertificate(cert *models.SSLCertificate) error {
	if cert.Domain == "" {
		return fmt.Errorf("domain is required")
	}

	// If Let's Encrypt, use certbot to generate certificate
	if cert.Type == "letsencrypt" {
		return s.createLetsEncryptCert(cert)
	}

	// For custom certificates, validate paths
	if cert.CertPath == "" || cert.KeyPath == "" {
		return fmt.Errorf("cert_path and key_path are required for custom certificates")
	}

	// Save to database
	if err := s.db.Create(cert).Error; err != nil {
		return err
	}

	s.log.Info("SSL certificate created", "cert_id", cert.ID, "domain", cert.Domain, "type", cert.Type)
	return nil
}

// createLetsEncryptCert creates a Let's Encrypt certificate using certbot
func (s *NginxService) createLetsEncryptCert(cert *models.SSLCertificate) error {
	// Check if certbot is available
	if _, err := exec.LookPath("certbot"); err != nil {
		return fmt.Errorf("certbot is not installed. Please install certbot to use Let's Encrypt")
	}

	// Run certbot
	cmd := exec.Command("certbot", "certonly", "--standalone", "--non-interactive", "--agree-tos",
		"--email", "admin@example.com", // TODO: Get from config
		"-d", cert.Domain,
		"--cert-path", "/etc/letsencrypt/live/"+cert.Domain+"/fullchain.pem",
		"--key-path", "/etc/letsencrypt/live/"+cert.Domain+"/privkey.pem")

	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("certbot failed: %s", stderr.String())
	}

	// Set certificate paths
	cert.CertPath = fmt.Sprintf("/etc/letsencrypt/live/%s/fullchain.pem", cert.Domain)
	cert.KeyPath = fmt.Sprintf("/etc/letsencrypt/live/%s/privkey.pem", cert.Domain)
	cert.ChainPath = cert.CertPath

	// Get expiration date (Let's Encrypt certs expire in 90 days)
	cert.ExpiresAt = time.Now().Add(90 * 24 * time.Hour)

	// Save to database
	if err := s.db.Create(cert).Error; err != nil {
		return err
	}

	s.log.Info("Let's Encrypt certificate created", "cert_id", cert.ID, "domain", cert.Domain)
	return nil
}

// DeleteCertificate deletes a certificate
func (s *NginxService) DeleteCertificate(id string) error {
	var cert models.SSLCertificate
	if err := s.db.First(&cert, "id = ?", id).Error; err != nil {
		return err
	}

	// Check if certificate is in use
	var sites []models.NginxSite
	s.db.Where("ssl_cert_id = ?", id).Find(&sites)
	if len(sites) > 0 {
		return fmt.Errorf("certificate is in use by %d site(s)", len(sites))
	}

	// Delete from database
	if err := s.db.Delete(&cert).Error; err != nil {
		return err
	}

	s.log.Info("SSL certificate deleted", "cert_id", cert.ID, "domain", cert.Domain)
	return nil
}

// RenewCertificate renews a Let's Encrypt certificate
func (s *NginxService) RenewCertificate(id string) error {
	cert, err := s.GetCertificate(id)
	if err != nil {
		return err
	}

	if cert.Type != "letsencrypt" {
		return fmt.Errorf("only Let's Encrypt certificates can be renewed automatically")
	}

	// Run certbot renew
	cmd := exec.Command("certbot", "renew", "--cert-name", cert.Domain, "--non-interactive")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("certbot renew failed: %s", stderr.String())
	}

	// Update renewal time
	now := time.Now()
	cert.LastRenewed = &now
	cert.ExpiresAt = now.Add(90 * 24 * time.Hour)
	s.db.Save(cert)

	s.log.Info("SSL certificate renewed", "cert_id", cert.ID, "domain", cert.Domain)
	return nil
}

// GetAccessLogs returns nginx access logs
func (s *NginxService) GetAccessLogs(siteID string, lines int) ([]string, error) {
	if lines <= 0 {
		lines = 100
	}

	var site models.NginxSite
	if siteID != "" {
		if err := s.db.First(&site, "id = ?", siteID).Error; err != nil {
			return nil, err
		}
		// Use site-specific log if available
		logPath := fmt.Sprintf("/var/log/nginx/%s.access.log", site.Domain)
		return s.readLogFile(logPath, lines)
	}

	// Use default nginx access log
	return s.readLogFile("/var/log/nginx/access.log", lines)
}

// GetErrorLogs returns nginx error logs
func (s *NginxService) GetErrorLogs(siteID string, lines int) ([]string, error) {
	if lines <= 0 {
		lines = 100
	}

	var site models.NginxSite
	if siteID != "" {
		if err := s.db.First(&site, "id = ?", siteID).Error; err != nil {
			return nil, err
		}
		// Use site-specific log if available
		logPath := fmt.Sprintf("/var/log/nginx/%s.error.log", site.Domain)
		return s.readLogFile(logPath, lines)
	}

	// Use default nginx error log
	return s.readLogFile("/var/log/nginx/error.log", lines)
}

// readLogFile reads the last N lines from a log file
func (s *NginxService) readLogFile(path string, lines int) ([]string, error) {
	// Use tail command to read last N lines
	cmd := exec.Command("tail", "-n", fmt.Sprintf("%d", lines), path)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		// If file doesn't exist, return empty array
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("failed to read log file: %s", stderr.String())
	}

	// Split by newlines
	content := stdout.String()
	if content == "" {
		return []string{}, nil
	}

	logLines := strings.Split(strings.TrimRight(content, "\n"), "\n")
	return logLines, nil
}

// LogEntry represents a parsed nginx access log entry
type LogEntry struct {
	IP        string
	Time      time.Time
	Method    string
	Path      string
	Status    int
	Bytes     int64
	Referer   string
	UserAgent string
}

// GetAnalytics returns site analytics parsed from access logs
func (s *NginxService) GetAnalytics(siteID string, days int) (map[string]interface{}, error) {
	if days <= 0 {
		days = 30
	}

	var site models.NginxSite
	logPath := "/var/log/nginx/access.log"

	if siteID != "" {
		if err := s.db.First(&site, "id = ?", siteID).Error; err != nil {
			return nil, err
		}
		logPath = fmt.Sprintf("/var/log/nginx/%s.access.log", site.Domain)
	}

	// Parse logs from the specified time range
	cutoffTime := time.Now().AddDate(0, 0, -days)
	entries, err := s.parseAccessLogs(logPath, cutoffTime)
	if err != nil {
		// If log file doesn't exist, return empty stats
		if os.IsNotExist(err) {
			return s.emptyAnalytics(), nil
		}
		return nil, fmt.Errorf("failed to parse access logs: %w", err)
	}

	// Calculate statistics
	stats := s.calculateStats(entries)

	return stats, nil
}

// parseAccessLogs parses nginx access logs and returns entries within the time range
func (s *NginxService) parseAccessLogs(logPath string, cutoffTime time.Time) ([]LogEntry, error) {
	file, err := os.Open(logPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var entries []LogEntry
	scanner := bufio.NewScanner(file)

	// Increase buffer size for long lines
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	// Nginx combined log format regex:
	// $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
	// Example: 192.168.1.1 - - [25/Dec/2023:10:15:30 +0000] "GET /page.html HTTP/1.1" 200 1234 "-" "Mozilla/5.0..."
	logRegex := regexp.MustCompile(`^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) ([^"]+)" (\d+) (\d+) "([^"]*)" "([^"]*)"`)

	// For performance, read from end of file if cutoff time is recent
	// Otherwise read entire file
	fileInfo, _ := file.Stat()
	fileSize := fileInfo.Size()

	// If file is large and we only need recent data, start from a reasonable position
	// For now, we'll read the entire file but optimize later if needed
	lineCount := 0
	maxLines := 1000000 // Limit to prevent memory issues

	for scanner.Scan() {
		lineCount++
		if lineCount > maxLines {
			s.log.Warn("Log file too large, truncating analysis", "lines_read", lineCount, "file_size", fileSize)
			break
		}

		line := scanner.Text()
		if line == "" {
			continue
		}

		matches := logRegex.FindStringSubmatch(line)
		if len(matches) < 10 {
			// Try simpler format if combined format doesn't match
			simpleEntries := s.parseSimpleLogLine(line, cutoffTime)
			if len(simpleEntries) > 0 {
				entries = append(entries, simpleEntries...)
			}
			continue
		}

		// Parse time
		timeStr := matches[3]
		logTime, err := s.parseLogTime(timeStr)
		if err != nil {
			continue
		}

		// Skip entries outside time range
		if logTime.Before(cutoffTime) {
			continue
		}

		// Parse status and bytes
		status, _ := strconv.Atoi(matches[7])
		bytes, _ := strconv.ParseInt(matches[8], 10, 64)

		entry := LogEntry{
			IP:        matches[1],
			Time:      logTime,
			Method:    matches[4],
			Path:      matches[5],
			Status:    status,
			Bytes:     bytes,
			Referer:   matches[9],
			UserAgent: matches[10],
		}

		entries = append(entries, entry)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return entries, nil
}

// parseSimpleLogLine attempts to parse a simpler log format
func (s *NginxService) parseSimpleLogLine(line string, cutoffTime time.Time) []LogEntry {
	// Try to extract basic info from simpler formats
	parts := strings.Fields(line)
	if len(parts) < 7 {
		return nil
	}

	// Look for timestamp pattern
	timePattern := regexp.MustCompile(`\[([^\]]+)\]`)
	timeMatches := timePattern.FindStringSubmatch(line)
	if len(timeMatches) < 2 {
		return nil
	}

	logTime, err := s.parseLogTime(timeMatches[1])
	if err != nil {
		return nil
	}

	if logTime.Before(cutoffTime) {
		return nil
	}

	// Extract IP (first field)
	ip := parts[0]

	// Extract request (look for quoted string)
	requestPattern := regexp.MustCompile(`"(\S+) (\S+)`)
	requestMatches := requestPattern.FindStringSubmatch(line)
	if len(requestMatches) < 3 {
		return nil
	}

	method := requestMatches[1]
	path := requestMatches[2]

	// Extract status code (usually after request)
	var status int
	var bytes int64
	for i, part := range parts {
		if statusCode, err := strconv.Atoi(part); err == nil && statusCode >= 100 && statusCode < 600 {
			status = statusCode
			if i+1 < len(parts) {
				bytes, _ = strconv.ParseInt(parts[i+1], 10, 64)
			}
			break
		}
	}

	if status == 0 {
		return nil
	}

	return []LogEntry{{
		IP:     ip,
		Time:   logTime,
		Method: method,
		Path:   path,
		Status: status,
		Bytes:  bytes,
	}}
}

// parseLogTime parses nginx log time format
func (s *NginxService) parseLogTime(timeStr string) (time.Time, error) {
	// Nginx time format: 25/Dec/2023:10:15:30 +0000
	formats := []string{
		"02/Jan/2006:15:04:05 -0700",
		"02/Jan/2006:15:04:05 +0000",
		"02/Jan/2006:15:04:05",
		time.RFC3339,
		time.RFC3339Nano,
	}

	for _, format := range formats {
		if t, err := time.Parse(format, timeStr); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse time: %s", timeStr)
}

// calculateStats calculates statistics from log entries
func (s *NginxService) calculateStats(entries []LogEntry) map[string]interface{} {
	if len(entries) == 0 {
		return s.emptyAnalytics()
	}

	var totalRequests int64
	var totalBytes int64
	uniqueIPs := make(map[string]bool)
	pathCounts := make(map[string]int64)
	statusCounts := make(map[int]int64)

	for _, entry := range entries {
		totalRequests++
		totalBytes += entry.Bytes
		uniqueIPs[entry.IP] = true

		// Count paths (normalize by removing query strings)
		path := entry.Path
		if idx := strings.Index(path, "?"); idx != -1 {
			path = path[:idx]
		}
		pathCounts[path]++

		// Count status codes
		statusCounts[entry.Status]++
	}

	// Get top pages
	topPages := s.getTopPages(pathCounts, 10)

	// Format bandwidth
	bandwidth := s.formatBytes(totalBytes)

	return map[string]interface{}{
		"requests":        totalRequests,
		"bandwidth":       bandwidth,
		"bandwidth_bytes": totalBytes,
		"unique_visitors": len(uniqueIPs),
		"top_pages":       topPages,
		"status_codes":    statusCounts,
		"total_entries":   len(entries),
	}
}

// getTopPages returns the top N pages by request count
func (s *NginxService) getTopPages(pathCounts map[string]int64, n int) []map[string]interface{} {
	type pageStat struct {
		Path     string
		Requests int64
	}

	var pages []pageStat
	for path, count := range pathCounts {
		pages = append(pages, pageStat{Path: path, Requests: count})
	}

	// Sort by request count (descending)
	for i := 0; i < len(pages)-1; i++ {
		for j := i + 1; j < len(pages); j++ {
			if pages[i].Requests < pages[j].Requests {
				pages[i], pages[j] = pages[j], pages[i]
			}
		}
	}

	// Take top N
	if n > len(pages) {
		n = len(pages)
	}

	result := make([]map[string]interface{}, n)
	for i := 0; i < n; i++ {
		result[i] = map[string]interface{}{
			"path":     pages[i].Path,
			"requests": pages[i].Requests,
		}
	}

	return result
}

// formatBytes formats bytes into human-readable format
func (s *NginxService) formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// emptyAnalytics returns empty analytics data
func (s *NginxService) emptyAnalytics() map[string]interface{} {
	return map[string]interface{}{
		"requests":        int64(0),
		"bandwidth":       "0 B",
		"bandwidth_bytes": int64(0),
		"unique_visitors": 0,
		"top_pages":       []map[string]interface{}{},
		"status_codes":    map[int]int64{},
		"total_entries":   0,
	}
}

// writeSiteConfig writes nginx configuration for a site
func (s *NginxService) writeSiteConfig(site *models.NginxSite) error {
	configPath := s.getSiteConfigPath(site)
	configDir := filepath.Dir(configPath)

	// Create directory if it doesn't exist
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Generate config content
	config, err := s.generateSiteConfig(site)
	if err != nil {
		return err
	}

	// Write config file
	if err := os.WriteFile(configPath, []byte(config), 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	// If site is disabled, remove from sites-enabled
	if !site.Enabled {
		enabledPath := s.getSiteEnabledPath(site)
		os.Remove(enabledPath)
	} else {
		// Create symlink in sites-enabled
		enabledPath := s.getSiteEnabledPath(site)
		os.Remove(enabledPath) // Remove existing symlink if any
		if err := os.Symlink(configPath, enabledPath); err != nil && !os.IsExist(err) {
			s.log.Warn("Failed to create symlink", "error", err, "path", enabledPath)
		}
	}

	return nil
}

// getSiteConfigPath returns the path to the site's nginx config file
func (s *NginxService) getSiteConfigPath(site *models.NginxSite) string {
	// Use /etc/nginx/sites-available/ as default
	return fmt.Sprintf("/etc/nginx/sites-available/%s.conf", site.Domain)
}

// getSiteEnabledPath returns the path to the site's enabled symlink
func (s *NginxService) getSiteEnabledPath(site *models.NginxSite) string {
	return fmt.Sprintf("/etc/nginx/sites-enabled/%s.conf", site.Domain)
}

// generateSiteConfig generates nginx configuration for a site
func (s *NginxService) generateSiteConfig(site *models.NginxSite) (string, error) {
	tmpl := `{{if .SSLEnabled}}
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name {{.Domain}}{{range .Aliases}} {{.}}{{end}};
    return 301 https://$server_name$request_uri;
}
{{end}}

# Main server block
server {
    listen {{.Port}}{{if .SSLEnabled}} ssl http2{{end}};
    server_name {{.Domain}}{{range .Aliases}} {{.}}{{end}};

    {{if .SSLEnabled}}
    # SSL configuration
    ssl_certificate {{.SSLCertPath}};
    ssl_certificate_key {{.SSLKeyPath}};
    {{if .SSLChainPath}}
    ssl_trusted_certificate {{.SSLChainPath}};
    {{end}}
    
    # SSL optimization
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    {{end}}

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    {{if .ProxyEnabled}}
    # Reverse proxy configuration
    location / {
        proxy_pass {{.ProxyTarget}};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    {{else}}
    # Static/PHP file serving
    root {{.RootPath}};
    index index.html index.htm index.php;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    {{if .PHPEnabled}}
    # PHP configuration
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php{{.PHPVersion}}-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    {{end}}

    # Main location
    location / {
        try_files $uri $uri/ /index.html;
    }
    {{end}}

    {{if .CustomConfig}}
    # Custom configuration
{{.CustomConfig}}
    {{end}}

    # Disable access to hidden files
    location ~ /\. {
        deny all;
    }

    # Logging
    access_log /var/log/nginx/{{.Domain}}.access.log;
    error_log /var/log/nginx/{{.Domain}}.error.log;
}
`

	t := template.Must(template.New("nginx").Parse(tmpl))

	// Get SSL certificate paths if SSL is enabled
	var sslCertPath, sslKeyPath, sslChainPath string
	if site.SSLEnabled && site.SSLCertID != "" {
		var cert models.SSLCertificate
		if err := s.db.First(&cert, "id = ?", site.SSLCertID).Error; err == nil {
			sslCertPath = cert.CertPath
			sslKeyPath = cert.KeyPath
			sslChainPath = cert.ChainPath
		}
	}

	data := struct {
		*models.NginxSite
		SSLCertPath  string
		SSLKeyPath   string
		SSLChainPath string
		CustomConfig string
	}{
		NginxSite:    site,
		SSLCertPath:  sslCertPath,
		SSLKeyPath:   sslKeyPath,
		SSLChainPath: sslChainPath,
		CustomConfig: site.Config,
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to generate config: %w", err)
	}

	return buf.String(), nil
}
