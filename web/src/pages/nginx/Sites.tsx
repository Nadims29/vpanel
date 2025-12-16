import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Globe,
  Lock,
  Unlock,
  MoreVertical,
  Play,
  Pause,
  Settings,
  Trash2,
  ExternalLink,
  RefreshCw,
  Shield,
  Zap,
  Server,
  AlertTriangle,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  SearchInput,
  Dropdown,
  DropdownItem,
  DropdownDivider,
  Modal,
  ConfirmModal,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Empty,
  Input,
  Select,
  Switch,
  Spinner,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as nginxApi from '@/api/nginx';
import type { NginxSite, NginxStatus, SiteAnalytics, NginxInstance } from '@/api/nginx';

interface Site {
  id: string;
  domain: string;
  aliases: string[];
  ssl: boolean;
  sslExpiry?: string;
  status: 'active' | 'disabled';
  type: 'static' | 'proxy' | 'php';
  proxyTarget?: string;
  rootPath?: string;
  phpVersion?: string;
  traffic: { requests: number; bandwidth: string };
  created: string;
}

// Convert backend NginxSite to frontend Site format
function convertSite(backendSite: NginxSite, analytics?: SiteAnalytics): Site {
  // Determine site type
  let type: 'static' | 'proxy' | 'php' = 'static';
  if (backendSite.proxy_enabled) {
    type = 'proxy';
  } else if (backendSite.php_enabled) {
    type = 'php';
  }

  // Get traffic data from analytics
  const traffic = analytics ? {
    requests: analytics.requests,
    bandwidth: analytics.bandwidth,
  } : { requests: 0, bandwidth: '0 B' };

  return {
    id: backendSite.id,
    domain: backendSite.domain,
    aliases: backendSite.aliases || [],
    ssl: backendSite.ssl_enabled,
    sslExpiry: undefined, // Will be fetched from certificate if needed
    status: backendSite.enabled ? 'active' : 'disabled',
    type,
    proxyTarget: backendSite.proxy_target,
    rootPath: backendSite.root_path,
    phpVersion: backendSite.php_version,
    traffic,
    created: backendSite.created_at,
  };
}

function SiteCard({ 
  site, 
  onEnable, 
  onDisable, 
  onDelete 
}: { 
  site: Site;
  onEnable: () => void;
  onDisable: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const typeIcons = {
    static: <Server className="w-4 h-4" />,
    proxy: <Zap className="w-4 h-4" />,
    php: <Globe className="w-4 h-4" />,
  };

  const typeLabels = {
    static: 'Static',
    proxy: 'Reverse Proxy',
    php: 'PHP',
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 hover:border-dark-600/50 transition-all"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              site.status === 'active' ? 'bg-green-500/20' : 'bg-dark-700'
            )}>
              <Globe className={cn('w-6 h-6', site.status === 'active' ? 'text-green-400' : 'text-dark-500')} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-dark-100">{site.domain}</h3>
                <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="text-dark-500 hover:text-primary-400">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              {site.aliases.length > 0 && (
                <p className="text-sm text-dark-500">{site.aliases.join(', ')}</p>
              )}
            </div>
          </div>
          <Dropdown
            trigger={
              <button className="p-1.5 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            }
          >
            <DropdownItem icon={<Settings className="w-4 h-4" />} onClick={() => setShowEdit(true)}>
              Edit Configuration
            </DropdownItem>
            <DropdownItem 
              icon={site.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              onClick={() => site.status === 'active' ? onDisable() : onEnable()}
            >
              {site.status === 'active' ? 'Disable' : 'Enable'}
            </DropdownItem>
            <DropdownItem icon={<RefreshCw className="w-4 h-4" />}>Reload</DropdownItem>
            {!site.ssl && (
              <DropdownItem icon={<Shield className="w-4 h-4" />}>Enable SSL</DropdownItem>
            )}
            <DropdownDivider />
            <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onClick={() => setShowDelete(true)}>
              Delete
            </DropdownItem>
          </Dropdown>
        </div>

        {/* Status & Type */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant={site.status === 'active' ? 'success' : 'gray'} dot>
            {site.status}
          </Badge>
          <Badge variant="primary">
            {typeIcons[site.type]}
            <span className="ml-1">{typeLabels[site.type]}</span>
          </Badge>
          {site.ssl ? (
            <Badge variant="success">
              <Lock className="w-3 h-3 mr-1" />
              SSL
            </Badge>
          ) : (
            <Badge variant="warning">
              <Unlock className="w-3 h-3 mr-1" />
              No SSL
            </Badge>
          )}
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm mb-4">
          {site.type === 'proxy' && site.proxyTarget && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">Proxy to</span>
              <span className="text-dark-300 font-mono">{site.proxyTarget}</span>
            </div>
          )}
          {site.type !== 'proxy' && site.rootPath && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">Root</span>
              <span className="text-dark-300 font-mono">{site.rootPath}</span>
            </div>
          )}
          {site.phpVersion && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">PHP Version</span>
              <span className="text-dark-300">{site.phpVersion}</span>
            </div>
          )}
          {site.ssl && site.sslExpiry && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">SSL Expires</span>
              <span className="text-dark-300">{site.sslExpiry}</span>
            </div>
          )}
        </div>

        {/* Traffic stats */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dark-700">
          <div>
            <p className="text-xs text-dark-500 mb-1">Requests (30d)</p>
            <p className="text-lg font-semibold text-dark-100">{site.traffic.requests.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Bandwidth (30d)</p>
            <p className="text-lg font-semibold text-dark-100">{site.traffic.bandwidth}</p>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirm */}
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          onDelete();
          setShowDelete(false);
        }}
        type="danger"
        title="Delete Site"
        message={`Are you sure you want to delete "${site.domain}"? This will remove all configuration files.`}
        confirmText="Delete"
      />

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Site Configuration" size="lg">
        <Tabs defaultValue="general">
          <TabList className="mb-4">
            <Tab value="general">General</Tab>
            <Tab value="ssl">SSL</Tab>
            <Tab value="advanced">Advanced</Tab>
          </TabList>

          <TabPanel value="general">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Domain</label>
                <Input defaultValue={site.domain} />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Aliases (comma separated)</label>
                <Input defaultValue={site.aliases.join(', ')} placeholder="www.example.com, app.example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Site Type</label>
                <Select defaultValue={site.type}>
                  <option value="static">Static Files</option>
                  <option value="proxy">Reverse Proxy</option>
                  <option value="php">PHP Application</option>
                </Select>
              </div>
              {site.type === 'proxy' && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Proxy Target</label>
                  <Input defaultValue={site.proxyTarget} placeholder="http://localhost:3000" />
                </div>
              )}
              {site.type !== 'proxy' && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Document Root</label>
                  <Input defaultValue={site.rootPath} placeholder="/var/www/html" />
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel value="ssl">
            <div className="space-y-4">
              <Switch label="Enable SSL" checked={site.ssl} />
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">SSL Provider</label>
                <Select defaultValue="letsencrypt">
                  <option value="letsencrypt">Let's Encrypt (Free)</option>
                  <option value="custom">Custom Certificate</option>
                </Select>
              </div>
              <Switch label="Force HTTPS" checked={true} />
              <Switch label="HTTP/2" checked={true} />
            </div>
          </TabPanel>

          <TabPanel value="advanced">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Custom Nginx Configuration</label>
                <textarea
                  className="w-full h-32 px-4 py-2.5 bg-dark-900/50 border border-dark-700 rounded-lg text-dark-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="# Add custom configuration here"
                />
              </div>
              <Switch label="Enable Gzip Compression" checked={true} />
              <Switch label="Enable Browser Caching" checked={true} />
            </div>
          </TabPanel>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-dark-700">
          <Button variant="secondary" onClick={() => setShowEdit(false)}>Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      </Modal>
    </>
  );
}

export default function NginxSites() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [nginxStatus, setNginxStatus] = useState<NginxStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  
  // Instance management
  const [instances, setInstances] = useState<NginxInstance[]>([]);
  const [createInstanceId, setCreateInstanceId] = useState<string>('');

  // Fetch nginx status
  const fetchStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const status = await nginxApi.getNginxStatus();
      setNginxStatus(status);
    } catch (error) {
      console.error('Failed to fetch nginx status:', error);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Fetch instances
  const fetchInstances = useCallback(async () => {
    try {
      const data = await nginxApi.listInstances();
      setInstances(data);
      // Set default instance for creating sites
      const defaultInstance = data.find(i => i.is_default) || data[0];
      if (defaultInstance) {
        setCreateInstanceId(defaultInstance.id);
      }
    } catch (error) {
      console.error('Failed to fetch instances:', error);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchInstances();
  }, [fetchStatus, fetchInstances]);

  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      const backendSites = await nginxApi.listSites();
      
      // Fetch analytics for each site
      const sitesWithAnalytics = await Promise.all(
        backendSites.map(async (backendSite) => {
          try {
            const analytics = await nginxApi.getSiteAnalytics(backendSite.id, 30);
            return convertSite(backendSite, analytics);
          } catch (error) {
            // If analytics fails, use site without analytics
            return convertSite(backendSite);
          }
        })
      );
      
      setSites(sitesWithAnalytics);
    } catch (error) {
      console.error('Failed to fetch sites:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch sites');
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (nginxStatus?.installed) {
      fetchSites();
    }
  }, [fetchSites, nginxStatus?.installed]);

  const handleReloadNginx = useCallback(async () => {
    try {
      setReloading(true);
      await nginxApi.reloadNginx();
      toast.success('Nginx reloaded successfully');
    } catch (error) {
      console.error('Failed to reload nginx:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reload nginx');
    } finally {
      setReloading(false);
    }
  }, []);

  const handleEnableSite = useCallback(async (id: string) => {
    try {
      await nginxApi.enableSite(id);
      toast.success('Site enabled');
      fetchSites();
    } catch (error) {
      console.error('Failed to enable site:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enable site');
    }
  }, [fetchSites]);

  const handleDisableSite = useCallback(async (id: string) => {
    try {
      await nginxApi.disableSite(id);
      toast.success('Site disabled');
      fetchSites();
    } catch (error) {
      console.error('Failed to disable site:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to disable site');
    }
  }, [fetchSites]);

  const handleDeleteSite = useCallback(async (id: string) => {
    try {
      await nginxApi.deleteSite(id);
      toast.success('Site deleted');
      fetchSites();
    } catch (error) {
      console.error('Failed to delete site:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete site');
    }
  }, [fetchSites]);

  const filteredSites = sites.filter((s) => {
    const matchesSearch = s.domain.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    // Instance filter - this would need instance_id added to the Site interface
    // For now we show all sites
    return matchesSearch && matchesStatus;
  });
  
  // Show loading state while checking nginx status
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  // Show install prompt if nginx is not installed
  if (nginxStatus && !nginxStatus.installed) {
    const getInstallCommand = () => {
      switch (nginxStatus.os) {
        case 'darwin':
          return 'brew install nginx';
        case 'linux':
          return 'sudo apt install nginx  # 或 sudo yum install nginx';
        default:
          return 'brew install nginx';
      }
    };

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-dark-100">Sites</h1>
          <p className="text-dark-400">Manage Nginx sites and virtual hosts</p>
        </div>
        <Card padding className="text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dark-100 mb-2">Nginx 未安装</h2>
              <p className="text-dark-400 max-w-md mx-auto mb-4">
                要管理站点，您需要先安装 Nginx。请在终端中运行以下命令安装：
              </p>
              <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm text-dark-200 mb-4">
                <code>{getInstallCommand()}</code>
              </div>
              <Button variant="secondary" onClick={fetchStatus}>
                <RefreshCw className="w-4 h-4 mr-2" />
                重新检查
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dark-100">Sites</h1>
          <p className="text-dark-400">Manage Nginx sites and virtual hosts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            leftIcon={<RefreshCw className={cn("w-4 h-4", reloading && "animate-spin")} />}
            onClick={handleReloadNginx}
            disabled={reloading}
          >
            Reload Nginx
          </Button>
          <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
            Add Site
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-dark-100">{sites.length}</p>
          <p className="text-sm text-dark-400">Total Sites</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-green-400">{sites.filter(s => s.status === 'active').length}</p>
          <p className="text-sm text-dark-400">Active</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-primary-400">{sites.filter(s => s.ssl).length}</p>
          <p className="text-sm text-dark-400">SSL Enabled</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-dark-100">
            {sites.reduce((sum, s) => sum + s.traffic.requests, 0).toLocaleString()}
          </p>
          <p className="text-sm text-dark-400">Total Requests</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Search sites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <Tabs defaultValue="all" onChange={setStatusFilter}>
          <TabList>
            <Tab value="all">All Sites</Tab>
            <Tab value="active">Active</Tab>
            <Tab value="disabled">Disabled</Tab>
          </TabList>
        </Tabs>
      </div>

      {/* Sites Grid */}
      {loading ? (
        <Card padding className="text-center py-12">
          <Spinner className="mx-auto mb-4" />
          <p className="text-dark-400">Loading sites...</p>
        </Card>
      ) : filteredSites.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredSites.map((site) => (
              <SiteCard 
                key={site.id} 
                site={site}
                onEnable={() => handleEnableSite(site.id)}
                onDisable={() => handleDisableSite(site.id)}
                onDelete={() => handleDeleteSite(site.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card padding>
          <Empty
            icon={<Globe className="w-8 h-8 text-dark-500" />}
            title="No sites found"
            description={search || statusFilter !== 'all' ? "No sites match your filters" : "Add your first site to get started"}
            action={
              <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
                Add Site
              </Button>
            }
          />
        </Card>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add New Site" size="lg">
        <div className="space-y-4">
          {instances.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Nginx 实例</label>
              <Select 
                value={createInstanceId} 
                onChange={(e) => setCreateInstanceId(e.target.value)}
              >
                {instances.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.type === 'docker' ? 'Docker' : '本地'})
                    {inst.is_default ? ' - 默认' : ''}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-dark-500 mt-1">选择要添加站点的Nginx实例</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Domain</label>
            <Input placeholder="example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Site Type</label>
            <Select>
              <option value="static">Static Files</option>
              <option value="proxy">Reverse Proxy</option>
              <option value="php">PHP Application</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Document Root</label>
            <Input placeholder="/var/www/html" />
          </div>
          <Switch label="Enable SSL with Let's Encrypt" />
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button>Create Site</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
