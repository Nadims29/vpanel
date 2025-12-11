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
  return get<User[]>('/users');
}

// Get user by ID
export async function getUser(id: string): Promise<User> {
  return get<User>(`/users/${id}`);
}

// Create a new user
export async function createUser(data: CreateUserRequest): Promise<User> {
  return post<User>('/users', data);
}

// Update user
export async function updateUser(id: string, data: UpdateUserRequest): Promise<User> {
  return put<User>(`/users/${id}`, data);
}

// Delete user
export async function deleteUser(id: string): Promise<void> {
  return del<void>(`/users/${id}`);
}

// Reset user password (if backend supports it)
export async function resetPassword(id: string, newPassword: string): Promise<void> {
  return put<void>(`/users/${id}/password`, { password: newPassword });
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
  return get<string[]>(`/users/${id}/permissions`);
}

// Update user permissions
export async function updateUserPermissions(id: string, permissions: string[]): Promise<void> {
  return put<void>(`/users/${id}/permissions`, { permissions });
}
