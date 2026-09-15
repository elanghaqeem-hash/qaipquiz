'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen, Plus, Search, Filter, ShieldCheck, Edit,
  Trash2, Eye, Download, Upload, CheckCircle2, X
} from 'lucide-react';
import { Question, Difficulty, QuestionStatus } from '@/types/quiz';

export default function QuestionsManagerPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const filtered = questions.filter(q => {
    const matchSearch = q.question_text.toLowerCase().includes(search.toLowerCase()) ||
                        q.question_code.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'ALL' || q.category === selectedCategory;
    const matchDiff = selectedDifficulty === 'ALL' || q.difficulty === selectedDifficulty;
    return matchSearch && matchCat && matchDiff;
  });

  const categories = Array.from(new Set(questions.map(q => q.category)));

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soal_qaip_training_50.json';
    a.click();
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    try {
      const isNew = !editingQuestion.question_id;
      const url = '/api/questions';
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingQuestion)
      });
      const data = await res.json();
      if (data.success) {
        setIsEditModalOpen(false);
        setEditingQuestion(null);
        fetchQuestions();
      } else {
        alert(data.error || 'Gagal menyimpan soal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-400" />
              QUESTION BANK MANAGEMENT
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Initial Question Bank: 50 Soal QAIP Training & Pemetaan Standar GIAS 2024
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
            <button
              onClick={() => {
                setEditingQuestion({
                  question_text: '',
                  option_a: '',
                  option_b: '',
                  option_c: '',
                  option_d: '',
                  correct_answer: 'B',
                  explanation: '',
                  learning_point: '',
                  reference: 'GIAS 2024; KEP-72/D.02/2024',
                  category: 'Peran & Tujuan Audit Intern',
                  difficulty: 'Medium',
                  status: 'Published'
                });
                setIsEditModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/25"
            >
              <Plus className="w-4 h-4" /> Tambah Soal Baru
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari teks soal, kode QAIP, atau rujukan..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Kategori ({categories.length})</option>
              {categories.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
              <option value="Case Based">Case Based</option>
            </select>
          </div>
        </div>

        {/* Questions Table */}
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Menampilkan {filtered.length} dari {questions.length} Soal</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                  <th className="pb-3 px-2">ID</th>
                  <th className="pb-3 px-2">Pertanyaan</th>
                  <th className="pb-3 px-2">Kategori</th>
                  <th className="pb-3 px-2">Kunci</th>
                  <th className="pb-3 px-2">Difficulty</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((q) => (
                  <tr key={q.question_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-2 font-mono font-bold text-blue-400">{q.question_code}</td>
                    <td className="py-3 px-2 max-w-md font-medium text-white truncate">{q.question_text}</td>
                    <td className="py-3 px-2 text-slate-400 text-xs">{q.category}</td>
                    <td className="py-3 px-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-extrabold flex items-center justify-center text-xs">
                        {q.correct_answer}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        q.difficulty === 'Easy' ? 'bg-blue-500/20 text-blue-300' :
                        q.difficulty === 'Medium' ? 'bg-cyan-500/20 text-cyan-300' :
                        q.difficulty === 'Hard' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right space-x-1.5">
                      <button
                        onClick={() => setPreviewQuestion(q)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Preview Detail"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingQuestion(q);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Edit Metadata"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-mono font-bold text-blue-400">{previewQuestion.question_code}</span>
              <button onClick={() => setPreviewQuestion(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-white leading-relaxed">{previewQuestion.question_text}</h3>

            <div className="space-y-2">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const isCorrect = previewQuestion.correct_answer === opt;
                const text = (previewQuestion as any)[`option_${opt.toLowerCase()}`];
                if (!text) return null;
                return (
                  <div key={opt} className={`p-3 rounded-xl border flex items-start gap-3 text-xs ${
                    isCorrect ? 'border-emerald-500 bg-emerald-950/30 text-emerald-200 font-bold' : 'border-slate-800 bg-slate-950 text-slate-300'
                  }`}>
                    <span className={`w-6 h-6 rounded flex items-center justify-center font-black shrink-0 ${
                      isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {opt}
                    </span>
                    <span className="leading-snug">{text}</span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-cyan-400 block">Pembahasan Mengapa Benar:</span>
              <p className="text-slate-300 leading-relaxed">{previewQuestion.explanation}</p>
              {previewQuestion.learning_point && (
                <p className="text-blue-300 font-semibold pt-1">💡 {previewQuestion.learning_point}</p>
              )}
              {previewQuestion.reference && (
                <p className="text-slate-400 text-[11px] pt-1">📖 Rujukan: {previewQuestion.reference}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      {isEditModalOpen && editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveQuestion} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">
                {editingQuestion.question_id ? `Edit Soal ${editingQuestion.question_code}` : 'Tambah Soal Baru'}
              </h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Teks Soal</label>
              <textarea
                value={editingQuestion.question_text || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                rows={3}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                <div key={opt}>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Opsi {opt}</label>
                  <input
                    type="text"
                    value={(editingQuestion as any)[`option_${opt.toLowerCase()}`] || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, [`option_${opt.toLowerCase()}`]: e.target.value })}
                    required={opt === 'A' || opt === 'B'}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Kunci Jawaban</label>
                <select
                  value={editingQuestion.correct_answer || 'B'}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, correct_answer: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Kategori</label>
                <select
                  value={editingQuestion.category || categories[0]}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  {categories.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Difficulty</label>
                <select
                  value={editingQuestion.difficulty || 'Medium'}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                  <option value="Case Based">Case Based</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Penjelasan Jawaban (Why?)</label>
              <textarea
                value={editingQuestion.explanation || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Rujukan / Regulasi</label>
              <input
                type="text"
                value={editingQuestion.reference || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, reference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
              >
                Simpan Soal
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
