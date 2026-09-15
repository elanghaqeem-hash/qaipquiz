'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, BookOpen, Trophy, Plus, ChevronRight, BarChart3,
  Award, Clock, CheckCircle2, Play, RefreshCw
} from 'lucide-react';
import { QuizSession } from '@/types/quiz';

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setAnalytics(res.data);
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
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              TRAINER & ADMIN DASHBOARD
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Pusat kendali sesi pelatihan, manajemen bank soal GIAS 2024, dan pemantauan performa peserta
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/quiz/create"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Buat Sesi Quiz Baru
            </Link>
            <Link
              href="/admin/questions"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition-all"
            >
              Question Bank
            </Link>
          </div>
        </div>

        {/* Global KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Total Soal QAIP</span>
              <BookOpen className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {analytics?.totalQuestions || 50}
            </div>
            <p className="text-[11px] text-emerald-400 font-semibold">100% Seeded & Published</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Sesi Dijalankan</span>
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {analytics?.totalQuizzes || 0}
            </div>
            <p className="text-[11px] text-slate-400">Live & Self-Paced</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Total Peserta</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {analytics?.totalParticipants || 0}
            </div>
            <p className="text-[11px] text-slate-400">Terdaftar dalam Sesi</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Rata-rata Akurasi</span>
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">
              {analytics?.avgAccuracy || 0}%
            </div>
            <p className="text-[11px] text-slate-400">Hasil Evaluasi</p>
          </div>
        </div>

        {/* Quick Action Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/30 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold uppercase">
              Quick Launch
            </span>
            <h2 className="text-xl font-black text-white">Siap Menjalankan Quiz Training?</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Gunakan wizard pembuatan quiz untuk memilih distribusi 20 soal secara acak cerdas (Smart Randomization) atau buat sesi manual dari 50 bank soal QAIP.
            </p>
          </div>
          <Link
            href="/admin/quiz/create"
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg shadow-blue-500/30 flex items-center gap-2 shrink-0 transition-all hover:scale-105"
          >
            Mulai Wizard <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Recent Quiz Sessions Table */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-lg text-white">Sesi Quiz Terakhir</h3>
            <span className="text-xs text-slate-400">Real-time status</span>
          </div>

          {!analytics?.recentSessions || analytics.recentSessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm italic">
              Belum ada sesi quiz yang dibuat. Klik tombol &quot;Buat Sesi Quiz Baru&quot; di atas untuk memulai!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                    <th className="pb-3 px-2">Room Code</th>
                    <th className="pb-3 px-2">Judul Sesi</th>
                    <th className="pb-3 px-2">Mode</th>
                    <th className="pb-3 px-2">Jumlah Soal</th>
                    <th className="pb-3 px-2">Status</th>
                    <th className="pb-3 px-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analytics.recentSessions.map((s: QuizSession) => (
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
                          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" /> Host
                        </Link>
                        <Link
                          href={`/admin/reports/${s.session_id}`}
                          className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <BarChart3 className="w-3 h-3" /> Laporan
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
