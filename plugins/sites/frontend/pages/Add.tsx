import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Globe, 
  Search, 
  ArrowRight, 
  CheckCircle, 
  XCircle,
  Server,
  Loader2,
  AlertCircle,
  Info,
  Layers,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import * as sitesApi from '../api/sites';
import type { DNSInfo, Site } from '../api/sites';

type Step = 'input' | 'checking' | 'results' | 'creating';

// 解析域名，判断是否是三级域名，并提取二级域名和子域名部分
function parseDomain(inputDomain: string): {
  isSubdomain: boolean;
  rootDomain: string;
  subdomainName: string;
} {
  const parts = inputDomain.trim().toLowerCase().split('.');
  
  // 如果少于2个部分，不是有效域名
  if (parts.length < 2) {
    return { isSubdomain: false, rootDomain: inputDomain.trim(), subdomainName: '' };
  }
  
  // 如果只有2个部分（如 example.com），是二级域名
  if (parts.length === 2) {
    return { isSubdomain: false, rootDomain: inputDomain.trim(), subdomainName: '' };
  }
  
  // 如果有3个或更多部分（如 www.example.com），是三级域名
  // 提取二级域名（最后两个部分）
  const rootDomain = parts.slice(-2).join('.');
  // 提取子域名部分（除了最后两个部分之外的所有部分）
  const subdomainName = parts.slice(0, -2).join('.');
  
  return {
    isSubdomain: true,
    rootDomain,
    subdomainName,
  };
}

export default function AddSite() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('input');
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dnsInfo, setDnsInfo] = useState<DNSInfo | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [domainInfo, setDomainInfo] = useState<{
    isSubdomain: boolean;
    rootDomain: string;
    subdomainName: string;
  } | null>(null);
  const [existingSite, setExistingSite] = useState<Site | null>(null);

  // 检查域名是否已存在
  useEffect(() => {
    async function checkExistingSite() {
      if (!domainInfo) return;
      
      try {
        const sites = await sitesApi.listSites();
        console.log('Checking existing sites:', sites, 'for domain:', domainInfo);
        // 如果是三级域名，检查二级域名是否存在
        if (domainInfo.isSubdomain) {
          const found = sites.find(s => s.domain.toLowerCase() === domainInfo.rootDomain.toLowerCase());
          console.log('Found root domain site:', found);
          setExistingSite(found || null);
        } else {
          // 如果是二级域名，检查该域名是否存在
          const found = sites.find(s => s.domain.toLowerCase() === domainInfo.rootDomain.toLowerCase());
          console.log('Found existing site:', found);
          setExistingSite(found || null);
        }
      } catch (err) {
        console.error('Failed to check existing sites:', err);
        setExistingSite(null);
      }
    }
    
    checkExistingSite();
  }, [domainInfo]);

  async function handleCheckDNS() {
    if (!domain.trim()) {
      setError('Please enter a domain name');
      return;
    }

    setError('');
    setStep('checking');

    try {
      // 解析域名
      const parsed = parseDomain(domain.trim());
      setDomainInfo(parsed);
      
      // 查询 DNS（查询实际输入的域名）
      const info = await sitesApi.lookupDNS(domain.trim());
      setDnsInfo(info);
      
      // 如果是三级域名，也检查二级域名的 DNS
      if (parsed.isSubdomain) {
        try {
          const rootDNSInfo = await sitesApi.lookupDNS(parsed.rootDomain);
          // 可以在这里使用 rootDNSInfo 来显示更多信息
        } catch (err) {
          // 忽略错误，继续处理
        }
      }
      
      setStep('results');
    } catch (err) {
      console.error('DNS lookup failed:', err);
      setError('Failed to lookup DNS. Please check the domain and try again.');
      setStep('input');
    }
  }

  async function handleCreate() {
    if (!domain.trim() || !domainInfo) return;

    setCreating(true);
    setError('');

    try {
      // 如果是三级域名
      if (domainInfo.isSubdomain) {
        let rootSite: Site;
        
        // 如果二级域名已存在，使用现有的 site
        if (existingSite) {
          rootSite = existingSite;
        } else {
          // 如果二级域名不存在，先创建二级域名的 site
          // 再次检查是否已存在（防止在检查后到创建前被其他操作创建）
          try {
            const sites = await sitesApi.listSites();
            const found = sites.find(s => s.domain.toLowerCase() === domainInfo.rootDomain.toLowerCase());
            
            if (found) {
              rootSite = found;
            } else {
              // 查询二级域名的 DNS 信息
              const rootDNSInfo = await sitesApi.lookupDNS(domainInfo.rootDomain);
              
              rootSite = await sitesApi.createSite({
                domain: domainInfo.rootDomain,
                name: name.trim() || domainInfo.rootDomain,
                description: description.trim() || `Root domain for ${domain.trim()}`,
              });
            }
          } catch (createErr: any) {
            // 如果创建失败，可能是域名已存在，再次尝试查找
            if (createErr.message?.includes('UNIQUE constraint') || createErr.message?.includes('already exists')) {
              const sites = await sitesApi.listSites();
              const found = sites.find(s => s.domain.toLowerCase() === domainInfo.rootDomain.toLowerCase());
              if (found) {
                rootSite = found;
              } else {
                throw createErr;
              }
            } else {
              throw createErr;
            }
          }
        }
        
        // 查询三级域名的 DNS 记录，用于创建 subdomain
        const subdomainDNSInfo = await sitesApi.lookupDNS(domain.trim());
        
        // 查找 A、AAAA 或 CNAME 记录
        const aRecord = subdomainDNSInfo.records?.find(r => r.type === 'A');
        const aaaaRecord = subdomainDNSInfo.records?.find(r => r.type === 'AAAA');
        const cnameRecord = subdomainDNSInfo.records?.find(r => r.type === 'CNAME');
        
        // 确定记录类型和目标
        let recordType = 'A';
        let target = '';
        
        if (aRecord && aRecord.values.length > 0) {
          recordType = 'A';
          target = aRecord.values[0];
        } else if (cnameRecord && cnameRecord.values.length > 0) {
          recordType = 'CNAME';
          target = cnameRecord.values[0];
        } else if (aaaaRecord && aaaaRecord.values.length > 0) {
          recordType = 'AAAA';
          target = aaaaRecord.values[0];
        }
        
        // 创建 subdomain
        await sitesApi.createSubdomain(rootSite.id, {
          name: domainInfo.subdomainName,
          description: description.trim() || `Subdomain for ${domain.trim()}`,
          record_type: recordType,
          target: target,
        });
        
        // 导航到二级域名的详情页
        navigate(`/sites/${rootSite.id}?tab=subdomains`);
      } else {
        // 如果是二级域名，再次检查是否已存在（防止竞态条件）
        const sites = await sitesApi.listSites();
        const found = sites.find(s => s.domain.toLowerCase() === domain.trim().toLowerCase());
        
        if (found) {
          setError(`Domain "${domain.trim()}" already exists. Please navigate to the existing site or choose a different domain.`);
          setExistingSite(found);
          setCreating(false);
          return;
        }
        
        // 正常创建
        try {
          const site = await sitesApi.createSite({
            domain: domain.trim(),
            name: name.trim() || domain.trim(),
            description: description.trim(),
          });
          navigate(`/sites/${site.id}`);
        } catch (createErr: any) {
          // 如果创建失败，可能是域名已存在，再次尝试查找
          if (createErr.message?.includes('UNIQUE constraint') || createErr.message?.includes('already exists')) {
            const sites = await sitesApi.listSites();
            const found = sites.find(s => s.domain.toLowerCase() === domain.trim().toLowerCase());
            if (found) {
              setError(`Domain "${domain.trim()}" already exists. Please navigate to the existing site or choose a different domain.`);
              setExistingSite(found);
            } else {
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to create site:', err);
      
      // 检查是否是唯一约束错误
      const errorMessage = err.message || '';
      if (errorMessage.includes('UNIQUE constraint') || errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        const existingDomain = domainInfo?.isSubdomain ? domainInfo.rootDomain : domain.trim();
        setError(`Domain "${existingDomain}" already exists. Please navigate to the existing site or choose a different domain.`);
      } else {
        setError(errorMessage || 'Failed to create site. Please try again.');
      }
      setCreating(false);
    }
  }

  const renderDNSRecordType = (type: string) => {
    const colors: Record<string, string> = {
      A: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      AAAA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      CNAME: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      MX: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      TXT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      NS: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${colors[type] || colors.TXT}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Add Site
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Enter your domain to check DNS settings and add it to your panel
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step === 'input' || step === 'checking' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'input' || step === 'checking' ? 'bg-blue-100 dark:bg-blue-900/30' : 
            'bg-green-100 dark:bg-green-900/30 text-green-600'
          }`}>
            {step === 'results' || step === 'creating' ? <CheckCircle className="w-5 h-5" /> : '1'}
          </div>
          <span className="font-medium">Enter Domain</span>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center gap-2 ${step === 'checking' || step === 'results' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'checking' || step === 'results' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'
          }`}>
            {step === 'checking' ? <Loader2 className="w-5 h-5 animate-spin" /> : '2'}
          </div>
          <span className="font-medium">Check DNS</span>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center gap-2 ${step === 'creating' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'creating' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'
          }`}>
            {step === 'creating' ? <Loader2 className="w-5 h-5 animate-spin" /> : '3'}
          </div>
          <span className="font-medium">Add Site</span>
        </div>
      </div>

      {/* Main Content */}
      <Card className="p-6">
        {/* Step 1: Input Domain */}
        {(step === 'input' || step === 'checking') && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Enter Your Domain
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  We'll check the DNS configuration and identify your DNS provider
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Domain Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCheckDNS()}
                    placeholder="example.com"
                    className="w-full px-4 py-3 pl-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={step === 'checking'}
                  />
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter the root domain without http:// or www prefix
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleCheckDNS}
                loading={step === 'checking'}
                disabled={!domain.trim()}
                className="w-full"
                size="lg"
              >
                <Search className="w-5 h-5 mr-2" />
                Check DNS Settings
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: DNS Results */}
        {step === 'results' && dnsInfo && (
          <div className="space-y-6">
            {/* Domain Summary */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {dnsInfo.domain}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant={dnsInfo.is_resolvable ? 'success' : 'danger'}>
                    {dnsInfo.is_resolvable ? 'Resolvable' : 'Not Resolvable'}
                  </Badge>
                  {dnsInfo.provider && (
                    <Badge variant="primary">
                      <Server className="w-3 h-3 mr-1" />
                      {dnsInfo.provider}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Subdomain Detection Notice */}
            {domainInfo?.isSubdomain && (
              <div className="flex items-start gap-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <Layers className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Subdomain Detected</p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    You entered a subdomain (<code className="px-1 py-0.5 bg-purple-100 dark:bg-purple-800 rounded">{domain.trim()}</code>).
                    {existingSite ? (
                      <> The root domain <code className="px-1 py-0.5 bg-purple-100 dark:bg-purple-800 rounded">{domainInfo.rootDomain}</code> already exists. This subdomain will be added to it.</>
                    ) : (
                      <> The root domain <code className="px-1 py-0.5 bg-purple-100 dark:bg-purple-800 rounded">{domainInfo.rootDomain}</code> will be created, and <code className="px-1 py-0.5 bg-purple-100 dark:bg-purple-800 rounded">{domainInfo.subdomainName}</code> will be added as a subdomain.</>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Domain Already Exists Warning */}
            {!domainInfo?.isSubdomain && existingSite && (
              <div className="flex items-start gap-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Domain Already Exists</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-3">
                    The domain <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-800 rounded">{domain.trim()}</code> is already managed in this panel.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/sites/${existingSite.id}`)}
                  >
                    Go to Existing Site
                  </Button>
                </div>
              </div>
            )}

            {/* Nameservers */}
            {dnsInfo.nameservers && dnsInfo.nameservers.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Nameservers
                </h3>
                <div className="flex flex-wrap gap-2">
                  {dnsInfo.nameservers.map((ns, idx) => (
                    <code 
                      key={idx}
                      className="text-sm bg-white dark:bg-gray-700 px-3 py-1 rounded border border-gray-200 dark:border-gray-600"
                    >
                      {ns}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* DNS Records */}
            {dnsInfo.records && dnsInfo.records.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  DNS Records Found
                </h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {dnsInfo.records.slice(0, 10).map((record, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2">
                            {renderDNSRecordType(record.type)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-mono">
                            {record.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="max-w-md truncate font-mono text-xs">
                              {record.values.slice(0, 2).join(', ')}
                              {record.values.length > 2 && ` +${record.values.length - 2} more`}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dnsInfo.records.length > 10 && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                      And {dnsInfo.records.length - 10} more records...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-4 rounded-lg">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">What happens next?</p>
                <p className="mt-1 text-blue-600 dark:text-blue-400">
                  After adding this site, you can request an SSL certificate, 
                  configure DNS records, and bind it to your applications or services.
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={dnsInfo.domain}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description for this site..."
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Error</p>
                  <p className="text-sm">{error}</p>
                  {existingSite && error.includes('already exists') && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/sites/${existingSite.id}`)}
                      >
                        Go to Existing Site
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('input');
                  setDnsInfo(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleCreate}
                loading={creating}
                disabled={!domainInfo?.isSubdomain && existingSite !== null}
                className="flex-1"
                size="lg"
              >
                Add Site
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
