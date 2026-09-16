import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/authorize';
import { QuizMode, QuizSession, Question, ScoringMode } from '@/types/quiz';

export const dynamic = 'force-dynamic';

const QUIZ_MODES = new Set<QuizMode>(['LIVE_COMPETITION', 'SELF_PACED', 'PRE_TEST', 'POST_TEST', 'TEAM_BATTLE']);
const SCORING_MODES = new Set<ScoringMode>(['STANDARD', 'ACCURACY_PRIORITY', 'SPEED_CHALLENGE', 'NO_SPEED_BONUS']);

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, maxLength);
}

function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return `QAIP-${String(1000 + (bytes[0] % 9000))}`;
}

function selectSmartRandom(all: Question[], count: number, categoryFilter?: string, difficultyFilter?: string): Question[] {
  let pool = all.filter(q => q.status === 'Published');
  if (categoryFilter && categoryFilter !== 'ALL') pool = pool.filter(q => q.category === categoryFilter);
  if (difficultyFilter && difficultyFilter !== 'ALL') pool = pool.filter(q => q.difficulty === difficultyFilter);

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    const j = random % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, ['SUPER_ADMIN', 'TRAINER']);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const requestedMode = String(body?.mode || 'LIVE_COMPETITION').toUpperCase() as QuizMode;
    const mode: QuizMode = QUIZ_MODES.has(requestedMode) ? requestedMode : 'LIVE_COMPETITION';
    const selectionType = body?.selection_type === 'manual' ? 'manual' : 'random';
    const questionCount = Math.min(100, Math.max(1, Number(body?.question_count) || 20));
    const selectedIds = Array.isArray(body?.selected_question_ids)
      ? [...new Set(body.selected_question_ids.map((id: unknown) => String(id)).filter(Boolean))].slice(0, 100)
      : [];
    const categoryFilter = cleanText(body?.category_filter, '', 200);
    const difficultyFilter = cleanText(body?.difficulty_filter, '', 80);
    const settings = body?.settings && typeof body.settings === 'object' ? body.settings : {};

    const allQuestions = await db.getQuestions();
    const chosenQuestions = selectionType === 'manual' && selectedIds.length > 0
      ? allQuestions.filter(q => selectedIds.includes(q.question_id) && q.status === 'Published')
      : selectSmartRandom(allQuestions, questionCount, categoryFilter || undefined, difficultyFilter || undefined);

    if (chosenQuestions.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada soal Published yang terpilih' }, { status: 400 });
    }

    let roomCode = '';
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = generateRoomCode();
      if (!(await db.getSessionByRoomCode(candidate))) {
        roomCode = candidate;
        break;
      }
    }
    if (!roomCode) {
      return NextResponse.json({ success: false, error: 'Gagal membuat room code unik. Silakan coba lagi.' }, { status: 503 });
    }

    const requestedScoringMode = String(settings.scoring_mode || 'STANDARD').toUpperCase() as ScoringMode;
    const scoringMode: ScoringMode = SCORING_MODES.has(requestedScoringMode) ? requestedScoringMode : 'STANDARD';
    const timePerQuestion = Math.min(300, Math.max(5, Number(settings.time_per_question) || 20));
    const passingScore = Math.min(100, Math.max(0, Number(settings.passing_score) || 75));
    const revealDuration = Math.min(120, Math.max(3, Number(settings.reveal_duration_seconds) || 10));
    const now = new Date().toISOString();

    const newSession: QuizSession = {
      session_id: 'sess-' + crypto.randomUUID(),
      room_code: roomCode,
      title: cleanText(body?.title, 'QAIP Training Live Quiz', 200),
      training_name: cleanText(body?.training_name, 'QAIP & GIAS 2024 Certification Training', 240),
      trainer_name: cleanText(body?.trainer_name, user.name || 'Trainer', 160),
      description: cleanText(body?.description, 'Interactive training quiz session', 1000),
      mode,
      status: 'WAITING',
      current_question_index: 0,
      question_started_at: 0,
      question_ends_at: 0,
      settings: {
        time_per_question: timePerQuestion,
        speed_bonus_enabled: settings.speed_bonus_enabled !== false,
        streak_bonus_enabled: settings.streak_bonus_enabled !== false,
        scoring_mode: scoringMode,
        allow_answer_change: Boolean(settings.allow_answer_change),
        suspense_mode: settings.suspense_mode !== false,
        passing_score: passingScore,
        randomize_questions: Boolean(settings.randomize_questions),
        randomize_options: Boolean(settings.randomize_options),
        reveal_duration_seconds: revealDuration,
        show_explanation: settings.show_explanation !== false,
      },
      questions: chosenQuestions,
      created_at: now,
      updated_at: now,
    };

    const saved = await db.saveSession(newSession);
    return NextResponse.json(
      { success: true, data: saved, room_code: saved.room_code },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
