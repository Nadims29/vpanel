import { useState, useEffect, ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Globe, 
  Plus, 
  Search, 
  RefreshCw, 
  Shield, 
  ShieldCheck, 
  ShieldX,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  MoreVertical,
  Trash2,
  Settings,
  Link as LinkIcon,
  Server,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { ConfirmModal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Spinner } from '@/components/ui/Spinner';
import { Empty } from '@/components/ui/Empty';
import { Checkbox } from '@/components/ui';
import toast from 'react-hot-toast';
import * as sitesApi from '../api/sites';
import type { Site, SiteStatus, BindingType } from '../api/sites';

export default function SitesList() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; site: Site | null }>({
    open: false,
    site: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [batchDeleteModal, setBatchDeleteModal] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);

  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    try {
      setLoading(true);
      const data = await sitesApi.listSites();
      console.log('Loaded sites:', data);
      setSites(data || []);
      if (data && data.length === 0) {
        console.warn('No sites found in response');
      }
    } catch (error) {
      console.error('Failed to load sites:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load sites');
      setSites([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteModal.site) return;
    try {
      setDeleting(true);
      await sitesApi.deleteSite(deleteModal.site.id);
      setSites(sites.filter(s => s.id !== deleteModal.site?.id));
      setDeleteModal({ open: false, site: null });
      toast.success(`Site ${deleteModal.site.domain} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete site:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete site');
    } finally {
      setDeleting(false);
    }
  }

  function handleSelectSite(siteId: string, checked: boolean) {
    const newSelected = new Set(selectedSites);
    if (checked) {
      newSelected.add(siteId);
    } else {
      newSelected.delete(siteId);
    }
    setSelectedSites(newSelected);
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedSites(new Set(filteredSites.map(s => s.id)));
    } else {
      setSelectedSites(new Set());
    }
  }

  function handleBatchDelete() {
    if (selectedSites.size === 0) return;
    setBatchDeleteModal(true);
  }

  async function confirmBatchDelete() {
    if (selectedSites.size === 0) return;
    try {
      setDeletingBatch(true);
      const deletePromises = Array.from(selectedSites).map(siteId =>
        sitesApi.deleteSite(siteId)
      );
      await Promise.all(deletePromises);
      const deletedCount = selectedSites.size;
      setSites(sites.filter(s => !selectedSites.has(s.id)));
      setSelectedSites(new Set());
      setBatchDeleteModal(false);
      toast.success(`${deletedCount} site(s) deleted successfully`);
    } catch (error) {
      console.error('Failed to delete sites:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete sites');
    } finally {
      setDeletingBatch(false);
    }
  }

  async function handleRefreshDNS(siteId: string) {
    try {
      await sitesApi.refreshDNS(siteId);
      loadSites();
    } catch (error) {
      console.error('Failed to refresh DNS:', error);
    }
  }

  const filteredSites = sites.filter(site => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      site.domain.toLowerCase().includes(query) ||
      site.name.toLowerCase().includes(query) ||
      site.dns_provider?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: SiteStatus) => {
    const configs: Record<SiteStatus, { variant: 'success' | 'warning' | 'danger' | 'gray'; icon: React.ReactNode; label: string }> = {
      active: { variant: 'success', icon: <CheckCircle className="w-3 h-3" />, label: 'Active' },
      pending: { variant: 'warning', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
      error: { variant: 'danger', icon: <XCircle className="w-3 h-3" />, label: 'Error' },
      suspended: { variant: 'gray', icon: <AlertCircle className="w-3 h-3" />, label: 'Suspended' },
    };
    const config = configs[status] || configs.pending;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getSSLBadge = (site: Site) => {
    if (!site.ssl_enabled) {
      return (
        <Badge variant="gray" className="gap-1">
          <ShieldX className="w-3 h-3" />
          No SSL
        </Badge>
      );
    }
    if (site.ssl_status === 'active') {
      return (
        <Badge variant="success" className="gap-1">
          <ShieldCheck className="w-3 h-3" />
          SSL Active
        </Badge>
      );
    }
    return (
      <Badge variant="warning" className="gap-1">
        <Shield className="w-3 h-3" />
        SSL {site.ssl_status}
      </Badge>
    );
  };

  const getBindingBadge = (type: BindingType) => {
    const configs: Record<BindingType, { icon: React.ReactNode; label: string }> = {
      none: { icon: null, label: 'Not Connected' },
      app: { icon: <Server className="w-3 h-3" />, label: 'App' },
      nginx_site: { icon: <Globe className="w-3 h-3" />, label: 'Nginx Site' },
      proxy: { icon: <LinkIcon className="w-3 h-3" />, label: 'Proxy' },
    };
    const config = configs[type] || configs.none;
    if (type === 'none') {
      return (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {config.label}
        </span>
      );
    }
    return (
      <Badge variant="primary" className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sites
            {sites.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({sites.length} {sites.length === 1 ? 'site' : 'sites'})
              </span>
            )}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your domains with DNS lookup, SSL certificates, and service bindings
          </p>
        </div>
        <Link to="/sites/add">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Site
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          {filteredSites.length > 0 && (
            <Checkbox
              checked={filteredSites.length > 0 && selectedSites.size === filteredSites.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
          )}
          <div className="flex-1">
            <SearchInput
              placeholder="Search by domain, name, or DNS provider..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
          {selectedSites.size > 0 && (
            <Button 
              variant="danger" 
              onClick={handleBatchDelete}
              disabled={deletingBatch}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedSites.size})
            </Button>
          )}
          <Button variant="outline" onClick={loadSites}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Sites List */}
      {filteredSites.length === 0 ? (
        <Empty
          icon={<Globe className="w-8 h-8 text-gray-500" />}
          title={sites.length === 0 ? "No sites found" : "No sites match your search"}
          description={
            searchQuery 
              ? `No sites match "${searchQuery}". Try a different search query.` 
              : sites.length === 0
              ? "Add your first site to get started"
              : `Found ${sites.length} site(s) but none match your search.`
          }
          action={
            !searchQuery ? (
              <Link to="/sites/add">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Site
                </Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredSites.map((site) => (
            <Card 
              key={site.id} 
              className={`p-6 cursor-pointer ${selectedSites.has(site.id) ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
              hover
              onClick={(e) => {
                // Only navigate if click is not on a button, link, or checkbox
                const target = e.target as HTMLElement;
                if (!target.closest('button') && !target.closest('a') && !target.closest('[role="button"]') && !target.closest('input[type="checkbox"]')) {
                  navigate(`/sites/${site.id}`);
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Checkbox */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedSites.has(site.id)}
                      onChange={(e) => handleSelectSite(site.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-6 h-6 text-white" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span 
                        className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
                      >
                        {site.domain}
                      </span>
                      {getStatusBadge(site.status)}
                      {getSSLBadge(site)}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {site.name !== site.domain && (
                        <span>{site.name}</span>
                      )}
                      {site.dns_provider && (
                        <span className="flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          {site.dns_provider}
                        </span>
                      )}
                      {site.dns_verified && (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          DNS Verified
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Binding:</span>
                        {getBindingBadge(site.binding_type)}
                      </div>
                      {site.proxy_target && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          → {site.proxy_target}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://${site.domain}`, '_blank');
                    }}
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshDNS(site.id);
                    }}
                    title="Refresh DNS"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Dropdown
                    trigger={
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    }
                  >
                    <DropdownItem 
                      icon={<Settings className="w-4 h-4" />}
                      onClick={() => navigate(`/sites/${site.id}`)}
                    >
                      Settings
                    </DropdownItem>
                    <DropdownItem
                      icon={<ShieldCheck className="w-4 h-4" />}
                      onClick={async () => {
                        try {
                          await sitesApi.requestSSL(site.id);
                          loadSites();
                        } catch (error) {
                          console.error('Failed to request SSL:', error);
                        }
                      }}
                      disabled={!site.dns_verified}
                    >
                      Request SSL
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem
                      icon={<Trash2 className="w-4 h-4" />}
                      onClick={() => setDeleteModal({ open: true, site })}
                      danger
                    >
                      Delete
                    </DropdownItem>
                  </Dropdown>
                </div>
              </div>

              {/* Nameservers */}
              {site.nameservers && site.nameservers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400">Nameservers:</span>
                    {site.nameservers.slice(0, 3).map((ns, idx) => (
                      <code 
                        key={idx}
                        className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded"
                      >
                        {ns}
                      </code>
                    ))}
                    {site.nameservers.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{site.nameservers.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, site: null })}
        onConfirm={handleDelete}
        title="Delete Site"
        message={
          deleteModal.site
            ? `Are you sure you want to delete "${deleteModal.site.domain}"? This action cannot be undone and will remove all associated DNS records, SSL certificates, and bindings.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />

      {/* Batch Delete Modal */}
      <ConfirmModal
        open={batchDeleteModal}
        onClose={() => setBatchDeleteModal(false)}
        onConfirm={confirmBatchDelete}
        title="Delete Sites"
        message={`Are you sure you want to delete ${selectedSites.size} site(s)? This action cannot be undone and will remove all associated DNS records, SSL certificates, and bindings.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deletingBatch}
      />
    </div>
  );
}
