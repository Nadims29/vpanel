import { useState, useEffect } from 'react';
import {
  Puzzle,
  Package,
  Info,
  Settings,
  Power,
  PowerOff,
  Trash2,
  ExternalLink,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  Box,
  Cpu,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Input,
  Badge,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import * as pluginsApi from '@/api/plugins';
import type { Plugin, PluginListResponse, CoreInfo, PluginStats, MarketPlugin } from '@/api/plugins';

export default function PluginsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [stats, setStats] = useState<PluginStats | null>(null);
  const [coreInfo, setCoreInfo] = useState<CoreInfo | null>(null);
  const [marketPlugins, setMarketPlugins] = useState<MarketPlugin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'builtin' | 'external'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  useEffect(() => {
    loadPlugins();
  }, []);

  async function loadPlugins() {
    try {
      setLoading(true);
      setError(null);
      const response = await pluginsApi.listPlugins();
      setPlugins(response.plugins || []);
      setStats(response.stats);
      setCoreInfo(response.core);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
      console.error('Failed to load plugins:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMarketPlugins() {
    try {
      const data = await pluginsApi.getMarketPlugins();
      setMarketPlugins(data || []);
    } catch (err) {
      console.error('Failed to load market plugins:', err);
    }
  }

  async function handleEnable(id: string) {
    try {
      setActionLoading(id);
      await pluginsApi.enablePlugin(id);
      await loadPlugins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable plugin');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisable(id: string) {
    try {
      setActionLoading(id);
      await pluginsApi.disablePlugin(id);
      await loadPlugins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable plugin');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUninstall(id: string) {
    if (!confirm(`Are you sure you want to uninstall "${id}"?`)) return;
    try {
      setActionLoading(id);
      await pluginsApi.uninstallPlugin(id);
      await loadPlugins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall plugin');
    } finally {
      setActionLoading(null);
    }
  }

  const filteredPlugins = plugins.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'enabled':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'disabled':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'loading':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'builtin':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'external':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
            Plugins
          </h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>
            Manage installed plugins and extensions
          </p>
        </div>
        <Button
          leftIcon={<RefreshCw className="w-4 h-4" />}
          onClick={loadPlugins}
          variant="secondary"
        >
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className={cn(
            'mb-4 p-4 rounded-lg flex items-center gap-2',
            isLight
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-red-900/20 text-red-400 border border-red-800'
          )}
        >
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Core Info & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  isLight ? 'bg-blue-100' : 'bg-blue-500/20'
                )}
              >
                <Cpu className={cn('w-5 h-5', isLight ? 'text-blue-600' : 'text-blue-400')} />
              </div>
              <div>
                <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  Core Version
                </p>
                <p className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {coreInfo?.version || 'unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  isLight ? 'bg-green-100' : 'bg-green-500/20'
                )}
              >
                <CheckCircle
                  className={cn('w-5 h-5', isLight ? 'text-green-600' : 'text-green-400')}
                />
              </div>
              <div>
                <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  Enabled Plugins
                </p>
                <p className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {stats?.enabled || 0} / {stats?.total || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  isLight ? 'bg-indigo-100' : 'bg-indigo-500/20'
                )}
              >
                <Box className={cn('w-5 h-5', isLight ? 'text-indigo-600' : 'text-indigo-400')} />
              </div>
              <div>
                <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  Builtin Plugins
                </p>
                <p className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {stats?.builtin || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  isLight ? 'bg-purple-100' : 'bg-purple-500/20'
                )}
              >
                <Puzzle
                  className={cn('w-5 h-5', isLight ? 'text-purple-600' : 'text-purple-400')}
                />
              </div>
              <div>
                <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  External Plugins
                </p>
                <p className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {stats?.external || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Core Details */}
      {coreInfo && (
        <Card className="mb-6">
          <CardHeader>
            <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
              System Information
            </h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Version</p>
                <p className={cn('font-mono', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {coreInfo.version}
                </p>
              </div>
              <div>
                <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  Build Time
                </p>
                <p className={cn('font-mono', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {coreInfo.build_time}
                </p>
              </div>
              <div>
                <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  Git Commit
                </p>
                <p className={cn('font-mono', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {coreInfo.git_commit?.substring(0, 8) || 'unknown'}
                </p>
              </div>
              <div>
                <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  Go Version
                </p>
                <p className={cn('font-mono', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {coreInfo.go_version}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="installed">
        <TabList className="mb-6">
          <Tab value="installed" icon={<Package className="w-4 h-4" />}>
            Installed ({stats?.total || 0})
          </Tab>
          <Tab value="market" icon={<Download className="w-4 h-4" />} onClick={loadMarketPlugins}>
            Marketplace
          </Tab>
        </TabList>

        {/* Installed Plugins */}
        <TabPanel value="installed">
          {/* Search and Filter */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search
                className={cn(
                  'w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2',
                  isLight ? 'text-gray-400' : 'text-gray-500'
                )}
              />
              <Input
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter
                className={cn('w-4 h-4', isLight ? 'text-gray-400' : 'text-gray-500')}
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'builtin' | 'external')}
                className={cn(
                  'px-3 py-2 rounded-lg border text-sm',
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-gray-800 border-gray-700 text-gray-100'
                )}
              >
                <option value="all">All Types</option>
                <option value="builtin">Builtin</option>
                <option value="external">External</option>
              </select>
            </div>
          </div>

          {/* Plugin List */}
          <div className="space-y-4">
            {filteredPlugins.length === 0 ? (
              <div className="text-center py-12">
                <Puzzle
                  className={cn(
                    'w-12 h-12 mx-auto mb-4',
                    isLight ? 'text-gray-400' : 'text-gray-600'
                  )}
                />
                <p className={cn('text-lg font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  No plugins found
                </p>
                <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'No plugins are currently installed'}
                </p>
              </div>
            ) : (
              filteredPlugins.map((plugin) => (
                <Card key={plugin.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-lg flex items-center justify-center',
                            isLight ? 'bg-gray-100' : 'bg-gray-800'
                          )}
                        >
                          {plugin.icon ? (
                            <img
                              src={plugin.icon}
                              alt={plugin.name}
                              className="w-8 h-8 rounded"
                            />
                          ) : (
                            <Puzzle
                              className={cn(
                                'w-6 h-6',
                                isLight ? 'text-gray-400' : 'text-gray-500'
                              )}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className={cn(
                                'font-semibold',
                                isLight ? 'text-gray-900' : 'text-gray-100'
                              )}
                            >
                              {plugin.name}
                            </h3>
                            <Badge variant="outline" className={getTypeColor(plugin.type)}>
                              {plugin.type}
                            </Badge>
                            <Badge variant="outline" className={getStatusColor(plugin.status)}>
                              {plugin.status}
                            </Badge>
                            <span
                              className={cn(
                                'text-sm',
                                isLight ? 'text-gray-500' : 'text-gray-400'
                              )}
                            >
                              v{plugin.version}
                            </span>
                          </div>
                          <p
                            className={cn(
                              'text-sm mb-2',
                              isLight ? 'text-gray-600' : 'text-gray-400'
                            )}
                          >
                            {plugin.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs">
                            {plugin.author && (
                              <span className={isLight ? 'text-gray-500' : 'text-gray-500'}>
                                By {plugin.author}
                              </span>
                            )}
                            {plugin.category && (
                              <span className={isLight ? 'text-gray-500' : 'text-gray-500'}>
                                {plugin.category}
                              </span>
                            )}
                            {plugin.dependencies && plugin.dependencies.length > 0 && (
                              <span className={isLight ? 'text-gray-500' : 'text-gray-500'}>
                                Depends on: {plugin.dependencies.join(', ')}
                              </span>
                            )}
                          </div>
                          {plugin.error && (
                            <div className="mt-2 text-sm text-red-400">{plugin.error}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {plugin.homepage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(plugin.homepage, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        {plugin.enabled ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDisable(plugin.id)}
                            disabled={actionLoading === plugin.id}
                          >
                            {actionLoading === plugin.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PowerOff className="w-4 h-4" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEnable(plugin.id)}
                            disabled={actionLoading === plugin.id}
                          >
                            {actionLoading === plugin.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        {plugin.type === 'external' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUninstall(plugin.id)}
                            disabled={actionLoading === plugin.id}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabPanel>

        {/* Marketplace */}
        <TabPanel value="market">
          <div className="text-center py-12">
            <Download
              className={cn(
                'w-12 h-12 mx-auto mb-4',
                isLight ? 'text-gray-400' : 'text-gray-600'
              )}
            />
            <p className={cn('text-lg font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
              Plugin Marketplace
            </p>
            <p className={cn('mb-4', isLight ? 'text-gray-600' : 'text-gray-400')}>
              Browse and install plugins from the community marketplace
            </p>
            {marketPlugins.length === 0 ? (
              <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-500')}>
                No plugins available in the marketplace yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {marketPlugins.map((plugin) => (
                  <Card key={plugin.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        {plugin.icon ? (
                          <img
                            src={plugin.icon}
                            alt={plugin.name}
                            className="w-10 h-10 rounded-lg"
                          />
                        ) : (
                          <div
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center',
                              isLight ? 'bg-gray-100' : 'bg-gray-800'
                            )}
                          >
                            <Puzzle className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <h4
                            className={cn(
                              'font-medium',
                              isLight ? 'text-gray-900' : 'text-gray-100'
                            )}
                          >
                            {plugin.name}
                          </h4>
                          <p
                            className={cn(
                              'text-sm',
                              isLight ? 'text-gray-500' : 'text-gray-400'
                            )}
                          >
                            v{plugin.version} by {plugin.author}
                          </p>
                        </div>
                      </div>
                      <p
                        className={cn(
                          'text-sm mb-3',
                          isLight ? 'text-gray-600' : 'text-gray-400'
                        )}
                      >
                        {plugin.description}
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={plugin.installed}
                        leftIcon={<Download className="w-4 h-4" />}
                      >
                        {plugin.installed ? 'Installed' : 'Install'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}

