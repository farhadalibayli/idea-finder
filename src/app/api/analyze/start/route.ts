export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// DEPRECATED: Use /api/start-job instead
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Deprecated. Use POST /api/start-job' },
    { status: 410 }
  );
}

