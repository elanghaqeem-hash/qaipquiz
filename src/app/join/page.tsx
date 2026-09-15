'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, LogIn, Building2, User, Mail, ShieldAlert, Sparkles } from 'lucide-react';

function JoinQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [roomCode, setRoomCode] = useState(searchParams.get('code') || '');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [unitKerja, setUnitKerja] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Always ensure all fields start completely empty on every load
  useEffect(() => {
    setName('');
    setCompany('');
    setUnitKerja('');
    setEmail('');
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!roomCode.trim()) {
      setError('Kode Room wajib diisi');
      return;
    }
    if (!name.trim()) {
      setError('Nama peserta wajib diisi');
      return;
    }
    if (!company.trim()) {
      setError('Nama Bank / Perusahaan wajib diisi');
      return;
    }
    if (!unitKerja.trim()) {
      setError('Unit Kerja / Divisi wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const code = roomCode.trim().toUpperCase();
      const res = await fetch('/api/quiz/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          action: 'JOIN',
          participantData: {
            name: name.trim(),
            company: company.trim(),
            unit_kerja: unitKerja.trim(),
            email: email.trim() || undefined
          }
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Gagal bergabung dengan quiz');
      }

      // Save credentials for reconnect
      localStorage.setItem('tqa_player_id', data.data.participant.id);
      localStorage.setItem('tqa_player_name', data.data.participant.name);
      localStorage.setItem('tqa_player_company', data.data.participant.company);
      localStorage.setItem('tqa_player_unit', data.data.participant.unit_kerja);
      localStorage.setItem('tqa_room_code', code);

      router.push(`/play/${code}`);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat join');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
            <Users className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">JOIN QUIZ ARENA</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Masukkan data diri untuk memulai sesi training interaktif
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleJoin} autoComplete="off" className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Room Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Contoh: QAIP-4821"
              required
              autoComplete="off"
              className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white font-extrabold tracking-widest text-center uppercase placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Nama Lengkap <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Lengkap Anda"
                required
                autoComplete="off"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Bank / Perusahaan <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Nama Bank / PT"
                  required
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Unit Kerja / Divisi <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={unitKerja}
                onChange={(e) => setUnitKerja(e.target.value)}
                placeholder="SKAI / Audit IT"
                required
                autoComplete="off"
                className="w-full px-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Email (Opsional untuk sertifikat)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@bank.co.id"
                autoComplete="off"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-base rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <span>Memproses...</span>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                MASUK KE WAITING ROOM
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
      <JoinQuizContent />
    </Suspense>
  );
}
