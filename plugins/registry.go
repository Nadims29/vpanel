// Package plugins provides the registry of all builtin plugins
package plugins

import (
	sdk "github.com/vpanel/sdk"

	// Import all builtin plugins
	apps "github.com/vpanel/plugins/apps/backend"
	cron "github.com/vpanel/plugins/cron/backend"
	database "github.com/vpanel/plugins/database/backend"
	docker "github.com/vpanel/plugins/docker/backend"
	files "github.com/vpanel/plugins/files/backend"
	firewall "github.com/vpanel/plugins/firewall/backend"
	monitor "github.com/vpanel/plugins/monitor/backend"
	nginx "github.com/vpanel/plugins/nginx/backend"
	sites "github.com/vpanel/plugins/sites/backend"
	ssl "github.com/vpanel/plugins/ssl/backend"
	terminal "github.com/vpanel/plugins/terminal/backend"
)

// BuiltinPlugins returns all builtin plugins for registration
func BuiltinPlugins() []sdk.BuiltinPlugin {
	return []sdk.BuiltinPlugin{
		monitor.NewPlugin(),
		docker.NewPlugin(),
		files.NewPlugin(),
		terminal.NewPlugin(),
		nginx.NewPlugin(),
		ssl.NewPlugin(),
		database.NewPlugin(),
		apps.NewPlugin(),
		sites.NewPlugin(),
		cron.NewPlugin(),
		firewall.NewPlugin(),
	}
}

// PluginOrder defines the order in which plugins should be initialized
// This ensures dependencies are loaded first
var PluginOrder = []string{
	"monitor",  // No dependencies
	"docker",   // No dependencies
	"files",    // No dependencies
	"terminal", // No dependencies
	"nginx",    // No dependencies
	"ssl",      // No dependencies
	"database", // Depends on docker
	"apps",     // Depends on docker, nginx
	"sites",    // Depends on nginx, apps
	"cron",     // No dependencies
	"firewall", // No dependencies
}
