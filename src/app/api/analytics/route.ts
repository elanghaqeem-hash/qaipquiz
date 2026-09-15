import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/authz';
import { db } from '@/lib/db';
import { CompetencyScore } from '@/types/quiz';

export async function GET(req: NextRequest) {
  const auth = authorizeRequest(req, ['SUPER_ADMIN', 'TRAINER']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const session = db.getSessionById(sessionId);
      if (!session) {
        return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan.' }, { status: 404 });
      }

      const participants = db.getParticipants(sessionId);
      const answers = db.getAnswers(sessionId);

      const questionStats = session.questions.map((question, index) => {
        const questionAnswers = answers.filter(answer => answer.question_id === question.question_id);
        const correctCount = questionAnswers.filter(answer => answer.is_correct).length;
        const timeoutCount = questionAnswers.filter(answer => answer.is_timeout === true).length;
        const wrongCount = questionAnswers.filter(answer => !answer.is_correct && answer.is_timeout !== true).length;
        const unansweredCount = Math.max(0, participants.length - questionAnswers.length);
        const totalResponseTime = questionAnswers.reduce((sum, answer) => sum + answer.response_time_ms, 0);
        const averageResponseTimeSec = questionAnswers.length > 0
          ? Number((totalResponseTime / questionAnswers.length / 1000).toFixed(1))
          : 0;
        const successRate = participants.length > 0
          ? Math.round((correctCount / participants.length) * 100)
          : 0;

        let difficultyTag = 'EASY';
        if (successRate < 50) difficultyTag = 'DIFFICULT QUESTION';
        else if (successRate < 75) difficultyTag = 'MODERATE';

        const distribution = { A: 0, B: 0, C: 0, D: 0 };
        questionAnswers.forEach(answer => {
          if (!answer.is_timeout && answer.selected_option && distribution[answer.selected_option] !== undefined) {
            distribution[answer.selected_option] += 1;
          }
        });

        return {
          question_number: index + 1,
          question_code: question.question_code,
          question_text: question.question_text,
          category: question.category,
          difficulty: question.difficulty,
          correct_answer: question.correct_answer,
          correct_count: correctCount,
          wrong_count: wrongCount,
          timeout_count: timeoutCount,
          unanswered_count: unansweredCount,
          success_rate: successRate,
          avg_response_time_sec: averageResponseTimeSec,
          difficulty_tag: difficultyTag,
          distribution,
        };
      });

      const categoryMap = new Map<string, { total: number; correct: number }>();
      session.questions.forEach(question => {
        if (!categoryMap.has(question.category)) {
          categoryMap.set(question.category, { total: 0, correct: 0 });
        }
      });

      answers.forEach(answer => {
        const question = session.questions.find(item => item.question_id === answer.question_id);
        if (question && categoryMap.has(question.category)) {
          const entry = categoryMap.get(question.category)!;
          entry.total += 1;
          if (answer.is_correct) entry.correct += 1;
        }
      });

      const competencyBreakdown: CompetencyScore[] = Array.from(categoryMap.entries()).map(([category, stats]) => ({
        category,
        total_questions: stats.total,
        correct_count: stats.correct,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }));

      const sortedBySuccess = [...questionStats].sort((a, b) => a.success_rate - b.success_rate);
      const topHardest = sortedBySuccess.slice(0, 5);
      const topEasiest = [...sortedBySuccess].reverse().slice(0, 5);

      const totalScoreSum = participants.reduce((sum, participant) => sum + participant.total_score, 0);
      const avgScore = participants.length > 0 ? Math.round(totalScoreSum / participants.length) : 0;
      const totalCorrectSum = participants.reduce((sum, participant) => sum + participant.total_correct, 0);
      const avgAccuracy = participants.length > 0 && session.questions.length > 0
        ? Math.round((totalCorrectSum / (participants.length * session.questions.length)) * 100)
        : 0;

      return NextResponse.json(
        {
          success: true,
          data: {
            session,
            totalParticipants: participants.length,
            avgScore,
            avgAccuracy,
            questionStats,
            competencyBreakdown,
            topHardest,
            topEasiest,
            participants,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const allQuestions = db.getQuestions();
    const allSessions = db.getSessions();
    const allParticipants = db.getParticipants();
    const allAnswers = db.getAnswers();

    const totalQuizzes = allSessions.length;
    const totalParticipants = allParticipants.length;
    const totalQuestions = allQuestions.length;
    const avgScore = allParticipants.length > 0
      ? Math.round(allParticipants.reduce((sum, participant) => sum + participant.total_score, 0) / allParticipants.length)
      : 0;
    const totalAnswers = allAnswers.length;
    const totalCorrectAnswers = allAnswers.filter(answer => answer.is_correct).length;
    const avgAccuracy = totalAnswers > 0 ? Math.round((totalCorrectAnswers / totalAnswers) * 100) : 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          totalQuizzes,
          totalParticipants,
          totalQuestions,
          avgScore,
          avgAccuracy,
          recentSessions: allSessions.slice(-10).reverse(),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat analytics.' }, { status: 500 });
  }
}
