'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  AlertCircle, ArrowDown, ArrowUp, Award, BarChart3, BookOpen,
  CheckCircle2, Flame, Minus, RefreshCw, ShieldCheck, Sparkles,
  Trophy, Volume2, VolumeX, XCircle
} from 'lucide-react';
import { soundEngine } from '@/lib/sound';
import { Participant, ParticipantAnswer, Question, QuizSession } from '@/types/quiz';

export default function PlayRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = String(params.roomCode || '').toUpperCase();

  const [participantId, setParticipantId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [lastAnswer, setLastAnswer] = useState<ParticipantAnswer | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [recentJoiner, setRecentJoiner] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealSoundKeyRef = useRef('');

  const redirectToJoin = () => {
    localStorage.removeItem('tqa_player_id');
    localStorage.removeItem('tqa_player_name');
    localStorage.removeItem('tqa_player_company');
    localStorage.removeItem('tqa_player_unit');
    router.replace(`/join?code=${encodeURIComponent(roomCode)}`);
  };

  useEffect(() => {
    const id = localStorage.getItem('tqa_player_id');
    const name = localStorage.getItem('tqa_player_name');
    const savedRoom = localStorage.getItem('tqa_room_code');

    if (!id || !name || (savedRoom && savedRoom.toUpperCase() !== roomCode)) {
      redirectToJoin();
      return;
    }

    setParticipantId(id);
    setParticipantName(name);
  }, [roomCode]);

  const applyPersonalAnswer = (answer: ParticipantAnswer | null | undefined, questionIndex?: number) => {
    if (!answer) return;
    setLastAnswer(answer);
    if (answer.selected_option) setSelectedOption(answer.selected_option);

    const key = `${answer.id}:${questionIndex ?? answer.question_index}`;
    if (revealSoundKeyRef.current !== key) {
      revealSoundKeyRef.current = key;
      if (answer.is_correct) soundEngine.playCorrect();
      else soundEngine.playWrong();
    }
  };

  const handleRealtimeEvent = (eventType: string, payload: any) => {
    if (!payload) return;

    if (eventType === 'INIT_STATE') {
      setSession(payload.session);
      setParticipants(payload.participants || []);
      if (payload.myAnswer) applyPersonalAnswer(payload.myAnswer, payload.session?.current_question_index);
      return;
    }

    if (eventType === 'PARTICIPANT_JOINED') {
      setParticipants(payload.participants || []);
      if (payload.newParticipant?.name && payload.newParticipant?.id !== participantId) {
        setRecentJoiner(payload.newParticipant.name);
      }
      return;
    }

    if (eventType !== 'STATE_CHANGE') return;

    const newSession: QuizSession = payload.session;
    setSession(newSession);
    if (payload.participants) setParticipants(payload.participants);

    if (['START', 'NEXT_QUESTION', 'SKIP'].includes(payload.action)) {
      setSelectedOption(null);
      setIsLocked(false);
      setLastAnswer(null);
      revealSoundKeyRef.current = '';
      setErrorMessage('');
    }

    if (payload.myAnswer && ['REVEAL_ANSWER', 'SHOW_LEADERBOARD', 'SHOW_PODIUM', 'FINISH', 'SYNC'].includes(payload.action)) {
      applyPersonalAnswer(payload.myAnswer, newSession.current_question_index);
    }

    if (payload.action === 'SHOW_LEADERBOARD') {
      soundEngine.playLeaderboard();
    } else if (payload.action === 'SHOW_PODIUM' || payload.action === 'FINISH') {
      soundEngine.playPodium();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  };

  useEffect(() => {
    if (!roomCode || !participantId) return;

    let cancelled = false;
    const loadSession = async () => {
      try {
        const res = await fetch(`/api/quiz/session?roomCode=${encodeURIComponent(roomCode)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.status === 401) {
          redirectToJoin();
          return;
        }
        if (!res.ok || !data.success) throw new Error(data.error || 'Sesi tidak dapat dimuat');
        if (!cancelled) {
          setSession(data.data.session);
          setParticipants(data.data.participants || []);
        }
      } catch (error: any) {
        if (!cancelled) setErrorMessage(error?.message || 'Gagal menghubungkan ke sesi quiz');
      }
    };

    loadSession();
    return () => { cancelled = true; };
  }, [roomCode, participantId]);

  useEffect(() => {
    if (!roomCode || !participantId) return;

    let eventSource: EventSource | null = null;
    let subscribed = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const verifySession = async () => {
      try {
        const res = await fetch(`/api/quiz/session?roomCode=${encodeURIComponent(roomCode)}`, { cache: 'no-store' });
        if (res.status === 401 && subscribed) redirectToJoin();
      } catch {
        // A transient connectivity failure is handled by EventSource reconnect.
      }
    };

    const connect = () => {
      if (!subscribed) return;
      setConnectionStatus('connecting');
      eventSource = new EventSource(`/api/quiz/events?roomCode=${encodeURIComponent(roomCode)}&clientId=${encodeURIComponent(participantId)}`);

      eventSource.onopen = () => {
        if (!subscribed) return;
        setConnectionStatus('connected');
        setErrorMessage('');
      };

      eventSource.onmessage = event => {
        if (!subscribed) return;
        try {
          const parsed = JSON.parse(event.data);
          handleRealtimeEvent(parsed.event, parsed.payload);
        } catch {
          // Heartbeats are comments and do not reach onmessage; ignore malformed payloads defensively.
        }
      };

      eventSource.onerror = () => {
        if (!subscribed) return;
        setConnectionStatus('disconnected');
        eventSource?.close();
        verifySession();
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      subscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [roomCode, participantId]);

  useEffect(() => {
    if (!participants.length || !participantId) return;
    const mine = participants.find(p => p.id === participantId);
    if (mine) setMyParticipant(mine);
  }, [participants, participantId]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (session?.status === 'QUESTION_ACTIVE' && session.question_ends_at) {
      const updateTimer = () => {
        const diff = Math.max(0, Math.ceil((session.question_ends_at - Date.now()) / 1000));
        setRemainingSeconds(diff);
        if (diff <= 5 && diff > 0) soundEngine.playTick();
        if (diff === 0) setIsLocked(true);
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

  const handleSelectOption = async (opt: 'A' | 'B' | 'C' | 'D') => {
    if (isLocked || session?.status !== 'QUESTION_ACTIVE' || !participantId) return;

    soundEngine.playClick();
    setSelectedOption(opt);
    setIsLocked(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/quiz/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          action: 'SUBMIT_ANSWER',
          answerData: { participantId, selectedOption: opt },
        }),
      });
      const data = await res.json();

      if (res.status === 401) {
        redirectToJoin();
        return;
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Jawaban gagal dikirim');
      }
      // Correctness and score intentionally remain hidden until ANSWER_REVEAL.
    } catch (error: any) {
      const message = error?.message || 'Jawaban gagal dikirim';
      setErrorMessage(message);
      if (!/sudah terkunci/i.test(message)) setIsLocked(false);
    }
  };

  const toggleSound = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const rankedParticipants = useMemo(
    () => [...participants].sort((a, b) => (a.rank || 9999) - (b.rank || 9999)),
    [participants]
  );

  if (!session) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-slate-950 text-white p-4 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-300 font-semibold">Menghubungkan ke sesi quiz {roomCode}...</p>
        {errorMessage && <p className="mt-3 text-sm text-rose-300">{errorMessage}</p>}
      </div>
    );
  }

  const currentQ: Question | undefined = session.questions[session.current_question_index];
  const totalQ = session.questions.length;
  const currentQNum = (session.current_question_index || 0) + 1;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-950 text-white relative">
      <div className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-3 text-xs sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-black text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 shrink-0">
            {roomCode}
          </span>
          <span className="text-slate-300 truncate font-medium">{myParticipant?.name || participantName}</span>
          {myParticipant?.team && (
            <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
              {myParticipant.team.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className={`hidden sm:flex items-center gap-1 text-[10px] font-bold ${connectionStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {connectionStatus === 'connected' ? 'LIVE' : 'RECONNECTING'}
          </div>
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <Trophy className="w-3.5 h-3.5" />
            <span>{myParticipant?.total_score?.toLocaleString() || 0} pts</span>
          </div>
          {myParticipant && myParticipant.streak >= 2 && (
            <div className="hidden sm:flex items-center gap-1 font-bold text-orange-400">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{myParticipant.streak}</span>
            </div>
          )}
          <button onClick={toggleSound} className="p-1 rounded text-slate-400 hover:text-white" title={isMuted ? 'Aktifkan suara' : 'Matikan suara'}>
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-2xl p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-2xl mx-auto">
        {session.status === 'WAITING' && (
          <section className="w-full text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/40">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs font-bold border border-blue-500/20 uppercase tracking-widest">
                Waiting for Trainer to Start
              </span>
              <h1 className="text-2xl sm:text-3xl font-black">{session.title}</h1>
              <p className="text-sm text-slate-400">{session.training_name}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3 font-semibold">
                <span>Peserta Bergabung</span>
                <span className="text-emerald-400 font-extrabold text-sm">{participants.length} Orang</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 max-h-44 overflow-y-auto p-2">
                {participants.map((p, idx) => (
                  <span
                    key={p.id || idx}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${p.id === participantId ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
            {recentJoiner && <p className="text-xs text-slate-500">“{recentJoiner}” baru saja bergabung...</p>}
          </section>
        )}

        {session.status === 'QUESTION_ACTIVE' && currentQ && (
          <section className="w-full flex flex-col h-full justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-extrabold tracking-widest text-slate-400 uppercase">SOAL {currentQNum} / {totalQ}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[60%]">{currentQ.category}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${(currentQNum / totalQ) * 100}%` }} />
              </div>
              <div className="flex justify-center py-2">
                <div className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border-4 font-black transition-all shadow-lg ${remainingSeconds <= 5 ? 'border-rose-500 text-rose-400 animate-pulse bg-rose-950/30' : remainingSeconds <= 10 ? 'border-amber-500 text-amber-400 bg-amber-950/20' : 'border-cyan-500 text-cyan-300 bg-slate-900'}`}>
                  <span className="text-2xl leading-none">{remainingSeconds}</span>
                  <span className="text-[9px] uppercase opacity-70">detik</span>
                </div>
              </div>
              <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
                <p className="text-base sm:text-lg font-bold leading-snug">{currentQ.question_text}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {([
                ['A', currentQ.option_a],
                ['B', currentQ.option_b],
                ['C', currentQ.option_c],
                ['D', currentQ.option_d],
              ] as const).filter(([, text]) => Boolean(text)).map(([opt, text]) => {
                const isSelected = selectedOption === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelectOption(opt)}
                    disabled={isLocked}
                    className={`min-h-[72px] sm:min-h-[86px] p-4 rounded-2xl border-2 text-left flex items-center gap-3.5 transition-all shadow-md ${isSelected ? 'border-cyan-400 bg-cyan-500/20 ring-2 ring-cyan-400/40' : isLocked ? 'opacity-40 border-slate-800 bg-slate-900 cursor-not-allowed' : 'border-slate-700 bg-slate-900 hover:border-blue-400 hover:bg-slate-800'}`}
                  >
                    <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-sm ${isSelected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-white border border-slate-700'}`}>{opt}</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug">{text}</span>
                  </button>
                );
              })}
            </div>

            {isLocked && (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs font-bold text-cyan-400 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>JAWABAN TERKUNCI • Hasil ditampilkan setelah trainer melakukan reveal.</span>
              </div>
            )}
          </section>
        )}

        {session.status === 'ANSWER_REVEAL' && currentQ && (
          <section className="w-full space-y-4 animate-fade-in max-h-[85vh] overflow-y-auto pr-1">
            {lastAnswer ? (
              <div className={`p-4 rounded-2xl border text-center space-y-1 shadow-xl ${lastAnswer.is_correct ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300' : 'bg-rose-950/40 border-rose-500/60 text-rose-300'}`}>
                <div className="flex items-center justify-center gap-2 font-black text-xl sm:text-2xl">
                  {lastAnswer.is_correct ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                  <span>{lastAnswer.is_correct ? 'JAWABAN ANDA BENAR!' : 'BELUM TEPAT'}</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-bold text-slate-300 pt-1">
                  <span>+{lastAnswer.score.toLocaleString()} PTS</span>
                  <span>•</span>
                  <span>Waktu {(lastAnswer.response_time_ms / 1000).toFixed(1)}s</span>
                  {lastAnswer.streak_bonus > 0 && <span className="text-orange-400 flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> +{lastAnswer.streak_bonus} Streak</span>}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-slate-700 bg-slate-900 text-center text-slate-300 text-sm">
                Tidak ada jawaban tercatat untuk soal ini.
              </div>
            )}

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Review Pilihan Jawaban</span>
              {(['A', 'B', 'C', 'D'] as const).map(opt => {
                const optText = currentQ[`option_${opt.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
                if (!optText) return null;
                const isCorrect = currentQ.correct_answer === opt;
                const isMyPick = selectedOption === opt;
                return (
                  <div key={opt} className={`p-3 sm:p-4 rounded-xl border-2 flex items-start gap-3 text-xs sm:text-sm ${isCorrect ? 'border-emerald-500 bg-emerald-950/30 text-emerald-100 font-bold' : isMyPick ? 'border-rose-500 bg-rose-950/30 text-rose-200' : 'border-slate-800 bg-slate-900/60 text-slate-400'}`}>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${isCorrect ? 'bg-emerald-500 text-slate-950' : isMyPick ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{opt}</span>
                    <span className="flex-1 leading-snug">{optText}</span>
                    <div className="flex flex-col gap-1 shrink-0">
                      {isMyPick && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-600 text-white uppercase">Pilihan Anda</span>}
                      {isCorrect && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950 uppercase">Kunci Benar ✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {session.settings.show_explanation !== false && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                <div className="flex items-center gap-2 text-cyan-400 font-extrabold text-sm"><BookOpen className="w-4 h-4" /> PEMBAHASAN & LEARNING POINT</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Mengapa jawaban tersebut benar?</h4>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{currentQ.explanation}</p>
                </div>
                {currentQ.learning_point && <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200"><span className="font-bold text-blue-300 block mb-0.5">Key Takeaway</span>{currentQ.learning_point}</div>}
                {currentQ.reference && <div className="pt-1 text-[11px] text-slate-400 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Rujukan: {currentQ.reference}</div>}
              </div>
            )}
          </section>
        )}

        {session.status === 'LEADERBOARD' && (
          <section className="w-full space-y-4 animate-fade-in max-h-[85vh] overflow-y-auto pr-1">
            <div className="text-center space-y-1">
              <Trophy className="w-8 h-8 text-amber-400 mx-auto" />
              <h2 className="text-xl sm:text-2xl font-black">PAPAN KLASEMEN SEMENTARA</h2>
              <p className="text-xs text-slate-400">Peringkat setelah Soal {currentQNum}</p>
            </div>
            <div className="space-y-2">
              {rankedParticipants.slice(0, 10).map((p, idx) => {
                const isMe = p.id === participantId;
                const rankChange = p.previous_rank ? p.previous_rank - p.rank : 0;
                return (
                  <div key={p.id} className={`p-3 sm:p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${isMe ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-400/40' : idx === 0 ? 'border-amber-500/60 bg-amber-950/20' : 'border-slate-800 bg-slate-900/80'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-300'}`}>{p.rank || idx + 1}</span>
                      <div className="min-w-0">
                        <span className="font-extrabold text-white block truncate">{p.name} {isMe && '(Anda)'}</span>
                        <span className="text-[11px] text-slate-400">{p.team ? p.team.replace('_', ' ') : 'Peserta'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right shrink-0">
                      {rankChange > 0 ? <span className="text-emerald-400 font-bold flex items-center"><ArrowUp className="w-3.5 h-3.5" />{rankChange}</span> : rankChange < 0 ? <span className="text-rose-400 font-bold flex items-center"><ArrowDown className="w-3.5 h-3.5" />{Math.abs(rankChange)}</span> : <Minus className="w-3.5 h-3.5 text-slate-500" />}
                      <span className="font-black text-amber-400 text-sm">{p.total_score.toLocaleString()} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {(session.status === 'PODIUM' || session.status === 'FINISHED') && (
          <section className="w-full space-y-6 animate-fade-in max-h-[85vh] overflow-y-auto pr-1">
            <div className="text-center space-y-1">
              <Award className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-2xl sm:text-3xl font-black">JUARA TRAINING QUIZ ARENA</h2>
              <p className="text-xs text-slate-400">{session.title}</p>
            </div>

            <div className="flex items-end justify-center gap-2 sm:gap-4 pt-6 pb-4">
              {rankedParticipants[1] && <Podium participant={rankedParticipants[1]} place={2} />}
              {rankedParticipants[0] && <Podium participant={rankedParticipants[0]} place={1} />}
              {rankedParticipants[2] && <Podium participant={rankedParticipants[2]} place={3} />}
            </div>

            {myParticipant && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold">HASIL EVALUASI PRIBADI</h3>
                    <p className="text-xs text-slate-400 truncate">{myParticipant.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block">Peringkat Akhir</span>
                    <span className="text-lg font-black text-cyan-400">#{myParticipant.rank} / {participants.length}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <Metric label="Total Skor" value={myParticipant.total_score.toLocaleString()} tone="text-amber-400" />
                  <Metric label="Akurasi" value={`${totalQ > 0 ? Math.round((myParticipant.total_correct / totalQ) * 100) : 0}%`} tone="text-emerald-400" />
                  <Metric label="Benar / Salah" value={`${myParticipant.total_correct} / ${myParticipant.total_wrong}`} tone="text-white" />
                  <Metric label="Max Streak" value={`${myParticipant.max_streak} 🔥`} tone="text-orange-400" />
                </div>
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1 text-slate-300">
                  <div className="font-bold text-blue-300 flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> REKOMENDASI PENGEMBANGAN DIRI</div>
                  <p>Tinjau kembali soal yang belum tepat dan gunakan pembahasan serta learning point sebagai daftar prioritas belajar setelah sesi.</p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-800/80">
      <span className="text-[10px] text-slate-400 block font-medium">{label}</span>
      <span className={`text-base font-black ${tone}`}>{value}</span>
    </div>
  );
}

function Podium({ participant, place }: { participant: Participant; place: 1 | 2 | 3 }) {
  const config = {
    1: { emoji: '🥇', height: 'h-36', box: 'from-amber-600 to-amber-400 border-amber-200 text-slate-950', width: 'max-w-[120px] sm:max-w-[150px]' },
    2: { emoji: '🥈', height: 'h-24', box: 'from-slate-800 to-slate-700 border-slate-300 text-slate-300', width: 'max-w-[100px] sm:max-w-[130px]' },
    3: { emoji: '🥉', height: 'h-16', box: 'from-amber-900 to-amber-800 border-amber-600 text-amber-200', width: 'max-w-[100px] sm:max-w-[130px]' },
  }[place];

  return (
    <div className={`flex flex-col items-center flex-1 ${config.width}`}>
      <span className={place === 1 ? 'text-3xl mb-1' : 'text-xl mb-1'}>{config.emoji}</span>
      <span className={`text-xs font-bold truncate max-w-full ${place === 1 ? 'text-amber-300' : 'text-white'}`}>{participant.name}</span>
      <span className="text-[10px] text-amber-400 font-semibold">{participant.total_score.toLocaleString()} pts</span>
      <div className={`w-full ${config.height} bg-gradient-to-t ${config.box} rounded-t-2xl border-t-2 flex items-center justify-center font-black text-xl mt-2 shadow-lg`}>
        {place}
      </div>
    </div>
  );
}
