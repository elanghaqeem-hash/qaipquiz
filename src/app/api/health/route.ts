import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  try {
    const questions = await db.getQuestions();
    return NextResponse.json(
      {
        ok: true,
        service: 'qaipquiz',
        storage: 'ready',
        seedLoaded: questions.length > 0,
        responseTimeMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        ok: false,
        service: 'qaipquiz',
        storage: 'unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
