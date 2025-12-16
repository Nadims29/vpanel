import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  children: ReactNode;
  onChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ defaultValue, value, children, onChange, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(value || defaultValue || '');

  // Sync with external value
  useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value);
    }
  }, [value]);

  const handleChange = (id: string) => {
    if (value === undefined) {
      setActiveTab(id);
    }
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className }: TabListProps) {
  return (
    <div className={cn('flex gap-1 p-1 bg-dark-800/50 rounded-lg border border-dark-700', className)}>
      {children}
    </div>
  );
}

export interface TabProps {
  value?: string;
  children: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function Tab({ value, children, icon, active, onClick }: TabProps) {
  const context = useContext(TabsContext);
  
  // Support both controlled and context-based usage
  const isActive = active !== undefined ? active : (context && value ? context.activeTab === value : false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (context && value) {
      context.setActiveTab(value);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative px-4 py-2 rounded-md text-sm font-medium transition-colors',
        isActive ? 'text-dark-100' : 'text-dark-400 hover:text-dark-200'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-dark-700 rounded-md"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <span className="relative flex items-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  );
}

export interface TabPanelsProps {
  children: ReactNode;
  className?: string;
}

export function TabPanels({ children, className }: TabPanelsProps) {
  return <div className={className}>{children}</div>;
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  if (context.activeTab !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
