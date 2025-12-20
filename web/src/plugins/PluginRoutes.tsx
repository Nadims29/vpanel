/**
 * Plugin Routes Component
 *
 * Dynamically renders routes from all registered plugins.
 */

import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { pluginRegistry } from './registry';

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
}

// Error boundary fallback
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-400 mb-2">Failed to load page</p>
        <p className="text-gray-500 text-sm">{error.message}</p>
      </div>
    </div>
  );
}

/**
 * Renders all plugin routes
 */
export function PluginRoutes() {
  const routes = pluginRegistry.getAllRoutes();

  return (
    <Routes>
      {routes.map((route) => (
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
    </Routes>
  );
}

/**
 * Get all plugin routes for use in router configuration
 */
export function getPluginRouteElements() {
  const routes = pluginRegistry.getAllRoutes();

  return routes.map((route) => ({
    path: route.path,
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <route.component />
      </Suspense>
    ),
  }));
}

export { pluginRegistry };

