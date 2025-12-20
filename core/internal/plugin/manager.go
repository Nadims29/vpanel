package plugin

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"plugin"
	"runtime"
	"sort"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

// Version information (set via ldflags in main.go)
var (
	CoreVersion   = "dev"
	CoreBuildTime = "unknown"
	CoreGitCommit = "unknown"
)

// SetCoreVersion sets the core version information
func SetCoreVersion(version, buildTime, gitCommit string) {
	CoreVersion = version
	CoreBuildTime = buildTime
	CoreGitCommit = gitCommit
}

// Config holds plugin manager configuration.
type Config struct {
	DataDir    string
	PluginDir  string // Directory for external plugins
	MarketURL  string // Plugin market URL
	AutoUpdate bool
}

// Manager manages plugin lifecycle (both builtin and external).
type Manager struct {
	config          Config
	builtinPlugins  map[string]*LoadedBuiltinPlugin
	externalPlugins map[string]*LoadedExternalPlugin
	order           []string // Plugin load order (dependency-sorted)
	mu              sync.RWMutex
	logger          sdk.Logger
	db              *gorm.DB
	apiClient       *sdk.APIClient
}

// LoadedBuiltinPlugin represents a loaded builtin plugin.
type LoadedBuiltinPlugin struct {
	Plugin      sdk.BuiltinPlugin
	Context     *sdk.PluginContext
	Enabled     bool
	DataDir     string
	ConfigDir   string
	InstalledAt time.Time
}

// LoadedExternalPlugin represents a loaded external plugin.
type LoadedExternalPlugin struct {
	Manifest    *sdk.PluginManifest
	Plugin      sdk.ExternalPlugin
	Context     *sdk.ExternalPluginContext
	Enabled     bool
	DataDir     string
	ConfigDir   string
	PluginPath  string
	Error       string
	InstalledAt time.Time
	UpdatedAt   time.Time
}

// NewManager creates a new plugin manager.
func NewManager(cfg Config, logger sdk.Logger, db *gorm.DB, apiClient *sdk.APIClient) *Manager {
	// Ensure plugin directories exist
	if cfg.DataDir != "" {
		os.MkdirAll(cfg.DataDir, 0755)
	}
	if cfg.PluginDir != "" {
		os.MkdirAll(cfg.PluginDir, 0755)
	}

	return &Manager{
		config:          cfg,
		builtinPlugins:  make(map[string]*LoadedBuiltinPlugin),
		externalPlugins: make(map[string]*LoadedExternalPlugin),
		order:           make([]string, 0),
		logger:          logger,
		db:              db,
		apiClient:       apiClient,
	}
}

// Register registers a builtin plugin.
func (m *Manager) Register(p sdk.BuiltinPlugin) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := p.ID()
	if _, exists := m.builtinPlugins[id]; exists {
		return fmt.Errorf("plugin %s is already registered", id)
	}
	if _, exists := m.externalPlugins[id]; exists {
		return fmt.Errorf("plugin %s is already registered as external", id)
	}

	m.builtinPlugins[id] = &LoadedBuiltinPlugin{
		Plugin:      p,
		Enabled:     true,
		DataDir:     filepath.Join(m.config.DataDir, id),
		InstalledAt: time.Now(),
	}

	m.order = append(m.order, id)

	m.logger.Info("Plugin registered", "plugin", id, "version", p.Version())
	return nil
}

// LoadExternalPlugins loads all external plugins from the plugin directory
func (m *Manager) LoadExternalPlugins() error {
	if m.config.PluginDir == "" {
		return nil
	}

	entries, err := os.ReadDir(m.config.PluginDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var loadErrors []error
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		pluginPath := filepath.Join(m.config.PluginDir, entry.Name())
		if err := m.LoadExternalPlugin(pluginPath); err != nil {
			loadErrors = append(loadErrors, fmt.Errorf("failed to load plugin %s: %w", entry.Name(), err))
			m.logger.Warn("Failed to load external plugin", "plugin", entry.Name(), "error", err)
		}
	}

	if len(loadErrors) > 0 {
		return fmt.Errorf("%d external plugins failed to load", len(loadErrors))
	}

	return nil
}

// LoadExternalPlugin loads a single external plugin from the specified path
func (m *Manager) LoadExternalPlugin(path string) error {
	// Read manifest
	manifestPath := filepath.Join(path, "manifest.json")
	manifestData, err := os.ReadFile(manifestPath)
	if err != nil {
		return fmt.Errorf("failed to read manifest: %w", err)
	}

	var manifest sdk.PluginManifest
	if err := json.Unmarshal(manifestData, &manifest); err != nil {
		return fmt.Errorf("failed to parse manifest: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if plugin is already loaded
	if _, exists := m.builtinPlugins[manifest.ID]; exists {
		return fmt.Errorf("plugin %s is already registered as builtin", manifest.ID)
	}
	if _, exists := m.externalPlugins[manifest.ID]; exists {
		return fmt.Errorf("plugin %s is already loaded", manifest.ID)
	}

	// Check core version compatibility
	if manifest.MinCoreVersion != "" {
		// Simple version check (in production, use semver)
		if manifest.MinCoreVersion > CoreVersion {
			return fmt.Errorf("plugin requires core version %s, but current is %s", manifest.MinCoreVersion, CoreVersion)
		}
	}

	// Create plugin data directory
	dataDir := filepath.Join(m.config.DataDir, manifest.ID)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	// Load the plugin binary if it exists
	var instance sdk.ExternalPlugin
	entryPoint := manifest.EntryPoint
	if entryPoint == "" {
		entryPoint = manifest.ID + ".so"
	}
	pluginPath := filepath.Join(path, entryPoint)

	if _, err := os.Stat(pluginPath); err == nil {
		p, err := plugin.Open(pluginPath)
		if err != nil {
			m.logger.Warn("Failed to open plugin binary", "plugin", manifest.ID, "error", err)
			// Store plugin info without instance
			m.externalPlugins[manifest.ID] = &LoadedExternalPlugin{
				Manifest:    &manifest,
				Plugin:      nil,
				Enabled:     false,
				DataDir:     dataDir,
				ConfigDir:   path,
				PluginPath:  pluginPath,
				Error:       fmt.Sprintf("failed to load: %v", err),
				InstalledAt: time.Now(),
			}
			return nil
		}

		// Look for the Plugin symbol
		sym, err := p.Lookup("Plugin")
		if err != nil {
			return fmt.Errorf("plugin does not export Plugin symbol: %w", err)
		}

		var ok bool
		instance, ok = sym.(sdk.ExternalPlugin)
		if !ok {
			return fmt.Errorf("Plugin symbol is not of type ExternalPlugin")
		}
	}

	// Create plugin context
	ctx := sdk.NewExternalPluginContext(
		manifest.ID,
		dataDir,
		path,
		m.logger,
		m.createExternalPluginAPI(manifest.ID, dataDir),
	)

	// Initialize plugin if we have an instance
	if instance != nil {
		if err := instance.Init(ctx); err != nil {
			return fmt.Errorf("failed to initialize plugin: %w", err)
		}
	}

	// Store loaded plugin
	m.externalPlugins[manifest.ID] = &LoadedExternalPlugin{
		Manifest:    &manifest,
		Plugin:      instance,
		Context:     ctx,
		Enabled:     true,
		DataDir:     dataDir,
		ConfigDir:   path,
		PluginPath:  pluginPath,
		InstalledAt: time.Now(),
	}

	m.order = append(m.order, manifest.ID)

	m.logger.Info("External plugin loaded", "plugin", manifest.ID, "version", manifest.Version)
	return nil
}

// createExternalPluginAPI creates the sandboxed API for an external plugin
func (m *Manager) createExternalPluginAPI(pluginID, dataDir string) *sdk.ExternalPluginAPI {
	return &sdk.ExternalPluginAPI{
		GetSetting: func(key string) (string, error) {
			var setting PluginSetting
			err := m.db.Where("plugin_id = ? AND key = ?", pluginID, key).First(&setting).Error
			if err != nil {
				return "", err
			}
			return setting.Value, nil
		},
		SetSetting: func(key, value string) error {
			setting := PluginSetting{PluginID: pluginID, Key: key, Value: value}
			return m.db.Save(&setting).Error
		},
		DeleteSetting: func(key string) error {
			return m.db.Where("plugin_id = ? AND key = ?", pluginID, key).Delete(&PluginSetting{}).Error
		},
		ReadFile: func(path string) ([]byte, error) {
			fullPath := filepath.Join(dataDir, path)
			return os.ReadFile(fullPath)
		},
		WriteFile: func(path string, data []byte) error {
			fullPath := filepath.Join(dataDir, path)
			dir := filepath.Dir(fullPath)
			if err := os.MkdirAll(dir, 0755); err != nil {
				return err
			}
			return os.WriteFile(fullPath, data, 0644)
		},
		DeleteFile: func(path string) error {
			fullPath := filepath.Join(dataDir, path)
			return os.Remove(fullPath)
		},
		ListFiles: func(path string) ([]sdk.FileInfo, error) {
			fullPath := filepath.Join(dataDir, path)
			entries, err := os.ReadDir(fullPath)
			if err != nil {
				return nil, err
			}
			var files []sdk.FileInfo
			for _, e := range entries {
				info, _ := e.Info()
				files = append(files, sdk.FileInfo{
					Name:    e.Name(),
					IsDir:   e.IsDir(),
					Size:    info.Size(),
					ModTime: info.ModTime(),
				})
			}
			return files, nil
		},
		HTTPGet: func(url string, headers map[string]string) (*sdk.HTTPResponse, error) {
			req, err := http.NewRequest("GET", url, nil)
			if err != nil {
				return nil, err
			}
			for k, v := range headers {
				req.Header.Set(k, v)
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return nil, err
			}
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			return &sdk.HTTPResponse{
				StatusCode: resp.StatusCode,
				Body:       body,
			}, nil
		},
		SendNotification: func(title, message, level string) error {
			m.logger.Info("Plugin notification", "plugin", pluginID, "title", title, "message", message, "level", level)
			return nil
		},
	}
}

// PluginSetting stores plugin settings in database
type PluginSetting struct {
	ID        uint   `gorm:"primaryKey"`
	PluginID  string `gorm:"index"`
	Key       string `gorm:"index"`
	Value     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// InitAll initializes all registered plugins in dependency order.
func (m *Manager) InitAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Auto migrate plugin settings table
	if m.db != nil {
		m.db.AutoMigrate(&PluginSetting{})
	}

	// Sort plugins by dependencies
	if err := m.sortByDependencies(); err != nil {
		return err
	}

	// Initialize each builtin plugin
	for _, id := range m.order {
		if lp, exists := m.builtinPlugins[id]; exists {
			if err := m.initBuiltinPlugin(lp); err != nil {
				m.logger.Error("Failed to initialize plugin", "plugin", id, "error", err)
				return fmt.Errorf("failed to initialize plugin %s: %w", id, err)
			}
		}
	}

	return nil
}

// initBuiltinPlugin initializes a single builtin plugin.
func (m *Manager) initBuiltinPlugin(lp *LoadedBuiltinPlugin) error {
	id := lp.Plugin.ID()

	// Create plugin context
	ctx := sdk.NewPluginContext(
		id,
		lp.DataDir,
		lp.ConfigDir,
		m.logger,
		m.db,
		m.apiClient,
		m, // Manager implements PluginRegistry
	)
	lp.Context = ctx

	// Run database migrations
	if err := lp.Plugin.Migrate(m.db); err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	// Initialize plugin
	if err := lp.Plugin.Init(ctx); err != nil {
		return fmt.Errorf("initialization failed: %w", err)
	}

	m.logger.Info("Plugin initialized", "plugin", id)
	return nil
}

// StartAll starts all plugins.
func (m *Manager) StartAll() error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, id := range m.order {
		// Start builtin plugins
		if lp, exists := m.builtinPlugins[id]; exists && lp.Enabled {
			if err := lp.Plugin.Start(); err != nil {
				m.logger.Error("Failed to start plugin", "plugin", id, "error", err)
				return fmt.Errorf("failed to start plugin %s: %w", id, err)
			}
			m.logger.Info("Plugin started", "plugin", id)
		}

		// Start external plugins
		if ep, exists := m.externalPlugins[id]; exists && ep.Enabled && ep.Plugin != nil {
			if err := ep.Plugin.Start(); err != nil {
				m.logger.Error("Failed to start external plugin", "plugin", id, "error", err)
				ep.Error = err.Error()
			} else {
				m.logger.Info("External plugin started", "plugin", id)
			}
		}
	}

	return nil
}

// StopAll stops all plugins in reverse order.
func (m *Manager) StopAll() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Stop in reverse order
	for i := len(m.order) - 1; i >= 0; i-- {
		id := m.order[i]

		// Stop builtin plugins
		if lp, exists := m.builtinPlugins[id]; exists && lp.Enabled {
			if err := lp.Plugin.Stop(); err != nil {
				m.logger.Warn("Error stopping plugin", "plugin", id, "error", err)
			} else {
				m.logger.Info("Plugin stopped", "plugin", id)
			}
		}

		// Stop external plugins
		if ep, exists := m.externalPlugins[id]; exists && ep.Enabled && ep.Plugin != nil {
			if err := ep.Plugin.Stop(); err != nil {
				m.logger.Warn("Error stopping external plugin", "plugin", id, "error", err)
			} else {
				m.logger.Info("External plugin stopped", "plugin", id)
			}
		}
	}
}

// RegisterRoutes registers all plugin routes to the router.
func (m *Manager) RegisterRoutes(rg *gin.RouterGroup) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, id := range m.order {
		// Register builtin plugin routes
		if lp, exists := m.builtinPlugins[id]; exists && lp.Enabled {
			lp.Plugin.RegisterRoutes(rg)
			m.logger.Debug("Plugin routes registered", "plugin", id)
		}

		// Register external plugin routes
		if ep, exists := m.externalPlugins[id]; exists && ep.Enabled && ep.Plugin != nil {
			pluginGroup := rg.Group("/ext/" + id)
			ep.Plugin.RegisterRoutes(pluginGroup)
			m.logger.Debug("External plugin routes registered", "plugin", id)
		}
	}
}

// GetPlugin returns a builtin plugin by ID (implements PluginRegistry).
func (m *Manager) GetPlugin(id string) (sdk.BuiltinPlugin, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	lp, exists := m.builtinPlugins[id]
	if !exists {
		return nil, false
	}
	return lp.Plugin, true
}

// ListPlugins returns all registered builtin plugins (implements PluginRegistry).
func (m *Manager) ListPlugins() []sdk.BuiltinPlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]sdk.BuiltinPlugin, 0, len(m.builtinPlugins))
	for _, id := range m.order {
		if lp, exists := m.builtinPlugins[id]; exists {
			result = append(result, lp.Plugin)
		}
	}
	return result
}

// GetAllMenuItems returns menu items from all plugins.
func (m *Manager) GetAllMenuItems() []sdk.MenuItem {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var items []sdk.MenuItem
	for _, id := range m.order {
		// Builtin plugins
		if lp, exists := m.builtinPlugins[id]; exists && lp.Enabled {
			items = append(items, lp.Plugin.GetMenuItems()...)
		}

		// External plugins
		if ep, exists := m.externalPlugins[id]; exists && ep.Enabled {
			if ep.Plugin != nil {
				items = append(items, ep.Plugin.GetMenuItems()...)
			} else if ep.Manifest != nil {
				items = append(items, ep.Manifest.Menus...)
			}
		}
	}

	// Sort by order
	sort.Slice(items, func(i, j int) bool {
		return items[i].Order < items[j].Order
	})

	return items
}

// GetAllFrontendRoutes returns frontend routes from all plugins.
func (m *Manager) GetAllFrontendRoutes() []sdk.FrontendRoute {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var routes []sdk.FrontendRoute
	for _, id := range m.order {
		// Builtin plugins
		if lp, exists := m.builtinPlugins[id]; exists && lp.Enabled {
			routes = append(routes, lp.Plugin.GetFrontendRoutes()...)
		}

		// External plugins
		if ep, exists := m.externalPlugins[id]; exists && ep.Enabled {
			if ep.Plugin != nil {
				routes = append(routes, ep.Plugin.GetFrontendRoutes()...)
			} else if ep.Manifest != nil {
				routes = append(routes, ep.Manifest.Routes...)
			}
		}
	}
	return routes
}

// GetPluginInfo returns detailed info about a specific plugin.
func (m *Manager) GetPluginInfo(id string) *sdk.PluginInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Check builtin plugins
	if lp, exists := m.builtinPlugins[id]; exists {
		status := sdk.PluginStatusEnabled
		if !lp.Enabled {
			status = sdk.PluginStatusDisabled
		}
		return &sdk.PluginInfo{
			ID:           lp.Plugin.ID(),
			Name:         lp.Plugin.Name(),
			Version:      lp.Plugin.Version(),
			Description:  lp.Plugin.Description(),
			Type:         sdk.PluginTypeBuiltin,
			Status:       status,
			Enabled:      lp.Enabled,
			Dependencies: lp.Plugin.Dependencies(),
			Menus:        lp.Plugin.GetMenuItems(),
			Routes:       lp.Plugin.GetFrontendRoutes(),
			InstalledAt:  lp.InstalledAt.Format(time.RFC3339),
		}
	}

	// Check external plugins
	if ep, exists := m.externalPlugins[id]; exists {
		status := sdk.PluginStatusEnabled
		if !ep.Enabled {
			status = sdk.PluginStatusDisabled
		}
		if ep.Error != "" {
			status = sdk.PluginStatusError
		}

		info := &sdk.PluginInfo{
			ID:          ep.Manifest.ID,
			Name:        ep.Manifest.Name,
			Version:     ep.Manifest.Version,
			Description: ep.Manifest.Description,
			Author:      ep.Manifest.Author,
			Homepage:    ep.Manifest.Homepage,
			License:     ep.Manifest.License,
			Icon:        ep.Manifest.Icon,
			Category:    ep.Manifest.Category,
			Tags:        ep.Manifest.Tags,
			Type:        sdk.PluginTypeExternal,
			Status:      status,
			Enabled:     ep.Enabled,
			Permissions: ep.Manifest.Permissions,
			Dependencies: ep.Manifest.Dependencies,
			Settings:    ep.Manifest.Settings,
			Error:       ep.Error,
			InstalledAt: ep.InstalledAt.Format(time.RFC3339),
			UpdatedAt:   ep.UpdatedAt.Format(time.RFC3339),
		}

		if ep.Plugin != nil {
			info.Menus = ep.Plugin.GetMenuItems()
			info.Routes = ep.Plugin.GetFrontendRoutes()
		} else {
			info.Menus = ep.Manifest.Menus
			info.Routes = ep.Manifest.Routes
		}

		return info
	}

	return nil
}

// ListPluginInfo returns info about all plugins.
func (m *Manager) ListPluginInfo() []*sdk.PluginInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]*sdk.PluginInfo, 0, len(m.builtinPlugins)+len(m.externalPlugins))

	// List builtin plugins
	for _, id := range m.order {
		if lp, exists := m.builtinPlugins[id]; exists {
			status := sdk.PluginStatusEnabled
			if !lp.Enabled {
				status = sdk.PluginStatusDisabled
			}
			infos = append(infos, &sdk.PluginInfo{
				ID:           lp.Plugin.ID(),
				Name:         lp.Plugin.Name(),
				Version:      lp.Plugin.Version(),
				Description:  lp.Plugin.Description(),
				Type:         sdk.PluginTypeBuiltin,
				Status:       status,
				Enabled:      lp.Enabled,
				Dependencies: lp.Plugin.Dependencies(),
				InstalledAt:  lp.InstalledAt.Format(time.RFC3339),
			})
		}

		if ep, exists := m.externalPlugins[id]; exists {
			status := sdk.PluginStatusEnabled
			if !ep.Enabled {
				status = sdk.PluginStatusDisabled
			}
			if ep.Error != "" {
				status = sdk.PluginStatusError
			}
			infos = append(infos, &sdk.PluginInfo{
				ID:          ep.Manifest.ID,
				Name:        ep.Manifest.Name,
				Version:     ep.Manifest.Version,
				Description: ep.Manifest.Description,
				Author:      ep.Manifest.Author,
				Icon:        ep.Manifest.Icon,
				Category:    ep.Manifest.Category,
				Type:        sdk.PluginTypeExternal,
				Status:      status,
				Enabled:     ep.Enabled,
				Error:       ep.Error,
				InstalledAt: ep.InstalledAt.Format(time.RFC3339),
			})
		}
	}

	return infos
}

// GetCoreInfo returns information about the VPanel core
func (m *Manager) GetCoreInfo() *sdk.CoreInfo {
	return &sdk.CoreInfo{
		Version:   CoreVersion,
		BuildTime: CoreBuildTime,
		GitCommit: CoreGitCommit,
		GoVersion: runtime.Version(),
	}
}

// InstallPlugin installs a plugin from a URL or file path
func (m *Manager) InstallPlugin(source string) error {
	// TODO: Implement plugin installation from URL/file
	// 1. Download or copy plugin archive
	// 2. Extract to plugin directory
	// 3. Validate manifest
	// 4. Load the plugin
	return fmt.Errorf("plugin installation not implemented yet")
}

// UninstallPlugin uninstalls an external plugin
func (m *Manager) UninstallPlugin(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	ep, exists := m.externalPlugins[id]
	if !exists {
		return fmt.Errorf("external plugin %s not found", id)
	}

	// Stop the plugin if running
	if ep.Enabled && ep.Plugin != nil {
		ep.Plugin.Stop()
		ep.Plugin.Shutdown()
	}

	// Remove from order
	newOrder := make([]string, 0, len(m.order)-1)
	for _, pid := range m.order {
		if pid != id {
			newOrder = append(newOrder, pid)
		}
	}
	m.order = newOrder

	// Remove plugin directory
	if ep.ConfigDir != "" {
		os.RemoveAll(ep.ConfigDir)
	}
	if ep.DataDir != "" {
		os.RemoveAll(ep.DataDir)
	}

	delete(m.externalPlugins, id)

	m.logger.Info("External plugin uninstalled", "plugin", id)
	return nil
}

// sortByDependencies sorts plugins by their dependencies using topological sort.
func (m *Manager) sortByDependencies() error {
	// Build dependency graph for all plugins
	graph := make(map[string][]string)
	inDegree := make(map[string]int)

	// Add builtin plugins
	for id := range m.builtinPlugins {
		graph[id] = []string{}
		inDegree[id] = 0
	}

	// Add external plugins
	for id := range m.externalPlugins {
		graph[id] = []string{}
		inDegree[id] = 0
	}

	// Process builtin plugin dependencies
	for id, lp := range m.builtinPlugins {
		for _, dep := range lp.Plugin.Dependencies() {
			if _, exists := m.builtinPlugins[dep]; !exists {
				if _, exists := m.externalPlugins[dep]; !exists {
					return fmt.Errorf("plugin %s depends on missing plugin %s", id, dep)
				}
			}
			graph[dep] = append(graph[dep], id)
			inDegree[id]++
		}
	}

	// Process external plugin dependencies
	for id, ep := range m.externalPlugins {
		for _, dep := range ep.Manifest.Dependencies {
			if _, exists := m.builtinPlugins[dep]; !exists {
				if _, exists := m.externalPlugins[dep]; !exists {
					m.logger.Warn("External plugin has missing dependency", "plugin", id, "dependency", dep)
					continue
				}
			}
			graph[dep] = append(graph[dep], id)
			inDegree[id]++
		}
	}

	// Topological sort (Kahn's algorithm)
	var queue []string
	for id, degree := range inDegree {
		if degree == 0 {
			queue = append(queue, id)
		}
	}

	var sorted []string
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		sorted = append(sorted, id)

		for _, dependent := range graph[id] {
			inDegree[dependent]--
			if inDegree[dependent] == 0 {
				queue = append(queue, dependent)
			}
		}
	}

	totalPlugins := len(m.builtinPlugins) + len(m.externalPlugins)
	if len(sorted) != totalPlugins {
		return fmt.Errorf("circular dependency detected in plugins")
	}

	m.order = sorted
	return nil
}

// Enable enables a plugin.
func (m *Manager) Enable(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check builtin plugins
	if lp, exists := m.builtinPlugins[id]; exists {
		if lp.Enabled {
			return nil
		}
		if err := lp.Plugin.Start(); err != nil {
			return err
		}
		lp.Enabled = true
		m.logger.Info("Plugin enabled", "plugin", id)
		return nil
	}

	// Check external plugins
	if ep, exists := m.externalPlugins[id]; exists {
		if ep.Enabled {
			return nil
		}
		if ep.Plugin != nil {
			if err := ep.Plugin.Start(); err != nil {
				return err
			}
		}
		ep.Enabled = true
		ep.Error = ""
		m.logger.Info("External plugin enabled", "plugin", id)
		return nil
	}

	return fmt.Errorf("plugin %s not found", id)
}

// Disable disables a plugin.
func (m *Manager) Disable(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check builtin plugins
	if lp, exists := m.builtinPlugins[id]; exists {
		if !lp.Enabled {
			return nil
		}
		if err := lp.Plugin.Stop(); err != nil {
			return err
		}
		lp.Enabled = false
		m.logger.Info("Plugin disabled", "plugin", id)
		return nil
	}

	// Check external plugins
	if ep, exists := m.externalPlugins[id]; exists {
		if !ep.Enabled {
			return nil
		}
		if ep.Plugin != nil {
			if err := ep.Plugin.Stop(); err != nil {
				return err
			}
		}
		ep.Enabled = false
		m.logger.Info("External plugin disabled", "plugin", id)
		return nil
	}

	return fmt.Errorf("plugin %s not found", id)
}

// GetPluginCount returns the count of plugins by type
func (m *Manager) GetPluginCount() (builtin, external, enabled int) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	builtin = len(m.builtinPlugins)
	external = len(m.externalPlugins)

	for _, lp := range m.builtinPlugins {
		if lp.Enabled {
			enabled++
		}
	}
	for _, ep := range m.externalPlugins {
		if ep.Enabled {
			enabled++
		}
	}

	return
}
