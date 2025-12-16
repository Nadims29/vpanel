import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Server,
  Box,
  MoreVertical,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Settings,
  CheckCircle,
  FileText,
  Search,
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
  Empty,
  Input,
  Select,
  Switch,
  Spinner,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as nginxApi from '@/api/nginx';
import type { NginxInstance, DockerNginxContainer, NginxStatus } from '@/api/nginx';

function InstanceCard({
  instance,
  onStart,
  onStop,
  onReload,
  onDelete,
  onTestConfig,
  onViewLogs,
  onSetDefault,
}: {
  instance: NginxInstance;
  onStart: () => void;
  onStop: () => void;
  onReload: () => void;
  onDelete: () => void;
  onTestConfig: () => void;
  onViewLogs: () => void;
  onSetDefault: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  const statusColors = {
    running: 'success',
    stopped: 'gray',
    error: 'danger',
    unknown: 'warning',
  } as const;

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
              instance.status === 'running' ? 'bg-green-500/20' : 'bg-dark-700'
            )}>
              {instance.type === 'docker' ? (
                <Box className={cn('w-6 h-6', instance.status === 'running' ? 'text-green-400' : 'text-dark-500')} />
              ) : (
                <Server className={cn('w-6 h-6', instance.status === 'running' ? 'text-green-400' : 'text-dark-500')} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-dark-100">{instance.name}</h3>
                {instance.is_default && (
                  <Badge variant="primary" size="sm">默认</Badge>
                )}
              </div>
              {instance.description && (
                <p className="text-sm text-dark-500">{instance.description}</p>
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
            {instance.status === 'running' ? (
              <DropdownItem icon={<Square className="w-4 h-4" />} onClick={onStop}>
                停止
              </DropdownItem>
            ) : (
              <DropdownItem icon={<Play className="w-4 h-4" />} onClick={onStart}>
                启动
              </DropdownItem>
            )}
            <DropdownItem icon={<RefreshCw className="w-4 h-4" />} onClick={onReload}>
              重载配置
            </DropdownItem>
            <DropdownItem icon={<CheckCircle className="w-4 h-4" />} onClick={onTestConfig}>
              测试配置
            </DropdownItem>
            <DropdownItem icon={<FileText className="w-4 h-4" />} onClick={onViewLogs}>
              查看日志
            </DropdownItem>
            {!instance.is_default && (
              <DropdownItem icon={<Settings className="w-4 h-4" />} onClick={onSetDefault}>
                设为默认
              </DropdownItem>
            )}
            <DropdownDivider />
            <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onClick={() => setShowDelete(true)}>
              删除
            </DropdownItem>
          </Dropdown>
        </div>

        {/* Status & Type */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant={statusColors[instance.status]} dot>
            {instance.status === 'running' ? '运行中' : instance.status === 'stopped' ? '已停止' : instance.status}
          </Badge>
          <Badge variant={instance.type === 'docker' ? 'primary' : 'gray'}>
            {instance.type === 'docker' ? (
              <>
                <Box className="w-3 h-3 mr-1" />
                Docker
              </>
            ) : (
              <>
                <Server className="w-3 h-3 mr-1" />
                本地
              </>
            )}
          </Badge>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          {instance.version && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">版本</span>
              <span className="text-dark-300">{instance.version}</span>
            </div>
          )}
          {instance.type === 'docker' && instance.container_name && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">容器名</span>
              <span className="text-dark-300 font-mono">{instance.container_name}</span>
            </div>
          )}
          {instance.type === 'docker' && instance.container_id && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">容器ID</span>
              <span className="text-dark-300 font-mono">{instance.container_id}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-dark-500">配置路径</span>
            <span className="text-dark-300 font-mono text-xs">{instance.config_path}</span>
          </div>
          {instance.uptime && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">运行时间</span>
              <span className="text-dark-300">{instance.uptime}</span>
            </div>
          )}
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
        title="删除实例"
        message={`确定要删除 "${instance.name}" 吗？此操作不会删除实际的nginx或容器，只会从管理面板中移除。`}
        confirmText="删除"
      />
    </>
  );
}

export default function NginxInstances() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [instances, setInstances] = useState<NginxInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [nginxStatus, setNginxStatus] = useState<NginxStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  
  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<NginxInstance | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logType, setLogType] = useState<'access' | 'error'>('access');
  
  // Discover states
  const [discovering, setDiscovering] = useState(false);
  const [discoveredContainers, setDiscoveredContainers] = useState<DockerNginxContainer[]>([]);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    type: 'local' as 'local' | 'docker',
    description: '',
    container_id: '',
    container_name: '',
    config_path: '/etc/nginx',
    sites_path: '/etc/nginx/sites-available',
    sites_enabled: '/etc/nginx/sites-enabled',
    log_path: '/var/log/nginx',
    is_default: false,
  });

  // Deploy form states
  const [deployData, setDeployData] = useState({
    name: '',
    image: 'nginx:latest',
    host_port: 80,
    https_port: 443,
  });

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

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const fetchInstances = useCallback(async () => {
    try {
      setLoading(true);
      const data = await nginxApi.listInstances();
      setInstances(data);
    } catch (error) {
      console.error('Failed to fetch instances:', error);
      toast.error('获取实例列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const handleDiscoverDocker = async () => {
    try {
      setDiscovering(true);
      const containers = await nginxApi.discoverDockerNginx();
      setDiscoveredContainers(containers || []);
      setShowDiscover(true);
    } catch (error) {
      console.error('Failed to discover Docker nginx:', error);
      toast.error('发现Docker nginx失败');
    } finally {
      setDiscovering(false);
    }
  };

  const handleAddDiscoveredContainer = async (container: DockerNginxContainer) => {
    try {
      await nginxApi.createInstance({
        name: container.container_name || container.container_id,
        type: 'docker',
        description: `Docker container: ${container.image}`,
        container_id: container.container_id,
        container_name: container.container_name,
      });
      toast.success('实例添加成功');
      setShowDiscover(false);
      fetchInstances();
    } catch (error) {
      console.error('Failed to add container:', error);
      toast.error('添加实例失败');
    }
  };

  const handleCreateInstance = async () => {
    try {
      await nginxApi.createInstance(formData);
      toast.success('实例创建成功');
      setShowCreate(false);
      setFormData({
        name: '',
        type: 'local',
        description: '',
        container_id: '',
        container_name: '',
        config_path: '/etc/nginx',
        sites_path: '/etc/nginx/sites-available',
        sites_enabled: '/etc/nginx/sites-enabled',
        log_path: '/var/log/nginx',
        is_default: false,
      });
      fetchInstances();
    } catch (error) {
      console.error('Failed to create instance:', error);
      toast.error(error instanceof Error ? error.message : '创建实例失败');
    }
  };

  const handleDeployDocker = async () => {
    try {
      await nginxApi.deployDockerNginx({
        name: deployData.name,
        image: deployData.image,
        ports: {
          [deployData.host_port]: 80,
          [deployData.https_port]: 443,
        },
      });
      toast.success('Docker nginx部署成功');
      setShowDeploy(false);
      setDeployData({
        name: '',
        image: 'nginx:latest',
        host_port: 80,
        https_port: 443,
      });
      fetchInstances();
    } catch (error) {
      console.error('Failed to deploy Docker nginx:', error);
      toast.error(error instanceof Error ? error.message : '部署失败');
    }
  };

  const handleStart = async (id: string) => {
    try {
      await nginxApi.startInstance(id);
      toast.success('实例已启动');
      fetchInstances();
    } catch (error) {
      toast.error('启动失败');
    }
  };

  const handleStop = async (id: string) => {
    try {
      await nginxApi.stopInstance(id);
      toast.success('实例已停止');
      fetchInstances();
    } catch (error) {
      toast.error('停止失败');
    }
  };

  const handleReload = async (id: string) => {
    try {
      await nginxApi.reloadInstance(id);
      toast.success('配置已重载');
    } catch (error) {
      toast.error('重载失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await nginxApi.deleteInstance(id);
      toast.success('实例已删除');
      fetchInstances();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleTestConfig = async (instance: NginxInstance) => {
    try {
      const result = await nginxApi.testInstanceConfig(instance.id);
      if (result.valid) {
        toast.success('配置测试通过');
      } else {
        toast.error('配置测试失败: ' + result.output);
      }
    } catch (error) {
      toast.error('测试失败');
    }
  };

  const handleViewLogs = async (instance: NginxInstance) => {
    setSelectedInstance(instance);
    try {
      const result = await nginxApi.getInstanceLogs(instance.id, logType, 100);
      setLogs(result.logs);
      setShowLogs(true);
    } catch (error) {
      toast.error('获取日志失败');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await nginxApi.updateInstance(id, { is_default: true });
      toast.success('已设为默认实例');
      fetchInstances();
    } catch (error) {
      toast.error('设置失败');
    }
  };

  const filteredInstances = instances.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || i.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Show loading state while checking nginx status
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dark-100">Nginx 实例</h1>
          <p className="text-dark-400">管理本地和Docker中的Nginx实例</p>
        </div>
        <div className="flex items-center gap-2">
          {nginxStatus?.docker_available && (
            <>
              <Button
                variant="secondary"
                leftIcon={<Search className={cn("w-4 h-4", discovering && "animate-spin")} />}
                onClick={handleDiscoverDocker}
                disabled={discovering}
              >
                发现Docker Nginx
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Box className="w-4 h-4" />}
                onClick={() => setShowDeploy(true)}
              >
                部署Docker Nginx
              </Button>
            </>
          )}
          <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
            添加实例
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-dark-100">{instances.length}</p>
          <p className="text-sm text-dark-400">总实例</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-green-400">{instances.filter(i => i.status === 'running').length}</p>
          <p className="text-sm text-dark-400">运行中</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-primary-400">{instances.filter(i => i.type === 'local').length}</p>
          <p className="text-sm text-dark-400">本地实例</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-cyan-400">{instances.filter(i => i.type === 'docker').length}</p>
          <p className="text-sm text-dark-400">Docker实例</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="搜索实例..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <Tabs defaultValue="all" onChange={setTypeFilter}>
          <TabList>
            <Tab value="all">全部</Tab>
            <Tab value="local">本地</Tab>
            <Tab value="docker">Docker</Tab>
          </TabList>
        </Tabs>
      </div>

      {/* Instances Grid */}
      {loading ? (
        <Card padding className="text-center py-12">
          <Spinner className="mx-auto mb-4" />
          <p className="text-dark-400">加载中...</p>
        </Card>
      ) : filteredInstances.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredInstances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                onStart={() => handleStart(instance.id)}
                onStop={() => handleStop(instance.id)}
                onReload={() => handleReload(instance.id)}
                onDelete={() => handleDelete(instance.id)}
                onTestConfig={() => handleTestConfig(instance)}
                onViewLogs={() => handleViewLogs(instance)}
                onSetDefault={() => handleSetDefault(instance.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card padding>
          <Empty
            icon={<Server className="w-8 h-8 text-dark-500" />}
            title="没有找到实例"
            description={search || typeFilter !== 'all' ? "没有匹配的实例" : "添加您的第一个Nginx实例开始管理"}
            action={
              <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
                添加实例
              </Button>
            }
          />
        </Card>
      )}

      {/* Create Instance Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="添加Nginx实例" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">名称</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：主站Nginx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">类型</label>
            <Select
              value={formData.type}
              onChange={(e) => setFormData({
                ...formData,
                type: e.target.value as 'local' | 'docker',
                sites_path: e.target.value === 'docker' ? '/etc/nginx/conf.d' : '/etc/nginx/sites-available',
                sites_enabled: e.target.value === 'docker' ? '' : '/etc/nginx/sites-enabled',
              })}
            >
              <option value="local">本地Nginx</option>
              <option value="docker">Docker容器</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">描述</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="可选描述"
            />
          </div>
          {formData.type === 'docker' && (
            <>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">容器名称或ID</label>
                <Input
                  value={formData.container_name || formData.container_id}
                  onChange={(e) => setFormData({ ...formData, container_name: e.target.value })}
                  placeholder="例如：nginx-container"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">配置路径</label>
            <Input
              value={formData.config_path}
              onChange={(e) => setFormData({ ...formData, config_path: e.target.value })}
              placeholder="/etc/nginx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">站点配置路径</label>
            <Input
              value={formData.sites_path}
              onChange={(e) => setFormData({ ...formData, sites_path: e.target.value })}
              placeholder={formData.type === 'docker' ? '/etc/nginx/conf.d' : '/etc/nginx/sites-available'}
            />
          </div>
          <Switch
            label="设为默认实例"
            checked={formData.is_default}
            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreateInstance} disabled={!formData.name}>创建</Button>
          </div>
        </div>
      </Modal>

      {/* Discover Docker Modal */}
      <Modal open={showDiscover} onClose={() => setShowDiscover(false)} title="发现的Docker Nginx容器" size="lg">
        <div className="space-y-4">
          {discoveredContainers && discoveredContainers.length > 0 ? (
            discoveredContainers.map((container) => (
              <div
                key={container.container_id}
                className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Box className="w-5 h-5 text-cyan-400" />
                    <span className="font-medium text-dark-100">{container.container_name || container.container_id}</span>
                    {container.already_added && (
                      <Badge variant="gray" size="sm">已添加</Badge>
                    )}
                  </div>
                  <p className="text-sm text-dark-400 mt-1">{container.image}</p>
                  <p className="text-xs text-dark-500">{container.status}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={container.already_added}
                  onClick={() => handleAddDiscoveredContainer(container)}
                >
                  {container.already_added ? '已添加' : '添加'}
                </Button>
              </div>
            ))
          ) : (
            <Empty
              icon={<Box className="w-8 h-8 text-dark-500" />}
              title="没有发现Nginx容器"
              description="没有在Docker中找到运行的Nginx容器"
            />
          )}
        </div>
      </Modal>

      {/* Deploy Docker Modal */}
      <Modal open={showDeploy} onClose={() => setShowDeploy(false)} title="部署Docker Nginx" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">实例名称</label>
            <Input
              value={deployData.name}
              onChange={(e) => setDeployData({ ...deployData, name: e.target.value })}
              placeholder="例如：my-nginx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Docker镜像</label>
            <Input
              value={deployData.image}
              onChange={(e) => setDeployData({ ...deployData, image: e.target.value })}
              placeholder="nginx:latest"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">HTTP端口</label>
              <Input
                type="number"
                value={deployData.host_port}
                onChange={(e) => setDeployData({ ...deployData, host_port: parseInt(e.target.value) || 80 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">HTTPS端口</label>
              <Input
                type="number"
                value={deployData.https_port}
                onChange={(e) => setDeployData({ ...deployData, https_port: parseInt(e.target.value) || 443 })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
            <Button variant="secondary" onClick={() => setShowDeploy(false)}>取消</Button>
            <Button onClick={handleDeployDocker} disabled={!deployData.name}>部署</Button>
          </div>
        </div>
      </Modal>

      {/* Logs Modal */}
      <Modal open={showLogs} onClose={() => setShowLogs(false)} title={`${selectedInstance?.name} 日志`} size="xl">
        <div className="space-y-4">
          <Tabs defaultValue="access" onChange={(v) => setLogType(v as 'access' | 'error')}>
            <TabList>
              <Tab value="access">访问日志</Tab>
              <Tab value="error">错误日志</Tab>
            </TabList>
          </Tabs>
          <div className="h-96 overflow-auto bg-dark-900 rounded-lg p-4 font-mono text-xs">
            {logs.length > 0 ? (
              logs.map((line, i) => (
                <div key={i} className="text-dark-300 whitespace-pre-wrap mb-1">{line}</div>
              ))
            ) : (
              <div className="text-dark-500 text-center py-8">暂无日志</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

