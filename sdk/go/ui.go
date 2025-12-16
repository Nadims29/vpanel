package sdk

// UIManager provides UI extension APIs for plugins.
type UIManager struct {
	pluginID string
	menus    []MenuItem
	pages    []Page
	widgets  []Widget
}

// NewUIManager creates a new UIManager for the given plugin.
func NewUIManager(pluginID string) *UIManager {
	return &UIManager{
		pluginID: pluginID,
		menus:    make([]MenuItem, 0),
		pages:    make([]Page, 0),
		widgets:  make([]Widget, 0),
	}
}

// MenuItem represents a menu item in the VPanel sidebar.
type MenuItem struct {
	// ID is the unique identifier for this menu item
	ID string `json:"id"`

	// Title is the display text for the menu item
	Title string `json:"title"`

	// Icon is the icon name (e.g., "puzzle", "settings", "database")
	Icon string `json:"icon"`

	// Path is the frontend route path (e.g., "/plugins/my-plugin")
	Path string `json:"path"`

	// Order determines the position in the menu (lower = higher)
	Order int `json:"order"`

	// Parent is the parent menu ID for nested menus
	Parent string `json:"parent,omitempty"`

	// Children contains sub-menu items
	Children []MenuItem `json:"children,omitempty"`

	// Badge shows a badge on the menu item (optional)
	Badge string `json:"badge,omitempty"`

	// BadgeVariant is the badge color variant (info, warning, error, success)
	BadgeVariant string `json:"badge_variant,omitempty"`
}

// Page represents a page registered by a plugin.
type Page struct {
	// Path is the route path for this page
	Path string `json:"path"`

	// Title is the page title
	Title string `json:"title"`

	// IframeSrc is the iframe source URL for the page content
	// This points to the plugin's static assets
	IframeSrc string `json:"iframe_src"`

	// Permissions required to access this page
	Permissions []string `json:"permissions,omitempty"`
}

// Widget represents a dashboard widget registered by a plugin.
type Widget struct {
	// ID is the unique identifier for this widget
	ID string `json:"id"`

	// Title is the widget title
	Title string `json:"title"`

	// Type is the widget type (stat, chart, list, custom)
	Type string `json:"type"`

	// Size is the widget size (small, medium, large)
	Size string `json:"size"`

	// Order determines the position on the dashboard
	Order int `json:"order"`

	// DataSource is the API endpoint for widget data
	DataSource string `json:"data_source,omitempty"`

	// RefreshInterval in seconds (0 = no auto-refresh)
	RefreshInterval int `json:"refresh_interval,omitempty"`

	// IframeSrc for custom widgets
	IframeSrc string `json:"iframe_src,omitempty"`
}

// RegisterMenu registers a menu item in the VPanel sidebar.
func (m *UIManager) RegisterMenu(item MenuItem) {
	// Ensure the path includes the plugin prefix
	if item.Path != "" && item.Path[0] != '/' {
		item.Path = "/plugins/" + m.pluginID + "/" + item.Path
	}
	m.menus = append(m.menus, item)
}

// RegisterPage registers a page for the plugin.
func (m *UIManager) RegisterPage(page Page) {
	// Set default iframe source if not specified
	if page.IframeSrc == "" {
		page.IframeSrc = "/api/plugin/" + m.pluginID + "/static/index.html"
	}
	m.pages = append(m.pages, page)
}

// RegisterWidget registers a dashboard widget.
func (m *UIManager) RegisterWidget(widget Widget) {
	// Set data source prefix if needed
	if widget.DataSource != "" && widget.DataSource[0] != '/' {
		widget.DataSource = "/api/plugin/" + m.pluginID + "/api/" + widget.DataSource
	}
	m.widgets = append(m.widgets, widget)
}

// GetMenus returns all registered menus.
func (m *UIManager) GetMenus() []MenuItem {
	return m.menus
}

// GetPages returns all registered pages.
func (m *UIManager) GetPages() []Page {
	return m.pages
}

// GetWidgets returns all registered widgets.
func (m *UIManager) GetWidgets() []Widget {
	return m.widgets
}

// ClearMenus removes all registered menus.
func (m *UIManager) ClearMenus() {
	m.menus = make([]MenuItem, 0)
}

// ClearPages removes all registered pages.
func (m *UIManager) ClearPages() {
	m.pages = make([]Page, 0)
}

// ClearWidgets removes all registered widgets.
func (m *UIManager) ClearWidgets() {
	m.widgets = make([]Widget, 0)
}

// SettingField represents a setting field in the plugin settings UI.
type SettingField struct {
	// Key is the setting key
	Key string `json:"key"`

	// Type is the field type (string, int, bool, select, textarea, password)
	Type string `json:"type"`

	// Label is the display label
	Label string `json:"label"`

	// Description is the help text
	Description string `json:"description,omitempty"`

	// Default is the default value
	Default interface{} `json:"default,omitempty"`

	// Required indicates if the field is required
	Required bool `json:"required,omitempty"`

	// Options for select type fields
	Options []SelectOption `json:"options,omitempty"`

	// Validation rules
	Validation *FieldValidation `json:"validation,omitempty"`
}

// SelectOption represents an option for select fields.
type SelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// FieldValidation contains validation rules for a field.
type FieldValidation struct {
	Min       *int   `json:"min,omitempty"`
	Max       *int   `json:"max,omitempty"`
	MinLength *int   `json:"min_length,omitempty"`
	MaxLength *int   `json:"max_length,omitempty"`
	Pattern   string `json:"pattern,omitempty"`
	Message   string `json:"message,omitempty"`
}

// SettingsSchema represents the settings schema for a plugin.
type SettingsSchema struct {
	Fields []SettingField `json:"fields"`
}

// RegisterSettings registers the settings schema for the plugin.
func (m *UIManager) RegisterSettings(schema SettingsSchema) {
	// This would be used by the plugin manager to generate settings UI
}
