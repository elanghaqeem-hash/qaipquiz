'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  BarChart2, Download, Printer, Award, Users, CheckCircle2,
  XCircle, Clock, ShieldCheck, ArrowLeft, Trophy, FileSpreadsheet
} from 'lucide-react';
import { QuizSession, Participant, CompetencyScore } from '@/types/quiz';

export default function SessionReportPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCertParticipant, setSelectedCertParticipant] = useState<Participant | null>(null);

  useEffect(() => {
    fetch(`/api/analytics?sessionId=${sessionId}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleExportCsv = () => {
    if (!data?.participants) return;
    const headers = ['Peringkat', 'Nama', 'Bank/Perusahaan', 'Unit Kerja', 'Skor Total', 'Akurasi (%)', 'Benar', 'Salah', 'Timeout'];
    const rows = data.participants.map((p: Participant) => [
      p.rank,
      p.name,
      p.company,
      p.unit_kerja,
      p.total_score,
      data.session.questions.length > 0 ? Math.round((p.total_correct / data.session.questions.length) * 100) : 0,
      p.total_correct,
      p.total_wrong,
      p.total_timeout
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.map(x => `"${x}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${data.session.room_code}_${Date.now()}.csv`;
    a.click();
  };

  const handleExportExcel = () => {
    if (!data?.participants) return;
    const worksheetData = data.participants.map((p: Participant) => ({
      'Peringkat': p.rank,
      'Nama Peserta': p.name,
      'Bank / Perusahaan': p.company,
      'Unit Kerja': p.unit_kerja,
      'Total Skor': p.total_score,
      'Akurasi (%)': data.session.questions.length > 0 ? Math.round((p.total_correct / data.session.questions.length) * 100) : 0,
      'Jawaban Benar': p.total_correct,
      'Jawaban Salah': p.total_wrong,
      'Timeout': p.total_timeout,
      'Max Streak': p.max_streak,
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participant Scores');
    XLSX.writeFile(wb, `Hasil_Quiz_${data.session.room_code}.xlsx`);
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-400">Memuat laporan sesi quiz...</p>
      </div>
    );
  }

  const { session, participants, questionStats, competencyBreakdown, avgScore, avgAccuracy } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <Link href="/admin" className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              LAPORAN HASIL & ANALITIK QUIZ
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {session.title} • Room: <span className="font-mono text-blue-400 font-bold">{session.room_code}</span> • Trainer: {session.trainer_name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 border border-emerald-700 text-xs font-semibold flex items-center gap-1.5 shadow"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/25"
            >
              <Printer className="w-4 h-4" /> Cetak Laporan
            </button>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Peserta</span>
            <div className="text-2xl sm:text-3xl font-black text-white">{participants.length}</div>
            <p className="text-[11px] text-slate-400">Peserta Terdaftar</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase">Rata-rata Skor</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">{avgScore.toLocaleString()}</div>
            <p className="text-[11px] text-slate-400">Poin Akumulasi</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase">Rata-rata Akurasi</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{avgAccuracy}%</div>
            <p className="text-[11px] text-slate-400">Tingkat Ketepatan</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Soal Sesi</span>
            <div className="text-2xl sm:text-3xl font-black text-cyan-400">{session.questions.length}</div>
            <p className="text-[11px] text-slate-400">{session.mode.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Competency Breakdown Analysis */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            Analisis Kompetensi Peserta (Competency Gap Analysis)
          </h2>
          <p className="text-xs text-slate-400">
            Persentase keberhasilan per area materi sesuai kerangka 10 Kategori QAIP & GIAS 2024
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {competencyBreakdown.map((c: CompetencyScore, idx: number) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{c.category}</span>
                  <span className="font-extrabold text-white">{c.accuracy}% ({c.correct_count}/{c.total_questions})</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      c.accuracy >= 75 ? 'bg-emerald-500' : c.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${c.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Question Difficulty Index Table */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <h2 className="text-lg font-black text-white">Analitik Butir Soal (Difficulty Index & Distribusi Jawaban)</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                  <th className="pb-3 px-2">No</th>
                  <th className="pb-3 px-2">Kode</th>
                  <th className="pb-3 px-2">Pertanyaan</th>
                  <th className="pb-3 px-2">Kunci</th>
                  <th className="pb-3 px-2">Akurasi</th>
                  <th className="pb-3 px-2">Distribusi (A/B/C/D)</th>
                  <th className="pb-3 px-2">Evaluasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {questionStats.map((qs: any) => (
                  <tr key={qs.question_number} className="hover:bg-slate-800/30">
                    <td className="py-3 px-2 font-bold text-slate-400">{qs.question_number}</td>
                    <td className="py-3 px-2 font-mono text-blue-400">{qs.question_code}</td>
                    <td className="py-3 px-2 max-w-xs truncate text-slate-200">{qs.question_text}</td>
                    <td className="py-3 px-2 font-extrabold text-emerald-400">{qs.correct_answer}</td>
                    <td className="py-3 px-2 font-bold text-white">{qs.success_rate}%</td>
                    <td className="py-3 px-2 text-slate-400 text-xs">
                      A: {qs.distribution.A} | B: {qs.distribution.B} | C: {qs.distribution.C} | D: {qs.distribution.D}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        qs.difficulty_tag === 'DIFFICULT QUESTION' ? 'bg-rose-500/20 text-rose-300' :
                        qs.difficulty_tag === 'MODERATE' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {qs.difficulty_tag}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Participant Scorecard Table */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Klasemen & Hasil Nilai Peserta
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                  <th className="pb-3 px-2">Rank</th>
                  <th className="pb-3 px-2">Nama Peserta</th>
                  <th className="pb-3 px-2">Perusahaan & Unit</th>
                  <th className="pb-3 px-2">Skor Total</th>
                  <th className="pb-3 px-2">Akurasi</th>
                  <th className="pb-3 px-2">Benar / Salah</th>
                  <th className="pb-3 px-2 text-right">Sertifikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {participants.map((p: Participant) => {
                  const accuracy = session.questions.length > 0 ? Math.round((p.total_correct / session.questions.length) * 100) : 0;
                  const isPassed = accuracy >= (session.settings.passing_score || 75);

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-2 font-black text-amber-400">#{p.rank}</td>
                      <td className="py-3 px-2 font-extrabold text-white">{p.name}</td>
                      <td className="py-3 px-2 text-slate-400">{p.company} • {p.unit_kerja}</td>
                      <td className="py-3 px-2 font-black text-amber-400">{p.total_score.toLocaleString()} pts</td>
                      <td className="py-3 px-2 font-bold text-emerald-400">{accuracy}%</td>
                      <td className="py-3 px-2 text-slate-300">{p.total_correct} / {p.total_wrong}</td>
                      <td className="py-3 px-2 text-right">
                        {isPassed ? (
                          <button
                            onClick={() => setSelectedCertParticipant(p)}
                            className="px-3 py-1 rounded bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-bold transition-all inline-flex items-center gap-1"
                          >
                            <Award className="w-3.5 h-3.5" /> Sertifikat
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500">Below Passing</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Certificate Modal */}
      {selectedCertParticipant && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full text-center space-y-6">
            {/* Certificate Canvas */}
            <div className="p-8 rounded-2xl bg-white text-slate-900 border-4 border-amber-500 shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500 mx-auto flex items-center justify-center text-white font-black text-xl">
                QA
              </div>
              <span className="text-xs font-black tracking-widest text-amber-600 uppercase block">
                CERTIFICATE OF COMPLETION
              </span>
              <h2 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
                {selectedCertParticipant.name}
              </h2>
              <p className="text-xs text-slate-600">
                dari <strong>{selectedCertParticipant.company}</strong> ({selectedCertParticipant.unit_kerja}) telah berhasil menyelesaikan evaluasi:
              </p>
              <h4 className="font-extrabold text-blue-900 text-sm">
                {session.title}
              </h4>
              <p className="text-[11px] text-slate-500">
                Standar GIAS 2024 & Kualifikasi Audit Intern Bank (KEP-72/D.02/2024). Nilai Akurasi: {Math.round((selectedCertParticipant.total_correct / session.questions.length) * 100)}%.
              </p>
              <div className="pt-4 border-t border-slate-200 flex justify-between text-[10px] text-slate-500">
                <span>Tanggal: {new Date().toLocaleDateString('id-ID')}</span>
                <span>Trainer: {session.trainer_name}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Cetak / Unduh PDF
              </button>
              <button
                onClick={() => setSelectedCertParticipant(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
