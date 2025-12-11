import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileArchive,
  ChevronRight,
  Home,
  Upload,
  FolderPlus,
  Download,
  Trash2,
  Edit,
  Copy,
  Scissors,
  MoreVertical,
  Grid,
  List,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  Card,
  SearchInput,
  Dropdown,
  DropdownItem,
  DropdownDivider,
  Modal,
  ConfirmModal,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import * as filesAPI from '@/api/files';
import type { FileInfo } from '@/api/files';
import { useAuthStore } from '@/stores/auth';

interface FileItem extends FileInfo {
  type: 'file' | 'folder';
}

function getFileIcon(item: FileItem) {
  if (item.type === 'folder') return <Folder className="w-5 h-5 text-yellow-400" />;
  
  const iconMap: Record<string, React.ReactNode> = {
    conf: <FileCode className="w-5 h-5 text-green-400" />,
    yml: <FileCode className="w-5 h-5 text-purple-400" />,
    yaml: <FileCode className="w-5 h-5 text-purple-400" />,
    json: <FileCode className="w-5 h-5 text-yellow-400" />,
    js: <FileCode className="w-5 h-5 text-yellow-400" />,
    ts: <FileCode className="w-5 h-5 text-blue-400" />,
    html: <FileCode className="w-5 h-5 text-orange-400" />,
    css: <FileCode className="w-5 h-5 text-blue-400" />,
    log: <FileText className="w-5 h-5 text-gray-400" />,
    txt: <FileText className="w-5 h-5 text-gray-400" />,
    sql: <FileText className="w-5 h-5 text-blue-400" />,
    gz: <FileArchive className="w-5 h-5 text-red-400" />,
    zip: <FileArchive className="w-5 h-5 text-red-400" />,
    tar: <FileArchive className="w-5 h-5 text-red-400" />,
    png: <FileImage className="w-5 h-5 text-pink-400" />,
    jpg: <FileImage className="w-5 h-5 text-pink-400" />,
    jpeg: <FileImage className="w-5 h-5 text-pink-400" />,
    gif: <FileImage className="w-5 h-5 text-pink-400" />,
    svg: <FileImage className="w-5 h-5 text-pink-400" />,
  };

  return iconMap[item.extension || ''] || <File className="w-5 h-5 text-dark-400" />;
}

function formatSize(bytes?: number) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default function FileManager() {
  const token = useAuthStore((state) => state.token);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [currentPath, setCurrentPath] = useState('/');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renamePath, setRenamePath] = useState('');
  const [renameName, setRenameName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cutPaths, setCutPaths] = useState<Set<string>>(new Set());

  const pathParts = currentPath.split('/').filter(Boolean);

  // Load files when path changes
  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await filesAPI.listDirectory(currentPath);
      const fileItems: FileItem[] = result.files.map((f) => ({
        ...f,
        type: f.is_dir ? 'folder' : 'file',
      }));
      setFiles(fileItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files
    .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const toggleSelect = (path: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelected(newSelected);
  };

  const handleNavigate = (path: string) => {
    if (path === currentPath) return;
    setCurrentPath(path);
    setSelected(new Set());
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const folderPath = currentPath === '/' 
        ? `/${newFolderName}` 
        : `${currentPath}/${newFolderName}`;
      await filesAPI.createDirectory(folderPath);
      setShowNewFolder(false);
      setNewFolderName('');
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleDelete = async () => {
    try {
      const deletePromises = Array.from(selected).map((path) => filesAPI.deleteFile(path));
      await Promise.all(deletePromises);
      setShowDelete(false);
      setSelected(new Set());
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete files');
    }
  };

  const handleRename = async () => {
    if (!renameName.trim() || !renamePath) return;
    try {
      const newPath = renamePath.substring(0, renamePath.lastIndexOf('/')) + '/' + renameName;
      await filesAPI.renameFile(renamePath, newPath);
      setShowRename(false);
      setRenamePath('');
      setRenameName('');
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    try {
      const uploadPromises = Array.from(fileList).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);
        
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Upload failed');
        }
      });

      await Promise.all(uploadPromises);
      setShowUpload(false);
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const response = await fetch(`/api/files/download?path=${encodeURIComponent(path)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    }
  };

  const handleCopy = async () => {
    if (selected.size === 0) return;
    // Store paths for copy operation (would need a paste handler)
    setCutPaths(new Set());
    // For now, just show a message
    setError('Copy functionality - select destination and paste');
  };

  const handleCut = () => {
    setCutPaths(new Set(selected));
    setSelected(new Set());
  };

  const handlePaste = async (destPath: string) => {
    try {
      const operations = Array.from(cutPaths).map(async (srcPath) => {
        const fileName = srcPath.split('/').pop() || '';
        const dest = destPath === '/' ? `/${fileName}` : `${destPath}/${fileName}`;
        if (cutPaths.size > 0) {
          await filesAPI.moveFile(srcPath, dest);
        } else {
          await filesAPI.copyFile(srcPath, dest);
        }
      });
      await Promise.all(operations);
      setCutPaths(new Set());
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to paste files');
    }
  };

  const openRenameModal = (path: string) => {
    setRenamePath(path);
    setRenameName(path.split('/').pop() || '');
    setShowRename(true);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-dark-100">File Manager</h1>
            <p className="text-dark-400">Browse and manage files</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leftIcon={<Upload className="w-4 h-4" />} onClick={() => {
            setShowUpload(true);
            fileInputRef.current?.click();
          }}>
            Upload
          </Button>
          <Button variant="secondary" leftIcon={<FolderPlus className="w-4 h-4" />} onClick={() => setShowNewFolder(true)}>
            New Folder
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            ×
          </button>
        </div>
      )}

      {/* Toolbar */}
      <Card className="mb-4">
        <div className="p-3 flex items-center gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <button
              onClick={() => handleNavigate('/')}
              className="p-1.5 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>
            {pathParts.map((part, i) => (
              <div key={i} className="flex items-center">
                <ChevronRight className="w-4 h-4 text-dark-600" />
                <button
                  onClick={() => handleNavigate('/' + pathParts.slice(0, i + 1).join('/'))}
                  className="px-2 py-1 text-sm text-dark-300 hover:text-dark-100 hover:bg-dark-700 rounded transition-colors truncate max-w-[150px]"
                >
                  {part}
                </button>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="w-64">
            <SearchInput
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 border-l border-dark-700 pl-4">
            <button 
              onClick={loadFiles}
              disabled={loading}
              className="p-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'grid' ? 'text-primary-400 bg-primary-500/10' : 'text-dark-400 hover:text-dark-100 hover:bg-dark-700'
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'list' ? 'text-primary-400 bg-primary-500/10' : 'text-dark-400 hover:text-dark-100 hover:bg-dark-700'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selection toolbar */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-dark-700 overflow-hidden"
            >
              <div className="p-3 flex items-center gap-4">
                <span className="text-sm text-dark-400">
                  {selected.size} item{selected.size > 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={async () => {
                      for (const path of selected) {
                        await handleDownload(path);
                      }
                    }}
                  >
                    Download
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Copy className="w-4 h-4" />} onClick={handleCopy}>
                    Copy
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Scissors className="w-4 h-4" />} onClick={handleCut}>
                    Cut
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Trash2 className="w-4 h-4" />} onClick={() => setShowDelete(true)}>
                    Delete
                  </Button>
                </div>
                <button
                  onClick={() => setSelected(new Set())}
                  className="ml-auto text-sm text-dark-400 hover:text-dark-100 transition-colors"
                >
                  Clear selection
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* File List */}
      <Card className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 bg-dark-800 z-10">
                <tr className="text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredFiles.length && filteredFiles.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(new Set(filteredFiles.map((f) => f.path)));
                        } else {
                          setSelected(new Set());
                        }
                      }}
                      className="w-4 h-4 rounded border-dark-600 bg-dark-900 text-primary-500 focus:ring-primary-500"
                    />
                  </th>
                  <th className="p-3">Name</th>
                  <th className="p-3 w-24">Size</th>
                  <th className="p-3 w-32">Modified</th>
                  <th className="p-3 w-32">Permissions</th>
                  <th className="p-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-dark-400">
                      No files found
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((item) => (
                    <tr
                      key={item.path}
                      className={cn(
                        'border-t border-dark-800 hover:bg-dark-800/50 transition-colors cursor-pointer',
                        selected.has(item.path) && 'bg-primary-500/10'
                      )}
                      onClick={() => item.type === 'folder' && handleNavigate(item.path)}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(item.path)}
                          onChange={() => toggleSelect(item.path)}
                          className="w-4 h-4 rounded border-dark-600 bg-dark-900 text-primary-500 focus:ring-primary-500"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {getFileIcon(item)}
                          <span className="text-dark-100">{item.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-dark-400 text-sm">{formatSize(item.size)}</td>
                      <td className="p-3 text-dark-400 text-sm">{new Date(item.mod_time).toLocaleDateString()}</td>
                      <td className="p-3 text-dark-400 text-sm font-mono">{item.mode_string}</td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          trigger={
                            <button className="p-1 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          }
                        >
                          {item.type === 'file' && (
                            <DropdownItem 
                              icon={<Edit className="w-4 h-4" />}
                              onClick={() => openRenameModal(item.path)}
                            >
                              Rename
                            </DropdownItem>
                          )}
                          <DropdownItem 
                            icon={<Download className="w-4 h-4" />}
                            onClick={() => handleDownload(item.path)}
                          >
                            Download
                          </DropdownItem>
                          <DropdownItem icon={<Copy className="w-4 h-4" />}>Copy</DropdownItem>
                          <DropdownItem icon={<Scissors className="w-4 h-4" />}>Cut</DropdownItem>
                          <DropdownDivider />
                          <DropdownItem 
                            icon={<Trash2 className="w-4 h-4" />} 
                            danger
                            onClick={() => {
                              setSelected(new Set([item.path]));
                              setShowDelete(true);
                            }}
                          >
                            Delete
                          </DropdownItem>
                        </Dropdown>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 overflow-auto h-full">
            {filteredFiles.length === 0 ? (
              <div className="col-span-full text-center text-dark-400 p-8">
                No files found
              </div>
            ) : (
              filteredFiles.map((item) => (
                <motion.div
                  key={item.path}
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    'p-3 rounded-lg border border-dark-700 hover:border-dark-600 cursor-pointer transition-all',
                    selected.has(item.path) && 'border-primary-500 bg-primary-500/10'
                  )}
                  onClick={() => item.type === 'folder' && handleNavigate(item.path)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 flex items-center justify-center">
                      {item.type === 'folder' ? (
                        <Folder className="w-10 h-10 text-yellow-400" />
                      ) : (
                        getFileIcon(item)
                      )}
                    </div>
                    <span className="text-sm text-dark-200 text-center truncate w-full">{item.name}</span>
                    <span className="text-xs text-dark-500">{formatSize(item.size)}</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Files" size="md">
        <div 
          className="border-2 border-dashed border-dark-600 rounded-xl p-8 text-center hover:border-primary-500/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-300 mb-2">Drag and drop files here, or click to browse</p>
          <p className="text-sm text-dark-500">Maximum file size: 100MB</p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* New Folder Modal */}
      <Modal open={showNewFolder} onClose={() => setShowNewFolder(false)} title="New Folder" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Folder Name</label>
            <input
              type="text"
              placeholder="my-folder"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              className="w-full px-4 py-2.5 bg-dark-900/50 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => {
              setShowNewFolder(false);
              setNewFolderName('');
            }}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal open={showRename} onClose={() => {
        setShowRename(false);
        setRenamePath('');
        setRenameName('');
      }} title="Rename" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Name</label>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="w-full px-4 py-2.5 bg-dark-900/50 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => {
              setShowRename(false);
              setRenamePath('');
              setRenameName('');
            }}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        type="danger"
        title="Delete Files"
        message={`Are you sure you want to delete ${selected.size} item${selected.size > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
