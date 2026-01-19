export interface JobData {
  keyword: string;
  location: string;
  budget: string;
}

export interface JobResult {
  problem: string;
  target_users: string;
  why_it_matters: string;
  existing_bad_solutions: string;
  mvp_idea: string;
  why_it_can_work_in_location: string;
  estimated_budget_range: string;
  revenue_model: string;
  first_3_steps: string[];
}

type JobStatus = 'waiting' | 'processing' | 'completed' | 'failed';

interface Job {
  id: string;
  data: JobData;
  status: JobStatus;
  progress: number;
  result: JobResult | null;
  error: string | null;
  createdAt: number;
}

const jobs = new Map<string, Job>();

export function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function enqueueResearchJob(data: JobData): Promise<string> {
  const jobId = generateJobId();
  const job: Job = {
    id: jobId,
    data,
    status: 'waiting',
    progress: 0,
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(jobId, job);
  console.log(`[Queue] Job ${jobId} enqueued`);
  return jobId;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function updateJobProgress(jobId: string, progress: number): void {
  const job = jobs.get(jobId);
  if (job) {
    job.progress = Math.min(100, Math.max(0, progress));
  }
}

export function updateJobStatus(jobId: string, status: JobStatus): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = status;
  }
}

export function setJobResult(jobId: string, result: JobResult): void {
  const job = jobs.get(jobId);
  if (job) {
    job.result = result;
    job.status = 'completed';
    job.progress = 100;
  }
}

export function setJobError(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.error = error;
    job.status = 'failed';
  }
}

export async function getJobStatus(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    data: job.data,
    result: job.result,
    error: job.error,
  };
}

export async function saveJobResult(jobId: string, result: JobResult): Promise<void> {
  setJobResult(jobId, result);
}
