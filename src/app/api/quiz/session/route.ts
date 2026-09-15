import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/authorize';
import { sessionForClient } from '@/lib/public-session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('roomCode');
    const sessionId = searchParams.get('sessionId');

    let session = roomCode ? await db.getSessionByRoomCode(roomCode) : undefined;
    if (!session && sessionId) session = await db.getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Sesi quiz tidak ditemukan' }, { status: 404 });
    }

    const user = await getAuthenticatedUser(req);
    const privileged = Boolean(user && ['SUPER_ADMIN', 'TRAINER'].includes(user.role));
    const [participants, answers] = await Promise.all([
      db.getParticipants(session.session_id),
      db.getAnswers(session.session_id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        session: sessionForClient(session, privileged),
        participants,
        answersCount: answers.length,
        totalQuestions: session.questions.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
