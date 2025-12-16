import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Database,
  Server,
  MoreVertical,
  RefreshCw,
  Trash2,
  Settings,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Square,
  Terminal,
  HardDrive,
  Users,
  Table2,
  Clock,
  Download,
  Upload,
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
  Progress,
  Empty,
  StatusDot,
  Input,
  Tabs,
  Tab,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import * as databaseApi from '@/api/database';
import type { DatabaseServer as ApiDatabaseServer, DatabaseType, DeployTask } from '@/api/database';

interface DatabaseServer extends ApiDatabaseServer {
  // Extended fields for display (can be computed from API data)
  version: string;
  size: string;
  connections: { active: number; max: number };
  databases: number;
  uptime: string;
  cpu: number;
  memory: { used: number; total: number };
  storage: { used: number; total: number };
  lastBackup?: string;
  isLocal: boolean;
}

interface DisplayDatabaseInstance {
  id: string;
  name: string;
  serverId: string;
  size: string;
  tables: number;
  charset: string;
  collation: string;
}

// Helper function to enrich server data with default values for display
function enrichServer(server: ApiDatabaseServer): DatabaseServer {
  return {
    ...server,
    version: 'Unknown',
    size: '0 GB',
    connections: { active: 0, max: 0 },
    databases: 0,
    uptime: '-',
    cpu: 0,
    memory: { used: 0, total: 0 },
    storage: { used: 0, total: 0 },
    isLocal: server.host === 'localhost' || server.host === '127.0.0.1',
  };
}

const dbTypeConfig: Record<string, { icon: string; color: string; bgColor: string }> = {
  mysql: { icon: '🐬', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  postgresql: { icon: '🐘', color: 'text-blue-600', bgColor: 'bg-blue-600/10' },
  postgres: { icon: '🐘', color: 'text-blue-600', bgColor: 'bg-blue-600/10' }, // Alias for postgresql
  mongodb: { icon: '🍃', color: 'text-green-500', bgColor: 'bg-green-500/10' },
  redis: { icon: '⚡', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  mariadb: { icon: '🦭', color: 'text-amber-600', bgColor: 'bg-amber-600/10' },
};

const defaultTypeConfig = { icon: '🗄️', color: 'text-gray-500', bgColor: 'bg-gray-500/10' };

function ServerCard({ server, onSelect, onDelete }: { server: DatabaseServer; onSelect: () => void; onDelete: () => void }) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  const typeConfig = dbTypeConfig[server.type] || defaultTypeConfig;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await databaseApi.deleteServer(server.id);
      setShowDelete(false);
      onDelete();
    } catch (error) {
      console.error('Failed to delete server:', error);
      alert('Failed to delete server');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg',
          isLight 
            ? 'bg-white border-gray-200 hover:border-gray-300 shadow-sm' 
            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
        )}
        onClick={onSelect}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl', typeConfig.bgColor)}>
                {typeConfig.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>{server.name}</h3>
                  <StatusDot 
                    status={server.status === 'online' ? 'online' : server.status === 'offline' ? 'offline' : 'error'} 
                    pulse={server.status === 'online'} 
                  />
                </div>
                <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  {server.host}:{server.port}
                </p>
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Dropdown
                trigger={
                  <button className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    isLight ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'
                  )}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                }
              >
                <DropdownItem icon={<Terminal className="w-4 h-4" />}>Open Console</DropdownItem>
                <DropdownItem icon={<Activity className="w-4 h-4" />}>View Metrics</DropdownItem>
                <DropdownItem icon={<Download className="w-4 h-4" />}>Export</DropdownItem>
                <DropdownItem icon={<Upload className="w-4 h-4" />}>Import</DropdownItem>
                <DropdownDivider />
                {server.status === 'online' ? (
                  <DropdownItem icon={<Square className="w-4 h-4" />}>Stop Server</DropdownItem>
                ) : (
                  <DropdownItem icon={<Play className="w-4 h-4" />}>Start Server</DropdownItem>
                )}
                <DropdownItem icon={<RefreshCw className="w-4 h-4" />}>Restart</DropdownItem>
                <DropdownItem icon={<Settings className="w-4 h-4" />}>Settings</DropdownItem>
                <DropdownDivider />
                <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onClick={() => setShowDelete(true)}>
                  Remove
                </DropdownItem>
              </Dropdown>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="gray">{server.type.toUpperCase()}</Badge>
            <Badge variant="gray">v{server.version}</Badge>
            {server.isLocal ? (
              <Badge variant="primary">Local</Badge>
            ) : (
              <Badge variant="warning">Remote</Badge>
            )}
          </div>

          {/* Stats */}
          {server.status === 'online' ? (
            <div className="space-y-3">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className={cn('p-2 rounded-lg text-center', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <p className={cn('text-lg font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                    {server.databases}
                  </p>
                  <p className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>Databases</p>
                </div>
                <div className={cn('p-2 rounded-lg text-center', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <p className={cn('text-lg font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                    {server.connections.active}
                  </p>
                  <p className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>Connections</p>
                </div>
                <div className={cn('p-2 rounded-lg text-center', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <p className={cn('text-lg font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                    {server.size}
                  </p>
                  <p className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>Size</p>
                </div>
              </div>

              {/* Resource Usage */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={isLight ? 'text-gray-500' : 'text-gray-400'}>Memory</span>
                  <span className={isLight ? 'text-gray-700' : 'text-gray-300'}>
                    {server.memory.used} / {server.memory.total} GB
                  </span>
                </div>
                <Progress value={server.memory.total > 0 ? (server.memory.used / server.memory.total) * 100 : 0} max={100} size="sm" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={isLight ? 'text-gray-500' : 'text-gray-400'}>Storage</span>
                  <span className={isLight ? 'text-gray-700' : 'text-gray-300'}>
                    {server.storage.used} / {server.storage.total} GB
                  </span>
                </div>
                <Progress value={server.storage.total > 0 ? (server.storage.used / server.storage.total) * 100 : 0} max={100} size="sm" />
              </div>
            </div>
          ) : (
            <div className={cn('py-6 text-center', isLight ? 'text-gray-500' : 'text-gray-500')}>
              <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Server {server.status}</p>
              <Button size="sm" className="mt-3" leftIcon={<Play className="w-4 h-4" />}>
                Start Server
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          'px-5 py-3 border-t flex items-center justify-between text-xs',
          isLight ? 'border-gray-200 text-gray-500' : 'border-gray-700 text-gray-500'
        )}>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Uptime: {server.uptime}
          </span>
          {server.lastBackup && (
            <span>Last backup: {server.lastBackup}</span>
          )}
        </div>
      </div>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        type="danger"
        title="Remove Database Server"
        message={`Are you sure you want to remove "${server.name}"? This will not delete the actual database data.`}
        confirmText={deleting ? "Removing..." : "Remove"}
        loading={deleting}
      />
    </>
  );
}

function DatabaseList({ server }: { server: DatabaseServer }) {
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  const [search, setSearch] = useState('');
  const [databases, setDatabases] = useState<DisplayDatabaseInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        setLoading(true);
        const data = await databaseApi.listDatabases(server.id);
        // Convert API data to display format
        const displayData: DisplayDatabaseInstance[] = data.map(db => ({
          id: db.id,
          name: db.name,
          serverId: db.server_id,
          size: db.size || '0 B',
          tables: db.tables || 0,
          charset: db.charset || 'utf8mb4',
          collation: db.collation || 'utf8mb4_general_ci',
        }));
        setDatabases(displayData);
      } catch (error) {
        console.error('Failed to fetch databases:', error);
        setDatabases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDatabases();
  }, [server.id]);

  const filteredDatabases = databases.filter(
    (db) => db.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="max-w-xs">
          <SearchInput
            placeholder="Search databases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} size="sm">
          Create Database
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={cn(
              'border-b text-left text-sm',
              isLight ? 'border-gray-200 text-gray-600' : 'border-gray-700 text-gray-400'
            )}>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Tables</th>
              <th className="px-4 py-3 font-medium">Charset</th>
              <th className="px-4 py-3 font-medium">Collation</th>
              <th className="px-4 py-3 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={cn('px-4 py-8 text-center', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  Loading databases...
                </td>
              </tr>
            ) : filteredDatabases.length === 0 ? (
              <tr>
                <td colSpan={6} className={cn('px-4 py-8 text-center', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  No databases found
                </td>
              </tr>
            ) : (
              filteredDatabases.map((db) => (
              <motion.tr
                key={db.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  'border-b transition-colors',
                  isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-gray-800 hover:bg-gray-800/50'
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Database className={cn('w-4 h-4', isLight ? 'text-gray-400' : 'text-gray-500')} />
                    <span className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>{db.name}</span>
                  </div>
                </td>
                <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>{db.size}</td>
                <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>{db.tables}</td>
                <td className={cn('px-4 py-3 text-sm font-mono', isLight ? 'text-gray-600' : 'text-gray-400')}>{db.charset}</td>
                <td className={cn('px-4 py-3 text-sm font-mono', isLight ? 'text-gray-600' : 'text-gray-400')}>{db.collation}</td>
                <td className="px-4 py-3">
                  <Dropdown
                    trigger={
                      <button className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-700'
                      )}>
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    }
                  >
                    <DropdownItem icon={<Table2 className="w-4 h-4" />}>Browse Tables</DropdownItem>
                    <DropdownItem icon={<Terminal className="w-4 h-4" />}>SQL Console</DropdownItem>
                    <DropdownItem icon={<Users className="w-4 h-4" />}>Privileges</DropdownItem>
                    <DropdownDivider />
                    <DropdownItem icon={<Download className="w-4 h-4" />}>Export</DropdownItem>
                    <DropdownItem icon={<Upload className="w-4 h-4" />}>Import</DropdownItem>
                    <DropdownDivider />
                    <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger>Drop Database</DropdownItem>
                  </Dropdown>
                </td>
              </motion.tr>
            ))
            )}
          </tbody>
        </table>
        {!loading && filteredDatabases.length === 0 && databases.length === 0 && (
          <div className="py-12">
            <Empty
              icon={<Database className="w-8 h-8" />}
              title="No databases found"
              description="Create your first database or adjust filters"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ServerDetail({ server, onBack }: { server: DatabaseServer; onBack: () => void }) {
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  const [activeTab, setActiveTab] = useState<'databases' | 'users' | 'metrics' | 'settings'>('databases');
  const typeConfig = dbTypeConfig[server.type] || defaultTypeConfig;

  return (
    <div>
      {/* Back Button & Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className={cn(
            'flex items-center gap-2 text-sm mb-4 transition-colors',
            isLight ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-100'
          )}
        >
          ← Back to Servers
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center text-3xl', typeConfig.bgColor)}>
              {typeConfig.icon}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {server.name}
                </h1>
                <StatusDot 
                  status={server.status === 'online' ? 'online' : 'offline'} 
                  pulse={server.status === 'online'} 
                />
                <Badge variant={server.status === 'online' ? 'success' : 'gray'}>
                  {server.status}
                </Badge>
              </div>
              <p className={cn('mt-1', isLight ? 'text-gray-600' : 'text-gray-400')}>
                {server.type.toUpperCase()} {server.version} • {server.host}:{server.port}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={<Terminal className="w-4 h-4" />}>
              Console
            </Button>
            {server.status === 'online' ? (
              <Button variant="secondary" leftIcon={<Square className="w-4 h-4" />}>
                Stop
              </Button>
            ) : (
              <Button leftIcon={<Play className="w-4 h-4" />}>
                Start
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Database className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{server.databases}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Databases</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {server.connections.active}
            </p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
              / {server.connections.max} Connections
            </p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <HardDrive className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{server.size}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Storage Used</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{server.uptime}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Uptime</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs className="mb-6">
        <Tab active={activeTab === 'databases'} onClick={() => setActiveTab('databases')}>
          Databases ({server.databases})
        </Tab>
        <Tab active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
          Users & Privileges
        </Tab>
        <Tab active={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')}>
          Metrics
        </Tab>
        <Tab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          Settings
        </Tab>
      </Tabs>

      {/* Tab Content */}
      <Card>
        {activeTab === 'databases' && <DatabaseList server={server} />}
        {activeTab === 'users' && (
          <div className="p-8 text-center">
            <Users className={cn('w-12 h-12 mx-auto mb-4', isLight ? 'text-gray-400' : 'text-gray-500')} />
            <h3 className={cn('text-lg font-medium mb-2', isLight ? 'text-gray-900' : 'text-gray-100')}>
              User Management
            </h3>
            <p className={cn('mb-4', isLight ? 'text-gray-600' : 'text-gray-400')}>
              Manage database users and their privileges
            </p>
            <Button leftIcon={<Plus className="w-4 h-4" />}>Add User</Button>
          </div>
        )}
        {activeTab === 'metrics' && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className={cn('font-medium mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  CPU Usage
                </h4>
                <div className={cn('h-40 rounded-lg flex items-center justify-center', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <div className="text-center">
                    <p className={cn('text-4xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                      {server.cpu}%
                    </p>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>Current</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className={cn('font-medium mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  Memory Usage
                </h4>
                <div className={cn('h-40 rounded-lg flex items-center justify-center', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <div className="text-center">
                    <p className={cn('text-4xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                      {server.memory.total > 0 ? ((server.memory.used / server.memory.total) * 100).toFixed(0) : 0}%
                    </p>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      {server.memory.used} / {server.memory.total} GB
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className={cn('font-medium mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  Connections
                </h4>
                <div className={cn('h-40 rounded-lg flex items-center justify-center', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <div className="text-center">
                    <p className={cn('text-4xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                      {server.connections?.active ?? 0}
                    </p>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      / {server.connections?.max ?? 0} max
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className={cn('font-medium mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  Storage
                </h4>
                <div className={cn('h-40 rounded-lg flex items-center justify-center', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <div className="text-center">
                    <p className={cn('text-4xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                      {server.storage.total > 0 ? ((server.storage.used / server.storage.total) * 100).toFixed(0) : 0}%
                    </p>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      {server.storage.used} / {server.storage.total} GB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-6">
            <div>
              <h4 className={cn('font-medium mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
                Connection Settings
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Host
                  </label>
                  <Input value={server.host} readOnly />
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Port
                  </label>
                  <Input value={server.port.toString()} readOnly />
                </div>
              </div>
            </div>
            <div>
              <h4 className={cn('font-medium mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
                Performance Settings
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Max Connections
                  </label>
                  <Input value={(server.connections?.max ?? 0).toString()} />
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Memory Limit
                  </label>
                  <Input value={`${server.memory?.total ?? 0} GB`} />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button>Save Settings</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function DatabaseServers() {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedServer, setSelectedServer] = useState<DatabaseServer | null>(null);
  const [filterType, setFilterType] = useState<DatabaseType | 'all'>('all');
  const [servers, setServers] = useState<DatabaseServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  // Form state for adding server
  const [addMode, setAddMode] = useState<'create' | 'connect'>('create');
  const [formData, setFormData] = useState({
    name: '',
    type: 'mysql' as DatabaseType,
    host: 'localhost',
    port: 3306,
    username: '',
    password: '',
    rootPassword: '',
    version: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Deploy progress state
  const [deployTask, setDeployTask] = useState<DeployTask | null>(null);
  const [showDeployProgress, setShowDeployProgress] = useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

  // Poll deploy task progress
  useEffect(() => {
    if (!deployTask || deployTask.status === 'completed' || deployTask.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const task = await databaseApi.getDeployTask(deployTask.id);
        setDeployTask(task);

        if (task.status === 'completed' || task.status === 'failed') {
          clearInterval(interval);
          if (task.status === 'completed') {
            // Refresh server list after successful deployment
            setTimeout(() => {
              fetchServers();
            }, 1000);
          }
        }
      } catch (err) {
        console.error('Failed to get deploy status:', err);
      }
    }, 500); // Poll every 500ms

    return () => clearInterval(interval);
  }, [deployTask?.id, deployTask?.status]);

  const fetchServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await databaseApi.listServers();
      setServers(data.map(enrichServer));
    } catch (err) {
      console.error('Failed to fetch servers:', err);
      setError('Failed to load database servers');
      setServers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = async () => {
    if (!formData.name) {
      alert('Please enter a server name');
      return;
    }

    if (addMode === 'connect') {
      if (!formData.host || !formData.username) {
        alert('Please fill in all required fields');
        return;
      }
    } else {
      // Create mode
      if (!formData.rootPassword && formData.type !== 'redis') {
        alert('Please enter a root password');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (addMode === 'create') {
        // Start async deployment
        const result = await databaseApi.createServer({
          mode: 'create',
          name: formData.name,
          type: formData.type,
          port: formData.port || undefined,
          root_password: formData.rootPassword,
          version: formData.version || undefined,
        });
        
        // Result is a DeployTask
        setDeployTask(result as unknown as DeployTask);
        setShowAdd(false);
        setShowDeployProgress(true);
        setFormData({
          name: '',
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          username: '',
          password: '',
          rootPassword: '',
          version: '',
        });
      } else {
        await databaseApi.createServer({
          mode: 'connect',
          name: formData.name,
          type: formData.type,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: formData.password,
        });
        setShowAdd(false);
        setAddMode('create');
        setFormData({
          name: '',
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          username: '',
          password: '',
          rootPassword: '',
          version: '',
        });
        fetchServers();
      }
    } catch (err) {
      console.error('Failed to create server:', err);
      alert(err instanceof Error ? err.message : 'Failed to create database server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDeployProgress = () => {
    setShowDeployProgress(false);
    setDeployTask(null);
    setAddMode('create');
  };

  const filteredServers = servers.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.host.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || s.type === filterType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: servers.length,
    running: servers.filter((s) => s.status === 'online').length,
    stopped: servers.filter((s) => s.status === 'offline').length,
  };

  if (selectedServer) {
    return <ServerDetail server={selectedServer} onBack={() => setSelectedServer(null)} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>Database Servers</h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Manage your database connections</p>
        </div>
        <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowAdd(true)}>
          Create Server
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Server className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{stats.total}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Total Servers</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{stats.running}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Running</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-500/20 flex items-center justify-center">
            <XCircle className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{stats.stopped}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Stopped</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as DatabaseType | 'all')}
          className={cn(
            'px-3 py-2 rounded-lg text-sm border',
            isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-800 border-gray-700 text-gray-300'
          )}
        >
          <option value="all">All Types</option>
          <option value="mysql">MySQL</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mongodb">MongoDB</option>
          <option value="redis">Redis</option>
          <option value="mariadb">MariaDB</option>
        </select>
      </div>

      {/* Servers Grid */}
      {loading ? (
        <Card padding>
          <div className={cn('py-12 text-center', isLight ? 'text-gray-500' : 'text-gray-400')}>
            <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin" />
            <p>Loading database servers...</p>
          </div>
        </Card>
      ) : error ? (
        <Card padding>
          <div className={cn('py-12 text-center', isLight ? 'text-red-600' : 'text-red-400')}>
            <AlertCircle className="w-8 h-8 mx-auto mb-4" />
            <p className="mb-4">{error}</p>
            <Button onClick={fetchServers} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Retry
            </Button>
          </div>
        </Card>
      ) : filteredServers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredServers.map((server) => (
            <ServerCard 
              key={server.id} 
              server={server} 
              onSelect={() => setSelectedServer(server)}
              onDelete={fetchServers}
            />
          ))}
        </div>
      ) : (
        <Card padding>
          <Empty
            icon={<Database className="w-8 h-8 text-gray-500" />}
            title="No database servers found"
            description={search || filterType !== 'all' ? "No servers match your filters" : "Add your first database server to start managing"}
            action={
            <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowAdd(true)}>
              Create Server
            </Button>
            }
          />
        </Card>
      )}

      {/* Create Server Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create Database Server" size="md">
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
            <button
              onClick={() => setAddMode('create')}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
                addMode === 'create'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              Create New
            </button>
            <button
              onClick={() => setAddMode('connect')}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
                addMode === 'connect'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              Connect Existing
            </button>
          </div>

          <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            {addMode === 'create' 
              ? 'Deploy a new database server using Docker. Make sure Docker is running.'
              : 'Connect to an existing database server on your network.'}
          </p>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Server Name *
            </label>
            <Input 
              placeholder="My Database Server" 
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Database Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => {
                const type = e.target.value as DatabaseType;
                const defaultPorts: Record<DatabaseType, number> = {
                  mysql: 3306,
                  postgresql: 5432,
                  mongodb: 27017,
                  redis: 6379,
                  mariadb: 3306,
                };
                setFormData({ ...formData, type, port: defaultPorts[type] });
              }}
              className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm',
                isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
              )}
            >
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mongodb">MongoDB</option>
              <option value="redis">Redis</option>
              <option value="mariadb">MariaDB</option>
            </select>
          </div>

          {addMode === 'create' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Version
                  </label>
                  <select
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border text-sm',
                      isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
                    )}
                  >
                    {formData.type === 'mysql' && (
                      <>
                        <option value="latest">Latest (8.x)</option>
                        <option value="8.0">8.0</option>
                        <option value="8.4">8.4</option>
                        <option value="5.7">5.7</option>
                      </>
                    )}
                    {formData.type === 'mariadb' && (
                      <>
                        <option value="latest">Latest (11.x)</option>
                        <option value="11">11</option>
                        <option value="10.11">10.11 LTS</option>
                        <option value="10.6">10.6 LTS</option>
                      </>
                    )}
                    {formData.type === 'postgresql' && (
                      <>
                        <option value="latest">Latest (16.x)</option>
                        <option value="16">16</option>
                        <option value="15">15</option>
                        <option value="14">14</option>
                        <option value="13">13</option>
                      </>
                    )}
                    {formData.type === 'mongodb' && (
                      <>
                        <option value="latest">Latest (7.x)</option>
                        <option value="7.0">7.0</option>
                        <option value="6.0">6.0</option>
                        <option value="5.0">5.0</option>
                      </>
                    )}
                    {formData.type === 'redis' && (
                      <>
                        <option value="latest">Latest (7.x)</option>
                        <option value="7">7</option>
                        <option value="6">6</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Port
                  </label>
                  <Input 
                    type="number"
                    placeholder={String(formData.port)} 
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || formData.port })}
                  />
                </div>
              </div>

              {formData.type !== 'redis' && (
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Root Password *
                  </label>
                  <Input 
                    type="password" 
                    placeholder="Enter a secure password" 
                    value={formData.rootPassword}
                    onChange={(e) => setFormData({ ...formData, rootPassword: e.target.value })}
                  />
                  <p className={cn('text-xs mt-1', isLight ? 'text-gray-500' : 'text-gray-500')}>
                    {formData.type === 'postgresql' ? 'postgres' : formData.type === 'mongodb' ? 'root' : 'root'} user password
                  </p>
                </div>
              )}

              <div className={cn('p-3 rounded-lg text-sm space-y-1', isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/30 text-blue-300')}>
                <p><strong>Deploy Info:</strong></p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  <li>Docker image will be pulled automatically</li>
                  <li>Data persisted to volume: <code className="font-mono">vpanel-db-{formData.name || 'name'}</code></li>
                  <li>Accessible at: <code className="font-mono">127.0.0.1:{formData.port}</code></li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Host *
                  </label>
                  <Input 
                    placeholder="localhost or IP address" 
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  />
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Port *
                  </label>
                  <Input 
                    type="number"
                    placeholder="3306" 
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 3306 })}
                  />
                </div>
              </div>

              <div>
                <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                  Username *
                </label>
                <Input 
                  placeholder="root" 
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div>
                <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                  Password
                </label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </>
          )}

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button variant="secondary" onClick={() => setShowAdd(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleAddServer} disabled={submitting}>
              {submitting 
                ? (addMode === 'create' ? 'Starting...' : 'Connecting...') 
                : (addMode === 'create' ? 'Deploy Server' : 'Connect')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deploy Progress Modal */}
      <Modal 
        open={showDeployProgress} 
        onClose={handleCloseDeployProgress}
        closeOnBackdrop={deployTask?.status === 'completed' || deployTask?.status === 'failed'}
        showClose={deployTask?.status === 'completed' || deployTask?.status === 'failed'}
        title={`Deploying ${deployTask?.name || 'Database'}`}
        size="md"
      >
        {deployTask && (
          <div className="space-y-6">
            {/* Status Header */}
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                deployTask.status === 'completed' ? 'bg-green-500/20' :
                deployTask.status === 'failed' ? 'bg-red-500/20' :
                'bg-blue-500/20'
              )}>
                {deployTask.status === 'completed' ? '✅' :
                 deployTask.status === 'failed' ? '❌' :
                 dbTypeConfig[deployTask.type]?.icon || '🗄️'}
              </div>
              <div className="flex-1">
                <h3 className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {deployTask.status === 'completed' ? 'Deployment Complete!' :
                   deployTask.status === 'failed' ? 'Deployment Failed' :
                   deployTask.current_step}
                </h3>
                <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  {deployTask.type.toUpperCase()} • {deployTask.name}
                </p>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>Progress</span>
                <span className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {deployTask.progress}%
                </span>
              </div>
              <div className={cn('h-3 rounded-full overflow-hidden', isLight ? 'bg-gray-200' : 'bg-gray-700')}>
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    deployTask.status === 'failed' ? 'bg-red-500' :
                    deployTask.status === 'completed' ? 'bg-green-500' :
                    'bg-blue-500'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${deployTask.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Step List */}
            <div className="space-y-2">
              {deployTask.steps?.steps?.map((step, index) => (
                <div 
                  key={index}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg',
                    isLight ? 'bg-gray-50' : 'bg-gray-800/50'
                  )}
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    {step.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : step.status === 'running' ? (
                      <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : step.status === 'failed' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <div className={cn('w-2 h-2 rounded-full', isLight ? 'bg-gray-300' : 'bg-gray-600')} />
                    )}
                  </div>
                  <span className={cn(
                    'flex-1 text-sm',
                    step.status === 'completed' ? (isLight ? 'text-gray-900' : 'text-gray-100') :
                    step.status === 'running' ? 'text-blue-500 font-medium' :
                    step.status === 'failed' ? 'text-red-500' :
                    (isLight ? 'text-gray-400' : 'text-gray-500')
                  )}>
                    {step.name}
                  </span>
                  {step.status === 'running' && step.progress > 0 && step.progress < 100 && (
                    <span className="text-xs text-blue-500">{step.progress}%</span>
                  )}
                </div>
              ))}
            </div>

            {/* Error Message */}
            {deployTask.status === 'failed' && deployTask.error && (
              <div className={cn('p-4 rounded-lg', isLight ? 'bg-red-50 text-red-700' : 'bg-red-900/30 text-red-300')}>
                <p className="font-medium mb-1">Error</p>
                <p className="text-sm">{deployTask.error}</p>
              </div>
            )}

            {/* Success Info */}
            {deployTask.status === 'completed' && (
              <div className={cn('p-4 rounded-lg', isLight ? 'bg-green-50 text-green-700' : 'bg-green-900/30 text-green-300')}>
                <p className="font-medium mb-2">🎉 Database is ready!</p>
                <div className="text-sm space-y-1">
                  <p>Host: <code className="font-mono">127.0.0.1</code></p>
                  <p>Type: <code className="font-mono">{deployTask.type}</code></p>
                </div>
              </div>
            )}

            {/* Close Button */}
            {(deployTask.status === 'completed' || deployTask.status === 'failed') && (
              <div className="flex justify-end pt-2">
                <Button onClick={handleCloseDeployProgress}>
                  {deployTask.status === 'completed' ? 'Done' : 'Close'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
