import { useEffect, useMemo } from 'react';
import { usePermissionsStore } from '@/stores/permissions';
import { useAuthStore } from '@/stores/auth';

/**
 * Hook to check user permissions
 * 
 * @example
 * // Check single permission
 * const { hasPermission } = usePermission();
 * if (hasPermission('docker:read')) { ... }
 * 
 * @example
 * // Check with auto-load
 * const { can, canAny, canAll, isLoading } = usePermission();
 * if (can('docker:read')) { ... }
 * if (canAny('docker:read', 'docker:write')) { ... }
 * if (canAll('docker:read', 'docker:write')) { ... }
 */
export function usePermission() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const { 
    permissions, 
    isLoading, 
    isLoaded, 
    fetchPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  } = usePermissionsStore();

  // Fetch permissions when authenticated and not loaded
  useEffect(() => {
    if (isAuthenticated && !isLoaded && !isLoading) {
      fetchPermissions();
    }
  }, [isAuthenticated, isLoaded, isLoading, fetchPermissions]);

  // Check if user is admin (has all permissions)
  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || permissions.includes('*');
  }, [user?.role, permissions]);

  return {
    permissions,
    isLoading,
    isLoaded,
    isAdmin,
    
    // Permission check methods
    can: hasPermission,
    hasPermission,
    canAny: hasAnyPermission,
    hasAnyPermission,
    canAll: hasAllPermissions,
    hasAllPermissions,
    
    // Refresh permissions
    refresh: fetchPermissions,
  };
}

/**
 * Hook specifically for checking a single permission
 * Returns boolean indicating if user has the permission
 * 
 * @example
 * const canEditDocker = useHasPermission('docker:write');
 */
export function useHasPermission(permission: string): boolean {
  const { can, isLoading, isAdmin } = usePermission();
  
  if (isLoading) {
    return false;
  }
  
  if (isAdmin) {
    return true;
  }
  
  return can(permission);
}

/**
 * Hook for checking if user has any of the specified permissions
 * 
 * @example
 * const canAccessDocker = useHasAnyPermission('docker:read', 'docker:write');
 */
export function useHasAnyPermission(...permissions: string[]): boolean {
  const { canAny, isLoading, isAdmin } = usePermission();
  
  if (isLoading) {
    return false;
  }
  
  if (isAdmin) {
    return true;
  }
  
  return canAny(...permissions);
}

/**
 * Hook for checking if user has all of the specified permissions
 * 
 * @example
 * const canManageDocker = useHasAllPermissions('docker:read', 'docker:write', 'docker:delete');
 */
export function useHasAllPermissions(...permissions: string[]): boolean {
  const { canAll, isLoading, isAdmin } = usePermission();
  
  if (isLoading) {
    return false;
  }
  
  if (isAdmin) {
    return true;
  }
  
  return canAll(...permissions);
}

export default usePermission;

