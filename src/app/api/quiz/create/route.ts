import { randomInt, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/authz';
import { db } from '@/lib/db';
import { Question, QuizSession } from '@/types/quiz';

function generateRoomCode(): string {
  return `QAIP-${randomInt(1000, 10000)}`;
}

function selectSmartRandom(
  all: Question[],
  count: number,
  categoryFilter?: string,
  difficultyFilter?: string
): Question[] {
  let pool = all.filter(question => question.status === 'Published');

  if (categoryFilter && categoryFilter !== 'ALL') {
    pool = pool.filter(question => question.category === categoryFilter);
  }
  if (difficultyFilter && difficultyFilter !== 'ALL') {
    pool = pool.filter(question => question.difficulty === difficultyFilter);
  }

  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(index + 1);
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function POST(req: NextRequest) {
  const auth = authorizeRequest(req, ['SUPER_ADMIN', 'TRAINER']);
  if (!auth.ok) return auth.response;

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

    const requestedCount = clampNumber(question_count, 20, 1, 200);
    const allQuestions = db.getQuestions();
    let chosenQuestions: Question[] = [];

    if (selection_type === 'manual' && Array.isArray(selected_question_ids) && selected_question_ids.length > 0) {
      const selectedIds = new Set(selected_question_ids.filter((id: unknown) => typeof id === 'string'));
      chosenQuestions = allQuestions.filter(question =>
        question.status === 'Published' && selectedIds.has(question.question_id)
      );
    } else {
      chosenQuestions = selectSmartRandom(allQuestions, requestedCount, category_filter, difficulty_filter);
    }

    if (chosenQuestions.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada soal Published yang memenuhi kriteria.' }, { status: 400 });
    }

    let roomCode = generateRoomCode();
    let attempts = 0;
    while (db.getSessionByRoomCode(roomCode) && attempts < 20) {
      roomCode = generateRoomCode();
      attempts += 1;
    }
    if (db.getSessionByRoomCode(roomCode)) {
      return NextResponse.json({ success: false, error: 'Gagal menghasilkan room code unik.' }, { status: 503 });
    }

    const now = new Date().toISOString();
    const newSession: QuizSession = {
      session_id: `sess-${randomUUID()}`,
      room_code: roomCode,
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 150) : 'QAIP Training Live Quiz',
      training_name: typeof training_name === 'string' && training_name.trim()
        ? training_name.trim().slice(0, 150)
        : 'QAIP & GIAS 2024 Certification Training',
      trainer_name: typeof trainer_name === 'string' && trainer_name.trim()
        ? trainer_name.trim().slice(0, 100)
        : auth.user.name,
      description: typeof description === 'string' ? description.trim().slice(0, 1000) : 'Interactive training quiz session',
      mode,
      status: 'WAITING',
      current_question_index: 0,
      question_started_at: 0,
      question_ends_at: 0,
      settings: {
        time_per_question: clampNumber(settings.time_per_question, 20, 5, 300),
        speed_bonus_enabled: settings.speed_bonus_enabled !== false,
        streak_bonus_enabled: settings.streak_bonus_enabled !== false,
        scoring_mode: settings.scoring_mode || 'STANDARD',
        allow_answer_change: Boolean(settings.allow_answer_change),
        suspense_mode: settings.suspense_mode !== false,
        passing_score: clampNumber(settings.passing_score, 75, 0, 100),
        randomize_questions: Boolean(settings.randomize_questions),
        randomize_options: Boolean(settings.randomize_options),
        reveal_duration_seconds: clampNumber(settings.reveal_duration_seconds, 10, 3, 120),
        show_explanation: settings.show_explanation !== false,
      },
      questions: chosenQuestions,
      created_at: now,
      updated_at: now,
    };

    db.saveSession(newSession);

    return NextResponse.json(
      { success: true, data: newSession, room_code: newSession.room_code },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Create quiz error:', error);
    return NextResponse.json({ success: false, error: 'Gagal membuat sesi quiz.' }, { status: 500 });
  }
}
