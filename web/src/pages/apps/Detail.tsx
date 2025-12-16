import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Rocket,
  Play,
  Square,
  RotateCcw,
  Trash2,
  GitBranch,
  Clock,
  ExternalLink,
  Terminal,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Settings,
  FileText,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  ConfirmModal,
  Spinner,
  Empty,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as appsApi from '@/api/apps';
import type { App, AppDeployment } from '@/api/apps';

function DeploymentItem({ deployment, isActive }: { deployment: AppDeployment; isActive: boolean }) {
  const statusIcons: Record<string, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    failed: <XCircle className="w-4 h-4 text-red-400" />,
    pending: <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />,
    cloning: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
    building: <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />,
    deploying: <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />,
  };

  const statusColors: Record<string, 'success' | 'error' | 'warning' | 'info' | 'gray'> = {
    success: 'success',
    failed: 'error',
    pending: 'warning',
    cloning: 'info',
    building: 'warning',
    deploying: 'info',
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div
      className={cn(
        'p-4 border-b border-dark-700 last:border-b-0',
        isActive && 'bg-dark-700/30'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {statusIcons[deployment.status] || statusIcons.pending}
          <Badge variant={statusColors[deployment.status] || 'gray'}>
            {deployment.status}
          </Badge>
          {deployment.commit_hash && (
            <span className="text-xs text-dark-400 font-mono">
              {deployment.commit_hash.substring(0, 8)}
            </span>
          )}
        </div>
        <span className="text-xs text-dark-400">{formatDate(deployment.created_at)}</span>
      </div>

      {deployment.commit_msg && (
        <p className="text-sm text-dark-300 truncate mb-2">{deployment.commit_msg}</p>
      )}

      {isActive && (deployment.status !== 'success' && deployment.status !== 'failed') && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-dark-400 mb-1">
            <span>Progress</span>
            <span>{deployment.progress}%</span>
          </div>
          <div className="w-full bg-dark-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${deployment.progress}%` }}
            />
          </div>
        </div>
      )}

      {deployment.error && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
          {deployment.error}
        </div>
      )}

      {deployment.duration > 0 && (
        <p className="text-xs text-dark-400 mt-2">Duration: {deployment.duration}s</p>
      )}
    </div>
  );
}

function DeployLogs({ logs }: { logs: string }) {
  if (!logs) {
    return (
      <div className="p-4 text-center text-dark-400">
        No logs available yet
      </div>
    );
  }

  return (
    <pre className="p-4 bg-dark-900 rounded-lg overflow-x-auto text-sm font-mono text-dark-200 whitespace-pre-wrap">
      {logs}
    </pre>
  );
}

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<App | null>(null);
  const [deployments, setDeployments] = useState<AppDeployment[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<AppDeployment | null>(null);
  const [containerLogs, setContainerLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadApp = useCallback(async () => {
    if (!id) return;
    try {
      const data = await appsApi.getApp(id);
      setApp(data);
    } catch {
      toast.error('Failed to load app');
      navigate('/apps');
    }
  }, [id, navigate]);

  const loadDeployments = useCallback(async () => {
    if (!id) return;
    try {
      const data = await appsApi.listDeployments(id);
      setDeployments(data);

      // Check for active deployment
      const active = data.find(
        (d) => d.status !== 'success' && d.status !== 'failed'
      );
      if (active) {
        setActiveDeployment(active);
      } else if (data.length > 0) {
        setActiveDeployment(data[0]);
      }
    } catch {
      // Ignore
    }
  }, [id]);

  const loadContainerLogs = useCallback(async () => {
    if (!id || !app?.container_id) return;
    try {
      const data = await appsApi.getAppLogs(id, 200);
      setContainerLogs(data.logs);
    } catch {
      // Ignore
    }
  }, [id, app?.container_id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadApp();
      await loadDeployments();
      setLoading(false);
    };
    init();
  }, [loadApp, loadDeployments]);

  // Poll for active deployment
  useEffect(() => {
    if (!activeDeployment || activeDeployment.status === 'success' || activeDeployment.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      if (!id) return;
      try {
        const updated = await appsApi.getDeployment(id, activeDeployment.id);
        setActiveDeployment(updated);

        if (updated.status === 'success' || updated.status === 'failed') {
          loadApp();
          loadDeployments();
        }
      } catch {
        // Ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeDeployment, id, loadApp, loadDeployments]);

  const handleAction = async (action: string) => {
    if (!app) return;
    setActionLoading(action);

    try {
      switch (action) {
        case 'deploy': {
          const deployment = await appsApi.deployApp(app.id);
          setActiveDeployment(deployment);
          toast.success('Deployment started');
          loadDeployments();
          break;
        }
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
          navigate('/apps');
          return;
      }
      loadApp();
    } catch (error) {
      toast.error(`Failed to ${action} app`);
    } finally {
      setActionLoading(null);
    }
  };

  const statusColors: Record<string, 'success' | 'gray' | 'warning' | 'error'> = {
    running: 'success',
    stopped: 'gray',
    building: 'warning',
    failed: 'error',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!app) {
    return null;
  }

  const getRepoName = (url: string) => {
    const match = url.match(/([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : url;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/apps')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-dark-100">{app.name}</h1>
                <Badge variant={statusColors[app.status] || 'gray'}>{app.status}</Badge>
              </div>
              <p className="text-dark-400">{app.description || getRepoName(app.git_url)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => handleAction('deploy')}
            disabled={actionLoading === 'deploy'}
          >
            {actionLoading === 'deploy' ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Rocket className="w-4 h-4 mr-2" />
            )}
            Deploy
          </Button>
          {app.status === 'running' ? (
            <Button
              variant="ghost"
              onClick={() => handleAction('stop')}
              disabled={!!actionLoading}
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => handleAction('start')}
              disabled={!!actionLoading || !app.container_id}
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => handleAction('restart')}
            disabled={!!actionLoading || !app.container_id}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restart
          </Button>
          <Button variant="danger" onClick={() => setShowDelete(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-dark-400">Branch</p>
              <p className="font-medium text-dark-100">{app.git_branch}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-dark-400">Port</p>
              <p className="font-medium text-dark-100">
                {app.host_port ? `${app.port} → ${app.host_port}` : app.port}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <p className="text-sm text-dark-400">Domain</p>
              {app.domain ? (
                <a
                  href={`http://${app.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-400 hover:underline flex items-center gap-1"
                >
                  {app.domain}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-dark-400">Not configured</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-orange-400" />
            <div>
              <p className="text-sm text-dark-400">Last Deploy</p>
              <p className="font-medium text-dark-100">
                {app.last_deploy_at
                  ? new Date(app.last_deploy_at).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs defaultValue="deployments">
          <TabList className="border-b border-dark-700 px-4">
            <Tab value="deployments">
              <Rocket className="w-4 h-4 mr-2" />
              Deployments
            </Tab>
            <Tab value="logs">
              <FileText className="w-4 h-4 mr-2" />
              Container Logs
            </Tab>
            <Tab value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel value="deployments" className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-dark-700">
                {/* Deployment List */}
                <div className="max-h-[500px] overflow-y-auto">
                  {deployments.length === 0 ? (
                    <div className="p-8 text-center">
                      <Empty
                        icon={<Rocket className="w-8 h-8" />}
                        title="No deployments yet"
                        description="Click Deploy to start your first deployment"
                      />
                    </div>
                  ) : (
                    deployments.map((d) => (
                      <div
                        key={d.id}
                        className="cursor-pointer hover:bg-dark-700/20"
                        onClick={() => setActiveDeployment(d)}
                      >
                        <DeploymentItem
                          deployment={d}
                          isActive={activeDeployment?.id === d.id}
                        />
                      </div>
                    ))
                  )}
                </div>

                {/* Deployment Logs */}
                <div className="max-h-[500px] overflow-y-auto bg-dark-900">
                  {activeDeployment ? (
                    <DeployLogs logs={activeDeployment.logs} />
                  ) : (
                    <div className="p-8 text-center text-dark-400">
                      Select a deployment to view logs
                    </div>
                  )}
                </div>
              </div>
            </TabPanel>

            <TabPanel value="logs" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-dark-400">Container runtime logs</p>
                <Button variant="ghost" size="sm" onClick={loadContainerLogs}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
              </div>
              {app.container_id ? (
                <pre className="p-4 bg-dark-900 rounded-lg overflow-x-auto text-sm font-mono text-dark-200 whitespace-pre-wrap max-h-[400px]">
                  {containerLogs || 'No logs available. Click Refresh to load.'}
                </pre>
              ) : (
                <Empty
                  icon={<Terminal className="w-8 h-8" />}
                  title="No container"
                  description="Deploy the app to see container logs"
                />
              )}
            </TabPanel>

            <TabPanel value="settings" className="p-6">
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Git Repository</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-dark-700">
                      <span className="text-dark-400">URL</span>
                      <span className="text-dark-200 font-mono text-sm">{app.git_url}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dark-700">
                      <span className="text-dark-400">Branch</span>
                      <span className="text-dark-200">{app.git_branch}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Build Settings</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-dark-700">
                      <span className="text-dark-400">Dockerfile</span>
                      <span className="text-dark-200 font-mono text-sm">{app.dockerfile_path}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dark-700">
                      <span className="text-dark-400">Build Context</span>
                      <span className="text-dark-200 font-mono text-sm">{app.build_context}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dark-700">
                      <span className="text-dark-400">Image</span>
                      <span className="text-dark-200 font-mono text-sm">{app.image_tag || 'Not built'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Environment Variables</h3>
                  {app.env_vars && Object.keys(app.env_vars).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(app.env_vars).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-2 border-b border-dark-700">
                          <span className="text-dark-400 font-mono text-sm">{key}</span>
                          <span className="text-dark-200 font-mono text-sm">{value as string}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-dark-400 text-sm">No environment variables configured</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Container</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-dark-700">
                      <span className="text-dark-400">Container ID</span>
                      <span className="text-dark-200 font-mono text-sm">{app.container_id || 'Not running'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dark-700">
                      <span className="text-dark-400">Internal Port</span>
                      <span className="text-dark-200">{app.port}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dark-700">
                      <span className="text-dark-400">Host Port</span>
                      <span className="text-dark-200">{app.host_port || 'Not mapped'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => handleAction('delete')}
        title="Delete App"
        message={`Are you sure you want to delete "${app.name}"? This will stop and remove the container, image, and all deployment history. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

// Add missing import
function Globe(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
