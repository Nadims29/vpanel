import { get, post } from './client';

// Version information
export interface VersionInfo {
  version: string;
  build_time: string;
  git_commit: string;
  release_date?: string;
  changelog?: string;
  download_url?: string;
  checksum?: string;
  size?: number;
}

// Update status
export type UpdateState = 
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'restarting'
  | 'completed'
  | 'failed';

export interface UpdateStatus {
  state: UpdateState;
  progress: number;
  message: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

// Check update response
export interface CheckUpdateResponse {
  has_update: boolean;
  current_version: string;
  latest_version?: VersionInfo;
}

// Current version response
export interface CurrentVersion {
  version: string;
  build_time: string;
  git_commit: string;
}

// Get current version
export async function getCurrentVersion(): Promise<CurrentVersion> {
  return get<CurrentVersion>('/update/version');
}

// Get update status
export async function getUpdateStatus(): Promise<UpdateStatus> {
  return get<UpdateStatus>('/update/status');
}

// Check for updates
export async function checkForUpdates(): Promise<CheckUpdateResponse> {
  return post<CheckUpdateResponse>('/update/check');
}

// Perform update
export async function performUpdate(): Promise<{ message: string; data: UpdateStatus }> {
  return post<{ message: string; data: UpdateStatus }>('/update/perform');
}

