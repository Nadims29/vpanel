import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { PluginFrame } from '@/components/plugin/PluginFrame';
import { Card, Spinner, Empty } from '@/components/ui';
import { Puzzle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as pluginsApi from '@/api/plugins';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

/**
 * PluginPage renders a specific plugin's UI.
 * Route: /plugins/:pluginId/*
 */
export default function PluginPage() {
  const { pluginId, '*': subPath } = useParams();
  const [plugin, setPlugin] = useState<PluginInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlugin() {
      if (!pluginId) return;

      try {
        setLoading(true);
        const plugins = await pluginsApi.listPlugins();
        const foundPlugin = plugins.find((p) => p.id === pluginId);

        if (foundPlugin) {
          setPlugin(foundPlugin);
          setError(null);
        } else {
          setError('Plugin not found');
        }
      } catch (err) {
        console.error('Failed to load plugin:', err);
        setError('Failed to load plugin information');
      } finally {
        setLoading(false);
      }
    }

    loadPlugin();
  }, [pluginId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !plugin) {
    return (
      <div className="h-full">
        <div className="page-header">
          <Link
            to="/plugins"
            className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Plugins
          </Link>
          <h1 className="page-title">Plugin</h1>
        </div>
        <Card className="p-8">
          <Empty
            icon={<Puzzle className="w-8 h-8 text-gray-500" />}
            title={error || 'Plugin not found'}
            description="The requested plugin could not be loaded"
          />
        </Card>
      </div>
    );
  }

  if (!plugin.enabled) {
    return (
      <div className="h-full">
        <div className="page-header">
          <Link
            to="/plugins"
            className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Plugins
          </Link>
          <h1 className="page-title">{plugin.name}</h1>
          <p className="page-subtitle">v{plugin.version}</p>
        </div>
        <Card className="p-8">
          <Empty
            icon={<Puzzle className="w-8 h-8 text-gray-500" />}
            title="Plugin is disabled"
            description="Enable this plugin from the Plugins page to use it"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="page-header">
        <Link
          to="/plugins"
          className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Plugins
        </Link>
        <h1 className="page-title">{plugin.name}</h1>
        <p className="page-subtitle">v{plugin.version} - {plugin.description}</p>
      </div>
      <Card className="flex-1 p-0 overflow-hidden">
        <PluginFrame
          pluginId={pluginId!}
          path={subPath}
          title={plugin.name}
          className="h-full min-h-[600px]"
        />
      </Card>
    </div>
  );
}
