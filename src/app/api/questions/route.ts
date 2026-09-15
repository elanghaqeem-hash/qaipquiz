import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/authz';
import { db } from '@/lib/db';
import { Question } from '@/types/quiz';

const STAFF_ROLES = ['SUPER_ADMIN', 'TRAINER'] as const;
const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D']);
const VALID_STATUSES = new Set(['Draft', 'Ready', 'Published', 'Archived']);
const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard', 'Case Based']);

function authorizeStaff(req: NextRequest) {
  return authorizeRequest(req, [...STAFF_ROLES]);
}

function validateQuestionPayload(body: any): string | null {
  if (typeof body.question_text !== 'string' || body.question_text.trim().length < 5 || body.question_text.length > 4000) {
    return 'Teks pertanyaan wajib diisi 5-4000 karakter.';
  }
  if (typeof body.option_a !== 'string' || !body.option_a.trim() || typeof body.option_b !== 'string' || !body.option_b.trim()) {
    return 'Minimal harus ada opsi A dan opsi B.';
  }
  if (!VALID_ANSWERS.has(body.correct_answer)) {
    return 'Kunci jawaban harus A, B, C, atau D.';
  }
  const answerText = body[`option_${String(body.correct_answer).toLowerCase()}`];
  if (typeof answerText !== 'string' || !answerText.trim()) {
    return 'Opsi yang menjadi kunci jawaban tidak boleh kosong.';
  }
  if (body.status && !VALID_STATUSES.has(body.status)) {
    return 'Status soal tidak valid.';
  }
  if (body.difficulty && !VALID_DIFFICULTIES.has(body.difficulty)) {
    return 'Tingkat kesulitan tidak valid.';
  }
  const timeLimit = Number(body.default_time_limit || 20);
  if (!Number.isFinite(timeLimit) || timeLimit < 5 || timeLimit > 300) {
    return 'Batas waktu soal harus antara 5 dan 300 detik.';
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = authorizeStaff(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase();
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const domain = searchParams.get('domain');
    const status = searchParams.get('status');

    let questions = db.getQuestions();

    if (search) {
      questions = questions.filter(question =>
        question.question_text.toLowerCase().includes(search) ||
        question.question_code.toLowerCase().includes(search) ||
        question.category.toLowerCase().includes(search)
      );
    }
    if (category && category !== 'ALL') questions = questions.filter(question => question.category === category);
    if (difficulty && difficulty !== 'ALL') questions = questions.filter(question => question.difficulty === difficulty);
    if (domain && domain !== 'ALL') questions = questions.filter(question => question.gias_domain.includes(domain));
    if (status && status !== 'ALL') questions = questions.filter(question => question.status === status);

    return NextResponse.json(
      { success: true, count: questions.length, data: questions },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Question list error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat bank soal.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authorizeStaff(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const validationError = validateQuestionPayload(body);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const allQuestions = db.getQuestions();
    const nextNum = allQuestions.reduce((max, question) => Math.max(max, question.question_number || 0), 0) + 1;
    const questionCode = typeof body.question_code === 'string' && body.question_code.trim()
      ? body.question_code.trim()
      : `QAIP-${nextNum.toString().padStart(3, '0')}`;

    if (allQuestions.some(question => question.question_code.toLowerCase() === questionCode.toLowerCase())) {
      return NextResponse.json({ success: false, error: 'Kode soal sudah digunakan.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const newQuestion: Question = {
      question_id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question_code: questionCode,
      question_number: nextNum,
      question_text: body.question_text.trim(),
      option_a: body.option_a.trim(),
      option_b: body.option_b.trim(),
      option_c: typeof body.option_c === 'string' ? body.option_c.trim() : '',
      option_d: typeof body.option_d === 'string' ? body.option_d.trim() : '',
      correct_answer: body.correct_answer,
      explanation: typeof body.explanation === 'string' ? body.explanation.trim() : '',
      learning_point: typeof body.learning_point === 'string' ? body.learning_point.trim() : '',
      reference: typeof body.reference === 'string' ? body.reference.trim() : '',
      category: body.category || 'Peran & Tujuan Audit Intern',
      subcategory: body.subcategory || 'Umum',
      gias_domain: body.gias_domain || 'Domain I - Purpose of Internal Auditing',
      gias_principle: body.gias_principle || 'Purpose of Internal Auditing',
      difficulty: body.difficulty || 'Medium',
      question_type: body.question_type || 'single_choice',
      default_time_limit: Number(body.default_time_limit) || 20,
      status: body.status || 'Draft',
      usage_count: 0,
      success_rate: 0,
      created_at: now,
      updated_at: now,
      created_by: auth.user.name,
    };

    db.saveQuestion(newQuestion);
    return NextResponse.json({ success: true, data: newQuestion }, { status: 201 });
  } catch (error) {
    console.error('Create question error:', error);
    return NextResponse.json({ success: false, error: 'Gagal membuat soal.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = authorizeStaff(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (typeof body.question_id !== 'string' || !body.question_id) {
      return NextResponse.json({ success: false, error: 'question_id wajib disertakan.' }, { status: 400 });
    }

    const existing = db.getQuestionById(body.question_id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Soal tidak ditemukan.' }, { status: 404 });
    }

    const merged: Question = { ...existing, ...body, question_id: existing.question_id, created_at: existing.created_at };
    const validationError = validateQuestionPayload(merged);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const duplicateCode = db.getQuestions().some(question =>
      question.question_id !== existing.question_id &&
      question.question_code.toLowerCase() === merged.question_code.toLowerCase()
    );
    if (duplicateCode) {
      return NextResponse.json({ success: false, error: 'Kode soal sudah digunakan.' }, { status: 409 });
    }

    const updated = db.saveQuestion(merged);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update question error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memperbarui soal.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authorizeStaff(req);
  if (!auth.ok) return auth.response;

  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id wajib disertakan.' }, { status: 400 });
    }

    const deleted = db.deleteQuestion(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Soal tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete question error:', error);
    return NextResponse.json({ success: false, error: 'Gagal menghapus soal.' }, { status: 500 });
  }
}
