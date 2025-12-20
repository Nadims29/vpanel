# VPanel Plugin Architecture

## Overview

VPanel uses a true plugin-based architecture where both the backend and frontend are modular:

- **Core Module**: Handles only authentication, authorization, and plugin lifecycle management
- **Builtin Plugins**: All features are implemented as plugins compiled into the main binary
- **External Plugins**: Support for dynamically loaded `.so` plugins at runtime
- **Frontend Plugins**: Each plugin has its own frontend components, dynamically loaded by the main app

## Directory Structure

```
vpanel/
├── core/                           # Core module (minimal)
│   ├── cmd/server/main.go          # Main entry point
│   ├── internal/
│   │   ├── auth/                   # Authentication & user management
│   │   │   ├── handlers.go         # HTTP handlers
│   │   │   ├── models.go           # User, Session, etc.
│   │   │   └── service.go          # Auth business logic
│   │   ├── config/                 # Configuration management
│   │   ├── database/               # Database connection
│   │   ├── middleware/             # HTTP middleware
│   │   └── plugin/                 # Plugin manager
│   │       ├── manager.go          # Plugin lifecycle management
│   │       └── handlers.go         # Plugin API handlers
│   └── pkg/                        # Shared packages
│       ├── logger/                 # Logging
│       └── response/               # HTTP response helpers
│
├── sdk/                            # Plugin SDK
│   └── go/
│       ├── builtin.go              # BuiltinPlugin interface
│       ├── external.go             # ExternalPlugin interface
│       ├── plugin.go               # Base plugin implementation
│       ├── context.go              # Plugin context & Logger
│       ├── types.go                # Common types
│       ├── hooks.go                # Event system
│       ├── api.go                  # API client interfaces
│       └── ui.go                   # UI extension APIs
│
├── plugins/                        # All plugins (backend + frontend)
│   ├── registry.go                 # Plugin registration
│   ├── go.mod                      # Plugins module
│   ├── node_modules -> ../web/node_modules  # Symlink for frontend deps
│   │
│   ├── monitor/                    # System monitoring
│   │   ├── backend/
│   │   │   ├── plugin.go           # Plugin entry point
│   │   │   ├── service.go          # Business logic
│   │   │   └── handlers.go         # HTTP handlers
│   │   └── frontend/
│   │       ├── api/                # API client
│   │       ├── components/         # React components
│   │       └── pages/              # React pages
│   │           └── Dashboard.tsx
│   │
│   ├── docker/                     # Docker management
│   ├── nginx/                      # Nginx management
│   ├── database/                   # Database management
│   ├── sites/                      # Sites & domains
│   ├── apps/                       # Application deployment
│   ├── cron/                       # Cron jobs
│   ├── firewall/                   # Firewall rules
│   ├── files/                      # File manager
│   ├── terminal/                   # Web terminal
│   └── example/                    # Example external plugin
│
└── web/                            # Frontend framework
    └── src/
        ├── plugins/                # Plugin system
        │   ├── registry.ts         # Plugin registration
        │   ├── PluginRoutes.tsx    # Dynamic route loading
        │   └── index.ts            # Exports
        ├── pages/                  # Core pages only
        │   ├── Login.tsx           # Authentication
        │   ├── settings/           # User, role, system settings
        │   ├── plugins/            # Plugin management UI
        │   ├── logs/               # Audit logs
        │   ├── ssl/                # SSL certificates
        │   └── software/           # Software management
        └── App.tsx                 # Main app with plugin routes
```

## Backend Plugin Architecture

### Builtin Plugin Interface

Each builtin plugin must implement the `BuiltinPlugin` interface:

```go
type BuiltinPlugin interface {
    // Metadata
    ID() string
    Name() string
    Version() string
    Description() string
    Dependencies() []string

    // Lifecycle
    Init(ctx *PluginContext) error
    Start() error
    Stop() error

    // Routes
    RegisterRoutes(group *gin.RouterGroup)

    // Frontend
    GetFrontendRoutes() []FrontendRoute
    GetMenuItems() []MenuItem

    // Database
    Migrate(db *gorm.DB) error
}
```

### External Plugin Interface

External plugins (dynamically loaded `.so` files) implement:

```go
type ExternalPlugin interface {
    ID() string
    Name() string
    Version() string
    Description() string
    Author() string
    Homepage() string
    License() string

    Init(ctx *ExternalPluginContext) error
    Start() error
    Stop() error
    Shutdown() error

    RegisterRoutes(group *gin.RouterGroup)
    GetFrontendRoutes() []FrontendRoute
    GetMenuItems() []MenuItem
    GetSettingsSchema() []SettingField
    HandleEvent(event *Event) error
}
```

## Frontend Plugin Architecture

### Plugin Registration

Plugins are registered in `web/src/plugins/registry.ts`:

```typescript
import { lazy } from 'react';

pluginRegistry.register({
  id: 'docker',
  name: 'Docker',
  version: '1.0.0',
  enabled: true,
  routes: [
    {
      path: '/docker/containers',
      component: lazy(() => import('@plugins/docker/frontend/pages/Containers')),
      title: 'Containers',
    },
  ],
  menuItems: [
    {
      id: 'docker',
      title: 'Docker',
      icon: 'Box',
      path: '/docker/containers',
      order: 10,
    },
  ],
});
```

### Route Loading

The main `App.tsx` dynamically loads plugin routes:

```typescript
import { pluginRegistry } from '@/plugins/registry';

function App() {
  const pluginRoutes = pluginRegistry.getAllRoutes();

  return (
    <Routes>
      {pluginRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <Suspense fallback={<LoadingFallback />}>
              <route.component />
            </Suspense>
          }
        />
      ))}
    </Routes>
  );
}
```

### Shared Components

Plugin frontend components import shared UI from `@/`:

```typescript
// plugins/docker/frontend/pages/Containers.tsx
import { Button, Card, Table } from '@/components/ui';
import { cn } from '@/utils/cn';
import * as dockerApi from '@/api/docker';
```

## Plugin Lifecycle

### 1. Backend Registration

Plugins are registered in `plugins/registry.go`:

```go
func BuiltinPlugins() []sdk.BuiltinPlugin {
    return []sdk.BuiltinPlugin{
        monitor.NewPlugin(),
        docker.NewPlugin(),
        files.NewPlugin(),
        // ...
    }
}
```

### 2. Backend Initialization

The core's `main.go` registers and initializes all plugins:

```go
// Register all builtin plugins
for _, p := range plugins.BuiltinPlugins() {
    pm.Register(p)
}

// Load external plugins from plugins directory
pm.LoadExternalPlugins()

// Initialize (run migrations, setup context)
pm.InitAll()

// Start plugins
pm.StartAll()

// Register routes
pm.RegisterRoutes(api)
```

### 3. Frontend Initialization

Plugin routes are loaded at build time via lazy imports:

```typescript
// web/src/plugins/registry.ts
pluginRegistry.register({
  id: 'monitor',
  routes: [
    {
      path: '/',
      component: lazy(() => import('@plugins/monitor/frontend/pages/Dashboard')),
    },
  ],
});
```

## External Plugin Development

### Create Plugin Structure

```
my-plugin/
├── main.go          # Plugin implementation
├── manifest.json    # Plugin metadata
├── Makefile         # Build configuration
└── README.md        # Documentation
```

### Implement Plugin

```go
package main

import (
    sdk "github.com/vpanel/sdk"
    "github.com/gin-gonic/gin"
)

type MyPlugin struct {
    sdk.BaseExternalPlugin
}

func (p *MyPlugin) ID() string      { return "my-plugin" }
func (p *MyPlugin) Name() string    { return "My Plugin" }
func (p *MyPlugin) Version() string { return "1.0.0" }

func (p *MyPlugin) RegisterRoutes(group *gin.RouterGroup) {
    group.GET("/status", p.handleStatus)
}

var Plugin MyPlugin
```

### Build and Install

```bash
cd plugins/my-plugin
CGO_ENABLED=1 go build -buildmode=plugin -o my-plugin.so main.go
```

## Plugin Manager API

- `GET /api/plugins` - List all plugins with stats and core version
- `GET /api/plugins/:id` - Get plugin details
- `POST /api/plugins/:id/enable` - Enable plugin
- `POST /api/plugins/:id/disable` - Disable plugin
- `POST /api/plugins/install` - Install external plugin
- `DELETE /api/plugins/:id` - Uninstall external plugin
- `GET /api/plugins/menus` - Get all plugin menus
- `GET /api/plugins/routes` - Get all plugin routes
- `GET /api/plugins/core` - Get core version info

## Building

```bash
# Build everything
./dev.sh build

# Build server only (from core/)
cd core && go build -o ../bin/vpanel-server ./cmd/server

# Build frontend only
cd web && npm run build

# Development mode
./dev.sh dev
```

## Configuration

Configuration is loaded from `config.yaml`:

```yaml
server:
  port: 8080
  mode: debug

database:
  driver: sqlite
  database: ./data/vpanel.db

auth:
  jwt_secret: your-secret-key
  token_expiry: 60

plugin:
  data_directory: ./data/plugins
  plugin_directory: ./data/external-plugins  # For external .so plugins
```

## Benefits of This Architecture

1. **Full Separation**: Backend and frontend are both plugin-based
2. **Easy Extension**: Add new features by creating new plugins
3. **External Plugins**: Support for runtime-loaded plugins
4. **Shared UI**: Plugins share common components from `@/components/ui`
5. **Lazy Loading**: Frontend plugins are loaded on-demand
6. **Single Build**: All builtin plugins compile into one binary + one frontend bundle
7. **Dynamic Menus**: Sidebar menus from plugins are loaded dynamically
8. **Version Info**: Core version and plugin info displayed in settings
