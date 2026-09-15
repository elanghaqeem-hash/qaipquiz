export type UserRole = 'SUPER_ADMIN' | 'TRAINER' | 'PARTICIPANT';

export interface UserAccount {
  id: string;
  username: string;
  password_hash: string; // plain for demo/testing or hashed
  name: string;
  role: UserRole;
  email?: string;
  created_at: string;
}
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Case Based';
export type QuestionStatus = 'Draft' | 'Ready' | 'Published' | 'Archived';
export type QuestionType = 'single_choice' | 'multiple_choice';

export interface Question {
  question_id: string;
  question_code: string;
  question_number?: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  learning_point: string;
  reference: string;
  category: string;
  subcategory: string;
  gias_domain: string;
  gias_principle: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  default_time_limit: number;
  status: QuestionStatus;
  usage_count: number;
  success_rate: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export type QuizMode = 'LIVE_COMPETITION' | 'SELF_PACED' | 'PRE_TEST' | 'POST_TEST' | 'TEAM_BATTLE';
export type ScoringMode = 'STANDARD' | 'ACCURACY_PRIORITY' | 'SPEED_CHALLENGE' | 'NO_SPEED_BONUS';
export type SessionStatus = 'WAITING' | 'QUESTION_ACTIVE' | 'ANSWER_REVEAL' | 'LEADERBOARD' | 'PODIUM' | 'FINISHED' | 'PAUSED';
export type TeamId = 'TEAM_ALPHA' | 'TEAM_BRAVO' | 'TEAM_CHARLIE' | 'TEAM_DELTA';

export interface QuizSettings {
  time_per_question: number;
  speed_bonus_enabled: boolean;
  streak_bonus_enabled: boolean;
  scoring_mode: ScoringMode;
  allow_answer_change: boolean;
  suspense_mode: boolean;
  passing_score: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  reveal_duration_seconds: number;
  show_explanation: boolean;
}

export interface QuizSession {
  session_id: string;
  room_code: string;
  title: string;
  training_name: string;
  trainer_name: string;
  description: string;
  mode: QuizMode;
  status: SessionStatus;
  current_question_index: number;
  question_started_at: number;
  question_ends_at: number;
  settings: QuizSettings;
  questions: Question[];
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  session_id: string;
  name: string;
  company: string;
  unit_kerja: string;
  email?: string;
  team?: TeamId;
  avatar_seed: string;
  total_score: number;
  rank: number;
  previous_rank: number;
  streak: number;
  max_streak: number;
  total_correct: number;
  total_wrong: number;
  total_timeout: number;
  total_response_time_ms: number;
  fastest_response_ms: number;
  last_active: number;
  is_connected: boolean;
}

export interface ParticipantAnswer {
  id: string;
  session_id: string;
  participant_id: string;
  question_id: string;
  question_index: number;
  selected_option: 'A' | 'B' | 'C' | 'D' | null;
  is_correct: boolean;
  response_time_ms: number;
  score: number;
  speed_bonus: number;
  streak_bonus: number;
  submitted_at: number;
}

export interface QuizTemplate {
  template_id: string;
  title: string;
  description: string;
  mode: QuizMode;
  question_count: number;
  category_filter?: string;
  difficulty_filter?: string;
  default_time_limit: number;
  created_at: string;
}

export interface CompetencyScore {
  category: string;
  total_questions: number;
  correct_count: number;
  accuracy: number;
}

export interface ParticipantResultSummary {
  participant: Participant;
  accuracy: number;
  average_response_time_sec: number;
  competency_breakdown: CompetencyScore[];
  strongest_area: string;
  development_area: string;
  recommended_review: string;
  passed: boolean;
}

export interface AnswerDistribution {
  A: number;
  B: number;
  C: number;
  D: number;
  timeout: number;
  total: number;
}
