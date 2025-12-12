import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  User,
  Users,
  MoreVertical,
  Trash2,
  Edit,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  UserCog,
  Activity,
  Send,
  AlertCircle,
  Loader2,
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
  Tabs,
  Tab,
  Input,
  Avatar,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import * as usersApi from '@/api/users';
import type { User as ApiUser } from '@/api/users';

type UserStatus = 'active' | 'inactive' | 'locked' | 'pending';
type UserRole = 'super_admin' | 'admin' | 'operator' | 'viewer' | 'custom' | 'user';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  teams: string[];
  status: UserStatus;
  mfaEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
  createdBy: string;
  permissions: string[];
}

// Helper function to format time ago
function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

// Map API user to frontend UserAccount
function mapApiUserToAccount(apiUser: ApiUser): UserAccount {
  return {
    id: apiUser.id,
    name: apiUser.display_name || apiUser.username,
    email: apiUser.email,
    avatar: apiUser.avatar,
    role: (apiUser.role as UserRole) || 'user',
    teams: [], // Backend doesn't have teams yet
    status: apiUser.status,
    mfaEnabled: apiUser.mfa_enabled,
    lastLogin: formatTimeAgo(apiUser.last_login_at),
    createdAt: apiUser.created_at,
    createdBy: 'System', // Backend doesn't track creator
    permissions: apiUser.permissions || [],
  };
}

const roleConfig: Record<UserRole, { label: string; color: string; icon: React.ElementType }> = {
  super_admin: { label: 'Super Admin', color: 'bg-red-500/10 text-red-500', icon: ShieldAlert },
  admin: { label: 'Admin', color: 'bg-purple-500/10 text-purple-500', icon: ShieldCheck },
  operator: { label: 'Operator', color: 'bg-blue-500/10 text-blue-500', icon: Shield },
  viewer: { label: 'Viewer', color: 'bg-gray-500/10 text-gray-500', icon: User },
  user: { label: 'User', color: 'bg-green-500/10 text-green-500', icon: User },
  custom: { label: 'Custom', color: 'bg-amber-500/10 text-amber-500', icon: UserCog },
};

const statusConfig: Record<UserStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'text-green-500', icon: CheckCircle },
  inactive: { label: 'Inactive', color: 'text-gray-500', icon: XCircle },
  locked: { label: 'Locked', color: 'text-red-500', icon: Lock },
  pending: { label: 'Pending', color: 'text-amber-500', icon: Clock },
};

function UserRow({ 
  user, 
  onEdit, 
  onDelete, 
  onLock, 
  onUnlock 
}: { 
  user: UserAccount; 
  onEdit: () => void;
  onDelete: () => void;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  const role = roleConfig[user.role] || roleConfig.viewer;
  const status = statusConfig[user.status];
  const RoleIcon = role.icon;
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
            <Avatar name={user.name} size="md" />
            <div>
              <p className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>{user.name}</p>
              <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>{user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge className={role.color}>
            <RoleIcon className="w-3 h-3 mr-1" />
            {role.label}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {user.teams.length > 0 ? (
              user.teams.map((team) => (
                <Badge key={team} variant="gray" className="text-xs">{team}</Badge>
              ))
            ) : (
              <span className={cn('text-sm', isLight ? 'text-gray-400' : 'text-gray-500')}>No teams</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('w-4 h-4', status.color)} />
            <span className={cn('text-sm', status.color)}>{status.label}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {user.mfaEnabled ? (
            <Badge variant="success" className="text-xs">
              <Shield className="w-3 h-3 mr-1" /> MFA
            </Badge>
          ) : (
            <Badge variant="gray" className="text-xs">No MFA</Badge>
          )}
        </td>
        <td className={cn('px-4 py-3 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
          {user.lastLogin || 'Never'}
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
            <DropdownItem icon={<Edit className="w-4 h-4" />} onClick={onEdit}>Edit</DropdownItem>
            <DropdownItem icon={<Key className="w-4 h-4" />}>Reset Password</DropdownItem>
            <DropdownItem icon={<Shield className="w-4 h-4" />}>Manage MFA</DropdownItem>
            <DropdownDivider />
            {user.status === 'locked' ? (
              <DropdownItem icon={<Unlock className="w-4 h-4" />} onClick={onUnlock}>Unlock Account</DropdownItem>
            ) : (
              <DropdownItem icon={<Lock className="w-4 h-4" />} onClick={onLock}>Lock Account</DropdownItem>
            )}
            <DropdownItem icon={<Activity className="w-4 h-4" />}>View Activity</DropdownItem>
            <DropdownDivider />
            <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onClick={() => setShowDelete(true)}>
              Delete User
            </DropdownItem>
          </Dropdown>
        </td>
      </motion.tr>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          setShowDelete(false);
          onDelete();
        }}
        type="danger"
        title="Delete User"
        message={`Are you sure you want to delete "${user.name}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<UserStatus | 'all'>('all');
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  // Form states
  const [inviteForm, setInviteForm] = useState({
    email: '',
    display_name: '',
    role: 'viewer' as UserRole,
    require_mfa: false,
  });
  const [editForm, setEditForm] = useState({
    display_name: '',
    email: '',
    role: 'user' as UserRole,
    status: 'active' as UserStatus,
  });
  const [submitting, setSubmitting] = useState(false);

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const apiUsers = await usersApi.listUsers();
      setUsers(apiUsers.map(mapApiUserToAccount));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    admins: users.filter((u) => u.role === 'admin' || u.role === 'super_admin').length,
    mfaEnabled: users.filter((u) => u.mfaEnabled).length,
  };

  // Handle invite user
  async function handleInvite() {
    try {
      setSubmitting(true);
      setError(null);
      await usersApi.createUser({
        email: inviteForm.email,
        username: inviteForm.email.split('@')[0], // Use email prefix as username
        password: Math.random().toString(36).slice(-12), // Generate random password
        display_name: inviteForm.display_name || inviteForm.email.split('@')[0],
        role: inviteForm.role,
      });
      setShowInvite(false);
      setInviteForm({ email: '', display_name: '', role: 'viewer', require_mfa: false });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle edit user
  function handleEditClick(user: UserAccount) {
    setEditingUser(user);
    setEditForm({
      display_name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setShowEdit(true);
  }

  async function handleUpdate() {
    if (!editingUser) return;
    try {
      setSubmitting(true);
      setError(null);
      await usersApi.updateUser(editingUser.id, {
        display_name: editForm.display_name,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
      });
      setShowEdit(false);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle delete user
  async function handleDelete(user: UserAccount) {
    try {
      setError(null);
      await usersApi.deleteUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  // Handle lock/unlock user
  async function handleLock(user: UserAccount) {
    try {
      setError(null);
      await usersApi.lockUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock user');
    }
  }

  async function handleUnlock(user: UserAccount) {
    try {
      setError(null);
      await usersApi.unlockUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock user');
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>User Management</h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Manage users, roles, and permissions</p>
        </div>
        <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowInvite(true)}>
          Invite User
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={cn(
          'mb-4 p-4 rounded-lg flex items-center gap-2',
          isLight ? 'bg-red-50 text-red-700' : 'bg-red-900/20 text-red-400'
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{stats.total}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Total Users</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{stats.active}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Active</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{stats.admins}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Admins</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>{stats.mfaEnabled}</p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>MFA Enabled</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
          className={cn(
            'px-3 py-2 rounded-lg text-sm border',
            isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-800 border-gray-700 text-gray-300'
          )}
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="operator">Operator</option>
          <option value="viewer">Viewer</option>
          <option value="custom">Custom</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as UserStatus | 'all')}
          className={cn(
            'px-3 py-2 rounded-lg text-sm border',
            isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-800 border-gray-700 text-gray-300'
          )}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="locked">Locked</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Users Table */}
      <Card>
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn(
                  'border-b text-left text-sm',
                  isLight ? 'border-gray-200 text-gray-600' : 'border-gray-700 text-gray-400'
                )}>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Teams</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">MFA</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <UserRow 
                    key={user.id} 
                    user={user} 
                    onEdit={() => handleEditClick(user)}
                    onDelete={() => handleDelete(user)}
                    onLock={() => handleLock(user)}
                    onUnlock={() => handleUnlock(user)}
                  />
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && !loading && (
              <div className="py-12">
                <Empty
                  icon={<Users className="w-8 h-8" />}
                  title="No users found"
                  description="Invite users or adjust your filters"
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Invite User Modal */}
      <Modal open={showInvite} onClose={() => !submitting && setShowInvite(false)} title="Invite User" size="md">
        <div className="space-y-4">
          <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            Create a new user account. A random password will be generated.
          </p>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Email Address *
            </label>
            <Input 
              type="email" 
              placeholder="user@example.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Full Name
            </label>
            <Input 
              placeholder="John Doe"
              value={inviteForm.display_name}
              onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Role
            </label>
            <select 
              className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm',
                isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
              )}
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
              disabled={submitting}
            >
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="require-mfa" 
              className="rounded"
              checked={inviteForm.require_mfa}
              onChange={(e) => setInviteForm({ ...inviteForm, require_mfa: e.target.checked })}
              disabled={submitting}
            />
            <label htmlFor="require-mfa" className={cn('text-sm', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Require MFA setup on first login
            </label>
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button 
              variant="secondary" 
              onClick={() => setShowInvite(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              onClick={handleInvite}
              disabled={submitting || !inviteForm.email}
            >
              {submitting ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={showEdit} onClose={() => !submitting && setShowEdit(false)} title="Edit User" size="lg">
        <div className="space-y-6">
          <Tabs>
            <Tab active>Profile</Tab>
            <Tab>Permissions</Tab>
            <Tab>Security</Tab>
            <Tab>Activity</Tab>
          </Tabs>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={editForm.display_name} size="xl" />
              <div>
                <Button variant="secondary" size="sm" disabled={submitting}>Change Avatar</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                  Full Name
                </label>
                <Input 
                  value={editForm.display_name}
                  onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                  Email
                </label>
                <Input 
                  type="email" 
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                  Role
                </label>
                <select 
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border text-sm',
                    isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
                  )}
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  disabled={submitting}
                >
                  <option value="user">User</option>
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                  Status
                </label>
                <select 
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border text-sm',
                    isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300'
                  )}
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UserStatus })}
                  disabled={submitting}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="locked">Locked</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button 
              variant="secondary" 
              onClick={() => setShowEdit(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
