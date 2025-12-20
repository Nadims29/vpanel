import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit,
  Shield,
  ShieldOff,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Download,
  Terminal,
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  Textarea,
  Switch,
  Empty,
  Spinner,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as firewallApi from '../api/firewall';
import type { FirewallRule, FirewallStatus, CreateFirewallRuleRequest, Fail2BanJail, Fail2BanStatus } from '../api/firewall';

function RuleRow({ rule, onEdit, onDelete, onToggle }: {
  rule: FirewallRule;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (rule: FirewallRule) => void;
  onToggle: (rule: FirewallRule) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  const actionColors: Record<string, 'success' | 'danger'> = {
    allow: 'success',
    deny: 'danger',
  };

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge variant={actionColors[rule.action]} className="min-w-[60px]">
              {rule.action === 'allow' ? '允许' : '拒绝'}
            </Badge>
            {!rule.enabled && (
              <span className="text-xs text-dark-500">(已禁用)</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm text-dark-100 font-medium">
            {rule.protocol.toUpperCase()}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm text-dark-100">
            {rule.port || <span className="text-dark-500">全部</span>}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm text-dark-100">
            {rule.direction === 'in' 
              ? (rule.source || <span className="text-dark-500">0.0.0.0/0</span>)
              : (rule.destination || <span className="text-dark-500">0.0.0.0/0</span>)
            }
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm text-dark-500">
            {rule.name}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.enabled}
              onChange={() => onToggle(rule)}
              size="sm"
            />
            <Dropdown
              trigger={
                <Button size="sm" variant="ghost" leftIcon={<MoreVertical className="w-4 h-4" />} />
              }
            >
              <DropdownItem onClick={() => onEdit(rule)}>
                <Edit className="w-4 h-4" />
                编辑
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem onClick={() => setShowDelete(true)} className="text-red-400">
                <Trash2 className="w-4 h-4" />
                删除
              </DropdownItem>
            </Dropdown>
          </div>
        </TableCell>
      </TableRow>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={async () => {
          await onDelete(rule);
          setShowDelete(false);
        }}
        type="danger"
        title="删除防火墙规则"
        message={`确定要删除规则 "${rule.name}" 吗？此操作无法撤销。`}
        confirmText="删除"
      />
    </>
  );
}

function RuleFormModal({ 
  open, 
  onClose, 
  rule, 
  onSubmit 
}: { 
  open: boolean; 
  onClose: () => void; 
  rule?: FirewallRule;
  onSubmit: (data: CreateFirewallRuleRequest) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateFirewallRuleRequest>({
    node_id: '1',
    name: '',
    direction: 'in',
    action: 'allow',
    protocol: 'tcp',
    port: '',
    source: '',
    destination: '',
    priority: 100,
    enabled: true,
    description: '',
  });

  useEffect(() => {
    if (rule) {
      setFormData({
        node_id: rule.node_id,
        name: rule.name,
        direction: rule.direction,
        action: rule.action,
        protocol: rule.protocol,
        port: rule.port || '',
        source: rule.source || '',
        destination: rule.destination || '',
        priority: rule.priority,
        enabled: rule.enabled,
        description: rule.description || '',
      });
    } else {
      setFormData({
        node_id: '1',
        name: '',
        direction: 'in',
        action: 'allow',
        protocol: 'tcp',
        port: '',
        source: '',
        destination: '',
        priority: 100,
        enabled: true,
        description: '',
      });
    }
  }, [rule, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rule ? '编辑规则' : '添加规则'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              策略 *
            </label>
            <Select
              value={formData.action}
              onChange={(e) => setFormData({ ...formData, action: e.target.value as 'allow' | 'deny' })}
              required
            >
              <option value="allow">允许</option>
              <option value="deny">拒绝</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              协议 *
            </label>
            <Select
              value={formData.protocol}
              onChange={(e) => setFormData({ ...formData, protocol: e.target.value as 'tcp' | 'udp' | 'icmp' | 'all' })}
              required
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="icmp">ICMP</option>
              <option value="all">全部</option>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            端口范围
          </label>
          <Input
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
            placeholder="留空表示全部端口，支持单个端口(22)、范围(80-90)、多个(22,80,443)"
          />
          <p className="text-xs text-dark-500 mt-1">
            留空表示全部端口，支持单个端口(22)、范围(80-90)、多个(22,80,443)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            {formData.direction === 'in' ? '授权对象' : '目标地址'}
          </label>
          <Input
            value={formData.direction === 'in' ? formData.source : formData.destination}
            onChange={(e) => {
              if (formData.direction === 'in') {
                setFormData({ ...formData, source: e.target.value });
              } else {
                setFormData({ ...formData, destination: e.target.value });
              }
            }}
            placeholder="留空或填写 0.0.0.0/0 表示所有地址，支持 CIDR 格式如 192.168.1.0/24"
          />
          <p className="text-xs text-dark-500 mt-1">
            留空或填写 0.0.0.0/0 表示所有地址，支持 CIDR 格式如 192.168.1.0/24
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            规则名称 *
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如：允许 SSH 访问"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            备注
          </label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="可选，用于描述此规则的用途"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Switch
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            label="立即启用"
          />
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" loading={loading}>
              {rule ? '保存' : '确定'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function FirewallRules() {
  const [status, setStatus] = useState<FirewallStatus | null>(null);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [jails, setJails] = useState<Fail2BanJail[]>([]);
  const [fail2banStatus, setFail2BanStatus] = useState<Fail2BanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | undefined>();
  const [directionTab, setDirectionTab] = useState<'in' | 'out'>('in');

  const nodeId = '1';

  // Fetch firewall status
  const fetchStatus = useCallback(async () => {
    try {
      const data = await firewallApi.getFirewallStatus(nodeId);
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch firewall status:', error);
    }
  }, [nodeId]);

  // Fetch rules
  const fetchRules = useCallback(async () => {
    try {
      const data = await firewallApi.listFirewallRules(nodeId);
      setRules(data || []);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch firewall rules');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [nodeId]);

  // Fetch Fail2Ban status and jails
  const fetchFail2Ban = useCallback(async () => {
    try {
      const statusData = await firewallApi.getFail2BanStatus(nodeId);
      setFail2BanStatus(statusData);
      
      // Only fetch jails if Fail2Ban is installed
      if (statusData.installed) {
        const jailsData = await firewallApi.listFail2BanJails(nodeId);
        setJails(jailsData || []);
      }
    } catch (error) {
      console.error('Failed to fetch Fail2Ban data:', error);
    }
  }, [nodeId]);

  useEffect(() => {
    if (nodeId) {
      fetchStatus();
      fetchRules();
      fetchFail2Ban();
    }
  }, [nodeId, fetchStatus, fetchRules, fetchFail2Ban]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStatus(), fetchRules(), fetchFail2Ban()]);
  };

  // Toggle firewall
  const handleToggleFirewall = async () => {
    if (!status) return;
    try {
      if (status.enabled) {
        await firewallApi.disableFirewall(nodeId);
        toast.success('防火墙已关闭');
      } else {
        await firewallApi.enableFirewall(nodeId);
        toast.success('防火墙已开启');
      }
      await fetchStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  // Create rule
  const handleCreateRule = async (data: CreateFirewallRuleRequest) => {
    // Set direction based on current tab
    const ruleData = { ...data, direction: directionTab };
    await firewallApi.createFirewallRule(ruleData);
    toast.success('规则创建成功');
    await fetchRules();
    await fetchStatus();
  };

  // Update rule
  const handleUpdateRule = async (data: CreateFirewallRuleRequest) => {
    if (!editingRule) return;
    await firewallApi.updateFirewallRule(editingRule.id, data);
    toast.success('规则更新成功');
    setEditingRule(undefined);
    await fetchRules();
    await fetchStatus();
  };

  // Delete rule
  const handleDeleteRule = async (rule: FirewallRule) => {
    try {
      await firewallApi.deleteFirewallRule(rule.id);
      toast.success('规则删除成功');
      await fetchRules();
      await fetchStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除规则失败');
    }
  };

  // Toggle rule
  const handleToggleRule = async (rule: FirewallRule) => {
    try {
      await firewallApi.updateFirewallRule(rule.id, { enabled: !rule.enabled });
      toast.success(`规则已${rule.enabled ? '禁用' : '启用'}`);
      await fetchRules();
      await fetchStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  // Filtered rules by direction
  const filteredRules = rules.filter((rule) => {
    const matchesDirection = rule.direction === directionTab;
    const matchesSearch = !search || 
      rule.name.toLowerCase().includes(search.toLowerCase()) ||
      rule.description?.toLowerCase().includes(search.toLowerCase()) ||
      rule.port?.toLowerCase().includes(search.toLowerCase()) ||
      rule.source?.toLowerCase().includes(search.toLowerCase()) ||
      rule.destination?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || 
      (filter === 'enabled' && rule.enabled) ||
      (filter === 'disabled' && !rule.enabled);
    return matchesDirection && matchesSearch && matchesFilter;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">防火墙规则</h1>
          <p className="page-subtitle">配置入站和出站规则，管理服务器访问控制</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            刷新
          </Button>
          {status && (
            <Button
              variant={status.enabled ? 'danger' : 'primary'}
              size="sm"
              leftIcon={status.enabled ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              onClick={handleToggleFirewall}
            >
              {status.enabled ? '关闭防火墙' : '开启防火墙'}
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-500">Firewall Status</p>
                <p className="text-2xl font-bold text-dark-100 mt-1">
                  {status.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              {status.enabled ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-dark-500" />
              )}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-500">Active Rules</p>
                <p className="text-2xl font-bold text-dark-100 mt-1">{status.activeRules}</p>
              </div>
              <Info className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-500">Blocked IPs</p>
                <p className="text-2xl font-bold text-dark-100 mt-1">{status.blockedIPs}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </Card>
        </div>
      )}

      <Tabs defaultValue="rules">
        <TabList>
          <Tab value="rules">Firewall Rules</Tab>
          <Tab value="fail2ban">Fail2Ban</Tab>
        </TabList>

        {/* Rules Tab */}
        <TabPanel value="rules">
          <div className="mt-6">
            <Card>
              <div className="p-4 border-b border-dark-700">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <SearchInput
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search rules..."
                      className="max-w-xs"
                    />
                    <Select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
                      className="w-40"
                    >
                      <option value="all">All Rules</option>
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </Select>
                  </div>
                  <Button
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create Rule
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <Spinner />
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="p-8">
                  <Empty
                    icon={<Shield className="w-12 h-12" />}
                    title="No Rules Found"
                    description={search || filter !== 'all' ? 'Try adjusting your filters' : 'Create your first firewall rule'}
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Direction</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Protocol / Port</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Destination</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Enabled</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {filteredRules.map((rule) => (
                        <RuleRow
                          key={rule.id}
                          rule={rule}
                          onEdit={setEditingRule}
                          onDelete={handleDeleteRule}
                          onToggle={handleToggleRule}
                        />
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </TabPanel>

        {/* Fail2Ban Tab */}
        <TabPanel value="fail2ban">
          <div className="mt-6">
            <Card>
              <div className="p-4 border-b border-dark-700">
                <h3 className="text-lg font-semibold text-dark-100">Fail2Ban Jails</h3>
                <p className="text-sm text-dark-500 mt-1">Manage IP bans and jail configurations</p>
              </div>
              {fail2banStatus && !fail2banStatus.installed ? (
                <div className="p-8">
                  <div className="flex flex-col items-center text-center max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                      <Download className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-dark-100 mb-2">Fail2Ban 未安装</h3>
                    <p className="text-sm text-dark-500 mb-6">
                      Fail2Ban 是一个入侵防御工具，可以自动封禁多次登录失败的 IP 地址。请先在服务器上安装 Fail2Ban。
                    </p>
                    <div className="w-full bg-dark-800 rounded-lg p-4 text-left">
                      <div className="flex items-center gap-2 text-xs text-dark-500 mb-2">
                        <Terminal className="w-4 h-4" />
                        <span>安装命令</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-dark-500 mb-1">Debian / Ubuntu:</p>
                          <code className="text-sm text-green-400 bg-dark-900 px-2 py-1 rounded block">
                            sudo apt install fail2ban -y
                          </code>
                        </div>
                        <div>
                          <p className="text-xs text-dark-500 mb-1">CentOS / RHEL:</p>
                          <code className="text-sm text-green-400 bg-dark-900 px-2 py-1 rounded block">
                            sudo yum install fail2ban -y
                          </code>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4"
                      leftIcon={<RefreshCw className="w-4 h-4" />}
                      onClick={handleRefresh}
                    >
                      重新检测
                    </Button>
                  </div>
                </div>
              ) : jails.length === 0 ? (
                <div className="p-8">
                  <Empty
                    icon={<Shield className="w-12 h-12" />}
                    title="No Jails Found"
                    description="Fail2Ban jails will appear here when configured"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell>Jail Name</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Banned IPs</TableCell>
                      <TableCell>Max Retry</TableCell>
                      <TableCell>Find Time</TableCell>
                      <TableCell>Ban Time</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jails.map((jail) => (
                      <TableRow key={jail.name}>
                        <TableCell>
                          <div className="font-medium text-dark-100">{jail.name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={jail.enabled ? 'success' : 'gray'}>
                            {jail.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-dark-300">{jail.bannedIPs}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-dark-300">{jail.maxRetry}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-dark-300">{jail.findTime}s</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-dark-300">{jail.banTime}s</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </TabPanel>
      </Tabs>

      {/* Create/Edit Modal */}
      <RuleFormModal
        open={showCreateModal || !!editingRule}
        onClose={() => {
          setShowCreateModal(false);
          setEditingRule(undefined);
        }}
        rule={editingRule}
        onSubmit={editingRule ? handleUpdateRule : handleCreateRule}
      />
    </div>
  );
}
