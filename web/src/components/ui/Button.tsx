import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';
import { useThemeStore } from '@/stores/theme';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    loading, 
    disabled,
    leftIcon,
    rightIcon,
    children, 
    ...props 
  }, ref) => {
    const resolvedMode = useThemeStore((state) => state.resolvedMode);
    const isLight = resolvedMode === 'light';

    const variants = {
      primary: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/25',
      secondary: isLight 
        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
        : 'bg-dark-700 text-dark-100 hover:bg-dark-600',
      ghost: isLight 
        ? 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900' 
        : 'bg-transparent text-dark-300 hover:bg-dark-800 hover:text-dark-100',
      danger: 'bg-red-600 text-white hover:bg-red-500',
      success: 'bg-green-600 text-white hover:bg-green-500',
      outline: isLight 
        ? 'bg-transparent border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-900' 
        : 'bg-transparent border border-dark-600 text-dark-300 hover:bg-dark-800 hover:text-dark-100',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg',
      icon: 'p-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-all duration-200 ease-out',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
          isLight ? 'focus:ring-offset-white' : 'focus:ring-offset-dark-900',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

