import type { HairStyle, Outfit } from './body';

export type Role = 'admin' | 'instructor' | 'member';
export type Plan = 'monthly' | 'basic';

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  password: string; // demo only — a real backend must hash this
  phone?: string;
  color: string;
  createdAt: string;
  // members
  plan?: Plan;
  subscriptionEnd?: string; // YYYY-MM-DD
  instructorId?: string;
  // instructors
  specialty?: string;
}

export type GoalType = 'lose' | 'gain' | 'maintain' | 'tone';

export interface Goal {
  userId: string;
  type: GoalType;
  heightCm: number;
  startWeight: number;
  targetWeight: number;
  targetDate: string;
  dailyCalories: number;
  dailySteps: number;
  dailyWater: number; // glasses
  weeklyWorkouts: number;
  protein: number; // grams
  note?: string;
}

export interface WeightEntry { id: string; userId: string; date: string; weight: number }

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface Meal {
  id: string; userId: string; date: string; type: MealType; name: string;
  calories: number; protein: number; carbs: number; fat: number;
}

export interface ActivitySession {
  id: string; userId: string; date: string; startedAt: string; type: 'walk' | 'run';
  steps: number; distanceKm: number; durationSec: number; calories: number;
  route?: [number, number][];
}

export interface Exercise { name: string; sets: number; reps: string }
export interface WorkoutPlan {
  id: string; memberId: string; instructorId: string; title: string;
  day: number; // 0 = Sunday
  exercises: Exercise[]; createdAt: string;
}
export interface WorkoutLog { id: string; userId: string; date: string; title: string; durationMin: number; calories: number }

export interface GymClass {
  id: string; title: string; instructorId: string; day: number; time: string;
  durationMin: number; capacity: number; attendees: string[]; premiumOnly: boolean; color: string;
}

export interface Announcement { id: string; title: string; body: string; createdAt: string; authorId: string }
export interface CheckIn { id: string; userId: string; at: string; dayPass?: boolean }
export interface Payment { id: string; userId: string; amount: number; date: string; kind: 'monthly' | 'daypass' }
export interface UpgradeRequest { id: string; userId: string; createdAt: string; status: 'pending' | 'approved' | 'declined' }
export interface CoachNote { id: string; memberId: string; instructorId: string; text: string; createdAt: string }

/** A member's Body Lab setup on the Tools page, restored on their next visit. */
export interface BodyLabPrefs {
  heightCm: number; weightKg: number; age: number; sex: 'm' | 'f';
  skinTone: string; hairStyle: HairStyle | null; hairColor: string;
  outfit: Outfit; outfitColor: string; activity: number;
  updatedAt: string;
}

export interface Settings { gymName: string; monthlyPrice: number; dayPassPrice: number; currency: string }

export interface DB {
  users: User[];
  goals: Goal[];
  weights: WeightEntry[];
  meals: Meal[];
  water: Record<string, number>; // `${userId}|${date}` -> glasses
  sessions: ActivitySession[];
  plans: WorkoutPlan[];
  workoutLogs: WorkoutLog[];
  classes: GymClass[];
  announcements: Announcement[];
  checkins: CheckIn[];
  payments: Payment[];
  requests: UpgradeRequest[];
  notes: CoachNote[];
  settings: Settings;
  bodyLab?: Record<string, BodyLabPrefs>; // userId -> prefs (optional: older saved data has none)
}
