import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  Users,
  Check,
  X,
  Lock,
  Eye,
  Pencil,
  Settings,
  Server,
  Container,
  Database,
  FolderOpen,
  Terminal,
  Globe,
  Clock,
  Puzzle,
  FileText,
  Cloud,
  Loader2,
  AlertCircle,
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
  Empty,
  Input,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import * as rolesApi from '@/api/roles';
import type { Role } from '@/api/roles';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  actions: ('read' | 'write' | 'delete' | 'admin')[];
}

// Role interface is imported from API

const permissionCategories = [
  {
    id: 'servers',
    name: 'Servers & Nodes',
    icon: Server,
    permissions: [
      { id: 'nodes', name: 'Node Management', description: 'Manage server nodes' },
      { id: 'monitoring', name: 'Monitoring', description: 'View server metrics and alerts' },
    ],
  },
  {
    id: 'docker',
    name: 'Docker',
    icon: Container,
    permissions: [
      { id: 'containers', name: 'Containers', description: 'Manage Docker containers' },
      { id: 'images', name: 'Images', description: 'Manage Docker images' },
      { id: 'networks', name: 'Networks', description: 'Manage Docker networks' },
      { id: 'volumes', name: 'Volumes', description: 'Manage Docker volumes' },
      { id: 'compose', name: 'Compose', description: 'Manage Docker Compose stacks' },
    ],
  },
  {
    id: 'k8s',
    name: 'Kubernetes',
    icon: Cloud,
    permissions: [
      { id: 'clusters', name: 'Clusters', description: 'Manage K8s clusters' },
      { id: 'workloads', name: 'Workloads', description: 'Manage deployments and pods' },
      { id: 'services', name: 'Services', description: 'Manage services and ingress' },
      { id: 'config', name: 'Config', description: 'Manage ConfigMaps and Secrets' },
      { id: 'storage', name: 'Storage', description: 'Manage PV and PVC' },
    ],
  },
  {
    id: 'nginx',
    name: 'Nginx',
    icon: Globe,
    permissions: [
      { id: 'sites', name: 'Sites', description: 'Manage Nginx sites' },
      { id: 'certificates', name: 'Certificates', description: 'Manage SSL certificates' },
      { id: 'logs', name: 'Logs', description: 'View Nginx logs' },
    ],
  },
  {
    id: 'database',
    name: 'Database',
    icon: Database,
    permissions: [
      { id: 'servers', name: 'DB Servers', description: 'Manage database servers' },
      { id: 'backups', name: 'Backups', description: 'Manage database backups' },
    ],
  },
  {
    id: 'files',
    name: 'File Manager',
    icon: FolderOpen,
    permissions: [
      { id: 'browse', name: 'Browse', description: 'Browse files' },
      { id: 'edit', name: 'Edit', description: 'Edit files' },
      { id: 'upload', name: 'Upload', description: 'Upload files' },
    ],
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: Terminal,
    permissions: [
      { id: 'access', name: 'Terminal Access', description: 'Access web terminal' },
      { id: 'ssh', name: 'SSH', description: 'SSH to servers' },
    ],
  },
  {
    id: 'cron',
    name: 'Cron Jobs',
    icon: Clock,
    permissions: [
      { id: 'jobs', name: 'Jobs', description: 'Manage cron jobs' },
    ],
  },
  {
    id: 'plugins',
    name: 'Plugins',
    icon: Puzzle,
    permissions: [
      { id: 'installed', name: 'Installed', description: 'Manage installed plugins' },
      { id: 'market', name: 'Market', description: 'Access plugin market' },
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    permissions: [
      { id: 'users', name: 'Users', description: 'Manage users' },
      { id: 'roles', name: 'Roles', description: 'Manage roles' },
      { id: 'teams', name: 'Teams', description: 'Manage teams' },
      { id: 'system', name: 'System', description: 'System settings' },
    ],
  },
  {
    id: 'logs',
    name: 'Logs',
    icon: FileText,
    permissions: [
      { id: 'audit', name: 'Audit Logs', description: 'View audit logs' },
    ],
  },
];

// Roles are loaded from API

function RoleCard({ 
  role, 
  onEdit, 
  onDelete 
}: { 
  role: Role; 
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  const isSystemRole = role.type === 'system';
  const RoleIcon = isSystemRole ? ShieldCheck : Shield;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-xl border p-5 transition-all',
          isLight ? 'bg-white border-gray-200 hover:shadow-md' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isSystemRole ? 'bg-purple-500/10' : 'bg-blue-500/10'
            )}>
              <RoleIcon className={cn('w-5 h-5', isSystemRole ? 'text-purple-500' : 'text-blue-500')} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>{role.name}</h3>
                {isSystemRole && <Badge variant="gray" className="text-xs">System</Badge>}
              </div>
              <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>{role.description}</p>
            </div>
          </div>
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
            <DropdownItem icon={<Edit className="w-4 h-4" />} onClick={onEdit}>
              {isSystemRole ? 'View' : 'Edit'}
            </DropdownItem>
            <DropdownItem icon={<Copy className="w-4 h-4" />}>Duplicate</DropdownItem>
            <DropdownItem icon={<Users className="w-4 h-4" />}>View Users</DropdownItem>
            {!isSystemRole && (
              <>
                <DropdownDivider />
                <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onClick={() => setShowDelete(true)}>
                  Delete
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Users className={cn('w-4 h-4', isLight ? 'text-gray-400' : 'text-gray-500')} />
            <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>{role.userCount} users</span>
          </div>
          <div className={cn('text-xs', isLight ? 'text-gray-400' : 'text-gray-500')}>
            Updated {new Date(role.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </motion.div>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          setShowDelete(false);
          onDelete();
        }}
        type="danger"
        title="Delete Role"
        message={`Are you sure you want to delete "${role.name}"? Users with this role will be assigned to Viewer role.`}
        confirmText="Delete"
      />
    </>
  );
}

function RoleEditor({ 
  role, 
  readOnly, 
  onClose,
  onSave 
}: { 
  role?: Role; 
  readOnly?: boolean; 
  onClose: () => void;
  onSave?: (roleData: { name: string; description: string; permissions: { [key: string]: ('read' | 'write' | 'delete' | 'admin')[] } }) => void;
}) {
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  const [expandedCategories, setExpandedCategories] = useState<string[]>(permissionCategories.map(c => c.id));
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [permissions, setPermissions] = useState<{ [key: string]: ('read' | 'write' | 'delete' | 'admin')[] }>(role?.permissions || {});
  const [saving, setSaving] = useState(false);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const togglePermission = (categoryId: string, permissionId: string, action: 'read' | 'write' | 'delete' | 'admin') => {
    if (readOnly) return;
    
    const key = `${categoryId}.${permissionId}`;
    const wildcardKey = `${categoryId}.*`;
    const allKey = '*';
    
    setPermissions(prev => {
      const newPerms = { ...prev };
      
      // Check if wildcard or all permissions exist
      const hasWildcard = newPerms[wildcardKey]?.includes(action);
      const hasAll = newPerms[allKey]?.includes(action);
      const hasSpecific = newPerms[key]?.includes(action);
      
      if (hasAll || hasWildcard || hasSpecific) {
        // Remove permission
        if (newPerms[key]) {
          newPerms[key] = newPerms[key].filter(a => a !== action);
          if (newPerms[key].length === 0) delete newPerms[key];
        }
        if (newPerms[wildcardKey]) {
          newPerms[wildcardKey] = newPerms[wildcardKey].filter(a => a !== action);
          if (newPerms[wildcardKey].length === 0) delete newPerms[wildcardKey];
        }
        if (newPerms[allKey]) {
          newPerms[allKey] = newPerms[allKey].filter(a => a !== action);
          if (newPerms[allKey].length === 0) delete newPerms[allKey];
        }
      } else {
        // Add permission
        if (!newPerms[key]) {
          newPerms[key] = [];
        }
        if (!newPerms[key].includes(action)) {
          newPerms[key].push(action);
        }
      }
      
      return newPerms;
    });
  };

  const hasPermission = (categoryId: string, permissionId: string, action: 'read' | 'write' | 'delete' | 'admin'): boolean => {
    const key = `${categoryId}.${permissionId}`;
    const wildcardKey = `${categoryId}.*`;
    const allKey = '*';
    
    return !!(
      permissions[allKey]?.includes(action) ||
      permissions[wildcardKey]?.includes(action) ||
      permissions[key]?.includes(action)
    );
  };

  const handleSave = async () => {
    if (!onSave || readOnly) return;
    try {
      setSaving(true);
      await onSave({ name, description, permissions });
      onClose();
    } catch (error) {
      console.error('Failed to save role:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Role Name
            </label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter role name" 
              disabled={saving}
            />
          </div>
          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Description
            </label>
            <Input 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description" 
              disabled={saving}
            />
          </div>
        </div>
      )}

      <div>
        <h4 className={cn('font-medium mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>Permissions</h4>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {permissionCategories.map((category) => {
            const CategoryIcon = category.icon;
            const isExpanded = expandedCategories.includes(category.id);

            return (
              <div
                key={category.id}
                className={cn(
                  'rounded-lg border',
                  isLight ? 'border-gray-200' : 'border-gray-700'
                )}
              >
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 text-left',
                    isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-800'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon className={cn('w-5 h-5', isLight ? 'text-gray-500' : 'text-gray-400')} />
                    <span className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
                      {category.name}
                    </span>
                  </div>
                  <span className={cn(
                    'transform transition-transform',
                    isExpanded ? 'rotate-180' : ''
                  )}>▼</span>
                </button>

                {isExpanded && (
                  <div className={cn('px-4 pb-3 pt-1 border-t', isLight ? 'border-gray-100' : 'border-gray-700')}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={isLight ? 'text-gray-500' : 'text-gray-400'}>
                          <th className="text-left py-2 font-medium">Permission</th>
                          <th className="text-center py-2 font-medium w-16" title="Read">
                            <Eye className="w-4 h-4 mx-auto" />
                          </th>
                          <th className="text-center py-2 font-medium w-16" title="Write">
                            <Pencil className="w-4 h-4 mx-auto" />
                          </th>
                          <th className="text-center py-2 font-medium w-16" title="Delete">
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </th>
                          <th className="text-center py-2 font-medium w-16" title="Admin">
                            <Lock className="w-4 h-4 mx-auto" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.permissions.map((permission) => (
                          <tr key={permission.id} className={cn('border-t', isLight ? 'border-gray-100' : 'border-gray-700')}>
                            <td className="py-2">
                              <div>
                                <span className={isLight ? 'text-gray-900' : 'text-gray-100'}>{permission.name}</span>
                                <p className={cn('text-xs', isLight ? 'text-gray-400' : 'text-gray-500')}>
                                  {permission.description}
                                </p>
                              </div>
                            </td>
                            {['read', 'write', 'delete', 'admin'].map((action) => (
                              <td key={action} className="text-center py-2">
                                <input
                                  type="checkbox"
                                  disabled={readOnly || saving}
                                  checked={hasPermission(category.id, permission.id, action as any)}
                                  onChange={() => togglePermission(category.id, permission.id, action as any)}
                                  className="rounded"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={cn(
        'flex justify-end gap-3 pt-4 border-t',
        isLight ? 'border-gray-200' : 'border-gray-700'
      )}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
        {!readOnly && (
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Role'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  // Load roles
  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    try {
      setLoading(true);
      setError(null);
      const data = await rolesApi.listRoles();
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  const systemRoles = filteredRoles.filter(r => r.type === 'system');
  const customRoles = filteredRoles.filter(r => r.type === 'custom');

  // Handle create role
  async function handleCreateRole(roleData: { name: string; description: string; permissions: { [key: string]: ('read' | 'write' | 'delete' | 'admin')[] } }) {
    try {
      setError(null);
      // TODO: Implement when backend supports custom roles
      await rolesApi.createRole(roleData);
      await loadRoles();
      setShowCreate(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create role';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        throw err;
      }
    }
  }

  // Handle edit role
  function handleEditClick(role: Role) {
    setEditingRole(role);
    setShowEdit(true);
  }

  async function handleUpdateRole(roleData: { name: string; description: string; permissions: { [key: string]: ('read' | 'write' | 'delete' | 'admin')[] } }) {
    if (!editingRole) return;
    try {
      setError(null);
      // TODO: Implement when backend supports role updates
      await rolesApi.updateRole(editingRole.id, roleData);
      await loadRoles();
      setShowEdit(false);
      setEditingRole(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        throw err;
      }
    }
  }

  // Handle delete role
  async function handleDeleteRole(role: Role) {
    try {
      setError(null);
      // TODO: Implement when backend supports role deletion
      await rolesApi.deleteRole(role.id);
      await loadRoles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete role';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        console.error('Failed to delete role:', err);
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>Role Management</h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Define roles and permissions for your organization</p>
        </div>
        <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
          Create Role
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={cn(
          'mb-4 p-4 rounded-lg flex items-center gap-2',
          isLight ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-yellow-900/20 text-yellow-400 border border-yellow-800'
        )}>
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className={cn('ml-auto text-sm underline')}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6 max-w-md">
        <SearchInput
          placeholder="Search roles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* System Roles */}
      <div className="mb-8">
        <h2 className={cn('text-lg font-semibold mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
          System Roles
        </h2>
        {loading ? (
          <Card padding>
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemRoles.map((role) => (
              <RoleCard 
                key={role.id} 
                role={role}
                onEdit={() => handleEditClick(role)}
                onDelete={() => handleDeleteRole(role)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Custom Roles */}
      <div>
        <h2 className={cn('text-lg font-semibold mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
          Custom Roles
        </h2>
        {loading ? (
          <Card padding>
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          </Card>
        ) : customRoles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customRoles.map((role) => (
              <RoleCard 
                key={role.id} 
                role={role}
                onEdit={() => handleEditClick(role)}
                onDelete={() => handleDeleteRole(role)}
              />
            ))}
          </div>
        ) : (
          <Card padding>
            <Empty
              icon={<Shield className="w-8 h-8" />}
              title="No custom roles"
              description="Create custom roles to define specific permissions. Note: Custom roles require backend support."
              action={
                <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
                  Create Role
                </Button>
              }
            />
          </Card>
        )}
      </div>

      {/* Create Role Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Role" size="xl">
        <RoleEditor 
          onClose={() => setShowCreate(false)}
          onSave={handleCreateRole}
        />
      </Modal>

      {/* Edit Role Modal */}
      <Modal 
        open={showEdit} 
        onClose={() => {
          setShowEdit(false);
          setEditingRole(null);
        }} 
        title={`${editingRole?.type === 'system' ? 'View' : 'Edit'} Role: ${editingRole?.name || ''}`} 
        size="xl"
      >
        <RoleEditor 
          role={editingRole || undefined}
          readOnly={editingRole?.type === 'system'}
          onClose={() => {
            setShowEdit(false);
            setEditingRole(null);
          }}
          onSave={handleUpdateRole}
        />
      </Modal>
    </div>
  );
}

