import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/authorize';
import { verifyParticipantToken } from '@/lib/participant-auth';
import { participantsForClient, sessionForClient } from '@/lib/public-session';
import { roomManager } from '@/lib/room-manager';
import { Participant, QuizSession } from '@/types/quiz';

export const dynamic = 'force-dynamic';

const FEEDBACK_STATES = new Set(['ANSWER_REVEAL', 'LEADERBOARD', 'PODIUM', 'FINISHED']);

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

function participantSignature(participants: Participant[], status: string): string {
  // While a question is active, never use live score/rank changes as a reason
  // to broadcast participant objects. Otherwise clients could infer correctness
  // before the trainer reveals the answer.
  if (status === 'QUESTION_ACTIVE') {
    return JSON.stringify(participants.map(p => [p.id, p.is_connected]));
  }
  return JSON.stringify(participants.map(p => [p.id, p.total_score, p.rank, p.last_active, p.is_connected]));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('roomCode')?.trim().toUpperCase();
  const clientId = searchParams.get('clientId')?.trim() || ('client-' + crypto.randomUUID());
  if (!roomCode) return new Response('Room code parameter required', { status: 400 });

  const session = await db.getSessionByRoomCode(roomCode);
  if (!session) return new Response('Sesi quiz tidak ditemukan', { status: 404 });

  const user = await getAuthenticatedUser(req);
  const privileged = Boolean(user && ['SUPER_ADMIN', 'TRAINER'].includes(user.role));

  if (!privileged) {
    const token = req.cookies.get('tqa_participant_token')?.value;
    const participantAuth = token
      ? await verifyParticipantToken(token, { participantId: clientId, sessionId: session.session_id, roomCode })
      : null;
    if (!participantAuth) {
      return new Response('Participant session is invalid or expired. Please rejoin the quiz.', { status: 401 });
    }
  }

  const participants = await db.getParticipants(session.session_id);
  const answers = await db.getAnswers(session.session_id);
  const encoder = new TextEncoder();

  let lastSession = session;
  let lastParticipantIds = new Set(participants.map(p => p.id));
  let lastParticipantSignature = participantSignature(participants, session.status);
  let currentQuestion = session.questions[session.current_question_index];
  let lastAnswerCount = currentQuestion ? answers.filter(a => a.question_id === currentQuestion.question_id).length : 0;
  let closed = false;
  let polling = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribe = () => {};

  const initialMyAnswer = !privileged && currentQuestion && FEEDBACK_STATES.has(session.status)
    ? answers.find(a => a.participant_id === clientId && a.question_id === currentQuestion!.question_id) || null
    : null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: any) => {
        if (closed) return;
        try {
          let safePayload = payload;
          if (payload && typeof payload === 'object') {
            safePayload = { ...payload };
            if (safePayload.session) {
              safePayload.session = sessionForClient(safePayload.session, privileged);
            }
            if (Array.isArray(safePayload.participants)) {
              safePayload.participants = participantsForClient(safePayload.participants, privileged);
            }
            if (safePayload.newParticipant && !privileged) {
              safePayload.newParticipant = participantsForClient([safePayload.newParticipant], false)[0];
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, payload: safePayload })}\n\n`));
        } catch {
          closed = true;
        }
      };

      send('INIT_STATE', {
        session,
        participants,
        myAnswer: initialMyAnswer,
        serverTime: Date.now(),
      });
      unsubscribe = roomManager.subscribe(roomCode, clientId, data => send(data.event, data.payload));

      // Durable Object storage is the cross-isolate source of truth. A moderate
      // polling interval keeps clients synchronized without hammering storage.
      pollTimer = setInterval(async () => {
        if (closed || polling) return;
        polling = true;
        try {
          const freshSession = await db.getSessionByRoomCode(roomCode);
          if (!freshSession) return;
          const freshParticipants = await db.getParticipants(freshSession.session_id);
          const freshAnswers = await db.getAnswers(freshSession.session_id);
          const action = inferAction(lastSession, freshSession);
          const freshParticipantSignature = participantSignature(freshParticipants, freshSession.status);
          const sessionSignature = (value: QuizSession) => JSON.stringify([
            value.status,
            value.current_question_index,
            value.question_started_at,
            value.question_ends_at,
            value.updated_at,
          ]);

          const newParticipant = freshParticipants.find(p => !lastParticipantIds.has(p.id));
          if (newParticipant) send('PARTICIPANT_JOINED', { participants: freshParticipants, newParticipant });

          if (sessionSignature(lastSession) !== sessionSignature(freshSession) || freshParticipantSignature !== lastParticipantSignature) {
            const q = freshSession.questions[freshSession.current_question_index];
            const distribution = q ? await roomManager.getAnswerDistribution(freshSession.session_id, q.question_id) : null;
            const myAnswer = !privileged && q && FEEDBACK_STATES.has(freshSession.status)
              ? freshAnswers.find(a => a.participant_id === clientId && a.question_id === q.question_id) || null
              : null;
            send('STATE_CHANGE', {
              session: freshSession,
              action,
              participants: freshParticipants,
              distribution,
              myAnswer,
            });
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
          lastParticipantSignature = freshParticipantSignature;
          lastAnswerCount = answerCount;
        } catch (error) {
          console.error('SSE sync error:', error);
        } finally {
          polling = false;
        }
      }, 1500);

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
