import { Participant, ParticipantAnswer, QuizSession } from '@/types/quiz';

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
 * Rebuild participant scoring using only answers that precede the active
 * question. The server records an answer immediately, but public clients must
 * not be able to infer whether it was correct before ANSWER_REVEAL.
 */
export function participantsBeforeCurrentQuestion(
  participants: Participant[],
  answers: ParticipantAnswer[],
  currentQuestionId: string
): Participant[] {
  return participants.map(participant => {
    const historical = answers
      .filter(answer => answer.participant_id === participant.id && answer.question_id !== currentQuestionId)
      .sort((a, b) => a.question_index - b.question_index || a.submitted_at - b.submitted_at);

    let streak = 0;
    let maxStreak = 0;
    for (const answer of historical) {
      streak = answer.is_correct ? streak + 1 : 0;
      maxStreak = Math.max(maxStreak, streak);
    }

    const responseTimes = historical.map(answer => answer.response_time_ms).filter(value => value > 0);
    return {
      ...participant,
      total_score: historical.reduce((sum, answer) => sum + answer.score, 0),
      total_correct: historical.filter(answer => answer.is_correct).length,
      total_wrong: historical.filter(answer => !answer.is_correct).length,
      total_response_time_ms: responseTimes.reduce((sum, value) => sum + value, 0),
      fastest_response_ms: responseTimes.length ? Math.min(...responseTimes) : 0,
      streak,
      max_streak: maxStreak,
    };
  });
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
