import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Download,
  Upload,
  Trash2,
  MoreVertical,
  Clock,
  HardDrive,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  RefreshCw,
  Calendar,
  FileArchive,
  Cloud,
  Settings,
  History,
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
  Tabs,
  Tab,
  Input,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import * as databaseApi from '../api/database';
import type { DatabaseBackup as ApiDatabaseBackup } from '../api/database';

type BackupStatus = 'completed' | 'running' | 'failed' | 'scheduled';
type BackupType = 'full' | 'incremental' | 'differential';

interface Backup {
  id: string;
  name: string;
  database: string;
  server: string;
  serverId: string;
  serverType: 'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'mariadb';
  type: BackupType;
  status: BackupStatus;
  size: string;
  createdAt: string;
  duration: string;
  storage: 'local' | 's3' | 'gcs' | 'azure';
  retention: string;
  compressed: boolean;
  encrypted: boolean;
}

// Helper function to convert API backup to display format
function convertBackup(apiBackup: ApiDatabaseBackup, servers: databaseApi.DatabaseServer[]): Backup {
  const server = servers.find(s => s.id === apiBackup.server_id);
  const serverName = server?.name || 'Unknown Server';
  const serverType = server?.type || 'mysql';

  // Map API status to display status
  let displayStatus: BackupStatus = 'completed';
  if (apiBackup.status === 'in_progress') displayStatus = 'running';
  else if (apiBackup.status === 'failed') displayStatus = 'failed';

  // Format file size
  const sizeInMB = apiBackup.file_size / (1024 * 1024);
  const sizeStr = sizeInMB > 1024 
    ? `${(sizeInMB / 1024).toFixed(2)} GB`
    : `${sizeInMB.toFixed(2)} MB`;

  // Format date
  const createdAt = apiBackup.created_at 
    ? new Date(apiBackup.created_at).toLocaleString()
    : 'Unknown';

  // Calculate duration (if completed)
  let duration = '-';
  if (apiBackup.status === 'completed' && apiBackup.completed_at && apiBackup.created_at) {
    const start = new Date(apiBackup.created_at).getTime();
    const end = new Date(apiBackup.completed_at).getTime();
    const diff = Math.floor((end - start) / 1000); // seconds
    if (diff < 60) {
      duration = `${diff}s`;
    } else if (diff < 3600) {
      duration = `${Math.floor(diff / 60)}m ${diff % 60}s`;
    } else {
      duration = `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    }
  } else if (apiBackup.status === 'in_progress') {
    duration = 'Running...';
  }

  return {
    id: apiBackup.id,
    name: apiBackup.file_name,
    database: apiBackup.database,
    server: serverName,
    serverId: apiBackup.server_id,
    serverType: serverType as Backup['serverType'],
    type: 'full', // API doesn't distinguish, default to full
    status: displayStatus,
    size: sizeStr,
    createdAt,
    duration,
    storage: 'local', // Default, can be extended later
    retention: '30 days', // Default, can be extended later
    compressed: true, // Default, can be extended later
    encrypted: false, // Default, can be extended later
  };
}

interface ScheduledBackup {
  id: string;
  name: string;
  database: string;
  server: string;
  schedule: string;
  type: BackupType;
  nextRun: string;
  lastRun?: string;
  lastStatus?: BackupStatus;
  enabled: boolean;
  retention: string;
  storage: 'local' | 's3' | 'gcs' | 'azure';
}

const mockSchedules: ScheduledBackup[] = [
  {
    id: '1',
    name: 'Daily Full Backup',
    database: 'app_production',
    server: 'Production MySQL',
    schedule: '0 2 * * *',
    type: 'full',
    nextRun: 'Tomorrow 02:00',
    lastRun: 'Today 02:00',
    lastStatus: 'completed',
    enabled: true,
    retention: '30 days',
    storage: 's3',
  },
  {
    id: '2',
    name: 'Hourly Incremental',
    database: 'app_production',
    server: 'Production MySQL',
    schedule: '0 * * * *',
    type: 'incremental',
    nextRun: 'In 45 minutes',
    lastRun: '15 minutes ago',
    lastStatus: 'completed',
    enabled: true,
    retention: '7 days',
    storage: 's3',
  },
  {
    id: '3',
    name: 'Weekly Analytics Backup',
    database: 'analytics',
    server: 'Production PostgreSQL',
    schedule: '0 3 * * 0',
    type: 'full',
    nextRun: 'Sunday 03:00',
    lastRun: 'Last Sunday',
    lastStatus: 'completed',
    enabled: true,
    retention: '90 days',
    storage: 'gcs',
  },
  {
    id: '4',
    name: 'MongoDB Daily',
    database: 'all',
    server: 'MongoDB Cluster',
    schedule: '0 22 * * *',
    type: 'full',
    nextRun: 'Today 22:00',
    lastRun: 'Yesterday 22:00',
    lastStatus: 'completed',
    enabled: true,
    retention: '60 days',
    storage: 'gcs',
  },
  {
    id: '5',
    name: 'Dev Backup (Disabled)',
    database: 'app_dev',
    server: 'Dev MariaDB',
    schedule: '0 4 * * *',
    type: 'full',
    nextRun: '-',
    lastRun: '3 days ago',
    lastStatus: 'completed',
    enabled: false,
    retention: '7 days',
    storage: 'local',
  },
];

const statusConfig = {
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Completed' },
  running: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Running' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
  scheduled: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Scheduled' },
};

const storageConfig = {
  local: { label: 'Local', color: 'bg-gray-500/10 text-gray-500' },
  s3: { label: 'AWS S3', color: 'bg-orange-500/10 text-orange-500' },
  gcs: { label: 'GCS', color: 'bg-blue-500/10 text-blue-500' },
  azure: { label: 'Azure', color: 'bg-blue-600/10 text-blue-600' },
};

const dbTypeIcons: Record<string, string> = {
  mysql: '🐬',
  postgresql: '🐘',
  mongodb: '🍃',
  redis: '⚡',
  mariadb: '🦭',
};

function BackupRow({ backup, onDelete }: { backup: Backup; onDelete: () => void }) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await databaseApi.deleteBackup(backup.id);
      setShowDelete(false);
      onDelete();
    } catch (error) {
      console.error('Failed to delete backup:', error);
      alert('Failed to delete backup');
    } finally {
      setDeleting(false);
    }
  };
  const status = statusConfig[backup.status];
  const StatusIcon = status.icon;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'border-b transition-colors',
          isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-gray-800 hover:bg-gray-800/50'
        )}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-lg', status.bg)}>
              {dbTypeIcons[backup.serverType]}
            </div>
            <div>
              <p className={cn('font-medium text-sm', isLight ? 'text-gray-900' : 'text-gray-100')}>
                {backup.name}
              </p>
              <p className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-500')}>
                {backup.database} • {backup.server}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge className={cn(status.bg, status.color)}>
            <StatusIcon className={cn('w-3 h-3 mr-1', backup.status === 'running' && 'animate-spin')} />
            {status.label}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <Badge variant={backup.type === 'full' ? 'primary' : backup.type === 'incremental' ? 'success' : 'warning'}>
            {backup.type}
          </Badge>
        </td>
        <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
          {backup.size}
        </td>
        <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
          {backup.duration}
        </td>
        <td className="px-4 py-3">
          <Badge className={storageConfig[backup.storage].color}>
            {storageConfig[backup.storage].label}
          </Badge>
        </td>
        <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
          {backup.createdAt}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {backup.compressed && (
              <Badge variant="gray" className="text-xs">ZIP</Badge>
            )}
            {backup.encrypted && (
              <Badge variant="gray" className="text-xs">🔒</Badge>
            )}
          </div>
        </td>
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
            <DropdownItem icon={<Download className="w-4 h-4" />}>Download</DropdownItem>
            <DropdownItem icon={<Upload className="w-4 h-4" />}>Restore</DropdownItem>
            <DropdownItem icon={<History className="w-4 h-4" />}>View Log</DropdownItem>
            <DropdownDivider />
            <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onClick={() => setShowDelete(true)}>
              Delete
            </DropdownItem>
          </Dropdown>
        </td>
      </motion.tr>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        type="danger"
        title="Delete Backup"
        message={`Are you sure you want to delete "${backup.name}"? This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        loading={deleting}
      />
    </>
  );
}

function ScheduleRow({ schedule }: { schedule: ScheduledBackup }) {
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'border-b transition-colors',
        isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-gray-800 hover:bg-gray-800/50',
        !schedule.enabled && 'opacity-60'
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            schedule.enabled ? 'bg-green-500/10' : 'bg-gray-500/10'
          )}>
            <Calendar className={cn(
              'w-4 h-4',
              schedule.enabled ? 'text-green-500' : 'text-gray-500'
            )} />
          </div>
          <div>
            <p className={cn('font-medium text-sm', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {schedule.name}
            </p>
            <p className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-500')}>
              {schedule.database} • {schedule.server}
            </p>
          </div>
        </div>
      </td>
      <td className={cn('px-4 py-3 text-sm font-mono', isLight ? 'text-gray-600' : 'text-gray-400')}>
        {schedule.schedule}
      </td>
      <td className="px-4 py-3">
        <Badge variant={schedule.type === 'full' ? 'primary' : schedule.type === 'incremental' ? 'success' : 'warning'}>
          {schedule.type}
        </Badge>
      </td>
      <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
        {schedule.nextRun}
      </td>
      <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
        <div className="flex items-center gap-2">
          {schedule.lastRun || '-'}
          {schedule.lastStatus && (
            <span className={cn(
              'w-2 h-2 rounded-full',
              schedule.lastStatus === 'completed' ? 'bg-green-500' : 
              schedule.lastStatus === 'failed' ? 'bg-red-500' : 'bg-gray-500'
            )} />
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge className={storageConfig[schedule.storage].color}>
          {storageConfig[schedule.storage].label}
        </Badge>
      </td>
      <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
        {schedule.retention}
      </td>
      <td className="px-4 py-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={schedule.enabled} className="sr-only peer" onChange={() => {}} />
          <div className={cn(
            'w-9 h-5 rounded-full peer transition-colors',
            schedule.enabled ? 'bg-green-500' : isLight ? 'bg-gray-300' : 'bg-gray-600',
            'after:content-[""] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all',
            schedule.enabled && 'after:translate-x-full'
          )} />
        </label>
      </td>
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
          <DropdownItem icon={<Play className="w-4 h-4" />}>Run Now</DropdownItem>
          <DropdownItem icon={<Settings className="w-4 h-4" />}>Edit</DropdownItem>
          <DropdownItem icon={<History className="w-4 h-4" />}>View History</DropdownItem>
          <DropdownDivider />
          <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger>Delete</DropdownItem>
        </Dropdown>
      </td>
    </motion.tr>
  );
}

export default function DatabaseBackups() {
  const [activeTab, setActiveTab] = useState<'backups' | 'schedules' | 'storage'>('backups');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [servers, setServers] = useState<databaseApi.DatabaseServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  // Form state for creating backup
  const [formData, setFormData] = useState({
    serverId: '',
    database: '',
    type: 'manual' as 'manual' | 'scheduled',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [backupsData, serversData] = await Promise.all([
        databaseApi.listBackups(),
        databaseApi.listServers(),
      ]);
      setServers(serversData);
      setBackups(backupsData.map(b => convertBackup(b, serversData)));
    } catch (err) {
      console.error('Failed to fetch backups:', err);
      setError('Failed to load backups');
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!formData.serverId || !formData.database) {
      alert('Please select a server and database');
      return;
    }

    setSubmitting(true);
    try {
      await databaseApi.createBackup(formData.serverId, {
        database: formData.database,
        type: formData.type,
      });
      setShowCreate(false);
      setFormData({ serverId: '', database: '', type: 'manual' });
      // Refresh backups after a short delay to allow backup to start
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      console.error('Failed to create backup:', err);
      alert(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBackups = backups.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.database.toLowerCase().includes(search.toLowerCase()) ||
    b.server.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSchedules = mockSchedules.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.database.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate stats
  const totalSize = backups
    .filter((b) => b.status === 'completed')
    .reduce((acc, b) => {
      const size = parseFloat(b.size);
      if (b.size.includes('GB')) return acc + size;
      if (b.size.includes('MB')) return acc + size / 1024;
      return acc;
    }, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>Database Backups</h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Manage backups and restore points</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leftIcon={<Calendar className="w-4 h-4" />} onClick={() => setShowSchedule(true)}>
            New Schedule
          </Button>
          <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
            Create Backup
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <FileArchive className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {backups.length}
            </p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Total Backups</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {backups.filter((b) => b.status === 'completed').length}
            </p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Completed</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <HardDrive className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {totalSize.toFixed(1)} GB
            </p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Total Size</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {mockSchedules.filter((s) => s.enabled).length}
            </p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Active Schedules</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs className="mb-6">
        <Tab active={activeTab === 'backups'} onClick={() => setActiveTab('backups')}>
          Backups ({backups.length})
        </Tab>
        <Tab active={activeTab === 'schedules'} onClick={() => setActiveTab('schedules')}>
          Schedules ({mockSchedules.length})
        </Tab>
        <Tab active={activeTab === 'storage'} onClick={() => setActiveTab('storage')}>
          Storage Settings
        </Tab>
      </Tabs>

      {/* Search */}
      <div className="mb-6 max-w-md">
        <SearchInput
          placeholder={`Search ${activeTab}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Content */}
      <Card>
        {activeTab === 'backups' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn(
                  'border-b text-left text-sm',
                  isLight ? 'border-gray-200 text-gray-600' : 'border-gray-700 text-gray-400'
                )}>
                  <th className="px-4 py-3 font-medium">Backup</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Storage</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Options</th>
                  <th className="px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className={cn('px-4 py-8 text-center', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                      Loading backups...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className={cn('px-4 py-8 text-center', isLight ? 'text-red-600' : 'text-red-400')}>
                      <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                      <p className="mb-2">{error}</p>
                      <Button size="sm" onClick={fetchData} leftIcon={<RefreshCw className="w-4 h-4" />}>
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : filteredBackups.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={cn('px-4 py-8 text-center', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      No backups found
                    </td>
                  </tr>
                ) : (
                  filteredBackups.map((backup) => (
                    <BackupRow key={backup.id} backup={backup} onDelete={fetchData} />
                  ))
                )}
              </tbody>
            </table>
            {!loading && !error && filteredBackups.length === 0 && backups.length === 0 && (
              <div className="py-12">
                <Empty
                  icon={<FileArchive className="w-8 h-8" />}
                  title="No backups found"
                  description="Create your first backup to get started"
                  action={
                    <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
                      Create Backup
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn(
                  'border-b text-left text-sm',
                  isLight ? 'border-gray-200 text-gray-600' : 'border-gray-700 text-gray-400'
                )}>
                  <th className="px-4 py-3 font-medium">Schedule</th>
                  <th className="px-4 py-3 font-medium">Cron</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Next Run</th>
                  <th className="px-4 py-3 font-medium">Last Run</th>
                  <th className="px-4 py-3 font-medium">Storage</th>
                  <th className="px-4 py-3 font-medium">Retention</th>
                  <th className="px-4 py-3 font-medium">Enabled</th>
                  <th className="px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map((schedule) => (
                  <ScheduleRow key={schedule.id} schedule={schedule} />
                ))}
              </tbody>
            </table>
            {filteredSchedules.length === 0 && (
              <div className="py-12">
                <Empty
                  icon={<Calendar className="w-8 h-8" />}
                  title="No schedules found"
                  description="Set up automated backups with schedules"
                  action={
                    <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowSchedule(true)}>
                      New Schedule
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Local Storage */}
              <div className={cn('p-4 rounded-xl border', isLight ? 'border-gray-200' : 'border-gray-700')}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <h4 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Local Storage</h4>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      /var/backups/vpanel
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={isLight ? 'text-gray-500' : 'text-gray-400'}>Used</span>
                    <span className={isLight ? 'text-gray-900' : 'text-gray-100'}>45.2 GB / 200 GB</span>
                  </div>
                  <Progress value={22.6} max={100} />
                </div>
              </div>

              {/* AWS S3 */}
              <div className={cn('p-4 rounded-xl border', isLight ? 'border-gray-200' : 'border-gray-700')}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Cloud className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h4 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>AWS S3</h4>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      s3://vpanel-backups
                    </p>
                  </div>
                  <Badge variant="success" className="ml-auto">Connected</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={isLight ? 'text-gray-500' : 'text-gray-400'}>Total Size</span>
                    <span className={isLight ? 'text-gray-900' : 'text-gray-100'}>128.5 GB</span>
                  </div>
                </div>
              </div>

              {/* Google Cloud Storage */}
              <div className={cn('p-4 rounded-xl border', isLight ? 'border-gray-200' : 'border-gray-700')}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Cloud className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Google Cloud Storage</h4>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      gs://vpanel-backups
                    </p>
                  </div>
                  <Badge variant="success" className="ml-auto">Connected</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={isLight ? 'text-gray-500' : 'text-gray-400'}>Total Size</span>
                    <span className={isLight ? 'text-gray-900' : 'text-gray-100'}>256.8 GB</span>
                  </div>
                </div>
              </div>

              {/* Add Storage */}
              <div className={cn(
                'p-4 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors',
                isLight ? 'border-gray-300 hover:border-gray-400' : 'border-gray-700 hover:border-gray-600'
              )}>
                <div className="text-center">
                  <Plus className={cn('w-8 h-8 mx-auto mb-2', isLight ? 'text-gray-400' : 'text-gray-500')} />
                  <p className={cn('font-medium', isLight ? 'text-gray-600' : 'text-gray-400')}>Add Storage</p>
                  <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-500')}>
                    Connect S3, GCS, or Azure
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Create Backup Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Backup" size="md">
        <div className="space-y-4">
          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Database Server *
            </label>
            <select 
              value={formData.serverId}
              onChange={(e) => setFormData({ ...formData, serverId: e.target.value, database: '' })}
              className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm',
                isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
              )}
            >
              <option value="">Select a server</option>
              {servers.map(server => (
                <option key={server.id} value={server.id}>{server.name} ({server.type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Database *
            </label>
            <Input
              placeholder="Enter database name or 'all' for all databases"
              value={formData.database}
              onChange={(e) => setFormData({ ...formData, database: e.target.value })}
            />
            <p className={cn('text-xs mt-1', isLight ? 'text-gray-500' : 'text-gray-400')}>
              Enter the database name, or "all" to backup all databases on the server
            </p>
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Backup Type
            </label>
            <select 
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'manual' | 'scheduled' })}
              className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm',
                isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
              )}
            >
              <option value="manual">Manual Backup</option>
              <option value="scheduled">Scheduled Backup</option>
            </select>
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              leftIcon={<Play className="w-4 h-4" />} 
              onClick={handleCreateBackup}
              disabled={submitting || !formData.serverId || !formData.database}
            >
              {submitting ? 'Creating...' : 'Start Backup'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule Modal */}
      <Modal open={showSchedule} onClose={() => setShowSchedule(false)} title="Create Backup Schedule" size="md">
        <div className="space-y-4">
          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Schedule Name
            </label>
            <Input placeholder="Daily Production Backup" />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Database Server
            </label>
            <select className={cn(
              'w-full px-3 py-2 rounded-lg border text-sm',
              isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
            )}>
              <option>Production MySQL</option>
              <option>Production PostgreSQL</option>
              <option>MongoDB Cluster</option>
            </select>
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Cron Schedule
            </label>
            <Input placeholder="0 2 * * *" />
            <p className={cn('text-xs mt-1', isLight ? 'text-gray-500' : 'text-gray-400')}>
              Format: minute hour day month weekday
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                Backup Type
              </label>
              <select className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm',
                isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
              )}>
                <option value="full">Full</option>
                <option value="incremental">Incremental</option>
              </select>
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                Retention
              </label>
              <select className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm',
                isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
              )}>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button variant="secondary" onClick={() => setShowSchedule(false)}>Cancel</Button>
            <Button leftIcon={<Calendar className="w-4 h-4" />}>Create Schedule</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
