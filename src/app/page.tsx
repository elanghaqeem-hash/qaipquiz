'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, Sparkles, BookOpen, Users, Trophy, Award, ShieldCheck, ChevronRight, Zap } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [quickError, setQuickError] = useState('');

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setQuickError('Masukkan kode room');
      return;
    }
    router.push(`/join?code=${roomCode.trim().toUpperCase()}`);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs sm:text-sm font-semibold tracking-wide uppercase">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Competitive Training Quiz Platform
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            TRAINING QUIZ <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">ARENA</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 font-medium">
            Interactive • Competitive • Educational • Real-Time
          </p>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Platform quiz interaktif berbasis kompetisi dan pembelajaran untuk sertifikasi perbankan, QAIP, dan GIAS 2024. Lengkap dengan penjelasan mendalam &apos;Why?&apos;, rujukan regulasi, dan analitik kompetensi real-time.
          </p>

          {/* Quick Join Card */}
          <div className="pt-6 max-w-md mx-auto">
            <form onSubmit={handleQuickJoin} className="bg-slate-800/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  setQuickError('');
                }}
                placeholder="ROOM CODE (misal: QAIP-4821)"
                className="flex-1 px-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white font-bold text-center sm:text-left placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-wider uppercase text-base"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Play className="w-5 h-5 fill-current" />
                JOIN
              </button>
            </form>
            {quickError && <p className="text-rose-400 text-xs font-semibold mt-2">{quickError}</p>}
          </div>
        </div>
      </section>

      {/* Feature Badges */}
      <section className="py-12 border-t border-slate-800/80 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">50 Seed Questions & GIAS 2024</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Pertanyaan resmi QAIP Training lengkap dengan pemetaan Domain GIAS, Unit Kompetensi KEP-72/D.02/2024, dan SKKNI 215/2017.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Interactive Scoring & Podium</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Scoring adil berbasis akurasi + bonus kecepatan, streak multiplier, live dramatic leaderboard, dan podium pemenang bertabur confetti.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Educational Learning Points</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Bukan sekadar tebak-tebakan. Setiap soal menampilkan pembahasan mendalam mengapa benar, poin pembelajaran, serta rujukan resmi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modes Grid */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <h2 className="text-2xl font-bold text-center text-white mb-8">5 Quiz Modes Tersedia</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { title: 'Live Competition', desc: 'Trainer mengontrol laju soal, leaderboard live & podium.', tag: 'Populer', color: 'border-blue-500/40 bg-blue-950/20' },
            { title: 'Self-Paced Quiz', desc: 'Peserta mengerjakan mandiri dengan batasan waktu fleksibel.', tag: 'Asynchronous', color: 'border-emerald-500/40 bg-emerald-950/20' },
            { title: 'Pre-Test', desc: 'Pemetaan awal gap kompetensi sebelum materi training dimulai.', tag: 'Assessment', color: 'border-amber-500/40 bg-amber-950/20' },
            { title: 'Post-Test', desc: 'Bandingkan skor Pre vs Post Test untuk mengukur knowledge gain.', tag: 'Evaluasi', color: 'border-purple-500/40 bg-purple-950/20' },
            { title: 'Team Battle', desc: 'Peserta dibagi dalam Team Alpha, Bravo, Charlie, Delta.', tag: 'Kolaboratif', color: 'border-cyan-500/40 bg-cyan-950/20' },
          ].map((mode, i) => (
            <div key={i} className={`p-5 rounded-2xl border ${mode.color} flex flex-col justify-between`}>
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-200 uppercase tracking-wider">
                  {mode.tag}
                </span>
                <h3 className="font-bold text-base text-white mt-3">{mode.title}</h3>
                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{mode.desc}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5">
                <Link href="/join" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Ikuti Sesi <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
