import { get, post, put, del } from './client';
import type { User } from './users';

// Role interface matching backend model
export interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  priority: number;
  user_count?: number;
  created_at: string;
  updated_at: string;
}

// Permission interface matching backend model
export interface Permission {
  id: number;
  name: string;
  display_name: string;
  description: string;
  category: string;
  is_system: boolean;
}

// Create role request
export interface CreateRoleRequest {
  name: string;
  display_name?: string;
  description?: string;
  permissions?: string[];
  priority?: number;
}

// Update role request
export interface UpdateRoleRequest {
  display_name?: string;
  description?: string;
  permissions?: string[];
  priority?: number;
}

// List all roles
export async function listRoles(): Promise<Role[]> {
  return get<Role[]>('/admin/roles');
}

// Get role by ID
export async function getRole(id: string): Promise<Role> {
  return get<Role>(`/admin/roles/${id}`);
}

// Create a new role
export async function createRole(data: CreateRoleRequest): Promise<Role> {
  return post<Role>('/admin/roles', data);
}

// Update role
export async function updateRole(id: string, data: UpdateRoleRequest): Promise<Role> {
  return put<Role>(`/admin/roles/${id}`, data);
}

// Delete role
export async function deleteRole(id: string): Promise<void> {
  return del<void>(`/admin/roles/${id}`);
}

// Get users with a specific role
export async function getRoleUsers(
  roleId: string, 
  params?: { page?: number; per_page?: number }
): Promise<{ data: User[]; total: number; page: number; per_page: number }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.per_page) queryParams.set('per_page', params.per_page.toString());
  
  const query = queryParams.toString();
  return get(`/admin/roles/${roleId}/users${query ? `?${query}` : ''}`);
}

// Assign role to user
export async function assignUserRole(userId: string, role: string): Promise<void> {
  return put<void>(`/admin/users/${userId}/role`, { role });
}

// List all permissions
export async function listPermissions(): Promise<Permission[]> {
  return get<Permission[]>('/admin/permissions');
}

// List permissions grouped by category
export async function listPermissionsGrouped(): Promise<Record<string, Permission[]>> {
  return get<Record<string, Permission[]>>('/admin/permissions?grouped=true');
}

// Get current user's effective permissions
export async function getMyPermissions(): Promise<string[]> {
  const response = await get<{ permissions: string[] }>('/profile/permissions');
  return response.permissions;
}

// Helper function to check if a role is a system role
export function isSystemRole(role: Role): boolean {
  return role.is_system;
}

// Helper function to get role type label
export function getRoleTypeLabel(role: Role): 'system' | 'custom' {
  return role.is_system ? 'system' : 'custom';
}
