import fs from 'fs';
import path from 'path';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import seedQuestions from '../../data/seed-questions.json';
import {
  Question,
  QuizSession,
  Participant,
  ParticipantAnswer,
  QuizTemplate,
  UserAccount,
} from '@/types/quiz';

interface DatabaseData {
  questions: Question[];
  sessions: QuizSession[];
  participants: Participant[];
  answers: ParticipantAnswer[];
  templates: QuizTemplate[];
  users: UserAccount[];
}

interface StateEnvelope {
  revision: number;
  data: DatabaseData;
}

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');
let localCachedData: DatabaseData | null = null;
let localRevision = 0;

const defaultTemplates: QuizTemplate[] = [
  {
    template_id: 'tmpl-01',
    title: 'QAIP Certification Pre-Test (20 Soal)',
    description: 'Simulasi asesmen awal pemahaman kerangka GIAS 2024 dan regulasi audit intern perbankan.',
    mode: 'PRE_TEST',
    question_count: 20,
    default_time_limit: 20,
    created_at: new Date().toISOString(),
  },
  {
    template_id: 'tmpl-02',
    title: 'GIAS 2024 Comprehensive Assessment (50 Soal)',
    description: 'Ujian komprehensif mencakup seluruh 10 area kompetensi Audit Intern Bank.',
    mode: 'LIVE_COMPETITION',
    question_count: 50,
    default_time_limit: 25,
    created_at: new Date().toISOString(),
  },
  {
    template_id: 'tmpl-03',
    title: 'Audit Execution & Evidence Challenge (15 Soal)',
    description: 'Fokus pada teknik pembuktian audit, atribut temuan (5C), sampling, dan kertas kerja.',
    mode: 'TEAM_BATTLE',
    question_count: 15,
    category_filter: 'Pelaksanaan Penugasan Audit',
    default_time_limit: 25,
    created_at: new Date().toISOString(),
  },
  {
    template_id: 'tmpl-04',
    title: 'QAIP Post-Test Evaluation (20 Soal)',
    description: 'Evaluasi peningkatan pemahaman setelah sesi training selesai.',
    mode: 'POST_TEST',
    question_count: 20,
    default_time_limit: 20,
    created_at: new Date().toISOString(),
  },
];

function freshSeedQuestions(): Question[] {
  return JSON.parse(JSON.stringify(seedQuestions)) as Question[];
}

function createInitialData(): DatabaseData {
  return {
    questions: freshSeedQuestions(),
    sessions: [],
    participants: [],
    answers: [],
    templates: defaultTemplates.map((template) => ({ ...template })),
    users: [],
  };
}

function normalizeData(input: Partial<DatabaseData> | null | undefined): DatabaseData {
  const initial = createInitialData();
  return {
    questions: Array.isArray(input?.questions) && input!.questions!.length > 0 ? input!.questions! : initial.questions,
    sessions: Array.isArray(input?.sessions) ? input!.sessions! : [],
    participants: Array.isArray(input?.participants) ? input!.participants! : [],
    answers: Array.isArray(input?.answers) ? input!.answers! : [],
    templates: Array.isArray(input?.templates) && input!.templates!.length > 0 ? input!.templates! : initial.templates,
    users: Array.isArray(input?.users) ? input!.users! : [],
  };
}

function loadLocalData(): DatabaseData {
  if (localCachedData) return localCachedData;

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      localCachedData = normalizeData(JSON.parse(raw));
      return localCachedData;
    }
  } catch (error) {
    console.error('Failed to read local db.json, using seed data:', error);
  }

  localCachedData = createInitialData();
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(localCachedData, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to initialize local db.json:', error);
  }
  return localCachedData;
}

function getRemoteStore(): any | null {
  try {
    const context = getCloudflareContext();
    const namespace = (context.env as any)?.QUIZ_STORE;
    if (!namespace) {
      throw new Error(
        'Cloudflare runtime detected but QUIZ_STORE Durable Object binding is missing. ' +
        'Deploy with the repository wrangler.jsonc configuration.'
      );
    }
    const id = namespace.idFromName('qaipquiz-global');
    return namespace.get(id);
  } catch (error: any) {
    const message = String(error?.message || error || '');
    if (message.includes('QUIZ_STORE Durable Object binding is missing')) {
      throw error;
    }
    // Local Next.js development has no Cloudflare request context. In that case
    // we intentionally fall back to the local JSON file only for development.
    return null;
  }
}

async function readState(): Promise<StateEnvelope> {
  const stub = getRemoteStore();
  if (!stub) {
    return { revision: localRevision, data: loadLocalData() };
  }

  const response = await stub.fetch('https://quiz-store/state', { method: 'GET' });
  if (response.status === 404) {
    const initial = createInitialData();
    const initResponse = await stub.fetch('https://quiz-store/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 0, data: initial }),
    });

    if (initResponse.status === 409) {
      return readState();
    }
    if (!initResponse.ok) {
      throw new Error(`Failed to initialize persistent quiz storage (${initResponse.status})`);
    }

    const result = await initResponse.json() as { revision: number };
    return { revision: result.revision, data: initial };
  }

  if (!response.ok) {
    throw new Error(`Failed to load persistent quiz storage (${response.status})`);
  }

  const envelope = await response.json() as StateEnvelope;
  return {
    revision: Number(envelope.revision || 0),
    data: normalizeData(envelope.data),
  };
}

async function commitState(expectedRevision: number, data: DatabaseData): Promise<boolean> {
  const normalized = normalizeData(data);
  const stub = getRemoteStore();

  if (!stub) {
    localCachedData = normalized;
    localRevision = expectedRevision + 1;
    try {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to persist local db.json:', error);
    }
    return true;
  }

  const response = await stub.fetch('https://quiz-store/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision, data: normalized }),
  });

  if (response.status === 409) return false;
  if (!response.ok) {
    throw new Error(`Failed to persist quiz storage (${response.status})`);
  }
  return true;
}

async function mutateDb<T>(mutator: (data: DatabaseData) => T): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { revision, data } = await readState();
    const result = mutator(data);
    if (await commitState(revision, data)) {
      return result;
    }
  }
  throw new Error('Quiz data was updated concurrently. Please retry the operation.');
}

export const db = {
  // Questions
  getQuestions: async (): Promise<Question[]> => {
    return (await readState()).data.questions;
  },

  getQuestionById: async (id: string): Promise<Question | undefined> => {
    return (await readState()).data.questions.find(q => q.question_id === id || q.question_code === id);
  },

  saveQuestion: async (question: Question): Promise<Question> => {
    return mutateDb((data) => {
      const idx = data.questions.findIndex(q => q.question_id === question.question_id);
      const now = new Date().toISOString();
      if (idx >= 0) {
        data.questions[idx] = { ...question, updated_at: now };
      } else {
        data.questions.push({ ...question, created_at: question.created_at || now, updated_at: now });
      }
      return data.questions[idx >= 0 ? idx : data.questions.length - 1];
    });
  },

  deleteQuestion: async (id: string): Promise<boolean> => {
    return mutateDb((data) => {
      const idx = data.questions.findIndex(q => q.question_id === id);
      if (idx < 0) return false;
      data.questions.splice(idx, 1);
      return true;
    });
  },

  // Sessions
  getSessions: async (): Promise<QuizSession[]> => {
    return (await readState()).data.sessions;
  },

  getSessionByRoomCode: async (roomCode: string): Promise<QuizSession | undefined> => {
    return (await readState()).data.sessions.find(s => s.room_code.toUpperCase() === roomCode.toUpperCase());
  },

  getSessionById: async (sessionId: string): Promise<QuizSession | undefined> => {
    return (await readState()).data.sessions.find(s => s.session_id === sessionId);
  },

  saveSession: async (session: QuizSession): Promise<QuizSession> => {
    return mutateDb((data) => {
      const idx = data.sessions.findIndex(s => s.session_id === session.session_id);
      const now = new Date().toISOString();
      if (idx >= 0) {
        data.sessions[idx] = { ...session, updated_at: now };
      } else {
        data.sessions.push({ ...session, created_at: session.created_at || now, updated_at: now });
      }
      return data.sessions[idx >= 0 ? idx : data.sessions.length - 1];
    });
  },

  // Participants
  getParticipants: async (sessionId?: string): Promise<Participant[]> => {
    const participants = (await readState()).data.participants;
    return sessionId ? participants.filter(p => p.session_id === sessionId) : participants;
  },

  getParticipantById: async (id: string): Promise<Participant | undefined> => {
    return (await readState()).data.participants.find(p => p.id === id);
  },

  saveParticipant: async (participant: Participant): Promise<Participant> => {
    return mutateDb((data) => {
      const idx = data.participants.findIndex(p => p.id === participant.id);
      if (idx >= 0) data.participants[idx] = { ...participant };
      else data.participants.push({ ...participant });
      return data.participants[idx >= 0 ? idx : data.participants.length - 1];
    });
  },

  // Answers
  getAnswers: async (sessionId?: string, participantId?: string): Promise<ParticipantAnswer[]> => {
    let answers = (await readState()).data.answers;
    if (sessionId) answers = answers.filter(a => a.session_id === sessionId);
    if (participantId) answers = answers.filter(a => a.participant_id === participantId);
    return answers;
  },

  saveAnswer: async (answer: ParticipantAnswer): Promise<ParticipantAnswer> => {
    return mutateDb((data) => {
      const idx = data.answers.findIndex(a =>
        a.session_id === answer.session_id &&
        a.participant_id === answer.participant_id &&
        a.question_id === answer.question_id
      );
      if (idx >= 0) data.answers[idx] = { ...answer };
      else data.answers.push({ ...answer });
      return data.answers[idx >= 0 ? idx : data.answers.length - 1];
    });
  },

  // Templates
  getTemplates: async (): Promise<QuizTemplate[]> => {
    return (await readState()).data.templates;
  },

  // Users
  getUsers: async (): Promise<UserAccount[]> => {
    return (await readState()).data.users;
  },

  getUserByUsername: async (username: string): Promise<UserAccount | undefined> => {
    const clean = username.trim().toLowerCase();
    return (await readState()).data.users.find(user => user.username.toLowerCase() === clean);
  },

  saveUser: async (user: UserAccount): Promise<UserAccount> => {
    return mutateDb((data) => {
      const idx = data.users.findIndex(item => item.id === user.id);
      if (idx >= 0) data.users[idx] = { ...user };
      else data.users.push({ ...user });
      return data.users[idx >= 0 ? idx : data.users.length - 1];
    });
  },

  resetToSeed: async (): Promise<void> => {
    await mutateDb((data) => {
      const fresh = createInitialData();
      data.questions = fresh.questions;
      data.sessions = [];
      data.participants = [];
      data.answers = [];
      data.templates = fresh.templates;
      // Preserve users when resetting quiz content.
    });
  },
};
