import type { DB, Goal } from './types';
import { DAYS, addDays, dayKey, parseDay } from './utils';

export const stepsOn = (db: DB, userId: string, date: string) =>
  db.sessions.filter((s) => s.userId === userId && s.date === date).reduce((a, s) => a + s.steps, 0);

export const mealsOn = (db: DB, userId: string, date: string) =>
  db.meals.filter((m) => m.userId === userId && m.date === date);

export const caloriesOn = (db: DB, userId: string, date: string) =>
  mealsOn(db, userId, date).reduce((a, m) => a + m.calories, 0);

export const waterOn = (db: DB, userId: string, date: string) => db.water[`${userId}|${date}`] ?? 0;

export const burnedOn = (db: DB, userId: string, date: string) =>
  db.sessions.filter((s) => s.userId === userId && s.date === date).reduce((a, s) => a + s.calories, 0) +
  db.workoutLogs.filter((w) => w.userId === userId && w.date === date).reduce((a, w) => a + w.calories, 0);

/** Last 7 days ending today. */
export const lastWeek = () => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));

export const weekSteps = (db: DB, userId: string) =>
  lastWeek().map((d) => ({ label: DAYS[d.getDay()][0] + DAYS[d.getDay()].slice(1, 2), value: stepsOn(db, userId, dayKey(d)) }));

export const weightsOf = (db: DB, userId: string) =>
  db.weights.filter((w) => w.userId === userId).sort((a, b) => a.date.localeCompare(b.date));

export const latestWeight = (db: DB, userId: string) => {
  const w = weightsOf(db, userId);
  return w.length ? w[w.length - 1].weight : db.goals.find((g) => g.userId === userId)?.startWeight ?? 0;
};

export const goalOf = (db: DB, userId: string) => db.goals.find((g) => g.userId === userId);

export const workoutsThisWeek = (db: DB, userId: string) => {
  const start = dayKey(addDays(new Date(), -6));
  return db.workoutLogs.filter((w) => w.userId === userId && w.date >= start).length;
};

export const goalProgress = (g: Goal, current: number) => {
  const total = g.targetWeight - g.startWeight;
  if (total === 0) return 1;
  return Math.max(0, Math.min(1, (current - g.startWeight) / total));
};

export const streak = (db: DB, userId: string) => {
  const active = new Set([
    ...db.sessions.filter((s) => s.userId === userId).map((s) => s.date),
    ...db.workoutLogs.filter((w) => w.userId === userId).map((w) => w.date),
    ...db.checkins.filter((c) => c.userId === userId).map((c) => dayKey(new Date(c.at))),
  ]);
  let n = 0;
  let d = new Date();
  if (!active.has(dayKey(d))) d = addDays(d, -1); // today not yet active doesn't break the streak
  while (active.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
};

export const defaultGoal = (userId: string, weight = 65, heightCm = 165): Goal => ({
  userId, type: 'maintain', heightCm, startWeight: weight, targetWeight: weight,
  targetDate: dayKey(addDays(new Date(), 60)), dailyCalories: 2000, dailySteps: 8000, dailyWater: 8, weeklyWorkouts: 3, protein: 100,
});

export const shortDate = (key: string) => {
  const d = parseDay(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
