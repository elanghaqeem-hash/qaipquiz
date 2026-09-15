import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authz';
import { db } from '@/lib/db';
import {
  canRevealParticipantAnswer,
  toPublicParticipants,
  toPublicSession,
} from '@/lib/public-session';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('roomCode')?.trim();
    const sessionId = searchParams.get('sessionId')?.trim();
    const participantId = searchParams.get('participantId')?.trim();

    let session = roomCode ? db.getSessionByRoomCode(roomCode) : undefined;
    if (!session && sessionId) {
      session = db.getSessionById(sessionId);
    }

    if (!session) {
      return NextResponse.json({ success: false, error: 'Sesi quiz tidak ditemukan.' }, { status: 404 });
    }

    const participants = db.getParticipants(session.session_id);
    const answers = db.getAnswers(session.session_id);
    const user = getAuthenticatedUser(req);
    const isStaff = user?.role === 'SUPER_ADMIN' || user?.role === 'TRAINER';

    if (isStaff) {
      return NextResponse.json(
        {
          success: true,
          data: {
            session,
            participants,
            answersCount: answers.length,
            totalQuestions: session.questions.length,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let myAnswer = null;
    if (participantId && canRevealParticipantAnswer(session)) {
      const participant = db.getParticipantById(participantId);
      const currentQuestion = session.questions[session.current_question_index];
      if (participant?.session_id === session.session_id && currentQuestion) {
        myAnswer = answers.find(answer =>
          answer.participant_id === participantId && answer.question_id === currentQuestion.question_id
        ) || null;
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          session: toPublicSession(session),
          participants: toPublicParticipants(participants),
          answersCount: answers.length,
          totalQuestions: session.questions.length,
          myAnswer,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat sesi quiz.' }, { status: 500 });
  }
}
