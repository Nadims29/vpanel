import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Puzzle,
  Download,
  Power,
  PowerOff,
  Search,
  RefreshCw,
  ExternalLink,
  Tag,
  Filter,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  SearchInput,
  Empty,
  Spinner,
  Dropdown,
  DropdownItem,
  DropdownDivider,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as pluginsApi from '@/api/plugins';
import type { MarketPlugin } from '@/api/plugins';

export default function PluginMarket() {
  const [plugins, setPlugins] = useState<MarketPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const data = await pluginsApi.getMarketPlugins();
      setPlugins(data);
    } catch (error) {
      console.error('Failed to load market plugins:', error);
      toast.error('Failed to load plugin market');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const handleInstall = async (plugin: MarketPlugin) => {
    try {
      setActionLoading(plugin.id);
      await pluginsApi.installPlugin({
        plugin_id: plugin.id,
        source: 'local',
        path: plugin.path,
      });
      toast.success(`Plugin "${plugin.name}" installed successfully`);
      await loadPlugins();
    } catch (error) {
      console.error('Failed to install plugin:', error);
      toast.error('Failed to install plugin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnable = async (plugin: MarketPlugin) => {
    try {
      setActionLoading(plugin.id);
      await pluginsApi.enablePlugin(plugin.id);
      toast.success(`Plugin "${plugin.name}" enabled`);
      await loadPlugins();
    } catch (error) {
      console.error('Failed to enable plugin:', error);
      toast.error('Failed to enable plugin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (plugin: MarketPlugin) => {
    try {
      setActionLoading(plugin.id);
      await pluginsApi.disablePlugin(plugin.id);
      toast.success(`Plugin "${plugin.name}" disabled`);
      await loadPlugins();
    } catch (error) {
      console.error('Failed to disable plugin:', error);
      toast.error('Failed to disable plugin');
    } finally {
      setActionLoading(null);
    }
  };

  // Get unique categories
  const categories = Array.from(
    new Set(plugins.map((p) => p.category).filter((c): c is string => !!c))
  ).sort();

  // Filter plugins
  const filteredPlugins = plugins.filter((plugin) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      plugin.name.toLowerCase().includes(query) ||
      plugin.description.toLowerCase().includes(query) ||
      plugin.id.toLowerCase().includes(query) ||
      plugin.author.toLowerCase().includes(query) ||
      (plugin.tags && plugin.tags.some((tag) => tag.toLowerCase().includes(query)));

    const matchesCategory = !categoryFilter || plugin.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (plugin: MarketPlugin) => {
    if (plugin.installed) {
      if (plugin.enabled) {
        return <Badge variant="success" size="sm">Installed & Enabled</Badge>;
      }
      return <Badge variant="warning" size="sm">Installed (Disabled)</Badge>;
    }
    return <Badge variant="info" size="sm">Available</Badge>;
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Plugin Market</h1>
          <p className="page-subtitle">Discover and install plugins</p>
        </div>
        <Card className="p-8 flex items-center justify-center">
          <Spinner size="lg" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Plugin Market</h1>
            <p className="page-subtitle">Discover and install plugins to extend functionality</p>
          </div>
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />}
            onClick={loadPlugins}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {plugins.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8"
        >
          <Empty
            icon={<Puzzle className="w-8 h-8 text-dark-500" />}
            title="No plugins available"
            description="Plugins will appear here when they are added to the plugin directory"
          />
        </motion.div>
      ) : (
        <>
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 mb-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <SearchInput
                  placeholder="Search plugins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              {categories.length > 0 && (
                <Dropdown
                  trigger={
                    <Button variant="secondary" leftIcon={<Filter className="w-4 h-4" />}>
                      {categoryFilter ? `Category: ${categoryFilter}` : 'All Categories'}
                    </Button>
                  }
                >
                  <DropdownItem onClick={() => setCategoryFilter(null)}>
                    All Categories
                  </DropdownItem>
                  <DropdownDivider />
                  {categories.map((cat) => (
                    <DropdownItem
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(categoryFilter === cat && 'bg-dark-700')}
                    >
                      {cat}
                    </DropdownItem>
                  ))}
                </Dropdown>
              )}
            </div>
          </motion.div>

          {/* Plugin Grid */}
          {filteredPlugins.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-dark-400">No plugins found matching your filters</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredPlugins.map((plugin) => (
                  <motion.div
                    key={plugin.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className="p-6 h-full flex flex-col hover:border-dark-600/50 transition-all">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {plugin.icon ? (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-2xl">{plugin.icon}</span>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                              <Puzzle className="w-6 h-6 text-blue-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-dark-100 truncate">
                              {plugin.name}
                            </h3>
                            <p className="text-xs text-dark-500 mt-0.5">
                              by {plugin.author}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(plugin)}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-dark-400 mb-4 line-clamp-3 flex-1">
                        {plugin.description}
                      </p>

                      {/* Tags */}
                      {plugin.tags && plugin.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {plugin.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="gray" size="sm" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {plugin.tags.length > 3 && (
                            <span className="text-xs text-dark-500 self-center">
                              +{plugin.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-dark-800">
                        <div className="flex items-center gap-3">
                          <Badge variant="gray" size="sm">
                            v{plugin.version}
                          </Badge>
                          {plugin.homepage && (
                            <a
                              href={plugin.homepage}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {plugin.installed ? (
                            <>
                              {plugin.enabled ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<PowerOff className="w-4 h-4" />}
                                  onClick={() => handleDisable(plugin)}
                                  disabled={actionLoading === plugin.id}
                                  loading={actionLoading === plugin.id}
                                >
                                  Disable
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<Power className="w-4 h-4" />}
                                  onClick={() => handleEnable(plugin)}
                                  disabled={actionLoading === plugin.id}
                                  loading={actionLoading === plugin.id}
                                >
                                  Enable
                                </Button>
                              )}
                            </>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Download className="w-4 h-4" />}
                              onClick={() => handleInstall(plugin)}
                              disabled={actionLoading === plugin.id}
                              loading={actionLoading === plugin.id}
                            >
                              Install
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
