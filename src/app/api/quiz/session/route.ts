import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/authorize';
import { verifyParticipantToken } from '@/lib/participant-auth';
import { participantsForClient, sessionForClient } from '@/lib/public-session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('roomCode')?.trim().toUpperCase();
    const sessionId = searchParams.get('sessionId')?.trim();

    if (!roomCode && !sessionId) {
      return NextResponse.json({ success: false, error: 'roomCode atau sessionId wajib diisi' }, { status: 400 });
    }

    let session = roomCode ? await db.getSessionByRoomCode(roomCode) : undefined;
    if (!session && sessionId) session = await db.getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Sesi quiz tidak ditemukan' }, { status: 404 });
    }

    const user = await getAuthenticatedUser(req);
    const privileged = Boolean(user && ['SUPER_ADMIN', 'TRAINER'].includes(user.role));

    if (!privileged) {
      const token = req.cookies.get('tqa_participant_token')?.value;
      const participantAuth = token
        ? await verifyParticipantToken(token, {
            sessionId: session.session_id,
            roomCode: session.room_code,
          })
        : null;
      if (!participantAuth) {
        return NextResponse.json(
          { success: false, error: 'Sesi peserta tidak valid atau sudah kedaluwarsa. Silakan join ulang.' },
          { status: 401 }
        );
      }
    }

    const [participants, answers] = await Promise.all([
      db.getParticipants(session.session_id),
      db.getAnswers(session.session_id),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          session: sessionForClient(session, privileged),
          participants: participantsForClient(participants, privileged),
          answersCount: answers.length,
          totalQuestions: session.questions.length,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
