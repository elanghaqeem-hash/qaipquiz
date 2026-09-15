import { QuizSession } from '@/types/quiz';

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
