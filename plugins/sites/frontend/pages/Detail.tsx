import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Globe, 
  ArrowLeft,
  RefreshCw, 
  Shield, 
  ShieldCheck, 
  CheckCircle,
  XCircle,
  Clock,
  Server,
  Link as LinkIcon,
  ExternalLink,
  Plus,
  Trash2,
  Settings,
  AlertCircle,
  Download,
  Edit2,
  Layers,
  MoreVertical,
  Search,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabList, Tab } from '@/components/ui/Tabs';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { Checkbox } from '@/components/ui';
import * as sitesApi from '../api/sites';
import type { Site, DNSInfo, DNSRecord, BindingInfo, Subdomain } from '../api/sites';

export default function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [site, setSite] = useState<Site | null>(null);
  const [dnsInfo, setDnsInfo] = useState<DNSInfo | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [bindingInfo, setBindingInfo] = useState<BindingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingDNS, setRefreshingDNS] = useState(false);
  const [requestingSSL, setRequestingSSL] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // 从 URL 参数中获取 tab，默认为 'overview'
    return searchParams.get('tab') || 'overview';
  });
  const [importingDNS, setImportingDNS] = useState(false);

  // Subdomain state
  const [subdomainModal, setSubdomainModal] = useState<{open: boolean; subdomain?: Subdomain}>({ open: false });
  const [newSubdomain, setNewSubdomain] = useState({ name: '', description: '', target: '', record_type: 'A' });
  const [creatingSubdomain, setCreatingSubdomain] = useState(false);
  const [deletingSubdomain, setDeletingSubdomain] = useState<string | null>(null);
  const [selectedSubdomains, setSelectedSubdomains] = useState<Set<string>>(new Set());
  const [deletingSubdomains, setDeletingSubdomains] = useState(false);
  const [showBatchDeleteSubdomainsConfirm, setShowBatchDeleteSubdomainsConfirm] = useState(false);
  const [queryingSubdomainDNS, setQueryingSubdomainDNS] = useState(false);
  const [subdomainDNSInfo, setSubdomainDNSInfo] = useState<DNSInfo | null>(null);

  // DNS Record state
  const [dnsRecordModal, setDnsRecordModal] = useState<{open: boolean; record?: DNSRecord}>({ open: false });
  const [newDnsRecord, setNewDnsRecord] = useState({ type: 'A', name: '@', content: '', ttl: 300, priority: 0 });
  const [creatingDnsRecord, setCreatingDnsRecord] = useState(false);
  const [selectedDnsRecords, setSelectedDnsRecords] = useState<Set<string>>(new Set());
  const [deletingDnsRecords, setDeletingDnsRecords] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  // Binding modal state
  const [bindingModal, setBindingModal] = useState<{
    open: boolean;
    type: 'app' | 'nginx' | 'proxy' | null;
  }>({ open: false, type: null });
  const [availableApps, setAvailableApps] = useState<any[]>([]);
  const [availableNginxSites, setAvailableNginxSites] = useState<any[]>([]);
  const [selectedBindingId, setSelectedBindingId] = useState('');
  const [proxyTarget, setProxyTarget] = useState('');
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    if (id) {
      loadSite();
      loadDNSRecords();
      loadSubdomains();
      loadBindingInfo();
    }
  }, [id]);

  // 监听 URL 参数变化，更新 activeTab
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'subdomains', 'dns', 'ssl', 'binding'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  async function loadSite() {
    try {
      setLoading(true);
      const data = await sitesApi.getSite(id!);
      setSite(data);
    } catch (error) {
      console.error('Failed to load site:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDNSRecords() {
    try {
      const records = await sitesApi.listDNSRecords(id!);
      setDnsRecords(records || []);
    } catch (error) {
      console.error('Failed to load DNS records:', error);
    }
  }

  async function loadSubdomains() {
    try {
      const subs = await sitesApi.listSubdomains(id!);
      setSubdomains(subs || []);
    } catch (error) {
      console.error('Failed to load subdomains:', error);
    }
  }

  async function handleImportDNS() {
    try {
      setImportingDNS(true);
      await sitesApi.importDNSRecords(id!);
      await loadDNSRecords();
    } catch (error) {
      console.error('Failed to import DNS records:', error);
    } finally {
      setImportingDNS(false);
    }
  }

  async function querySubdomainDNS(subdomainName: string) {
    if (!subdomainName || !site) return;
    
    const fullDomain = `${subdomainName}.${site.domain}`;
    setQueryingSubdomainDNS(true);
    setSubdomainDNSInfo(null);
    
    try {
      const dnsInfo = await sitesApi.lookupDNS(fullDomain);
      setSubdomainDNSInfo(dnsInfo);
      
      // 查找 A、AAAA 或 CNAME 记录
      const aRecord = dnsInfo.records?.find(r => r.type === 'A');
      const aaaaRecord = dnsInfo.records?.find(r => r.type === 'AAAA');
      const cnameRecord = dnsInfo.records?.find(r => r.type === 'CNAME');
      
      // 优先使用 A 记录，然后是 CNAME，最后是 AAAA
      if (aRecord && aRecord.values.length > 0) {
        setNewSubdomain(prev => ({
          ...prev,
          record_type: 'A',
          target: aRecord.values[0]
        }));
      } else if (cnameRecord && cnameRecord.values.length > 0) {
        setNewSubdomain(prev => ({
          ...prev,
          record_type: 'CNAME',
          target: cnameRecord.values[0]
        }));
      } else if (aaaaRecord && aaaaRecord.values.length > 0) {
        setNewSubdomain(prev => ({
          ...prev,
          record_type: 'AAAA',
          target: aaaaRecord.values[0]
        }));
      } else {
        // 如果没有找到记录，保持默认值
        setNewSubdomain(prev => ({
          ...prev,
          target: '',
          record_type: 'A'
        }));
      }
    } catch (error) {
      console.error('Failed to query subdomain DNS:', error);
      // 查询失败时，清空 target，让用户手动输入
      setNewSubdomain(prev => ({
        ...prev,
        target: '',
        record_type: 'A'
      }));
    } finally {
      setQueryingSubdomainDNS(false);
    }
  }

  async function handleCreateSubdomain() {
    if (!newSubdomain.name) return;
    try {
      setCreatingSubdomain(true);
      await sitesApi.createSubdomain(id!, newSubdomain);
      setSubdomainModal({ open: false });
      setNewSubdomain({ name: '', description: '', target: '', record_type: 'A' });
      setSubdomainDNSInfo(null);
      await loadSubdomains();
    } catch (error) {
      console.error('Failed to create subdomain:', error);
    } finally {
      setCreatingSubdomain(false);
    }
  }

  async function handleDeleteSubdomain(subdomainId: string) {
    try {
      setDeletingSubdomain(subdomainId);
      await sitesApi.deleteSubdomain(id!, subdomainId);
      await loadSubdomains();
    } catch (error) {
      console.error('Failed to delete subdomain:', error);
    } finally {
      setDeletingSubdomain(null);
    }
  }

  async function handleBatchDeleteSubdomains() {
    if (selectedSubdomains.size === 0) return;
    setShowBatchDeleteSubdomainsConfirm(true);
  }

  async function confirmBatchDeleteSubdomains() {
    if (selectedSubdomains.size === 0) return;
    try {
      setDeletingSubdomains(true);
      const deletePromises = Array.from(selectedSubdomains).map(subdomainId =>
        sitesApi.deleteSubdomain(id!, subdomainId)
      );
      await Promise.all(deletePromises);
      setSelectedSubdomains(new Set());
      await loadSubdomains();
    } catch (error) {
      console.error('Failed to delete subdomains:', error);
    } finally {
      setDeletingSubdomains(false);
      setShowBatchDeleteSubdomainsConfirm(false);
    }
  }

  function handleSelectSubdomain(subdomainId: string, checked: boolean) {
    const newSelected = new Set(selectedSubdomains);
    if (checked) {
      newSelected.add(subdomainId);
    } else {
      newSelected.delete(subdomainId);
    }
    setSelectedSubdomains(newSelected);
  }

  function handleSelectAllSubdomains(checked: boolean) {
    if (checked) {
      setSelectedSubdomains(new Set(subdomains.map(s => s.id)));
    } else {
      setSelectedSubdomains(new Set());
    }
  }

  async function handleVerifySubdomain(subdomainId: string) {
    try {
      await sitesApi.verifySubdomain(id!, subdomainId);
      await loadSubdomains();
    } catch (error) {
      console.error('Failed to verify subdomain:', error);
    }
  }

  async function handleCreateDnsRecord() {
    if (!newDnsRecord.content) return;
    try {
      setCreatingDnsRecord(true);
      await sitesApi.createDNSRecord(id!, newDnsRecord);
      setDnsRecordModal({ open: false });
      setNewDnsRecord({ type: 'A', name: '@', content: '', ttl: 300, priority: 0 });
      await loadDNSRecords();
    } catch (error) {
      console.error('Failed to create DNS record:', error);
    } finally {
      setCreatingDnsRecord(false);
    }
  }

  async function handleDeleteDnsRecord(recordId: string) {
    try {
      await sitesApi.deleteDNSRecord(id!, recordId);
      await loadDNSRecords();
      setSelectedDnsRecords(new Set());
    } catch (error) {
      console.error('Failed to delete DNS record:', error);
    }
  }

  async function handleBatchDeleteDnsRecords() {
    if (selectedDnsRecords.size === 0) return;
    setShowBatchDeleteConfirm(true);
  }

  async function confirmBatchDeleteDnsRecords() {
    if (selectedDnsRecords.size === 0) return;
    try {
      setDeletingDnsRecords(true);
      const deletePromises = Array.from(selectedDnsRecords).map(recordId =>
        sitesApi.deleteDNSRecord(id!, recordId)
      );
      await Promise.all(deletePromises);
      setSelectedDnsRecords(new Set());
      await loadDNSRecords();
    } catch (error) {
      console.error('Failed to delete DNS records:', error);
    } finally {
      setDeletingDnsRecords(false);
      setShowBatchDeleteConfirm(false);
    }
  }

  function handleSelectDnsRecord(recordId: string, checked: boolean) {
    const newSelected = new Set(selectedDnsRecords);
    if (checked) {
      newSelected.add(recordId);
    } else {
      newSelected.delete(recordId);
    }
    setSelectedDnsRecords(newSelected);
  }

  function handleSelectAllDnsRecords(checked: boolean) {
    if (checked) {
      setSelectedDnsRecords(new Set(dnsRecords.map(r => r.id)));
    } else {
      setSelectedDnsRecords(new Set());
    }
  }

  async function handleVerifyDnsRecord(recordId: string) {
    try {
      await sitesApi.verifyDNSRecord(id!, recordId);
      await loadDNSRecords();
    } catch (error) {
      console.error('Failed to verify DNS record:', error);
    }
  }

  async function loadBindingInfo() {
    try {
      const info = await sitesApi.getBindingInfo(id!);
      setBindingInfo(info);
    } catch (error) {
      console.error('Failed to load binding info:', error);
    }
  }

  async function handleRefreshDNS() {
    try {
      setRefreshingDNS(true);
      const info = await sitesApi.refreshDNS(id!);
      setDnsInfo(info);
      await loadSite();
    } catch (error) {
      console.error('Failed to refresh DNS:', error);
    } finally {
      setRefreshingDNS(false);
    }
  }

  async function handleRequestSSL() {
    try {
      setRequestingSSL(true);
      await sitesApi.requestSSL(id!);
      await loadSite();
    } catch (error) {
      console.error('Failed to request SSL:', error);
    } finally {
      setRequestingSSL(false);
    }
  }

  async function openBindingModal(type: 'app' | 'nginx' | 'proxy') {
    setBindingModal({ open: true, type });
    setSelectedBindingId('');
    setProxyTarget('');

    if (type === 'app') {
      try {
        const apps = await sitesApi.getAvailableApps();
        setAvailableApps(apps || []);
      } catch (error) {
        console.error('Failed to load apps:', error);
      }
    } else if (type === 'nginx') {
      try {
        const sites = await sitesApi.getAvailableNginxSites();
        setAvailableNginxSites(sites || []);
      } catch (error) {
        console.error('Failed to load nginx sites:', error);
      }
    }
  }

  async function handleBind() {
    if (!bindingModal.type) return;

    try {
      setBinding(true);
      switch (bindingModal.type) {
        case 'app':
          await sitesApi.bindToApp(id!, { app_id: selectedBindingId });
          break;
        case 'nginx':
          await sitesApi.bindToNginxSite(id!, { nginx_site_id: selectedBindingId });
          break;
        case 'proxy':
          await sitesApi.bindToProxy(id!, { target: proxyTarget });
          break;
      }
      setBindingModal({ open: false, type: null });
      await loadSite();
      await loadBindingInfo();
    } catch (error) {
      console.error('Failed to bind:', error);
    } finally {
      setBinding(false);
    }
  }

  async function handleUnbind() {
    try {
      await sitesApi.unbindSite(id!);
      await loadSite();
      await loadBindingInfo();
    } catch (error) {
      console.error('Failed to unbind:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Site not found</p>
        <Link to="/sites">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sites
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/sites">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {site.domain}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={site.status === 'active' ? 'success' : site.status === 'pending' ? 'warning' : 'danger'}>
                  {site.status}
                </Badge>
                {site.dns_provider && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {site.dns_provider}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`https://${site.domain}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Visit Site
          </Button>
          <Button
            variant="outline"
            onClick={handleRefreshDNS}
            loading={refreshingDNS}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh DNS
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(tab) => {
        setActiveTab(tab);
        // 更新 URL 参数，但不刷新页面
        navigate(`/sites/${id}?tab=${tab}`, { replace: true });
      }}>
        <TabList>
          <Tab value="overview">Overview</Tab>
          <Tab value="subdomains">Subdomains</Tab>
          <Tab value="dns">DNS Records</Tab>
          <Tab value="ssl">SSL</Tab>
          <Tab value="binding">Binding</Tab>
        </TabList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* DNS Status */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              DNS Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">DNS Verified</span>
                <Badge variant={site.dns_verified ? 'success' : 'warning'}>
                  {site.dns_verified ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 mr-1" />
                      Pending
                    </>
                  )}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Provider</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {site.dns_provider || 'Unknown'}
                </span>
              </div>
              {site.nameservers && site.nameservers.length > 0 && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Nameservers</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {site.nameservers.map((ns, idx) => (
                      <code key={idx} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {ns}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* SSL Status */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              SSL Certificate
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">SSL Enabled</span>
                <Badge variant={site.ssl_enabled ? 'success' : 'gray'}>
                  {site.ssl_enabled ? (
                    <>
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Active
                    </>
                  ) : (
                    <>
                      <Shield className="w-3 h-3 mr-1" />
                      Not Enabled
                    </>
                  )}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Auto Renew</span>
                <Badge variant={site.ssl_auto_renew ? 'success' : 'gray'}>
                  {site.ssl_auto_renew ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {!site.ssl_enabled && (
                <Button
                  onClick={handleRequestSSL}
                  loading={requestingSSL}
                  disabled={!site.dns_verified}
                  className="w-full"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Request SSL Certificate
                </Button>
              )}
              {!site.dns_verified && !site.ssl_enabled && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  DNS must be verified before requesting an SSL certificate
                </p>
              )}
            </div>
          </Card>

          {/* Binding Status */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Service Binding
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Binding Type</span>
                <Badge variant={site.binding_type !== 'none' ? 'primary' : 'gray'}>
                  {site.binding_type === 'app' && <Server className="w-3 h-3 mr-1" />}
                  {site.binding_type === 'proxy' && <LinkIcon className="w-3 h-3 mr-1" />}
                  {site.binding_type === 'none' ? 'Not Connected' : site.binding_type}
                </Badge>
              </div>
              {site.proxy_target && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Target</span>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {site.proxy_target}
                  </code>
                </div>
              )}
              {site.binding_type === 'none' ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openBindingModal('app')}>
                    <Server className="w-4 h-4 mr-1" />
                    Connect App
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openBindingModal('proxy')}>
                    <LinkIcon className="w-4 h-4 mr-1" />
                    Setup Proxy
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={handleUnbind}>
                  <XCircle className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              )}
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Stats
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Created</span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(site.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Last DNS Check</span>
                <span className="text-gray-900 dark:text-white">
                  {site.last_check_at ? new Date(site.last_check_at).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Force HTTPS</span>
                <Badge variant={site.force_https ? 'success' : 'gray'}>
                  {site.force_https ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Subdomains Tab - Vercel-style Card Layout */}
      {activeTab === 'subdomains' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {subdomains.length > 0 && (
                  <Checkbox
                    checked={subdomains.length > 0 && selectedSubdomains.size === subdomains.length}
                    onChange={(e) => handleSelectAllSubdomains(e.target.checked)}
                  />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Subdomains
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Manage subdomains for {site.domain}
                    {selectedSubdomains.size > 0 && (
                      <span className="ml-2 text-blue-600 dark:text-blue-400">
                        ({selectedSubdomains.size} selected)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedSubdomains.size > 0 && (
                  <Button 
                    variant="danger" 
                    onClick={handleBatchDeleteSubdomains}
                    disabled={deletingSubdomains}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected ({selectedSubdomains.size})
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={async () => {
                    await sitesApi.refreshAllScreenshots(id!);
                    setTimeout(() => loadSubdomains(), 3000);
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Screenshots
                </Button>
                <Button onClick={() => setSubdomainModal({ open: true })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subdomain
                </Button>
              </div>
            </div>
          </Card>

          {subdomains.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subdomains.map((sub) => (
                <Card 
                  key={sub.id} 
                  className={`overflow-hidden hover:shadow-lg transition-shadow ${selectedSubdomains.has(sub.id) ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
                >
                  {/* Screenshot Preview */}
                  <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {sub.screenshot_url ? (
                      <img
                        src={sub.screenshot_url}
                        alt={sub.full_domain}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                        <Globe className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-sm">No preview available</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="mt-2"
                          onClick={() => sitesApi.takeSubdomainScreenshot(id!, sub.id).then(() => loadSubdomains())}
                        >
                          Capture Screenshot
                        </Button>
                      </div>
                    )}
                    {/* Checkbox Overlay */}
                    <div 
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white dark:bg-gray-800 rounded-md p-1 shadow-sm">
                        <Checkbox
                          checked={selectedSubdomains.has(sub.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectSubdomain(sub.id, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {/* Status Badge Overlay */}
                    <div className="absolute top-2 right-2">
                      <Badge 
                        variant={sub.status === 'active' ? 'success' : sub.status === 'pending' ? 'warning' : 'gray'}
                        className="shadow-sm"
                      >
                        {sub.dns_verified && <CheckCircle className="w-3 h-3 mr-1" />}
                        {sub.status}
                      </Badge>
                    </div>
                    {/* Visit Button Overlay */}
                    <a
                      href={`https://${sub.full_domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors group pointer-events-none"
                      onClick={(e) => {
                        // Only allow click if not clicking on checkbox area
                        const target = e.target as HTMLElement;
                        if (target.closest('.absolute.top-2.left-2')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <span 
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white flex items-center gap-2 bg-black/60 px-4 py-2 rounded-lg pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Visit Site
                      </span>
                    </a>
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                          {sub.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {sub.full_domain}
                        </p>
                      </div>
                      <Dropdown
                        trigger={
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        }
                      >
                        <DropdownItem 
                          icon={<RefreshCw className="w-4 h-4" />} 
                          onClick={() => sitesApi.takeSubdomainScreenshot(id!, sub.id).then(() => loadSubdomains())}
                        >
                          Update Screenshot
                        </DropdownItem>
                        <DropdownItem 
                          icon={<CheckCircle className="w-4 h-4" />} 
                          onClick={() => handleVerifySubdomain(sub.id)}
                        >
                          Verify DNS
                        </DropdownItem>
                        <DropdownItem 
                          icon={<ExternalLink className="w-4 h-4" />} 
                          onClick={() => window.open(`https://${sub.full_domain}`, '_blank')}
                        >
                          Visit
                        </DropdownItem>
                        <DropdownDivider />
                        <DropdownItem 
                          icon={<Trash2 className="w-4 h-4" />} 
                          onClick={() => handleDeleteSubdomain(sub.id)}
                          danger
                        >
                          Delete
                        </DropdownItem>
                      </Dropdown>
                    </div>

                    {/* Record Info */}
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Badge variant="gray" className="font-mono">
                        {sub.record_type}
                      </Badge>
                      <span className="truncate font-mono">
                        → {sub.target || sub.proxy_target || 'Not configured'}
                      </span>
                    </div>

                    {/* Binding Info */}
                    {sub.binding_type && sub.binding_type !== 'none' && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <Server className="w-3 h-3 text-blue-500" />
                        <span className="text-blue-600 dark:text-blue-400">
                          Bound to {sub.binding_type}
                        </span>
                      </div>
                    )}

                    {/* Screenshot timestamp */}
                    {sub.screenshot_at && (
                      <p className="mt-2 text-xs text-gray-400">
                        Screenshot: {new Date(sub.screenshot_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No subdomains yet
                </h4>
                <p className="mb-4">
                  Add subdomains to serve content on different URLs under your domain.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button onClick={() => setSubdomainModal({ open: true })}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Subdomain
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* DNS Records Tab */}
      {activeTab === 'dns' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                DNS Records
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage DNS records for your domain
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedDnsRecords.size > 0 && (
                <Button 
                  variant="danger" 
                  onClick={handleBatchDeleteDnsRecords}
                  disabled={deletingDnsRecords}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedDnsRecords.size})
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={async () => {
                  await sitesApi.cleanDNSRecords(id!);
                  await loadDNSRecords();
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clean Duplicates
              </Button>
              <Button variant="outline" onClick={handleImportDNS} loading={importingDNS}>
                <Download className="w-4 h-4 mr-2" />
                Import from DNS
              </Button>
              <Button variant="outline" onClick={handleRefreshDNS} loading={refreshingDNS}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setDnsRecordModal({ open: true })}>
                <Plus className="w-4 h-4 mr-2" />
                Add Record
              </Button>
            </div>
          </div>

          {dnsRecords.length > 0 ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left w-12">
                      <Checkbox
                        checked={dnsRecords.length > 0 && selectedDnsRecords.size === dnsRecords.length}
                        onChange={(e) => handleSelectAllDnsRecords(e.target.checked)}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Content</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">TTL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {dnsRecords.map((record) => (
                    <tr 
                      key={record.id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selectedDnsRecords.has(record.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedDnsRecords.has(record.id)}
                          onChange={(e) => handleSelectDnsRecord(record.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="primary">{record.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                        {record.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate font-mono">
                        {record.content}
                        {record.priority > 0 && <span className="text-gray-400 ml-2">(Priority: {record.priority})</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {record.ttl}s
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {record.verified ? (
                            <Badge variant="success" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="gray">Unverified</Badge>
                          )}
                          {record.proxied && (
                            <Badge variant="info">Proxied</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Dropdown
                          trigger={
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          }
                        >
                          <DropdownItem icon={<CheckCircle className="w-4 h-4" />} onClick={() => handleVerifyDnsRecord(record.id)}>
                            Verify
                          </DropdownItem>
                          <DropdownItem icon={<Edit2 className="w-4 h-4" />} onClick={() => setDnsRecordModal({ open: true, record })}>
                            Edit
                          </DropdownItem>
                          <DropdownDivider />
                          <DropdownItem 
                            icon={<Trash2 className="w-4 h-4" />} 
                            onClick={() => handleDeleteDnsRecord(record.id)}
                            danger
                          >
                            Delete
                          </DropdownItem>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : dnsInfo?.records && dnsInfo.records.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                DNS records found from lookup. Click "Import from DNS" to add them to your management.
              </p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Value</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">TTL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {dnsInfo.records.map((record, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <Badge variant="gray">{record.type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                          {record.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md truncate font-mono">
                          {record.values.join(', ')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {record.ttl || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No DNS records found. Click refresh to load DNS information or add records manually.</p>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'ssl' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            SSL Certificate Management
          </h3>

          {site.ssl_enabled ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <ShieldCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    SSL Certificate Active
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Your site is secured with HTTPS
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Auto Renew</span>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                    {site.ssl_auto_renew ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                    {site.ssl_status || 'Active'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <Shield className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    No SSL Certificate
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Request a free Let's Encrypt certificate to secure your site
                  </p>
                </div>
              </div>

              <Button
                onClick={handleRequestSSL}
                loading={requestingSSL}
                disabled={!site.dns_verified}
                size="lg"
              >
                <ShieldCheck className="w-5 h-5 mr-2" />
                Request SSL Certificate
              </Button>

              {!site.dns_verified && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  DNS must be verified before requesting an SSL certificate
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'binding' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Service Binding
          </h3>

          {site.binding_type !== 'none' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Server className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Connected to {site.binding_type === 'app' ? 'Application' : site.binding_type === 'nginx_site' ? 'Nginx Site' : 'Proxy'}
                  </p>
                  {site.proxy_target && (
                    <code className="text-sm text-blue-600 dark:text-blue-400">
                      {site.proxy_target}
                    </code>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleUnbind}>
                  <XCircle className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              </div>

              {bindingInfo?.app && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Bound Application
                  </h4>
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {bindingInfo.app.name}
                      </p>
                      <Badge variant={bindingInfo.app.status === 'running' ? 'success' : 'gray'} className="mt-1">
                        {bindingInfo.app.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-gray-500 dark:text-gray-400">
                Connect this domain to an application or service to start serving content.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => openBindingModal('app')}
                  className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                >
                  <Server className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-3" />
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Connect to App
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Bind to a deployed application
                  </p>
                </button>

                <button
                  onClick={() => openBindingModal('nginx')}
                  className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
                >
                  <Globe className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-3" />
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Connect to Nginx Site
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Bind to an existing Nginx site
                  </p>
                </button>

                <button
                  onClick={() => openBindingModal('proxy')}
                  className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left"
                >
                  <LinkIcon className="w-8 h-8 text-green-600 dark:text-green-400 mb-3" />
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Setup Proxy
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Reverse proxy to any URL
                  </p>
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Binding Modal */}
      <Modal
        open={bindingModal.open}
        onClose={() => setBindingModal({ open: false, type: null })}
        title={
          bindingModal.type === 'app' ? 'Connect to Application' :
          bindingModal.type === 'nginx' ? 'Connect to Nginx Site' :
          'Setup Proxy'
        }
      >
        <div className="space-y-4">
          {bindingModal.type === 'app' && (
            <>
              <p className="text-gray-500 dark:text-gray-400">
                Select an application to connect this domain to:
              </p>
              <select
                value={selectedBindingId}
                onChange={(e) => setSelectedBindingId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select an application...</option>
                {availableApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name} ({app.status})
                  </option>
                ))}
              </select>
            </>
          )}

          {bindingModal.type === 'nginx' && (
            <>
              <p className="text-gray-500 dark:text-gray-400">
                Select an Nginx site to connect this domain to:
              </p>
              <select
                value={selectedBindingId}
                onChange={(e) => setSelectedBindingId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select a site...</option>
                {availableNginxSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} - {site.domain}
                  </option>
                ))}
              </select>
            </>
          )}

          {bindingModal.type === 'proxy' && (
            <>
              <p className="text-gray-500 dark:text-gray-400">
                Enter the target URL to proxy requests to:
              </p>
              <input
                type="text"
                value={proxyTarget}
                onChange={(e) => setProxyTarget(e.target.value)}
                placeholder="http://localhost:3000"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setBindingModal({ open: false, type: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBind}
              loading={binding}
              disabled={
                (bindingModal.type !== 'proxy' && !selectedBindingId) ||
                (bindingModal.type === 'proxy' && !proxyTarget)
              }
            >
              Connect
            </Button>
          </div>
        </div>
      </Modal>

      {/* Subdomain Modal */}
      <Modal
        open={subdomainModal.open}
        onClose={() => {
          setSubdomainModal({ open: false });
          setNewSubdomain({ name: '', description: '', target: '', record_type: 'A' });
          setSubdomainDNSInfo(null);
        }}
        title="Add Subdomain"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subdomain Name *
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center flex-1">
                <input
                  type="text"
                  value={newSubdomain.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewSubdomain({ ...newSubdomain, name });
                    // 当名称改变时，清空之前查询的结果
                    if (name !== newSubdomain.name) {
                      setSubdomainDNSInfo(null);
                      setNewSubdomain(prev => ({ ...prev, target: '', record_type: 'A' }));
                    }
                  }}
                  onBlur={() => {
                    // 当失去焦点时，如果名称不为空，自动查询 DNS
                    if (newSubdomain.name.trim() && site) {
                      querySubdomainDNS(newSubdomain.name.trim());
                    }
                  }}
                  placeholder="www, api, blog..."
                  className="flex-1 px-4 py-2 rounded-l-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <span className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg text-gray-600 dark:text-gray-400">
                  .{site?.domain}
                </span>
              </div>
              {newSubdomain.name.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => querySubdomainDNS(newSubdomain.name.trim())}
                  loading={queryingSubdomainDNS}
                  disabled={!newSubdomain.name.trim()}
                  title="Query DNS records from authoritative server"
                >
                  <Search className="w-4 h-4" />
                </Button>
              )}
            </div>
            {queryingSubdomainDNS && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Querying DNS records from authoritative server...
              </p>
            )}
            {subdomainDNSInfo && !queryingSubdomainDNS && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                  DNS Records Found:
                </p>
                <div className="space-y-1">
                  {subdomainDNSInfo.records
                    ?.filter(r => ['A', 'AAAA', 'CNAME'].includes(r.type))
                    .slice(0, 3)
                    .map((record, idx) => (
                      <div key={idx} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <Badge variant="primary" className="text-xs">
                          {record.type}
                        </Badge>
                        <span className="font-mono">{record.values[0]}</span>
                        {record.values.length > 1 && (
                          <span className="text-gray-500">+{record.values.length - 1} more</span>
                        )}
                      </div>
                    ))}
                  {subdomainDNSInfo.records?.filter(r => ['A', 'AAAA', 'CNAME'].includes(r.type)).length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No A, AAAA, or CNAME records found. You can manually enter the target.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={newSubdomain.description}
              onChange={(e) => setNewSubdomain({ ...newSubdomain, description: e.target.value })}
              placeholder="Optional description"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Record Type
              </label>
              <select
                value={newSubdomain.record_type}
                onChange={(e) => setNewSubdomain({ ...newSubdomain, record_type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="A">A (IPv4)</option>
                <option value="AAAA">AAAA (IPv6)</option>
                <option value="CNAME">CNAME</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target {newSubdomain.target && subdomainDNSInfo && (
                  <span className="text-xs text-green-600 dark:text-green-400 ml-1">(Auto-filled)</span>
                )}
              </label>
              <input
                type="text"
                value={newSubdomain.target}
                onChange={(e) => setNewSubdomain({ ...newSubdomain, target: e.target.value })}
                placeholder={newSubdomain.record_type === 'CNAME' ? 'target.example.com' : '192.168.1.1'}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setSubdomainModal({ open: false })}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubdomain} loading={creatingSubdomain} disabled={!newSubdomain.name}>
              <Plus className="w-4 h-4 mr-2" />
              Add Subdomain
            </Button>
          </div>
        </div>
      </Modal>

      {/* DNS Record Modal */}
      <Modal
        open={dnsRecordModal.open}
        onClose={() => setDnsRecordModal({ open: false })}
        title={dnsRecordModal.record ? 'Edit DNS Record' : 'Add DNS Record'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type *
              </label>
              <select
                value={newDnsRecord.type}
                onChange={(e) => setNewDnsRecord({ ...newDnsRecord, type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX</option>
                <option value="TXT">TXT</option>
                <option value="NS">NS</option>
                <option value="SRV">SRV</option>
                <option value="CAA">CAA</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={newDnsRecord.name}
                onChange={(e) => setNewDnsRecord({ ...newDnsRecord, name: e.target.value })}
                placeholder="@ for root, or subdomain"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content *
            </label>
            <input
              type="text"
              value={newDnsRecord.content}
              onChange={(e) => setNewDnsRecord({ ...newDnsRecord, content: e.target.value })}
              placeholder={
                newDnsRecord.type === 'A' ? '192.168.1.1' :
                newDnsRecord.type === 'AAAA' ? '2001:db8::1' :
                newDnsRecord.type === 'CNAME' ? 'target.example.com' :
                newDnsRecord.type === 'MX' ? 'mail.example.com' :
                newDnsRecord.type === 'TXT' ? 'v=spf1 include:_spf.example.com ~all' :
                'value'
              }
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                TTL (seconds)
              </label>
              <input
                type="number"
                value={newDnsRecord.ttl}
                onChange={(e) => setNewDnsRecord({ ...newDnsRecord, ttl: parseInt(e.target.value) || 300 })}
                min={60}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            {(newDnsRecord.type === 'MX' || newDnsRecord.type === 'SRV') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  value={newDnsRecord.priority}
                  onChange={(e) => setNewDnsRecord({ ...newDnsRecord, priority: parseInt(e.target.value) || 0 })}
                  min={0}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDnsRecordModal({ open: false })}>
              Cancel
            </Button>
            <Button onClick={handleCreateDnsRecord} loading={creatingDnsRecord} disabled={!newDnsRecord.content}>
              <Plus className="w-4 h-4 mr-2" />
              {dnsRecordModal.record ? 'Update Record' : 'Add Record'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch Delete DNS Records Confirmation Modal */}
      <ConfirmModal
        open={showBatchDeleteConfirm}
        onClose={() => setShowBatchDeleteConfirm(false)}
        onConfirm={confirmBatchDeleteDnsRecords}
        title="Delete DNS Records"
        message={`Are you sure you want to delete ${selectedDnsRecords.size} DNS record(s)? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={deletingDnsRecords}
      />

      {/* Batch Delete Subdomains Confirmation Modal */}
      <ConfirmModal
        open={showBatchDeleteSubdomainsConfirm}
        onClose={() => setShowBatchDeleteSubdomainsConfirm(false)}
        onConfirm={confirmBatchDeleteSubdomains}
        title="Delete Subdomains"
        message={`Are you sure you want to delete ${selectedSubdomains.size} subdomain(s)? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={deletingSubdomains}
      />
    </div>
  );
}
