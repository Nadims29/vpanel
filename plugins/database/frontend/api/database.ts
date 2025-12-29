import { get, post, del } from '@/api/client';

export type DatabaseType = 'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'mariadb';

export interface DatabaseServer {
  id: string;
  node_id?: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  status: 'online' | 'offline' | 'error' | 'unknown';
  container_id?: string;
  is_local?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Request for connecting to an existing database server
export interface ConnectDatabaseServerRequest {
  mode: 'connect';
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  password: string;
  node_id?: string;
}

// Request for creating a local database server using Docker
export interface CreateLocalDatabaseServerRequest {
  mode: 'create';
  name: string;
  type: DatabaseType;
  port?: number;
  root_password: string;
  version?: string;
}

export type CreateDatabaseServerRequest = ConnectDatabaseServerRequest | CreateLocalDatabaseServerRequest;

// Deploy task for tracking deployment progress
export interface DeployTaskStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
}

export interface DeployTask {
  id: string;
  name: string;
  type: DatabaseType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  steps?: { steps: DeployTaskStep[] };
  error?: string;
  server_id?: string;
  completed_at?: string;
  created_at?: string;
}

// Get deploy task status
export async function getDeployTask(id: string): Promise<DeployTask> {
  return get<DeployTask>(`/database/deploy/${id}`);
}

export interface DatabaseInstance {
  id: string;
  name: string;
  server_id: string;
  size?: string;
  tables?: number;
  charset?: string;
  collation?: string;
}

// List all database servers
export async function listServers(): Promise<DatabaseServer[]> {
  return get<DatabaseServer[]>('/database/servers');
}

// Create a new database server
export async function createServer(data: CreateDatabaseServerRequest): Promise<DatabaseServer> {
  return post<DatabaseServer>('/database/servers', data);
}

// Delete a database server
export async function deleteServer(id: string): Promise<void> {
  return del<void>(`/database/servers/${id}`);
}

// List databases for a server
export async function listDatabases(serverId: string): Promise<DatabaseInstance[]> {
  return get<DatabaseInstance[]>(`/database/servers/${serverId}/databases`);
}

// Create a database
export async function createDatabase(serverId: string, name: string): Promise<void> {
  return post<void>(`/database/servers/${serverId}/databases`, { name });
}

// Delete a database
export async function deleteDatabase(serverId: string, dbName: string): Promise<void> {
  return del<void>(`/database/servers/${serverId}/databases/${dbName}`);
}

// Backup interfaces
export interface DatabaseBackup {
  id: string;
  server_id: string;
  database: string;
  file_name: string;
  file_path: string;
  file_size: number;
  type: 'manual' | 'scheduled';
  status: 'completed' | 'failed' | 'in_progress';
  error?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateBackupRequest {
  database: string;
  type?: 'manual' | 'scheduled';
}

export interface RestoreBackupRequest {
  backup_id: string;
  target_database: string;
}

// List all backups
export async function listBackups(serverId?: string): Promise<DatabaseBackup[]> {
  const params = serverId ? { server_id: serverId } : undefined;
  return get<DatabaseBackup[]>('/database/backups', params);
}

// Get a backup by ID
export async function getBackup(id: string): Promise<DatabaseBackup> {
  return get<DatabaseBackup>(`/database/backups/${id}`);
}

// Create a backup
export async function createBackup(serverId: string, data: CreateBackupRequest): Promise<DatabaseBackup> {
  return post<DatabaseBackup>(`/database/servers/${serverId}/backup`, data);
}

// Delete a backup
export async function deleteBackup(id: string): Promise<void> {
  return del<void>(`/database/backups/${id}`);
}

// Restore a backup
export async function restoreBackup(serverId: string, data: RestoreBackupRequest): Promise<void> {
  return post<void>(`/database/servers/${serverId}/restore`, data);
}


