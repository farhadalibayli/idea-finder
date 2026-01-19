export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// DEPRECATED: Use /api/start-job and /api/job-status instead
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'This endpoint is deprecated. Use POST /api/start-job and GET /api/job-status instead.',
    },
    { status: 410 }
  );
}


