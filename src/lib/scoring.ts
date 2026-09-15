import { QuizSettings } from '@/types/quiz';

export interface ScoreCalculationResult {
  base_score: number;
  speed_bonus: number;
  streak_bonus: number;
  total_score: number;
}

export function calculateQuestionScore(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitSec: number,
  currentStreak: number,
  settings: QuizSettings
): ScoreCalculationResult {
  if (!isCorrect || responseTimeMs >= timeLimitSec * 1000) {
    return {
      base_score: 0,
      speed_bonus: 0,
      streak_bonus: 0,
      total_score: 0,
    };
  }

  const baseScore = 1000;
  let speedBonus = 0;

  if (settings.speed_bonus_enabled && settings.scoring_mode !== 'NO_SPEED_BONUS' && settings.scoring_mode !== 'ACCURACY_PRIORITY') {
    const remainingTimeMs = Math.max(0, timeLimitSec * 1000 - responseTimeMs);
    const fraction = remainingTimeMs / (timeLimitSec * 1000);
    
    if (settings.scoring_mode === 'SPEED_CHALLENGE') {
      speedBonus = Math.round(fraction * 1000);
    } else {
      // STANDARD
      speedBonus = Math.round(fraction * 500);
    }
  }

  let streakBonus = 0;
  if (settings.streak_bonus_enabled && currentStreak >= 3) {
    // 3 streak = +100, 4 streak = +200, max +500
    streakBonus = Math.min(500, (currentStreak - 2) * 100);
  }

  return {
    base_score: baseScore,
    speed_bonus: speedBonus,
    streak_bonus: streakBonus,
    total_score: baseScore + speedBonus + streakBonus,
  };
}

export function getPreTestInterpretation(scorePercentage: number): {
  category: string;
  color: string;
  description: string;
} {
  if (scorePercentage >= 86) {
    return {
      category: 'Sangat Baik',
      color: '#10b981',
      description: 'Pemahaman awal sangat kuat atas kerangka GIAS 2024 dan regulasi perbankan.',
    };
  }
  if (scorePercentage >= 76) {
    return {
      category: 'Baik',
      color: '#06b6d4',
      description: 'Pemahaman baik, membutuhkan penguatan terbatas pada beberapa aspek detail.',
    };
  }
  if (scorePercentage >= 66) {
    return {
      category: 'Cukup',
      color: '#f59e0b',
      description: 'Pemahaman cukup, membutuhkan pendalaman pada kompetensi inti audit intern.',
    };
  }
  if (scorePercentage >= 56) {
    return {
      category: 'Perlu Penguatan',
      color: '#f97316',
      description: 'Terdapat gap kompetensi yang memerlukan penjelasan mendalam dalam materi training.',
    };
  }
  return {
    category: 'Perlu Pembekalan Intensif',
    color: '#ef4444',
    description: 'Memerlukan pembekalan intensif dan review terstruktur terhadap standar profesi.',
  };
}
