/**
 * Frontend Plugin System
 *
 * This module exports the plugin registry and utilities for plugin management.
 */

export { pluginRegistry } from './registry';
export type { PluginDefinition, PluginRoute, PluginMenuItem } from './registry';
export { PluginRoutes, getPluginRouteElements } from './PluginRoutes';

