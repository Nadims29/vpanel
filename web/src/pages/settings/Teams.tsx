import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Users,
  Building2,
  MoreVertical,
  Trash2,
  Edit,
  UserPlus,
  UserMinus,
  Settings,
  Mail,
  Shield,
  Server,
  Container,
  Database,
  Globe,
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
  Avatar,
  Tabs,
  Tab,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import * as teamsApi from '@/api/teams';
import type { Team, TeamMember } from '@/api/teams';

// Types are imported from API

function TeamCard({ 
  team, 
  onEdit, 
  onDelete 
}: { 
  team: Team; 
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-xl border transition-all cursor-pointer hover:shadow-lg',
          isLight ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'
        )}
        onClick={onEdit}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl', team.color + '/20')}>
                {team.icon}
              </div>
              <div>
                <h3 className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>{team.name}</h3>
                <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>{team.description}</p>
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
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
                <DropdownItem icon={<UserPlus className="w-4 h-4" />}>Add Member</DropdownItem>
                <DropdownItem icon={<Settings className="w-4 h-4" />}>Settings</DropdownItem>
                <DropdownDivider />
                <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onClick={() => setShowDelete(true)}>
                  Delete Team
                </DropdownItem>
              </Dropdown>
            </div>
          </div>

          {/* Members Preview */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex -space-x-2">
              {team.members.slice(0, 4).map((member) => (
                <Avatar key={member.id} name={member.name} size="sm" className="border-2 border-white dark:border-gray-800" />
              ))}
              {team.members.length > 4 && (
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2',
                  isLight ? 'bg-gray-100 border-white text-gray-600' : 'bg-gray-700 border-gray-800 text-gray-300'
                )}>
                  +{team.members.length - 4}
                </div>
              )}
            </div>
            <span className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
              {team.members.length} member{team.members.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Resources */}
          <div className="flex flex-wrap gap-1">
            {team.resources.slice(0, 3).map((resource) => (
              <Badge key={resource} variant="gray" className="text-xs">{resource}</Badge>
            ))}
            {team.resources.length > 3 && (
              <Badge variant="gray" className="text-xs">+{team.resources.length - 3}</Badge>
            )}
          </div>
        </div>

        <div className={cn(
          'px-5 py-3 border-t text-xs',
          isLight ? 'border-gray-100 text-gray-500' : 'border-gray-700 text-gray-500'
        )}>
          Created {new Date(team.createdAt).toLocaleDateString()} by {team.createdBy}
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
        title="Delete Team"
        message={`Are you sure you want to delete "${team.name}"? This will remove all team associations.`}
        confirmText="Delete"
      />
    </>
  );
}

function TeamDetail({ 
  team, 
  onClose,
  onSave,
  onAddMember,
  onRemoveMember,
  onUpdateMemberRole
}: { 
  team: Team; 
  onClose: () => void;
  onSave?: (data: { name: string; description: string; icon: string; color: string }) => void;
  onAddMember?: (userId: string, role: 'Owner' | 'Admin' | 'Member') => void;
  onRemoveMember?: (userId: string) => void;
  onUpdateMemberRole?: (userId: string, role: 'Owner' | 'Admin' | 'Member') => void;
}) {
  const [activeTab, setActiveTab] = useState<'members' | 'resources' | 'settings'>('members');
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [icon, setIcon] = useState(team.icon);
  const [color, setColor] = useState(team.color);
  const [saving, setSaving] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  const handleSave = async () => {
    if (!onSave) return;
    try {
      setSaving(true);
      await onSave({ name, description, icon, color });
      onClose();
    } catch (error) {
      console.error('Failed to save team:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="flex items-center gap-4">
        <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center text-3xl', color + '/20')}>
          {icon}
        </div>
        <div className="flex-1">
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-semibold mb-1" 
            disabled={saving}
          />
          <Input 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            className="text-sm" 
            disabled={saving}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs>
        <Tab active={activeTab === 'members'} onClick={() => setActiveTab('members')}>
          Members ({team.members.length})
        </Tab>
        <Tab active={activeTab === 'resources'} onClick={() => setActiveTab('resources')}>
          Resources ({team.resources.length})
        </Tab>
        <Tab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          Settings
        </Tab>
      </Tabs>

      {/* Tab Content */}
      {activeTab === 'members' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Team Members</h4>
            <Button size="sm" leftIcon={<UserPlus className="w-4 h-4" />}>Add Member</Button>
          </div>
          <div className="space-y-2">
            {team.members.map((member) => (
              <div
                key={member.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  isLight ? 'bg-gray-50' : 'bg-gray-900/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} size="sm" />
                  <div>
                    <p className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>{member.name}</p>
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.role === 'Owner' ? 'primary' : 'gray'}>{member.role}</Badge>
                  <Dropdown
                    trigger={
                      <button className={cn(
                        'p-1 rounded transition-colors',
                        isLight ? 'hover:bg-gray-200' : 'hover:bg-gray-700'
                      )}>
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    }
                  >
                    <DropdownItem 
                      icon={<Shield className="w-4 h-4" />}
                      onClick={() => {
                        // TODO: Show role change modal
                        const newRole = member.role === 'Owner' ? 'Admin' : member.role === 'Admin' ? 'Member' : 'Owner';
                        onUpdateMemberRole?.(member.id, newRole);
                      }}
                    >
                      Change Role
                    </DropdownItem>
                    <DropdownItem icon={<Mail className="w-4 h-4" />}>Send Message</DropdownItem>
                    <DropdownDivider />
                    <DropdownItem 
                      icon={<UserMinus className="w-4 h-4" />} 
                      danger
                      onClick={() => onRemoveMember?.(member.id)}
                    >
                      Remove
                    </DropdownItem>
                  </Dropdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'resources' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Assigned Resources</h4>
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>Add Resource</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Server, label: 'Servers', count: 5 },
              { icon: Container, label: 'Containers', count: 12 },
              { icon: Database, label: 'Databases', count: 3 },
              { icon: Globe, label: 'Sites', count: 8 },
              // K8s Clusters management is available in VPanel Cloud (Enterprise Edition)
            ].map((resource) => (
              <div
                key={resource.label}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg',
                  isLight ? 'bg-gray-50' : 'bg-gray-900/50'
                )}
              >
                <resource.icon className={cn('w-5 h-5', isLight ? 'text-gray-500' : 'text-gray-400')} />
                <div>
                  <p className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>{resource.label}</p>
                  <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>{resource.count} assigned</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Team Icon
            </label>
            <div className="flex gap-2">
              {['🚀', '⚙️', '💻', '🧪', '🗄️', '🔧', '📊', '🛡️'].map((emoji) => (
                <button
                  key={emoji}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all',
                    icon === emoji
                      ? 'bg-blue-500/20 ring-2 ring-blue-500'
                      : isLight ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-800 hover:bg-gray-700'
                  )}
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Team Color
            </label>
            <div className="flex gap-2">
              {['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-pink-500', 'bg-cyan-500'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all cursor-pointer',
                    color,
                    team.color === color && 'ring-2 ring-offset-2 ring-gray-500'
                  )}
                  onClick={() => setColor(color)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" />
              <span className={cn('text-sm', isLight ? 'text-gray-700' : 'text-gray-300')}>
                Allow members to invite others
              </span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded" />
              <span className={cn('text-sm', isLight ? 'text-gray-700' : 'text-gray-300')}>
                Send notifications for team activities
              </span>
            </label>
          </div>
        </div>
      )}

      <div className={cn(
        'flex justify-end gap-3 pt-4 border-t',
        isLight ? 'border-gray-200' : 'border-gray-700'
      )}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? (
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
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    icon: '🚀',
    color: 'bg-blue-500',
  });
  const [submitting, setSubmitting] = useState(false);
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  // Load teams
  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    try {
      setLoading(true);
      setError(null);
      const data = await teamsApi.listTeams();
      setTeams(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load teams';
      setError(errorMessage);
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalMembers = teams.reduce((acc, team) => acc + team.members.length, 0);

  // Handle create team
  async function handleCreateTeam() {
    try {
      setSubmitting(true);
      setError(null);
      await teamsApi.createTeam(createForm);
      setShowCreate(false);
      setCreateForm({ name: '', description: '', icon: '🚀', color: 'bg-blue-500' });
      await loadTeams();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create team';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        console.error('Failed to create team:', err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Handle update team
  async function handleUpdateTeam(data: { name: string; description: string; icon: string; color: string }) {
    if (!selectedTeam) return;
    try {
      setError(null);
      await teamsApi.updateTeam(selectedTeam.id, data);
      await loadTeams();
      setSelectedTeam(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update team';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        throw err;
      }
    }
  }

  // Handle delete team
  async function handleDeleteTeam(team: Team) {
    try {
      setError(null);
      await teamsApi.deleteTeam(team.id);
      await loadTeams();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete team';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        console.error('Failed to delete team:', err);
      }
    }
  }

  // Handle add member
  async function handleAddMember(userId: string, role: 'Owner' | 'Admin' | 'Member' = 'Member') {
    if (!selectedTeam) return;
    try {
      setError(null);
      await teamsApi.addTeamMember(selectedTeam.id, { userId, role });
      await loadTeams();
      // Refresh selected team
      const updatedTeam = await teamsApi.getTeam(selectedTeam.id);
      setSelectedTeam(updatedTeam);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add member';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        console.error('Failed to add member:', err);
      }
    }
  }

  // Handle remove member
  async function handleRemoveMember(userId: string) {
    if (!selectedTeam) return;
    try {
      setError(null);
      await teamsApi.removeTeamMember(selectedTeam.id, userId);
      await loadTeams();
      // Refresh selected team
      const updatedTeam = await teamsApi.getTeam(selectedTeam.id);
      setSelectedTeam(updatedTeam);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        console.error('Failed to remove member:', err);
      }
    }
  }

  // Handle update member role
  async function handleUpdateMemberRole(userId: string, role: 'Owner' | 'Admin' | 'Member') {
    if (!selectedTeam) return;
    try {
      setError(null);
      await teamsApi.updateTeamMemberRole(selectedTeam.id, { userId, role });
      await loadTeams();
      // Refresh selected team
      const updatedTeam = await teamsApi.getTeam(selectedTeam.id);
      setSelectedTeam(updatedTeam);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update member role';
      setError(errorMessage);
      if (!errorMessage.includes('not yet supported')) {
        console.error('Failed to update member role:', err);
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>Team Management</h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Organize users into teams for better collaboration</p>
        </div>
        <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
          Create Team
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {loading ? '...' : teams.length}
            </p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Teams</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {loading ? '...' : totalMembers}
            </p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Total Members</p>
          </div>
        </Card>
        <Card padding className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Server className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
              {loading ? '...' : teams.reduce((acc, t) => acc + t.resources.length, 0)}
            </p>
            <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>Resource Assignments</p>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md">
        <SearchInput
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Teams Grid */}
      {loading ? (
        <Card padding>
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </Card>
      ) : filteredTeams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <TeamCard 
              key={team.id} 
              team={team} 
              onEdit={() => setSelectedTeam(team)}
              onDelete={() => handleDeleteTeam(team)}
            />
          ))}
        </div>
      ) : (
        <Card padding>
          <Empty
            icon={<Building2 className="w-8 h-8" />}
            title="No teams found"
            description="Create teams to organize your users. Note: Teams feature requires backend support."
            action={
              <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
                Create Team
              </Button>
            }
          />
        </Card>
      )}

      {/* Create Team Modal */}
      <Modal open={showCreate} onClose={() => !submitting && setShowCreate(false)} title="Create New Team" size="md">
        <div className="space-y-4">
          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Team Name *
            </label>
            <Input 
              placeholder="Enter team name"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Description
            </label>
            <Input 
              placeholder="Enter team description"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Team Icon
            </label>
            <div className="flex gap-2">
              {['🚀', '⚙️', '💻', '🧪', '🗄️', '🔧', '📊', '🛡️'].map((emoji) => (
                <button
                  key={emoji}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors',
                    createForm.icon === emoji
                      ? 'bg-blue-500/20 ring-2 ring-blue-500'
                      : isLight ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-800 hover:bg-gray-700'
                  )}
                  onClick={() => setCreateForm({ ...createForm, icon: emoji })}
                  disabled={submitting}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              Team Color
            </label>
            <div className="flex gap-2">
              {['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-pink-500', 'bg-cyan-500'].map((color) => (
                <button
                  key={color}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all cursor-pointer',
                    color,
                    createForm.color === color && 'ring-2 ring-offset-2 ring-gray-500'
                  )}
                  onClick={() => setCreateForm({ ...createForm, color })}
                  disabled={submitting}
                />
              ))}
            </div>
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button 
              variant="secondary" 
              onClick={() => setShowCreate(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTeam}
              disabled={submitting || !createForm.name.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Team'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Team Modal */}
      <Modal
        open={!!selectedTeam}
        onClose={() => setSelectedTeam(null)}
        title={`Edit Team: ${selectedTeam?.name}`}
        size="lg"
      >
        {selectedTeam && (
          <TeamDetail 
            team={selectedTeam} 
            onClose={() => setSelectedTeam(null)}
            onSave={handleUpdateTeam}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
            onUpdateMemberRole={handleUpdateMemberRole}
          />
        )}
      </Modal>
    </div>
  );
}

