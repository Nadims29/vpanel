import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, RefreshCw, Network as NetworkIcon } from 'lucide-react';
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
import * as dockerApi from '@/api/docker';
import type { Network, CreateNetworkRequest } from '@/api/docker';

export default function DockerNetworks() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [createForm, setCreateForm] = useState<CreateNetworkRequest>({
    name: '',
    driver: 'bridge',
  });
  const [creating, setCreating] = useState(false);

  // Fetch networks
  const fetchNetworks = useCallback(async () => {
    try {
      const data = await dockerApi.listNetworks();
      setNetworks(data);
    } catch (error) {
      console.error('Failed to fetch networks:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch networks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  // Handle create network
  const handleCreateNetwork = async () => {
    if (!createForm.name.trim()) {
      toast.error('Please enter a network name');
      return;
    }

    // Validate network name (alphanumeric, underscore, hyphen)
    const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
    if (!nameRegex.test(createForm.name.trim())) {
      toast.error('Network name must start with alphanumeric and contain only alphanumeric, underscore, hyphen, or dot');
      return;
    }

    setCreating(true);
    try {
      await dockerApi.createNetwork({
        name: createForm.name.trim(),
        driver: createForm.driver || 'bridge',
      });
      toast.success(`Network "${createForm.name}" created successfully`);
      setShowCreateModal(false);
      setCreateForm({ name: '', driver: 'bridge' });
      fetchNetworks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create network');
    } finally {
      setCreating(false);
    }
  };

  // Handle delete network
  const handleDeleteNetwork = async () => {
    if (!selectedNetwork) return;

    // Prevent deletion of default networks
    const defaultNetworks = ['bridge', 'host', 'none'];
    if (defaultNetworks.includes(selectedNetwork.name)) {
      toast.error('Cannot delete default Docker networks');
      setShowDeleteModal(false);
      setSelectedNetwork(null);
      return;
    }

    try {
      await dockerApi.removeNetwork(selectedNetwork.id);
      toast.success('Network deleted successfully');
      setShowDeleteModal(false);
      setSelectedNetwork(null);
      fetchNetworks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete network');
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

  // Filter networks
  const filteredNetworks = networks.filter((network) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      network.name.toLowerCase().includes(searchLower) ||
      network.driver.toLowerCase().includes(searchLower) ||
      network.id.toLowerCase().includes(searchLower)
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
          <h1 className="text-2xl font-semibold text-dark-100">Networks</h1>
          <p className="text-dark-400">Manage Docker networks</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            leftIcon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
            onClick={() => {
              setRefreshing(true);
              fetchNetworks();
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
            Create Network
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          placeholder="Search networks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Networks table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        {filteredNetworks.length === 0 ? (
          <Empty
            title="No networks found"
            description={search ? 'Try adjusting your search' : 'Create a network to get started'}
            icon={<NetworkIcon className="w-8 h-8 text-dark-500" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Driver</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell>Network ID</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNetworks.map((network) => {
                const isDefault = ['bridge', 'host', 'none'].includes(network.name);
                return (
                  <TableRow key={network.id}>
                    <TableCell className="font-medium text-dark-100">
                      {network.name}
                      {isDefault && (
                        <Badge variant="gray" className="ml-2">
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="primary">{network.driver}</Badge>
                    </TableCell>
                    <TableCell className="text-dark-400">{network.scope}</TableCell>
                    <TableCell className="font-mono text-sm text-dark-400">
                      {network.id}
                    </TableCell>
                    <TableCell className="text-dark-400">{formatDate(network.created)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          leftIcon={<Trash2 className="w-4 h-4" />}
                          onClick={() => {
                            setSelectedNetwork(network);
                            setShowDeleteModal(true);
                          }}
                          disabled={isDefault}
                          className={cn(
                            'text-red-400 hover:text-red-300',
                            isDefault && 'opacity-50 cursor-not-allowed'
                          )}
                          title={isDefault ? 'Cannot delete default networks' : 'Delete network'}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Create Network Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateForm({ name: '', driver: 'bridge' });
        }}
        title="Create Network"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Network Name</label>
            <Input
              placeholder="e.g., my-network"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateNetwork();
                }
              }}
            />
            <p className="text-sm text-dark-500 mt-1">
              Network name must start with alphanumeric and contain only alphanumeric, underscore, hyphen, or dot
            </p>
          </div>
          <div>
            <label className="label">Driver</label>
            <select
              value={createForm.driver || 'bridge'}
              onChange={(e) => setCreateForm({ ...createForm, driver: e.target.value })}
              className="input"
            >
              <option value="bridge">bridge</option>
              <option value="host">host</option>
              <option value="overlay">overlay</option>
              <option value="macvlan">macvlan</option>
              <option value="ipvlan">ipvlan</option>
            </select>
            <p className="text-sm text-dark-500 mt-1">
              Network driver type (default: bridge)
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                setCreateForm({ name: '', driver: 'bridge' });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateNetwork}
              disabled={creating || !createForm.name.trim()}
              leftIcon={creating ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
            >
              {creating ? 'Creating...' : 'Create Network'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedNetwork(null);
        }}
        onConfirm={handleDeleteNetwork}
        type="danger"
        title="Delete Network"
        message={
          selectedNetwork
            ? `Are you sure you want to delete network "${selectedNetwork.name}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
      />
    </div>
  );
}
