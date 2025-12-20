import { get, post, put, del } from './client';

export type PluginType = 'builtin' | 'external';
export type PluginStatus = 'enabled' | 'disabled' | 'error' | 'loading';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  license?: string;
  icon?: string;
  category?: string;
  tags?: string[];
  type: PluginType;
  status: PluginStatus;
  enabled: boolean;
  permissions?: string[];
  dependencies?: string[];
  settings?: PluginSetting[];
  menus?: PluginMenuItem[];
  routes?: PluginRoute[];
  error?: string;
  installed_at?: string;
  updated_at?: string;
}

export interface PluginStats {
  builtin: number;
  external: number;
  enabled: number;
  total: number;
}

export interface CoreInfo {
  version: string;
  build_time: string;
  git_commit: string;
  go_version: string;
}

export interface PluginListResponse {
  plugins: Plugin[];
  stats: PluginStats;
  core: CoreInfo;
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
  downloads: number;
  rating: number;
  verified: boolean;
  download_url: string;
  installed: boolean;
  update_available?: boolean;
}

export interface PluginSetting {
  key: string;
  type: 'string' | 'int' | 'bool' | 'select' | 'textarea' | 'password';
  label: string;
  description: string;
  default?: unknown;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface PluginSettingsResponse {
  schema: PluginSetting[];
  values: Record<string, unknown>;
}

export interface InstallPluginRequest {
  source: string; // URL or file path
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

export interface PluginRoute {
  path: string;
  title: string;
  component?: string;
}

export interface PluginMenuResponse {
  plugin_id: string;
  menus: PluginMenuItem[];
}

// List all installed plugins with stats and core info
export async function listPlugins(): Promise<PluginListResponse> {
  return get<PluginListResponse>('/plugins');
}

// Get a specific plugin's details
export async function getPlugin(id: string): Promise<Plugin> {
  return get<Plugin>(`/plugins/${id}`);
}

// Get core version info
export async function getCoreInfo(): Promise<CoreInfo> {
  return get<CoreInfo>('/plugins/core');
}

// Get available plugins from market
export async function getMarketPlugins(): Promise<MarketPlugin[]> {
  return get<MarketPlugin[]>('/plugins/market');
}

// Install a plugin from URL or path
export async function installPlugin(source: string): Promise<void> {
  return post<void>('/plugins/install', { source });
}

// Uninstall a plugin
export async function uninstallPlugin(id: string): Promise<void> {
  return del<void>(`/plugins/${id}`);
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
export async function getPluginSettings(id: string): Promise<PluginSettingsResponse> {
  return get<PluginSettingsResponse>(`/plugins/${id}/settings`);
}

// Update plugin settings
export async function updatePluginSettings(
  id: string,
  settings: Record<string, unknown>
): Promise<void> {
  return put<void>(`/plugins/${id}/settings`, settings);
}

// Get plugin menus for sidebar
export async function getPluginMenus(): Promise<PluginMenuItem[]> {
  return get<PluginMenuItem[]>('/plugins/menus');
}

// Get plugin routes for routing
export async function getPluginRoutes(): Promise<PluginRoute[]> {
  return get<PluginRoute[]>('/plugins/routes');
}
