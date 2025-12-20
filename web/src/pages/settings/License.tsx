import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Key,
  Shield,
  Users,
  Database,
  Clock,
  Zap,
  Sparkles,
  AlertCircle,
  Loader2,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { Button, Card, Badge, Input, Modal } from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import { useLicenseStore } from '@/stores/license';
import { PRO_PURCHASE_URL, PRO_FEATURES } from '@/api/license';

const proFeatures = [
  { icon: Users, title: 'Team Management', description: 'Advanced team & role management with granular permissions' },
  { icon: Shield, title: 'Enhanced Security', description: 'Advanced security features including IP whitelisting' },
  { icon: Database, title: 'Advanced Backup', description: 'Scheduled cloud backups with multiple storage providers' },
  { icon: Clock, title: 'Audit Export', description: 'Export audit logs to CSV, JSON, or integrate with SIEM' },
  { icon: Zap, title: 'Priority Support', description: '24/7 priority support with dedicated account manager' },
  { icon: Sparkles, title: 'Premium Features', description: 'Access all current and future premium features' },
];

export default function LicensePage() {
  const [showActivate, setShowActivate] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  const {
    license,
    loading,
    fetchLicense,
    activateLicense,
    deactivateLicense,
    refreshLicense,
    isPro,
  } = useLicenseStore();

  useEffect(() => {
    fetchLicense();
  }, [fetchLicense]);

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }

    try {
      setActivating(true);
      setError(null);
      await activateLicense(licenseKey.trim());
      setSuccess('License activated successfully!');
      setShowActivate(false);
      setLicenseKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate license');
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      setError(null);
      await deactivateLicense();
      setSuccess('License deactivated successfully');
      setShowDeactivate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate license');
    }
  };

  const handleRefresh = async () => {
    try {
      setError(null);
      await refreshLicense();
      setSuccess('License refreshed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh license');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
            License & Subscription
          </h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>
            Manage your VPanel Pro license
          </p>
        </div>
        {isPro() && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className={cn(
          'mb-4 p-4 rounded-lg flex items-center gap-2',
          isLight ? 'bg-red-50 text-red-700' : 'bg-red-900/20 text-red-400'
        )}>
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className={cn(
          'mb-4 p-4 rounded-lg flex items-center gap-2',
          isLight ? 'bg-green-50 text-green-700' : 'bg-green-900/20 text-green-400'
        )}>
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Current License Status */}
      <Card padding className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center',
              isPro()
                ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                : isLight ? 'bg-gray-100' : 'bg-gray-800'
            )}>
              <Crown className={cn('w-8 h-8', isPro() ? 'text-white' : 'text-gray-400')} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={cn('text-xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {isPro() ? 'VPanel Pro' : 'VPanel Free'}
                </h2>
                <Badge variant={isPro() ? 'success' : 'gray'}>
                  {license?.plan?.toUpperCase() || 'FREE'}
                </Badge>
              </div>
              {isPro() ? (
                <div className={cn('mt-1 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  <p>Licensed to: {license?.email || 'Unknown'}</p>
                  {license?.expires_at ? (
                    <p>
                      Expires: {formatDate(license.expires_at)}
                      {license.days_remaining > 0 && license.days_remaining < 30 && (
                        <span className="text-amber-500 ml-2">
                          ({license.days_remaining} days remaining)
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-green-500">Lifetime license</p>
                  )}
                </div>
              ) : (
                <p className={cn('mt-1 text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  Upgrade to Pro to unlock all features
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isPro() ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeactivate(true)}
              >
                Deactivate
              </Button>
            ) : (
              <>
                <Button
                  className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 hover:from-amber-500 hover:to-orange-600"
                  leftIcon={<Crown className="w-4 h-4" />}
                  onClick={() => setShowActivate(true)}
                >
                  Activate License
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={<ExternalLink className="w-4 h-4" />}
                  onClick={() => window.open(PRO_PURCHASE_URL, '_blank')}
                >
                  Purchase Pro
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Pro Features */}
      <div className="mb-6">
        <h3 className={cn('text-lg font-semibold mb-4', isLight ? 'text-gray-900' : 'text-gray-100')}>
          {isPro() ? 'Your Pro Features' : 'Pro Features'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proFeatures.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                padding
                className={cn(
                  'h-full transition-all',
                  isPro() 
                    ? '' 
                    : isLight ? 'opacity-60' : 'opacity-50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isPro()
                      ? 'bg-gradient-to-br from-amber-400/20 to-orange-500/20'
                      : isLight ? 'bg-gray-100' : 'bg-gray-800'
                  )}>
                    <feature.icon className={cn(
                      'w-5 h-5',
                      isPro()
                        ? 'text-amber-500'
                        : isLight ? 'text-gray-400' : 'text-gray-500'
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={cn(
                        'font-medium',
                        isLight ? 'text-gray-900' : 'text-gray-100'
                      )}>
                        {feature.title}
                      </h4>
                      {isPro() && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <p className={cn(
                      'text-sm mt-1',
                      isLight ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Purchase CTA for non-Pro users */}
      {!isPro() && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 p-8 text-center">
            <Crown className="w-12 h-12 text-white mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">
              Upgrade to VPanel Pro
            </h3>
            <p className="text-white/80 mb-6 max-w-md mx-auto">
              Unlock all premium features, get priority support, and take your server management to the next level.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                className="bg-white text-orange-500 hover:bg-gray-100"
                leftIcon={<Key className="w-4 h-4" />}
                onClick={() => setShowActivate(true)}
              >
                Enter License Key
              </Button>
              <Button
                variant="secondary"
                className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                rightIcon={<ExternalLink className="w-4 h-4" />}
                onClick={() => window.open(PRO_PURCHASE_URL, '_blank')}
              >
                Purchase at vcloud.zsoft.cc
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Activate License Modal */}
      <Modal
        open={showActivate}
        onClose={() => !activating && setShowActivate(false)}
        title="Activate License"
        size="md"
      >
        <div className="space-y-4">
          <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            Enter your VPanel Pro license key to activate premium features.
            You can purchase a license at{' '}
            <a
              href={PRO_PURCHASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500 hover:underline"
            >
              vcloud.zsoft.cc
            </a>
          </p>

          <div>
            <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>
              License Key
            </label>
            <Input
              placeholder="VPRO-XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              disabled={activating}
            />
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button
              variant="secondary"
              onClick={() => setShowActivate(false)}
              disabled={activating}
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0"
              leftIcon={activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              onClick={handleActivate}
              disabled={activating || !licenseKey.trim()}
            >
              {activating ? 'Activating...' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm Modal */}
      <Modal
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        title="Deactivate License"
        size="sm"
      >
        <div className="space-y-4">
          <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
            Are you sure you want to deactivate your Pro license? You will lose access to all premium features.
          </p>

          <div className={cn(
            'p-3 rounded-lg',
            isLight ? 'bg-amber-50' : 'bg-amber-900/20'
          )}>
            <p className={cn('text-sm', isLight ? 'text-amber-700' : 'text-amber-400')}>
              You can reactivate your license at any time using the same license key.
            </p>
          </div>

          <div className={cn(
            'flex justify-end gap-3 pt-4 border-t',
            isLight ? 'border-gray-200' : 'border-gray-700'
          )}>
            <Button variant="secondary" onClick={() => setShowDeactivate(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeactivate}>
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

