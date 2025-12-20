import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { Loader2, ShieldX } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';

interface PermissionGuardProps {
  /**
   * Single permission to check
   */
  permission?: string;
  
  /**
   * Multiple permissions - user needs ANY of these
   */
  anyOf?: string[];
  
  /**
   * Multiple permissions - user needs ALL of these
   */
  allOf?: string[];
  
  /**
   * Content to show when user has permission
   */
  children: ReactNode;
  
  /**
   * What to show when user doesn't have permission
   * - 'hide': Don't render anything
   * - 'disabled': Show children but disable interactions
   * - 'redirect': Redirect to specified path
   * - 'forbidden': Show forbidden message
   * - ReactNode: Custom fallback content
   */
  fallback?: 'hide' | 'disabled' | 'redirect' | 'forbidden' | ReactNode;
  
  /**
   * Redirect path (only used when fallback='redirect')
   */
  redirectTo?: string;
  
  /**
   * Show loading state while checking permissions
   */
  showLoading?: boolean;
}

/**
 * Component that guards content based on user permissions
 * 
 * @example
 * // Single permission
 * <PermissionGuard permission="docker:write">
 *   <DeleteButton />
 * </PermissionGuard>
 * 
 * @example
 * // Any of multiple permissions
 * <PermissionGuard anyOf={['docker:read', 'docker:write']} fallback="hide">
 *   <DockerPanel />
 * </PermissionGuard>
 * 
 * @example
 * // All permissions required
 * <PermissionGuard allOf={['docker:read', 'docker:write']} fallback="forbidden">
 *   <DockerAdmin />
 * </PermissionGuard>
 * 
 * @example
 * // Redirect on forbidden
 * <PermissionGuard permission="admin:access" fallback="redirect" redirectTo="/">
 *   <AdminPanel />
 * </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  anyOf,
  allOf,
  children,
  fallback = 'hide',
  redirectTo = '/',
  showLoading = true,
}: PermissionGuardProps) {
  const { can, canAny, canAll, isLoading, isAdmin } = usePermission();
  const location = useLocation();
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  // Show loading state
  if (isLoading && showLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  // Admin has all permissions
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check permissions
  let hasAccess = false;
  
  if (permission) {
    hasAccess = can(permission);
  } else if (anyOf && anyOf.length > 0) {
    hasAccess = canAny(...anyOf);
  } else if (allOf && allOf.length > 0) {
    hasAccess = canAll(...allOf);
  } else {
    // No permissions specified, allow access
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Handle fallback
  switch (fallback) {
    case 'hide':
      return null;

    case 'disabled':
      return (
        <div className="opacity-50 pointer-events-none cursor-not-allowed">
          {children}
        </div>
      );

    case 'redirect':
      return <Navigate to={redirectTo} state={{ from: location }} replace />;

    case 'forbidden':
      return (
        <div className={cn(
          'flex flex-col items-center justify-center p-8 rounded-lg border',
          isLight ? 'bg-red-50 border-red-200' : 'bg-red-900/20 border-red-800'
        )}>
          <ShieldX className={cn(
            'w-12 h-12 mb-4',
            isLight ? 'text-red-500' : 'text-red-400'
          )} />
          <h3 className={cn(
            'text-lg font-semibold mb-2',
            isLight ? 'text-red-900' : 'text-red-100'
          )}>
            Access Denied
          </h3>
          <p className={cn(
            'text-sm text-center',
            isLight ? 'text-red-700' : 'text-red-300'
          )}>
            You don't have permission to access this resource.
          </p>
        </div>
      );

    default:
      // Custom fallback content
      return <>{fallback}</>;
  }
}

/**
 * Higher-order component for permission-based rendering
 * 
 * @example
 * const ProtectedButton = withPermission(Button, 'docker:write');
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string,
  fallback: PermissionGuardProps['fallback'] = 'hide'
) {
  return function PermissionProtectedComponent(props: P) {
    return (
      <PermissionGuard permission={permission} fallback={fallback}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}

export default PermissionGuard;

