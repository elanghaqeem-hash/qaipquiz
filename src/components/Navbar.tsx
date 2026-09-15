'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users, BookOpen, Trophy, Plus, LogOut, ShieldCheck,
  UserCheck, Sliders, Play, LogIn, ChevronDown
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/play/')) {
      return;
    }

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(res => {
        if (res.success && res.authenticated) {
          setUser(res.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
    } catch (e) {
      console.error(e);
    }
  };

  // If in participant play screen, HIDE ALL NAVBAR for full-screen distraction-free mobile UX!
  if (pathname?.startsWith('/play/')) {
    return null;
  }

  const isAdminSection = pathname?.startsWith('/admin');
  const isTrainerSection = pathname?.startsWith('/trainer') || pathname?.startsWith('/host');

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/95 backdrop-blur-md text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
            QA
          </div>
          <div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">
              TRAINING QUIZ ARENA
            </span>
            {isAdminSection ? (
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30 uppercase">
                Super Admin
              </span>
            ) : isTrainerSection ? (
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase">
                Trainer Portal
              </span>
            ) : (
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                QAIP & GIAS 2024
              </span>
            )}
          </div>
        </Link>

        {/* Dynamic Navigation according to Role */}
        <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-semibold">
          
          {/* 1. SUPER ADMIN MENU */}
          {isAdminSection && (
            <>
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-lg transition-colors ${pathname === '/admin' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Dashboard
              </Link>
              <Link
                href="/admin/questions"
                className={`px-3 py-1.5 rounded-lg transition-colors ${pathname === '/admin/questions' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Bank Soal (50)
              </Link>
              <Link
                href="/admin/users"
                className={`px-3 py-1.5 rounded-lg transition-colors ${pathname === '/admin/users' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Kelola Trainer
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 flex items-center gap-1 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </>
          )}

          {/* 2. TRAINER MENU */}
          {!isAdminSection && isTrainerSection && (
            <>
              <Link
                href="/trainer"
                className={`px-3 py-1.5 rounded-lg transition-colors ${pathname === '/trainer' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Sesi Saya
              </Link>
              <Link
                href="/trainer/quiz/create"
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Buat Quiz Baru
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </>
          )}

          {/* 3. PUBLIC / PARTICIPANT VISITOR MENU */}
          {!isAdminSection && !isTrainerSection && (
            <>
              <Link
                href="/join"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold shadow-md shadow-blue-500/25 flex items-center gap-1.5 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                Join Quiz
              </Link>
              
              <Link
                href="/login"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login Trainer / Admin
              </Link>
            </>
          )}

        </nav>
      </div>
    </header>
  );
}
