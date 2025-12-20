import { apiClient } from '@/api/client';

export interface SystemInfo {
  hostname: string;
  os: string;
  platform: string;
  platform_version: string;
  arch: string;
  kernel_version: string;
  uptime: number;
  boot_time: number;
  procs: number;
  cpu_cores: number;
  cpu_model: string;
  total_memory: number;
  total_disk: number;
}

export interface CPUMetrics {
  usage_percent: number;
  per_core: number[];
  cores: number;
}

export interface MemoryMetrics {
  total: number;
  used: number;
  available: number;
  used_percent: number;
  swap_total: number;
  swap_used: number;
}

export interface DiskMetrics {
  total: number;
  used: number;
  free: number;
  used_percent: number;
  path: string;
}

export interface NetworkMetrics {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
}

export interface LoadMetrics {
  load1: number;
  load5: number;
  load15: number;
}

export interface SystemMetrics {
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  load: LoadMetrics;
}

export interface DashboardOverview {
  containers: number;
  running: number;
  sites: number;
  databases: number;
  alerts: number;
  metrics: SystemMetrics;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  status: string;
  username: string;
  cpu_percent: number;
  mem_percent: number;
  memory: number;
  create_time: number;
  command: string;
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const response = await apiClient.get('/dashboard');
  return response.data;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const response = await apiClient.get('/monitor/system');
  return response.data.data;
}

export async function getMetrics(): Promise<SystemMetrics> {
  const response = await apiClient.get('/monitor/metrics');
  return response.data.data;
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  const response = await apiClient.get('/monitor/processes');
  return response.data.data;
}

export async function killProcess(pid: number): Promise<void> {
  await apiClient.post(`/monitor/process/${pid}/kill`);
}
