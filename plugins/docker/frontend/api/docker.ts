import { get, post, del } from '@/api/client';

export interface DockerInfo {
  containers: number;
  containers_running: number;
  containers_paused: number;
  containers_stopped: number;
  images: number;
  server_version: string;
  os: string;
  architecture: string;
  memory: number;
  cpus: number;
  name: string;
}

// Get Docker daemon info
export async function getDockerInfo(): Promise<DockerInfo> {
  return get<DockerInfo>('/docker/info');
}

// Check if Docker is available
export async function checkDockerStatus(): Promise<{ available: boolean; info?: DockerInfo; error?: string }> {
  try {
    const info = await getDockerInfo();
    return { available: true, info };
  } catch (error) {
    return { 
      available: false, 
      error: error instanceof Error ? error.message : 'Docker is not available' 
    };
  }
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused' | 'restarting' | 'exited' | 'created';
  created: string;
  cpu?: number;
  memory?: { used: number; limit: number };
  ports?: string[];
  network?: string;
  command?: string;
  state?: string;
  size?: string;
  labels?: Record<string, string>;
}

export interface ContainerStats {
  cpu: number;
  memory: { used: number; limit: number };
  network: { rx: number; tx: number };
  blockIO: { read: number; write: number };
}

export interface CreateContainerRequest {
  name: string;
  image: string;
  ports?: Array<{ host: number; container: number; protocol?: string }>;
  network?: string;
  env?: Record<string, string>;
  volumes?: Array<{ host: string; container: string }>;
  command?: string[];
  restart?: string;
  autoRemove?: boolean;
}

export interface ContainerLogsOptions {
  tail?: number;
  follow?: boolean;
  since?: string;
  until?: string;
  timestamps?: boolean;
}

// List all containers
export async function listContainers(all = false): Promise<Container[]> {
  return get<Container[]>('/docker/containers', { all });
}

// Get container details
export async function getContainer(id: string): Promise<Container> {
  return get<Container>(`/docker/containers/${id}`);
}

// Create a new container
export async function createContainer(data: CreateContainerRequest): Promise<Container> {
  return post<Container>('/docker/containers', data);
}

// Start container
export async function startContainer(id: string): Promise<void> {
  return post<void>(`/docker/containers/${id}/start`);
}

// Stop container
export async function stopContainer(id: string): Promise<void> {
  return post<void>(`/docker/containers/${id}/stop`);
}

// Restart container
export async function restartContainer(id: string): Promise<void> {
  return post<void>(`/docker/containers/${id}/restart`);
}

// Remove container
export async function removeContainer(id: string, force = false): Promise<void> {
  return del<void>(`/docker/containers/${id}?force=${force}`);
}

// Get container logs
export async function getContainerLogs(
  id: string,
  options?: ContainerLogsOptions
): Promise<string> {
  const params: Record<string, unknown> = {};
  if (options?.tail) params.tail = options.tail;
  if (options?.follow) params.follow = options.follow;
  if (options?.since) params.since = options.since;
  if (options?.until) params.until = options.until;
  if (options?.timestamps) params.timestamps = options.timestamps;
  
  return get<string>(`/docker/containers/${id}/logs`, params);
}

// Get container stats
export async function getContainerStats(id: string): Promise<ContainerStats> {
  return get<ContainerStats>(`/docker/containers/${id}/stats`);
}

// Image interfaces
export interface Image {
  id: string;
  tags: string[];
  size: number;
  created: string;
}

export interface PullImageRequest {
  image: string;
}

// List all images
export async function listImages(): Promise<Image[]> {
  return get<Image[]>('/docker/images');
}

// Pull an image
export async function pullImage(image: string): Promise<void> {
  return post<void>('/docker/images/pull', { image });
}

// Remove an image
export async function removeImage(id: string, force = false): Promise<void> {
  return del<void>(`/docker/images/${id}?force=${force}`);
}

// Network interfaces
export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
}

export interface CreateNetworkRequest {
  name: string;
  driver?: string;
}

// List all networks
export async function listNetworks(): Promise<Network[]> {
  return get<Network[]>('/docker/networks');
}

// Create a network
export async function createNetwork(data: CreateNetworkRequest): Promise<Network> {
  return post<Network>('/docker/networks', data);
}

// Remove a network
export async function removeNetwork(id: string): Promise<void> {
  return del<void>(`/docker/networks/${id}`);
}

// Volume interfaces
export interface Volume {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
}

export interface CreateVolumeRequest {
  name: string;
  driver?: string;
}

// List all volumes
export async function listVolumes(): Promise<Volume[]> {
  return get<Volume[]>('/docker/volumes');
}

// Create a volume
export async function createVolume(data: CreateVolumeRequest): Promise<Volume> {
  return post<Volume>('/docker/volumes', data);
}

// Remove a volume
export async function removeVolume(name: string, force = false): Promise<void> {
  return del<void>(`/docker/volumes/${name}?force=${force}`);
}

// Compose interfaces
export interface ComposeProject {
  id: string;
  name: string;
  path: string;
  status: 'running' | 'stopped' | 'partial' | 'unknown';
  description: string;
  created: string;
  updated: string;
}

export interface CreateComposeProjectRequest {
  name: string;
  path: string;
  content: string;
  description?: string;
}

// List all compose projects
export async function listComposeProjects(): Promise<ComposeProject[]> {
  return get<ComposeProject[]>('/docker/compose');
}

// Create a compose project
export async function createComposeProject(data: CreateComposeProjectRequest): Promise<ComposeProject> {
  return post<ComposeProject>('/docker/compose', data);
}

// Remove a compose project
export async function removeComposeProject(id: string): Promise<void> {
  return del<void>(`/docker/compose/${id}`);
}

// Start compose project
export async function composeUp(id: string): Promise<void> {
  return post<void>(`/docker/compose/${id}/up`);
}

// Stop compose project
export async function composeDown(id: string): Promise<void> {
  return post<void>(`/docker/compose/${id}/down`);
}

