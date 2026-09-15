import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { authorizeRequest } from '@/lib/authz';
import { db } from '@/lib/db';
import { roomManager } from '@/lib/room-manager';
import { toPublicParticipant, toPublicSession } from '@/lib/public-session';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomCode = typeof body.roomCode === 'string' ? body.roomCode.trim().toUpperCase() : '';
    const action = typeof body.action === 'string' ? body.action : '';

    if (!roomCode || !action) {
      return NextResponse.json({ success: false, error: 'roomCode dan action wajib diisi.' }, { status: 400 });
    }

    const session = db.getSessionByRoomCode(roomCode);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Sesi quiz tidak ditemukan.' }, { status: 404 });
    }

    if (action === 'JOIN') {
      const participantData = body.participantData || {};
      if (
        typeof participantData.name !== 'string' || participantData.name.trim().length < 2 || participantData.name.length > 100 ||
        typeof participantData.company !== 'string' || participantData.company.trim().length < 2 || participantData.company.length > 150 ||
        typeof participantData.unit_kerja !== 'string' || participantData.unit_kerja.trim().length < 2 || participantData.unit_kerja.length > 150
      ) {
        return NextResponse.json({ success: false, error: 'Nama, perusahaan, dan unit kerja wajib diisi dengan benar.' }, { status: 400 });
      }

      const result = roomManager.joinRoom(roomCode, {
        name: participantData.name,
        company: participantData.company,
        unit_kerja: participantData.unit_kerja,
        email: typeof participantData.email === 'string' ? participantData.email.slice(0, 254) : undefined,
      });

      const publicParticipant = toPublicParticipant(result.participant);
      const participantToken = authService.createParticipantToken(result.participant.id, result.session.session_id);
      const response = NextResponse.json({
        success: true,
        data: {
          participant: {
            ...publicParticipant,
            company: result.participant.company,
            unit_kerja: result.participant.unit_kerja,
          },
          session: toPublicSession(result.session),
        },
      });

      response.cookies.set('tqa_participant_token', participantToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/quiz',
        maxAge: 12 * 60 * 60,
      });
      return response;
    }

    if (action === 'SUBMIT_ANSWER') {
      const answerData = body.answerData || {};
      const participantId = typeof answerData.participantId === 'string' ? answerData.participantId : '';
      const selectedOption = answerData.selectedOption;

      if (!participantId || !['A', 'B', 'C', 'D'].includes(selectedOption)) {
        return NextResponse.json({ success: false, error: 'Data jawaban tidak valid.' }, { status: 400 });
      }

      const participantToken = req.cookies.get('tqa_participant_token')?.value;
      const participantAuth = participantToken ? authService.verifyParticipantToken(participantToken) : null;
      if (
        !participantAuth ||
        participantAuth.participantId !== participantId ||
        participantAuth.sessionId !== session.session_id
      ) {
        return NextResponse.json(
          { success: false, error: 'Sesi peserta tidak valid. Silakan bergabung kembali melalui Room Code.' },
          { status: 401 }
        );
      }

      roomManager.submitAnswer(roomCode, participantId, selectedOption);
      return NextResponse.json({ success: true, accepted: true });
    }

    if (HOST_ACTIONS.has(action)) {
      const auth = authorizeRequest(req, ['SUPER_ADMIN', 'TRAINER']);
      if (!auth.ok) return auth.response;

      const updatedSession = roomManager.updateSessionStatus(roomCode, action as any);
      return NextResponse.json({ success: true, data: toPublicSession(updatedSession) });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memproses aksi quiz.';
    const status = /tidak ditemukan|tidak valid|terkunci|tidak aktif|sudah|hanya dapat/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
