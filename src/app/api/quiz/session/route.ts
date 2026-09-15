import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('roomCode');
    const sessionId = searchParams.get('sessionId');

    let session = roomCode ? db.getSessionByRoomCode(roomCode) : undefined;
    if (!session && sessionId) {
      session = db.getSessionById(sessionId);
    }

    if (!session) {
      return NextResponse.json({ success: false, error: 'Sesi quiz tidak ditemukan' }, { status: 404 });
    }

    const participants = db.getParticipants(session.session_id);
    const answers = db.getAnswers(session.session_id);

    return NextResponse.json({
      success: true,
      data: {
        session,
        participants,
        answersCount: answers.length,
        totalQuestions: session.questions.length
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
