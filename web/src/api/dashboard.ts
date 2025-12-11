import { get } from './client';

export interface DashboardOverview {
  containers: number;
  running: number;
  sites: number;
  databases: number;
  alerts: number;
  metrics?: SystemMetrics;
}

export interface SystemMetrics {
  cpu: {
    usage_percent: number;
    per_core: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    used_percent: number;
    swap_total: number;
    swap_used: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    used_percent: number;
    path: string;
  };
  network: {
    bytes_sent: number;
    bytes_recv: number;
    packets_sent: number;
    packets_recv: number;
  };
  load: {
    load1: number;
    load5: number;
    load15: number;
  };
}

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

// Get dashboard overview
export async function getDashboardOverview(): Promise<DashboardOverview> {
  return get<DashboardOverview>('/dashboard');
}

// Get dashboard stats
export async function getDashboardStats(): Promise<SystemMetrics> {
  return get<SystemMetrics>('/dashboard/stats');
}

// Get system info
export async function getSystemInfo(): Promise<SystemInfo> {
  return get<SystemInfo>('/monitor/system');
}

// Get system metrics
export async function getSystemMetrics(): Promise<SystemMetrics> {
  return get<SystemMetrics>('/monitor/metrics');
}

// Get processes
export async function getProcesses(): Promise<ProcessInfo[]> {
  return get<ProcessInfo[]>('/monitor/processes');
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

// Kill a process
export async function killProcess(pid: number): Promise<void> {
  const { post } = await import('./client');
  return post<void>(`/monitor/process/${pid}/kill`);
}
