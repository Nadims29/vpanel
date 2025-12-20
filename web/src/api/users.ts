import { get, post, put, del } from './client';

// User interface matching backend model
export interface User {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  avatar?: string;
  role: string;
  status: 'active' | 'inactive' | 'locked' | 'pending';
  mfa_enabled: boolean;
  last_login_at?: string;
  last_login_ip?: string;
  permissions?: string[];
  created_at: string;
  updated_at: string;
}

// Create user request
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
  role?: string;
}

// Update user request
export interface UpdateUserRequest {
  username?: string;
  email?: string;
  display_name?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'locked' | 'pending';
  avatar?: string;
}

// Invite user request
export interface InviteUserRequest {
  email: string;
  display_name?: string;
  role?: string;
  require_mfa?: boolean;
}

// List all users
export async function listUsers(): Promise<User[]> {
  return get<User[]>('/admin/users');
}

// Get user by ID
export async function getUser(id: string): Promise<User> {
  return get<User>(`/admin/users/${id}`);
}

// Create a new user
export async function createUser(data: CreateUserRequest): Promise<User> {
  return post<User>('/admin/users', data);
}

// Update user
export async function updateUser(id: string, data: UpdateUserRequest): Promise<User> {
  return put<User>(`/admin/users/${id}`, data);
}

// Delete user
export async function deleteUser(id: string): Promise<void> {
  return del<void>(`/admin/users/${id}`);
}

// Reset user password (if backend supports it)
export async function resetPassword(id: string, newPassword: string): Promise<void> {
  return put<void>(`/admin/users/${id}/password`, { password: newPassword });
}

// Lock user account
export async function lockUser(id: string): Promise<User> {
  return updateUser(id, { status: 'locked' });
}

// Unlock user account
export async function unlockUser(id: string): Promise<User> {
  return updateUser(id, { status: 'active' });
}

// Get user permissions
export async function getUserPermissions(id: string): Promise<string[]> {
  return get<string[]>(`/admin/users/${id}/permissions`);
}

// Update user permissions
export async function updateUserPermissions(id: string, permissions: string[]): Promise<void> {
  return put<void>(`/admin/users/${id}/permissions`, { permissions });
}

// MFA Management
export interface MFASetupResponse {
  secret: string;
  qr_code: string; // base64 QR code image
  backup_codes?: string[];
}

// Enable MFA for a user (admin action)
export async function enableUserMFA(id: string): Promise<MFASetupResponse> {
  return post<MFASetupResponse>(`/admin/users/${id}/mfa/enable`, {});
}

// Disable MFA for a user (admin action)
export async function disableUserMFA(id: string): Promise<void> {
  return post<void>(`/admin/users/${id}/mfa/disable`, {});
}

// Reset MFA for a user (admin action - generates new secret)
export async function resetUserMFA(id: string): Promise<MFASetupResponse> {
  return post<MFASetupResponse>(`/admin/users/${id}/mfa/reset`, {});
}

// Activity Log Types
export interface UserActivity {
  id: number;
  action: string;
  resource: string;
  resource_id: string;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failed';
  details?: Record<string, unknown>;
  created_at: string;
}

export interface UserActivityResponse {
  logs: UserActivity[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Get user activity logs
export async function getUserActivity(
  id: string, 
  params?: { page?: number; page_size?: number }
): Promise<UserActivityResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('per_page', params.page_size.toString());
  queryParams.set('user_id', id);
  
  return get<UserActivityResponse>(`/admin/audit-logs?${queryParams.toString()}`);
}

// Login attempts for a specific user
export interface LoginAttempt {
  id: number;
  username: string;
  ip_address: string;
  success: boolean;
  reason: string;
  created_at: string;
}

export async function getUserLoginAttempts(id: string): Promise<LoginAttempt[]> {
  return get<LoginAttempt[]>(`/admin/users/${id}/login-attempts`);
}
