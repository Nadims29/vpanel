import { useState, useEffect, useRef } from 'react';
import { Spinner } from '@/components/ui';
import { cn } from '@/utils/cn';

interface PluginFrameProps {
  pluginId: string;
  path?: string;
  title?: string;
  className?: string;
}

/**
 * PluginFrame renders a plugin's UI in a sandboxed iframe.
 * The iframe loads the plugin's static assets from the backend.
 */
export function PluginFrame({ pluginId, path = '', title, className }: PluginFrameProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Construct the iframe source URL
  const src = `/api/plugin/${pluginId}/static/index.html${path ? `#${path}` : ''}`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setLoading(false);
      setError(null);
    };

    const handleError = () => {
      setLoading(false);
      setError('Failed to load plugin content');
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [src]);

  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our iframe
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type, payload } = event.data || {};

      switch (type) {
        case 'plugin:ready':
          console.log(`Plugin ${pluginId} is ready`);
          break;
        case 'plugin:navigate':
          // Handle navigation request from plugin
          if (payload?.path) {
            window.location.href = payload.path;
          }
          break;
        case 'plugin:notification':
          // Handle notification request from plugin
          // Could integrate with toast system
          console.log('Plugin notification:', payload);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [pluginId]);

  return (
    <div className={cn('relative w-full h-full min-h-[400px]', className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
          <div className="text-center p-4">
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                if (iframeRef.current) {
                  iframeRef.current.src = src;
                }
              }}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={src}
        title={title || `Plugin: ${pluginId}`}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}

/**
 * usePluginCommunication hook for parent-child communication with plugin iframe.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePluginCommunication(pluginId: string) {
  const sendMessage = (type: string, payload?: unknown) => {
    const iframe = document.querySelector(
      `iframe[title*="${pluginId}"]`
    ) as HTMLIFrameElement | null;

    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type, payload }, '*');
    }
  };

  return { sendMessage };
}

export default PluginFrame;
