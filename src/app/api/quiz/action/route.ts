import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { roomManager } from '@/lib/room-manager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomCode, action, participantData, answerData } = body;
    if (!roomCode) {
      return NextResponse.json({ success: false, error: 'roomCode is required' }, { status: 400 });
    }

    const session = await db.getSessionByRoomCode(roomCode);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    if (action === 'JOIN') {
      const result = await roomManager.joinRoom(roomCode, participantData);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'SUBMIT_ANSWER') {
      const { participantId, selectedOption } = answerData || {};
      if (!participantId || !['A', 'B', 'C', 'D'].includes(selectedOption)) {
        return NextResponse.json({ success: false, error: 'Jawaban tidak valid' }, { status: 400 });
      }
      const result = await roomManager.submitAnswer(roomCode, participantId, selectedOption);
      return NextResponse.json({ success: true, data: result });
    }

    const hostActions = ['START', 'NEXT_QUESTION', 'REVEAL_ANSWER', 'SHOW_LEADERBOARD', 'SHOW_PODIUM', 'FINISH', 'PAUSE', 'RESUME', 'SKIP'];
    if (hostActions.includes(action)) {
      const updatedSession = await roomManager.updateSessionStatus(roomCode, action);
      return NextResponse.json({ success: true, data: updatedSession });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
