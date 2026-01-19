export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// DEPRECATED: Use /api/job-status instead
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Deprecated. Use GET /api/job-status' },
    { status: 410 }
  );
}

