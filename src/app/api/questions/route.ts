import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Question } from '@/types/quiz';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase();
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

    return NextResponse.json({ success: true, count: questions.length, data: questions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.question_text || body.question_text.trim().length < 5) {
      return NextResponse.json({ success: false, error: 'Teks pertanyaan wajib diisi minimal 5 karakter' }, { status: 400 });
    }
    if (!body.option_a || !body.option_b) {
      return NextResponse.json({ success: false, error: 'Minimal harus ada opsi A dan Opsi B' }, { status: 400 });
    }
    if (!['A', 'B', 'C', 'D'].includes(body.correct_answer)) {
      return NextResponse.json({ success: false, error: 'Kunci jawaban harus A, B, C, atau D' }, { status: 400 });
    }

    const allQuestions = await db.getQuestions();
    const nextNum = allQuestions.length + 1;
    const now = new Date().toISOString();
    const newQuestion: Question = {
      question_id: 'q-' + Date.now(),
      question_code: body.question_code || `QAIP-${nextNum.toString().padStart(3, '0')}`,
      question_number: nextNum,
      question_text: body.question_text,
      option_a: body.option_a,
      option_b: body.option_b,
      option_c: body.option_c || '',
      option_d: body.option_d || '',
      correct_answer: body.correct_answer,
      explanation: body.explanation || 'Penjelasan materi sesuai standar profesional.',
      learning_point: body.learning_point || 'Poin pembelajaran inti untuk auditor intern.',
      reference: body.reference || 'GIAS 2024; KEP-72/D.02/2024',
      category: body.category || 'Peran & Tujuan Audit Intern',
      subcategory: body.subcategory || 'Umum',
      gias_domain: body.gias_domain || 'Domain I - Purpose of Internal Auditing',
      gias_principle: body.gias_principle || 'Purpose of Internal Auditing',
      difficulty: body.difficulty || 'Medium',
      question_type: body.question_type || 'single_choice',
      default_time_limit: Number(body.default_time_limit) || 20,
      status: body.status || 'Published',
      usage_count: 0,
      success_rate: 0,
      created_at: now,
      updated_at: now,
      created_by: body.created_by || 'Trainer / Admin',
    };

    const saved = await db.saveQuestion(newQuestion);
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.question_id) {
      return NextResponse.json({ success: false, error: 'question_id wajib disertakan' }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: await db.saveQuestion(body) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id param required' }, { status: 400 });
    return NextResponse.json({ success: await db.deleteQuestion(id) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
