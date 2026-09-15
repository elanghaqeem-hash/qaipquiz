import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { roomManager } from '@/lib/room-manager';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomCode, action, participantData, answerData } = body;

    if (!roomCode) {
      return NextResponse.json({ success: false, error: 'roomCode is required' }, { status: 400 });
    }

    const session = db.getSessionByRoomCode(roomCode);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    // 1. PARTICIPANT JOIN
    if (action === 'JOIN') {
      const result = roomManager.joinRoom(roomCode, participantData);
      return NextResponse.json({ success: true, data: result });
    }

    // 2. PARTICIPANT SUBMIT ANSWER
    if (action === 'SUBMIT_ANSWER') {
      const { participantId, selectedOption } = answerData;
      const result = roomManager.submitAnswer(roomCode, participantId, selectedOption);
      return NextResponse.json({ success: true, data: result });
    }

    // 3. HOST ACTIONS
    const hostActions = ['START', 'NEXT_QUESTION', 'REVEAL_ANSWER', 'SHOW_LEADERBOARD', 'SHOW_PODIUM', 'FINISH', 'PAUSE', 'RESUME', 'SKIP'];
    if (hostActions.includes(action)) {
      const updatedSession = roomManager.updateSessionStatus(roomCode, action);
      return NextResponse.json({ success: true, data: updatedSession });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
