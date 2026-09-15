'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { soundEngine } from '@/lib/sound';
import {
  Play, FastForward, CheckCircle, Trophy, Award, Pause,
  Users, Copy, Check, QrCode, ArrowRight, ShieldCheck,
  BarChart2, Volume2, VolumeX, AlertCircle, RefreshCw
} from 'lucide-react';
import { QuizSession, Participant, Question, AnswerDistribution } from '@/types/quiz';

export default function HostRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [answeredCount, setAnsweredCount] = useState<number>(0);
  const [distribution, setDistribution] = useState<AnswerDistribution | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial state
  const loadSession = async () => {
    try {
      const res = await fetch(`/api/quiz/session?roomCode=${roomCode}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSession(data.data.session);
        setParticipants(data.data.participants || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSession();
  }, [roomCode]);

  // Real-time Event Stream (SSE)
  useEffect(() => {
    if (!roomCode) return;
    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    const connectSSE = () => {
      eventSource = new EventSource(`/api/quiz/events?roomCode=${roomCode}&clientId=host-control`);

      eventSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const parsed = JSON.parse(event.data);
          const { event: evt, payload } = parsed;

          if (evt === 'INIT_STATE') {
            setSession(payload.session);
            setParticipants(payload.participants || []);
          } else if (evt === 'PARTICIPANT_JOINED') {
            setParticipants(payload.participants || []);
          } else if (evt === 'ANSWER_SUBMITTED') {
            setAnsweredCount(payload.answeredCount || 0);
          } else if (evt === 'STATE_CHANGE') {
            setSession(payload.session);
            if (payload.participants) setParticipants(payload.participants);
            if (payload.distribution) setDistribution(payload.distribution);

            if (payload.action === 'START' || payload.action === 'NEXT_QUESTION' || payload.action === 'SKIP') {
              setAnsweredCount(0);
              setDistribution(null);
            }
            if (payload.action === 'SHOW_PODIUM' || payload.action === 'FINISH') {
              soundEngine.playPodium();
              confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
            }
          }
        } catch (e) {
          // ignore heartbeat
        }
      };

      eventSource.onerror = () => {
        if (!isSubscribed) return;
        eventSource?.close();
        setTimeout(() => {
          if (isSubscribed) connectSSE();
        }, 3000);
      };
    };

    connectSSE();

    return () => {
      isSubscribed = false;
      if (eventSource) eventSource.close();
    };
  }, [roomCode]);

  // Server-authoritative timer countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (session?.status === 'QUESTION_ACTIVE' && session.question_ends_at) {
      const updateTimer = () => {
        const now = Date.now();
        const diffSec = Math.max(0, Math.ceil((session.question_ends_at - now) / 1000));
        setRemainingSeconds(diffSec);

        if (diffSec <= 5 && diffSec > 0) {
          soundEngine.playTick();
        }
        if (diffSec === 0 && session.status === 'QUESTION_ACTIVE') {
          // Auto reveal or mark ready
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 500);
    } else {
      setRemainingSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.status, session?.question_ends_at]);

  // Host Action Dispatcher
  const handleHostAction = async (action: 'START' | 'NEXT_QUESTION' | 'REVEAL_ANSWER' | 'SHOW_LEADERBOARD' | 'SHOW_PODIUM' | 'FINISH' | 'PAUSE' | 'RESUME' | 'SKIP') => {
    setLoadingAction(action);
    soundEngine.playClick();

    try {
      const res = await fetch('/api/quiz/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          action
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSession(data.data);
      }
    } catch (err) {
      console.error('Host action error:', err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Keyboard Shortcuts (Space, N, R, L, P, S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (session?.status === 'WAITING') handleHostAction('START');
        else if (session?.status === 'QUESTION_ACTIVE') handleHostAction('REVEAL_ANSWER');
        else if (session?.status === 'ANSWER_REVEAL') handleHostAction('SHOW_LEADERBOARD');
        else if (session?.status === 'LEADERBOARD') {
          if (session.current_question_index + 1 < session.questions.length) {
            handleHostAction('NEXT_QUESTION');
          } else {
            handleHostAction('SHOW_PODIUM');
          }
        }
      } else if (e.key === 'n' || e.key === 'N') {
        if (session?.status === 'LEADERBOARD' || session?.status === 'ANSWER_REVEAL') {
          handleHostAction('NEXT_QUESTION');
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (session?.status === 'QUESTION_ACTIVE') handleHostAction('REVEAL_ANSWER');
      } else if (e.key === 'l' || e.key === 'L') {
        handleHostAction('SHOW_LEADERBOARD');
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted(soundEngine.toggleMute());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session]);

  const copyJoinLink = () => {
    const url = `${window.location.origin}/join?code=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-300 font-semibold">Memuat Host Command Center {roomCode}...</p>
      </div>
    );
  }

  const currentQ: Question | undefined = session.questions[session.current_question_index];
  const totalQ = session.questions.length;
  const currentQNum = (session.current_question_index || 0) + 1;
  const isLastQuestion = currentQNum >= totalQ;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white font-sans selection:bg-blue-600 selection:text-white">
      {/* Host Command Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-xl bg-blue-600 text-white font-mono font-black text-sm tracking-wider shadow-md shadow-blue-500/30">
            {roomCode}
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
              {session.title}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {session.mode.replace('_', ' ')}
              </span>
            </h1>
            <p className="text-xs text-slate-400">Trainer: {session.trainer_name}</p>
          </div>
        </div>

        {/* Action & Status Pill */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>{participants.length} Peserta Terhubung</span>
          </div>

          <button
            onClick={copyJoinLink}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            {copiedLink ? 'Tersalin!' : 'Copy Link'}
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title="Tampilkan QR Code"
          >
            <QrCode className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsMuted(soundEngine.toggleMute())}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <Link
            href={`/admin/reports/${session.session_id}`}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold transition-all"
          >
            Analitik & Laporan
          </Link>
        </div>
      </header>

      {/* Main Control Surface */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT 2 COLS: Live Question & Interactive Screen */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          
          {/* STATE 1: WAITING ROOM HOST VIEW */}
          {session.status === 'WAITING' && (
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl flex-1 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-xl shadow-blue-500/30">
                <Users className="w-10 h-10 text-white" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black text-white">SESI QUIZ SIAP DIMULAI</h2>
                <p className="text-sm text-slate-400">Bagikan Room Code kepada peserta di layar proyektor</p>
              </div>

              <div className="p-4 sm:p-6 rounded-2xl bg-slate-950 border-2 border-dashed border-blue-500/40 text-center max-w-md w-full">
                <span className="text-xs font-bold text-blue-400 tracking-widest uppercase block mb-1">ROOM CODE</span>
                <span className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-white block">
                  {roomCode}
                </span>
                <span className="text-xs text-slate-400 mt-2 block">
                  Buka <strong>/join</strong> dan masukkan kode di atas
                </span>
              </div>

              <div className="w-full max-w-lg">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-bold">
                  <span>Peserta Siap ({participants.length}):</span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {participants.length === 0 ? (
                    <span className="text-xs text-slate-500 italic p-2">Menunggu peserta bergabung...</span>
                  ) : (
                    participants.map((p, i) => (
                      <span key={p.id || i} className="px-3 py-1 rounded-full bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {p.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={() => handleHostAction('START')}
                disabled={loadingAction === 'START'}
                className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-500/30 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95"
              >
                <Play className="w-6 h-6 fill-current" />
                MULAI QUIZ SEKARANG (Space)
              </button>
            </div>
          )}

          {/* STATE 2: QUESTION ACTIVE */}
          {session.status === 'QUESTION_ACTIVE' && currentQ && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl flex-1 flex flex-col justify-between">
              {/* Question metadata & Timer */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-black text-blue-400 uppercase tracking-widest block">
                    SOAL {currentQNum} / {totalQ}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {currentQ.category} • {currentQ.difficulty}
                  </span>
                </div>

                {/* Circular Countdown Timer */}
                <div
                  className={`w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center font-black transition-all shadow-xl ${
                    remainingSeconds <= 5
                      ? 'border-rose-500 text-rose-400 bg-rose-950/30 animate-pulse-glow'
                      : remainingSeconds <= 10
                      ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                      : 'border-cyan-400 text-cyan-300 bg-slate-950'
                  }`}
                >
                  <span className="text-2xl leading-none">{remainingSeconds}</span>
                  <span className="text-[9px] uppercase tracking-tighter opacity-70">detik</span>
                </div>
              </div>

              {/* Question Text */}
              <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800">
                <h2 className="text-xl sm:text-2xl font-black text-white leading-relaxed">
                  {currentQ.question_text}
                </h2>
              </div>

              {/* Options Grid (Trainer view: does not highlight correct answer until reveal) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { opt: 'A', text: currentQ.option_a },
                  { opt: 'B', text: currentQ.option_b },
                  { opt: 'C', text: currentQ.option_c },
                  { opt: 'D', text: currentQ.option_d },
                ].filter(o => !!o.text).map((item) => (
                  <div key={item.opt} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-800 font-black text-sm flex items-center justify-center text-slate-300 shrink-0">
                      {item.opt}
                    </span>
                    <span className="text-sm font-semibold text-slate-200 leading-snug">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Real-time Answer Counter */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                  <CheckCircle className="w-5 h-5 text-cyan-400" />
                  <span>Peserta yang sudah menjawab:</span>
                </div>
                <div className="text-lg font-black text-white">
                  <span className="text-cyan-400">{answeredCount}</span> / {participants.length}
                </div>
              </div>
            </div>
          )}

          {/* STATE 3: ANSWER REVEAL WITH LEARNING POINT & DISTRIBUTION */}
          {session.status === 'ANSWER_REVEAL' && currentQ && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                  PEMBAHASAN SOAL {currentQNum}
                </span>
                <span className="text-xs text-slate-400 font-semibold">{currentQ.category}</span>
              </div>

              {/* Question Text */}
              <p className="text-base font-bold text-slate-200">
                {currentQ.question_text}
              </p>

              {/* Options Breakdown with Correct Answer & Distribution */}
              <div className="space-y-2.5">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const optText = (currentQ as any)[`option_${opt.toLowerCase()}`];
                  if (!optText) return null;
                  const isCorrect = currentQ.correct_answer === opt;
                  const count = distribution ? (distribution as any)[opt] || 0 : 0;
                  const percent = participants.length > 0 ? Math.round((count / participants.length) * 100) : 0;

                  return (
                    <div
                      key={opt}
                      className={`p-4 rounded-xl border-2 flex items-center justify-between gap-4 transition-all ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-100'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span
                          className={`w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center shrink-0 ${
                            isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {opt}
                        </span>
                        <span className="text-sm font-semibold leading-snug">{optText}</span>
                      </div>

                      {/* Vote share bar */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 sm:w-32 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isCorrect ? 'bg-emerald-400' : 'bg-blue-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-12 text-right">
                          {percent}% ({count})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Deep Explanation & Reference */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-extrabold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>PENJELASAN RESMI & LEARNING POINT</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentQ.explanation}
                </p>
                {currentQ.learning_point && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                    <strong className="text-blue-300">Poin Kunci: </strong>
                    {currentQ.learning_point}
                  </div>
                )}
                {currentQ.reference && (
                  <p className="text-[11px] text-slate-400">
                    <strong>Rujukan Standar: </strong>{currentQ.reference}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STATE 4: LIVE LEADERBOARD */}
          {session.status === 'LEADERBOARD' && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 shadow-2xl flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  PAPAN KLASEMEN SEMENTARA (Soal {currentQNum} / {totalQ})
                </h2>
                <span className="text-xs text-slate-400">Total {participants.length} Peserta</span>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {participants.slice(0, 10).map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-sm hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-extrabold text-white block">{p.name}</span>
                        <span className="text-xs text-slate-400">{p.company} • {p.unit_kerja}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-amber-400 text-base">{p.total_score.toLocaleString()} pts</span>
                      <span className="text-[11px] text-slate-400 block">{p.total_correct} Benar</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STATE 5: WINNER PODIUM */}
          {(session.status === 'PODIUM' || session.status === 'FINISHED') && (
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl flex-1 flex flex-col justify-center items-center">
              <div className="space-y-1">
                <Award className="w-12 h-12 text-amber-400 mx-auto" />
                <h2 className="text-3xl sm:text-4xl font-black text-white">PODIUM PEMENANG</h2>
                <p className="text-slate-400 text-sm">Selamat kepada seluruh peserta Training Quiz Arena!</p>
              </div>

              {/* Podium */}
              <div className="flex items-end justify-center gap-4 pt-8 pb-4 w-full max-w-md">
                {/* #2 Silver */}
                {participants[1] && (
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-2xl mb-1">🥈</span>
                    <span className="text-sm font-bold text-white truncate max-w-[120px]">{participants[1].name}</span>
                    <span className="text-xs text-amber-400 font-semibold">{participants[1].total_score.toLocaleString()} pts</span>
                    <div className="w-full h-28 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-2xl border-t-2 border-slate-300 flex items-center justify-center font-black text-slate-300 text-2xl mt-2">
                      2
                    </div>
                  </div>
                )}

                {/* #1 Champion */}
                {participants[0] && (
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-4xl mb-1">🥇</span>
                    <span className="text-base font-black text-amber-300 truncate max-w-[140px]">{participants[0].name}</span>
                    <span className="text-sm text-amber-400 font-extrabold">{participants[0].total_score.toLocaleString()} pts</span>
                    <div className="w-full h-40 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-2xl border-t-4 border-amber-200 flex items-center justify-center font-black text-slate-950 text-4xl shadow-2xl mt-2">
                      1
                    </div>
                  </div>
                )}

                {/* #3 Bronze */}
                {participants[2] && (
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-2xl mb-1">🥉</span>
                    <span className="text-sm font-bold text-white truncate max-w-[120px]">{participants[2].name}</span>
                    <span className="text-xs text-amber-400 font-semibold">{participants[2].total_score.toLocaleString()} pts</span>
                    <div className="w-full h-20 bg-gradient-to-t from-amber-900 to-amber-800 rounded-t-2xl border-t-2 border-amber-600 flex items-center justify-center font-black text-amber-200 text-xl mt-2">
                      3
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Link
                  href={`/admin/reports/${session.session_id}`}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 hover:scale-105 transition-all"
                >
                  <BarChart2 className="w-4 h-4" />
                  Lihat Analitik & Export Laporan
                </Link>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COL: Trainer Control Panel & Keyboard Guide */}
        <div className="space-y-4">
          
          {/* Main Action Buttons */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Trainer Controls
            </h3>

            {session.status === 'WAITING' && (
              <button
                onClick={() => handleHostAction('START')}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                START QUIZ (Space)
              </button>
            )}

            {session.status === 'QUESTION_ACTIVE' && (
              <button
                onClick={() => handleHostAction('REVEAL_ANSWER')}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                REVEAL ANSWER (Space / R)
              </button>
            )}

            {session.status === 'ANSWER_REVEAL' && (
              <button
                onClick={() => handleHostAction('SHOW_LEADERBOARD')}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2"
              >
                <Trophy className="w-5 h-5" />
                SHOW LEADERBOARD (Space / L)
              </button>
            )}

            {session.status === 'LEADERBOARD' && (
              <button
                onClick={() => isLastQuestion ? handleHostAction('SHOW_PODIUM') : handleHostAction('NEXT_QUESTION')}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                <FastForward className="w-5 h-5" />
                {isLastQuestion ? 'TAMPILKAN PODIUM JUARA (Space)' : 'NEXT QUESTION (Space / N)'}
              </button>
            )}

            {/* Secondary Controls */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleHostAction('SKIP')}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Skip Soal
              </button>
              <button
                onClick={() => handleHostAction('FINISH')}
                className="py-2 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-xs font-semibold text-rose-300"
              >
                Akhiri Quiz
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts Cheatsheet */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
            <span className="font-bold text-slate-300 block mb-1">Keyboard Shortcuts:</span>
            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-white">Space</kbd> Action Utama</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-white">N</kbd> Next Question</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-white">R</kbd> Reveal Answer</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-white">L</kbd> Leaderboard</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-white">M</kbd> Mute / Unmute</div>
            </div>
          </div>

          {/* Live Participant Quick Roster */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>DAFTAR PESERTA ({participants.length})</span>
              <span className="text-emerald-400">Online</span>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {participants.map((p, i) => (
                <div key={p.id || i} className="p-2 rounded-lg bg-slate-950 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 truncate max-w-[130px]">{p.name}</span>
                  <span className="font-bold text-amber-400">{p.total_score.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4">
            <h3 className="font-black text-xl text-white">SCAN TO JOIN</h3>
            <div className="p-4 bg-white rounded-2xl mx-auto w-48 h-48 flex items-center justify-center shadow-2xl">
              {/* Fallback QR representation */}
              <div className="text-center">
                <QrCode className="w-28 h-28 text-slate-900 mx-auto" />
                <span className="font-mono font-black text-slate-900 text-sm tracking-wider mt-1 block">
                  {roomCode}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Arahkan kamera HP ke kode QR di atas atau masukkan kode <strong>{roomCode}</strong> pada menu join.
            </p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
