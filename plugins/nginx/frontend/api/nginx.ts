import { get, post, put, del } from '@/api/client';

// ===============================
// Nginx Instance Types
// ===============================

export type NginxInstanceType = 'local' | 'docker';

export interface NginxInstance {
  id: string;
  node_id?: string;
  name: string;
  type: NginxInstanceType;
  description?: string;
  container_id?: string;
  container_name?: string;
  image?: string;
  config_path: string;
  sites_path: string;
  sites_enabled?: string;
  log_path: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  version?: string;
  is_default: boolean;
  pid?: number;
  uptime?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInstanceRequest {
  name: string;
  type: NginxInstanceType;
  description?: string;
  container_id?: string;
  container_name?: string;
  image?: string;
  config_path?: string;
  sites_path?: string;
  sites_enabled?: string;
  log_path?: string;
  is_default?: boolean;
}

export interface UpdateInstanceRequest extends Partial<CreateInstanceRequest> {}

export interface DockerNginxContainer {
  container_id: string;
  container_name: string;
  image: string;
  status: string;
  state: string;
  created: string;
  already_added: boolean;
}

export interface DeployDockerNginxRequest {
  name: string;
  image?: string;
  ports?: Record<number, number>;
  volumes?: Record<string, string>;
}

// ===============================
// Site Types
// ===============================

export interface NginxSite {
  id: string;
  node_id?: string;
  instance_id?: string;
  name: string;
  domain: string;
  aliases: string[];
  port: number;
  ssl_enabled: boolean;
  ssl_cert_id?: string;
  proxy_enabled: boolean;
  proxy_target?: string;
  root_path?: string;
  php_enabled: boolean;
  php_version?: string;
  config?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  instance?: NginxInstance;
}

export interface SSLCertificate {
  id: string;
  node_id?: string;
  domain: string;
  type: 'letsencrypt' | 'custom';
  cert_path: string;
  key_path: string;
  chain_path?: string;
  expires_at: string;
  auto_renew: boolean;
  last_renewed?: string;
}

export interface CreateSiteRequest {
  name?: string;
  domain: string;
  instance_id?: string;
  aliases?: string[];
  port?: number;
  ssl_enabled?: boolean;
  ssl_cert_id?: string;
  proxy_enabled?: boolean;
  proxy_target?: string;
  root_path?: string;
  php_enabled?: boolean;
  php_version?: string;
  config?: string;
  enabled?: boolean;
}

export interface UpdateSiteRequest extends Partial<CreateSiteRequest> {}

export interface SiteAnalytics {
  requests: number;
  bandwidth: string;
  bandwidth_bytes: number;
  unique_visitors: number;
  top_pages: Array<{ path: string; requests: number }>;
  status_codes: Record<string, number>;
  total_entries: number;
}

export interface NginxStatus {
  installed: boolean;
  local_installed?: boolean;
  running: boolean;
  config_valid: boolean;
  error?: string;
  total_sites: number;
  enabled_sites: number;
  total_instances?: number;
  docker_instances?: number;
  docker_available?: boolean;
  os: 'darwin' | 'linux' | 'windows' | string;
}

export interface ConfigTestResult {
  valid: boolean;
  output: string;
}

// ===============================
// Instance API
// ===============================

// List all nginx instances
export async function listInstances(nodeId?: string): Promise<NginxInstance[]> {
  return get<NginxInstance[]>('/nginx/instances', nodeId ? { node_id: nodeId } : undefined);
}

// Get a single instance
export async function getInstance(id: string): Promise<NginxInstance> {
  return get<NginxInstance>(`/nginx/instances/${id}`);
}

// Create a new instance
export async function createInstance(data: CreateInstanceRequest): Promise<NginxInstance> {
  return post<NginxInstance>('/nginx/instances', data);
}

// Update an instance
export async function updateInstance(id: string, data: UpdateInstanceRequest): Promise<NginxInstance> {
  return put<NginxInstance>(`/nginx/instances/${id}`, data);
}

// Delete an instance
export async function deleteInstance(id: string): Promise<void> {
  return del<void>(`/nginx/instances/${id}`);
}

// Start an instance
export async function startInstance(id: string): Promise<void> {
  return post<void>(`/nginx/instances/${id}/start`);
}

// Stop an instance
export async function stopInstance(id: string): Promise<void> {
  return post<void>(`/nginx/instances/${id}/stop`);
}

// Reload an instance
export async function reloadInstance(id: string): Promise<void> {
  return post<void>(`/nginx/instances/${id}/reload`);
}

// Test instance configuration
export async function testInstanceConfig(id: string): Promise<ConfigTestResult> {
  return get<ConfigTestResult>(`/nginx/instances/${id}/test`);
}

// Get instance logs
export async function getInstanceLogs(id: string, type: 'access' | 'error' = 'access', lines = 100): Promise<{ logs: string[] }> {
  return get<{ logs: string[] }>(`/nginx/instances/${id}/logs`, { type, lines });
}

// Discover Docker nginx containers
export async function discoverDockerNginx(): Promise<DockerNginxContainer[]> {
  return get<DockerNginxContainer[]>('/nginx/instances/discover');
}

// Deploy a new Docker nginx
export async function deployDockerNginx(data: DeployDockerNginxRequest): Promise<NginxInstance> {
  return post<NginxInstance>('/nginx/instances/deploy', data);
}

// ===============================
// Site API
// ===============================

// List all nginx sites
export async function listSites(nodeId?: string): Promise<NginxSite[]> {
  return get<NginxSite[]>('/nginx/sites', nodeId ? { node_id: nodeId } : undefined);
}

// List sites by instance
export async function listSitesByInstance(instanceId: string): Promise<NginxSite[]> {
  return get<NginxSite[]>('/nginx/sites', { instance_id: instanceId });
}

// Get a single site
export async function getSite(id: string): Promise<NginxSite> {
  return get<NginxSite>(`/nginx/sites/${id}`);
}

// Create a new site
export async function createSite(data: CreateSiteRequest): Promise<NginxSite> {
  return post<NginxSite>('/nginx/sites', data);
}

// Update a site
export async function updateSite(id: string, data: UpdateSiteRequest): Promise<NginxSite> {
  return put<NginxSite>(`/nginx/sites/${id}`, data);
}

// Delete a site
export async function deleteSite(id: string): Promise<void> {
  return del<void>(`/nginx/sites/${id}`);
}

// Enable a site
export async function enableSite(id: string): Promise<void> {
  return post<void>(`/nginx/sites/${id}/enable`);
}

// Disable a site
export async function disableSite(id: string): Promise<void> {
  return post<void>(`/nginx/sites/${id}/disable`);
}

// Get nginx status
export async function getNginxStatus(): Promise<NginxStatus> {
  return get<NginxStatus>('/nginx/status');
}

// Reload nginx
export async function reloadNginx(): Promise<void> {
  return post<void>('/nginx/reload');
}

// List SSL certificates
export async function listCertificates(nodeId?: string): Promise<SSLCertificate[]> {
  return get<SSLCertificate[]>('/nginx/ssl/certificates', nodeId ? { node_id: nodeId } : undefined);
}

// Create SSL certificate
export async function createCertificate(data: {
  domain: string;
  type: 'letsencrypt' | 'custom';
  cert_path?: string;
  key_path?: string;
  chain_path?: string;
  expires_at?: string;
  auto_renew?: boolean;
}): Promise<SSLCertificate> {
  return post<SSLCertificate>('/nginx/ssl/certificates', data);
}

// Renew SSL certificate
export async function renewCertificate(id: string): Promise<void> {
  return post<void>(`/nginx/ssl/certificates/${id}/renew`);
}

// Delete SSL certificate
export async function deleteCertificate(id: string): Promise<void> {
  return del<void>(`/nginx/ssl/certificates/${id}`);
}

// Get site analytics
export async function getSiteAnalytics(siteId?: string, days = 30): Promise<SiteAnalytics> {
  return get<SiteAnalytics>('/nginx/analytics', siteId ? { site_id: siteId, days } : { days });
}

// Get access logs
export async function getAccessLogs(siteId?: string, lines = 100): Promise<{ logs: string[] }> {
  return get<{ logs: string[] }>('/nginx/logs/access', siteId ? { site_id: siteId, lines } : { lines });
}

// Get error logs
export async function getErrorLogs(siteId?: string, lines = 100): Promise<{ logs: string[] }> {
  return get<{ logs: string[] }>('/nginx/logs/error', siteId ? { site_id: siteId, lines } : { lines });
}

