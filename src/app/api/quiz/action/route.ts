import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/authorize';
import { issueParticipantToken, verifyParticipantToken } from '@/lib/participant-auth';
import { sessionForClient } from '@/lib/public-session';
import { roomManager } from '@/lib/room-manager';

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

      const result = await roomManager.joinRoom(roomCode, {
        name,
        company,
        unit_kerja: unitKerja,
        email: email || undefined,
      });
      const participantToken = await issueParticipantToken({
        participantId: result.participant.id,
        sessionId: result.session.session_id,
        roomCode,
      });

      const response = NextResponse.json({
        success: true,
        data: {
          participant: result.participant,
          session: sessionForClient(result.session, false),
        },
      });
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

      const result = await roomManager.submitAnswer(roomCode, participantId, selectedOption as 'A' | 'B' | 'C' | 'D');
      return NextResponse.json({ success: true, data: result });
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
    return NextResponse.json(
      { success: false, error: misconfigured ? 'Konfigurasi keamanan production belum lengkap' : message },
      { status: misconfigured ? 503 : 500 }
    );
  }
}
