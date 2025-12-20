import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Shield,
  ShieldCheck,
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  Users,
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
  Loader2,
  AlertCircle,
  CheckCircle2,
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
  PermissionGuard,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import * as rolesApi from '@/api/roles';
import type { Role, Permission } from '@/api/roles';

// Permission categories for UI display
const permissionCategories = [
  {
    id: 'sites',
    name: 'Sites & Apps',
    icon: Globe,
    description: 'Manage websites and applications',
  },
  {
    id: 'docker',
    name: 'Docker',
    icon: Container,
    description: 'Container management',
  },
  {
    id: 'database',
    name: 'Database',
    icon: Database,
    description: 'Database servers and backups',
  },
  {
    id: 'files',
    name: 'File Manager',
    icon: FolderOpen,
    description: 'File system access',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: Terminal,
    description: 'Command line access',
  },
  {
    id: 'cron',
    name: 'Cron Jobs',
    icon: Clock,
    description: 'Scheduled tasks',
  },
  {
    id: 'firewall',
    name: 'Firewall',
    icon: Shield,
    description: 'Network security',
  },
  {
    id: 'monitor',
    name: 'Monitoring',
    icon: Server,
    description: 'System monitoring',
  },
  {
    id: 'users',
    name: 'Users & Roles',
    icon: Users,
    description: 'User management',
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    description: 'System settings',
  },
  {
    id: 'plugins',
    name: 'Plugins',
    icon: Puzzle,
    description: 'Plugin management',
  },
  {
    id: 'audit',
    name: 'Audit Logs',
    icon: FileText,
    description: 'Activity logs',
  },
];

function RoleCard({ 
  role, 
  onEdit, 
  onDelete,
  onViewUsers,
}: { 
  role: Role; 
  onEdit: () => void;
  onDelete: () => void;
  onViewUsers: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  const isSystemRole = role.is_system;
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
                <h3 className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {role.display_name || role.name}
                </h3>
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
            {!isSystemRole && (
              <DropdownItem icon={<Copy className="w-4 h-4" />}>Duplicate</DropdownItem>
            )}
            <DropdownItem icon={<Users className="w-4 h-4" />} onClick={onViewUsers}>
              View Users ({role.user_count || 0})
            </DropdownItem>
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
            <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>{role.user_count || 0} users</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className={cn('w-4 h-4', isLight ? 'text-gray-400' : 'text-gray-500')} />
            <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>
              {role.permissions?.includes('*') ? 'All permissions' : `${role.permissions?.length || 0} permissions`}
            </span>
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
        message={`Are you sure you want to delete "${role.display_name || role.name}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </>
  );
}

interface RoleEditorProps {
  role?: Role; 
  permissions: Permission[];
  readOnly?: boolean; 
  onClose: () => void;
  onSave?: (roleData: rolesApi.CreateRoleRequest | rolesApi.UpdateRoleRequest) => Promise<void>;
}

function RoleEditor({ role, permissions, readOnly, onClose, onSave }: RoleEditorProps) {
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  const [expandedCategories, setExpandedCategories] = useState<string[]>(permissionCategories.map(c => c.id));
  const [name, setName] = useState(role?.name || '');
  const [displayName, setDisplayName] = useState(role?.display_name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role?.permissions || []);
  const [priority, setPriority] = useState(role?.priority || 10);
  const [saving, setSaving] = useState(false);

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const togglePermission = (permissionName: string) => {
    if (readOnly) return;
    
    setSelectedPermissions(prev => {
      if (prev.includes(permissionName)) {
        return prev.filter(p => p !== permissionName);
      }
      return [...prev, permissionName];
    });
  };

  const toggleCategoryAll = (categoryId: string) => {
    if (readOnly) return;
    
    const categoryPerms = permissionsByCategory[categoryId] || [];
    const categoryPermNames = categoryPerms.map(p => p.name);
    
    const allSelected = categoryPermNames.every(p => selectedPermissions.includes(p));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPermNames.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryPermNames])]);
    }
  };

  const handleSave = async () => {
    if (!onSave || readOnly) return;
    try {
      setSaving(true);
      if (role) {
        // Update existing role
        await onSave({
          display_name: displayName,
          description,
          permissions: selectedPermissions,
          priority,
        });
      } else {
        // Create new role
        await onSave({
          name,
          display_name: displayName || name,
          description,
          permissions: selectedPermissions,
          priority,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save role:', error);
    } finally {
      setSaving(false);
    }
  };

  const hasAllPermissions = selectedPermissions.includes('*');

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
            Role Name
          </label>
          <Input 
            value={role ? role.name : name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., developer" 
            disabled={saving || readOnly || !!role}
          />
          {!role && (
            <p className={cn('text-xs mt-1', isLight ? 'text-gray-500' : 'text-gray-400')}>
              Unique identifier (lowercase, no spaces)
            </p>
          )}
        </div>
        <div>
          <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
            Display Name
          </label>
          <Input 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g., Developer" 
            disabled={saving || readOnly}
          />
        </div>
      </div>

      <div>
        <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
          Description
        </label>
        <Input 
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this role" 
          disabled={saving || readOnly}
        />
      </div>

      {/* All Permissions Warning */}
      {hasAllPermissions && (
        <div className={cn(
          'flex items-center gap-2 p-3 rounded-lg',
          isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-900/20 text-amber-400'
        )}>
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">This role has full administrative access (all permissions).</span>
        </div>
      )}

      {/* Permissions */}
      <div>
        <h4 className={cn('font-medium mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>Permissions</h4>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {permissionCategories.map((category) => {
            const CategoryIcon = category.icon;
            const isExpanded = expandedCategories.includes(category.id);
            const categoryPerms = permissionsByCategory[category.id] || [];
            const selectedCount = categoryPerms.filter(p => selectedPermissions.includes(p.name)).length;
            const allSelected = categoryPerms.length > 0 && selectedCount === categoryPerms.length;

            if (categoryPerms.length === 0) return null;

            return (
              <div
                key={category.id}
                className={cn(
                  'rounded-lg border',
                  isLight ? 'border-gray-200' : 'border-gray-700'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-between px-4 py-3',
                    isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-800'
                  )}
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <CategoryIcon className={cn('w-5 h-5', isLight ? 'text-gray-500' : 'text-gray-400')} />
                    <div>
                      <span className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
                        {category.name}
                      </span>
                      <span className={cn('text-xs ml-2', isLight ? 'text-gray-500' : 'text-gray-400')}>
                        {selectedCount}/{categoryPerms.length}
                      </span>
                    </div>
                  </button>
                  
                  {!readOnly && !hasAllPermissions && (
                    <button
                      onClick={() => toggleCategoryAll(category.id)}
                      className={cn(
                        'text-xs px-2 py-1 rounded transition-colors mr-2',
                        allSelected
                          ? isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/30 text-blue-400'
                          : isLight ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      )}
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                  
                  <button onClick={() => toggleCategory(category.id)}>
                    <span className={cn(
                      'transform transition-transform text-sm',
                      isExpanded ? 'rotate-180' : ''
                    )}>▼</span>
                  </button>
                </div>

                {isExpanded && (
                  <div className={cn('px-4 pb-3 pt-1 border-t', isLight ? 'border-gray-100' : 'border-gray-700')}>
                    <div className="space-y-2">
                      {categoryPerms.map((perm) => {
                        const isSelected = hasAllPermissions || selectedPermissions.includes(perm.name);
                        return (
                          <label
                            key={perm.name}
                            className={cn(
                              'flex items-center gap-3 p-2 rounded cursor-pointer transition-colors',
                              readOnly || hasAllPermissions ? 'cursor-default' : '',
                              isSelected
                                ? isLight ? 'bg-blue-50' : 'bg-blue-900/20'
                                : isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-800'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={readOnly || saving || hasAllPermissions}
                              onChange={() => togglePermission(perm.name)}
                              className="rounded"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={cn('text-sm font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
                                  {perm.display_name}
                                </span>
                                <code className={cn('text-xs px-1 py-0.5 rounded', isLight ? 'bg-gray-100 text-gray-600' : 'bg-gray-700 text-gray-400')}>
                                  {perm.name}
                                </code>
                              </div>
                              {perm.description && (
                                <p className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
                                  {perm.description}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-blue-500" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className={cn(
        'flex justify-end gap-3 pt-4 border-t',
        isLight ? 'border-gray-200' : 'border-gray-700'
      )}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
        {!readOnly && (
          <Button onClick={handleSave} disabled={saving || (!role && !name.trim())}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              role ? 'Save Changes' : 'Create Role'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  // Load roles and permissions
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permsData] = await Promise.all([
        rolesApi.listRoles(),
        rolesApi.listPermissions(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredRoles = roles.filter((r) =>
    (r.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (r.display_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (r.description?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const systemRoles = filteredRoles.filter(r => r.is_system);
  const customRoles = filteredRoles.filter(r => !r.is_system);

  // Handle create role
  async function handleCreateRole(roleData: rolesApi.CreateRoleRequest) {
    try {
      setError(null);
      await rolesApi.createRole(roleData);
      setSuccess('Role created successfully');
      await loadData();
      setShowCreate(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create role';
      setError(errorMessage);
      throw err;
    }
  }

  // Handle edit role
  function handleEditClick(role: Role) {
    setEditingRole(role);
    setShowEdit(true);
  }

  async function handleUpdateRole(roleData: rolesApi.UpdateRoleRequest) {
    if (!editingRole) return;
    try {
      setError(null);
      await rolesApi.updateRole(editingRole.id, roleData);
      setSuccess('Role updated successfully');
      await loadData();
      setShowEdit(false);
      setEditingRole(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role';
      setError(errorMessage);
      throw err;
    }
  }

  // Handle delete role
  async function handleDeleteRole(role: Role) {
    try {
      setError(null);
      await rolesApi.deleteRole(role.id);
      setSuccess('Role deleted successfully');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete role';
      setError(errorMessage);
    }
  }

  // Handle view users
  function handleViewUsers(role: Role) {
    // Navigate to users page filtered by role
    window.location.href = `/settings/users?role=${role.name}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>Role Management</h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Define roles and permissions for your organization</p>
        </div>
        <PermissionGuard permission="users:write" fallback="hide">
          <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
            Create Role
          </Button>
        </PermissionGuard>
      </div>

      {/* Success Message */}
      {success && (
        <div className={cn(
          'mb-4 p-4 rounded-lg flex items-center gap-2',
          isLight ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-green-900/20 text-green-400 border border-green-800'
        )}>
          <CheckCircle2 className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={cn(
          'mb-4 p-4 rounded-lg flex items-center gap-2',
          isLight ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-900/20 text-red-400 border border-red-800'
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
          <span className={cn('text-sm font-normal ml-2', isLight ? 'text-gray-500' : 'text-gray-400')}>
            (Built-in roles that cannot be deleted)
          </span>
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
                onViewUsers={() => handleViewUsers(role)}
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
                onViewUsers={() => handleViewUsers(role)}
              />
            ))}
          </div>
        ) : (
          <Card padding>
            <Empty
              icon={<Shield className="w-8 h-8" />}
              title="No custom roles"
              description="Create custom roles to define specific permissions for your team members."
              action={
                <PermissionGuard permission="users:write" fallback="hide">
                  <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
                    Create Role
                  </Button>
                </PermissionGuard>
              }
            />
          </Card>
        )}
      </div>

      {/* Create Role Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Role" size="xl">
        <RoleEditor 
          permissions={permissions}
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
        title={`${editingRole?.is_system ? 'View' : 'Edit'} Role: ${editingRole?.display_name || editingRole?.name || ''}`} 
        size="xl"
      >
        <RoleEditor 
          role={editingRole || undefined}
          permissions={permissions}
          readOnly={editingRole?.is_system}
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
