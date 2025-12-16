import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover, padding = false, children, ...props }, ref) => {
    const resolvedMode = useThemeStore((state) => state.resolvedMode);
    const isLight = resolvedMode === 'light';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border shadow-lg',
          isLight 
            ? 'bg-white border-gray-200 shadow-gray-200/50' 
            : 'bg-dark-800/50 backdrop-blur-sm border-dark-700/50 shadow-black/10',
          hover && cn(
            'transition-all duration-200 cursor-pointer',
            isLight 
              ? 'hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl' 
              : 'hover:bg-dark-800/70 hover:border-dark-600/50 hover:shadow-xl'
          ),
          padding && 'p-6',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const resolvedMode = useThemeStore((state) => state.resolvedMode);
    const isLight = resolvedMode === 'light';

    return (
      <div
        ref={ref}
        className={cn(
          'p-4 border-b flex items-center justify-between',
          isLight ? 'border-gray-200' : 'border-dark-700',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('p-4', className)} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const resolvedMode = useThemeStore((state) => state.resolvedMode);
    const isLight = resolvedMode === 'light';

    return (
      <div
        ref={ref}
        className={cn(
          'p-4 border-t flex items-center justify-end gap-3',
          isLight ? 'border-gray-200' : 'border-dark-700',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

