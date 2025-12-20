import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  ShieldCheck, 
  Upload,
  Key,
  Globe,
  Lock,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import * as sslApi from '../api/ssl';

type CertificateMethod = 'letsencrypt' | 'custom' | 'selfsigned';

export default function SSLAdd() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<CertificateMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Let's Encrypt form
  const [leDomain, setLeDomain] = useState('');
  const [leAdditionalDomains, setLeAdditionalDomains] = useState('');
  const [leEmail, setLeEmail] = useState('');
  const [leChallengeType, setLeChallengeType] = useState<'http-01' | 'dns-01'>('http-01');
  const [leAutoRenew, setLeAutoRenew] = useState(true);

  // Custom certificate form
  const [customDomain, setCustomDomain] = useState('');
  const [customCert, setCustomCert] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customChain, setCustomChain] = useState('');
  const [customName, setCustomName] = useState('');

  // Self-signed form
  const [ssDomain, setSsDomain] = useState('');
  const [ssAdditionalDomains, setSsAdditionalDomains] = useState('');
  const [ssValidDays, setSsValidDays] = useState(365);
  const [ssKeyType, setSsKeyType] = useState<'RSA' | 'ECDSA'>('RSA');
  const [ssKeySize, setSsKeySize] = useState(2048);
  const [ssOrganization, setSsOrganization] = useState('');

  async function handleCreateLetsEncrypt() {
    if (!leDomain) {
      setError('Domain is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const domains = leAdditionalDomains
        .split(/[,\n]/)
        .map(d => d.trim())
        .filter(d => d.length > 0);

      await sslApi.createLetsEncryptCert({
        domain: leDomain,
        domains: domains.length > 0 ? domains : undefined,
        email: leEmail || undefined,
        challenge_type: leChallengeType,
        auto_renew: leAutoRenew,
      });

      navigate('/ssl');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create certificate');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCustom() {
    if (!customDomain || !customCert || !customKey) {
      setError('Domain, certificate, and private key are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await sslApi.createCustomCert({
        domain: customDomain,
        certificate: customCert,
        private_key: customKey,
        chain: customChain || undefined,
        name: customName || undefined,
      });

      navigate('/ssl');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to upload certificate');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSelfSigned() {
    if (!ssDomain) {
      setError('Domain is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const domains = ssAdditionalDomains
        .split(/[,\n]/)
        .map(d => d.trim())
        .filter(d => d.length > 0);

      await sslApi.createSelfSignedCert({
        domain: ssDomain,
        domains: domains.length > 0 ? domains : undefined,
        valid_days: ssValidDays,
        key_type: ssKeyType,
        key_size: ssKeySize,
        organization: ssOrganization || undefined,
      });

      navigate('/ssl');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create certificate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/ssl">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Add SSL Certificate
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create or upload an SSL certificate for your domain
          </p>
        </div>
      </div>

      {/* Method Selection */}
      {!method && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => setMethod('letsencrypt')}
            className="p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Let's Encrypt
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Free, automated SSL certificate with auto-renewal support
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Free</Badge>
              <Badge variant="info">Auto-Renew</Badge>
            </div>
          </button>

          <button
            onClick={() => setMethod('custom')}
            className="p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Upload Custom
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Upload your own certificate from another provider
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">Any Provider</Badge>
              <Badge variant="gray">Manual</Badge>
            </div>
          </button>

          <button
            onClick={() => setMethod('selfsigned')}
            className="p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
              <Key className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Self-Signed
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Generate a self-signed certificate for development/testing
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">Not Trusted</Badge>
              <Badge variant="gray">Development</Badge>
            </div>
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Let's Encrypt Form */}
      {method === 'letsencrypt' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Let's Encrypt Certificate</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Free automated certificate</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Primary Domain *
              </label>
              <input
                type="text"
                value={leDomain}
                onChange={(e) => setLeDomain(e.target.value)}
                placeholder="example.com or *.example.com"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use *.example.com for wildcard certificates (requires DNS challenge)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Domains (SANs)
              </label>
              <textarea
                value={leAdditionalDomains}
                onChange={(e) => setLeAdditionalDomains(e.target.value)}
                placeholder="www.example.com&#10;api.example.com"
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">One domain per line or comma-separated</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={leEmail}
                onChange={(e) => setLeEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Used for expiration notifications</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Challenge Type
              </label>
              <select
                value={leChallengeType}
                onChange={(e) => setLeChallengeType(e.target.value as 'http-01' | 'dns-01')}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="http-01">HTTP-01 (Standalone)</option>
                <option value="dns-01">DNS-01 (Required for wildcards)</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoRenew"
                checked={leAutoRenew}
                onChange={(e) => setLeAutoRenew(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600"
              />
              <label htmlFor="autoRenew" className="text-sm text-gray-700 dark:text-gray-300">
                Enable automatic renewal (30 days before expiry)
              </label>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Requirements:</p>
                <ul className="list-disc list-inside mt-1 text-blue-600 dark:text-blue-300">
                  <li>Domain must point to this server</li>
                  <li>Port 80 must be accessible for HTTP-01 challenge</li>
                  <li>DNS access required for DNS-01 challenge</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setMethod(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleCreateLetsEncrypt} loading={loading}>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Create Certificate
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Custom Certificate Form */}
      {method === 'custom' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Upload Custom Certificate</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload certificate from another provider</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My Certificate"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Domain *
                </label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="example.com"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Certificate (PEM) *
              </label>
              <textarea
                value={customCert}
                onChange={(e) => setCustomCert(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                rows={6}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Private Key (PEM) *
              </label>
              <textarea
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                rows={6}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Certificate Chain (Optional)
              </label>
              <textarea
                value={customChain}
                onChange={(e) => setCustomChain(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Intermediate certificates for the trust chain</p>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setMethod(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleCreateCustom} loading={loading}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Certificate
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Self-Signed Form */}
      {method === 'selfsigned' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Generate Self-Signed Certificate</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">For development and testing</p>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium">Warning</p>
              <p className="text-yellow-600 dark:text-yellow-300">
                Self-signed certificates are not trusted by browsers and should only be used for development or internal services.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Primary Domain *
              </label>
              <input
                type="text"
                value={ssDomain}
                onChange={(e) => setSsDomain(e.target.value)}
                placeholder="localhost or dev.example.com"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Domains (SANs)
              </label>
              <textarea
                value={ssAdditionalDomains}
                onChange={(e) => setSsAdditionalDomains(e.target.value)}
                placeholder="localhost&#10;127.0.0.1"
                rows={2}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valid Days
                </label>
                <input
                  type="number"
                  value={ssValidDays}
                  onChange={(e) => setSsValidDays(parseInt(e.target.value) || 365)}
                  min={1}
                  max={3650}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Key Type
                </label>
                <select
                  value={ssKeyType}
                  onChange={(e) => setSsKeyType(e.target.value as 'RSA' | 'ECDSA')}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="RSA">RSA</option>
                  <option value="ECDSA">ECDSA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Key Size
                </label>
                <select
                  value={ssKeySize}
                  onChange={(e) => setSsKeySize(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {ssKeyType === 'RSA' ? (
                    <>
                      <option value={2048}>2048 bits</option>
                      <option value={4096}>4096 bits</option>
                    </>
                  ) : (
                    <>
                      <option value={256}>P-256</option>
                      <option value={384}>P-384</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Organization
              </label>
              <input
                type="text"
                value={ssOrganization}
                onChange={(e) => setSsOrganization(e.target.value)}
                placeholder="My Company"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setMethod(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleCreateSelfSigned} loading={loading}>
                <Key className="w-4 h-4 mr-2" />
                Generate Certificate
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

