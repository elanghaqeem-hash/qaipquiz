import { Participant, ParticipantAnswer, Question, QuizSession } from '@/types/quiz';

type SensitiveQuestionFields = 'correct_answer' | 'explanation' | 'learning_point' | 'reference';
export type PublicQuestion = Omit<Question, SensitiveQuestionFields> & Partial<Pick<Question, SensitiveQuestionFields>>;
export type PublicQuizSession = Omit<QuizSession, 'questions'> & { questions: PublicQuestion[] };
export type PublicParticipant = Omit<Participant, 'email' | 'company' | 'unit_kerja'>;

const REVEAL_STATUSES = new Set(['ANSWER_REVEAL', 'LEADERBOARD', 'PODIUM', 'FINISHED']);

function sanitizeQuestion(question: Question, includePrompt: boolean, revealAnswer: boolean): PublicQuestion {
  const {
    correct_answer,
    explanation,
    learning_point,
    reference,
    ...safe
  } = question;

  const result: PublicQuestion = {
    ...safe,
    question_text: includePrompt ? safe.question_text : '',
    option_a: includePrompt ? safe.option_a : '',
    option_b: includePrompt ? safe.option_b : '',
    option_c: includePrompt ? safe.option_c : '',
    option_d: includePrompt ? safe.option_d : '',
  };

  if (revealAnswer) {
    result.correct_answer = correct_answer;
    result.explanation = explanation;
    result.learning_point = learning_point;
    result.reference = reference;
  }

  return result;
}

export function toPublicSession(session: QuizSession): PublicQuizSession {
  const revealCurrent = REVEAL_STATUSES.has(session.status);
  const includeCurrentPrompt = session.status !== 'WAITING';

  return {
    ...session,
    questions: session.questions.map((question, index) => {
      const isCurrent = index === session.current_question_index;
      return sanitizeQuestion(
        question,
        includeCurrentPrompt && isCurrent,
        revealCurrent && isCurrent
      );
    }),
  };
}

export function toPublicParticipant(participant: Participant): PublicParticipant {
  const {
    email: _email,
    company: _company,
    unit_kerja: _unitKerja,
    ...safe
  } = participant;
  return safe;
}

export function toPublicParticipants(participants: Participant[]): PublicParticipant[] {
  return participants.map(toPublicParticipant);
}

function buildVisibleMetrics(participant: Participant, answers: ParticipantAnswer[]) {
  const ordered = answers
    .filter(answer => answer.participant_id === participant.id)
    .slice()
    .sort((a, b) => a.question_index - b.question_index || a.submitted_at - b.submitted_at);

  let streak = 0;
  let maxStreak = 0;
  for (const answer of ordered) {
    streak = answer.is_correct ? streak + 1 : 0;
    maxStreak = Math.max(maxStreak, streak);
  }

  return {
    total_score: ordered.reduce((sum, answer) => sum + answer.score, 0),
    total_correct: ordered.filter(answer => answer.is_correct).length,
    total_wrong: ordered.filter(answer => !answer.is_correct && answer.is_timeout !== true).length,
    total_timeout: ordered.filter(answer => answer.is_timeout === true).length,
    total_response_time_ms: ordered.reduce((sum, answer) => sum + answer.response_time_ms, 0),
    fastest_response_ms: ordered.length > 0
      ? Math.min(...ordered.map(answer => answer.response_time_ms))
      : 0,
    streak,
    max_streak: maxStreak,
  };
}

/**
 * Public participant state must not reveal whether the active answer was correct.
 * While a question is active/paused, expose metrics computed only from previous questions.
 */
export function toPublicParticipantsForSession(
  participants: Participant[],
  session: QuizSession,
  answers: ParticipantAnswer[]
): PublicParticipant[] {
  if (REVEAL_STATUSES.has(session.status) || session.status === 'WAITING') {
    return toPublicParticipants(participants);
  }

  const currentQuestion = session.questions[session.current_question_index];
  if (!currentQuestion) return toPublicParticipants(participants);

  const visibleAnswers = answers.filter(answer => answer.question_id !== currentQuestion.question_id);
  return participants.map(participant => ({
    ...toPublicParticipant(participant),
    ...buildVisibleMetrics(participant, visibleAnswers),
  }));
}

export function canRevealParticipantAnswer(session: QuizSession): boolean {
  return REVEAL_STATUSES.has(session.status);
}
