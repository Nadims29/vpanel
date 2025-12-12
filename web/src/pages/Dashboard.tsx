import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Globe,
  Database,
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  Zap,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardContent, Badge, Button, Spinner } from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as dashboardApi from '@/api/dashboard';
import type { DashboardOverview, SystemMetrics } from '@/api/dashboard';

// Stat card component
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  delay = 0,
  href,
  loading = false,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: 'primary' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  delay?: number;
  href?: string;
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const colorClasses = {
    primary: 'from-primary-500 to-primary-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn('card p-6', href && 'cursor-pointer hover:border-dark-600/50')}
      onClick={() => href && navigate(href)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg',
          colorClasses[color]
        )}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            trend === 'up' ? 'text-green-400' : 'text-red-400'
          )}>
            {trend === 'up' ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {trendValue}
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-12 flex items-center">
          <Spinner size="sm" />
        </div>
      ) : (
        <>
          <h3 className="text-3xl font-bold text-dark-100 mb-1">{value}</h3>
          <p className="text-dark-400">{title}</p>
          {subtitle && <p className="text-sm text-dark-500 mt-1">{subtitle}</p>}
        </>
      )}
    </motion.div>
  );
}

// Resource gauge component
function ResourceGauge({
  title,
  value,
  total,
  unit,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  total: number;
  unit: string;
  icon: React.ElementType;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const formatValue = (val: number) => {
    if (unit === 'GB' || unit === 'MB') {
      return (val / (1024 * 1024 * 1024)).toFixed(1);
    }
    return val.toFixed(1);
  };

  const formatTotal = (val: number) => {
    if (unit === 'GB' || unit === 'MB') {
      return (val / (1024 * 1024 * 1024)).toFixed(0);
    }
    return val.toFixed(0);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-dark-800"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-5 h-5 text-dark-400 mb-1" />
          <span className="text-xl font-bold text-dark-100">{percentage.toFixed(0)}%</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-dark-400">{title}</p>
      <p className="text-xs text-dark-500">{formatValue(value)} / {formatTotal(total)} {unit}</p>
    </div>
  );
}

// Alert item
function AlertItem({
  severity,
  title,
  time,
  node,
}: {
  severity: 'warning' | 'critical' | 'info';
  title: string;
  time: string;
  node?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 hover:bg-dark-800/50 rounded-lg transition-colors cursor-pointer">
      {severity === 'critical' ? (
        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
      ) : severity === 'warning' ? (
        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-4 h-4 text-blue-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-200">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {node && <Badge variant="gray" size="sm">{node}</Badge>}
          <span className="text-xs text-dark-500">{time}</span>
        </div>
      </div>
    </div>
  );
}

// Quick action card
function QuickAction({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  const navigate = useNavigate();
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50 cursor-pointer hover:border-dark-600/50 transition-all"
      onClick={() => navigate(href)}
    >
      <Icon className="w-6 h-6 text-primary-400 mb-2" />
      <h4 className="font-medium text-dark-100 mb-1">{title}</h4>
      <p className="text-xs text-dark-500">{description}</p>
    </motion.div>
  );
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<{ time: string; cpu: number; memory: number }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [overviewData, metricsData] = await Promise.all([
        dashboardApi.getDashboardOverview(),
        dashboardApi.getSystemMetrics(),
      ]);
      
      setOverview(overviewData);
      setMetrics(metricsData);

      // Add to history
      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setMetricsHistory(prev => {
        const newHistory = [...prev, {
          time: now,
          cpu: metricsData.cpu.usage_percent,
          memory: metricsData.memory.used_percent,
        }];
        // Keep last 12 data points
        return newHistory.slice(-12);
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      if (!loading) {
        toast.error('Failed to refresh dashboard data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Container stats for pie chart
  const containerStats = [
    { name: 'Running', value: overview?.running || 0, color: '#22c55e' },
    { name: 'Stopped', value: Math.max(0, (overview?.containers || 0) - (overview?.running || 0)), color: '#64748b' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dark-100">Dashboard</h1>
          <p className="text-dark-400">Overview of your server</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            leftIcon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-300"
          >
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Containers"
          value={overview?.containers || 0}
          subtitle={`${overview?.running || 0} running`}
          icon={Container}
          trend="up"
          trendValue={`+${overview?.running || 0}`}
          color="blue"
          delay={0}
          href="/docker/containers"
        />
        <StatCard
          title="Websites"
          value={overview?.sites || 0}
          subtitle="Nginx sites"
          icon={Globe}
          color="green"
          delay={0.1}
          href="/nginx/sites"
        />
        <StatCard
          title="Databases"
          value={overview?.databases || 0}
          subtitle="Database servers"
          icon={Database}
          color="purple"
          delay={0.2}
          href="/database/servers"
        />
      </div>

      {/* Charts & Resource Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* CPU & Memory Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-400" />
                <h2 className="font-semibold text-dark-100">System Performance</h2>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary-500" />
                  CPU: {metrics?.cpu.usage_percent.toFixed(1)}%
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  Memory: {metrics?.memory.used_percent.toFixed(1)}%
                </span>
              </div>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricsHistory.length > 0 ? metricsHistory : [{ time: 'Now', cpu: 0, memory: 0 }]}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stroke="#06b6d4"
                    fill="url(#cpuGradient)"
                    strokeWidth={2}
                    name="CPU %"
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    stroke="#8b5cf6"
                    fill="url(#memGradient)"
                    strokeWidth={2}
                    name="Memory %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Resource Gauges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-dark-100">Resource Usage</h2>
              <Badge variant={
                metrics && metrics.cpu.usage_percent < 70 && metrics.memory.used_percent < 80 
                  ? 'success' 
                  : 'warning'
              }>
                {metrics && metrics.cpu.usage_percent < 70 && metrics.memory.used_percent < 80 
                  ? 'Healthy' 
                  : 'High Usage'}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <ResourceGauge
                  title="CPU"
                  value={metrics?.cpu.usage_percent || 0}
                  total={100}
                  unit="%"
                  icon={Cpu}
                  color="#06b6d4"
                />
                <ResourceGauge
                  title="Memory"
                  value={metrics?.memory.used || 0}
                  total={metrics?.memory.total || 1}
                  unit="GB"
                  icon={MemoryStick}
                  color="#8b5cf6"
                />
                <ResourceGauge
                  title="Disk"
                  value={metrics?.disk.used || 0}
                  total={metrics?.disk.total || 1}
                  unit="GB"
                  icon={HardDrive}
                  color="#22c55e"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Network & Containers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Network Traffic */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-400" />
                <h2 className="font-semibold text-dark-100">Network Traffic</h2>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  Received: {formatBytes(metrics?.network.bytes_recv || 0)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  Sent: {formatBytes(metrics?.network.bytes_sent || 0)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="h-48">
              <div className="flex items-center justify-center h-full text-dark-500">
                <div className="text-center">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Network: {formatBytes(metrics?.network.bytes_recv || 0)} ↓ / {formatBytes(metrics?.network.bytes_sent || 0)} ↑</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Container Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-dark-100">Containers</h2>
              <span className="text-sm text-dark-400">{overview?.containers || 0} total</span>
            </CardHeader>
            <CardContent>
              <div className="h-36 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={containerStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {containerStats.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {containerStats.map((stat) => (
                  <div key={stat.name} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }} />
                    <span className="text-dark-400">{stat.name}</span>
                    <span className="text-dark-100 font-medium">{stat.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h2 className="font-semibold text-dark-100">Recent Alerts</h2>
              </div>
              <Badge variant={overview?.alerts && overview.alerts > 0 ? 'danger' : 'success'}>
                {overview?.alerts || 0} active
              </Badge>
            </CardHeader>
            <CardContent className="p-2">
              {overview?.alerts && overview.alerts > 0 ? (
                <>
                  <AlertItem
                    severity="warning"
                    title="System monitoring active"
                    time="Just now"
                  />
                  <AlertItem
                    severity="info"
                    title="Dashboard loaded successfully"
                    time="Just now"
                  />
                </>
              ) : (
                <div className="flex items-center justify-center py-8 text-dark-500">
                  <div className="text-center">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <p>No active alerts</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.9 }}
        >
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-dark-100">Quick Actions</h2>
              <Zap className="w-5 h-5 text-primary-400" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction
                  icon={Container}
                  title="New Container"
                  description="Create Docker container"
                  href="/docker/containers"
                />
                <QuickAction
                  icon={Globe}
                  title="Add Site"
                  description="Configure new website"
                  href="/nginx/sites"
                />
                <QuickAction
                  icon={Database}
                  title="Create Database"
                  description="Add new database"
                  href="/database/servers"
                />
                <QuickAction
                  icon={Activity}
                  title="System Monitor"
                  description="View system metrics"
                  href="/monitor"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
