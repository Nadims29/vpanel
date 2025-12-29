import { get, post, put, del } from '@/api/client';

export interface CronJob {
  id: string;
  node_id: string;
  name: string;
  schedule: string;
  command: string;
  user: string;
  enabled: boolean;
  timeout: number;
  last_run_at?: string;
  next_run_at?: string;
  last_status?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCronJobRequest {
  node_id?: string;
  name: string;
  schedule: string;
  command: string;
  user?: string;
  enabled?: boolean;
  timeout?: number;
  description?: string;
}

export interface CronJobLog {
  id: number;
  job_id: string;
  started_at: string;
  ended_at?: string;
  duration: number;
  status: string;
  output: string;
  error: string;
  exit_code: number;
}

// List all cron jobs
export async function listJobs(nodeId?: string): Promise<CronJob[]> {
  const params = nodeId ? { node_id: nodeId } : {};
  return get<CronJob[]>('/cron/jobs', params);
}

// Get a cron job
export async function getJob(id: string): Promise<CronJob> {
  return get<CronJob>(`/cron/jobs/${id}`);
}

// Create a new cron job
export async function createJob(data: CreateCronJobRequest): Promise<CronJob> {
  return post<CronJob>('/cron/jobs', data);
}

// Update a cron job
export async function updateJob(id: string, data: Partial<CreateCronJobRequest>): Promise<CronJob> {
  return put<CronJob>(`/cron/jobs/${id}`, data);
}

// Delete a cron job
export async function deleteJob(id: string): Promise<void> {
  return del<void>(`/cron/jobs/${id}`);
}

// Run a cron job immediately
export async function runJob(id: string): Promise<CronJobLog> {
  return post<CronJobLog>(`/cron/jobs/${id}/run`);
}

// Get cron job logs
export async function getJobLogs(jobId: string, limit?: number): Promise<CronJobLog[]> {
  const params = limit ? { limit } : {};
  return get<CronJobLog[]>(`/cron/jobs/${jobId}/logs`, params);
}


