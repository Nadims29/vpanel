import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useLicenseStore } from '@/stores/license';
import MainLayout from '@/components/layout/MainLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import { Loader2 } from 'lucide-react';

// Import plugin registry
import { pluginRegistry } from '@/plugins/registry';

// Core pages (not plugins - these stay in web/src/pages)
import Login from '@/pages/Login';

// Settings pages (core functionality, not plugins)
const Users = lazy(() => import('@/pages/settings/Users'));
const Roles = lazy(() => import('@/pages/settings/Roles'));
const Teams = lazy(() => import('@/pages/settings/Teams'));
const SystemSettings = lazy(() => import('@/pages/settings/System'));
const PluginsSettings = lazy(() => import('@/pages/settings/Plugins'));
const License = lazy(() => import('@/pages/settings/License'));

// Other core pages
const AuditLogs = lazy(() => import('@/pages/logs/Audit'));

// Loading fallback
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fetchLicense = useLicenseStore((state) => state.fetchLicense);

  // Initialize theme on mount
  useEffect(() => {
    useThemeStore.getState();
  }, []);

  // Fetch license when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchLicense();
    }
  }, [isAuthenticated, fetchLicense]);

  // Get all plugin routes
  const pluginRoutes = pluginRegistry.getAllRoutes();

  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Plugin routes - dynamically loaded from registry */}
        {pluginRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Suspense fallback={<LoadingFallback />}>
                <route.component />
              </Suspense>
            }
          />
        ))}

        {/* Settings (core functionality - auth, users, system) */}
        <Route
          path="/settings/users"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Users />
            </Suspense>
          }
        />
        <Route
          path="/settings/roles"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Roles />
            </Suspense>
          }
        />
        <Route
          path="/settings/teams"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Teams />
            </Suspense>
          }
        />
        <Route
          path="/settings/system"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <SystemSettings />
            </Suspense>
          }
        />
        <Route
          path="/settings/plugins"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <PluginsSettings />
            </Suspense>
          }
        />
        <Route
          path="/settings/license"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <License />
            </Suspense>
          }
        />

        {/* Logs (core functionality) */}
        <Route
          path="/logs/audit"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <AuditLogs />
            </Suspense>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
