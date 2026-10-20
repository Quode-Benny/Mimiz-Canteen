import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ status: 'starting', checks: { database: 'not-connected', redis: 'not-connected', queue: 'not-configured' }, timestamp: new Date().toISOString() }, { status: 503 }); }
