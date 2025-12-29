import { get, post, put, del } from '@/api/client';

// ============================================
// Types
// ============================================

export type SSLCertificateType = 'letsencrypt' | 'custom' | 'selfsigned' | 'acme';
export type SSLCertificateStatus = 'pending' | 'active' | 'expired' | 'expiring' | 'error' | 'revoked';
export type SSLChallengeType = 'http-01' | 'dns-01' | 'tls-alpn';

export interface SSLCertificate {
  id: string;
  created_at: string;
  updated_at: string;
  node_id?: string;
  name: string;
  domain: string;
  domains: string[];
  is_wildcard: boolean;
  type: SSLCertificateType;
  status: SSLCertificateStatus;
  challenge_type: SSLChallengeType;
  
  // Certificate files
  cert_path: string;
  key_path: string;
  chain_path: string;
  fullchain_path: string;
  
  // Certificate details
  issuer: string;
  subject: string;
  serial_number: string;
  fingerprint: string;
  key_algorithm: string;
  key_size: number;
  issued_at: string;
  expires_at: string;
  days_remaining: number;
  
  // Auto renewal
  auto_renew: boolean;
  renew_before: number;
  last_renewed?: string;
  last_renew_error?: string;
  renew_count: number;
  
  // ACME account
  acme_email?: string;
  
  // Usage
  used_by?: string[];
  usage_count: number;
}

export interface SSLStats {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  letsencrypt: number;
  custom: number;
  self_signed: number;
}

export interface SSLValidation {
  valid: boolean;
  issues: string[];
  days_remaining: number;
}

// ============================================
// Request Types
// ============================================

export interface CreateLetsEncryptRequest {
  domain: string;
  domains?: string[];
  email?: string;
  challenge_type?: 'http-01' | 'dns-01';
  auto_renew?: boolean;
  renew_before?: number;
}

export interface CreateCustomCertRequest {
  name?: string;
  domain: string;
  certificate: string;
  private_key: string;
  chain?: string;
}

export interface CreateSelfSignedRequest {
  domain: string;
  domains?: string[];
  valid_days?: number;
  key_type?: 'RSA' | 'ECDSA';
  key_size?: number;
  common_name?: string;
  organization?: string;
}

export interface UpdateCertificateRequest {
  name?: string;
  auto_renew?: boolean;
  renew_before?: number;
}

export interface ListCertificatesParams {
  status?: SSLCertificateStatus;
  type?: SSLCertificateType;
  domain?: string;
  node_id?: string;
}

// ============================================
// API Functions
// ============================================

// List all certificates
export async function listCertificates(params?: ListCertificatesParams): Promise<SSLCertificate[]> {
  const result = await get<SSLCertificate[]>('/ssl', params as Record<string, unknown>);
  return result || [];
}

// Get certificate by ID
export async function getCertificate(id: string): Promise<SSLCertificate> {
  return get<SSLCertificate>(`/ssl/${id}`);
}

// Get certificate by domain
export async function getCertificateByDomain(domain: string): Promise<SSLCertificate> {
  return get<SSLCertificate>('/ssl/lookup', { domain });
}

// Get SSL statistics
export async function getStats(): Promise<SSLStats> {
  const result = await get<SSLStats>('/ssl/stats');
  return result || { total: 0, active: 0, expiring: 0, expired: 0, letsencrypt: 0, custom: 0, self_signed: 0 };
}

// Create Let's Encrypt certificate
export async function createLetsEncryptCert(req: CreateLetsEncryptRequest): Promise<SSLCertificate> {
  return post<SSLCertificate>('/ssl/letsencrypt', req);
}

// Upload custom certificate
export async function createCustomCert(req: CreateCustomCertRequest): Promise<SSLCertificate> {
  return post<SSLCertificate>('/ssl/custom', req);
}

// Create self-signed certificate
export async function createSelfSignedCert(req: CreateSelfSignedRequest): Promise<SSLCertificate> {
  return post<SSLCertificate>('/ssl/selfsigned', req);
}

// Update certificate
export async function updateCertificate(id: string, updates: UpdateCertificateRequest): Promise<void> {
  await put<void>(`/ssl/${id}`, updates);
}

// Delete certificate
export async function deleteCertificate(id: string): Promise<void> {
  await del<void>(`/ssl/${id}`);
}

// Renew certificate
export async function renewCertificate(id: string): Promise<void> {
  await post<void>(`/ssl/${id}/renew`);
}

// Validate certificate
export async function validateCertificate(id: string): Promise<SSLValidation> {
  return get<SSLValidation>(`/ssl/${id}/validate`);
}

// Check and renew expiring certificates
export async function checkExpiringCertificates(): Promise<void> {
  await post<void>('/ssl/check-expiring');
}


