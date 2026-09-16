import { Participant, QuizSession } from '@/types/quiz';

const REVEAL_STATES = new Set(['ANSWER_REVEAL', 'LEADERBOARD', 'PODIUM', 'FINISHED']);

export function sessionForClient(session: QuizSession, privileged: boolean): any {
  if (privileged) return session;

  const currentIndex = session.current_question_index;
  const revealCurrent = REVEAL_STATES.has(session.status);

  return {
    ...session,
    questions: session.questions.map((question, index) => {
      const isPast = index < currentIndex;
      const isCurrent = index === currentIndex;
      const canRevealAnswer = isPast || (isCurrent && revealCurrent) || session.status === 'FINISHED';

      if (index > currentIndex) {
        return {
          question_id: question.question_id,
          question_code: question.question_code,
          question_number: question.question_number,
          category: question.category,
          difficulty: question.difficulty,
          default_time_limit: question.default_time_limit,
          status: question.status,
          question_text: '',
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
        };
      }

      if (!canRevealAnswer) {
        const {
          correct_answer: _correctAnswer,
          explanation: _explanation,
          learning_point: _learningPoint,
          ...safeQuestion
        } = question;
        return safeQuestion;
      }

      return question;
    }),
  };
}

/**
 * Participant lists are visible to everyone in a live room, so only expose
 * gameplay fields publicly. Contact and organization data remain available
 * to authenticated trainer/admin reports but are not broadcast to the room.
 */
export function participantsForClient(participants: Participant[], privileged: boolean): any[] {
  if (privileged) return participants;

  return participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    team: participant.team,
    avatar_seed: participant.avatar_seed,
    total_score: participant.total_score,
    rank: participant.rank,
    previous_rank: participant.previous_rank,
    streak: participant.streak,
    max_streak: participant.max_streak,
    total_correct: participant.total_correct,
    total_wrong: participant.total_wrong,
    total_timeout: participant.total_timeout,
    total_response_time_ms: participant.total_response_time_ms,
    fastest_response_ms: participant.fastest_response_ms,
    is_connected: participant.is_connected,
  }));
}
