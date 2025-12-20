import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, RefreshCw, HardDrive as HardDriveIcon, Folder } from 'lucide-react';
import {
  Button,
  Badge,
  SearchInput,
  Modal,
  ConfirmModal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Empty,
  Spinner,
  Input,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as dockerApi from '../api/docker';
import type { Volume, CreateVolumeRequest } from '../api/docker';

export default function DockerVolumes() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState<Volume | null>(null);
  const [createForm, setCreateForm] = useState<CreateVolumeRequest>({
    name: '',
    driver: 'local',
  });
  const [creating, setCreating] = useState(false);

  // Fetch volumes
  const fetchVolumes = useCallback(async () => {
    try {
      const data = await dockerApi.listVolumes();
      setVolumes(data);
    } catch {
      // Silently handle error when Docker is unavailable
      setVolumes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVolumes();
  }, [fetchVolumes]);

  // Handle create volume
  const handleCreateVolume = async () => {
    if (!createForm.name.trim()) {
      toast.error('Please enter a volume name');
      return;
    }

    // Validate volume name (alphanumeric, underscore, hyphen)
    const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
    if (!nameRegex.test(createForm.name.trim())) {
      toast.error('Volume name must start with alphanumeric and contain only alphanumeric, underscore, hyphen, or dot');
      return;
    }

    setCreating(true);
    try {
      await dockerApi.createVolume({
        name: createForm.name.trim(),
        driver: createForm.driver || 'local',
      });
      toast.success(`Volume "${createForm.name}" created successfully`);
      setShowCreateModal(false);
      setCreateForm({ name: '', driver: 'local' });
      fetchVolumes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create volume');
    } finally {
      setCreating(false);
    }
  };

  // Handle delete volume
  const handleDeleteVolume = async () => {
    if (!selectedVolume) return;

    try {
      await dockerApi.removeVolume(selectedVolume.name, false);
      toast.success('Volume deleted successfully');
      setShowDeleteModal(false);
      setSelectedVolume(null);
      fetchVolumes();
    } catch (error) {
      // If deletion fails, try with force
      if (error instanceof Error && error.message.includes('in use')) {
        toast.error('Volume is in use. Cannot delete volume that is being used by containers.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to delete volume');
      }
    }
  };

  // Format created date
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Format mountpoint (truncate if too long)
  const formatMountpoint = (mountpoint: string): string => {
    if (mountpoint.length > 50) {
      return mountpoint.substring(0, 47) + '...';
    }
    return mountpoint;
  };

  // Filter volumes
  const filteredVolumes = volumes.filter((volume) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      volume.name.toLowerCase().includes(searchLower) ||
      volume.driver.toLowerCase().includes(searchLower) ||
      volume.mountpoint.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dark-100">Volumes</h1>
          <p className="text-dark-400">Manage Docker volumes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            leftIcon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
            onClick={() => {
              setRefreshing(true);
              fetchVolumes();
            }}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Create Volume
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          placeholder="Search volumes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Volumes table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        {filteredVolumes.length === 0 ? (
          <Empty
            title="No volumes found"
            description={search ? 'Try adjusting your search' : 'Create a volume to get started'}
            icon={<HardDriveIcon className="w-8 h-8 text-dark-500" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Driver</TableCell>
                <TableCell>Mountpoint</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVolumes.map((volume) => (
                <TableRow key={volume.name}>
                  <TableCell className="font-medium text-dark-100">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-dark-500" />
                      {volume.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">{volume.driver}</Badge>
                  </TableCell>
                  <TableCell className="text-dark-400 font-mono text-sm">
                    <span title={volume.mountpoint}>{formatMountpoint(volume.mountpoint)}</span>
                  </TableCell>
                  <TableCell className="text-dark-400">{formatDate(volume.created)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        onClick={() => {
                          setSelectedVolume(volume);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Create Volume Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateForm({ name: '', driver: 'local' });
        }}
        title="Create Volume"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Volume Name</label>
            <Input
              placeholder="e.g., my-volume"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateVolume();
                }
              }}
            />
            <p className="text-sm text-dark-500 mt-1">
              Volume name must start with alphanumeric and contain only alphanumeric, underscore, hyphen, or dot.
              Leave empty for auto-generated name.
            </p>
          </div>
          <div>
            <label className="label">Driver</label>
            <select
              value={createForm.driver || 'local'}
              onChange={(e) => setCreateForm({ ...createForm, driver: e.target.value })}
              className="input"
            >
              <option value="local">local</option>
              <option value="nfs">nfs</option>
              <option value="cifs">cifs</option>
            </select>
            <p className="text-sm text-dark-500 mt-1">
              Volume driver type (default: local)
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                setCreateForm({ name: '', driver: 'local' });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateVolume}
              disabled={creating}
              leftIcon={creating ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
            >
              {creating ? 'Creating...' : 'Create Volume'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedVolume(null);
        }}
        onConfirm={handleDeleteVolume}
        type="danger"
        title="Delete Volume"
        message={
          selectedVolume
            ? `Are you sure you want to delete volume "${selectedVolume.name}"? This action cannot be undone. Make sure no containers are using this volume.`
            : ''
        }
        confirmText="Delete"
      />
    </div>
  );
}
