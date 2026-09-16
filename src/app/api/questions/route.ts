import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/authorize';
import { Question } from '@/types/quiz';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!(await requireRole(req, ['SUPER_ADMIN', 'TRAINER']))) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase().slice(0, 160);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const domain = searchParams.get('domain');
    const status = searchParams.get('status');

    let questions = await db.getQuestions();
    if (search) {
      questions = questions.filter(q =>
        q.question_text.toLowerCase().includes(search) ||
        q.question_code.toLowerCase().includes(search) ||
        q.category.toLowerCase().includes(search)
      );
    }
    if (category && category !== 'ALL') questions = questions.filter(q => q.category === category);
    if (difficulty && difficulty !== 'ALL') questions = questions.filter(q => q.difficulty === difficulty);
    if (domain && domain !== 'ALL') questions = questions.filter(q => q.gias_domain.includes(domain));
    if (status && status !== 'ALL') questions = questions.filter(q => q.status === status);

    return NextResponse.json(
      { success: true, count: questions.length, data: questions },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireRole(req, ['SUPER_ADMIN', 'TRAINER']))) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    const body = await req.json();
    const questionText = String(body?.question_text || '').trim();
    const optionA = String(body?.option_a || '').trim();
    const optionB = String(body?.option_b || '').trim();
    const optionC = String(body?.option_c || '').trim();
    const optionD = String(body?.option_d || '').trim();
    const correctAnswer = String(body?.correct_answer || '').toUpperCase();

    if (questionText.length < 5 || questionText.length > 5000) {
      return NextResponse.json({ success: false, error: 'Teks pertanyaan wajib 5-5000 karakter' }, { status: 400 });
    }
    if (!optionA || !optionB) {
      return NextResponse.json({ success: false, error: 'Minimal harus ada opsi A dan Opsi B' }, { status: 400 });
    }
    if (![optionA, optionB, optionC, optionD].every(option => option.length <= 2000)) {
      return NextResponse.json({ success: false, error: 'Panjang opsi jawaban melebihi batas' }, { status: 400 });
    }
    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      return NextResponse.json({ success: false, error: 'Kunci jawaban harus A, B, C, atau D' }, { status: 400 });
    }
    if ((correctAnswer === 'C' && !optionC) || (correctAnswer === 'D' && !optionD)) {
      return NextResponse.json({ success: false, error: 'Kunci jawaban mengarah ke opsi yang kosong' }, { status: 400 });
    }

    const allQuestions = await db.getQuestions();
    const nextNum = allQuestions.length + 1;
    const now = new Date().toISOString();
    const timeLimit = Math.min(300, Math.max(5, Number(body.default_time_limit) || 20));
    const newQuestion: Question = {
      question_id: 'q-' + crypto.randomUUID(),
      question_code: String(body.question_code || `QAIP-${nextNum.toString().padStart(3, '0')}`).trim().slice(0, 80),
      question_number: nextNum,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_answer: correctAnswer as 'A' | 'B' | 'C' | 'D',
      explanation: String(body.explanation || 'Penjelasan materi sesuai standar profesional.').trim().slice(0, 8000),
      learning_point: String(body.learning_point || 'Poin pembelajaran inti untuk auditor intern.').trim().slice(0, 4000),
      reference: String(body.reference || 'GIAS 2024; KEP-72/D.02/2024').trim().slice(0, 1000),
      category: String(body.category || 'Peran & Tujuan Audit Intern').trim().slice(0, 200),
      subcategory: String(body.subcategory || 'Umum').trim().slice(0, 200),
      gias_domain: String(body.gias_domain || 'Domain I - Purpose of Internal Auditing').trim().slice(0, 300),
      gias_principle: String(body.gias_principle || 'Purpose of Internal Auditing').trim().slice(0, 300),
      difficulty: body.difficulty || 'Medium',
      question_type: body.question_type || 'single_choice',
      default_time_limit: timeLimit,
      status: body.status || 'Published',
      usage_count: 0,
      success_rate: 0,
      created_at: now,
      updated_at: now,
      created_by: String(body.created_by || 'Trainer / Admin').trim().slice(0, 160),
    };

    const saved = await db.saveQuestion(newQuestion);
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await requireRole(req, ['SUPER_ADMIN', 'TRAINER']))) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    const body = await req.json();
    if (!body.question_id) {
      return NextResponse.json({ success: false, error: 'question_id wajib disertakan' }, { status: 400 });
    }
    const existing = await db.getQuestionById(String(body.question_id));
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Soal tidak ditemukan' }, { status: 404 });
    }
    const merged = { ...existing, ...body, question_id: existing.question_id } as Question;
    return NextResponse.json({ success: true, data: await db.saveQuestion(merged) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireRole(req, ['SUPER_ADMIN']))) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    const id = new URL(req.url).searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ success: false, error: 'id param required' }, { status: 400 });
    const deleted = await db.deleteQuestion(id);
    return NextResponse.json(
      { success: deleted },
      { status: deleted ? 200 : 404 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
