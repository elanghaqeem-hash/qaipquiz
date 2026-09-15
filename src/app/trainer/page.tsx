'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, Trophy, Plus, Play, BarChart3, Clock,
  Calendar, CheckCircle2, ChevronRight, Zap
} from 'lucide-react';
import { QuizSession } from '@/types/quiz';

export default function TrainerDashboardPage() {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setSessions(res.data.recentSessions || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 mb-2">
              <Zap className="w-3.5 h-3.5" /> Portal Trainer / Lead Facilitator
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              SESI PELATIHAN SAYA
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Buat quiz interaktif baru, kendalikan sesi live di layar proyektor, dan tinjau laporan evaluasi peserta
            </p>
          </div>

          <Link
            href="/trainer/quiz/create"
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-blue-500/30 flex items-center gap-2 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Buat Sesi Quiz Baru (Wizard)
          </Link>
        </div>

        {/* Quick Launch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Sesi Quiz</span>
            <div className="text-3xl font-black text-white">{sessions.length}</div>
            <p className="text-[11px] text-slate-400">Sesi yang pernah dibuat</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Question Bank Siap Digunakan</span>
            <div className="text-3xl font-black text-cyan-400">50 Soal</div>
            <p className="text-[11px] text-slate-400">GIAS 2024 & KEP-72/D.02/2024</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Mode Tersedia</span>
            <div className="text-3xl font-black text-emerald-400">5 Mode</div>
            <p className="text-[11px] text-slate-400">Live, Pre/Post-Test, Team Battle</p>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-lg text-white">Daftar Sesi Quiz Trainer</h2>
            <span className="text-xs text-slate-400">{sessions.length} Sesi Terdaftar</span>
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm italic">
              Belum ada sesi quiz yang dibuat. Klik tombol &quot;Buat Sesi Quiz Baru&quot; di atas untuk memulai sesi pertama Anda!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                    <th className="pb-3 px-2">Room Code</th>
                    <th className="pb-3 px-2">Judul Quiz</th>
                    <th className="pb-3 px-2">Mode</th>
                    <th className="pb-3 px-2">Jumlah Soal</th>
                    <th className="pb-3 px-2">Status</th>
                    <th className="pb-3 px-2 text-right">Kontrol Trainer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sessions.map((s) => (
                    <tr key={s.session_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-2 font-mono font-bold text-blue-400">{s.room_code}</td>
                      <td className="py-3.5 px-2 font-semibold text-white">{s.title}</td>
                      <td className="py-3.5 px-2 text-slate-400">{s.mode.replace('_', ' ')}</td>
                      <td className="py-3.5 px-2 text-slate-300 font-medium">{s.questions.length} Soal</td>
                      <td className="py-3.5 px-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'QUESTION_ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                          s.status === 'FINISHED' ? 'bg-slate-800 text-slate-400' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right space-x-2">
                        <Link
                          href={`/host/${s.room_code}`}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1 shadow"
                        >
                          <Play className="w-3 h-3 fill-current" /> Buka Layar Host
                        </Link>
                        <Link
                          href={`/trainer/reports/${s.session_id}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <BarChart3 className="w-3 h-3" /> Laporan & Sertifikat
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
