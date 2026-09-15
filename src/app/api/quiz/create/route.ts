import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { QuizSession, Question } from '@/types/quiz';

export const dynamic = 'force-dynamic';

function generateRoomCode(): string {
  return `QAIP-${Math.floor(1000 + Math.random() * 9000)}`;
}

function selectSmartRandom(all: Question[], count: number, categoryFilter?: string, difficultyFilter?: string): Question[] {
  let pool = all.filter(q => q.status === 'Published');
  if (categoryFilter && categoryFilter !== 'ALL') pool = pool.filter(q => q.category === categoryFilter);
  if (difficultyFilter && difficultyFilter !== 'ALL') pool = pool.filter(q => q.difficulty === difficultyFilter);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      training_name,
      trainer_name,
      description,
      mode = 'LIVE_COMPETITION',
      selection_type = 'random',
      question_count = 20,
      selected_question_ids = [],
      category_filter,
      difficulty_filter,
      settings = {},
    } = body;

    const allQuestions = await db.getQuestions();
    const chosenQuestions = selection_type === 'manual' && Array.isArray(selected_question_ids) && selected_question_ids.length > 0
      ? allQuestions.filter(q => selected_question_ids.includes(q.question_id))
      : selectSmartRandom(allQuestions, Number(question_count), category_filter, difficulty_filter);

    if (chosenQuestions.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada soal yang terpilih' }, { status: 400 });
    }

    let roomCode = generateRoomCode();
    for (let attempt = 0; attempt < 10 && await db.getSessionByRoomCode(roomCode); attempt += 1) {
      roomCode = generateRoomCode();
    }

    const now = new Date().toISOString();
    const newSession: QuizSession = {
      session_id: 'sess-' + Date.now(),
      room_code: roomCode,
      title: title || 'QAIP Training Live Quiz',
      training_name: training_name || 'QAIP & GIAS 2024 Certification Training',
      trainer_name: trainer_name || 'Senior Lead Trainer',
      description: description || 'Interactive training quiz session',
      mode,
      status: 'WAITING',
      current_question_index: 0,
      question_started_at: 0,
      question_ends_at: 0,
      settings: {
        time_per_question: Number(settings.time_per_question) || 20,
        speed_bonus_enabled: settings.speed_bonus_enabled !== false,
        streak_bonus_enabled: settings.streak_bonus_enabled !== false,
        scoring_mode: settings.scoring_mode || 'STANDARD',
        allow_answer_change: Boolean(settings.allow_answer_change),
        suspense_mode: settings.suspense_mode !== false,
        passing_score: Number(settings.passing_score) || 75,
        randomize_questions: Boolean(settings.randomize_questions),
        randomize_options: Boolean(settings.randomize_options),
        reveal_duration_seconds: Number(settings.reveal_duration_seconds) || 10,
        show_explanation: settings.show_explanation !== false,
      },
      questions: chosenQuestions,
      created_at: now,
      updated_at: now,
    };

    const saved = await db.saveSession(newSession);
    return NextResponse.json({ success: true, data: saved, room_code: saved.room_code });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
