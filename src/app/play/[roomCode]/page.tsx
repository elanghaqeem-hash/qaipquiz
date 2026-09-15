'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { soundEngine } from '@/lib/sound';
import {
  Clock, CheckCircle2, XCircle, Trophy, Flame, Award,
  Volume2, VolumeX, ArrowUp, ArrowDown, Minus, BookOpen,
  Sparkles, ShieldCheck, BarChart3, RefreshCw
} from 'lucide-react';
import { QuizSession, Participant, ParticipantAnswer, Question } from '@/types/quiz';

export default function PlayRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();

  // Participant identity
  const [participantId, setParticipantId] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [participantCompany, setParticipantCompany] = useState<string>('');

  // Game state
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lastAnswer, setLastAnswer] = useState<ParticipantAnswer | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [recentJoiners, setRecentJoiners] = useState<string[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize identity & check room
  useEffect(() => {
    const pId = localStorage.getItem('tqa_player_id');
    const pName = localStorage.getItem('tqa_player_name');
    const pComp = localStorage.getItem('tqa_player_company');

    if (!pId || !pName) {
      router.push(`/join?code=${roomCode}`);
      return;
    }

    setParticipantId(pId);
    setParticipantName(pName);
    setParticipantCompany(pComp || '');
  }, [roomCode, router]);

  // 2. Real-time Event Stream (SSE) & polling fallback
  useEffect(() => {
    if (!roomCode || !participantId) return;

    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    const connectSSE = () => {
      setConnectionStatus('connecting');
      eventSource = new EventSource(`/api/quiz/events?roomCode=${roomCode}&clientId=${participantId}`);

      eventSource.onopen = () => {
        if (!isSubscribed) return;
        setConnectionStatus('connected');
      };

      eventSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const parsed = JSON.parse(event.data);
          handleRealtimeEvent(parsed.event, parsed.payload);
        } catch (e) {
          // ignore heartbeat ping
        }
      };

      eventSource.onerror = () => {
        if (!isSubscribed) return;
        setConnectionStatus('disconnected');
        eventSource?.close();
        // Reconnect after 3s
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
  }, [roomCode, participantId]);

  // Initial fetch
  useEffect(() => {
    if (!roomCode) return;
    fetch(`/api/quiz/session?roomCode=${roomCode}`)
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setSession(res.data.session);
          setParticipants(res.data.participants);
        }
      })
      .catch(console.error);
  }, [roomCode]);

  // Keep myParticipant updated
  useEffect(() => {
    if (!participants.length || !participantId) return;
    const found = participants.find(p => p.id === participantId);
    if (found) {
      setMyParticipant(found);
    }
  }, [participants, participantId]);

  // Handle incoming real-time events
  const handleRealtimeEvent = (eventType: string, payload: any) => {
    if (!payload) return;

    if (eventType === 'INIT_STATE') {
      setSession(payload.session);
      setParticipants(payload.participants || []);
    } else if (eventType === 'PARTICIPANT_JOINED') {
      setParticipants(payload.participants || []);
      if (payload.newParticipant?.name) {
        setRecentJoiners(prev => [payload.newParticipant.name, ...prev.slice(0, 4)]);
      }
    } else if (eventType === 'ANSWER_SUBMITTED') {
      // live counter updated
    } else if (eventType === 'STATE_CHANGE') {
      const newSession: QuizSession = payload.session;
      setSession(newSession);
      if (payload.participants) {
        setParticipants(payload.participants);
      }

      // Reset selection on new question
      if (payload.action === 'START' || payload.action === 'NEXT_QUESTION' || payload.action === 'SKIP') {
        setSelectedOption(null);
        setIsLocked(false);
        setLastAnswer(null);
      }

      // Play audio on state transition
      if (payload.action === 'SHOW_LEADERBOARD') {
        soundEngine.playLeaderboard();
      } else if (payload.action === 'SHOW_PODIUM' || payload.action === 'FINISH') {
        soundEngine.playPodium();
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      }
    }
  };

  // Timer countdown engine
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (session?.status === 'QUESTION_ACTIVE' && session.question_ends_at) {
      const updateTimer = () => {
        const now = Date.now();
        const diffSec = Math.max(0, Math.ceil((session.question_ends_at - now) / 1000));
        setRemainingSeconds(diffSec);

        // Sound tick in last 5 seconds
        if (diffSec <= 5 && diffSec > 0) {
          soundEngine.playTick();
        }

        if (diffSec === 0) {
          setIsLocked(true);
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

  // Submit Answer
  const handleSelectOption = async (opt: 'A' | 'B' | 'C' | 'D') => {
    if (isLocked || session?.status !== 'QUESTION_ACTIVE') return;

    soundEngine.playClick();
    setSelectedOption(opt);
    setIsLocked(true);

    try {
      const res = await fetch('/api/quiz/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          action: 'SUBMIT_ANSWER',
          answerData: {
            participantId,
            selectedOption: opt,
          }
        })
      });

      const data = await res.json();
      if (data.success && data.data) {
        setLastAnswer(data.data.answer);
        setMyParticipant(data.data.participant);
        if (data.data.answer.is_correct) {
          soundEngine.playCorrect();
        } else {
          soundEngine.playWrong();
        }
      }
    } catch (err) {
      console.error('Submit answer error:', err);
    }
  };

  const toggleSound = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  if (!session) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-300 font-semibold">Menghubungkan ke sesi quiz {roomCode}...</p>
      </div>
    );
  }

  const currentQ: Question | undefined = session.questions[session.current_question_index];
  const totalQ = session.questions.length;
  const currentQNum = (session.current_question_index || 0) + 1;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-950 text-white relative">
      {/* Top Mobile Bar */}
      <div className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
            {roomCode}
          </span>
          <span className="text-slate-400 truncate max-w-[120px] sm:max-w-[200px] font-medium">
            {myParticipant?.name || participantName}
          </span>
          {myParticipant?.team && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
              {myParticipant.team.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <Trophy className="w-3.5 h-3.5" />
            <span>{myParticipant?.total_score?.toLocaleString() || 0} pts</span>
          </div>

          {myParticipant && myParticipant.streak >= 2 && (
            <div className="flex items-center gap-1 font-bold text-orange-400">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{myParticipant.streak}</span>
            </div>
          )}

          <button
            onClick={toggleSound}
            className="p-1 rounded text-slate-400 hover:text-white"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Screen Router based on session.status */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-2xl mx-auto">
        
        {/* SCREEN 1: WAITING ROOM */}
        {session.status === 'WAITING' && (
          <div className="w-full text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/40 animate-pulse-subtle">
              <Sparkles className="w-10 h-10 text-white" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs font-bold border border-blue-500/20 uppercase tracking-widest">
                Waiting for Trainer to Start
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{session.title}</h1>
              <p className="text-sm text-slate-400">{session.training_name}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3 font-semibold">
                <span>Peserta Bergabung:</span>
                <span className="text-emerald-400 font-extrabold text-sm">{participants.length} Orang</span>
              </div>

              {/* Dynamic Avatars Bubble Stream */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-h-40 overflow-y-auto p-2">
                {participants.map((p, idx) => (
                  <span
                    key={p.id || idx}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm transition-all ${
                      p.id === participantId
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>

            {recentJoiners.length > 0 && (
              <p className="text-xs text-slate-500 animate-pulse">
                &ldquo;{recentJoiners[0]}&rdquo; baru saja bergabung...
              </p>
            )}
          </div>
        )}

        {/* SCREEN 2: ACTIVE QUESTION */}
        {session.status === 'QUESTION_ACTIVE' && currentQ && (
          <div className="w-full flex flex-col h-full justify-between space-y-4">
            {/* Question Header & Circular Timer */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold tracking-widest text-slate-400 uppercase">
                  SOAL {currentQNum} / {totalQ}
                </span>

                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {currentQ.category}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${(currentQNum / totalQ) * 100}%` }}
                />
              </div>

              {/* Timer Display */}
              <div className="flex justify-center py-2">
                <div
                  className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border-4 font-black transition-all shadow-lg ${
                    remainingSeconds <= 5
                      ? 'border-rose-500 text-rose-400 animate-pulse-glow scale-110 bg-rose-950/30'
                      : remainingSeconds <= 10
                      ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                      : 'border-cyan-500 text-cyan-300 bg-slate-900'
                  }`}
                >
                  <span className="text-2xl leading-none">{remainingSeconds}</span>
                  <span className="text-[9px] uppercase tracking-tighter opacity-70">detik</span>
                </div>
              </div>

              {/* Question Text */}
              <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
                <p className="text-base sm:text-lg font-bold text-white leading-snug">
                  {currentQ.question_text}
                </p>
              </div>
            </div>

            {/* Answer Cards A, B, C, D */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { opt: 'A', text: currentQ.option_a, color: 'border-blue-500/50 hover:border-blue-400 bg-blue-950/30' },
                { opt: 'B', text: currentQ.option_b, color: 'border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/30' },
                { opt: 'C', text: currentQ.option_c, textAvailable: !!currentQ.option_c, color: 'border-indigo-500/50 hover:border-indigo-400 bg-indigo-950/30' },
                { opt: 'D', text: currentQ.option_d, textAvailable: !!currentQ.option_d, color: 'border-emerald-500/50 hover:border-emerald-400 bg-emerald-950/30' },
              ].filter(c => c.textAvailable !== false && !!c.text).map((card) => {
                const isSelected = selectedOption === card.opt;
                return (
                  <button
                    key={card.opt}
                    onClick={() => handleSelectOption(card.opt as 'A' | 'B' | 'C' | 'D')}
                    disabled={isLocked}
                    className={`min-h-[70px] sm:min-h-[85px] p-4 rounded-2xl border-2 text-left flex items-center gap-3.5 transition-all touch-card shadow-md ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/20 ring-2 ring-cyan-400/50 scale-[0.99]'
                        : isLocked
                        ? 'opacity-40 border-slate-800 bg-slate-900 cursor-not-allowed'
                        : card.color
                    }`}
                  >
                    <div
                      className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-sm transition-all ${
                        isSelected
                          ? 'bg-cyan-400 text-slate-950 shadow-md'
                          : 'bg-slate-800 text-white border border-slate-700'
                      }`}
                    >
                      {card.opt}
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-100 flex-1 leading-snug">
                      {card.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Answer Locked Status */}
            {isLocked && (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs font-bold text-cyan-400 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>JAWABAN TERKUNCI • Menunggu reveal jawaban dari trainer...</span>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 3: ANSWER REVEAL & LEARNING POINT */}
        {session.status === 'ANSWER_REVEAL' && currentQ && (
          <div className="w-full space-y-4 animate-fade-in max-h-[85vh] overflow-y-auto pr-1">
            {/* Result callout */}
            {lastAnswer && (
              <div
                className={`p-4 rounded-2xl border text-center space-y-1 shadow-xl ${
                  lastAnswer.is_correct
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/60 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2 font-black text-xl sm:text-2xl">
                  {lastAnswer.is_correct ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      <span>JAWABAN ANDA BENAR!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-rose-400" />
                      <span>BELUM TEPAT</span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-300 pt-1">
                  <span>+{lastAnswer.score.toLocaleString()} PTS</span>
                  <span>•</span>
                  <span>Waktu: {(lastAnswer.response_time_ms / 1000).toFixed(1)}s</span>
                  {lastAnswer.streak_bonus > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-orange-400 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> +{lastAnswer.streak_bonus} Streak
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Answer Choices with Highlights */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Review Pilihan Jawaban:
              </span>
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const optText = (currentQ as any)[`option_${opt.toLowerCase()}`];
                if (!optText) return null;
                const isCorrect = currentQ.correct_answer === opt;
                const isMyPick = selectedOption === opt;

                return (
                  <div
                    key={opt}
                    className={`p-3 sm:p-4 rounded-xl border-2 flex items-start gap-3 text-xs sm:text-sm ${
                      isCorrect
                        ? 'border-emerald-500 bg-emerald-950/30 text-emerald-100 font-bold'
                        : isMyPick
                        ? 'border-rose-500 bg-rose-950/30 text-rose-200'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        isCorrect
                          ? 'bg-emerald-500 text-slate-950'
                          : isMyPick
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {opt}
                    </div>

                    <div className="flex-1 leading-snug">
                      <span>{optText}</span>
                    </div>

                    {isMyPick && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-600 text-white uppercase shrink-0">
                        Pilihan Anda
                      </span>
                    )}
                    {isCorrect && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950 uppercase shrink-0">
                        Kunci Benar ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Educational Explanation / Learning Point */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-cyan-400 font-extrabold text-sm">
                <BookOpen className="w-4 h-4" />
                <span>PEMBAHASAN & LEARNING POINT</span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Mengapa Jawaban Tersebut Benar?
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentQ.explanation}
                </p>
              </div>

              {currentQ.learning_point && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                  <span className="font-bold text-blue-300 block mb-0.5">💡 Key Takeaway:</span>
                  {currentQ.learning_point}
                </div>
              )}

              {currentQ.reference && (
                <div className="pt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Rujukan: {currentQ.reference}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 4: LIVE LEADERBOARD */}
        {session.status === 'LEADERBOARD' && (
          <div className="w-full space-y-4 animate-fade-in max-h-[85vh] overflow-y-auto pr-1">
            <div className="text-center space-y-1">
              <Trophy className="w-8 h-8 text-amber-400 mx-auto" />
              <h2 className="text-xl sm:text-2xl font-black text-white">PAPAN KLASEMEN SEMENTARA</h2>
              <p className="text-xs text-slate-400">Peringkat setelah Soal {currentQNum}</p>
            </div>

            <div className="space-y-2">
              {participants.slice(0, 10).map((p, idx) => {
                const isMe = p.id === participantId;
                const rankChange = p.previous_rank ? p.previous_rank - p.rank : 0;

                return (
                  <div
                    key={p.id}
                    className={`p-3 sm:p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm transition-all ${
                      isMe
                        ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-400/40 shadow-lg'
                        : idx === 0
                        ? 'border-amber-500/60 bg-amber-950/20'
                        : 'border-slate-800 bg-slate-900/80'
                    }`}
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
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {idx + 1}
                      </span>

                      <div>
                        <span className="font-extrabold text-white block">{p.name} {isMe && '(Anda)'}</span>
                        <span className="text-[11px] text-slate-400">{p.company} • {p.unit_kerja}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      {rankChange > 0 ? (
                        <span className="text-emerald-400 font-bold text-xs flex items-center gap-0.5">
                          <ArrowUp className="w-3.5 h-3.5" /> {rankChange}
                        </span>
                      ) : rankChange < 0 ? (
                        <span className="text-rose-400 font-bold text-xs flex items-center gap-0.5">
                          <ArrowDown className="w-3.5 h-3.5" /> {Math.abs(rankChange)}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">
                          <Minus className="w-3 h-3" />
                        </span>
                      )}

                      <span className="font-black text-amber-400 text-sm">
                        {p.total_score.toLocaleString()} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SCREEN 5: FINAL PODIUM & REPORT */}
        {(session.status === 'PODIUM' || session.status === 'FINISHED') && (
          <div className="w-full space-y-6 animate-fade-in max-h-[85vh] overflow-y-auto pr-1">
            <div className="text-center space-y-1">
              <Award className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-2xl sm:text-3xl font-black text-white">JUARA TRAINING QUIZ ARENA</h2>
              <p className="text-xs text-slate-400">{session.title}</p>
            </div>

            {/* Podium Visual */}
            <div className="flex items-end justify-center gap-2 sm:gap-4 pt-6 pb-4">
              {/* #2 Silver */}
              {participants[1] && (
                <div className="flex flex-col items-center flex-1 max-w-[100px] sm:max-w-[130px]">
                  <span className="text-xl mb-1">🥈</span>
                  <span className="text-xs font-bold text-white truncate max-w-full">{participants[1].name}</span>
                  <span className="text-[10px] text-amber-400 font-semibold">{participants[1].total_score.toLocaleString()}</span>
                  <div className="w-full h-24 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-2xl border-t-2 border-slate-300 flex items-center justify-center font-black text-slate-300 text-xl mt-2">
                    2
                  </div>
                </div>
              )}

              {/* #1 Champion */}
              {participants[0] && (
                <div className="flex flex-col items-center flex-1 max-w-[120px] sm:max-w-[150px]">
                  <span className="text-3xl mb-1">🥇</span>
                  <span className="text-xs sm:text-sm font-black text-amber-300 truncate max-w-full">{participants[0].name}</span>
                  <span className="text-xs text-amber-400 font-extrabold">{participants[0].total_score.toLocaleString()} pts</span>
                  <div className="w-full h-36 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-2xl border-t-4 border-amber-200 flex items-center justify-center font-black text-slate-950 text-3xl shadow-xl mt-2">
                    1
                  </div>
                </div>
              )}

              {/* #3 Bronze */}
              {participants[2] && (
                <div className="flex flex-col items-center flex-1 max-w-[100px] sm:max-w-[130px]">
                  <span className="text-xl mb-1">🥉</span>
                  <span className="text-xs font-bold text-white truncate max-w-full">{participants[2].name}</span>
                  <span className="text-[10px] text-amber-400 font-semibold">{participants[2].total_score.toLocaleString()}</span>
                  <div className="w-full h-16 bg-gradient-to-t from-amber-900 to-amber-800 rounded-t-2xl border-t-2 border-amber-600 flex items-center justify-center font-black text-amber-200 text-lg mt-2">
                    3
                  </div>
                </div>
              )}
            </div>

            {/* My Personal Scorecard */}
            {myParticipant && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">HASIL EVALUASI PRIBADI</h3>
                    <p className="text-xs text-slate-400">{myParticipant.name} • {myParticipant.company}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Peringkat Akhir</span>
                    <span className="text-lg font-black text-cyan-400">#{myParticipant.rank} / {participants.length}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Total Skor</span>
                    <span className="text-base font-black text-amber-400">{myParticipant.total_score.toLocaleString()}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Akurasi</span>
                    <span className="text-base font-black text-emerald-400">
                      {totalQ > 0 ? Math.round((myParticipant.total_correct / totalQ) * 100) : 0}%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Benar / Salah</span>
                    <span className="text-base font-black text-white">{myParticipant.total_correct} / {myParticipant.total_wrong}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Max Streak</span>
                    <span className="text-base font-black text-orange-400">{myParticipant.max_streak} 🔥</span>
                  </div>
                </div>

                {/* Learning Recommendation */}
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1 text-slate-300">
                  <div className="font-bold text-blue-300 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4" />
                    <span>REKOMENDASI PENGEMBANGAN DIRI</span>
                  </div>
                  <p>
                    Pertahankan pemahaman Anda pada materi regulasi dasar dan tingkatkan pendalaman pada <strong>Pelaksanaan Penugasan Audit (Standard 14 - Bukti & Atribut Temuan 5C)</strong> serta <strong>Case-Based Professional Judgment</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
