import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Code,
  Download,
  CheckCircle2,
  Loader2,
  Trash2,
  Info,
  X,
} from 'lucide-react';
import { Button, Card, Badge, Spinner, Modal } from '@/components/ui';
import toast from 'react-hot-toast';
import * as appsApi from '../api/apps';
import type { RuntimeInfo, RuntimeType, RuntimeDetail } from '../api/apps';

const runtimeIcons: Record<RuntimeType, string> = {
  nodejs: '🟢',
  python: '🐍',
  java: '☕',
  php: '🐘',
  ruby: '💎',
  go: '🐹',
  dotnet: '🔷',
};

export default function Runtimes() {
  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [uninstalling, setUninstalling] = useState<Record<string, boolean>>({});
  const [selectedRuntime, setSelectedRuntime] = useState<RuntimeInfo | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showUninstallModal, setShowUninstallModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [runtimeDetail, setRuntimeDetail] = useState<RuntimeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadRuntimes();
  }, []);

  const loadRuntimes = async () => {
    try {
      setLoading(true);
      const data = await appsApi.listRuntimes();
      setRuntimes(data);
    } catch (error) {
      toast.error('Failed to load runtimes');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (runtime: RuntimeInfo, version: string) => {
    const key = `${runtime.type}-${version}`;
    setInstalling((prev) => ({ ...prev, [key]: true }));

    try {
      await appsApi.installRuntime({
        type: runtime.type,
        version: version,
      });
      toast.success(`${runtime.name} ${version} installed successfully`);
      // Reload to update installed versions
      await loadRuntimes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to install ${runtime.name} ${version}: ${errorMessage}`);
    } finally {
      setInstalling((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleUninstall = async (runtime: RuntimeInfo, version: string) => {
    const key = `${runtime.type}-${version}`;
    setUninstalling((prev) => ({ ...prev, [key]: true }));

    try {
      await appsApi.uninstallRuntime({
        type: runtime.type,
        version: version,
      });
      toast.success(`${runtime.name} ${version} uninstalled successfully`);
      await loadRuntimes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to uninstall ${runtime.name} ${version}: ${errorMessage}`);
    } finally {
      setUninstalling((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleViewDetail = async (runtime: RuntimeInfo, version: string) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const detail = await appsApi.getRuntimeDetail(runtime.type, version);
      setRuntimeDetail(detail);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to load runtime detail: ${errorMessage}`);
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openInstallModal = (runtime: RuntimeInfo, version: string) => {
    setSelectedRuntime(runtime);
    setSelectedVersion(version);
    setShowInstallModal(true);
  };

  const openUninstallModal = (runtime: RuntimeInfo, version: string) => {
    setSelectedRuntime(runtime);
    setSelectedVersion(version);
    setShowUninstallModal(true);
  };

  const closeModals = () => {
    setShowInstallModal(false);
    setShowUninstallModal(false);
    setShowDetailModal(false);
    setSelectedRuntime(null);
    setSelectedVersion('');
    setRuntimeDetail(null);
  };

  const confirmInstall = () => {
    if (selectedRuntime) {
      handleInstall(selectedRuntime, selectedVersion);
      closeModals();
    }
  };

  const confirmUninstall = () => {
    if (selectedRuntime) {
      handleUninstall(selectedRuntime, selectedVersion);
      closeModals();
    }
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
          <h1 className="text-2xl font-bold text-dark-100">Runtime Environments</h1>
          <p className="text-dark-400 mt-1">Install and manage programming language runtimes</p>
        </div>
        <Button variant="ghost" onClick={loadRuntimes}>
          <Loader2 className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Runtimes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {runtimes.map((runtime) => (
          <motion.div
            key={runtime.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 hover:border-dark-600/50 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{runtimeIcons[runtime.type] || '📦'}</div>
                <div>
                  <h3 className="font-semibold text-dark-100">{runtime.name}</h3>
                  <p className="text-xs text-dark-400 mt-1">{runtime.description}</p>
                </div>
              </div>
            </div>

            {/* Installed Versions */}
            {runtime.installed && runtime.installed.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-dark-400 mb-2">Installed:</p>
                <div className="flex flex-wrap gap-2">
                  {runtime.installed.map((version, idx) => (
                    <Badge key={idx} variant="success" className="text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {version}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Available Versions */}
            <div>
              <p className="text-xs text-dark-400 mb-2">Available Versions:</p>
              <div className="space-y-2">
                {runtime.versions.map((version) => {
                  const isInstalled = runtime.installed?.some((v) =>
                    v.includes(version.replace(/\.x$/, ''))
                  );
                  const key = `${runtime.type}-${version}`;
                  const isInstalling = installing[key];

                  return (
                    <div
                      key={version}
                      className="flex items-center justify-between p-2 rounded bg-dark-800/50 hover:bg-dark-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-dark-400" />
                        <span className="text-sm text-dark-200">{version}</span>
                        {isInstalled && (
                          <Badge variant="success" className="text-xs">
                            Installed
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isInstalled && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetail(runtime, version)}
                              title="View details"
                            >
                              <Info className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openUninstallModal(runtime, version)}
                              disabled={uninstalling[`${runtime.type}-${version}`]}
                              title="Uninstall"
                            >
                              {uninstalling[`${runtime.type}-${version}`] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3 text-red-400" />
                              )}
                            </Button>
                          </>
                        )}
                        {!isInstalled && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openInstallModal(runtime, version)}
                            disabled={isInstalling}
                          >
                            {isInstalling ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Installing...
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3 mr-1" />
                                Install
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Install Confirmation Modal */}
      <Modal
        open={showInstallModal}
        onClose={closeModals}
        title={`Install ${selectedRuntime?.name} ${selectedVersion}`}
      >
        <div className="space-y-4">
          <p className="text-dark-300">
            Are you sure you want to install <strong>{selectedRuntime?.name} {selectedVersion}</strong>?
          </p>
          <p className="text-sm text-dark-400">
            This will install the runtime environment on the server. The installation process may take
            a few minutes.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={closeModals}>
              Cancel
            </Button>
            <Button onClick={confirmInstall}>
              <Download className="w-4 h-4 mr-2" />
              Install
            </Button>
          </div>
        </div>
      </Modal>

      {/* Uninstall Confirmation Modal */}
      <Modal
        open={showUninstallModal}
        onClose={closeModals}
        title={`Uninstall ${selectedRuntime?.name} ${selectedVersion}`}
      >
        <div className="space-y-4">
          <p className="text-dark-300">
            Are you sure you want to uninstall <strong>{selectedRuntime?.name} {selectedVersion}</strong>?
          </p>
          <p className="text-sm text-dark-400">
            This will remove the runtime environment from the server. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={closeModals}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmUninstall}>
              <Trash2 className="w-4 h-4 mr-2" />
              Uninstall
            </Button>
          </div>
        </div>
      </Modal>

      {/* Runtime Detail Modal */}
      <Modal
        open={showDetailModal}
        onClose={closeModals}
        title={`${selectedRuntime?.name} ${selectedVersion} Details`}
        size="lg"
      >
        <div className="space-y-4">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : runtimeDetail ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-dark-400 mb-1">Type</p>
                  <p className="text-sm text-dark-200">{runtimeDetail.type}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Version</p>
                  <p className="text-sm text-dark-200">{runtimeDetail.version}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Executable</p>
                  <p className="text-sm text-dark-200 font-mono">{runtimeDetail.executable}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Path</p>
                  <p className="text-sm text-dark-200 font-mono">{runtimeDetail.path}</p>
                </div>
              </div>

              {Object.keys(runtimeDetail.info).length > 0 && (
                <div>
                  <p className="text-xs text-dark-400 mb-2">Additional Information</p>
                  <div className="bg-dark-800 rounded-lg p-4 space-y-2">
                    {Object.entries(runtimeDetail.info).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-xs text-dark-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-xs text-dark-200 font-mono">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-dark-400 text-center py-4">No details available</p>
          )}
        </div>
      </Modal>
    </div>
  );
}




