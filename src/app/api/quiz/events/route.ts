import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/authorize';
import { sessionForClient } from '@/lib/public-session';
import { roomManager } from '@/lib/room-manager';
import { QuizSession } from '@/types/quiz';

export const dynamic = 'force-dynamic';

function inferAction(previous: QuizSession, current: QuizSession): string {
  if (previous.status !== current.status) {
    if (current.status === 'QUESTION_ACTIVE' && previous.status === 'WAITING') return 'START';
    if (current.status === 'ANSWER_REVEAL') return 'REVEAL_ANSWER';
    if (current.status === 'LEADERBOARD') return 'SHOW_LEADERBOARD';
    if (current.status === 'PODIUM') return 'SHOW_PODIUM';
    if (current.status === 'FINISHED') return 'FINISH';
    if (current.status === 'PAUSED') return 'PAUSE';
    if (current.status === 'QUESTION_ACTIVE' && previous.status === 'PAUSED') return 'RESUME';
  }
  if (previous.current_question_index !== current.current_question_index) return 'NEXT_QUESTION';
  return 'SYNC';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('roomCode');
  const clientId = searchParams.get('clientId') || ('client-' + Math.random().toString(36).slice(2, 9));
  if (!roomCode) return new Response('Room code parameter required', { status: 400 });

  const session = await db.getSessionByRoomCode(roomCode);
  if (!session) return new Response('Sesi quiz tidak ditemukan', { status: 404 });

  const user = await getAuthenticatedUser(req);
  const privileged = Boolean(user && ['SUPER_ADMIN', 'TRAINER'].includes(user.role));
  const participants = await db.getParticipants(session.session_id);
  const answers = await db.getAnswers(session.session_id);
  const encoder = new TextEncoder();

  let lastSession = session;
  let lastParticipantIds = new Set(participants.map(p => p.id));
  let lastParticipantSignature = JSON.stringify(participants.map(p => [p.id, p.total_score, p.rank, p.last_active]));
  let currentQuestion = session.questions[session.current_question_index];
  let lastAnswerCount = currentQuestion ? answers.filter(a => a.question_id === currentQuestion.question_id).length : 0;
  let closed = false;
  let polling = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribe = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: any) => {
        if (closed) return;
        try {
          const safePayload = payload?.session
            ? { ...payload, session: sessionForClient(payload.session, privileged) }
            : payload;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, payload: safePayload })}\n\n`));
        } catch {
          closed = true;
        }
      };

      send('INIT_STATE', { session, participants, serverTime: Date.now() });
      unsubscribe = roomManager.subscribe(roomCode, clientId, data => send(data.event, data.payload));

      pollTimer = setInterval(async () => {
        if (closed || polling) return;
        polling = true;
        try {
          const freshSession = await db.getSessionByRoomCode(roomCode);
          if (!freshSession) return;
          const freshParticipants = await db.getParticipants(freshSession.session_id);
          const freshAnswers = await db.getAnswers(freshSession.session_id);
          const action = inferAction(lastSession, freshSession);
          const participantSignature = JSON.stringify(freshParticipants.map(p => [p.id, p.total_score, p.rank, p.last_active]));
          const sessionSignature = (value: QuizSession) => JSON.stringify([
            value.status,
            value.current_question_index,
            value.question_started_at,
            value.question_ends_at,
            value.updated_at,
          ]);

          const newParticipant = freshParticipants.find(p => !lastParticipantIds.has(p.id));
          if (newParticipant) send('PARTICIPANT_JOINED', { participants: freshParticipants, newParticipant });

          if (sessionSignature(lastSession) !== sessionSignature(freshSession) || participantSignature !== lastParticipantSignature) {
            const q = freshSession.questions[freshSession.current_question_index];
            const distribution = q ? await roomManager.getAnswerDistribution(freshSession.session_id, q.question_id) : null;
            send('STATE_CHANGE', { session: freshSession, action, participants: freshParticipants, distribution });
          }

          currentQuestion = freshSession.questions[freshSession.current_question_index];
          const answerCount = currentQuestion
            ? freshAnswers.filter(a => a.question_id === currentQuestion!.question_id).length
            : 0;
          if (answerCount !== lastAnswerCount) {
            send('ANSWER_SUBMITTED', { answeredCount: answerCount, totalParticipants: freshParticipants.length });
          }

          lastSession = freshSession;
          lastParticipantIds = new Set(freshParticipants.map(p => p.id));
          lastParticipantSignature = participantSignature;
          lastAnswerCount = answerCount;
        } catch (error) {
          console.error('SSE sync error:', error);
        } finally {
          polling = false;
        }
      }, 1000);

      heartbeatTimer = setInterval(() => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { closed = true; }
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        unsubscribe();
      });
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
