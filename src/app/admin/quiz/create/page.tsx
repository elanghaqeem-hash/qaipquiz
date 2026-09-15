'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Check, ChevronRight, ChevronLeft, Play,
  BookOpen, Sliders, ShieldCheck, CheckSquare, Square,
  HelpCircle, Zap
} from 'lucide-react';
import { Question, QuizMode, ScoringMode } from '@/types/quiz';

export default function CreateQuizPage() {
  const router = useRouter();

  // Wizard Step
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1: Info & Settings
  const [title, setTitle] = useState('QAIP Training Live Quiz');
  const [trainingName, setTrainingName] = useState('QAIP & GIAS 2024 Certification Training');
  const [trainerName, setTrainerName] = useState('Lead Auditor & Trainer');
  const [description, setDescription] = useState('Sesi quiz kompetitif dan evaluasi pemahaman standar audit intern perbankan.');
  const [mode, setMode] = useState<QuizMode>('LIVE_COMPETITION');
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [speedBonusEnabled, setSpeedBonusEnabled] = useState(true);
  const [streakBonusEnabled, setStreakBonusEnabled] = useState(true);
  const [scoringMode, setScoringMode] = useState<ScoringMode>('STANDARD');
  const [suspenseMode, setSuspenseMode] = useState(true);
  const [allowAnswerChange, setAllowAnswerChange] = useState(false);
  const [passingScore, setPassingScore] = useState(75);

  // Step 2: Question Selection
  const [selectionType, setSelectionType] = useState<'random' | 'manual'>('random');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState('ALL');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/questions')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setAllQuestions(res.data);
          // Pre-select first 20 for manual
          setSelectedQuestionIds(res.data.slice(0, 20).map((q: Question) => q.question_id));
        }
      })
      .catch(console.error);
  }, []);

  const handleToggleQuestion = (id: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredQuestions.map(q => q.question_id);
    setSelectedQuestionIds(Array.from(new Set([...selectedQuestionIds, ...ids])));
  };

  const handleDeselectAll = () => {
    setSelectedQuestionIds([]);
  };

  const filteredQuestions = allQuestions.filter(q => {
    const matchSearch = q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        q.question_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || q.category === categoryFilter;
    const matchDiff = difficultyFilter === 'ALL' || q.difficulty === difficultyFilter;
    return matchSearch && matchCat && matchDiff;
  });

  const categories = Array.from(new Set(allQuestions.map(q => q.category)));

  const handleCreateAndLaunch = async () => {
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const payload = {
        title,
        training_name: trainingName,
        trainer_name: trainerName,
        description,
        mode,
        selection_type: selectionType,
        question_count: questionCount,
        selected_question_ids: selectionType === 'manual' ? selectedQuestionIds : undefined,
        category_filter: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        difficulty_filter: difficultyFilter !== 'ALL' ? difficultyFilter : undefined,
        settings: {
          time_per_question: timePerQuestion,
          speed_bonus_enabled: speedBonusEnabled,
          streak_bonus_enabled: streakBonusEnabled,
          scoring_mode: scoringMode,
          suspense_mode: suspenseMode,
          allow_answer_change: allowAnswerChange,
          passing_score: passingScore,
        }
      };

      const res = await fetch('/api/quiz/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Gagal membuat sesi quiz');
      }

      // Redirect immediately to Host command center
      router.push(`/host/${data.room_code}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat membuat sesi');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Wizard Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs font-bold border border-blue-500/20 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> QUIZ CREATION WIZARD
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">BUAT SESI QUIZ BARU</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Konfigurasikan informasi sesi dan tentukan komposisi soal dari 50 Bank Soal QAIP
          </p>
        </div>

        {/* Wizard Stepper Tabs */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentStep(1)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              currentStep === 1
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
            Informasi & Pengaturan Sesi
          </button>

          <ChevronRight className="w-4 h-4 text-slate-600" />

          <button
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              currentStep === 2
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
            Pemilihan Soal (Question Selection)
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Quiz Information & Settings */}
        {currentStep === 1 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
            <h2 className="text-lg font-black text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" />
              Langkah 1: Identitas & Pengaturan Quiz
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Nama Sesi Quiz <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Nama Pelatihan / Modul <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={trainingName}
                  onChange={(e) => setTrainingName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Nama Trainer / Host
                </label>
                <input
                  type="text"
                  value={trainerName}
                  onChange={(e) => setTrainerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Mode Quiz
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as QuizMode)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LIVE_COMPETITION">Live Competition (Trainer Controlled)</option>
                  <option value="SELF_PACED">Self-Paced Quiz (Mandiri)</option>
                  <option value="PRE_TEST">Pre-Test (Asesmen Awal Kompetensi)</option>
                  <option value="POST_TEST">Post-Test (Evaluasi Akhir)</option>
                  <option value="TEAM_BATTLE">Team Battle (Alpha, Bravo, Charlie, Delta)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Deskripsi Singkat
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Game Rules & Timing */}
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Aturan Scoring & Waktu
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Waktu per Soal (Detik)
                  </label>
                  <select
                    value={timePerQuestion}
                    onChange={(e) => setTimePerQuestion(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                  >
                    <option value={15}>15 Detik (Cepat / Flash)</option>
                    <option value={20}>20 Detik (Standar)</option>
                    <option value={25}>25 Detik (Sedang)</option>
                    <option value={30}>30 Detik (Materi Panjang)</option>
                    <option value={45}>45 Detik (Case-Based)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Skema Scoring
                  </label>
                  <select
                    value={scoringMode}
                    onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                  >
                    <option value="STANDARD">Standard (Akurasi 1000 + Speed Bonus 500)</option>
                    <option value="ACCURACY_PRIORITY">Accuracy Priority (Hanya Akurasi 1000)</option>
                    <option value="SPEED_CHALLENGE">Speed Challenge (Speed Bonus 1000)</option>
                    <option value="NO_SPEED_BONUS">No Speed Bonus</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={streakBonusEnabled}
                    onChange={(e) => setStreakBonusEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    Aktifkan Streak Bonus (+100 untuk 3+ benar berturut-turut)
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={suspenseMode}
                    onChange={(e) => setSuspenseMode(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    Suspense Mode (Sembunyikan ranking di soal terakhir)
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2"
              >
                Lanjut ke Pemilihan Soal <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Question Selection */}
        {currentStep === 2 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  Langkah 2: Komposisi Soal ({selectionType === 'random' ? `${questionCount} Soal Acak` : `${selectedQuestionIds.length} Soal Terpilih`})
                </h2>
                <p className="text-xs text-slate-400">Total bank soal tersedia: {allQuestions.length} Soal QAIP</p>
              </div>

              {/* Mode Selector Tab */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  onClick={() => setSelectionType('random')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectionType === 'random' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 inline mr-1" /> Smart Random
                </button>
                <button
                  onClick={() => setSelectionType('manual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectionType === 'manual' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Manual Selection
                </button>
              </div>
            </div>

            {/* Smart Random Settings */}
            {selectionType === 'random' && (
              <div className="space-y-4 p-5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Pilih Jumlah Soal
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {[5, 10, 15, 20, 25, 30, 40, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQuestionCount(num)}
                        className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                          questionCount === num
                            ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {num} Soal
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Filter Kategori Khusus (Opsional)
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
                    >
                      <option value="ALL">Semua 10 Kategori QAIP</option>
                      {categories.map((c, i) => (
                        <option key={i} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Filter Tingkat Kesulitan
                    </label>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
                    >
                      <option value="ALL">Semua Tingkat (Proporsional)</option>
                      <option value="Easy">Easy Saja</option>
                      <option value="Medium">Medium Saja</option>
                      <option value="Hard">Hard Saja</option>
                      <option value="Case Based">Case Based Saja</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                  <strong>Smart Randomization Engine:</strong> Algoritma akan memastikan distribusi seimbang mencakup Peran Audit, Etika & Objektivitas, Due Professional Care, Risk Assessment, Eksekusi, Pelaporan, hingga Case-Based.
                </div>
              </div>
            )}

            {/* Manual Selection Table */}
            {selectionType === 'manual' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari teks soal, kode, atau materi..."
                    className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {categories.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAllFiltered}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                    >
                      Pilih Semua
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-400"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 p-2 bg-slate-950 rounded-2xl border border-slate-800 pr-1">
                  {filteredQuestions.map((q) => {
                    const isSelected = selectedQuestionIds.includes(q.question_id);
                    return (
                      <div
                        key={q.question_id}
                        onClick={() => handleToggleQuestion(q.question_id)}
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all text-xs ${
                          isSelected
                            ? 'border-blue-500 bg-blue-950/30'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="pt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-400">{q.question_code}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-slate-800 text-slate-300">
                              {q.category}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{q.difficulty}</span>
                          </div>
                          <p className="font-medium text-white leading-snug">{q.question_text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Kembali
              </button>

              <button
                onClick={handleCreateAndLaunch}
                disabled={isSubmitting}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-500/30 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Memproses Pembuatan Sesi...</span>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    BUAT DAN LUNCURKAN QUIZ SEKARANG
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
