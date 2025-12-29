import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Database,
  Server,
  Save,
  RefreshCw,
  Key,
  Mail,
  Webhook,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  ArrowUpCircle,
  Package,
  Clock,
  GitCommit,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Input,
  Select,
  Switch,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useThemeStore } from '@/stores/theme';
import * as settingsApi from '@/api/settings';
import * as updateApi from '@/api/update';
import type { SystemSettings } from '@/api/settings';
import type { UpdateStatus, CheckUpdateResponse, CurrentVersion } from '@/api/update';

export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // Update state
  const [currentVersion, setCurrentVersion] = useState<CurrentVersion | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateCheckResult, setUpdateCheckResult] = useState<CheckUpdateResponse | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [performingUpdate, setPerformingUpdate] = useState(false);
  
  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const isLight = resolvedMode === 'light';

  // Load settings and version on mount
  useEffect(() => {
    loadSettings();
    loadVersionInfo();
  }, []);

  // Poll update status when update is in progress
  useEffect(() => {
    if (!performingUpdate) return;
    
    const interval = setInterval(async () => {
      try {
        const status = await updateApi.getUpdateStatus();
        setUpdateStatus(status);
        
        if (status.state === 'completed' || status.state === 'failed' || status.state === 'idle') {
          setPerformingUpdate(false);
        }
        
        if (status.state === 'restarting') {
          // Server is restarting, show message
          setSuccess(true);
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        }
      } catch {
        // Server might be restarting
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [performingUpdate]);

  const loadVersionInfo = useCallback(async () => {
    try {
      const version = await updateApi.getCurrentVersion();
      setCurrentVersion(version);
      const status = await updateApi.getUpdateStatus();
      setUpdateStatus(status);
    } catch (err) {
      console.error('Failed to load version info:', err);
    }
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsApi.getSystemSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      await settingsApi.updateSystemSettings(settings);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category: keyof SystemSettings, key: string, value: string | number | boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    });
  };

  const handleCheckUpdate = async () => {
    try {
      setCheckingUpdate(true);
      setError(null);
      const result = await updateApi.checkForUpdates();
      setUpdateCheckResult(result);
      const status = await updateApi.getUpdateStatus();
      setUpdateStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handlePerformUpdate = async () => {
    try {
      setPerformingUpdate(true);
      setError(null);
      await updateApi.performUpdate();
      const status = await updateApi.getUpdateStatus();
      setUpdateStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform update');
      setPerformingUpdate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className={cn('text-lg font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>
          Failed to load settings
        </p>
        <Button onClick={loadSettings} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>System Settings</h1>
          <p className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Configure system preferences</p>
        </div>
        <Button 
          leftIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={cn(
          'mb-4 p-4 rounded-lg flex items-center gap-2',
          isLight ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-900/20 text-red-400 border border-red-800'
        )}>
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className={cn('ml-auto text-sm underline')}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className={cn(
          'mb-4 p-4 rounded-lg flex items-center gap-2',
          isLight ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-green-900/20 text-green-400 border border-green-800'
        )}>
          <CheckCircle className="w-5 h-5" />
          <span>Settings saved successfully</span>
        </div>
      )}

      <Tabs defaultValue="general">
        <TabList className="mb-6">
          <Tab value="general" icon={<Settings className="w-4 h-4" />}>General</Tab>
          <Tab value="security" icon={<Shield className="w-4 h-4" />}>Security</Tab>
          <Tab value="notifications" icon={<Bell className="w-4 h-4" />}>Notifications</Tab>
          <Tab value="backup" icon={<Database className="w-4 h-4" />}>Backup</Tab>
          <Tab value="advanced" icon={<Server className="w-4 h-4" />}>Advanced</Tab>
          <Tab value="update" icon={<ArrowUpCircle className="w-4 h-4" />}>Update</Tab>
        </TabList>

        {/* General Settings */}
        <TabPanel value="general">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Site Information</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Site Name</label>
                    <Input 
                      value={settings.general.site_name}
                      onChange={(e) => updateSetting('general', 'site_name', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Site URL</label>
                    <Input 
                      value={settings.general.site_url}
                      onChange={(e) => updateSetting('general', 'site_url', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Description</label>
                  <Input 
                    value={settings.general.site_description}
                    onChange={(e) => updateSetting('general', 'site_description', e.target.value)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Appearance</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Theme</label>
                    <Select 
                      value={settings.general.theme}
                      onChange={(e) => updateSetting('general', 'theme', e.target.value)}
                      disabled={saving}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </Select>
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Language</label>
                    <Select 
                      value={settings.general.language}
                      onChange={(e) => updateSetting('general', 'language', e.target.value)}
                      disabled={saving}
                    >
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                      <option value="ja">日本語</option>
                      <option value="ko">한국어</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Timezone</label>
                  <Select 
                    value={settings.general.timezone}
                    onChange={(e) => updateSetting('general', 'timezone', e.target.value)}
                    disabled={saving}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Asia/Shanghai">Asia/Shanghai</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Security Settings */}
        <TabPanel value="security">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Authentication</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <Switch 
                  label="Enable Two-Factor Authentication (2FA)" 
                  checked={settings.security.enable_2fa}
                  onChange={(e) => updateSetting('security', 'enable_2fa', e.target.checked)}
                  disabled={saving}
                />
                <Switch 
                  label="Require 2FA for all users" 
                  checked={settings.security.require_2fa}
                  onChange={(e) => updateSetting('security', 'require_2fa', e.target.checked)}
                  disabled={saving}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Session Timeout (minutes)</label>
                    <Input 
                      type="number" 
                      value={settings.security.session_timeout}
                      onChange={(e) => updateSetting('security', 'session_timeout', parseInt(e.target.value) || 0)}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Max Login Attempts</label>
                    <Input 
                      type="number" 
                      value={settings.security.max_login_attempts}
                      onChange={(e) => updateSetting('security', 'max_login_attempts', parseInt(e.target.value) || 0)}
                      disabled={saving}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>OAuth Providers</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={cn('p-4 rounded-lg', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isLight ? 'bg-gray-200' : 'bg-gray-700')}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>GitHub</h4>
                        <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>OAuth login with GitHub</p>
                      </div>
                    </div>
                    <Switch 
                      checked={settings.security.oauth_github_enabled}
                      onChange={(e) => updateSetting('security', 'oauth_github_enabled', e.target.checked)}
                      disabled={saving}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={cn('block text-sm mb-1', isLight ? 'text-gray-600' : 'text-gray-400')}>Client ID</label>
                      <Input 
                        placeholder="Enter client ID"
                        value={settings.security.oauth_github_client_id}
                        onChange={(e) => updateSetting('security', 'oauth_github_client_id', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={cn('block text-sm mb-1', isLight ? 'text-gray-600' : 'text-gray-400')}>Client Secret</label>
                      <Input 
                        type="password" 
                        placeholder="Enter client secret"
                        disabled={saving}
                        title="Client secret is stored securely and cannot be displayed"
                      />
                    </div>
                  </div>
                </div>

                <div className={cn('p-4 rounded-lg', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isLight ? 'bg-gray-200' : 'bg-gray-700')}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Google</h4>
                        <p className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>OAuth login with Google</p>
                      </div>
                    </div>
                    <Switch 
                      checked={settings.security.oauth_google_enabled}
                      onChange={(e) => updateSetting('security', 'oauth_google_enabled', e.target.checked)}
                      disabled={saving}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={cn('block text-sm mb-1', isLight ? 'text-gray-600' : 'text-gray-400')}>Client ID</label>
                      <Input 
                        placeholder="Enter client ID"
                        value={settings.security.oauth_google_client_id}
                        onChange={(e) => updateSetting('security', 'oauth_google_client_id', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={cn('block text-sm mb-1', isLight ? 'text-gray-600' : 'text-gray-400')}>Client Secret</label>
                      <Input 
                        type="password" 
                        placeholder="Enter client secret"
                        disabled={saving}
                        title="Client secret is stored securely and cannot be displayed"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>API Keys</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-dark-900/50 rounded-lg">
                    <div>
                      <p className="font-medium text-dark-200">Admin API Key</p>
                      <p className="text-sm text-dark-500">Created 30 days ago</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-3 py-1 bg-dark-700 rounded text-sm text-dark-300">sk-••••••••••••••••</code>
                      <Button size="sm" variant="ghost">Regenerate</Button>
                    </div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="mt-4" leftIcon={<Key className="w-4 h-4" />}>
                  Create New API Key
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Notifications Settings */}
        <TabPanel value="notifications">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Email Notifications</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <Switch 
                  label="Enable email notifications" 
                  checked={settings.notifications.email_enabled}
                  onChange={(e) => updateSetting('notifications', 'email_enabled', e.target.checked)}
                  disabled={saving}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>SMTP Host</label>
                    <Input 
                      placeholder="smtp.example.com"
                      value={settings.notifications.smtp_host}
                      onChange={(e) => updateSetting('notifications', 'smtp_host', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>SMTP Port</label>
                    <Input 
                      type="number" 
                      value={settings.notifications.smtp_port}
                      onChange={(e) => updateSetting('notifications', 'smtp_port', parseInt(e.target.value) || 587)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>SMTP Username</label>
                    <Input 
                      placeholder="username"
                      value={settings.notifications.smtp_username}
                      onChange={(e) => updateSetting('notifications', 'smtp_username', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>SMTP Password</label>
                    <Input 
                      type="password" 
                      placeholder="password"
                      value={settings.notifications.smtp_password}
                      onChange={(e) => updateSetting('notifications', 'smtp_password', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>From Email</label>
                  <Input 
                    placeholder="noreply@example.com"
                    value={settings.notifications.from_email}
                    onChange={(e) => updateSetting('notifications', 'from_email', e.target.value)}
                    disabled={saving}
                  />
                </div>
                <Button variant="secondary" size="sm" leftIcon={<Mail className="w-4 h-4" />}>
                  Send Test Email
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Alert Types</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <Switch 
                  label="CPU usage alerts" 
                  checked={settings.notifications.cpu_alerts}
                  onChange={(e) => updateSetting('notifications', 'cpu_alerts', e.target.checked)}
                  disabled={saving}
                />
                <Switch 
                  label="Memory usage alerts" 
                  checked={settings.notifications.memory_alerts}
                  onChange={(e) => updateSetting('notifications', 'memory_alerts', e.target.checked)}
                  disabled={saving}
                />
                <Switch 
                  label="Disk space alerts" 
                  checked={settings.notifications.disk_alerts}
                  onChange={(e) => updateSetting('notifications', 'disk_alerts', e.target.checked)}
                  disabled={saving}
                />
                <Switch 
                  label="Service down alerts" 
                  checked={settings.notifications.service_alerts}
                  onChange={(e) => updateSetting('notifications', 'service_alerts', e.target.checked)}
                  disabled={saving}
                />
                <Switch 
                  label="SSL certificate expiry alerts" 
                  checked={settings.notifications.ssl_alerts}
                  onChange={(e) => updateSetting('notifications', 'ssl_alerts', e.target.checked)}
                  disabled={saving}
                />
                <Switch 
                  label="Security alerts" 
                  checked={settings.notifications.security_alerts}
                  onChange={(e) => updateSetting('notifications', 'security_alerts', e.target.checked)}
                  disabled={saving}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Webhook Integration</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <Switch 
                  label="Enable webhooks" 
                  checked={settings.notifications.webhook_enabled}
                  onChange={(e) => updateSetting('notifications', 'webhook_enabled', e.target.checked)}
                  disabled={saving}
                />
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Webhook URL</label>
                  <Input 
                    placeholder="https://example.com/webhook"
                    value={settings.notifications.webhook_url}
                    onChange={(e) => updateSetting('notifications', 'webhook_url', e.target.value)}
                    disabled={saving}
                  />
                </div>
                <Button variant="secondary" size="sm" leftIcon={<Webhook className="w-4 h-4" />}>
                  Test Webhook
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Backup Settings */}
        <TabPanel value="backup">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Automatic Backups</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <Switch 
                  label="Enable automatic backups" 
                  checked={settings.backup.auto_backup_enabled}
                  onChange={(e) => updateSetting('backup', 'auto_backup_enabled', e.target.checked)}
                  disabled={saving}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Backup Schedule</label>
                    <Select 
                      value={settings.backup.backup_schedule}
                      onChange={(e) => updateSetting('backup', 'backup_schedule', e.target.value)}
                      disabled={saving}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </Select>
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Retention (days)</label>
                    <Input 
                      type="number" 
                      value={settings.backup.backup_retention}
                      onChange={(e) => updateSetting('backup', 'backup_retention', parseInt(e.target.value) || 30)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Backup Time</label>
                  <Input 
                    type="time" 
                    value={settings.backup.backup_time}
                    onChange={(e) => updateSetting('backup', 'backup_time', e.target.value)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Backup Storage</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Storage Type</label>
                  <Select 
                    value={settings.backup.storage_type}
                    onChange={(e) => updateSetting('backup', 'storage_type', e.target.value)}
                    disabled={saving}
                  >
                    <option value="local">Local Storage</option>
                    <option value="s3">Amazon S3</option>
                    <option value="gcs">Google Cloud Storage</option>
                    <option value="azure">Azure Blob Storage</option>
                  </Select>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Backup Path</label>
                  <Input 
                    value={settings.backup.backup_path}
                    onChange={(e) => updateSetting('backup', 'backup_path', e.target.value)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Recent Backups</h3>
                <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
                  Backup Now
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { name: 'backup-2024-01-16-02-00.tar.gz', size: '245 MB', time: 'Today, 02:00 AM' },
                    { name: 'backup-2024-01-15-02-00.tar.gz', size: '243 MB', time: 'Yesterday, 02:00 AM' },
                    { name: 'backup-2024-01-14-02-00.tar.gz', size: '241 MB', time: '2 days ago' },
                  ].map((backup, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-dark-900/50 rounded-lg">
                      <div>
                        <p className="text-sm text-dark-200 font-mono">{backup.name}</p>
                        <p className="text-xs text-dark-500">{backup.time} • {backup.size}</p>
                      </div>
                      <Button size="sm" variant="ghost">Download</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Advanced Settings */}
        <TabPanel value="advanced">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Server Configuration</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Server Port</label>
                    <Input 
                      type="number" 
                      value={settings.advanced.server_port}
                      onChange={(e) => updateSetting('advanced', 'server_port', parseInt(e.target.value) || 8080)}
                      disabled={true}
                      title="Server port cannot be changed from UI"
                    />
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Max Upload Size (MB)</label>
                    <Input 
                      type="number" 
                      value={settings.advanced.max_upload_size}
                      onChange={(e) => updateSetting('advanced', 'max_upload_size', parseInt(e.target.value) || 100)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <Switch 
                  label="Enable HTTPS" 
                  checked={settings.advanced.enable_https}
                  onChange={(e) => updateSetting('advanced', 'enable_https', e.target.checked)}
                  disabled={true}
                  title="HTTPS settings require server restart"
                />
                <Switch 
                  label="Enable API rate limiting" 
                  checked={settings.advanced.rate_limit_enabled}
                  onChange={(e) => updateSetting('advanced', 'rate_limit_enabled', e.target.checked)}
                  disabled={saving}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Logging</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Log Level</label>
                  <Select 
                    value={settings.advanced.log_level}
                    onChange={(e) => updateSetting('advanced', 'log_level', e.target.value)}
                    disabled={saving}
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </Select>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1.5', isLight ? 'text-gray-700' : 'text-gray-300')}>Log Retention (days)</label>
                  <Input 
                    type="number" 
                    value={settings.advanced.log_retention}
                    onChange={(e) => updateSetting('advanced', 'log_retention', parseInt(e.target.value) || 30)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-500/30">
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-red-600' : 'text-red-400')}>Danger Zone</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg">
                  <div>
                    <p className="font-medium text-dark-100">Reset All Settings</p>
                    <p className="text-sm text-dark-500">Reset all settings to default values</p>
                  </div>
                  <Button variant="danger" size="sm">Reset</Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg">
                  <div>
                    <p className="font-medium text-dark-100">Clear All Data</p>
                    <p className="text-sm text-dark-500">Delete all data including logs and backups</p>
                  </div>
                  <Button variant="danger" size="sm">Clear</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Update Settings */}
        <TabPanel value="update">
          <div className="grid gap-6">
            {/* Current Version Card */}
            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Current Version</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={cn('p-4 rounded-lg', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                    <div className="flex items-center gap-2 mb-2">
                      <Package className={cn('w-4 h-4', isLight ? 'text-gray-500' : 'text-gray-400')} />
                      <span className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>Version</span>
                    </div>
                    <p className={cn('text-lg font-mono font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                      {currentVersion?.version || 'Loading...'}
                    </p>
                  </div>
                  <div className={cn('p-4 rounded-lg', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className={cn('w-4 h-4', isLight ? 'text-gray-500' : 'text-gray-400')} />
                      <span className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>Build Time</span>
                    </div>
                    <p className={cn('text-sm font-mono', isLight ? 'text-gray-700' : 'text-gray-300')}>
                      {currentVersion?.build_time || 'Unknown'}
                    </p>
                  </div>
                  <div className={cn('p-4 rounded-lg', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                    <div className="flex items-center gap-2 mb-2">
                      <GitCommit className={cn('w-4 h-4', isLight ? 'text-gray-500' : 'text-gray-400')} />
                      <span className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>Git Commit</span>
                    </div>
                    <p className={cn('text-sm font-mono', isLight ? 'text-gray-700' : 'text-gray-300')}>
                      {currentVersion?.git_commit?.substring(0, 8) || 'Unknown'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Check for Updates Card */}
            <Card>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-gray-900' : 'text-gray-100')}>Software Updates</h3>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  leftIcon={checkingUpdate ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate || performingUpdate}
                >
                  {checkingUpdate ? 'Checking...' : 'Check for Updates'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Update Status */}
                {updateStatus && updateStatus.state !== 'idle' && (
                  <div className={cn(
                    'p-4 rounded-lg',
                    updateStatus.state === 'failed' 
                      ? (isLight ? 'bg-red-50 border border-red-200' : 'bg-red-900/20 border border-red-800')
                      : updateStatus.state === 'available'
                      ? (isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-900/20 border border-amber-800')
                      : updateStatus.state === 'completed'
                      ? (isLight ? 'bg-green-50 border border-green-200' : 'bg-green-900/20 border border-green-800')
                      : (isLight ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/20 border border-blue-800')
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        'font-medium',
                        updateStatus.state === 'failed' ? (isLight ? 'text-red-700' : 'text-red-400') :
                        updateStatus.state === 'available' ? (isLight ? 'text-amber-700' : 'text-amber-400') :
                        updateStatus.state === 'completed' ? (isLight ? 'text-green-700' : 'text-green-400') :
                        (isLight ? 'text-blue-700' : 'text-blue-400')
                      )}>
                        {updateStatus.message}
                      </span>
                      {updateStatus.state === 'downloading' || updateStatus.state === 'installing' ? (
                        <span className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                          {updateStatus.progress}%
                        </span>
                      ) : null}
                    </div>
                    
                    {/* Progress bar */}
                    {(updateStatus.state === 'downloading' || updateStatus.state === 'installing') && (
                      <div className={cn('h-2 rounded-full overflow-hidden', isLight ? 'bg-gray-200' : 'bg-gray-700')}>
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
                          style={{ width: `${updateStatus.progress}%` }}
                        />
                      </div>
                    )}

                    {updateStatus.error && (
                      <p className={cn('text-sm mt-2', isLight ? 'text-red-600' : 'text-red-400')}>
                        {updateStatus.error}
                      </p>
                    )}
                  </div>
                )}

                {/* Available Update Info */}
                {updateCheckResult?.has_update && updateCheckResult.latest_version && (
                  <div className={cn('p-4 rounded-lg border', isLight ? 'bg-gradient-to-r from-cyan-50 to-purple-50 border-cyan-200' : 'bg-gradient-to-r from-cyan-900/20 to-purple-900/20 border-cyan-800')}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowUpCircle className={cn('w-5 h-5', isLight ? 'text-cyan-600' : 'text-cyan-400')} />
                          <span className={cn('font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                            New Version Available: v{updateCheckResult.latest_version.version}
                          </span>
                        </div>
                        {updateCheckResult.latest_version.changelog && (
                          <p className={cn('text-sm mb-3', isLight ? 'text-gray-600' : 'text-gray-400')}>
                            {updateCheckResult.latest_version.changelog}
                          </p>
                        )}
                        {updateCheckResult.latest_version.size && (
                          <p className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-500')}>
                            Download size: {(updateCheckResult.latest_version.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                      <Button
                        className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-0 hover:from-cyan-600 hover:to-purple-600"
                        leftIcon={performingUpdate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        onClick={handlePerformUpdate}
                        disabled={performingUpdate}
                      >
                        {performingUpdate ? 'Updating...' : 'Update Now'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* No Updates Available */}
                {updateCheckResult && !updateCheckResult.has_update && (
                  <div className={cn('p-4 rounded-lg flex items-center gap-3', isLight ? 'bg-green-50' : 'bg-green-900/20')}>
                    <CheckCircle className={cn('w-5 h-5', isLight ? 'text-green-600' : 'text-green-400')} />
                    <span className={cn(isLight ? 'text-green-700' : 'text-green-400')}>
                      You are running the latest version
                    </span>
                  </div>
                )}

                {/* Initial State */}
                {!updateCheckResult && (!updateStatus || updateStatus.state === 'idle') && (
                  <div className={cn('p-4 rounded-lg text-center', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
                    <ArrowUpCircle className={cn('w-12 h-12 mx-auto mb-3', isLight ? 'text-gray-300' : 'text-gray-600')} />
                    <p className={cn('text-sm', isLight ? 'text-gray-500' : 'text-gray-400')}>
                      Click "Check for Updates" to see if a new version is available
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Update Warning */}
            <Card className={cn('border', isLight ? 'border-amber-200' : 'border-amber-800')}>
              <CardHeader>
                <h3 className={cn('font-medium', isLight ? 'text-amber-700' : 'text-amber-400')}>Important Notes</h3>
              </CardHeader>
              <CardContent>
                <ul className={cn('list-disc list-inside space-y-2 text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
                  <li>The server will automatically restart after the update is complete</li>
                  <li>Please ensure all important work is saved before updating</li>
                  <li>The update process typically takes 1-2 minutes</li>
                  <li>A backup of the current version is automatically created</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}
