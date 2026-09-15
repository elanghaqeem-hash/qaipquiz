import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CompetencyScore } from '@/types/quiz';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const session = await db.getSessionById(sessionId);
      if (!session) {
        return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
      }

      const [participants, answers] = await Promise.all([
        db.getParticipants(sessionId),
        db.getAnswers(sessionId),
      ]);

      const questionStats = session.questions.map((q, idx) => {
        const qAnswers = answers.filter(a => a.question_id === q.question_id);
        const correctCount = qAnswers.filter(a => a.is_correct).length;
        const wrongCount = qAnswers.filter(a => !a.is_correct && a.selected_option !== null).length;
        const timeoutCount = participants.length - qAnswers.length;
        const totalRespTime = qAnswers.reduce((sum, a) => sum + a.response_time_ms, 0);
        const avgRespTimeSec = qAnswers.length > 0 ? (totalRespTime / qAnswers.length / 1000).toFixed(1) : 0;
        const successRate = participants.length > 0 ? Math.round((correctCount / participants.length) * 100) : 0;

        let difficultyTag = 'EASY';
        if (successRate < 50) difficultyTag = 'DIFFICULT QUESTION';
        else if (successRate < 75) difficultyTag = 'MODERATE';

        const dist = { A: 0, B: 0, C: 0, D: 0 };
        qAnswers.forEach(a => {
          if (a.selected_option && dist[a.selected_option as keyof typeof dist] !== undefined) {
            dist[a.selected_option as keyof typeof dist] += 1;
          }
        });

        return {
          question_number: idx + 1,
          question_code: q.question_code,
          question_text: q.question_text,
          category: q.category,
          difficulty: q.difficulty,
          correct_answer: q.correct_answer,
          correct_count: correctCount,
          wrong_count: wrongCount,
          timeout_count: timeoutCount,
          success_rate: successRate,
          avg_response_time_sec: avgRespTimeSec,
          difficulty_tag: difficultyTag,
          distribution: dist,
        };
      });

      const categoryMap = new Map<string, { total: number; correct: number }>();
      session.questions.forEach(q => {
        if (!categoryMap.has(q.category)) categoryMap.set(q.category, { total: 0, correct: 0 });
      });

      answers.forEach(a => {
        const q = session.questions.find(item => item.question_id === a.question_id);
        if (q && categoryMap.has(q.category)) {
          const entry = categoryMap.get(q.category)!;
          entry.total += 1;
          if (a.is_correct) entry.correct += 1;
        }
      });

      const competencyBreakdown: CompetencyScore[] = Array.from(categoryMap.entries()).map(([cat, stats]) => ({
        category: cat,
        total_questions: stats.total,
        correct_count: stats.correct,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }));

      const sortedBySuccess = [...questionStats].sort((a, b) => a.success_rate - b.success_rate);
      const totalScoreSum = participants.reduce((s, p) => s + p.total_score, 0);
      const avgScore = participants.length > 0 ? Math.round(totalScoreSum / participants.length) : 0;
      const totalCorrectSum = participants.reduce((s, p) => s + p.total_correct, 0);
      const avgAccuracy = participants.length > 0 && session.questions.length > 0
        ? Math.round((totalCorrectSum / (participants.length * session.questions.length)) * 100)
        : 0;

      return NextResponse.json({
        success: true,
        data: {
          session,
          totalParticipants: participants.length,
          avgScore,
          avgAccuracy,
          questionStats,
          competencyBreakdown,
          topHardest: sortedBySuccess.slice(0, 5),
          topEasiest: [...sortedBySuccess].reverse().slice(0, 5),
          participants,
        },
      });
    }

    const [allQuestions, allSessions, allParticipants, allAnswers] = await Promise.all([
      db.getQuestions(),
      db.getSessions(),
      db.getParticipants(),
      db.getAnswers(),
    ]);

    const avgScore = allParticipants.length > 0
      ? Math.round(allParticipants.reduce((sum, p) => sum + p.total_score, 0) / allParticipants.length)
      : 0;
    const totalCorrectAnswers = allAnswers.filter(a => a.is_correct).length;
    const avgAccuracy = allAnswers.length > 0 ? Math.round((totalCorrectAnswers / allAnswers.length) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalQuizzes: allSessions.length,
        totalParticipants: allParticipants.length,
        totalQuestions: allQuestions.length,
        avgScore,
        avgAccuracy,
        recentSessions: allSessions.slice(-10).reverse(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
