import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/authorize';
import { issueParticipantToken, verifyParticipantToken } from '@/lib/participant-auth';
import { sessionForClient } from '@/lib/public-session';
import { roomManager } from '@/lib/room-manager';
import { Participant, TeamId } from '@/types/quiz';

export const dynamic = 'force-dynamic';

const HOST_ACTIONS = new Set([
  'START',
  'NEXT_QUESTION',
  'REVEAL_ANSWER',
  'SHOW_LEADERBOARD',
  'SHOW_PODIUM',
  'FINISH',
  'PAUSE',
  'RESUME',
  'SKIP',
]);

function cleanText(value: unknown, maxLength: number): string {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function looksLikeEmail(value: string): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function createOrResumeParticipant(
  req: NextRequest,
  sessionId: string,
  roomCode: string,
  mode: string,
  data: { name: string; company: string; unit_kerja: string; email?: string }
): Promise<Participant> {
  const existingToken = req.cookies.get('tqa_participant_token')?.value;
  const existingAuth = existingToken
    ? await verifyParticipantToken(existingToken, { sessionId, roomCode })
    : null;

  if (existingAuth) {
    const existing = await db.getParticipantById(existingAuth.participantId);
    if (existing && existing.session_id === sessionId) {
      existing.is_connected = true;
      existing.last_active = Date.now();
      await db.saveParticipant(existing);
      return existing;
    }
  }

  const participants = await db.getParticipants(sessionId);
  let team: TeamId | undefined;
  if (mode === 'TEAM_BATTLE') {
    const teams: TeamId[] = ['TEAM_ALPHA', 'TEAM_BRAVO', 'TEAM_CHARLIE', 'TEAM_DELTA'];
    team = teams[participants.length % teams.length];
  }

  const participant: Participant = {
    id: 'p-' + crypto.randomUUID(),
    session_id: sessionId,
    name: data.name,
    company: data.company,
    unit_kerja: data.unit_kerja,
    email: data.email,
    team,
    avatar_seed: String(participants.length + 1),
    total_score: 0,
    rank: participants.length + 1,
    previous_rank: participants.length + 1,
    streak: 0,
    max_streak: 0,
    total_correct: 0,
    total_wrong: 0,
    total_timeout: 0,
    total_response_time_ms: 0,
    fastest_response_ms: 0,
    last_active: Date.now(),
    is_connected: true,
  };
  await db.saveParticipant(participant);
  return participant;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomCode = cleanText(body?.roomCode, 32).toUpperCase();
    const action = cleanText(body?.action, 40).toUpperCase();

    if (!roomCode) {
      return NextResponse.json({ success: false, error: 'roomCode is required' }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    const session = await db.getSessionByRoomCode(roomCode);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    if (action === 'JOIN') {
      if (['FINISHED', 'PODIUM'].includes(session.status)) {
        return NextResponse.json({ success: false, error: 'Sesi quiz sudah selesai' }, { status: 409 });
      }

      const participantData = body?.participantData || {};
      const name = cleanText(participantData.name, 100);
      const company = cleanText(participantData.company, 120);
      const unitKerja = cleanText(participantData.unit_kerja, 120);
      const email = cleanText(participantData.email, 160).toLowerCase();

      if (name.length < 2 || company.length < 2 || unitKerja.length < 2) {
        return NextResponse.json({ success: false, error: 'Data peserta belum lengkap atau terlalu pendek' }, { status: 400 });
      }
      if (!looksLikeEmail(email)) {
        return NextResponse.json({ success: false, error: 'Format email tidak valid' }, { status: 400 });
      }

      const participant = await createOrResumeParticipant(req, session.session_id, roomCode, session.mode, {
        name,
        company,
        unit_kerja: unitKerja,
        email: email || undefined,
      });
      const participants = await db.getParticipants(session.session_id);
      roomManager.broadcast(roomCode, 'PARTICIPANT_JOINED', { participants, newParticipant: participant });

      const participantToken = await issueParticipantToken({
        participantId: participant.id,
        sessionId: session.session_id,
        roomCode,
      });

      const response = NextResponse.json(
        {
          success: true,
          data: {
            participant,
            session: sessionForClient(session, false),
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
      response.cookies.set('tqa_participant_token', participantToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
      });
      return response;
    }

    if (action === 'SUBMIT_ANSWER') {
      const participantId = cleanText(body?.answerData?.participantId, 80);
      const selectedOption = cleanText(body?.answerData?.selectedOption, 1).toUpperCase();
      if (!participantId || !['A', 'B', 'C', 'D'].includes(selectedOption)) {
        return NextResponse.json({ success: false, error: 'Jawaban tidak valid' }, { status: 400 });
      }

      const token = req.cookies.get('tqa_participant_token')?.value;
      if (!token || !(await verifyParticipantToken(token, {
        participantId,
        sessionId: session.session_id,
        roomCode,
      }))) {
        return NextResponse.json(
          { success: false, error: 'Sesi peserta tidak valid atau sudah kedaluwarsa. Silakan join ulang.' },
          { status: 401 }
        );
      }

      await roomManager.submitAnswer(roomCode, participantId, selectedOption as 'A' | 'B' | 'C' | 'D');

      // Do not reveal correctness, score or streak while the question is active.
      // Personalized result details arrive over SSE only after ANSWER_REVEAL.
      return NextResponse.json(
        { success: true, data: { accepted: true, selectedOption } },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (HOST_ACTIONS.has(action)) {
      const user = await requireRole(req, ['SUPER_ADMIN', 'TRAINER']);
      if (!user) {
        return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
      }
      return NextResponse.json({
        success: true,
        data: await roomManager.updateSessionStatus(
          roomCode,
          action as 'START' | 'NEXT_QUESTION' | 'REVEAL_ANSWER' | 'SHOW_LEADERBOARD' | 'SHOW_PODIUM' | 'FINISH' | 'PAUSE' | 'RESUME' | 'SKIP'
        ),
      });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    const message = error?.message || 'Terjadi kesalahan pada quiz';
    const misconfigured = message.includes('_TOKEN_SECRET') || message.includes('AUTH_');
    const conflict = /sudah terkunci|sedang tidak aktif|sudah selesai/i.test(message);
    return NextResponse.json(
      { success: false, error: misconfigured ? 'Konfigurasi keamanan production belum lengkap' : message },
      { status: misconfigured ? 503 : conflict ? 409 : 500 }
    );
  }
}
