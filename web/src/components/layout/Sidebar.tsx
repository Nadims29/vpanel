import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/ui';
import { useThemeStore } from '@/stores/theme';
import { useLicenseStore } from '@/stores/license';
import { usePermission } from '@/hooks/usePermission';
import { cn } from '@/utils/cn';
import {
  LayoutDashboard,
  Container,
  Rocket,
  Globe,
  Globe2,
  Database,
  FolderOpen,
  Terminal,
  Clock,
  Shield,
  ShieldCheck,
  Settings,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

interface MenuItem {
  title: string;
  icon: React.ElementType;
  path?: string;
  children?: { title: string; path: string; permission?: string }[];
  /** Required permission(s) to view this menu item */
  permission?: string;
  /** If true, any of the children's permissions will show the parent */
  showIfAnyChild?: boolean;
}

const staticMenuItems: MenuItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
  {
    title: 'Sites',
    icon: Globe2,
    permission: 'sites:read',
    showIfAnyChild: true,
    children: [
      { title: 'All Sites', path: '/sites', permission: 'sites:read' },
      { title: 'Add Site', path: '/sites/add', permission: 'sites:write' },
    ],
  },
  {
    title: 'SSL Certificates',
    icon: ShieldCheck,
    permission: 'sites:read',
    showIfAnyChild: true,
    children: [
      { title: 'All Certificates', path: '/ssl', permission: 'sites:read' },
      { title: 'Add Certificate', path: '/ssl/add', permission: 'sites:write' },
    ],
  },
  {
    title: 'Docker',
    icon: Container,
    permission: 'docker:read',
    showIfAnyChild: true,
    children: [
      { title: 'Containers', path: '/docker/containers', permission: 'docker:read' },
      { title: 'Images', path: '/docker/images', permission: 'docker:read' },
      { title: 'Networks', path: '/docker/networks', permission: 'docker:read' },
      { title: 'Volumes', path: '/docker/volumes', permission: 'docker:read' },
      { title: 'Compose', path: '/docker/compose', permission: 'docker:write' },
    ],
  },
  {
    title: 'Apps',
    icon: Rocket,
    permission: 'sites:read',
    showIfAnyChild: true,
    children: [
      { title: 'All Apps', path: '/apps', permission: 'sites:read' },
      { title: 'Deploy New', path: '/apps/create', permission: 'sites:write' },
      { title: 'Runtimes', path: '/apps/runtimes', permission: 'sites:read' },
    ],
  },
  {
    title: 'Nginx',
    icon: Globe,
    permission: 'sites:read',
    showIfAnyChild: true,
    children: [
      { title: 'Instances', path: '/nginx/instances', permission: 'sites:read' },
      { title: 'Sites', path: '/nginx/sites', permission: 'sites:read' },
      { title: 'Certificates', path: '/nginx/certificates', permission: 'sites:read' },
      { title: 'Logs', path: '/nginx/logs', permission: 'sites:read' },
    ],
  },
  {
    title: 'Database',
    icon: Database,
    permission: 'database:read',
    showIfAnyChild: true,
    children: [
      { title: 'Servers', path: '/database/servers', permission: 'database:read' },
      { title: 'Backups', path: '/database/backups', permission: 'database:read' },
    ],
  },
  { title: 'Files', icon: FolderOpen, path: '/files', permission: 'files:read' },
  { title: 'Terminal', icon: Terminal, path: '/terminal', permission: 'terminal:access' },
  { title: 'Cron Jobs', icon: Clock, path: '/cron/jobs', permission: 'cron:read' },
  { title: 'Firewall', icon: Shield, path: '/firewall/rules', permission: 'firewall:read' },
  {
    title: 'Settings',
    icon: Settings,
    permission: 'users:read',
    showIfAnyChild: true,
    children: [
      { title: 'Users', path: '/settings/users', permission: 'users:read' },
      { title: 'Roles', path: '/settings/roles', permission: 'users:read' },
      { title: 'Teams', path: '/settings/teams', permission: 'users:read' },
      { title: 'Plugins', path: '/settings/plugins', permission: 'plugins:read' },
      { title: 'License', path: '/settings/license', permission: 'settings:read' },
      { title: 'System', path: '/settings/system', permission: 'settings:read' },
    ],
  },
  { title: 'Audit Logs', icon: FileText, path: '/logs/audit', permission: 'audit:read' },
];

export default function Sidebar() {
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isPro = useLicenseStore((state) => state.isPro());
  const { can, isAdmin, isLoading: permissionsLoading } = usePermission();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const isLight = resolvedMode === 'light';

  // Filter menu items based on user permissions
  const menuItems = useMemo(() => {
    if (permissionsLoading) {
      return staticMenuItems; // Show all items while loading
    }

    return staticMenuItems.filter(item => {
      // Admin sees everything
      if (isAdmin) return true;

      // Items without permission requirement are visible to all
      if (!item.permission) return true;

      // Check parent permission
      if (can(item.permission)) return true;

      // If showIfAnyChild is true, check children permissions
      if (item.showIfAnyChild && item.children) {
        return item.children.some(child => !child.permission || can(child.permission));
      }

      return false;
    }).map(item => {
      // Filter children based on permissions
      if (item.children && !isAdmin) {
        const filteredChildren = item.children.filter(
          child => !child.permission || can(child.permission)
        );
        return { ...item, children: filteredChildren };
      }
      return item;
    });
  }, [can, isAdmin, permissionsLoading]);

  // Auto-expand menu items that contain the current active path
  useEffect(() => {
    const activeParents = menuItems
      .filter((item) => item.children?.some((child) => location.pathname.startsWith(child.path)))
      .map((item) => item.title);
    
    if (activeParents.length > 0) {
      setExpandedItems((prev) => {
        const newItems = [...new Set([...prev, ...activeParents])];
        return newItems;
      });
    }
  }, [location.pathname, menuItems]);

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isChildActive = (children: { path: string }[]) =>
    children.some((child) => location.pathname.startsWith(child.path));

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-30 flex flex-col',
        'transition-all duration-300',
        sidebarCollapsed ? 'w-20' : 'w-64',
        isLight 
          ? 'bg-white border-r border-gray-200' 
          : 'bg-gray-900 border-r border-gray-800'
      )}
    >
      {/* Logo - Dify Style */}
      <div className={cn(
        "h-16 flex items-center justify-between px-4 border-b",
        isLight ? "border-gray-200" : "border-gray-800"
      )}>
        <NavLink to="/" className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300",
            isPro 
              ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-orange-500/30" 
              : "dify-gradient shadow-blue-500/20"
          )}>
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-2 overflow-hidden"
              >
                <span className={cn(
                  "font-semibold text-xl",
                  isPro ? "bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent" : "dify-gradient-text"
                )}>
                  Panel
                </span>
                {isPro && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                    Pro
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </NavLink>
      </div>

      {/* Navigation - Dify Style */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.title}>
              {item.path ? (
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-blue-500/10 text-blue-600 border-l-[3px] border-blue-500 -ml-[3px] pl-[calc(0.75rem+3px)]'
                        : isLight
                          ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                    )
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="truncate"
                      >
                        {item.title}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              ) : (
                <div>
                  <button
                    onClick={() => toggleExpand(item.title)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                      isChildActive(item.children || [])
                        ? 'bg-blue-500/10 text-blue-600 border-l-[3px] border-blue-500 -ml-[3px] pl-[calc(0.75rem+3px)]'
                        : isLight
                          ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <AnimatePresence>
                      {!sidebarCollapsed && (
                        <>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 text-left truncate"
                          >
                            {item.title}
                          </motion.span>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <ChevronDown
                              className={cn(
                                'w-4 h-4 transition-transform',
                                expandedItems.includes(item.title) && 'rotate-180'
                              )}
                            />
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </button>

                  <AnimatePresence>
                    {!sidebarCollapsed && expandedItems.includes(item.title) && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden ml-4 mt-1 space-y-1"
                      >
                        {item.children?.map((child) => (
                          <li key={child.path}>
                            <NavLink
                              to={child.path}
                              className={({ isActive }) =>
                                cn(
                                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                                  isActive
                                    ? 'bg-blue-500/10 text-blue-600'
                                    : isLight
                                      ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                                )
                              }
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                              {child.title}
                            </NavLink>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse button - Dify style */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className={cn(
          "absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-lg",
          isLight
            ? "bg-white border border-gray-300 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:bg-gray-700"
        )}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}

