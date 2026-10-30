/* Workout history maths: personal records and per-exercise progress from logged sets. */
import { e1rm, findExercise, logKindOf } from './exercises';
import type { DB, LoggedSet } from './types';

/** Library id for grouping (so "Push-ups" and "Push-up" are one exercise), else the name itself. */
export const exerciseKey = (name: string) => findExercise(name)?.id ?? name.trim().toLowerCase();

export interface PersonalRecord {
  key: string; name: string; kind: 'weight' | 'reps' | 'time';
  /** weight: best set by estimated 1-rep max; reps: most reps in a set; time: longest hold */
  weight?: number; reps?: number; seconds?: number; e1rm?: number; date: string;
}

/** The record a set would count towards, as a single comparable number. */
const scoreOf = (s: LoggedSet, kind: PersonalRecord['kind']) =>
  kind === 'weight' ? (s.weight ? e1rm(s.weight, s.reps) : 0) : kind === 'time' ? s.seconds ?? 0 : s.reps;

/** Personal record per exercise from all of a member's logged workouts. */
export function personalRecords(db: DB, userId: string): PersonalRecord[] {
  const best = new Map<string, PersonalRecord & { score: number }>();
  for (const log of db.workoutLogs) {
    if (log.userId !== userId) continue;
    for (const s of log.sets ?? []) {
      const kind = s.weight ? 'weight' : logKindOf(s.exercise) === 'time' ? 'time' : 'reps';
      const key = exerciseKey(s.exercise), score = scoreOf(s, kind);
      const cur = best.get(key);
      if (score > 0 && (!cur || score > cur.score || (score === cur.score && log.date < cur.date))) {
        best.set(key, {
          key, name: findExercise(s.exercise)?.name ?? s.exercise, kind, date: log.date, score,
          weight: s.weight, reps: s.reps, seconds: s.seconds, e1rm: kind === 'weight' ? Math.round(score * 10) / 10 : undefined,
        });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Sets in a new workout that beat the member's previous best for that exercise. */
export function newRecords(db: DB, userId: string, sets: LoggedSet[]): PersonalRecord[] {
  const before = new Map(personalRecords(db, userId).map((r) => [r.key, r]));
  const won = new Map<string, PersonalRecord & { score: number }>();
  for (const s of sets) {
    const kind = s.weight ? 'weight' : logKindOf(s.exercise) === 'time' ? 'time' : 'reps';
    const key = exerciseKey(s.exercise), score = scoreOf(s, kind);
    const prev = before.get(key), prevScore = prev ? (prev.kind === 'weight' ? prev.e1rm ?? 0 : prev.kind === 'time' ? prev.seconds ?? 0 : prev.reps ?? 0) : 0;
    const already = won.get(key);
    // a first-ever log isn't a "record" worth celebrating unless it's a weighted lift
    if (score > prevScore && (prev || kind === 'weight') && (!already || score > already.score)) {
      won.set(key, { key, name: findExercise(s.exercise)?.name ?? s.exercise, kind, date: '', score, weight: s.weight, reps: s.reps, seconds: s.seconds, e1rm: kind === 'weight' ? Math.round(score * 10) / 10 : undefined });
    }
  }
  return [...won.values()];
}

/** Best estimated 1-rep max (or reps / seconds) per session for one exercise, oldest first. */
export function progressOf(db: DB, userId: string, key: string) {
  const out: { date: string; value: number; kind: PersonalRecord['kind'] }[] = [];
  for (const log of [...db.workoutLogs].filter((l) => l.userId === userId).sort((a, b) => a.date.localeCompare(b.date))) {
    const sets = (log.sets ?? []).filter((s) => exerciseKey(s.exercise) === key);
    if (!sets.length) continue;
    const kind = sets.some((s) => s.weight) ? 'weight' : logKindOf(sets[0].exercise) === 'time' ? 'time' : 'reps';
    out.push({ date: log.date, kind, value: Math.round(Math.max(...sets.map((s) => scoreOf(s, kind))) * 10) / 10 });
  }
  return out;
}

export const describeRecord = (r: Pick<PersonalRecord, 'kind' | 'weight' | 'reps' | 'seconds'>) =>
  r.kind === 'weight' ? `${r.weight} kg × ${r.reps}` : r.kind === 'time' ? `${r.seconds}s` : `${r.reps} reps`;
