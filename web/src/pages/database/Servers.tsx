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
import type { DatabaseServer as ApiDatabaseServer, DatabaseType } from '@/api/database';

interface DatabaseServer extends ApiDatabaseServer {
  // Extended fields for display (can be computed from API data)
  version?: string;
  size?: string;
  connections?: { active: number; max: number };
  databases?: number;
  uptime?: string;
  cpu?: number;
  memory?: { used: number; total: number };
  storage?: { used: number; total: number };
  lastBackup?: string;
  isLocal?: boolean;
}

interface DatabaseInstance {
  id: string;
  name: string;
  serverId: string;
  size: string;
  tables: number;
  charset: string;
  collation: string;
}

// Helper function to map API status to display status
function mapStatus(status: string): 'running' | 'stopped' | 'error' {
  if (status === 'online') return 'running';
  if (status === 'offline') return 'stopped';
  return 'error';
}

// Helper function to enrich server data with default values for display
function enrichServer(server: ApiDatabaseServer): DatabaseServer {
  const mappedStatus = mapStatus(server.status);
  return {
    ...server,
    status: mappedStatus,
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

const dbTypeConfig: Record<DatabaseType, { icon: string; color: string; bgColor: string }> = {
  mysql: { icon: '🐬', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  postgresql: { icon: '🐘', color: 'text-blue-600', bgColor: 'bg-blue-600/10' },
  mongodb: { icon: '🍃', color: 'text-green-500', bgColor: 'bg-green-500/10' },
  redis: { icon: '⚡', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  mariadb: { icon: '🦭', color: 'text-amber-600', bgColor: 'bg-amber-600/10' },
};

function ServerCard({ server, onSelect, onDelete }: { server: DatabaseServer; onSelect: () => void; onDelete: () => void }) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  const typeConfig = dbTypeConfig[server.type];

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
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'rounded-xl border transition-all cursor-pointer hover:shadow-lg',
          isLight ? 'bg-white border-gray-200 hover:border-gray-300' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
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
                    status={server.status === 'running' ? 'online' : server.status === 'stopped' ? 'offline' : 'error'} 
                    pulse={server.status === 'running'} 
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
                {server.status === 'running' ? (
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
          {server.status === 'running' ? (
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
                <Progress value={(server.memory.used / server.memory.total) * 100} max={100} size="sm" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={isLight ? 'text-gray-500' : 'text-gray-400'}>Storage</span>
                  <span className={isLight ? 'text-gray-700' : 'text-gray-300'}>
                    {server.storage.used} / {server.storage.total} GB
                  </span>
                </div>
                <Progress value={(server.storage.used / server.storage.total) * 100} max={100} size="sm" />
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
      </motion.div>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        type="danger"
        title="Remove Database Server"
        message={`Are you sure you want to remove "${server.name}"? This will not delete the actual database data.`}
        confirmText={deleting ? "Removing..." : "Remove"}
        disabled={deleting}
      />
    </>
  );
}

function DatabaseList({ server }: { server: DatabaseServer }) {
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  const [search, setSearch] = useState('');
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        setLoading(true);
        const data = await databaseApi.listDatabases(server.id);
        setDatabases(data);
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
  const typeConfig = dbTypeConfig[server.type];

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
                  status={server.status === 'running' ? 'online' : 'offline'} 
                  pulse={server.status === 'running'} 
                />
                <Badge variant={server.status === 'running' ? 'success' : 'gray'}>
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
            {server.status === 'running' ? (
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
                      {((server.memory.used / server.memory.total) * 100).toFixed(0)}%
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
                      {server.connections.active}
                    </p>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      / {server.connections.max} max
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
                      {((server.storage.used / server.storage.total) * 100).toFixed(0)}%
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
                  <Input value={server.connections.max.toString()} />
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Memory Limit
                  </label>
                  <Input value={`${server.memory.total} GB`} />
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
  const [formData, setFormData] = useState({
    name: '',
    type: 'mysql' as DatabaseType,
    host: 'localhost',
    port: 3306,
    username: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

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
    if (!formData.name || !formData.host || !formData.username) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await databaseApi.createServer({
        name: formData.name,
        type: formData.type,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        password: formData.password,
      });
      setShowAdd(false);
      setFormData({
        name: '',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: '',
        password: '',
      });
      fetchServers();
    } catch (err) {
      console.error('Failed to create server:', err);
      alert(err instanceof Error ? err.message : 'Failed to create database server');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredServers = servers.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.host.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || s.type === filterType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: servers.length,
    running: servers.filter((s) => s.status === 'running').length,
    stopped: servers.filter((s) => s.status === 'stopped').length,
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
          Add Server
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
          <AnimatePresence>
            {filteredServers.map((server) => (
              <ServerCard 
                key={server.id} 
                server={server} 
                onSelect={() => setSelectedServer(server)}
                onDelete={fetchServers}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card padding>
          <Empty
            icon={<Database className="w-8 h-8 text-gray-500" />}
            title="No database servers found"
            description={search || filterType !== 'all' ? "No servers match your filters" : "Add your first database server to start managing"}
            action={
              <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowAdd(true)}>
                Add Server
              </Button>
            }
          />
        </Card>
      )}

      {/* Add Server Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Database Server" size="md">
        <div className="space-y-4">
          <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            Connect to an existing database server or create a new one.
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

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                Host *
              </label>
              <Input 
                placeholder="localhost" 
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
              Password *
            </label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button variant="secondary" onClick={() => setShowAdd(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleAddServer} disabled={submitting}>
              {submitting ? 'Testing & Adding...' : 'Test & Add'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
