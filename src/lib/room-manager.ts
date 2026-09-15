import { db } from './db';
import { calculateQuestionScore } from './scoring';
import { QuizSession, Participant, ParticipantAnswer, TeamId } from '@/types/quiz';

type SSEListener = (data: { event: string; payload: unknown }) => void;
type RoomState = { listeners: Map<string, SSEListener> };
const globalRooms = new Map<string, RoomState>();

function getRoomState(roomCode: string): RoomState {
  const code = roomCode.toUpperCase();
  if (!globalRooms.has(code)) globalRooms.set(code, { listeners: new Map() });
  return globalRooms.get(code)!;
}

export const roomManager = {
  subscribe(roomCode: string, clientId: string, listener: SSEListener): () => void {
    const state = getRoomState(roomCode);
    state.listeners.set(clientId, listener);
    return () => state.listeners.delete(clientId);
  },

  broadcast(roomCode: string, event: string, payload: unknown): void {
    getRoomState(roomCode).listeners.forEach(listener => {
      try { listener({ event, payload }); } catch (e) { console.error(e); }
    });
  },

  async joinRoom(roomCode: string, data: { name: string; company: string; unit_kerja: string; email?: string }): Promise<{ participant: Participant; session: QuizSession }> {
    const session = await db.getSessionByRoomCode(roomCode);
    if (!session) throw new Error('Room tidak ditemukan atau kode sesi salah');
    const participants = await db.getParticipants(session.session_id);
    const existing = participants.find(p =>
      p.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
      p.company.trim().toLowerCase() === data.company.trim().toLowerCase()
    );

    if (existing) {
      existing.is_connected = true;
      existing.last_active = Date.now();
      await db.saveParticipant(existing);
      roomManager.broadcast(roomCode, 'PARTICIPANT_JOINED', { participants: await db.getParticipants(session.session_id), newParticipant: existing });
      return { participant: existing, session };
    }

    let team: TeamId | undefined;
    if (session.mode === 'TEAM_BATTLE') {
      const teams: TeamId[] = ['TEAM_ALPHA', 'TEAM_BRAVO', 'TEAM_CHARLIE', 'TEAM_DELTA'];
      team = teams[participants.length % teams.length];
    }

    const participant: Participant = {
      id: 'p-' + Math.random().toString(36).slice(2, 11),
      session_id: session.session_id,
      name: data.name.trim(),
      company: data.company.trim(),
      unit_kerja: data.unit_kerja.trim(),
      email: data.email?.trim(),
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
    roomManager.broadcast(roomCode, 'PARTICIPANT_JOINED', { participants: await db.getParticipants(session.session_id), newParticipant: participant });
    return { participant, session };
  },

  async submitAnswer(roomCode: string, participantId: string, selectedOption: 'A' | 'B' | 'C' | 'D'): Promise<{ answer: ParticipantAnswer; participant: Participant }> {
    const session = await db.getSessionByRoomCode(roomCode);
    if (!session || session.status !== 'QUESTION_ACTIVE') throw new Error('Pertanyaan sedang tidak aktif');
    const participant = await db.getParticipantById(participantId);
    if (!participant || participant.session_id !== session.session_id) throw new Error('Peserta tidak ditemukan');
    const question = session.questions[session.current_question_index];
    if (!question) throw new Error('Pertanyaan tidak valid');

    const now = Date.now();
    const limitMs = (session.settings.time_per_question || question.default_time_limit || 20) * 1000;
    const responseMs = Math.max(100, now - session.question_started_at);
    const timeout = responseMs > limitMs + 1500;
    const old = (await db.getAnswers(session.session_id, participantId)).find(a => a.question_id === question.question_id);
    if (old && !session.settings.allow_answer_change) throw new Error('Jawaban sudah terkunci');

    const correct = !timeout && selectedOption === question.correct_answer;
    const streak = correct ? participant.streak + 1 : 0;
    const score = calculateQuestionScore(correct, responseMs, limitMs / 1000, streak, session.settings);
    const answer: ParticipantAnswer = {
      id: old?.id || 'ans-' + Math.random().toString(36).slice(2, 11),
      session_id: session.session_id,
      participant_id: participantId,
      question_id: question.question_id,
      question_index: session.current_question_index,
      selected_option: selectedOption,
      is_correct: correct,
      response_time_ms: responseMs,
      score: score.total_score,
      speed_bonus: score.speed_bonus,
      streak_bonus: score.streak_bonus,
      submitted_at: now,
    };
    await db.saveAnswer(answer);

    if (old && session.settings.allow_answer_change) {
      const answers = await db.getAnswers(session.session_id, participantId);
      participant.total_score = answers.reduce((s, a) => s + a.score, 0);
      participant.total_correct = answers.filter(a => a.is_correct).length;
      participant.total_wrong = answers.filter(a => !a.is_correct && a.selected_option !== null).length;
      participant.total_timeout = answers.filter(a => a.selected_option === null).length;
      participant.total_response_time_ms = answers.reduce((s, a) => s + a.response_time_ms, 0);
      participant.fastest_response_ms = answers.length ? Math.min(...answers.map(a => a.response_time_ms)) : 0;
    } else {
      participant.total_score += score.total_score;
      if (correct) participant.total_correct += 1;
      else if (timeout) participant.total_timeout += 1;
      else participant.total_wrong += 1;
      participant.total_response_time_ms += responseMs;
      if (!participant.fastest_response_ms || responseMs < participant.fastest_response_ms) participant.fastest_response_ms = responseMs;
    }
    participant.streak = streak;
    participant.max_streak = Math.max(participant.max_streak, streak);
    participant.last_active = now;
    await db.saveParticipant(participant);

    const currentAnswers = (await db.getAnswers(session.session_id)).filter(a => a.question_id === question.question_id);
    roomManager.broadcast(roomCode, 'ANSWER_SUBMITTED', { answeredCount: currentAnswers.length, totalParticipants: (await db.getParticipants(session.session_id)).length, participantId });
    return { answer, participant };
  },

  async updateSessionStatus(roomCode: string, action: 'START' | 'NEXT_QUESTION' | 'REVEAL_ANSWER' | 'SHOW_LEADERBOARD' | 'SHOW_PODIUM' | 'FINISH' | 'PAUSE' | 'RESUME' | 'SKIP'): Promise<QuizSession> {
    const session = await db.getSessionByRoomCode(roomCode);
    if (!session) throw new Error('Sesi tidak ditemukan');
    const now = Date.now();

    if (action === 'START') {
      session.status = 'QUESTION_ACTIVE';
      session.current_question_index = 0;
      session.question_started_at = now;
      session.question_ends_at = now + (session.settings.time_per_question || session.questions[0]?.default_time_limit || 20) * 1000;
    } else if (action === 'NEXT_QUESTION' || action === 'SKIP') {
      if (session.current_question_index + 1 < session.questions.length) {
        session.current_question_index += 1;
        session.status = 'QUESTION_ACTIVE';
        const q = session.questions[session.current_question_index];
        session.question_started_at = now;
        session.question_ends_at = now + (session.settings.time_per_question || q?.default_time_limit || 20) * 1000;
      } else session.status = 'PODIUM';
    } else if (action === 'REVEAL_ANSWER') {
      session.status = 'ANSWER_REVEAL';
      await roomManager.recalculateRankings(session.session_id);
    } else if (action === 'SHOW_LEADERBOARD') {
      session.status = 'LEADERBOARD';
      await roomManager.recalculateRankings(session.session_id);
    } else if (action === 'SHOW_PODIUM') {
      session.status = 'PODIUM';
      await roomManager.recalculateRankings(session.session_id);
    } else if (action === 'FINISH') {
      session.status = 'FINISHED';
      await roomManager.recalculateRankings(session.session_id);
    } else if (action === 'PAUSE') session.status = 'PAUSED';
    else if (action === 'RESUME') {
      session.status = 'QUESTION_ACTIVE';
      session.question_started_at = now;
      session.question_ends_at = now + (session.settings.time_per_question || 20) * 1000;
    }

    const saved = await db.saveSession(session);
    const q = saved.questions[saved.current_question_index];
    const distribution = q ? await roomManager.getAnswerDistribution(saved.session_id, q.question_id) : null;
    const participants = await db.getParticipants(saved.session_id);
    roomManager.broadcast(roomCode, 'STATE_CHANGE', { session: saved, action, distribution, participants });
    return saved;
  },

  async recalculateRankings(sessionId: string): Promise<void> {
    const participants = await db.getParticipants(sessionId);
    participants.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      if (b.total_correct !== a.total_correct) return b.total_correct - a.total_correct;
      const aAvg = a.total_correct ? a.total_response_time_ms / a.total_correct : 999999;
      const bAvg = b.total_correct ? b.total_response_time_ms / b.total_correct : 999999;
      return aAvg - bAvg;
    });
    for (let i = 0; i < participants.length; i += 1) {
      participants[i].previous_rank = participants[i].rank || i + 1;
      participants[i].rank = i + 1;
      await db.saveParticipant(participants[i]);
    }
  },

  async getAnswerDistribution(sessionId: string, questionId: string) {
    const answers = (await db.getAnswers(sessionId)).filter(a => a.question_id === questionId);
    const dist = { A: 0, B: 0, C: 0, D: 0, timeout: 0, total: answers.length };
    for (const answer of answers) {
      if (answer.selected_option) dist[answer.selected_option] += 1;
      else dist.timeout += 1;
    }
    return dist;
  },
};
