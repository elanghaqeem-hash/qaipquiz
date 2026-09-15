import fs from 'fs';
import path from 'path';
import { Question, QuizSession, Participant, ParticipantAnswer, QuizTemplate } from '@/types/quiz';

interface DatabaseData {
  questions: Question[];
  sessions: QuizSession[];
  participants: Participant[];
  answers: ParticipantAnswer[];
  templates: QuizTemplate[];
}

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');
const SEED_FILE = path.join(process.cwd(), 'data', 'seed-questions.json');

// In-memory cache for high performance real-time access
let cachedData: DatabaseData | null = null;

function loadSeedQuestions(): Question[] {
  try {
    if (fs.existsSync(SEED_FILE)) {
      const raw = fs.readFileSync(SEED_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load seed questions:', err);
  }
  return [];
}

const defaultTemplates: QuizTemplate[] = [
  {
    template_id: 'tmpl-01',
    title: 'QAIP Certification Pre-Test (20 Soal)',
    description: 'Simulasi asesmen awal pemahaman kerangka GIAS 2024 dan regulasi audit intern perbankan.',
    mode: 'PRE_TEST',
    question_count: 20,
    default_time_limit: 20,
    created_at: new Date().toISOString()
  },
  {
    template_id: 'tmpl-02',
    title: 'GIAS 2024 Comprehensive Assessment (50 Soal)',
    description: 'Ujian komprehensif mencakup seluruh 10 area kompetensi Audit Intern Bank.',
    mode: 'LIVE_COMPETITION',
    question_count: 50,
    default_time_limit: 25,
    created_at: new Date().toISOString()
  },
  {
    template_id: 'tmpl-03',
    title: 'Audit Execution & Evidence Challenge (15 Soal)',
    description: 'Fokus pada teknik pembuktian audit, atribut temuan (5C), sampling, dan kertas kerja.',
    mode: 'TEAM_BATTLE',
    question_count: 15,
    category_filter: 'Pelaksanaan Penugasan Audit',
    default_time_limit: 25,
    created_at: new Date().toISOString()
  },
  {
    template_id: 'tmpl-04',
    title: 'QAIP Post-Test Evaluation (20 Soal)',
    description: 'Evaluasi peningkatan pemahaman setelah sesi training selesai.',
    mode: 'POST_TEST',
    question_count: 20,
    default_time_limit: 20,
    created_at: new Date().toISOString()
  }
];

function initDatabase(): DatabaseData {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw) as DatabaseData;
      if (!data.questions || data.questions.length === 0) {
        data.questions = loadSeedQuestions();
      }
      if (!data.templates || data.templates.length === 0) {
        data.templates = defaultTemplates;
      }
      return data;
    } catch (err) {
      console.error('Failed to parse db.json, recreating...', err);
    }
  }

  const initial: DatabaseData = {
    questions: loadSeedQuestions(),
    sessions: [],
    participants: [],
    answers: [],
    templates: defaultTemplates,
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }

  return initial;
}

function getDb(): DatabaseData {
  if (!cachedData) {
    cachedData = initDatabase();
  }
  return cachedData;
}

function persistDb(): void {
  if (cachedData) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(cachedData, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist db.json:', err);
    }
  }
}

export const db = {
  // Questions
  getQuestions: (): Question[] => {
    return getDb().questions;
  },

  getQuestionById: (id: string): Question | undefined => {
    return getDb().questions.find(q => q.question_id === id || q.question_code === id);
  },

  saveQuestion: (question: Question): Question => {
    const data = getDb();
    const idx = data.questions.findIndex(q => q.question_id === question.question_id);
    if (idx >= 0) {
      data.questions[idx] = { ...question, updated_at: new Date().toISOString() };
    } else {
      data.questions.push({ ...question, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    persistDb();
    return question;
  },

  deleteQuestion: (id: string): boolean => {
    const data = getDb();
    const idx = data.questions.findIndex(q => q.question_id === id);
    if (idx >= 0) {
      data.questions.splice(idx, 1);
      persistDb();
      return true;
    }
    return false;
  },

  // Sessions
  getSessions: (): QuizSession[] => {
    return getDb().sessions;
  },

  getSessionByRoomCode: (roomCode: string): QuizSession | undefined => {
    return getDb().sessions.find(s => s.room_code.toUpperCase() === roomCode.toUpperCase());
  },

  getSessionById: (sessionId: string): QuizSession | undefined => {
    return getDb().sessions.find(s => s.session_id === sessionId);
  },

  saveSession: (session: QuizSession): QuizSession => {
    const data = getDb();
    const idx = data.sessions.findIndex(s => s.session_id === session.session_id);
    if (idx >= 0) {
      data.sessions[idx] = { ...session, updated_at: new Date().toISOString() };
    } else {
      data.sessions.push({ ...session, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    persistDb();
    return session;
  },

  // Participants
  getParticipants: (sessionId?: string): Participant[] => {
    const data = getDb();
    if (sessionId) {
      return data.participants.filter(p => p.session_id === sessionId);
    }
    return data.participants;
  },

  getParticipantById: (id: string): Participant | undefined => {
    return getDb().participants.find(p => p.id === id);
  },

  saveParticipant: (participant: Participant): Participant => {
    const data = getDb();
    const idx = data.participants.findIndex(p => p.id === participant.id);
    if (idx >= 0) {
      data.participants[idx] = participant;
    } else {
      data.participants.push(participant);
    }
    persistDb();
    return participant;
  },

  // Answers
  getAnswers: (sessionId?: string, participantId?: string): ParticipantAnswer[] => {
    let answers = getDb().answers;
    if (sessionId) {
      answers = answers.filter(a => a.session_id === sessionId);
    }
    if (participantId) {
      answers = answers.filter(a => a.participant_id === participantId);
    }
    return answers;
  },

  saveAnswer: (answer: ParticipantAnswer): ParticipantAnswer => {
    const data = getDb();
    const idx = data.answers.findIndex(a => 
      a.session_id === answer.session_id && 
      a.participant_id === answer.participant_id && 
      a.question_id === answer.question_id
    );
    if (idx >= 0) {
      data.answers[idx] = answer;
    } else {
      data.answers.push(answer);
    }
    persistDb();
    return answer;
  },

  // Templates
  getTemplates: (): QuizTemplate[] => {
    return getDb().templates;
  },

  // Reset database with fresh seed
  resetToSeed: (): void => {
    cachedData = {
      questions: loadSeedQuestions(),
      sessions: [],
      participants: [],
      answers: [],
      templates: defaultTemplates,
    };
    persistDb();
  }
};
