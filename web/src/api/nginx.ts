import { get, post, put, del } from './client';

export interface NginxSite {
  id: string;
  node_id?: string;
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
  running: boolean;
  config_valid: boolean;
  error?: string;
  total_sites: number;
  enabled_sites: number;
}

// List all nginx sites
export async function listSites(nodeId?: string): Promise<NginxSite[]> {
  return get<NginxSite[]>('/nginx/sites', nodeId ? { node_id: nodeId } : undefined);
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
