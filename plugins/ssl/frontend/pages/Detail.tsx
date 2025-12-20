import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  ShieldAlert,
  ShieldX,
  ArrowLeft,
  RefreshCw, 
  Calendar,
  Clock,
  Key,
  Lock,
  Unlock,
  Globe,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Trash2,
  RotateCw,
  Copy,
  FileText,
  Server,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import * as sslApi from '../api/ssl';
import type { SSLCertificate, SSLCertificateStatus, SSLValidation } from '../api/ssl';

export default function SSLDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cert, setCert] = useState<SSLCertificate | null>(null);
  const [validation, setValidation] = useState<SSLValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadCertificate();
    }
  }, [id]);

  async function loadCertificate() {
    try {
      setLoading(true);
      const data = await sslApi.getCertificate(id!);
      setCert(data);
    } catch (error) {
      console.error('Failed to load certificate:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRenew() {
    try {
      setRenewing(true);
      await sslApi.renewCertificate(id!);
      await loadCertificate();
    } catch (error) {
      console.error('Failed to renew certificate:', error);
    } finally {
      setRenewing(false);
    }
  }

  async function handleValidate() {
    try {
      setValidating(true);
      const result = await sslApi.validateCertificate(id!);
      setValidation(result);
    } catch (error) {
      console.error('Failed to validate certificate:', error);
    } finally {
      setValidating(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await sslApi.deleteCertificate(id!);
      navigate('/ssl');
    } catch (error) {
      console.error('Failed to delete certificate:', error);
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleAutoRenew() {
    if (!cert) return;
    try {
      await sslApi.updateCertificate(id!, { auto_renew: !cert.auto_renew });
      await loadCertificate();
    } catch (error) {
      console.error('Failed to update certificate:', error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusIcon = (status: SSLCertificateStatus) => {
    switch (status) {
      case 'active':
        return <ShieldCheck className="w-8 h-8 text-green-500" />;
      case 'expiring':
        return <ShieldAlert className="w-8 h-8 text-yellow-500" />;
      case 'expired':
      case 'error':
      case 'revoked':
        return <ShieldX className="w-8 h-8 text-red-500" />;
      default:
        return <ShieldCheck className="w-8 h-8 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: SSLCertificateStatus) => {
    const configs: Record<SSLCertificateStatus, { variant: 'success' | 'warning' | 'danger' | 'gray' | 'info'; label: string }> = {
      active: { variant: 'success', label: 'Active' },
      expiring: { variant: 'warning', label: 'Expiring Soon' },
      expired: { variant: 'danger', label: 'Expired' },
      pending: { variant: 'info', label: 'Pending' },
      error: { variant: 'danger', label: 'Error' },
      revoked: { variant: 'gray', label: 'Revoked' },
    };
    const config = configs[status] || configs.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Certificate not found</p>
        <Link to="/ssl">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Certificates
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/ssl">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${
              cert.status === 'active' ? 'bg-green-500/10' :
              cert.status === 'expiring' ? 'bg-yellow-500/10' :
              'bg-red-500/10'
            }`}>
              {getStatusIcon(cert.status)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {cert.domain}
                {cert.is_wildcard && (
                  <span className="ml-2 text-sm text-purple-500">Wildcard</span>
                )}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(cert.status)}
                <Badge variant={cert.type === 'letsencrypt' ? 'primary' : cert.type === 'custom' ? 'info' : 'gray'}>
                  {cert.type === 'letsencrypt' ? "Let's Encrypt" : cert.type === 'custom' ? 'Custom' : 'Self-Signed'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleValidate} loading={validating}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Validate
          </Button>
          {cert.type === 'letsencrypt' && (
            <Button variant="outline" onClick={handleRenew} loading={renewing}>
              <RotateCw className="w-4 h-4 mr-2" />
              Renew Now
            </Button>
          )}
          <Button variant="danger" onClick={() => setDeleteModal(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Validation Result */}
      {validation && (
        <Card className={`p-4 ${validation.valid ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className="flex items-start gap-3">
            {validation.valid ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${validation.valid ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {validation.valid ? 'Certificate is valid' : 'Certificate has issues'}
              </p>
              {validation.issues && validation.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {validation.issues.map((issue, idx) => (
                    <li key={idx} className="text-sm text-red-600 dark:text-red-400">• {issue}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificate Details */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Certificate Details
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Domain</span>
              <span className="font-medium text-gray-900 dark:text-white">{cert.domain}</span>
            </div>
            {cert.domains && cert.domains.length > 1 && (
              <div className="py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">All Domains (SANs)</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cert.domains.map((d, idx) => (
                    <Badge key={idx} variant="gray">{d}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Issuer</span>
              <span className="font-medium text-gray-900 dark:text-white">{cert.issuer || '-'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Subject</span>
              <span className="font-medium text-gray-900 dark:text-white">{cert.subject || '-'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Key Algorithm</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {cert.key_algorithm} {cert.key_size ? `(${cert.key_size} bits)` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Serial Number</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-[200px]">
                  {cert.serial_number || '-'}
                </code>
                {cert.serial_number && (
                  <button onClick={() => copyToClipboard(cert.serial_number)} className="text-gray-400 hover:text-gray-600">
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500 dark:text-gray-400">Fingerprint (SHA-256)</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-[200px]">
                  {cert.fingerprint ? cert.fingerprint.substring(0, 20) + '...' : '-'}
                </code>
                {cert.fingerprint && (
                  <button onClick={() => copyToClipboard(cert.fingerprint)} className="text-gray-400 hover:text-gray-600">
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Validity & Renewal */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Validity & Renewal
          </h3>
          <div className="space-y-4">
            {/* Expiration Progress */}
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Days Remaining</span>
                <span className={`text-2xl font-bold ${
                  cert.days_remaining > 30 ? 'text-green-600' :
                  cert.days_remaining > 7 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {cert.days_remaining >= 0 ? cert.days_remaining : 'Expired'}
                </span>
              </div>
              {cert.days_remaining >= 0 && (
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cert.days_remaining > 30 ? 'bg-green-500' :
                      cert.days_remaining > 7 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, (cert.days_remaining / 90) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Issued At
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {cert.issued_at ? formatDate(cert.issued_at) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Expires At
              </span>
              <span className={`font-medium ${cert.days_remaining < 7 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                {formatDate(cert.expires_at)}
              </span>
            </div>

            {cert.type === 'letsencrypt' && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Auto Renew</span>
                  <button
                    onClick={handleToggleAutoRenew}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full transition-colors ${
                      cert.auto_renew
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {cert.auto_renew ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    {cert.auto_renew ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Renew Before</span>
                  <span className="font-medium text-gray-900 dark:text-white">{cert.renew_before} days</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Times Renewed</span>
                  <span className="font-medium text-gray-900 dark:text-white">{cert.renew_count}</span>
                </div>
                {cert.last_renewed && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400">Last Renewed</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatDate(cert.last_renewed)}</span>
                  </div>
                )}
                {cert.last_renew_error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">Last Renewal Error</p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{cert.last_renew_error}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* File Paths */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            File Locations
          </h3>
          <div className="space-y-4">
            <div className="py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <FileText className="w-4 h-4" />
                Certificate
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded overflow-x-auto">
                  {cert.cert_path || '-'}
                </code>
                {cert.cert_path && (
                  <button onClick={() => copyToClipboard(cert.cert_path)} className="text-gray-400 hover:text-gray-600">
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Key className="w-4 h-4" />
                Private Key
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded overflow-x-auto">
                  {cert.key_path || '-'}
                </code>
                {cert.key_path && (
                  <button onClick={() => copyToClipboard(cert.key_path)} className="text-gray-400 hover:text-gray-600">
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {cert.chain_path && (
              <div className="py-2">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <Server className="w-4 h-4" />
                  Chain Certificate
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded overflow-x-auto">
                    {cert.chain_path}
                  </code>
                  <button onClick={() => copyToClipboard(cert.chain_path)} className="text-gray-400 hover:text-gray-600">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Usage */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Usage
          </h3>
          {cert.used_by && cert.used_by.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                This certificate is used by {cert.usage_count} site(s):
              </p>
              <div className="flex flex-wrap gap-2">
                {cert.used_by.map((siteId, idx) => (
                  <Badge key={idx} variant="info">{siteId}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                This certificate is not currently in use
              </p>
            </div>
          )}

          {cert.type === 'letsencrypt' && cert.acme_email && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ACME Account</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">{cert.acme_email}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Delete Modal */}
      <Modal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Certificate"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete the certificate for{' '}
            <strong className="text-gray-900 dark:text-white">{cert.domain}</strong>?
          </p>
          {cert.usage_count > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                This certificate is currently in use by {cert.usage_count} site(s). 
                Deleting it will break their SSL configuration.
              </p>
            </div>
          )}
          <p className="text-sm text-red-500">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteModal(false)}>
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

