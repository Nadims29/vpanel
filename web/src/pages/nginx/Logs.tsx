import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Copy,
  Download,
  Search,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Tabs,
  TabList,
  Tab,
  Badge,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as nginxApi from '@/api/nginx';
import type { NginxSite } from '@/api/nginx';

export default function NginxLogs() {
  const [logType, setLogType] = useState<'access' | 'error'>('access');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [sites, setSites] = useState<NginxSite[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch sites list
  const fetchSites = useCallback(async () => {
    try {
      const siteList = await nginxApi.listSites();
      setSites(siteList);
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    }
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      let logData: { logs: string[] };

      if (logType === 'access') {
        logData = await nginxApi.getAccessLogs(selectedSiteId ? selectedSiteId : '', lines);
      } else {
        logData = await nginxApi.getErrorLogs(selectedSiteId ? selectedSiteId : '', lines);
      }

      setLogs(logData.logs || []);
      
      // Auto scroll to bottom
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [logType, selectedSiteId, lines, loading]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logType, selectedSiteId, lines]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs();
      }, 5000); // Refresh every 5 seconds
      setAutoRefreshInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        setAutoRefreshInterval(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, fetchLogs]);

  const handleCopy = () => {
    const logText = filteredLogs.join('\n');
    navigator.clipboard.writeText(logText);
    toast.success('Logs copied to clipboard');
  };

  const handleDownload = () => {
    const logText = filteredLogs.join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${logType}-${selectedSiteId || 'all'}-${new Date().toISOString()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Logs downloaded');
  };

  // Filter logs by search query
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    return log.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Parse log line for highlighting
  const parseLogLine = (line: string, type: 'access' | 'error') => {
    if (!line) return null;

    if (type === 'access') {
      // Nginx access log format: IP - - [timestamp] "method path protocol" status bytes "referer" "user-agent"
      const ipMatch = line.match(/^(\S+)/);
      const statusMatch = line.match(/\s(\d{3})\s/);
      const methodMatch = line.match(/"(\w+)\s/);
      const pathMatch = line.match(/"\w+\s([^\s"]+)/);
      const timestampMatch = line.match(/\[([^\]]+)\]/);

      return {
        ip: ipMatch ? ipMatch[1] : '',
        status: statusMatch ? statusMatch[1] : '',
        method: methodMatch ? methodMatch[1] : '',
        path: pathMatch ? pathMatch[1] : '',
        timestamp: timestampMatch ? timestampMatch[1] : '',
        raw: line,
      };
    } else {
      // Error log format: timestamp [level] message
      const levelMatch = line.match(/\[(\w+)\]/);
      const timestampMatch = line.match(/^\d{4}\/\d{2}\/\d{2}/);

      return {
        level: levelMatch ? levelMatch[1] : '',
        timestamp: timestampMatch ? line.substring(0, 19) : '',
        raw: line,
      };
    }
  };

  const getStatusColor = (status: string) => {
    const code = parseInt(status);
    if (code >= 200 && code < 300) return 'text-green-400';
    if (code >= 300 && code < 400) return 'text-blue-400';
    if (code >= 400 && code < 500) return 'text-yellow-400';
    if (code >= 500) return 'text-red-400';
    return 'text-dark-300';
  };

  const getLevelColor = (level: string) => {
    const l = level.toLowerCase();
    if (l === 'error' || l === 'crit' || l === 'alert' || l === 'emerg') return 'text-red-400';
    if (l === 'warn') return 'text-yellow-400';
    if (l === 'info') return 'text-blue-400';
    return 'text-dark-300';
  };

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dark-100">Nginx Logs</h1>
          <p className="text-dark-400">View access and error logs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />}
            onClick={fetchLogs}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button variant="secondary" leftIcon={<Copy className="w-4 h-4" />} onClick={handleCopy}>
            Copy
          </Button>
          <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />} onClick={handleDownload}>
            Download
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Log Type</label>
            <Tabs value={logType} onChange={(v) => setLogType(v as typeof logType)}>
              <TabList>
                <Tab value="access" onClick={() => setLogType('access')}>Access</Tab>
                <Tab value="error" onClick={() => setLogType('error')}>Error</Tab>
              </TabList>
            </Tabs>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Site</label>
            <Select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
            >
              <option value="">All Sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.domain}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Lines</label>
            <Select value={lines.toString()} onChange={(e) => setLines(parseInt(e.target.value))}>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Auto Refresh</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-dark-400">Every 5s</span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-dark-300 mb-1.5">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-500" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Logs Display */}
      <Card padding={false} className="overflow-hidden">
        <div className="bg-dark-900/50 border-b border-dark-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logType === 'access' ? (
              <FileText className="w-5 h-5 text-blue-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <div>
              <h3 className="font-medium text-dark-100">
                {logType === 'access' ? 'Access Logs' : 'Error Logs'}
              </h3>
              <p className="text-xs text-dark-500">
                {selectedSite ? `Site: ${selectedSite.domain}` : 'All Sites'} • {filteredLogs.length} lines
                {searchQuery && ` (filtered from ${logs.length})`}
              </p>
            </div>
          </div>
          {autoRefresh && (
            <Badge variant="success" dot>
              Auto-refreshing
            </Badge>
          )}
        </div>
        <div className="bg-dark-950 p-4 font-mono text-sm max-h-[600px] overflow-auto">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              {searchQuery ? 'No logs match your search' : 'No logs available'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((line, index) => {
                const parsed = parseLogLine(line, logType);
                if (!parsed) {
                  return (
                    <div key={index} className="text-dark-400">
                      {line}
                    </div>
                  );
                }

                if (logType === 'access') {
                  return (
                    <div key={index} className="hover:bg-dark-900/50 rounded px-2 py-1 group">
                      <div className="flex items-start gap-2 flex-wrap">
                        {parsed.timestamp && (
                          <span className="text-dark-500 text-xs">{parsed.timestamp}</span>
                        )}
                        {parsed.ip && (
                          <span className="text-blue-400 font-semibold">{parsed.ip}</span>
                        )}
                        {parsed.method && (
                          <Badge variant="gray" className="text-xs">
                            {parsed.method}
                          </Badge>
                        )}
                        {parsed.path && (
                          <span className="text-dark-200">{parsed.path}</span>
                        )}
                        {parsed.status && (
                          <span className={cn('font-semibold', getStatusColor(parsed.status))}>
                            {parsed.status}
                          </span>
                        )}
                      </div>
                      <div className="text-dark-400 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {parsed.raw}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={index} className="hover:bg-dark-900/50 rounded px-2 py-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        {parsed.timestamp && (
                          <span className="text-dark-500 text-xs">{parsed.timestamp}</span>
                        )}
                        {parsed.level && (
                          <Badge
                            variant={parsed.level.toLowerCase() === 'error' ? 'danger' : 'warning'}
                            className="text-xs"
                          >
                            {parsed.level}
                          </Badge>
                        )}
                        <span className={cn('flex-1', getLevelColor(parsed.level || ''))}>
                          {parsed.raw.replace(/^\d{4}\/\d{2}\/\d{2}.*?\[.*?\]\s*/, '')}
                        </span>
                      </div>
                    </div>
                  );
                }
              })}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
