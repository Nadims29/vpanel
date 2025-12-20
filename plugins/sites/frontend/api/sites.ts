import { get, post, put, del } from '@/api/client';

// ===============================
// Site Types
// ===============================

export type SiteStatus = 'pending' | 'active' | 'error' | 'suspended';
export type BindingType = 'none' | 'app' | 'nginx_site' | 'proxy';

export interface Site {
  id: string;
  domain: string;
  name: string;
  status: SiteStatus;
  description?: string;
  
  // DNS Information
  dns_provider: string;
  nameservers: string[];
  dns_verified: boolean;
  dns_verified_at?: string;
  
  // SSL/Certificate
  ssl_enabled: boolean;
  ssl_cert_id?: string;
  ssl_status: string;
  ssl_auto_renew: boolean;
  
  // Binding
  binding_type: BindingType;
  binding_id?: string;
  proxy_target?: string;
  
  // Settings
  force_https: boolean;
  settings?: Record<string, unknown>;
  
  // Stats
  last_check_at?: string;
  total_visits: number;
  
  created_at: string;
  updated_at: string;
}

export type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA' | 'PTR';

export interface DNSRecord {
  id: string;
  site_id: string;
  subdomain_id?: string;
  type: DNSRecordType;
  name: string;
  content: string;
  ttl: number;
  priority: number;
  weight: number;
  port: number;
  proxied: boolean;
  comment?: string;
  enabled: boolean;
  verified: boolean;
  verified_at?: string;
  synced: boolean;
  last_sync_at?: string;
  sync_error?: string;
  created_at: string;
  updated_at: string;
}

export type SubdomainStatus = 'pending' | 'active' | 'inactive' | 'error';

export interface Subdomain {
  id: string;
  site_id: string;
  name: string;
  full_domain: string;
  status: SubdomainStatus;
  description?: string;
  
  // DNS Configuration
  record_type: DNSRecordType;
  target: string;
  ttl: number;
  proxied: boolean;
  
  // SSL Configuration
  ssl_enabled: boolean;
  ssl_cert_id?: string;
  
  // Binding
  binding_type: string;
  binding_id?: string;
  proxy_target?: string;
  redirect_url?: string;
  redirect_code: number;
  
  // Verification
  dns_verified: boolean;
  dns_verified_at?: string;
  last_check_at?: string;

  // Screenshot/Preview
  screenshot_url?: string;
  screenshot_path?: string;
  screenshot_at?: string;
  screenshot_error?: string;
  
  // Relations
  dns_records?: DNSRecord[];
  
  created_at: string;
  updated_at: string;
}

export interface DNSRecordInfo {
  type: string;
  name: string;
  values: string[];
  ttl: number;
  priority?: number;
}

export interface DNSInfo {
  domain: string;
  provider: string;
  nameservers: string[];
  records: DNSRecordInfo[];
  is_resolvable: boolean;
  points_to_us: boolean;
  error?: string;
}

export interface SSLStatus {
  enabled: boolean;
  status: string;
  auto_renew: boolean;
  certificate?: {
    id: string;
    domain: string;
    type: string;
    expires_at: string;
    auto_renew: boolean;
  };
}

export interface BindingInfo {
  type: BindingType;
  target?: string;
  app?: {
    id: string;
    name: string;
    status: string;
  };
  nginx_site?: {
    id: string;
    domain: string;
    enabled: boolean;
  };
}

// ===============================
// Request Types
// ===============================

export interface CreateSiteRequest {
  domain: string;
  name?: string;
  description?: string;
}

export interface UpdateSiteRequest {
  name?: string;
  description?: string;
  ssl_auto_renew?: boolean;
  force_https?: boolean;
  settings?: Record<string, unknown>;
}

export interface CreateDNSRecordRequest {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  weight?: number;
  port?: number;
  proxied?: boolean;
  comment?: string;
  subdomain_id?: string;
}

export interface UpdateDNSRecordRequest {
  type?: string;
  name?: string;
  content?: string;
  ttl?: number;
  priority?: number;
  weight?: number;
  port?: number;
  proxied?: boolean;
  comment?: string;
  enabled?: boolean;
}

export interface CreateSubdomainRequest {
  name: string;
  description?: string;
  record_type?: string;
  target?: string;
  ttl?: number;
  proxied?: boolean;
  binding_type?: string;
  proxy_target?: string;
  redirect_url?: string;
  redirect_code?: number;
}

export interface UpdateSubdomainRequest {
  name?: string;
  description?: string;
  record_type?: string;
  target?: string;
  ttl?: number;
  proxied?: boolean;
  ssl_enabled?: boolean;
  binding_type?: string;
  proxy_target?: string;
  redirect_url?: string;
  redirect_code?: number;
}

export interface BindToAppRequest {
  app_id: string;
}

export interface BindToNginxSiteRequest {
  nginx_site_id: string;
}

export interface BindToProxyRequest {
  target: string;
}

// ===============================
// Site API
// ===============================

// List all sites
export async function listSites(): Promise<Site[]> {
  return get<Site[]>('/sites');
}

// Get a single site
export async function getSite(id: string): Promise<Site> {
  return get<Site>(`/sites/${id}`);
}

// Create a new site
export async function createSite(data: CreateSiteRequest): Promise<Site> {
  return post<Site>('/sites', data);
}

// Update a site
export async function updateSite(id: string, data: UpdateSiteRequest): Promise<Site> {
  return put<Site>(`/sites/${id}`, data);
}

// Delete a site
export async function deleteSite(id: string): Promise<void> {
  return del<void>(`/sites/${id}`);
}

// ===============================
// DNS API
// ===============================

// Lookup DNS for a domain (before creating site)
export async function lookupDNS(domain: string): Promise<DNSInfo> {
  return get<DNSInfo>('/sites/dns/lookup', { domain });
}

// Verify DNS for a site
export async function verifyDNS(siteId: string): Promise<DNSInfo> {
  return post<DNSInfo>(`/sites/${siteId}/dns/verify`);
}

// Refresh DNS info for a site
export async function refreshDNS(siteId: string): Promise<DNSInfo> {
  return post<DNSInfo>(`/sites/${siteId}/dns/refresh`);
}

// List DNS records for a site
export async function listDNSRecords(siteId: string): Promise<DNSRecord[]> {
  return get<DNSRecord[]>(`/sites/${siteId}/dns/records`);
}

// Create a DNS record
export async function createDNSRecord(siteId: string, data: CreateDNSRecordRequest): Promise<DNSRecord> {
  return post<DNSRecord>(`/sites/${siteId}/dns/records`, data);
}

// Update a DNS record
export async function updateDNSRecord(siteId: string, recordId: string, data: UpdateDNSRecordRequest): Promise<void> {
  return put<void>(`/sites/${siteId}/dns/records/${recordId}`, data);
}

// Delete a DNS record
export async function deleteDNSRecord(siteId: string, recordId: string): Promise<void> {
  return del<void>(`/sites/${siteId}/dns/records/${recordId}`);
}

// Get a single DNS record
export async function getDNSRecord(siteId: string, recordId: string): Promise<DNSRecord> {
  return get<DNSRecord>(`/sites/${siteId}/dns/records/${recordId}`);
}

// Verify a DNS record
export async function verifyDNSRecord(siteId: string, recordId: string): Promise<DNSRecord> {
  return post<DNSRecord>(`/sites/${siteId}/dns/records/${recordId}/verify`);
}

// Bulk create DNS records
export async function bulkCreateDNSRecords(siteId: string, records: CreateDNSRecordRequest[]): Promise<DNSRecord[]> {
  return post<DNSRecord[]>(`/sites/${siteId}/dns/records/bulk`, { records });
}

// Import DNS records from actual DNS
export async function importDNSRecords(siteId: string): Promise<DNSRecord[]> {
  return post<DNSRecord[]>(`/sites/${siteId}/dns/records/import`);
}

// Clean duplicate/malformed DNS records
export async function cleanDNSRecords(siteId: string): Promise<void> {
  return post<void>(`/sites/${siteId}/dns/clean`);
}

// ===============================
// Subdomain API
// ===============================

// List subdomains for a site
export async function listSubdomains(siteId: string): Promise<Subdomain[]> {
  return get<Subdomain[]>(`/sites/${siteId}/subdomains`);
}

// Get a single subdomain
export async function getSubdomain(siteId: string, subdomainId: string): Promise<Subdomain> {
  return get<Subdomain>(`/sites/${siteId}/subdomains/${subdomainId}`);
}

// Create a subdomain
export async function createSubdomain(siteId: string, data: CreateSubdomainRequest): Promise<Subdomain> {
  return post<Subdomain>(`/sites/${siteId}/subdomains`, data);
}

// Update a subdomain
export async function updateSubdomain(siteId: string, subdomainId: string, data: UpdateSubdomainRequest): Promise<void> {
  return put<void>(`/sites/${siteId}/subdomains/${subdomainId}`, data);
}

// Delete a subdomain
export async function deleteSubdomain(siteId: string, subdomainId: string): Promise<void> {
  return del<void>(`/sites/${siteId}/subdomains/${subdomainId}`);
}

// Verify subdomain DNS
export async function verifySubdomain(siteId: string, subdomainId: string): Promise<Subdomain> {
  return post<Subdomain>(`/sites/${siteId}/subdomains/${subdomainId}/verify`);
}

// Bind subdomain to app
export async function bindSubdomainToApp(siteId: string, subdomainId: string, appId: string): Promise<void> {
  return post<void>(`/sites/${siteId}/subdomains/${subdomainId}/binding/app`, { app_id: appId });
}

// Bind subdomain to proxy
export async function bindSubdomainToProxy(siteId: string, subdomainId: string, target: string): Promise<void> {
  return post<void>(`/sites/${siteId}/subdomains/${subdomainId}/binding/proxy`, { target });
}

// Unbind subdomain
export async function unbindSubdomain(siteId: string, subdomainId: string): Promise<void> {
  return del<void>(`/sites/${siteId}/subdomains/${subdomainId}/binding`);
}

// Discover subdomains from DNS records
export async function discoverSubdomains(siteId: string): Promise<Subdomain[]> {
  return post<Subdomain[]>(`/sites/${siteId}/subdomains/discover`);
}

// Take screenshot for a subdomain
export async function takeSubdomainScreenshot(siteId: string, subdomainId: string): Promise<Subdomain> {
  return post<Subdomain>(`/sites/${siteId}/subdomains/${subdomainId}/screenshot`);
}

// Refresh all subdomain screenshots
export async function refreshAllScreenshots(siteId: string): Promise<void> {
  return post<void>(`/sites/${siteId}/subdomains/screenshots`);
}

// ===============================
// SSL API
// ===============================

// Request SSL certificate for a site
export async function requestSSL(siteId: string): Promise<void> {
  return post<void>(`/sites/${siteId}/ssl/request`);
}

// Get SSL status for a site
export async function getSSLStatus(siteId: string): Promise<SSLStatus> {
  return get<SSLStatus>(`/sites/${siteId}/ssl/status`);
}

// ===============================
// Binding API
// ===============================

// Get binding info for a site
export async function getBindingInfo(siteId: string): Promise<BindingInfo> {
  return get<BindingInfo>(`/sites/${siteId}/binding`);
}

// Bind site to an app
export async function bindToApp(siteId: string, data: BindToAppRequest): Promise<void> {
  return post<void>(`/sites/${siteId}/binding/app`, data);
}

// Bind site to an nginx site
export async function bindToNginxSite(siteId: string, data: BindToNginxSiteRequest): Promise<void> {
  return post<void>(`/sites/${siteId}/binding/nginx-site`, data);
}

// Bind site to a proxy target
export async function bindToProxy(siteId: string, data: BindToProxyRequest): Promise<void> {
  return post<void>(`/sites/${siteId}/binding/proxy`, data);
}

// Unbind site
export async function unbindSite(siteId: string): Promise<void> {
  return del<void>(`/sites/${siteId}/binding`);
}

// ===============================
// Available Resources API
// ===============================

interface App {
  id: string;
  name: string;
  status: string;
  domain?: string;
  host_port?: number;
}

interface NginxSite {
  id: string;
  name: string;
  domain: string;
  enabled: boolean;
}

// Get available apps for binding
export async function getAvailableApps(): Promise<App[]> {
  return get<App[]>('/sites/available/apps');
}

// Get available nginx sites for binding
export async function getAvailableNginxSites(): Promise<NginxSite[]> {
  return get<NginxSite[]>('/sites/available/nginx-sites');
}

