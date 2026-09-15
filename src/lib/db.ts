import fs from 'fs';
import path from 'path';
import { Participant, ParticipantAnswer, Question, QuizSession, QuizTemplate } from '@/types/quiz';

interface DatabaseData {
  questions: Question[];
  sessions: QuizSession[];
  participants: Participant[];
  answers: ParticipantAnswer[];
  templates: QuizTemplate[];
}

const DATA_DIR = process.env.QAIP_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(process.cwd(), 'data', 'seed-questions.json');

let cachedData: DatabaseData | null = null;

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
    description: 'Ujian komprehensif mencakup seluruh area kompetensi Audit Intern Bank.',
    mode: 'LIVE_COMPETITION',
    question_count: 50,
    default_time_limit: 25,
    created_at: new Date().toISOString(),
  },
  {
    template_id: 'tmpl-03',
    title: 'Audit Execution & Evidence Challenge (15 Soal)',
    description: 'Fokus pada teknik pembuktian audit, atribut temuan, sampling, dan kertas kerja.',
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

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSeedQuestions(): Question[] {
  try {
    if (!fs.existsSync(SEED_FILE)) return [];
    const raw = fs.readFileSync(SEED_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load seed questions:', error);
    return [];
  }
}

function normalizeDatabase(value: Partial<DatabaseData>): DatabaseData {
  return {
    questions: Array.isArray(value.questions) && value.questions.length > 0
      ? value.questions
      : loadSeedQuestions(),
    sessions: Array.isArray(value.sessions) ? value.sessions : [],
    participants: Array.isArray(value.participants) ? value.participants : [],
    answers: Array.isArray(value.answers) ? value.answers : [],
    templates: Array.isArray(value.templates) && value.templates.length > 0
      ? value.templates
      : defaultTemplates,
  };
}

function writeDatabase(data: DatabaseData): void {
  ensureDataDir();
  const tempFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempFile, DB_FILE);
}

function initDatabase(): DatabaseData {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return normalizeDatabase(JSON.parse(raw));
    } catch (error) {
      console.error('Failed to parse runtime db.json. Reinitializing from seed:', error);
    }
  }

  const initial = normalizeDatabase({});
  try {
    writeDatabase(initial);
  } catch (error) {
    console.error('Unable to initialize runtime database:', error);
  }
  return initial;
}

function getDb(): DatabaseData {
  if (!cachedData) cachedData = initDatabase();
  return cachedData;
}

function persistDb(): void {
  if (!cachedData) return;
  try {
    writeDatabase(cachedData);
  } catch (error) {
    console.error('Failed to persist runtime database:', error);
    throw new Error('Penyimpanan data quiz gagal. Periksa storage aplikasi.');
  }
}

export const db = {
  getQuestions: (): Question[] => getDb().questions,

  getQuestionById: (id: string): Question | undefined =>
    getDb().questions.find(question => question.question_id === id || question.question_code === id),

  saveQuestion: (question: Question): Question => {
    const data = getDb();
    const index = data.questions.findIndex(item => item.question_id === question.question_id);
    const now = new Date().toISOString();
    const stored = index >= 0
      ? { ...data.questions[index], ...question, updated_at: now }
      : { ...question, created_at: question.created_at || now, updated_at: now };

    if (index >= 0) data.questions[index] = stored;
    else data.questions.push(stored);

    persistDb();
    return stored;
  },

  deleteQuestion: (id: string): boolean => {
    const data = getDb();
    const index = data.questions.findIndex(question => question.question_id === id);
    if (index < 0) return false;
    data.questions.splice(index, 1);
    persistDb();
    return true;
  },

  getSessions: (): QuizSession[] => getDb().sessions,

  getSessionByRoomCode: (roomCode: string): QuizSession | undefined =>
    getDb().sessions.find(session => session.room_code.toUpperCase() === roomCode.toUpperCase()),

  getSessionById: (sessionId: string): QuizSession | undefined =>
    getDb().sessions.find(session => session.session_id === sessionId),

  saveSession: (session: QuizSession): QuizSession => {
    const data = getDb();
    const index = data.sessions.findIndex(item => item.session_id === session.session_id);
    const now = new Date().toISOString();
    const stored = index >= 0
      ? { ...data.sessions[index], ...session, updated_at: now }
      : { ...session, created_at: session.created_at || now, updated_at: now };

    if (index >= 0) data.sessions[index] = stored;
    else data.sessions.push(stored);

    persistDb();
    return stored;
  },

  getParticipants: (sessionId?: string): Participant[] => {
    const participants = getDb().participants;
    return sessionId ? participants.filter(participant => participant.session_id === sessionId) : participants;
  },

  getParticipantById: (id: string): Participant | undefined =>
    getDb().participants.find(participant => participant.id === id),

  saveParticipant: (participant: Participant): Participant => {
    const data = getDb();
    const index = data.participants.findIndex(item => item.id === participant.id);
    if (index >= 0) data.participants[index] = participant;
    else data.participants.push(participant);
    persistDb();
    return participant;
  },

  getAnswers: (sessionId?: string, participantId?: string): ParticipantAnswer[] => {
    let answers = getDb().answers;
    if (sessionId) answers = answers.filter(answer => answer.session_id === sessionId);
    if (participantId) answers = answers.filter(answer => answer.participant_id === participantId);
    return answers;
  },

  saveAnswer: (answer: ParticipantAnswer): ParticipantAnswer => {
    const data = getDb();
    const index = data.answers.findIndex(item =>
      item.session_id === answer.session_id &&
      item.participant_id === answer.participant_id &&
      item.question_id === answer.question_id
    );

    if (index >= 0) data.answers[index] = answer;
    else data.answers.push(answer);
    persistDb();
    return answer;
  },

  getTemplates: (): QuizTemplate[] => getDb().templates,

  resetToSeed: (): void => {
    cachedData = normalizeDatabase({});
    persistDb();
  },
};
