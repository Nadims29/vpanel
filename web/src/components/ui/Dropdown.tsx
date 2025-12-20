import { useState, useRef, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { cn } from '@/utils/cn';

export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, children, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate position when dropdown opens
  useEffect(() => {
    if (open && triggerRef.current && menuRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 200; // min-w-[200px]
      
      let left = rect.left;
      if (align === 'right') {
        left = rect.right - menuWidth;
      }
      
      // Ensure menu doesn't go off screen
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 8;
      }
      if (left < 8) {
        left = 8;
      }
      
      setPosition({
        top: rect.bottom + 8,
        left: left,
      });
    }
  }, [open, align]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!open) return;
    
    const updatePosition = () => {
      if (triggerRef.current && menuRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const menuWidth = 200;
        
        let left = rect.left;
        if (align === 'right') {
          left = rect.right - menuWidth;
        }
        
        if (left + menuWidth > window.innerWidth) {
          left = window.innerWidth - menuWidth - 8;
        }
        if (left < 8) {
          left = 8;
        }
        
        setPosition({
          top: rect.bottom + 8,
          left: left,
        });
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, align]);

  useOnClickOutside(containerRef, () => setOpen(false));

  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <div ref={triggerRef} onClick={() => setOpen(!open)}>{trigger}</div>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                zIndex: 9999,
              }}
              className={cn(
                'min-w-[200px] py-1',
                'bg-dark-800 border border-dark-700 rounded-lg shadow-xl',
                className
              )}
              onClick={() => setOpen(false)}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export interface DropdownItemProps {
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({ onClick, icon, children, danger, disabled, className }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
        'transition-colors',
        disabled && 'opacity-50 cursor-not-allowed',
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-dark-300 hover:bg-dark-700 hover:text-dark-100',
        className
      )}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 border-t border-dark-700" />;
}

