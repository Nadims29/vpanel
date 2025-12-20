import { Crown, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';

interface ProBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'icon';
  className?: string;
  showIcon?: boolean;
}

export function ProBadge({ 
  size = 'sm', 
  variant = 'default',
  className,
  showIcon = true,
}: ProBadgeProps) {
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (variant === 'icon') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          isLight 
            ? 'bg-gradient-to-r from-amber-400 to-orange-500' 
            : 'bg-gradient-to-r from-amber-500 to-orange-600',
          size === 'sm' && 'w-4 h-4',
          size === 'md' && 'w-5 h-5',
          size === 'lg' && 'w-6 h-6',
          className
        )}
      >
        <Crown className={cn('text-white', iconSizes[size])} style={{ width: '60%', height: '60%' }} />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded font-semibold',
          sizeClasses[size],
          isLight 
            ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' 
            : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
          className
        )}
      >
        {showIcon && <Crown className={iconSizes[size]} />}
        Pro
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        sizeClasses[size],
        isLight 
          ? 'bg-amber-100 text-amber-700 border border-amber-200' 
          : 'bg-amber-900/30 text-amber-400 border border-amber-800',
        className
      )}
    >
      {showIcon && <Crown className={iconSizes[size]} />}
      Pro
    </span>
  );
}

// Logo Pro Badge - for sidebar logo
export function LogoProBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'absolute -top-1 -right-1 flex items-center justify-center',
        'w-4 h-4 rounded-full',
        'bg-gradient-to-r from-amber-400 to-orange-500',
        'shadow-lg shadow-amber-500/30',
        'animate-pulse',
        className
      )}
    >
      <Sparkles className="w-2.5 h-2.5 text-white" />
    </div>
  );
}

