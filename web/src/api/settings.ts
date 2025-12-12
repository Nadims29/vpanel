import { get, put } from './client';

// System settings interfaces
export interface GeneralSettings {
  site_name: string;
  site_url: string;
  site_description: string;
  theme: string;
  language: string;
  timezone: string;
}

export interface SecuritySettings {
  enable_2fa: boolean;
  require_2fa: boolean;
  session_timeout: number;
  max_login_attempts: number;
  lockout_duration: number;
  oauth_github_enabled: boolean;
  oauth_github_client_id: string;
  oauth_google_enabled: boolean;
  oauth_google_client_id: string;
}

export interface NotificationSettings {
  email_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  cpu_alerts: boolean;
  memory_alerts: boolean;
  disk_alerts: boolean;
  service_alerts: boolean;
  ssl_alerts: boolean;
  security_alerts: boolean;
  webhook_enabled: boolean;
  webhook_url: string;
}

export interface BackupSettings {
  auto_backup_enabled: boolean;
  backup_schedule: string;
  backup_retention: number;
  backup_time: string;
  storage_type: string;
  backup_path: string;
}

export interface AdvancedSettings {
  server_port: number;
  max_upload_size: number;
  enable_https: boolean;
  rate_limit_enabled: boolean;
  log_level: string;
  log_retention: number;
}

export interface SystemSettings {
  general: GeneralSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
  backup: BackupSettings;
  advanced: AdvancedSettings;
}

// Get all system settings
export async function getSystemSettings(): Promise<SystemSettings> {
  return get<SystemSettings>('/settings');
}

// Update system settings
export async function updateSystemSettings(updates: Partial<SystemSettings>): Promise<void> {
  // Flatten nested structure for API
  const flatUpdates: Record<string, string | number | boolean> = {};
  
  if (updates.general) {
    Object.entries(updates.general).forEach(([key, value]) => {
      flatUpdates[key] = value;
    });
  }
  
  if (updates.security) {
    Object.entries(updates.security).forEach(([key, value]) => {
      flatUpdates[key] = value;
    });
  }
  
  if (updates.notifications) {
    Object.entries(updates.notifications).forEach(([key, value]) => {
      flatUpdates[key] = value;
    });
  }
  
  if (updates.backup) {
    Object.entries(updates.backup).forEach(([key, value]) => {
      flatUpdates[key] = value;
    });
  }
  
  if (updates.advanced) {
    Object.entries(updates.advanced).forEach(([key, value]) => {
      flatUpdates[key] = value;
    });
  }
  
  return put<void>('/settings', flatUpdates);
}

// Get backup settings
export async function getBackupSettings(): Promise<BackupSettings> {
  return get<BackupSettings>('/settings/backup');
}

// Update backup settings
export async function updateBackupSettings(settings: Partial<BackupSettings>): Promise<void> {
  return put<void>('/settings/backup', settings);
}

// Get notification settings
export async function getNotificationSettings(): Promise<NotificationSettings> {
  return get<NotificationSettings>('/settings/notification');
}

// Update notification settings
export async function updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
  return put<void>('/settings/notification', settings);
}
