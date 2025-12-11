import { get, post } from './client';
import api from './client';

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mode: number;
  mode_string: string;
  mod_time: string;
  owner: string;
  group: string;
  is_symlink: boolean;
  symlink_path?: string;
  extension?: string;
}

export interface DirectoryListing {
  path: string;
  files: FileInfo[];
}

export interface FileContent {
  path: string;
  content: string;
}

// List directory contents
export async function listDirectory(path: string = '/'): Promise<DirectoryListing> {
  return get<DirectoryListing>('/files/list', { path });
}

// Read file content
export async function readFile(path: string): Promise<FileContent> {
  return get<FileContent>('/files/read', { path });
}

// Write file content
export async function writeFile(path: string, content: string): Promise<void> {
  return post<void>('/files/write', { path, content });
}

// Create directory
export async function createDirectory(path: string): Promise<void> {
  return post<void>('/files/mkdir', { path });
}

// Rename file/directory
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  return post<void>('/files/rename', { old_path: oldPath, new_path: newPath });
}

// Copy file/directory
export async function copyFile(source: string, destination: string): Promise<void> {
  return post<void>('/files/copy', { source, destination });
}

// Move file/directory
export async function moveFile(source: string, destination: string): Promise<void> {
  return post<void>('/files/move', { source, destination });
}

// Delete file/directory
export async function deleteFile(path: string): Promise<void> {
  const response = await api.delete<{ success: boolean; data?: unknown; error?: { message: string } }>('/files/delete', {
    params: { path },
  });
  if (!response.data.success) {
    throw new Error(response.data.error?.message || 'Delete failed');
  }
}

// Search files
export async function searchFiles(path: string, pattern: string): Promise<FileInfo[]> {
  return get<FileInfo[]>('/files/search', { path, pattern });
}

// Get file permissions
export async function getPermissions(path: string): Promise<{ mode: number; mode_string: string }> {
  return get<{ mode: number; mode_string: string }>('/files/permissions', { path });
}

// Set file permissions
export async function setPermissions(path: string, mode: number): Promise<void> {
  return post<void>('/files/permissions', { path, mode });
}

// Compress files
export async function compressFiles(paths: string[], destPath: string, format?: string): Promise<void> {
  return post<void>('/files/compress', { paths, dest_path: destPath, format: format || 'zip' });
}

// Decompress archive
export async function decompressFile(archivePath: string, destPath: string): Promise<void> {
  return post<void>('/files/decompress', { archive_path: archivePath, dest_path: destPath });
}
