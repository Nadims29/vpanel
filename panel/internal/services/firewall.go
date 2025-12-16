package services

import (
	"bytes"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/vpanel/server/internal/models"
	"github.com/vpanel/server/pkg/logger"
	"gorm.io/gorm"
)

// FirewallBackend represents the type of firewall being used
type FirewallBackend string

const (
	FirewallBackendUFW      FirewallBackend = "ufw"
	FirewallBackendIPTables FirewallBackend = "iptables"
	FirewallBackendNone     FirewallBackend = "none"
)

// FirewallManager handles real firewall operations
type FirewallManager struct {
	db         *gorm.DB
	log        *logger.Logger
	backend    FirewallBackend
	mu         sync.Mutex
	vpanelPort int // VPanel server port to allow
}

// NewFirewallManager creates a new firewall manager
func NewFirewallManager(db *gorm.DB, log *logger.Logger, vpanelPort int) *FirewallManager {
	if vpanelPort <= 0 {
		vpanelPort = 8080 // default VPanel port
	}
	fm := &FirewallManager{
		db:         db,
		log:        log,
		vpanelPort: vpanelPort,
	}
	fm.detectBackend()
	return fm
}

// detectBackend detects available firewall backend
func (fm *FirewallManager) detectBackend() {
	// Check for ufw first (user-friendly)
	if _, err := exec.LookPath("ufw"); err == nil {
		fm.backend = FirewallBackendUFW
		fm.log.Info("Firewall backend detected", "backend", "ufw")
		return
	}

	// Check for iptables
	if _, err := exec.LookPath("iptables"); err == nil {
		fm.backend = FirewallBackendIPTables
		fm.log.Info("Firewall backend detected", "backend", "iptables")
		return
	}

	fm.backend = FirewallBackendNone
	fm.log.Warn("No firewall backend detected")
}

// getSSHPort reads the SSH port from sshd_config, defaults to 22
func (fm *FirewallManager) getSSHPort() int {
	// Try to read from sshd_config
	content, err := exec.Command("grep", "-E", "^Port\\s+", "/etc/ssh/sshd_config").Output()
	if err == nil {
		line := strings.TrimSpace(string(content))
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			if port, err := strconv.Atoi(parts[1]); err == nil && port > 0 {
				return port
			}
		}
	}
	return 22 // default SSH port
}


// GetBackend returns the detected firewall backend
func (fm *FirewallManager) GetBackend() FirewallBackend {
	return fm.backend
}

// GetStatus returns the real firewall status
func (fm *FirewallManager) GetStatus() (map[string]interface{}, error) {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	result := map[string]interface{}{
		"backend":     string(fm.backend),
		"enabled":     false,
		"activeRules": 0,
		"blockedIPs":  0,
	}

	switch fm.backend {
	case FirewallBackendUFW:
		return fm.getUFWStatus(result)
	case FirewallBackendIPTables:
		return fm.getIPTablesStatus(result)
	default:
		return result, nil
	}
}

// getUFWStatus gets UFW firewall status
func (fm *FirewallManager) getUFWStatus(result map[string]interface{}) (map[string]interface{}, error) {
	cmd := exec.Command("ufw", "status", "verbose")
	output, err := cmd.Output()
	if err != nil {
		// Try with sudo
		cmd = exec.Command("sudo", "ufw", "status", "verbose")
		output, err = cmd.Output()
		if err != nil {
			fm.log.Warn("Failed to get UFW status", "error", err)
			return result, nil
		}
	}

	outputStr := string(output)
	result["enabled"] = strings.Contains(outputStr, "Status: active")

	// Count rules
	lines := strings.Split(outputStr, "\n")
	ruleCount := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "Status:") &&
			!strings.HasPrefix(line, "Logging:") &&
			!strings.HasPrefix(line, "Default:") &&
			!strings.HasPrefix(line, "To") &&
			!strings.HasPrefix(line, "--") {
			ruleCount++
		}
	}
	result["activeRules"] = ruleCount

	return result, nil
}

// getIPTablesStatus gets iptables status
func (fm *FirewallManager) getIPTablesStatus(result map[string]interface{}) (map[string]interface{}, error) {
	// Check if iptables has any rules (besides default)
	cmd := exec.Command("iptables", "-L", "-n", "--line-numbers")
	output, err := cmd.Output()
	if err != nil {
		// Try with sudo
		cmd = exec.Command("sudo", "iptables", "-L", "-n", "--line-numbers")
		output, err = cmd.Output()
		if err != nil {
			fm.log.Warn("Failed to get iptables status", "error", err)
			return result, nil
		}
	}

	outputStr := string(output)
	lines := strings.Split(outputStr, "\n")

	// Count actual rules (excluding headers)
	ruleCount := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Rule lines start with a number
		if len(line) > 0 && line[0] >= '0' && line[0] <= '9' {
			ruleCount++
		}
	}

	result["activeRules"] = ruleCount
	result["enabled"] = ruleCount > 0

	return result, nil
}

// EnableFirewall enables the firewall
func (fm *FirewallManager) EnableFirewall() error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	// IMPORTANT: Allow essential ports BEFORE enabling firewall to prevent lockout
	fm.log.Info("Allowing essential ports before enabling firewall...")
	if err := fm.allowEssentialPortsLocked(); err != nil {
		fm.log.Warn("Failed to allow some essential ports", "error", err)
	}

	switch fm.backend {
	case FirewallBackendUFW:
		// Enable UFW with default deny
		cmd := exec.Command("sudo", "ufw", "--force", "enable")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to enable UFW: %w", err)
		}
		fm.log.Info("UFW enabled")
		return nil

	case FirewallBackendIPTables:
		// Allow established connections first
		cmd := exec.Command("sudo", "iptables", "-A", "INPUT", "-m", "state", "--state", "ESTABLISHED,RELATED", "-j", "ACCEPT")
		cmd.Run() // Ignore error if rule exists
		// Allow loopback
		cmd = exec.Command("sudo", "iptables", "-A", "INPUT", "-i", "lo", "-j", "ACCEPT")
		cmd.Run() // Ignore error if rule exists
		// For iptables, we set default policy to DROP for INPUT (do this LAST)
		cmd = exec.Command("sudo", "iptables", "-P", "INPUT", "DROP")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to set iptables INPUT policy: %w", err)
		}
		fm.log.Info("iptables firewall enabled")
		return nil

	default:
		return fmt.Errorf("no firewall backend available")
	}
}

// allowEssentialPortsLocked allows SSH and VPanel ports (must be called with lock held)
func (fm *FirewallManager) allowEssentialPortsLocked() error {
	sshPort := fm.getSSHPort()

	switch fm.backend {
	case FirewallBackendUFW:
		// Allow SSH port
		cmd := exec.Command("sudo", "ufw", "allow", strconv.Itoa(sshPort)+"/tcp", "comment", "vpanel:ssh")
		if err := cmd.Run(); err != nil {
			fm.log.Warn("Failed to allow SSH port", "port", sshPort, "error", err)
		} else {
			fm.log.Info("Allowed SSH port", "port", sshPort)
		}

		// Allow VPanel port
		cmd = exec.Command("sudo", "ufw", "allow", strconv.Itoa(fm.vpanelPort)+"/tcp", "comment", "vpanel:panel")
		if err := cmd.Run(); err != nil {
			fm.log.Warn("Failed to allow VPanel port", "port", fm.vpanelPort, "error", err)
		} else {
			fm.log.Info("Allowed VPanel port", "port", fm.vpanelPort)
		}

	case FirewallBackendIPTables:
		// Allow SSH port
		cmd := exec.Command("sudo", "iptables", "-I", "INPUT", "1", "-p", "tcp", "--dport", strconv.Itoa(sshPort), "-j", "ACCEPT", "-m", "comment", "--comment", "vpanel:ssh")
		if err := cmd.Run(); err != nil {
			fm.log.Warn("Failed to allow SSH port", "port", sshPort, "error", err)
		} else {
			fm.log.Info("Allowed SSH port", "port", sshPort)
		}

		// Allow VPanel port
		cmd = exec.Command("sudo", "iptables", "-I", "INPUT", "1", "-p", "tcp", "--dport", strconv.Itoa(fm.vpanelPort), "-j", "ACCEPT", "-m", "comment", "--comment", "vpanel:panel")
		if err := cmd.Run(); err != nil {
			fm.log.Warn("Failed to allow VPanel port", "port", fm.vpanelPort, "error", err)
		} else {
			fm.log.Info("Allowed VPanel port", "port", fm.vpanelPort)
		}
	}

	return nil
}

// DisableFirewall disables the firewall
func (fm *FirewallManager) DisableFirewall() error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	switch fm.backend {
	case FirewallBackendUFW:
		cmd := exec.Command("sudo", "ufw", "disable")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to disable UFW: %w", err)
		}
		fm.log.Info("UFW disabled")
		return nil

	case FirewallBackendIPTables:
		// Set default policy to ACCEPT for INPUT
		cmd := exec.Command("sudo", "iptables", "-P", "INPUT", "ACCEPT")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to set iptables INPUT policy: %w", err)
		}
		fm.log.Info("iptables firewall disabled")
		return nil

	default:
		return fmt.Errorf("no firewall backend available")
	}
}

// ApplyRule applies a firewall rule to the system
func (fm *FirewallManager) ApplyRule(rule *models.FirewallRule) error {
	if !rule.Enabled {
		return nil // Don't apply disabled rules
	}

	fm.mu.Lock()
	defer fm.mu.Unlock()

	switch fm.backend {
	case FirewallBackendUFW:
		return fm.applyUFWRule(rule)
	case FirewallBackendIPTables:
		return fm.applyIPTablesRule(rule)
	default:
		return fmt.Errorf("no firewall backend available")
	}
}

// RemoveRule removes a firewall rule from the system
func (fm *FirewallManager) RemoveRule(rule *models.FirewallRule) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	switch fm.backend {
	case FirewallBackendUFW:
		return fm.removeUFWRule(rule)
	case FirewallBackendIPTables:
		return fm.removeIPTablesRule(rule)
	default:
		return fmt.Errorf("no firewall backend available")
	}
}

// applyUFWRule applies a rule using UFW
func (fm *FirewallManager) applyUFWRule(rule *models.FirewallRule) error {
	args := fm.buildUFWArgs(rule, false)
	cmd := exec.Command("sudo", args...)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		// Check if rule already exists
		if strings.Contains(stderr.String(), "Skipping") {
			return nil
		}
		return fmt.Errorf("failed to apply UFW rule: %s", stderr.String())
	}

	fm.log.Info("UFW rule applied", "rule_id", rule.ID, "name", rule.Name)
	return nil
}

// removeUFWRule removes a rule using UFW
func (fm *FirewallManager) removeUFWRule(rule *models.FirewallRule) error {
	args := fm.buildUFWArgs(rule, true)
	cmd := exec.Command("sudo", args...)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		// Ignore if rule doesn't exist
		if strings.Contains(stderr.String(), "Could not delete non-existent rule") {
			return nil
		}
		return fmt.Errorf("failed to remove UFW rule: %s", stderr.String())
	}

	fm.log.Info("UFW rule removed", "rule_id", rule.ID, "name", rule.Name)
	return nil
}

// buildUFWArgs builds UFW command arguments
func (fm *FirewallManager) buildUFWArgs(rule *models.FirewallRule, delete bool) []string {
	args := []string{"ufw"}

	if delete {
		args = append(args, "delete")
	}

	// Action: allow or deny
	args = append(args, rule.Action)

	// Direction
	if rule.Direction == "in" {
		args = append(args, "in")
	} else {
		args = append(args, "out")
	}

	// Source
	if rule.Source != "" && rule.Source != "any" {
		args = append(args, "from", rule.Source)
	}

	// Destination
	if rule.Destination != "" && rule.Destination != "any" {
		args = append(args, "to", rule.Destination)
	}

	// Port and protocol
	if rule.Port != "" {
		args = append(args, "port", rule.Port)
	}

	if rule.Protocol != "" && rule.Protocol != "all" {
		args = append(args, "proto", rule.Protocol)
	}

	// Add comment with rule ID for tracking
	if !delete {
		args = append(args, "comment", fmt.Sprintf("vpanel:%s", rule.ID))
	}

	return args
}

// applyIPTablesRule applies a rule using iptables
func (fm *FirewallManager) applyIPTablesRule(rule *models.FirewallRule) error {
	args := fm.buildIPTablesArgs(rule, "-A")
	cmd := exec.Command("sudo", args...)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to apply iptables rule: %s", stderr.String())
	}

	fm.log.Info("iptables rule applied", "rule_id", rule.ID, "name", rule.Name)
	return nil
}

// removeIPTablesRule removes a rule using iptables
func (fm *FirewallManager) removeIPTablesRule(rule *models.FirewallRule) error {
	args := fm.buildIPTablesArgs(rule, "-D")
	cmd := exec.Command("sudo", args...)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	// Try to remove the rule (may fail if it doesn't exist)
	if err := cmd.Run(); err != nil {
		// Ignore "No chain/target/match by that name" errors
		errStr := stderr.String()
		if strings.Contains(errStr, "No chain") || strings.Contains(errStr, "does a matching rule exist") {
			return nil
		}
		return fmt.Errorf("failed to remove iptables rule: %s", errStr)
	}

	fm.log.Info("iptables rule removed", "rule_id", rule.ID, "name", rule.Name)
	return nil
}

// buildIPTablesArgs builds iptables command arguments
func (fm *FirewallManager) buildIPTablesArgs(rule *models.FirewallRule, action string) []string {
	args := []string{"iptables"}

	// Chain based on direction
	chain := "INPUT"
	if rule.Direction == "out" {
		chain = "OUTPUT"
	}

	args = append(args, action, chain)

	// Protocol
	if rule.Protocol != "" && rule.Protocol != "all" {
		args = append(args, "-p", rule.Protocol)
	}

	// Source
	if rule.Source != "" && rule.Source != "any" {
		args = append(args, "-s", rule.Source)
	}

	// Destination
	if rule.Destination != "" && rule.Destination != "any" {
		args = append(args, "-d", rule.Destination)
	}

	// Port (for tcp/udp)
	if rule.Port != "" && (rule.Protocol == "tcp" || rule.Protocol == "udp") {
		// Handle port ranges and multiple ports
		if strings.Contains(rule.Port, "-") {
			// Port range
			args = append(args, "--dport", rule.Port)
		} else if strings.Contains(rule.Port, ",") {
			// Multiple ports - use multiport
			args = append(args, "-m", "multiport", "--dports", rule.Port)
		} else {
			args = append(args, "--dport", rule.Port)
		}
	}

	// Target based on action
	target := "ACCEPT"
	if rule.Action == "deny" {
		target = "DROP"
	}

	args = append(args, "-j", target)

	// Add comment for tracking
	args = append(args, "-m", "comment", "--comment", fmt.Sprintf("vpanel:%s", rule.ID))

	return args
}

// SyncRules synchronizes all enabled rules from database to system
func (fm *FirewallManager) SyncRules() error {
	var rules []models.FirewallRule
	if err := fm.db.Where("enabled = ?", true).Order("priority ASC").Find(&rules).Error; err != nil {
		return err
	}

	for _, rule := range rules {
		if err := fm.ApplyRule(&rule); err != nil {
			fm.log.Warn("Failed to sync rule", "rule_id", rule.ID, "error", err)
		}
	}

	return nil
}

// ListSystemRules lists current system firewall rules
func (fm *FirewallManager) ListSystemRules() ([]map[string]interface{}, error) {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	switch fm.backend {
	case FirewallBackendUFW:
		return fm.listUFWRules()
	case FirewallBackendIPTables:
		return fm.listIPTablesRules()
	default:
		return []map[string]interface{}{}, nil
	}
}

// listUFWRules lists UFW rules
func (fm *FirewallManager) listUFWRules() ([]map[string]interface{}, error) {
	cmd := exec.Command("sudo", "ufw", "status", "numbered")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var rules []map[string]interface{}
	lines := strings.Split(string(output), "\n")

	// Parse UFW numbered output
	re := regexp.MustCompile(`\[\s*(\d+)\]\s+(.+)`)
	for _, line := range lines {
		matches := re.FindStringSubmatch(line)
		if len(matches) >= 3 {
			rules = append(rules, map[string]interface{}{
				"number": matches[1],
				"rule":   strings.TrimSpace(matches[2]),
			})
		}
	}

	return rules, nil
}

// listIPTablesRules lists iptables rules
func (fm *FirewallManager) listIPTablesRules() ([]map[string]interface{}, error) {
	cmd := exec.Command("sudo", "iptables", "-L", "-n", "-v", "--line-numbers")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var rules []map[string]interface{}
	lines := strings.Split(string(output), "\n")
	currentChain := ""

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Detect chain header
		if strings.HasPrefix(line, "Chain ") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				currentChain = parts[1]
			}
			continue
		}

		// Skip header line
		if strings.HasPrefix(line, "num") || line == "" {
			continue
		}

		// Parse rule line
		fields := strings.Fields(line)
		if len(fields) >= 1 {
			num, err := strconv.Atoi(fields[0])
			if err != nil {
				continue
			}
			rules = append(rules, map[string]interface{}{
				"chain":  currentChain,
				"number": num,
				"rule":   line,
			})
		}
	}

	return rules, nil
}

// GetFail2BanStatus returns real Fail2Ban status
func (fm *FirewallManager) GetFail2BanStatus() (map[string]interface{}, error) {
	result := map[string]interface{}{
		"installed":   false,
		"enabled":     false,
		"activeJails": 0,
		"bannedIPs":   0,
	}

	// Check if fail2ban-client exists
	if _, err := exec.LookPath("fail2ban-client"); err != nil {
		return result, nil
	}
	result["installed"] = true

	// Get fail2ban status
	cmd := exec.Command("sudo", "fail2ban-client", "status")
	output, err := cmd.Output()
	if err != nil {
		return result, nil
	}

	outputStr := string(output)
	result["enabled"] = true

	// Parse number of jails
	re := regexp.MustCompile(`Number of jail:\s*(\d+)`)
	if matches := re.FindStringSubmatch(outputStr); len(matches) >= 2 {
		if count, err := strconv.Atoi(matches[1]); err == nil {
			result["activeJails"] = count
		}
	}

	// Get banned IPs count from each jail
	jailRe := regexp.MustCompile(`Jail list:\s*(.+)`)
	if matches := jailRe.FindStringSubmatch(outputStr); len(matches) >= 2 {
		jails := strings.Split(strings.TrimSpace(matches[1]), ",")
		totalBanned := 0
		for _, jail := range jails {
			jail = strings.TrimSpace(jail)
			if jail == "" {
				continue
			}
			cmd := exec.Command("sudo", "fail2ban-client", "status", jail)
			if jailOutput, err := cmd.Output(); err == nil {
				banRe := regexp.MustCompile(`Currently banned:\s*(\d+)`)
				if banMatches := banRe.FindStringSubmatch(string(jailOutput)); len(banMatches) >= 2 {
					if banned, err := strconv.Atoi(banMatches[1]); err == nil {
						totalBanned += banned
					}
				}
			}
		}
		result["bannedIPs"] = totalBanned
	}

	return result, nil
}

// ListFail2BanJails returns all Fail2Ban jails with their status
func (fm *FirewallManager) ListFail2BanJails() ([]map[string]interface{}, error) {
	var jails []map[string]interface{}

	// Check if fail2ban-client exists
	if _, err := exec.LookPath("fail2ban-client"); err != nil {
		return jails, nil
	}

	// Get jail list
	cmd := exec.Command("sudo", "fail2ban-client", "status")
	output, err := cmd.Output()
	if err != nil {
		return jails, nil
	}

	// Parse jail list
	jailRe := regexp.MustCompile(`Jail list:\s*(.+)`)
	matches := jailRe.FindStringSubmatch(string(output))
	if len(matches) < 2 {
		return jails, nil
	}

	jailNames := strings.Split(strings.TrimSpace(matches[1]), ",")
	for _, name := range jailNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}

		jail := map[string]interface{}{
			"name":            name,
			"enabled":         true,
			"currentlyBanned": 0,
			"totalBanned":     0,
			"bannedIPs":       []string{},
		}

		// Get detailed jail status
		cmd := exec.Command("sudo", "fail2ban-client", "status", name)
		if jailOutput, err := cmd.Output(); err == nil {
			jailStr := string(jailOutput)

			// Currently banned
			banRe := regexp.MustCompile(`Currently banned:\s*(\d+)`)
			if m := banRe.FindStringSubmatch(jailStr); len(m) >= 2 {
				if count, err := strconv.Atoi(m[1]); err == nil {
					jail["currentlyBanned"] = count
				}
			}

			// Total banned
			totalRe := regexp.MustCompile(`Total banned:\s*(\d+)`)
			if m := totalRe.FindStringSubmatch(jailStr); len(m) >= 2 {
				if count, err := strconv.Atoi(m[1]); err == nil {
					jail["totalBanned"] = count
				}
			}

			// Banned IP list
			ipRe := regexp.MustCompile(`Banned IP list:\s*(.*)`)
			if m := ipRe.FindStringSubmatch(jailStr); len(m) >= 2 {
				ips := strings.Fields(strings.TrimSpace(m[1]))
				jail["bannedIPs"] = ips
			}
		}

		jails = append(jails, jail)
	}

	return jails, nil
}

// UnbanIP unbans an IP from a Fail2Ban jail
func (fm *FirewallManager) UnbanIP(jailName, ip string) error {
	cmd := exec.Command("sudo", "fail2ban-client", "set", jailName, "unbanip", ip)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to unban IP: %s", stderr.String())
	}

	fm.log.Info("IP unbanned from Fail2Ban", "jail", jailName, "ip", ip)
	return nil
}
