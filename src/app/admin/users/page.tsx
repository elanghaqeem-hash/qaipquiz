'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Plus, ShieldCheck, UserCheck, Key,
  Mail, Calendar, Check, AlertCircle, X
} from 'lucide-react';
import { UserRole } from '@/types/quiz';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('TRAINER');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, role, email })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Gagal menambahkan akun');
      }

      setIsModalOpen(false);
      setUsername('');
      setPassword('');
      setName('');
      setEmail('');
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat akun');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              MANAJEMEN AKUN TRAINER & ADMIN
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Kelola akses trainer dan administrator yang berwenang membuat dan mengontrol quiz
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-4 h-4" /> Tambah Akun Baru
          </button>
        </div>

        {/* Users Table */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold">Total {users.length} Akun Terdaftar</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                  <th className="pb-3 px-2">Nama Pengguna</th>
                  <th className="pb-3 px-2">Username</th>
                  <th className="pb-3 px-2">Role</th>
                  <th className="pb-3 px-2">Email</th>
                  <th className="pb-3 px-2">Dibuat Pada</th>
                  <th className="pb-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-2 font-bold text-white flex items-center gap-2">
                      {u.role === 'SUPER_ADMIN' ? (
                        <ShieldCheck className="w-4 h-4 text-rose-400" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-blue-400" />
                      )}
                      {u.name}
                    </td>
                    <td className="py-3.5 px-2 font-mono text-cyan-400">{u.username}</td>
                    <td className="py-3.5 px-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        u.role === 'SUPER_ADMIN' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-slate-400">{u.email || '-'}</td>
                    <td className="py-3.5 px-2 text-slate-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="py-3.5 px-2">
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Aktif
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateUser} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">Tambah Akun Baru</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nama Lengkap</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Nama Trainer"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="username"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Peran / Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              >
                <option value="TRAINER">TRAINER / FACILITATOR</option>
                <option value="SUPER_ADMIN">SUPER ADMIN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trainer@bank.co.id"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
              >
                Simpan Akun
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
