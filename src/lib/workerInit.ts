import { getJob, updateJobProgress, updateJobStatus, setJobResult, setJobError } from './queue';
import { processResearchJob } from './worker';

let processingJobs = new Set<string>();

async function processNextJob(): Promise<void> {
  // Keep processing jobs every 100ms
  setInterval(() => {
    // Note: In a real scenario, you'd want to properly queue jobs
    // For now, jobs are processed on-demand via the API
  }, 100);
}

export function initializeWorker() {
  console.log('[Worker] In-memory job processor initialized');
  processNextJob().catch(console.error);
}

export async function processJobById(jobId: string): Promise<void> {
  if (processingJobs.has(jobId)) {
    return;
  }

  const job = getJob(jobId);
  if (!job) return;

  processingJobs.add(jobId);
  updateJobStatus(jobId, 'processing');

  try {
    const result = await processResearchJob(jobId, job.data, (progress: number) => {
      updateJobProgress(jobId, progress);
    });
    setJobResult(jobId, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`[Worker] Error processing job ${jobId}:`, error);
    setJobError(jobId, errorMessage);
  } finally {
    processingJobs.delete(jobId);
  }
}

