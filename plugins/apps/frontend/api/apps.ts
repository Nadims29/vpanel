import { get, post, put, del } from '@/api/client';

// App represents a deployed application
export interface App {
  id: string;
  name: string;
  description: string;
  status: 'stopped' | 'building' | 'running' | 'failed';
  git_url: string;
  git_branch: string;
  dockerfile_path: string;
  build_context: string;
  port: number;
  env_vars: Record<string, string> | null;
  container_id: string;
  host_port: number;
  image_tag: string;
  domain: string;
  nginx_site_id: string;
  last_deploy_at: string | null;
  created_at: string;
  updated_at: string;
}

// AppDeployment represents a deployment record
export interface AppDeployment {
  id: string;
  app_id: string;
  commit_hash: string;
  commit_msg: string;
  status: 'pending' | 'cloning' | 'building' | 'deploying' | 'success' | 'failed';
  progress: number;
  logs: string;
  error: string;
  duration: number;
  finished_at: string | null;
  created_at: string;
}

// CreateAppRequest for creating a new app
export interface CreateAppRequest {
  name: string;
  description?: string;
  git_url: string;
  git_branch?: string;
  git_token?: string;
  dockerfile_path?: string;
  build_context?: string;
  port?: number;
  env_vars?: Record<string, string>;
  domain?: string;
}

// List all apps
export async function listApps(): Promise<App[]> {
  return get<App[]>('/apps');
}

// Get an app by ID
export async function getApp(id: string): Promise<App> {
  return get<App>(`/apps/${id}`);
}

// Create a new app
export async function createApp(data: CreateAppRequest): Promise<App> {
  return post<App>('/apps', data);
}

// Update an app
export async function updateApp(id: string, data: Partial<App>): Promise<App> {
  return put<App>(`/apps/${id}`, data);
}

// Delete an app
export async function deleteApp(id: string): Promise<void> {
  return del<void>(`/apps/${id}`);
}

// Trigger a deployment
export async function deployApp(id: string): Promise<AppDeployment> {
  return post<AppDeployment>(`/apps/${id}/deploy`);
}

// Start an app
export async function startApp(id: string): Promise<void> {
  return post<void>(`/apps/${id}/start`);
}

// Stop an app
export async function stopApp(id: string): Promise<void> {
  return post<void>(`/apps/${id}/stop`);
}

// Restart an app
export async function restartApp(id: string): Promise<void> {
  return post<void>(`/apps/${id}/restart`);
}

// Get app logs
export async function getAppLogs(id: string, tail?: number): Promise<{ logs: string }> {
  return get<{ logs: string }>(`/apps/${id}/logs`, { tail: tail || 500 });
}

// List deployments for an app
export async function listDeployments(appId: string): Promise<AppDeployment[]> {
  return get<AppDeployment[]>(`/apps/${appId}/deployments`);
}

// Get a specific deployment
export async function getDeployment(appId: string, deploymentId: string): Promise<AppDeployment> {
  return get<AppDeployment>(`/apps/${appId}/deployments/${deploymentId}`);
}

// Runtime Management
export type RuntimeType = 'nodejs' | 'python' | 'java' | 'php' | 'ruby' | 'go' | 'dotnet';

export interface RuntimeInfo {
  type: RuntimeType;
  name: string;
  description: string;
  icon: string;
  versions: string[];
  installed: string[];
}

// List available runtimes
export async function listRuntimes(): Promise<RuntimeInfo[]> {
  return get<RuntimeInfo[]>('/apps/runtimes');
}

// Get installed runtimes
export async function getInstalledRuntimes(): Promise<Record<RuntimeType, string[]>> {
  return get<Record<RuntimeType, string[]>>('/apps/runtimes/installed');
}

// Install a runtime
export interface InstallRuntimeRequest {
  type: RuntimeType;
  version: string;
}

export async function installRuntime(data: InstallRuntimeRequest): Promise<{ message: string }> {
  return post<{ message: string }>('/apps/runtimes/install', data);
}

// Runtime detail information
export interface RuntimeDetail {
  type: RuntimeType;
  version: string;
  path: string;
  executable: string;
  installed_at: string | null;
  is_default: boolean;
  info: Record<string, any>;
}

// Get runtime detail
export async function getRuntimeDetail(type: RuntimeType, version: string): Promise<RuntimeDetail> {
  return get<RuntimeDetail>('/apps/runtimes/detail', { type, version });
}

// Uninstall a runtime
export interface UninstallRuntimeRequest {
  type: RuntimeType;
  version: string;
}

export async function uninstallRuntime(data: UninstallRuntimeRequest): Promise<{ message: string }> {
  return post<{ message: string }>('/apps/runtimes/uninstall', data);
}

