import { NextResponse } from 'next/server';

// =============================================================================
// SyncSpeak — Health Check Endpoint
// =============================================================================
//
// GET /api/health
//
// A lightweight endpoint for monitoring and deployment health checks.
// Returns a 200 with a status indicator and the current server timestamp.
// No authentication or CORS restrictions — this is intentionally public so that
// monitoring tools (UptimeRobot, Vercel health checks, etc.) can ping it.
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

// Handle preflight for consistency (no-op since health is GET-only)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
