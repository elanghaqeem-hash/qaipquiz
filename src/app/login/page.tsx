'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Lock, User, ShieldCheck, UserCheck, LogIn, Sparkles,
  AlertCircle, ArrowRight
} from 'lucide-react';
import { UserRole } from '@/types/quiz';

export default function LoginPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'TRAINER' | 'SUPER_ADMIN'>('TRAINER');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleTabChange = (role: 'TRAINER' | 'SUPER_ADMIN') => {
    setActiveTab(role);
    setErrorMsg('');
    setUsername('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Login gagal, periksa username dan password');
      }

      // Check role authorization
      const userRole: UserRole = data.data.user.role;
      if (activeTab === 'SUPER_ADMIN' && userRole !== 'SUPER_ADMIN') {
        throw new Error('Akun ini tidak memiliki hak akses Super Admin');
      }

      if (userRole === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        router.push('/trainer');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 mx-auto flex items-center justify-center shadow-xl shadow-blue-500/30">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">PORTAL MASUK AKUN</h1>
          <p className="text-xs text-slate-400">
            Pilih portal akses sesuai peran Anda (Trainer atau Super Admin)
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex rounded-2xl bg-slate-950 p-1.5 border border-slate-800">
          <button
            type="button"
            onClick={() => handleTabChange('TRAINER')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'TRAINER'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Trainer / Host
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('SUPER_ADMIN')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'SUPER_ADMIN'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Super Admin
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
                placeholder="Masukkan username"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Masukkan password"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Quick Demo Credentials Info */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 text-center">
            Akun Default: <strong className="text-slate-200">{activeTab === 'TRAINER' ? 'trainer / trainer123' : 'admin / admin123'}</strong>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-98 ${
              activeTab === 'TRAINER'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25'
                : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-500/25'
            }`}
          >
            {loading ? (
              <span>Memverifikasi...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                MASUK KE PORTAL {activeTab.replace('_', ' ')}
              </>
            )}
          </button>
        </form>

        {/* Participant Info Banner */}
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center space-y-1">
          <p className="text-xs text-blue-300 font-bold">Apakah Anda Peserta Quiz?</p>
          <p className="text-[11px] text-slate-400">
            Peserta <strong>tidak membutuhkan password</strong>. Cukup masukkan Room Code di halaman Join.
          </p>
          <div className="pt-2">
            <Link
              href="/join"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-cyan-400 hover:text-cyan-300 underline"
            >
              Masuk sebagai Peserta Quiz <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
