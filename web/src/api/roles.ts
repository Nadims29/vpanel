import { get, post, put, del } from './client';
import * as usersApi from './users';

// Role interface
export interface Role {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'custom';
  userCount: number;
  permissions: { [key: string]: ('read' | 'write' | 'delete' | 'admin')[] };
  createdAt: string;
  updatedAt: string;
}

// Create role request
export interface CreateRoleRequest {
  name: string;
  description: string;
  permissions: { [key: string]: ('read' | 'write' | 'delete' | 'admin')[] };
}

// Update role request
export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: { [key: string]: ('read' | 'write' | 'delete' | 'admin')[] };
}

// System roles definition
const SYSTEM_ROLES = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full system access with all permissions',
    permissions: { '*': ['read', 'write', 'delete', 'admin'] },
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access to most features',
    permissions: {
      'docker.*': ['read', 'write', 'delete'],
      'nginx.*': ['read', 'write', 'delete'],
      'database.*': ['read', 'write'],
      'files.*': ['read', 'write'],
      'terminal.*': ['read'],
      'settings.users': ['read'],
    },
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'Operational access for day-to-day tasks',
    permissions: {
      'docker.containers': ['read', 'write'],
      'docker.images': ['read'],
      'nginx.sites': ['read', 'write'],
      'files.*': ['read', 'write'],
      'terminal.access': ['read'],
      'cron.jobs': ['read', 'write'],
    },
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to view resources',
    permissions: {
      '*': ['read'],
    },
  },
  {
    id: 'user',
    name: 'User',
    description: 'Basic user access',
    permissions: {},
  },
];

// List all roles (combines system roles with user data)
export async function listRoles(): Promise<Role[]> {
  try {
    // Get all users to count role usage
    const users = await usersApi.listUsers();
    
    // Count users per role
    const roleCounts: { [key: string]: number } = {};
    users.forEach(user => {
      const role = user.role || 'user';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });

    // Build system roles with user counts
    const systemRoles: Role[] = SYSTEM_ROLES.map(sysRole => ({
      id: sysRole.id,
      name: sysRole.name,
      description: sysRole.description,
      type: 'system' as const,
      userCount: roleCounts[sysRole.id] || 0,
      permissions: sysRole.permissions,
      createdAt: '2024-01-01',
      updatedAt: new Date().toISOString().split('T')[0],
    }));

    // For now, we'll return system roles only
    // Custom roles would need backend support
    return systemRoles;
  } catch (error) {
    console.error('Failed to list roles:', error);
    // Return system roles as fallback
    return SYSTEM_ROLES.map(sysRole => ({
      id: sysRole.id,
      name: sysRole.name,
      description: sysRole.description,
      type: 'system' as const,
      userCount: 0,
      permissions: sysRole.permissions,
      createdAt: '2024-01-01',
      updatedAt: new Date().toISOString().split('T')[0],
    }));
  }
}

// Get role by ID
export async function getRole(id: string): Promise<Role> {
  const roles = await listRoles();
  const role = roles.find(r => r.id === id);
  if (!role) {
    throw new Error('Role not found');
  }
  return role;
}

// Create a custom role (would need backend support)
export async function createRole(data: CreateRoleRequest): Promise<Role> {
  // TODO: Implement when backend supports custom roles
  // For now, this is a placeholder
  throw new Error('Custom roles not yet supported by backend');
}

// Update role (system roles are read-only, custom roles can be updated)
export async function updateRole(id: string, data: UpdateRoleRequest): Promise<Role> {
  // TODO: Implement when backend supports custom roles
  throw new Error('Role updates not yet supported by backend');
}

// Delete role
export async function deleteRole(id: string): Promise<void> {
  // TODO: Implement when backend supports custom roles
  throw new Error('Role deletion not yet supported by backend');
}

// Get users with a specific role
export async function getRoleUsers(roleId: string): Promise<usersApi.User[]> {
  const users = await usersApi.listUsers();
  return users.filter(user => (user.role || 'user') === roleId);
}

// Update user permissions (uses existing user API)
export async function updateRolePermissions(roleId: string, permissions: string[]): Promise<void> {
  // This would update all users with this role
  // For now, we'll need to update users individually
  const users = await getRoleUsers(roleId);
  for (const user of users) {
    await usersApi.updateUserPermissions(user.id, permissions);
  }
}
