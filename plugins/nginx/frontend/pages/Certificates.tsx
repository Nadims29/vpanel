import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Shield,
  MoreVertical,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
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
  Switch,
  Spinner,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as nginxApi from '../api/nginx';
import type { NginxStatus, SSLCertificate } from '../api/nginx';

interface Certificate extends SSLCertificate {
  daysUntilExpiry: number;
  status: 'valid' | 'expiring' | 'expired';
}

function CertificateCard({
  certificate,
  onRenew,
  onDelete,
}: {
  certificate: Certificate;
  onRenew: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  const statusColors = {
    valid: 'success',
    expiring: 'warning',
    expired: 'danger',
  } as const;

  const statusLabels = {
    valid: 'Valid',
    expiring: 'Expiring Soon',
    expired: 'Expired',
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = () => {
    switch (certificate.status) {
      case 'valid':
        return <CheckCircle className="w-4 h-4" />;
      case 'expiring':
        return <Clock className="w-4 h-4" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 hover:border-dark-600/50 transition-all"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                certificate.status === 'valid'
                  ? 'bg-green-500/20'
                  : certificate.status === 'expiring'
                  ? 'bg-yellow-500/20'
                  : 'bg-red-500/20'
              )}
            >
              <Shield
                className={cn(
                  'w-6 h-6',
                  certificate.status === 'valid'
                    ? 'text-green-400'
                    : certificate.status === 'expiring'
                    ? 'text-yellow-400'
                    : 'text-red-400'
                )}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-dark-100">{certificate.domain}</h3>
                <Badge variant={statusColors[certificate.status]} dot>
                  {getStatusIcon()}
                  <span className="ml-1">{statusLabels[certificate.status]}</span>
                </Badge>
              </div>
              <p className="text-sm text-dark-500 mt-1">
                {certificate.type === 'letsencrypt' ? 'Let\'s Encrypt' : 'Custom Certificate'}
              </p>
            </div>
          </div>
          <Dropdown
            trigger={
              <button className="p-1.5 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            }
          >
            {certificate.type === 'letsencrypt' && (
              <DropdownItem icon={<RefreshCw className="w-4 h-4" />} onClick={onRenew}>
                Renew Certificate
              </DropdownItem>
            )}
            <DropdownItem icon={<Download className="w-4 h-4" />}>Download</DropdownItem>
            <DropdownDivider />
            <DropdownItem icon={<Trash2 className="w-4 h-4" />} danger onClick={() => setShowDelete(true)}>
              Delete
            </DropdownItem>
          </Dropdown>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center justify-between">
            <span className="text-dark-500">Expires</span>
            <span className="text-dark-300 font-medium">{formatDate(certificate.expires_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-dark-500">Days Remaining</span>
            <span
              className={cn(
                'font-medium',
                certificate.daysUntilExpiry > 30
                  ? 'text-green-400'
                  : certificate.daysUntilExpiry > 7
                  ? 'text-yellow-400'
                  : 'text-red-400'
              )}
            >
              {certificate.daysUntilExpiry} days
            </span>
          </div>
          {certificate.last_renewed && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">Last Renewed</span>
              <span className="text-dark-300">{formatDate(certificate.last_renewed)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-dark-500">Auto Renew</span>
            <Badge variant={certificate.auto_renew ? 'success' : 'gray'}>
              {certificate.auto_renew ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          {certificate.cert_path && (
            <div className="flex items-center justify-between">
              <span className="text-dark-500">Certificate Path</span>
              <span className="text-dark-300 font-mono text-xs truncate max-w-[200px]" title={certificate.cert_path}>
                {certificate.cert_path}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Delete Confirm */}
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          onDelete();
          setShowDelete(false);
        }}
        type="danger"
        title="Delete Certificate"
        message={`Are you sure you want to delete the certificate for "${certificate.domain}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </>
  );
}

export default function NginxCertificates() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'letsencrypt' | 'custom'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'expiring' | 'expired'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createType, setCreateType] = useState<'letsencrypt' | 'custom'>('letsencrypt');
  const [nginxStatus, setNginxStatus] = useState<NginxStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Fetch nginx status
  const fetchStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const status = await nginxApi.getNginxStatus();
      setNginxStatus(status);
    } catch (error) {
      console.error('Failed to fetch nginx status:', error);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Form state for Let's Encrypt
  const [leDomain, setLeDomain] = useState('');
  const [leEmail, setLeEmail] = useState('');

  // Form state for Custom Certificate
  const [customDomain, setCustomDomain] = useState('');
  const [customCertPath, setCustomCertPath] = useState('');
  const [customKeyPath, setCustomKeyPath] = useState('');
  const [customChainPath, setCustomChainPath] = useState('');
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);

  const calculateCertificateStatus = (cert: SSLCertificate): Certificate => {
    const expiresAt = new Date(cert.expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'valid' | 'expiring' | 'expired' = 'valid';
    if (daysUntilExpiry < 0) {
      status = 'expired';
    } else if (daysUntilExpiry <= 30) {
      status = 'expiring';
    }

    return {
      ...cert,
      daysUntilExpiry,
      status,
    };
  };

  const fetchCertificates = useCallback(async () => {
    try {
      setLoading(true);
      const backendCerts = await nginxApi.listCertificates();
      const certsWithStatus = backendCerts.map(calculateCertificateStatus);
      setCertificates(certsWithStatus);
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch certificates');
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (nginxStatus?.installed) {
      fetchCertificates();
    }
  }, [fetchCertificates, nginxStatus?.installed]);

  const handleCreateLetsEncrypt = useCallback(async () => {
    if (!leDomain.trim()) {
      toast.error('Domain is required');
      return;
    }

    try {
      await nginxApi.createCertificate({
        domain: leDomain.trim(),
        type: 'letsencrypt',
        auto_renew: true,
      });
      toast.success('Certificate created successfully');
      setShowCreate(false);
      setLeDomain('');
      setLeEmail('');
      fetchCertificates();
    } catch (error) {
      console.error('Failed to create certificate:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create certificate');
    }
  }, [leDomain, fetchCertificates]);

  const handleCreateCustom = useCallback(async () => {
    if (!customDomain.trim() || !customCertPath.trim() || !customKeyPath.trim()) {
      toast.error('Domain, certificate path, and key path are required');
      return;
    }

    try {
      // Format expires_at date properly
      let expiresAt: string | undefined;
      if (customExpiresAt) {
        const date = new Date(customExpiresAt);
        expiresAt = date.toISOString();
      } else {
        // Default to 1 year from now
        expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      await nginxApi.createCertificate({
        domain: customDomain.trim(),
        type: 'custom',
        cert_path: customCertPath.trim(),
        key_path: customKeyPath.trim(),
        chain_path: customChainPath.trim() || undefined,
        expires_at: expiresAt,
        auto_renew: autoRenew,
      });
      toast.success('Certificate created successfully');
      setShowCreate(false);
      setCustomDomain('');
      setCustomCertPath('');
      setCustomKeyPath('');
      setCustomChainPath('');
      setCustomExpiresAt('');
      setAutoRenew(true);
      fetchCertificates();
    } catch (error) {
      console.error('Failed to create certificate:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create certificate');
    }
  }, [customDomain, customCertPath, customKeyPath, customChainPath, customExpiresAt, autoRenew, fetchCertificates]);

  const handleRenew = useCallback(
    async (id: string) => {
      try {
        await nginxApi.renewCertificate(id);
        toast.success('Certificate renewed successfully');
        fetchCertificates();
      } catch (error) {
        console.error('Failed to renew certificate:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to renew certificate');
      }
    },
    [fetchCertificates]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await nginxApi.deleteCertificate(id);
        toast.success('Certificate deleted successfully');
        fetchCertificates();
      } catch (error) {
        console.error('Failed to delete certificate:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to delete certificate');
      }
    },
    [fetchCertificates]
  );

  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch = cert.domain.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || cert.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || cert.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const validCount = certificates.filter((c) => c.status === 'valid').length;
  const expiringCount = certificates.filter((c) => c.status === 'expiring').length;
  const expiredCount = certificates.filter((c) => c.status === 'expired').length;

  // Show loading state while checking nginx status
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  // Show install prompt if nginx is not installed
  if (nginxStatus && !nginxStatus.installed) {
    const getInstallCommand = () => {
      switch (nginxStatus.os) {
        case 'darwin':
          return 'brew install nginx';
        case 'linux':
          return 'sudo apt install nginx  # 或 sudo yum install nginx';
        default:
          return 'brew install nginx';
      }
    };

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-dark-100">SSL Certificates</h1>
          <p className="text-dark-400">Manage SSL/TLS certificates for your domains</p>
        </div>
        <Card padding className="text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dark-100 mb-2">Nginx 未安装</h2>
              <p className="text-dark-400 max-w-md mx-auto mb-4">
                要管理 SSL 证书，您需要先安装 Nginx。请在终端中运行以下命令安装：
              </p>
              <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm text-dark-200 mb-4">
                <code>{getInstallCommand()}</code>
              </div>
              <Button variant="secondary" onClick={fetchStatus}>
                <RefreshCw className="w-4 h-4 mr-2" />
                重新检查
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dark-100">SSL Certificates</h1>
          <p className="text-dark-400">Manage SSL/TLS certificates for your domains</p>
        </div>
        <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
          Add Certificate
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-dark-100">{certificates.length}</p>
          <p className="text-sm text-dark-400">Total Certificates</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-green-400">{validCount}</p>
          <p className="text-sm text-dark-400">Valid</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-yellow-400">{expiringCount}</p>
          <p className="text-sm text-dark-400">Expiring Soon</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-3xl font-bold text-red-400">{expiredCount}</p>
          <p className="text-sm text-dark-400">Expired</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Search certificates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <Tabs defaultValue="all" onChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <TabList>
            <Tab value="all">All Types</Tab>
            <Tab value="letsencrypt">Let's Encrypt</Tab>
            <Tab value="custom">Custom</Tab>
          </TabList>
        </Tabs>
        <Tabs defaultValue="all" onChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <TabList>
            <Tab value="all">All Status</Tab>
            <Tab value="valid">Valid</Tab>
            <Tab value="expiring">Expiring</Tab>
            <Tab value="expired">Expired</Tab>
          </TabList>
        </Tabs>
      </div>

      {/* Certificates Grid */}
      {loading ? (
        <Card padding className="text-center py-12">
          <Spinner className="mx-auto mb-4" />
          <p className="text-dark-400">Loading certificates...</p>
        </Card>
      ) : filteredCertificates.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredCertificates.map((certificate) => (
              <CertificateCard
                key={certificate.id}
                certificate={certificate}
                onRenew={() => handleRenew(certificate.id)}
                onDelete={() => handleDelete(certificate.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card padding>
          <Empty
            icon={<Shield className="w-8 h-8 text-dark-500" />}
            title="No certificates found"
            description={
              search || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'No certificates match your filters'
                : 'Add your first SSL certificate to get started'
            }
            action={
              <Button leftIcon={<Plus className="w-5 h-5" />} onClick={() => setShowCreate(true)}>
                Add Certificate
              </Button>
            }
          />
        </Card>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add SSL Certificate" size="lg">
        <Tabs value={createType} onChange={(v) => setCreateType(v as typeof createType)}>
          <TabList className="mb-6">
            <Tab value="letsencrypt" onClick={() => setCreateType('letsencrypt')}>Let's Encrypt</Tab>
            <Tab value="custom" onClick={() => setCreateType('custom')}>Custom Certificate</Tab>
          </TabList>

          <TabPanel value="letsencrypt">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Domain</label>
                <Input
                  placeholder="example.com"
                  value={leDomain}
                  onChange={(e) => setLeDomain(e.target.value)}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Enter the domain name for which you want to create a certificate
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Email (Optional)</label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={leEmail}
                  onChange={(e) => setLeEmail(e.target.value)}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Email for Let's Encrypt notifications (optional)
                </p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Globe className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-dark-300">
                    <p className="font-medium text-dark-100 mb-1">Let's Encrypt Requirements</p>
                    <ul className="list-disc list-inside space-y-1 text-dark-400">
                      <li>Domain must be publicly accessible</li>
                      <li>Port 80 must be open for HTTP validation</li>
                      <li>DNS must point to this server</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="custom">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Domain</label>
                <Input
                  placeholder="example.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Certificate Path</label>
                <Input
                  placeholder="/etc/ssl/certs/example.com.crt"
                  value={customCertPath}
                  onChange={(e) => setCustomCertPath(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Private Key Path</label>
                <Input
                  placeholder="/etc/ssl/private/example.com.key"
                  value={customKeyPath}
                  onChange={(e) => setCustomKeyPath(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Chain Path (Optional)</label>
                <Input
                  placeholder="/etc/ssl/certs/example.com.chain.crt"
                  value={customChainPath}
                  onChange={(e) => setCustomChainPath(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Expiration Date</label>
                <Input
                  type="date"
                  value={customExpiresAt}
                  onChange={(e) => setCustomExpiresAt(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Auto Renew</label>
                  <p className="text-xs text-dark-500">Enable automatic renewal (for Let's Encrypt only)</p>
                </div>
                <Switch checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
              </div>
            </div>
          </TabPanel>
        </Tabs>

        {/* Action Buttons - Outside Tabs */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-dark-700">
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button 
            onClick={createType === 'letsencrypt' ? handleCreateLetsEncrypt : handleCreateCustom}
          >
            Create Certificate
          </Button>
        </div>
      </Modal>
    </div>
  );
}
