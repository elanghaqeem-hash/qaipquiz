import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { toPublicParticipantsForSession, toPublicSession } from '@/lib/public-session';
import { roomManager } from '@/lib/room-manager';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('roomCode')?.trim().toUpperCase();
  const rawClientId = searchParams.get('clientId') || `client-${Math.random().toString(36).substring(2, 9)}`;
  const clientId = rawClientId.slice(0, 120);

  if (!roomCode) {
    return new Response('Room code parameter required', { status: 400 });
  }

  const session = db.getSessionByRoomCode(roomCode);
  if (!session) {
    return new Response('Sesi quiz tidak ditemukan', { status: 404 });
  }

  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    start(controller) {
      const participants = db.getParticipants(session.session_id);
      const answers = db.getAnswers(session.session_id);
      const initialPayload = {
        event: 'INIT_STATE',
        payload: {
          session: toPublicSession(session),
          participants: toPublicParticipantsForSession(participants, session, answers),
          serverTime: Date.now(),
        },
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`));

      const unsubscribe = roomManager.subscribe(roomCode, clientId, data => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          unsubscribe();
        }
      });

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
          unsubscribe();
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
      });
    },
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
