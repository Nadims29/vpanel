import { create } from 'zustand';
import { get } from '@/api/client';

interface PermissionsState {
  permissions: string[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  
  // Actions
  fetchPermissions: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
  clearPermissions: () => void;
}

export const usePermissionsStore = create<PermissionsState>()((set, getState) => ({
  permissions: [],
  isLoading: false,
  isLoaded: false,
  error: null,

  fetchPermissions: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await get<{ permissions: string[] }>('/profile/permissions');
      set({
        permissions: response.permissions || [],
        isLoading: false,
        isLoaded: true,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch permissions',
        isLoading: false,
        isLoaded: true,
        permissions: [],
      });
    }
  },

  hasPermission: (permission: string): boolean => {
    const { permissions } = getState();
    
    // Wildcard check
    if (permissions.includes('*')) {
      return true;
    }

    // Exact match
    if (permissions.includes(permission)) {
      return true;
    }

    // Category wildcard check (e.g., "docker:*" matches "docker:read")
    const [category] = permission.split(':');
    if (category && permissions.includes(`${category}:*`)) {
      return true;
    }

    return false;
  },

  hasAnyPermission: (...requiredPermissions: string[]): boolean => {
    const { hasPermission } = getState();
    return requiredPermissions.some(p => hasPermission(p));
  },

  hasAllPermissions: (...requiredPermissions: string[]): boolean => {
    const { hasPermission } = getState();
    return requiredPermissions.every(p => hasPermission(p));
  },

  clearPermissions: () => {
    set({ permissions: [], isLoaded: false, error: null });
  },
}));

// Permission constants
export const PERMISSIONS = {
  // Sites
  SITES_READ: 'sites:read',
  SITES_WRITE: 'sites:write',
  SITES_DELETE: 'sites:delete',

  // Docker
  DOCKER_READ: 'docker:read',
  DOCKER_WRITE: 'docker:write',

  // Files
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  FILES_DELETE: 'files:delete',

  // Database
  DATABASE_READ: 'database:read',
  DATABASE_WRITE: 'database:write',

  // Monitor
  MONITOR_READ: 'monitor:read',

  // Cron
  CRON_READ: 'cron:read',
  CRON_WRITE: 'cron:write',

  // Firewall
  FIREWALL_READ: 'firewall:read',
  FIREWALL_WRITE: 'firewall:write',

  // Terminal
  TERMINAL_ACCESS: 'terminal:access',

  // Users (admin)
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',

  // Settings (admin)
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',

  // Plugins (admin)
  PLUGINS_READ: 'plugins:read',
  PLUGINS_WRITE: 'plugins:write',

  // Audit (admin)
  AUDIT_READ: 'audit:read',

  // Wildcard
  ALL: '*',
} as const;

