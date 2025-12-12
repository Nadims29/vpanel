import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Puzzle,
  Power,
  PowerOff,
  Trash2,
  Settings,
  RefreshCw,
  Search,
  ExternalLink,
  Tag,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  SearchInput,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Empty,
  Spinner,
  ConfirmModal,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as pluginsApi from '@/api/plugins';
import type { Plugin } from '@/api/plugins';

export default function PluginList() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUninstallModal, setShowUninstallModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const data = await pluginsApi.listPlugins();
      setPlugins(data);
    } catch (error) {
      console.error('Failed to load plugins:', error);
      toast.error('Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const handleEnable = async (plugin: Plugin) => {
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

  const handleDisable = async (plugin: Plugin) => {
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

  const handleUninstall = async (pluginId: string) => {
    try {
      setActionLoading(pluginId);
      await pluginsApi.uninstallPlugin(pluginId);
      toast.success('Plugin uninstalled successfully');
      setShowUninstallModal(null);
      await loadPlugins();
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      toast.error('Failed to uninstall plugin');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPlugins = plugins.filter((plugin) => {
    const query = searchQuery.toLowerCase();
    return (
      plugin.name.toLowerCase().includes(query) ||
      plugin.description.toLowerCase().includes(query) ||
      plugin.id.toLowerCase().includes(query) ||
      plugin.author.toLowerCase().includes(query) ||
      (plugin.tags && plugin.tags.some((tag) => tag.toLowerCase().includes(query)))
    );
  });

  const getStatusColor = (status: string, enabled: boolean): 'success' | 'gray' | 'warning' | 'info' => {
    if (enabled) {
      return status === 'running' ? 'success' : 'info';
    }
    return 'gray';
  };

  const getStatusText = (status: string, enabled: boolean): string => {
    if (enabled) {
      return status === 'running' ? 'Running' : 'Enabled';
    }
    return 'Disabled';
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Installed Plugins</h1>
          <p className="page-subtitle">Manage your plugins</p>
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
            <h1 className="page-title">Installed Plugins</h1>
            <p className="page-subtitle">Manage your installed plugins</p>
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
            title="No plugins installed"
            description="Install plugins from the market to extend functionality"
          />
        </motion.div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="p-4 border-b border-dark-800">
              <SearchInput
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
              />
            </div>

            {filteredPlugins.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-dark-400">No plugins found matching your search</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="w-12"></TableCell>
                    <TableCell>Plugin</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Author</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell className="text-right">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filteredPlugins.map((plugin) => (
                      <TableRow key={plugin.id}>
                        <TableCell>
                          {plugin.icon ? (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                              <span className="text-lg">{plugin.icon}</span>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                              <Puzzle className="w-4 h-4 text-blue-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-dark-100">{plugin.name}</div>
                            <div className="text-sm text-dark-500 mt-0.5">
                              {plugin.description}
                            </div>
                            {plugin.tags && plugin.tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5">
                                {plugin.tags.slice(0, 3).map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="gray"
                                    size="sm"
                                    className="text-xs"
                                  >
                                    <Tag className="w-3 h-3 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                                {plugin.tags.length > 3 && (
                                  <span className="text-xs text-dark-500">
                                    +{plugin.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="gray" size="sm">
                            v{plugin.version}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-dark-300">{plugin.author}</div>
                          {plugin.homepage && (
                            <a
                              href={plugin.homepage}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Homepage
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusColor(plugin.status, plugin.enabled)}
                            size="sm"
                          >
                            {getStatusText(plugin.status, plugin.enabled)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Settings className="w-4 h-4" />}
                              onClick={() => {
                                // TODO: Open settings modal
                                toast('Settings feature coming soon');
                              }}
                            >
                              Settings
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Trash2 className="w-4 h-4" />}
                              onClick={() => setShowUninstallModal(plugin.id)}
                              disabled={actionLoading === plugin.id}
                            >
                              Uninstall
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            )}
          </motion.div>
        </>
      )}

      {showUninstallModal && (
        <ConfirmModal
          open={!!showUninstallModal}
          onClose={() => setShowUninstallModal(null)}
          onConfirm={() => handleUninstall(showUninstallModal)}
          title="Uninstall Plugin"
          message="Are you sure you want to uninstall this plugin? This action cannot be undone."
          type="danger"
          confirmText="Uninstall"
          loading={actionLoading === showUninstallModal}
        />
      )}
    </div>
  );
}
