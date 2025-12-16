import { get, post, put } from './client';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  license?: string;
  icon?: string;
  category?: string;
  tags?: string[];
  enabled: boolean;
  status: 'enabled' | 'disabled' | 'running' | 'stopped' | 'error';
}

export interface MarketPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  license?: string;
  icon?: string;
  category?: string;
  tags?: string[];
  installed: boolean;
  enabled?: boolean;
  status: 'available' | 'installed_enabled' | 'installed_disabled';
  path?: string;
}

export interface PluginSetting {
  key: string;
  type: 'string' | 'int' | 'bool' | 'select' | 'textarea';
  label: string;
  description: string;
  default: unknown;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface PluginSettings {
  settings: PluginSetting[];
}

export interface InstallPluginRequest {
  plugin_id: string;
  source?: 'market' | 'local';
  path?: string;
}

export interface PluginMenuItem {
  id?: string;
  title: string;
  icon: string;
  path: string;
  order?: number;
  parent?: string;
  children?: PluginMenuItem[];
  badge?: string;
  badge_variant?: string;
}

export interface PluginMenuResponse {
  plugin_id: string;
  menus: PluginMenuItem[];
}

export interface PluginPage {
  plugin_id: string;
  path: string;
  title: string;
  iframe_src: string;
}

// List all installed plugins
export async function listPlugins(): Promise<Plugin[]> {
  return get<Plugin[]>('/plugins');
}

// Get available plugins from market
export async function getMarketPlugins(): Promise<MarketPlugin[]> {
  return get<MarketPlugin[]>('/plugins/market');
}

// Install a plugin
export async function installPlugin(data: InstallPluginRequest): Promise<void> {
  return post<void>('/plugins/install', data);
}

// Uninstall a plugin
export async function uninstallPlugin(id: string): Promise<void> {
  return post<void>(`/plugins/${id}/uninstall`);
}

// Enable a plugin
export async function enablePlugin(id: string): Promise<void> {
  return post<void>(`/plugins/${id}/enable`);
}

// Disable a plugin
export async function disablePlugin(id: string): Promise<void> {
  return post<void>(`/plugins/${id}/disable`);
}

// Get plugin settings
export async function getPluginSettings(id: string): Promise<PluginSettings> {
  return get<PluginSettings>(`/plugins/${id}/settings`);
}

// Update plugin settings
export async function updatePluginSettings(
  id: string,
  settings: Record<string, unknown>
): Promise<void> {
  return put<void>(`/plugins/${id}/settings`, { settings });
}

// Get plugin menus for sidebar
export async function getPluginMenus(): Promise<PluginMenuResponse[]> {
  return get<PluginMenuResponse[]>('/plugins/menus');
}

// Get plugin pages for routing
export async function getPluginPages(): Promise<PluginPage[]> {
  return get<PluginPage[]>('/plugins/pages');
}
