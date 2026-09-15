import { randomUUID } from 'crypto';
import { db } from './db';
import { calculateQuestionScore } from './scoring';
import { toPublicParticipant, toPublicParticipants, toPublicSession } from './public-session';
import { Participant, ParticipantAnswer, QuizSession, TeamId } from '@/types/quiz';

type SSEListener = (data: { event: string; payload: unknown }) => void;

interface RoomState {
  listeners: Map<string, SSEListener>;
}

const globalRooms = new Map<string, RoomState>();

function getRoomState(roomCode: string): RoomState {
  const code = roomCode.toUpperCase();
  if (!globalRooms.has(code)) {
    globalRooms.set(code, { listeners: new Map() });
  }
  return globalRooms.get(code)!;
}

function recalculateParticipantMetrics(session: QuizSession, participant: Participant): Participant {
  const answers = db
    .getAnswers(session.session_id, participant.id)
    .slice()
    .sort((a, b) => a.question_index - b.question_index || a.submitted_at - b.submitted_at);

  participant.total_score = answers.reduce((sum, answer) => sum + answer.score, 0);
  participant.total_correct = answers.filter(answer => answer.is_correct).length;
  participant.total_timeout = answers.filter(answer => answer.is_timeout === true).length;
  participant.total_wrong = answers.filter(answer => !answer.is_correct && answer.is_timeout !== true).length;
  participant.total_response_time_ms = answers.reduce((sum, answer) => sum + answer.response_time_ms, 0);
  participant.fastest_response_ms = answers.length > 0
    ? Math.min(...answers.map(answer => answer.response_time_ms))
    : 0;

  let streak = 0;
  let maxStreak = 0;
  for (const answer of answers) {
    streak = answer.is_correct ? streak + 1 : 0;
    maxStreak = Math.max(maxStreak, streak);
  }
  participant.streak = streak;
  participant.max_streak = maxStreak;
  participant.last_active = Date.now();

  return participant;
}

function assertState(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export const roomManager = {
  subscribe: (roomCode: string, clientId: string, listener: SSEListener): (() => void) => {
    const state = getRoomState(roomCode);
    state.listeners.set(clientId, listener);
    return () => {
      state.listeners.delete(clientId);
    };
  },

  broadcast: (roomCode: string, event: string, payload: unknown) => {
    const state = getRoomState(roomCode);
    state.listeners.forEach(listener => {
      try {
        listener({ event, payload });
      } catch (error) {
        console.error('Error broadcasting to client:', error);
      }
    });
  },

  joinRoom: (
    roomCode: string,
    data: { name: string; company: string; unit_kerja: string; email?: string }
  ): { participant: Participant; session: QuizSession } => {
    const session = db.getSessionByRoomCode(roomCode);
    if (!session) throw new Error('Room tidak ditemukan atau kode sesi salah.');
    if (session.status === 'FINISHED' || session.status === 'PODIUM') {
      throw new Error('Sesi quiz sudah selesai.');
    }

    const participants = db.getParticipants(session.session_id);
    const existing = participants.find(participant =>
      participant.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
      participant.company.trim().toLowerCase() === data.company.trim().toLowerCase()
    );

    if (existing) {
      existing.is_connected = true;
      existing.last_active = Date.now();
      db.saveParticipant(existing);
      roomManager.broadcast(roomCode, 'PARTICIPANT_JOINED', {
        participants: toPublicParticipants(db.getParticipants(session.session_id)),
        newParticipant: toPublicParticipant(existing),
      });
      return { participant: existing, session };
    }

    let team: TeamId | undefined;
    if (session.mode === 'TEAM_BATTLE') {
      const teams: TeamId[] = ['TEAM_ALPHA', 'TEAM_BRAVO', 'TEAM_CHARLIE', 'TEAM_DELTA'];
      team = teams[participants.length % teams.length];
    }

    const newParticipant: Participant = {
      id: `p-${randomUUID()}`,
      session_id: session.session_id,
      name: data.name.trim().slice(0, 100),
      company: data.company.trim().slice(0, 150),
      unit_kerja: data.unit_kerja.trim().slice(0, 150),
      email: data.email?.trim().slice(0, 254),
      team,
      avatar_seed: (participants.length + 1).toString(),
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

    db.saveParticipant(newParticipant);
    roomManager.broadcast(roomCode, 'PARTICIPANT_JOINED', {
      participants: toPublicParticipants(db.getParticipants(session.session_id)),
      newParticipant: toPublicParticipant(newParticipant),
    });

    return { participant: newParticipant, session };
  },

  submitAnswer: (
    roomCode: string,
    participantId: string,
    selectedOption: 'A' | 'B' | 'C' | 'D'
  ): { answer: ParticipantAnswer; participant: Participant } => {
    const session = db.getSessionByRoomCode(roomCode);
    if (!session) throw new Error('Sesi tidak ditemukan.');
    if (session.status !== 'QUESTION_ACTIVE') throw new Error('Pertanyaan sedang tidak aktif.');

    const participant = db.getParticipantById(participantId);
    if (!participant || participant.session_id !== session.session_id) {
      throw new Error('Peserta tidak valid untuk sesi ini.');
    }

    const currentQuestion = session.questions[session.current_question_index];
    if (!currentQuestion) throw new Error('Pertanyaan tidak valid.');

    const now = Date.now();
    const timeLimitMs = (session.settings.time_per_question || currentQuestion.default_time_limit || 20) * 1000;
    const responseTimeMs = Math.max(100, now - session.question_started_at);
    const isTimeout = responseTimeMs > timeLimitMs + 1500;

    const existingAnswer = db
      .getAnswers(session.session_id, participantId)
      .find(answer => answer.question_id === currentQuestion.question_id);

    if (existingAnswer && !session.settings.allow_answer_change) {
      throw new Error('Jawaban sudah terkunci.');
    }

    const previousAnswers = db
      .getAnswers(session.session_id, participantId)
      .filter(answer => answer.question_index < session.current_question_index)
      .sort((a, b) => a.question_index - b.question_index);

    let previousStreak = 0;
    for (const answer of previousAnswers) {
      previousStreak = answer.is_correct ? previousStreak + 1 : 0;
    }

    const isCorrect = !isTimeout && selectedOption === currentQuestion.correct_answer;
    const currentStreak = isCorrect ? previousStreak + 1 : 0;
    const scoreResult = calculateQuestionScore(
      isCorrect,
      responseTimeMs,
      timeLimitMs / 1000,
      currentStreak,
      session.settings
    );

    const answer: ParticipantAnswer = {
      id: existingAnswer?.id || `ans-${randomUUID()}`,
      session_id: session.session_id,
      participant_id: participantId,
      question_id: currentQuestion.question_id,
      question_index: session.current_question_index,
      selected_option: selectedOption,
      is_correct: isCorrect,
      is_timeout: isTimeout,
      response_time_ms: responseTimeMs,
      score: scoreResult.total_score,
      speed_bonus: scoreResult.speed_bonus,
      streak_bonus: scoreResult.streak_bonus,
      submitted_at: now,
    };

    db.saveAnswer(answer);
    recalculateParticipantMetrics(session, participant);
    db.saveParticipant(participant);

    const answersForCurrentQuestion = db
      .getAnswers(session.session_id)
      .filter(item => item.question_id === currentQuestion.question_id);
    const totalParticipants = db.getParticipants(session.session_id).length;

    roomManager.broadcast(roomCode, 'ANSWER_SUBMITTED', {
      answeredCount: answersForCurrentQuestion.length,
      totalParticipants,
    });

    return { answer, participant };
  },

  updateSessionStatus: (
    roomCode: string,
    action: 'START' | 'NEXT_QUESTION' | 'REVEAL_ANSWER' | 'SHOW_LEADERBOARD' | 'SHOW_PODIUM' | 'FINISH' | 'PAUSE' | 'RESUME' | 'SKIP'
  ): QuizSession => {
    const session = db.getSessionByRoomCode(roomCode);
    if (!session) throw new Error('Sesi tidak ditemukan.');

    const now = Date.now();

    switch (action) {
      case 'START': {
        assertState(session.status === 'WAITING', 'Quiz hanya dapat dimulai dari waiting room.');
        session.status = 'QUESTION_ACTIVE';
        session.current_question_index = 0;
        const timeLimit = session.settings.time_per_question || session.questions[0]?.default_time_limit || 20;
        session.question_started_at = now;
        session.question_ends_at = now + timeLimit * 1000;
        break;
      }

      case 'NEXT_QUESTION': {
        assertState(
          session.status === 'ANSWER_REVEAL' || session.status === 'LEADERBOARD',
          'Soal berikutnya hanya dapat dibuka setelah reveal atau leaderboard.'
        );
        if (session.current_question_index + 1 < session.questions.length) {
          session.current_question_index += 1;
          session.status = 'QUESTION_ACTIVE';
          const question = session.questions[session.current_question_index];
          const timeLimit = session.settings.time_per_question || question?.default_time_limit || 20;
          session.question_started_at = now;
          session.question_ends_at = now + timeLimit * 1000;
        } else {
          session.status = 'PODIUM';
        }
        break;
      }

      case 'REVEAL_ANSWER': {
        assertState(
          session.status === 'QUESTION_ACTIVE' || session.status === 'PAUSED',
          'Jawaban hanya dapat direveal saat soal aktif atau paused.'
        );
        session.status = 'ANSWER_REVEAL';
        roomManager.recalculateRankings(session.session_id);
        break;
      }

      case 'SHOW_LEADERBOARD': {
        assertState(
          session.status === 'ANSWER_REVEAL' || session.status === 'LEADERBOARD',
          'Leaderboard hanya dapat ditampilkan setelah reveal jawaban.'
        );
        session.status = 'LEADERBOARD';
        roomManager.recalculateRankings(session.session_id);
        break;
      }

      case 'SHOW_PODIUM': {
        session.status = 'PODIUM';
        roomManager.recalculateRankings(session.session_id);
        break;
      }

      case 'FINISH': {
        session.status = 'FINISHED';
        roomManager.recalculateRankings(session.session_id);
        break;
      }

      case 'PAUSE': {
        assertState(session.status === 'QUESTION_ACTIVE', 'Hanya soal aktif yang dapat dipause.');
        session.status = 'PAUSED';
        break;
      }

      case 'RESUME': {
        assertState(session.status === 'PAUSED', 'Sesi hanya dapat dilanjutkan dari status paused.');
        session.status = 'QUESTION_ACTIVE';
        const question = session.questions[session.current_question_index];
        const timeLimit = session.settings.time_per_question || question?.default_time_limit || 20;
        session.question_started_at = now;
        session.question_ends_at = now + timeLimit * 1000;
        break;
      }

      case 'SKIP': {
        assertState(
          session.status === 'QUESTION_ACTIVE' || session.status === 'PAUSED',
          'Skip hanya dapat dilakukan pada soal aktif atau paused.'
        );
        if (session.current_question_index + 1 < session.questions.length) {
          session.current_question_index += 1;
          session.status = 'QUESTION_ACTIVE';
          const question = session.questions[session.current_question_index];
          const timeLimit = session.settings.time_per_question || question?.default_time_limit || 20;
          session.question_started_at = now;
          session.question_ends_at = now + timeLimit * 1000;
        } else {
          session.status = 'PODIUM';
        }
        break;
      }
    }

    db.saveSession(session);

    const currentQuestion = session.questions[session.current_question_index];
    const distribution = currentQuestion
      ? roomManager.getAnswerDistribution(session.session_id, currentQuestion.question_id)
      : null;
    const participants = db.getParticipants(session.session_id);

    roomManager.broadcast(roomCode, 'STATE_CHANGE', {
      session: toPublicSession(session),
      action,
      distribution,
      participants: toPublicParticipants(participants),
    });

    return session;
  },

  recalculateRankings: (sessionId: string) => {
    const participants = db.getParticipants(sessionId);
    participants.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      if (b.total_correct !== a.total_correct) return b.total_correct - a.total_correct;
      const avgA = a.total_correct > 0 ? a.total_response_time_ms / a.total_correct : Number.MAX_SAFE_INTEGER;
      const avgB = b.total_correct > 0 ? b.total_response_time_ms / b.total_correct : Number.MAX_SAFE_INTEGER;
      return avgA - avgB;
    });

    participants.forEach((participant, index) => {
      participant.previous_rank = participant.rank || index + 1;
      participant.rank = index + 1;
      db.saveParticipant(participant);
    });
  },

  getAnswerDistribution: (sessionId: string, questionId: string) => {
    const answers = db.getAnswers(sessionId).filter(answer => answer.question_id === questionId);
    const distribution = { A: 0, B: 0, C: 0, D: 0, timeout: 0, total: answers.length };

    answers.forEach(answer => {
      if (answer.is_timeout) {
        distribution.timeout += 1;
      } else if (answer.selected_option && distribution[answer.selected_option] !== undefined) {
        distribution[answer.selected_option] += 1;
      }
    });

    return distribution;
  },
};
