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

export function toAnswerReceipt(answer: ParticipantAnswer) {
  return {
    id: answer.id,
    participant_id: answer.participant_id,
    question_id: answer.question_id,
    question_index: answer.question_index,
    selected_option: answer.selected_option,
    submitted_at: answer.submitted_at,
    accepted: true,
  };
}

export function canRevealParticipantAnswer(session: QuizSession): boolean {
  return REVEAL_STATUSES.has(session.status);
}
