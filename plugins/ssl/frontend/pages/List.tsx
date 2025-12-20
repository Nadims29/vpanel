import { useState, useEffect, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  ShieldAlert,
  ShieldX,
  Plus, 
  RefreshCw, 
  Upload,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  Trash2,
  Eye,
  RotateCw,
  Calendar,
  Lock,
  Unlock,
  Globe,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Spinner } from '@/components/ui/Spinner';
import { Empty } from '@/components/ui/Empty';
import * as sslApi from '../api/ssl';
import type { SSLCertificate, SSLCertificateStatus, SSLCertificateType, SSLStats } from '../api/ssl';

export default function SSLList() {
  const [certificates, setCertificates] = useState<SSLCertificate[]>([]);
  const [stats, setStats] = useState<SSLStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<SSLCertificateType | ''>('');
  const [statusFilter, setStatusFilter] = useState<SSLCertificateStatus | ''>('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; cert: SSLCertificate | null }>({ open: false, cert: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [typeFilter, statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const [certsData, statsData] = await Promise.all([
        sslApi.listCertificates({
          type: typeFilter || undefined,
          status: statusFilter || undefined,
        }),
        sslApi.getStats(),
      ]);
      setCertificates(certsData || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load SSL data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRenew(id: string) {
    try {
      await sslApi.renewCertificate(id);
      loadData();
    } catch (error) {
      console.error('Failed to renew certificate:', error);
    }
  }

  async function handleDelete() {
    if (!deleteModal.cert) return;
    try {
      setDeleting(true);
      await sslApi.deleteCertificate(deleteModal.cert.id);
      setDeleteModal({ open: false, cert: null });
      loadData();
    } catch (error) {
      console.error('Failed to delete certificate:', error);
    } finally {
      setDeleting(false);
    }
  }

  const filteredCerts = certificates.filter(cert => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cert.domain.toLowerCase().includes(query) ||
      cert.name.toLowerCase().includes(query) ||
      cert.issuer?.toLowerCase().includes(query) ||
      cert.domains?.some(d => d.toLowerCase().includes(query))
    );
  });

  const getStatusBadge = (status: SSLCertificateStatus) => {
    const configs: Record<SSLCertificateStatus, { variant: 'success' | 'warning' | 'danger' | 'gray' | 'info'; icon: React.ReactNode; label: string }> = {
      active: { variant: 'success', icon: <CheckCircle className="w-3 h-3" />, label: 'Active' },
      expiring: { variant: 'warning', icon: <Clock className="w-3 h-3" />, label: 'Expiring Soon' },
      expired: { variant: 'danger', icon: <XCircle className="w-3 h-3" />, label: 'Expired' },
      pending: { variant: 'info', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
      error: { variant: 'danger', icon: <AlertCircle className="w-3 h-3" />, label: 'Error' },
      revoked: { variant: 'gray', icon: <XCircle className="w-3 h-3" />, label: 'Revoked' },
    };
    const config = configs[status] || configs.pending;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: SSLCertificateType) => {
    const configs: Record<SSLCertificateType, { variant: 'primary' | 'info' | 'gray'; label: string }> = {
      letsencrypt: { variant: 'primary', label: "Let's Encrypt" },
      custom: { variant: 'info', label: 'Custom' },
      selfsigned: { variant: 'gray', label: 'Self-Signed' },
      acme: { variant: 'primary', label: 'ACME' },
    };
    const config = configs[type] || { variant: 'gray', label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            SSL Certificates
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage SSL/TLS certificates for your domains
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/ssl/add">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Certificate
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ShieldCheck className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Expiring</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.expiring}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Expired</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.expired}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px]">
            <SearchInput
              placeholder="Search by domain, name, or issuer..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as SSLCertificateType | '')}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="letsencrypt">Let's Encrypt</option>
            <option value="custom">Custom</option>
            <option value="selfsigned">Self-Signed</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SSLCertificateStatus | '')}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring</option>
            <option value="expired">Expired</option>
            <option value="pending">Pending</option>
          </select>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Certificates List */}
      {filteredCerts.length === 0 ? (
        <Empty
          icon={<ShieldCheck className="w-8 h-8 text-gray-500" />}
          title="No certificates found"
          description={searchQuery ? "Try a different search query" : "Add your first SSL certificate to get started"}
          action={
            !searchQuery ? (
              <Link to="/ssl/add">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Certificate
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Auto Renew
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCerts.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          cert.status === 'active' ? 'bg-green-500/10' :
                          cert.status === 'expiring' ? 'bg-yellow-500/10' :
                          'bg-red-500/10'
                        }`}>
                          {cert.status === 'active' ? (
                            <ShieldCheck className={`w-5 h-5 ${
                              cert.status === 'active' ? 'text-green-500' : 'text-gray-500'
                            }`} />
                          ) : cert.status === 'expiring' ? (
                            <ShieldAlert className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <ShieldX className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {cert.domain}
                            {cert.is_wildcard && (
                              <span className="ml-2 text-xs text-purple-500">Wildcard</span>
                            )}
                          </p>
                          {cert.domains && cert.domains.length > 1 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              +{cert.domains.length - 1} more domains
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getTypeBadge(cert.type)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(cert.status)}
                        {cert.days_remaining >= 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {cert.days_remaining} days remaining
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(cert.expires_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {cert.type === 'letsencrypt' ? (
                        <Badge variant={cert.auto_renew ? 'success' : 'gray'}>
                          {cert.auto_renew ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                          {cert.auto_renew ? 'Enabled' : 'Disabled'}
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        }
                      >
                        <Link to={`/ssl/${cert.id}`}>
                          <DropdownItem icon={<Eye className="w-4 h-4" />}>
                            View Details
                          </DropdownItem>
                        </Link>
                        {cert.type === 'letsencrypt' && (
                          <DropdownItem
                            icon={<RotateCw className="w-4 h-4" />}
                            onClick={() => handleRenew(cert.id)}
                          >
                            Renew Now
                          </DropdownItem>
                        )}
                        <DropdownDivider />
                        <DropdownItem
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => setDeleteModal({ open: true, cert })}
                          danger
                        >
                          Delete
                        </DropdownItem>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, cert: null })}
        title="Delete Certificate"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete the certificate for{' '}
            <strong className="text-gray-900 dark:text-white">{deleteModal.cert?.domain}</strong>?
          </p>
          <p className="text-sm text-red-500">
            This action cannot be undone. Any sites using this certificate will lose their SSL configuration.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteModal({ open: false, cert: null })}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete Certificate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

