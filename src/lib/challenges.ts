/* Gym challenges: progress and leaderboards. */
import { supabase } from './supabase';
import type { Challenge, ChallengeMetric, DB } from './types';
import { dayKey, daysBetween } from './utils';

export const METRICS: { value: ChallengeMetric; label: string; unit: string; hint: string }[] = [
  { value: 'checkins', label: 'Check-ins', unit: 'visits', hint: 'Visits to the gym' },
  { value: 'workouts', label: 'Workouts', unit: 'workouts', hint: 'Logged workouts' },
  { value: 'minutes', label: 'Training minutes', unit: 'min', hint: 'Minutes of logged workouts' },
  { value: 'steps', label: 'Steps', unit: 'steps', hint: 'Steps from the walk/run tracker' },
  { value: 'distance', label: 'Distance', unit: 'km', hint: 'Kilometres walked or run with the tracker' },
];
export const metricOf = (m: ChallengeMetric) => METRICS.find((x) => x.value === m)!;

export const daysLeftLabel = (end: string, today = dayKey()) => {
  const n = daysBetween(today, end);
  return n <= 0 ? 'Last day' : `${n} day${n === 1 ? '' : 's'} left`;
};

export const isLive = (c: Challenge, today = dayKey()) => c.start <= today && today <= c.end;
export const isUpcoming = (c: Challenge, today = dayKey()) => today < c.start;

/** A member's total for a challenge's metric within its dates (from the data this device can see). */
export function progressFor(db: DB, c: Challenge, userId: string) {
  const inRange = (d: string) => c.start <= d && d <= c.end;
  switch (c.metric) {
    case 'checkins': return db.checkins.filter((x) => x.userId === userId && inRange(dayKey(new Date(x.at)))).length;
    case 'workouts': return db.workoutLogs.filter((x) => x.userId === userId && inRange(x.date)).length;
    case 'minutes': return db.workoutLogs.filter((x) => x.userId === userId && inRange(x.date)).reduce((s, x) => s + x.durationMin, 0);
    case 'steps': return db.sessions.filter((x) => x.userId === userId && inRange(x.date)).reduce((s, x) => s + x.steps, 0);
    case 'distance': return Math.round(db.sessions.filter((x) => x.userId === userId && inRange(x.date)).reduce((s, x) => s + x.distanceKm, 0) * 10) / 10;
  }
}

export interface Standing { userId: string; name: string; color: string; value: number }

const shortName = (n: string) => { const [f, l] = n.split(' '); return l ? `${f} ${l[0]}.` : f; };

/**
 * The leaderboard. Online, members can't read each other's records, so the database computes it
 * (challenge_leaderboard, which reveals only first name + last initial). Offline it's computed here.
 */
export async function leaderboard(db: DB, c: Challenge): Promise<Standing[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('challenge_leaderboard', { challenge: c.id });
    if (error) throw new Error(error.message);
    return (data as { user_id: string; name: string; color: string; value: number }[])
      .map((r) => ({ userId: r.user_id, name: r.name, color: r.color, value: Number(r.value) }));
  }
  return db.entries.filter((e) => e.challengeId === c.id)
    .map((e) => { const u = db.users.find((x) => x.id === e.userId); return { userId: e.userId, name: shortName(u?.name ?? 'Member'), color: u?.color ?? '#888', value: progressFor(db, c, e.userId) }; })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export const fmtValue = (v: number, m: ChallengeMetric) => `${m === 'distance' ? v.toFixed(1) : Math.round(v).toLocaleString()} ${metricOf(m).unit}`;
