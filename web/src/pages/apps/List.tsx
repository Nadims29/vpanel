import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Rocket,
  RefreshCw,
  ExternalLink,
  GitBranch,
  Clock,
  MoreVertical,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  SearchInput,
  Dropdown,
  DropdownItem,
  DropdownDivider,
  ConfirmModal,
  Empty,
  Spinner,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as appsApi from '@/api/apps';
import type { App } from '@/api/apps';
import { useDockerStatus } from '@/hooks/useDockerStatus';
import { DockerUnavailable } from '@/components/docker/DockerUnavailable';

function AppCard({
  app,
  onAction,
}: {
  app: App;
  onAction: (action: string, app: App) => void;
}) {
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const statusColors: Record<string, 'success' | 'gray' | 'warning' | 'info' | 'error'> = {
    running: 'success',
    stopped: 'gray',
    building: 'warning',
    failed: 'error',
  };

  const handleAction = async (action: string) => {
    setIsLoading(true);
    try {
      await onAction(action, app);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getRepoName = (url: string) => {
    const match = url.match(/([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : url;
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card p-4 hover:border-dark-600/50 transition-all cursor-pointer"
        onClick={() => navigate(`/apps/${app.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Rocket className="w-5 h-5 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-dark-100 truncate">{app.name}</h3>
              <p className="text-xs text-dark-400 truncate">{getRepoName(app.git_url)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Badge variant={statusColors[app.status] || 'gray'}>
              {app.status}
            </Badge>
            <Dropdown
              trigger={
                <button className="p-1 rounded hover:bg-dark-700 text-dark-400 hover:text-dark-100">
                  <MoreVertical className="w-4 h-4" />
                </button>
              }
            >
              <DropdownItem
                icon={<Rocket className="w-4 h-4" />}
                onClick={() => handleAction('deploy')}
              >
                Deploy
              </DropdownItem>
              <DropdownDivider />
              {app.status === 'running' ? (
                <DropdownItem
                  icon={<Square className="w-4 h-4" />}
                  onClick={() => handleAction('stop')}
                >
                  Stop
                </DropdownItem>
              ) : (
                <DropdownItem
                  icon={<Play className="w-4 h-4" />}
                  onClick={() => handleAction('start')}
                  disabled={!app.container_id}
                >
                  Start
                </DropdownItem>
              )}
              <DropdownItem
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={() => handleAction('restart')}
                disabled={!app.container_id}
              >
                Restart
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem
                icon={<Trash2 className="w-4 h-4" />}
                variant="danger"
                onClick={() => setShowDelete(true)}
              >
                Delete
              </DropdownItem>
            </Dropdown>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-dark-400">
            <GitBranch className="w-4 h-4" />
            <span className="truncate">{app.git_branch}</span>
          </div>
          {app.domain && (
            <div className="flex items-center gap-2 text-dark-400">
              <ExternalLink className="w-4 h-4" />
              <a
                href={`http://${app.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {app.domain}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2 text-dark-400">
            <Clock className="w-4 h-4" />
            <span>Last deploy: {formatDate(app.last_deploy_at)}</span>
          </div>
        </div>

        {app.host_port > 0 && (
          <div className="mt-3 pt-3 border-t border-dark-700 text-xs text-dark-400">
            Port: {app.port} → {app.host_port}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-dark-800/50 rounded-lg flex items-center justify-center">
            <Spinner size="sm" />
          </div>
        )}
      </motion.div>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          handleAction('delete');
          setShowDelete(false);
        }}
        title="Delete App"
        message={`Are you sure you want to delete "${app.name}"? This will stop and remove the container, image, and all deployment history.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}

export default function AppsList() {
  const navigate = useNavigate();
  const { isAvailable, isLoading: dockerLoading } = useDockerStatus();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadApps = useCallback(async () => {
    try {
      const data = await appsApi.listApps();
      setApps(data);
    } catch (error) {
      toast.error('Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAvailable) {
      loadApps();
    }
  }, [isAvailable, loadApps]);

  const handleAction = async (action: string, app: App) => {
    try {
      switch (action) {
        case 'deploy':
          await appsApi.deployApp(app.id);
          toast.success('Deployment started');
          navigate(`/apps/${app.id}`);
          break;
        case 'start':
          await appsApi.startApp(app.id);
          toast.success('App started');
          break;
        case 'stop':
          await appsApi.stopApp(app.id);
          toast.success('App stopped');
          break;
        case 'restart':
          await appsApi.restartApp(app.id);
          toast.success('App restarted');
          break;
        case 'delete':
          await appsApi.deleteApp(app.id);
          toast.success('App deleted');
          break;
      }
      loadApps();
    } catch (error) {
      toast.error(`Failed to ${action} app`);
    }
  };

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    app.git_url.toLowerCase().includes(search.toLowerCase())
  );

  if (dockerLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAvailable) {
    return <DockerUnavailable />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Apps</h1>
          <p className="text-dark-400 mt-1">Deploy applications from Git repositories</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={loadApps}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/apps/create')}>
            <Plus className="w-4 h-4 mr-2" />
            Deploy New
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search apps..."
        />
      </Card>

      {/* Apps Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : filteredApps.length === 0 ? (
        <Empty
          icon={<Rocket className="w-12 h-12" />}
          title={search ? 'No apps found' : 'No apps yet'}
          description={
            search
              ? 'Try adjusting your search terms'
              : 'Deploy your first application from a Git repository'
          }
          action={
            !search && (
              <Button onClick={() => navigate('/apps/create')}>
                <Plus className="w-4 h-4 mr-2" />
                Deploy New App
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredApps.map((app) => (
              <AppCard key={app.id} app={app} onAction={handleAction} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
