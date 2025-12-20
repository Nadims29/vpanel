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
  Smartphone,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Crown,
  UserPlus,
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
  useProGuard,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import { useLicenseStore } from '@/stores/license';
import * as usersApi from '@/api/users';
import type { User as ApiUser, UserActivity, MFASetupResponse } from '@/api/users';

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
  onUnlock,
  onResetPassword,
  onManageMFA,
  onViewActivity
}: { 
  user: UserAccount; 
  onEdit: () => void;
  onDelete: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onResetPassword: () => void;
  onManageMFA: () => void;
  onViewActivity: () => void;
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
            <DropdownItem icon={<Key className="w-4 h-4" />} onClick={onResetPassword}>Reset Password</DropdownItem>
            <DropdownItem icon={<Shield className="w-4 h-4" />} onClick={onManageMFA}>Manage MFA</DropdownItem>
            <DropdownDivider />
            {user.status === 'locked' ? (
              <DropdownItem icon={<Unlock className="w-4 h-4" />} onClick={onUnlock}>Unlock Account</DropdownItem>
            ) : (
              <DropdownItem icon={<Lock className="w-4 h-4" />} onClick={onLock}>Lock Account</DropdownItem>
            )}
            <DropdownItem icon={<Activity className="w-4 h-4" />} onClick={onViewActivity}>View Activity</DropdownItem>
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
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<UserStatus | 'all'>('all');
  
  // MFA Management Modal
  const [showMFA, setShowMFA] = useState(false);
  const [mfaUser, setMfaUser] = useState<UserAccount | null>(null);
  const [mfaSetup, setMfaSetup] = useState<MFASetupResponse | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [copiedBackupCode, setCopiedBackupCode] = useState<string | null>(null);

  // Activity Modal
  const [showActivity, setShowActivity] = useState(false);
  const [activityUser, setActivityUser] = useState<UserAccount | null>(null);
  const [activityLogs, setActivityLogs] = useState<UserActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);

  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';
  
  // Pro license check
  const { checkPro, Modal: ProModal } = useProGuard();
  const isPro = useLicenseStore((state) => state.isPro());

  // Form states
  const [inviteForm, setInviteForm] = useState({
    email: '',
    display_name: '',
    role: 'viewer' as UserRole,
    require_mfa: false,
  });
  const [addUserForm, setAddUserForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    display_name: '',
    role: 'user' as UserRole,
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

  // Handle add user manually
  async function handleAddUser() {
    if (!addUserForm.username) {
      setError('Username is required');
      return;
    }
    if (!addUserForm.password) {
      setError('Password is required');
      return;
    }
    if (addUserForm.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (addUserForm.password !== addUserForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await usersApi.createUser({
        username: addUserForm.username,
        email: addUserForm.email || `${addUserForm.username}@local`,
        password: addUserForm.password,
        display_name: addUserForm.display_name || addUserForm.username,
        role: addUserForm.role,
      });
      setShowAddUser(false);
      setAddUserForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        display_name: '',
        role: 'user',
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
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

  // Handle reset password
  function handleResetPasswordClick(user: UserAccount) {
    setResettingPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowResetPassword(true);
  }

  async function handleResetPasswordConfirm() {
    if (!resettingPasswordUser) return;

    if (!newPassword) {
      setError('Password is required');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await usersApi.resetPassword(resettingPasswordUser.id, newPassword);
      setShowResetPassword(false);
      setResettingPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle manage MFA
  async function handleManageMFA(user: UserAccount) {
    setMfaUser(user);
    setMfaSetup(null);
    setShowMFA(true);
  }

  async function handleEnableMFA() {
    if (!mfaUser) return;
    try {
      setMfaLoading(true);
      setError(null);
      const setup = await usersApi.enableUserMFA(mfaUser.id);
      setMfaSetup(setup);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable MFA');
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleDisableMFA() {
    if (!mfaUser) return;
    try {
      setMfaLoading(true);
      setError(null);
      await usersApi.disableUserMFA(mfaUser.id);
      setShowMFA(false);
      setMfaUser(null);
      setMfaSetup(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleResetMFA() {
    if (!mfaUser) return;
    try {
      setMfaLoading(true);
      setError(null);
      const setup = await usersApi.resetUserMFA(mfaUser.id);
      setMfaSetup(setup);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset MFA');
    } finally {
      setMfaLoading(false);
    }
  }

  function copyBackupCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedBackupCode(code);
    setTimeout(() => setCopiedBackupCode(null), 2000);
  }

  // Handle view activity
  async function handleViewActivity(user: UserAccount) {
    setActivityUser(user);
    setActivityPage(1);
    setShowActivity(true);
    await loadUserActivity(user.id, 1);
  }

  async function loadUserActivity(userId: string, page: number) {
    try {
      setActivityLoading(true);
      const result = await usersApi.getUserActivity(userId, { page, page_size: 10 });
      setActivityLogs(result.logs || []);
      setActivityTotalPages(result.total_pages || 1);
    } catch (err) {
      console.error('Failed to load activity:', err);
      setActivityLogs([]);
    } finally {
      setActivityLoading(false);
    }
  }

  function handleActivityPageChange(newPage: number) {
    if (!activityUser) return;
    setActivityPage(newPage);
    loadUserActivity(activityUser.id, newPage);
  }

  function getActionColor(action: string): string {
    switch (action) {
      case 'create': return 'text-green-500';
      case 'update': return 'text-blue-500';
      case 'delete': return 'text-red-500';
      case 'view': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  }

  function getActionIcon(action: string) {
    switch (action) {
      case 'create': return <Plus className="w-4 h-4" />;
      case 'update': return <Edit className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  }

  function formatActivityTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
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
        <div className="flex items-center gap-2">
          <Button leftIcon={<UserPlus className="w-5 h-5" />} onClick={() => setShowAddUser(true)}>
            Add User
          </Button>
          <Button 
            variant="secondary" 
            leftIcon={<Send className="w-5 h-5" />} 
            onClick={() => {
              if (checkPro('invite_users')) {
                setShowInvite(true);
              }
            }}
            className="relative"
          >
            Invite User
            {!isPro && (
              <span className={cn(
                'ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium flex items-center gap-0.5',
                isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-900/30 text-amber-400'
              )}>
                <Crown className="w-3 h-3" />
                Pro
              </span>
            )}
          </Button>
        </div>
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
                    onResetPassword={() => handleResetPasswordClick(user)}
                    onManageMFA={() => handleManageMFA(user)}
                    onViewActivity={() => handleViewActivity(user)}
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

      {/* Add User Modal */}
      <Modal open={showAddUser} onClose={() => !submitting && setShowAddUser(false)} title="Add User" size="md">
        <div className="space-y-4">
          <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            Create a new user account with username and password.
          </p>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Username *
            </label>
            <Input 
              placeholder="username"
              value={addUserForm.username}
              onChange={(e) => setAddUserForm({ ...addUserForm, username: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Email Address
            </label>
            <Input 
              type="email" 
              placeholder="user@example.com (optional)"
              value={addUserForm.email}
              onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Display Name
            </label>
            <Input 
              placeholder="John Doe"
              value={addUserForm.display_name}
              onChange={(e) => setAddUserForm({ ...addUserForm, display_name: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Password * <span className={cn('font-normal', isLight ? 'text-gray-400' : 'text-gray-500')}>(min. 8 characters)</span>
            </label>
            <Input 
              type="password"
              placeholder="Enter password"
              value={addUserForm.password}
              onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Confirm Password *
            </label>
            <Input 
              type="password"
              placeholder="Confirm password"
              value={addUserForm.confirmPassword}
              onChange={(e) => setAddUserForm({ ...addUserForm, confirmPassword: e.target.value })}
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
              value={addUserForm.role}
              onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value as UserRole })}
              disabled={submitting}
            >
              <option value="user">User</option>
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowAddUser(false);
                setAddUserForm({
                  username: '',
                  email: '',
                  password: '',
                  confirmPassword: '',
                  display_name: '',
                  role: 'user',
                });
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              onClick={handleAddUser}
              disabled={submitting || !addUserForm.username || !addUserForm.password}
            >
              {submitting ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite User Modal */}
      <Modal open={showInvite} onClose={() => !submitting && setShowInvite(false)} title="Invite User" size="md">
        <div className="space-y-4">
          <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            Send an invitation email to create a new user account. A random password will be generated and sent to the user.
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
              {submitting ? 'Sending...' : 'Send Invitation'}
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

      {/* Reset Password Modal */}
      <Modal 
        open={showResetPassword} 
        onClose={() => !submitting && setShowResetPassword(false)} 
        title="Reset Password" 
        size="md"
      >
        <div className="space-y-4">
          <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            Enter a new password for <strong>{resettingPasswordUser?.name}</strong>
          </p>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              New Password * <span className={cn('font-normal', isLight ? 'text-gray-400' : 'text-gray-500')}>(min. 8 characters)</span>
            </label>
            <Input 
              type="password" 
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Confirm Password *
            </label>
            <Input 
              type="password" 
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !submitting) {
                  handleResetPasswordConfirm();
                }
              }}
            />
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowResetPassword(false);
                setResettingPasswordUser(null);
                setNewPassword('');
                setConfirmPassword('');
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              onClick={handleResetPasswordConfirm}
              disabled={submitting || !newPassword || !confirmPassword}
            >
              {submitting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MFA Management Modal */}
      <Modal 
        open={showMFA} 
        onClose={() => !mfaLoading && setShowMFA(false)} 
        title="Manage MFA" 
        size="md"
      >
        <div className="space-y-4">
          {/* User Info Header */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg',
            isLight ? 'bg-gray-50' : 'bg-gray-800'
          )}>
            <Avatar name={mfaUser?.name || ''} size="md" />
            <div>
              <p className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
                {mfaUser?.name}
              </p>
              <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                {mfaUser?.email}
              </p>
            </div>
            <div className="ml-auto">
              {mfaUser?.mfaEnabled ? (
                <Badge variant="success">
                  <Shield className="w-3 h-3 mr-1" />
                  MFA Enabled
                </Badge>
              ) : (
                <Badge variant="gray">
                  <ShieldAlert className="w-3 h-3 mr-1" />
                  MFA Disabled
                </Badge>
              )}
            </div>
          </div>

          {/* MFA Setup Section */}
          {mfaSetup ? (
            <div className="space-y-4">
              <div className={cn(
                'p-4 rounded-lg border',
                isLight ? 'bg-green-50 border-green-200' : 'bg-green-900/20 border-green-800'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className={cn('font-medium', isLight ? 'text-green-700' : 'text-green-400')}>
                    MFA has been {mfaUser?.mfaEnabled ? 'reset' : 'enabled'}
                  </span>
                </div>
                <p className={cn('text-sm', isLight ? 'text-green-600' : 'text-green-300')}>
                  Share the following setup information with the user securely.
                </p>
              </div>

              {/* QR Code */}
              {mfaSetup.qr_code && (
                <div className="flex flex-col items-center gap-2">
                  <p className={cn('text-sm font-medium', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Scan QR Code with Authenticator App
                  </p>
                  <div className={cn(
                    'p-4 rounded-lg',
                    isLight ? 'bg-white border border-gray-200' : 'bg-gray-900 border border-gray-700'
                  )}>
                    <img 
                      src={mfaSetup.qr_code.startsWith('data:') ? mfaSetup.qr_code : `data:image/png;base64,${mfaSetup.qr_code}`} 
                      alt="MFA QR Code" 
                      className="w-40 h-40"
                    />
                  </div>
                </div>
              )}

              {/* Secret Key */}
              <div>
                <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                  Secret Key (for manual entry)
                </label>
                <div className={cn(
                  'flex items-center gap-2 p-2 rounded-lg font-mono text-sm',
                  isLight ? 'bg-gray-100' : 'bg-gray-800'
                )}>
                  <code className="flex-1 break-all">{mfaSetup.secret}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(mfaSetup.secret);
                      setCopiedBackupCode('secret');
                      setTimeout(() => setCopiedBackupCode(null), 2000);
                    }}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      isLight ? 'hover:bg-gray-200' : 'hover:bg-gray-700'
                    )}
                  >
                    {copiedBackupCode === 'secret' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Backup Codes */}
              {mfaSetup.backup_codes && mfaSetup.backup_codes.length > 0 && (
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
                    Backup Codes (store securely)
                  </label>
                  <div className={cn(
                    'grid grid-cols-2 gap-2 p-3 rounded-lg',
                    isLight ? 'bg-gray-100' : 'bg-gray-800'
                  )}>
                    {mfaSetup.backup_codes.map((code, index) => (
                      <div 
                        key={index}
                        className={cn(
                          'flex items-center justify-between p-2 rounded font-mono text-sm',
                          isLight ? 'bg-white' : 'bg-gray-900'
                        )}
                      >
                        <span>{code}</span>
                        <button
                          onClick={() => copyBackupCode(code)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
                          )}
                        >
                          {copiedBackupCode === code ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                {mfaUser?.mfaEnabled 
                  ? 'MFA is currently enabled for this user. You can disable or reset it below.'
                  : 'MFA is not enabled for this user. Enable it to add an extra layer of security.'
                }
              </p>

              <div className={cn(
                'p-4 rounded-lg',
                isLight ? 'bg-blue-50' : 'bg-blue-900/20'
              )}>
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className={cn('font-medium text-sm', isLight ? 'text-blue-700' : 'text-blue-400')}>
                      Two-Factor Authentication
                    </p>
                    <p className={cn('text-sm mt-1', isLight ? 'text-blue-600' : 'text-blue-300')}>
                      Users will need to enter a code from their authenticator app (like Google Authenticator, Authy, or 1Password) when logging in.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowMFA(false);
                setMfaUser(null);
                setMfaSetup(null);
              }}
              disabled={mfaLoading}
            >
              Close
            </Button>
            
            {mfaUser?.mfaEnabled ? (
              <>
                <Button
                  variant="secondary"
                  leftIcon={mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  onClick={handleResetMFA}
                  disabled={mfaLoading}
                >
                  Reset MFA
                </Button>
                <Button
                  variant="danger"
                  leftIcon={mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  onClick={handleDisableMFA}
                  disabled={mfaLoading}
                >
                  Disable MFA
                </Button>
              </>
            ) : !mfaSetup && (
              <Button
                leftIcon={mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                onClick={handleEnableMFA}
                disabled={mfaLoading}
              >
                Enable MFA
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Activity Log Modal */}
      <Modal 
        open={showActivity} 
        onClose={() => setShowActivity(false)} 
        title="User Activity" 
        size="lg"
      >
        <div className="space-y-4">
          {/* User Info Header */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg',
            isLight ? 'bg-gray-50' : 'bg-gray-800'
          )}>
            <Avatar name={activityUser?.name || ''} size="md" />
            <div>
              <p className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
                {activityUser?.name}
              </p>
              <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                Last login: {activityUser?.lastLogin || 'Never'}
              </p>
            </div>
          </div>

          {/* Activity List */}
          <div className={cn(
            'border rounded-lg overflow-hidden',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            {activityLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="py-12">
                <Empty
                  icon={<Activity className="w-6 h-6" />}
                  title="No activity found"
                  description="This user has no recorded activity yet"
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {activityLogs.map((log) => (
                  <div 
                    key={log.id}
                    className={cn(
                      'p-3 flex items-start gap-3',
                      isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-800/50'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      log.status === 'success' 
                        ? (isLight ? 'bg-green-100' : 'bg-green-900/30')
                        : (isLight ? 'bg-red-100' : 'bg-red-900/30')
                    )}>
                      <span className={getActionColor(log.action)}>
                        {getActionIcon(log.action)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-medium capitalize', isLight ? 'text-gray-900' : 'text-gray-100')}>
                          {log.action}
                        </span>
                        <span className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                          {log.resource}
                        </span>
                        {log.status === 'failed' && (
                          <Badge variant="danger" className="text-xs">Failed</Badge>
                        )}
                      </div>
                      <div className={cn(
                        'flex items-center gap-3 mt-1 text-xs',
                        isLight ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatActivityTime(log.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {log.ip_address}
                        </span>
                        {log.user_agent && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <Monitor className="w-3 h-3" />
                            {log.user_agent.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {activityTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                Page {activityPage} of {activityTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                  onClick={() => handleActivityPageChange(activityPage - 1)}
                  disabled={activityPage <= 1 || activityLoading}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  onClick={() => handleActivityPageChange(activityPage + 1)}
                  disabled={activityPage >= activityTotalPages || activityLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <div className={cn(
            'flex justify-end pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowActivity(false);
                setActivityUser(null);
                setActivityLogs([]);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pro Upgrade Modal */}
      <ProModal featureName="Email Invitations" />
    </div>
  );
}
