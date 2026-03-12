// ============================================================
// Progress Persistence — Learning Streaks & Session History
// Saves learning progress to localStorage for cross-session tracking.
// ============================================================

export interface SessionRecord {
  id: string;
  topic: string;
  date: string; // ISO date string
  conceptsLearned: number;
  breakthroughs: number;
  mastery: number; // 0–100
  exchanges: number;
  durationMs: number;
}

export interface LearnerProfile {
  totalSessions: number;
  totalConcepts: number;
  totalBreakthroughs: number;
  currentStreak: number; // consecutive days with a session
  longestStreak: number;
  lastSessionDate: string; // ISO date
  sessions: SessionRecord[];
  favoriteTopics: string[];
}

const STORAGE_KEY = 'lumi-learner-profile';

/** Load the learner profile from localStorage */
export function loadProfile(): LearnerProfile {
  if (typeof window === 'undefined') return createEmptyProfile();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as LearnerProfile;
    }
  } catch {
    // Corrupted data — start fresh
  }
  return createEmptyProfile();
}

/** Save the learner profile to localStorage */
export function saveProfile(profile: LearnerProfile): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/** Record a completed session and update the profile */
export function recordSession(
  profile: LearnerProfile,
  session: Omit<SessionRecord, 'id' | 'date'>
): LearnerProfile {
  const today = new Date().toISOString().slice(0, 10);
  const record: SessionRecord = {
    ...session,
    id: `session_${Date.now()}`,
    date: today,
  };

  // Calculate streak
  let currentStreak = profile.currentStreak;
  const lastDate = profile.lastSessionDate;

  if (lastDate) {
    const lastDay = new Date(lastDate);
    const todayDay = new Date(today);
    const diffDays = Math.floor((todayDay.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day — streak unchanged
    } else if (diffDays === 1) {
      // Consecutive day — streak continues
      currentStreak += 1;
    } else {
      // Gap — streak resets
      currentStreak = 1;
    }
  } else {
    currentStreak = 1;
  }

  // Update topic frequency
  const topics = [...profile.favoriteTopics];
  if (!topics.includes(session.topic)) {
    topics.push(session.topic);
  }

  const updated: LearnerProfile = {
    totalSessions: profile.totalSessions + 1,
    totalConcepts: profile.totalConcepts + session.conceptsLearned,
    totalBreakthroughs: profile.totalBreakthroughs + session.breakthroughs,
    currentStreak,
    longestStreak: Math.max(profile.longestStreak, currentStreak),
    lastSessionDate: today,
    sessions: [...profile.sessions, record].slice(-50), // Keep last 50 sessions
    favoriteTopics: topics.slice(-20), // Keep last 20 topics
  };

  saveProfile(updated);
  return updated;
}

function createEmptyProfile(): LearnerProfile {
  return {
    totalSessions: 0,
    totalConcepts: 0,
    totalBreakthroughs: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: '',
    sessions: [],
    favoriteTopics: [],
  };
}
