import { db } from './db';
import { calculateQuestionScore } from './scoring';
import { QuizSession, Participant, ParticipantAnswer, SessionStatus, TeamId } from '@/types/quiz';

type SSEListener = (data: { event: string; payload: unknown }) => void;

interface RoomState {
  listeners: Map<string, SSEListener>;
}

// Global active room listener registry across server requests
const globalRooms = new Map<string, RoomState>();

function getRoomState(roomCode: string): RoomState {
  const code = roomCode.toUpperCase();
  if (!globalRooms.has(code)) {
    globalRooms.set(code, { listeners: new Map() });
  }
  return globalRooms.get(code)!;
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
    state.listeners.forEach((listener) => {
      try {
        listener({ event, payload });
      } catch (err) {
        console.error('Error broadcasting to client:', err);
      }
    });
  },

  joinRoom: (
    roomCode: string,
    data: { name: string; company: string; unit_kerja: string; email?: string }
  ): { participant: Participant; session: QuizSession } => {
    const session = db.getSessionByRoomCode(roomCode);
    if (!session) {
      throw new Error('Room tidak ditemukan atau kode sesi salah');
    }

    const participants = db.getParticipants(session.session_id);
    const existing = participants.find(
      p => p.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
           p.company.trim().toLowerCase() === data.company.trim().toLowerCase()
    );

    if (existing) {
      existing.is_connected = true;
      existing.last_active = Date.now();
      db.saveParticipant(existing);
      roomManager.broadcast(roomCode, 'PARTICIPANT_JOINED', {
        participants: db.getParticipants(session.session_id),
        newParticipant: existing,
      });
      return { participant: existing, session };
    }

    // Assign team if TEAM_BATTLE
    let team: TeamId | undefined = undefined;
    if (session.mode === 'TEAM_BATTLE') {
      const teams: TeamId[] = ['TEAM_ALPHA', 'TEAM_BRAVO', 'TEAM_CHARLIE', 'TEAM_DELTA'];
      team = teams[participants.length % teams.length];
    }

    const newParticipant: Participant = {
      id: 'p-' + Math.random().toString(36).substring(2, 9),
      session_id: session.session_id,
      name: data.name.trim(),
      company: data.company.trim(),
      unit_kerja: data.unit_kerja.trim(),
      email: data.email?.trim(),
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
    const updatedParticipants = db.getParticipants(session.session_id);

    roomManager.broadcast(roomCode, 'PARTICIPANT_JOINED', {
      participants: updatedParticipants,
      newParticipant,
    });

    return { participant: newParticipant, session };
  },

  submitAnswer: (
    roomCode: string,
    participantId: string,
    selectedOption: 'A' | 'B' | 'C' | 'D'
  ): { answer: ParticipantAnswer; participant: Participant } => {
    const session = db.getSessionByRoomCode(roomCode);
    if (!session) throw new Error('Sesi tidak ditemukan');
    if (session.status !== 'QUESTION_ACTIVE') throw new Error('Pertanyaan sedang tidak aktif');

    const participant = db.getParticipantById(participantId);
    if (!participant) throw new Error('Peserta tidak ditemukan');

    const currentQuestion = session.questions[session.current_question_index];
    if (!currentQuestion) throw new Error('Pertanyaan tidak valid');

    // Server-side timing verification
    const now = Date.now();
    const timeLimitMs = (session.settings.time_per_question || currentQuestion.default_time_limit || 20) * 1000;
    const responseTimeMs = Math.max(100, now - session.question_started_at);
    const isTimeout = responseTimeMs > timeLimitMs + 1500; // 1.5s grace for network latency

    const existingAnswer = db.getAnswers(session.session_id, participantId)
      .find(a => a.question_id === currentQuestion.question_id);

    if (existingAnswer && !session.settings.allow_answer_change) {
      throw new Error('Jawaban sudah terkunci');
    }

    const isCorrect = !isTimeout && selectedOption === currentQuestion.correct_answer;
    const currentStreak = isCorrect ? (participant.streak + 1) : 0;

    const scoreResult = calculateQuestionScore(
      isCorrect,
      responseTimeMs,
      timeLimitMs / 1000,
      currentStreak,
      session.settings
    );

    const answer: ParticipantAnswer = {
      id: 'ans-' + Math.random().toString(36).substring(2, 9),
      session_id: session.session_id,
      participant_id: participantId,
      question_id: currentQuestion.question_id,
      question_index: session.current_question_index,
      selected_option: selectedOption,
      is_correct: isCorrect,
      response_time_ms: responseTimeMs,
      score: scoreResult.total_score,
      speed_bonus: scoreResult.speed_bonus,
      streak_bonus: scoreResult.streak_bonus,
      submitted_at: now,
    };

    db.saveAnswer(answer);

    // Update participant totals
    participant.total_score += scoreResult.total_score;
    participant.streak = currentStreak;
    if (currentStreak > participant.max_streak) {
      participant.max_streak = currentStreak;
    }
    if (isCorrect) {
      participant.total_correct += 1;
    } else if (isTimeout) {
      participant.total_timeout += 1;
    } else {
      participant.total_wrong += 1;
    }
    participant.total_response_time_ms += responseTimeMs;
    if (participant.fastest_response_ms === 0 || responseTimeMs < participant.fastest_response_ms) {
      participant.fastest_response_ms = responseTimeMs;
    }
    participant.last_active = now;
    db.saveParticipant(participant);

    // Broadcast answer received event (count only, don't reveal option)
    const allAnswersForCurrentQ = db.getAnswers(session.session_id)
      .filter(a => a.question_id === currentQuestion.question_id);
    const totalParticipants = db.getParticipants(session.session_id).length;

    roomManager.broadcast(roomCode, 'ANSWER_SUBMITTED', {
      answeredCount: allAnswersForCurrentQ.length,
      totalParticipants,
      participantId,
    });

    return { answer, participant };
  },

  updateSessionStatus: (
    roomCode: string,
    action: 'START' | 'NEXT_QUESTION' | 'REVEAL_ANSWER' | 'SHOW_LEADERBOARD' | 'SHOW_PODIUM' | 'FINISH' | 'PAUSE' | 'RESUME' | 'SKIP'
  ): QuizSession => {
    const session = db.getSessionByRoomCode(roomCode);
    if (!session) throw new Error('Sesi tidak ditemukan');

    const now = Date.now();

    switch (action) {
      case 'START': {
        session.status = 'QUESTION_ACTIVE';
        session.current_question_index = 0;
        const timeLimit = session.settings.time_per_question || session.questions[0]?.default_time_limit || 20;
        session.question_started_at = now;
        session.question_ends_at = now + timeLimit * 1000;
        break;
      }

      case 'NEXT_QUESTION': {
        if (session.current_question_index + 1 < session.questions.length) {
          session.current_question_index += 1;
          session.status = 'QUESTION_ACTIVE';
          const q = session.questions[session.current_question_index];
          const timeLimit = session.settings.time_per_question || q?.default_time_limit || 20;
          session.question_started_at = now;
          session.question_ends_at = now + timeLimit * 1000;
        } else {
          session.status = 'PODIUM';
        }
        break;
      }

      case 'REVEAL_ANSWER': {
        session.status = 'ANSWER_REVEAL';
        // Recalculate rankings after question ends
        roomManager.recalculateRankings(session.session_id);
        break;
      }

      case 'SHOW_LEADERBOARD': {
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
        session.status = 'PAUSED';
        break;
      }

      case 'RESUME': {
        session.status = 'QUESTION_ACTIVE';
        break;
      }

      case 'SKIP': {
        if (session.current_question_index + 1 < session.questions.length) {
          session.current_question_index += 1;
          session.status = 'QUESTION_ACTIVE';
          const q = session.questions[session.current_question_index];
          const timeLimit = session.settings.time_per_question || q?.default_time_limit || 20;
          session.question_started_at = now;
          session.question_ends_at = now + timeLimit * 1000;
        } else {
          session.status = 'PODIUM';
        }
        break;
      }
    }

    db.saveSession(session);

    // Calculate answer distribution if in reveal or leaderboard state
    const currentQ = session.questions[session.current_question_index];
    const distribution = currentQ ? roomManager.getAnswerDistribution(session.session_id, currentQ.question_id) : null;
    const participants = db.getParticipants(session.session_id);

    roomManager.broadcast(roomCode, 'STATE_CHANGE', {
      session,
      action,
      distribution,
      participants,
    });

    return session;
  },

  recalculateRankings: (sessionId: string) => {
    const participants = db.getParticipants(sessionId);
    // Sort: Total score DESC -> Total correct DESC -> Avg response time ASC
    participants.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      if (b.total_correct !== a.total_correct) return b.total_correct - a.total_correct;
      const avgA = a.total_correct > 0 ? a.total_response_time_ms / a.total_correct : 999999;
      const avgB = b.total_correct > 0 ? b.total_response_time_ms / b.total_correct : 999999;
      return avgA - avgB;
    });

    participants.forEach((p, idx) => {
      p.previous_rank = p.rank || (idx + 1);
      p.rank = idx + 1;
      db.saveParticipant(p);
    });
  },

  getAnswerDistribution: (sessionId: string, questionId: string) => {
    const answers = db.getAnswers(sessionId).filter(a => a.question_id === questionId);
    const dist = { A: 0, B: 0, C: 0, D: 0, timeout: 0, total: answers.length };
    answers.forEach(a => {
      if (a.selected_option && dist[a.selected_option] !== undefined) {
        dist[a.selected_option]++;
      } else {
        dist.timeout++;
      }
    });
    return dist;
  }
};
