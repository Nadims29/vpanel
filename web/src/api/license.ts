import { get, post } from './client';

// License info interface
export interface LicenseInfo {
  is_pro: boolean;
  is_enterprise: boolean;
  plan: string;
  email?: string;
  expires_at?: string;
  features: string[];
  days_remaining: number;
  max_users: number;
  max_servers: number;
}

// Activate license request
export interface ActivateLicenseRequest {
  license_key: string;
}

// Get current license info
export async function getLicenseInfo(): Promise<LicenseInfo> {
  return get<LicenseInfo>('/license');
}

// Activate a license
export async function activateLicense(licenseKey: string): Promise<LicenseInfo> {
  return post<LicenseInfo>('/license/activate', { license_key: licenseKey });
}

// Deactivate current license
export async function deactivateLicense(): Promise<void> {
  return post<void>('/license/deactivate');
}

// Refresh license validation
export async function refreshLicense(): Promise<LicenseInfo> {
  return post<LicenseInfo>('/license/refresh');
}

// Pro purchase URL
export const PRO_PURCHASE_URL = 'https://vcloud.zsoft.cc/pricing';

// Pro features list
export const PRO_FEATURES = [
  { id: 'invite_users', name: 'Email Invitations', description: 'Send email invitations to new users' },
  { id: 'advanced_backup', name: 'Advanced Backup', description: 'Scheduled backups with cloud storage' },
  { id: 'audit_export', name: 'Audit Export', description: 'Export audit logs to CSV/JSON' },
  { id: 'api_unlimited', name: 'Unlimited API Keys', description: 'Create unlimited API keys' },
  { id: 'team_management', name: 'Team Management', description: 'Advanced team and role management' },
  { id: 'priority_support', name: 'Priority Support', description: '24/7 priority support' },
];

