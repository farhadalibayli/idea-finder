export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { enqueueResearchJob, JobData } from '@/lib/queue';
import { processJobById } from '@/lib/workerInit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as any;
    const { keyword, location = 'Azerbaijan', budget = '<$100' } = body;

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing keyword parameter' },
        { status: 400 }
      );
    }

    const jobData: JobData = {
      keyword: keyword.trim(),
      location,
      budget,
    };

    const jobId = await enqueueResearchJob(jobData);

    // Start processing the job asynchronously (non-blocking)
    processJobById(jobId).catch((error) => {
      console.error(`Error processing job ${jobId}:`, error);
    });

    return NextResponse.json(
      { jobId },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error in /api/start-job:', error);
    return NextResponse.json(
      { error: 'Failed to start job' },
      { status: 500 }
    );
  }
}
