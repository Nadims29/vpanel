import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, 
  X, 
  ExternalLink, 
  Check, 
  Sparkles,
  Shield,
  Users,
  Clock,
  Database,
  Zap,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import { useLicenseStore } from '@/stores/license';
import { PRO_PURCHASE_URL } from '@/api/license';
import { Button } from './Button';
import { ProBadge } from './ProBadge';

interface ProGuardProps {
  children: React.ReactNode;
  feature?: string;
  featureName?: string;
  onProClick?: () => void;
}

// ProGuard wraps content that requires Pro
export function ProGuard({ children, feature, featureName, onProClick }: ProGuardProps) {
  const [showModal, setShowModal] = useState(false);
  const isPro = useLicenseStore((state) => state.isPro());
  const hasFeature = useLicenseStore((state) => state.hasFeature);

  // If Pro or has specific feature, show children directly
  if (isPro && (!feature || hasFeature(feature))) {
    return <>{children}</>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onProClick) {
      onProClick();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <div onClick={handleClick} className="cursor-pointer">
        {children}
      </div>
      <ProUpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        featureName={featureName}
      />
    </>
  );
}

// ProButton - a button that shows Pro modal when clicked (for non-Pro users)
interface ProButtonProps {
  children: React.ReactNode;
  feature?: string;
  featureName?: string;
  className?: string;
  onClick?: () => void;
  showBadge?: boolean;
}

export function ProButton({ 
  children, 
  feature, 
  featureName, 
  className,
  onClick,
  showBadge = true,
}: ProButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const isPro = useLicenseStore((state) => state.isPro());
  const hasFeature = useLicenseStore((state) => state.hasFeature);

  const handleClick = (e: React.MouseEvent) => {
    if (isPro && (!feature || hasFeature(feature))) {
      onClick?.();
    } else {
      e.preventDefault();
      e.stopPropagation();
      setShowModal(true);
    }
  };

  const isLocked = !isPro || (feature && !hasFeature(feature));

  return (
    <>
      <button onClick={handleClick} className={cn('relative', className)}>
        {children}
        {isLocked && showBadge && (
          <ProBadge size="sm" variant="compact" className="absolute -top-1 -right-1" />
        )}
      </button>
      <ProUpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        featureName={featureName}
      />
    </>
  );
}

// Pro Upgrade Modal
interface ProUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
}

const proFeatures = [
  { icon: Users, title: 'Team Management', description: 'Advanced team & role management' },
  { icon: Shield, title: 'Enhanced Security', description: 'Advanced security features' },
  { icon: Database, title: 'Advanced Backup', description: 'Scheduled cloud backups' },
  { icon: Clock, title: 'Audit Export', description: 'Export audit logs' },
  { icon: Zap, title: 'Priority Support', description: '24/7 priority support' },
  { icon: Sparkles, title: 'Premium Features', description: 'Access all premium features' },
];

export function ProUpgradeModal({ open, onClose, featureName }: ProUpgradeModalProps) {
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  const handlePurchase = () => {
    window.open(PRO_PURCHASE_URL, '_blank');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className={cn(
                'relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden',
                isLight ? 'bg-white' : 'bg-gray-900'
              )}
            >
              {/* Header with gradient */}
              <div className="relative bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-6 py-8 text-center">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
                  <Crown className="w-8 h-8 text-white" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Upgrade to Pro</h2>
                <p className="text-white/80">
                  {featureName 
                    ? `"${featureName}" is a Pro feature`
                    : 'Unlock all premium features'}
                </p>
              </div>

              {/* Features */}
              <div className="px-6 py-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {proFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg',
                        isLight ? 'bg-gray-50' : 'bg-gray-800'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-lg',
                        isLight ? 'bg-amber-100' : 'bg-amber-900/30'
                      )}>
                        <feature.icon className={cn(
                          'w-4 h-4',
                          isLight ? 'text-amber-600' : 'text-amber-400'
                        )} />
                      </div>
                      <div>
                        <p className={cn(
                          'font-medium text-sm',
                          isLight ? 'text-gray-900' : 'text-gray-100'
                        )}>
                          {feature.title}
                        </p>
                        <p className={cn(
                          'text-xs',
                          isLight ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Button
                  onClick={handlePurchase}
                  className="w-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-500 hover:via-orange-600 hover:to-rose-600 text-white border-0"
                  leftIcon={<Crown className="w-5 h-5" />}
                  rightIcon={<ExternalLink className="w-4 h-4" />}
                >
                  Get Pro License
                </Button>

                <p className={cn(
                  'text-center text-xs mt-4',
                  isLight ? 'text-gray-500' : 'text-gray-400'
                )}>
                  Purchase at{' '}
                  <a
                    href={PRO_PURCHASE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-500 hover:underline"
                  >
                    vcloud.zsoft.cc
                  </a>
                </p>
              </div>

              {/* Footer */}
              <div className={cn(
                'px-6 py-4 border-t flex items-center justify-between',
                isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-800 bg-gray-800/50'
              )}>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                    30-day money-back guarantee
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Maybe Later
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook to check Pro status and show upgrade modal
export function useProGuard() {
  const [showModal, setShowModal] = useState(false);
  const isPro = useLicenseStore((state) => state.isPro());
  const hasFeature = useLicenseStore((state) => state.hasFeature);

  const checkPro = (feature?: string): boolean => {
    if (!isPro) {
      setShowModal(true);
      return false;
    }
    if (feature && !hasFeature(feature)) {
      setShowModal(true);
      return false;
    }
    return true;
  };

  return {
    isPro,
    checkPro,
    showModal,
    setShowModal,
    Modal: ({ featureName }: { featureName?: string }) => (
      <ProUpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        featureName={featureName}
      />
    ),
  };
}

