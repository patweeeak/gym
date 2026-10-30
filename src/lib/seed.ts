import type { DB, User, Meal } from './types';
import { addDays, dayKey, uid } from './utils';

/** Demo data: one gym with an owner, two coaches and six members with a few weeks of history. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seed(): DB {
  const rand = rng(42);
  const now = new Date();
  const today = dayKey(now);
  const iso = (d: Date) => d.toISOString();
  const ago = (n: number) => addDays(now, -n);

  const users: User[] = [
    { id: 'u-admin', role: 'admin', name: 'Rico Dela Cruz', email: 'owner@gym.com', password: 'admin123', color: '#ff6a3d', createdAt: iso(ago(420)), phone: '0917 555 0101' },
    { id: 'u-coach1', role: 'instructor', name: 'Coach Bea Santos', email: 'coach@gym.com', password: 'coach123', color: '#4b7bff', createdAt: iso(ago(300)), specialty: 'Strength & Conditioning', phone: '0917 555 0102' },
    { id: 'u-coach2', role: 'instructor', name: 'Coach Marco Reyes', email: 'marco@gym.com', password: 'coach123', color: '#8a5cff', createdAt: iso(ago(200)), specialty: 'HIIT & Cardio', phone: '0917 555 0103' },
    { id: 'u-maria', role: 'member', name: 'Maria Lopez', email: 'maria@gym.com', password: 'member123', color: '#22b07d', createdAt: iso(ago(120)), plan: 'monthly', subscriptionEnd: dayKey(addDays(now, 18)), instructorId: 'u-coach1', phone: '0918 222 1111' },
    { id: 'u-juan', role: 'member', name: 'Juan Navarro', email: 'juan@gym.com', password: 'member123', color: '#14a9c9', createdAt: iso(ago(40)), plan: 'basic' },
    { id: 'u-ana', role: 'member', name: 'Ana Villanueva', email: 'ana@gym.com', password: 'member123', color: '#e05dbb', createdAt: iso(ago(90)), plan: 'monthly', subscriptionEnd: dayKey(addDays(now, 4)), instructorId: 'u-coach1' },
    { id: 'u-leo', role: 'member', name: 'Leo Garcia', email: 'leo@gym.com', password: 'member123', color: '#f2a900', createdAt: iso(ago(150)), plan: 'monthly', subscriptionEnd: dayKey(addDays(now, 25)), instructorId: 'u-coach2' },
    { id: 'u-kat', role: 'member', name: 'Kat Ramos', email: 'kat@gym.com', password: 'member123', color: '#ec4757', createdAt: iso(ago(15)), plan: 'basic' },
    { id: 'u-paolo', role: 'member', name: 'Paolo Mendoza', email: 'paolo@gym.com', password: 'member123', color: '#4b7bff', createdAt: iso(ago(200)), plan: 'monthly', subscriptionEnd: dayKey(ago(3)), instructorId: 'u-coach2' },
  ];

  const goals = [
    { userId: 'u-maria', type: 'lose' as const, heightCm: 162, startWeight: 72, targetWeight: 64, targetDate: dayKey(addDays(now, 60)), dailyCalories: 1750, dailySteps: 9000, dailyWater: 8, weeklyWorkouts: 4, protein: 110, note: 'Fit into my old jeans by summer!' },
    { userId: 'u-ana', type: 'tone' as const, heightCm: 158, startWeight: 55, targetWeight: 53, targetDate: dayKey(addDays(now, 45)), dailyCalories: 1800, dailySteps: 8000, dailyWater: 8, weeklyWorkouts: 3, protein: 95 },
    { userId: 'u-leo', type: 'gain' as const, heightCm: 175, startWeight: 64, targetWeight: 72, targetDate: dayKey(addDays(now, 120)), dailyCalories: 2900, dailySteps: 7000, dailyWater: 10, weeklyWorkouts: 5, protein: 150 },
  ];

  const weights = [];
  for (let w = 8; w >= 0; w--) {
    weights.push({ id: uid(), userId: 'u-maria', date: dayKey(ago(w * 7)), weight: +(72 - (8 - w) * 0.45 + (rand() - 0.5) * 0.4).toFixed(1) });
    weights.push({ id: uid(), userId: 'u-leo', date: dayKey(ago(w * 7)), weight: +(64 + (8 - w) * 0.4 + (rand() - 0.5) * 0.3).toFixed(1) });
  }

  const sessions = [];
  for (let d = 1; d <= 13; d++) {
    for (const userId of ['u-maria', 'u-ana', 'u-leo']) {
      if (rand() < 0.25) continue;
      const run = rand() < 0.35;
      const steps = Math.round(3500 + rand() * 7000);
      const km = +(steps * (run ? 0.001 : 0.00075)).toFixed(2);
      const dur = Math.round(km * (run ? 360 : 690));
      const start = ago(d); start.setHours(6 + Math.floor(rand() * 12), Math.floor(rand() * 60));
      sessions.push({ id: uid(), userId, date: dayKey(start), startedAt: iso(start), type: run ? 'run' as const : 'walk' as const, steps, distanceKm: km, durationSec: dur, calories: Math.round((run ? 9.8 : 3.5) * 68 * dur / 3600) });
    }
  }
  const morning = new Date(now); morning.setHours(6, 30, 0, 0);
  if (morning < now) sessions.push({ id: uid(), userId: 'u-maria', date: today, startedAt: iso(morning), type: 'walk' as const, steps: 4210, distanceKm: 3.16, durationSec: 2180, calories: 144 });

  const meal = (userId: string, date: string, type: Meal['type'], name: string, calories: number, protein: number, carbs: number, fat: number): Meal =>
    ({ id: uid(), userId, date, type, name, calories, protein, carbs, fat });
  const meals: Meal[] = [
    meal('u-maria', today, 'breakfast', 'Oatmeal with banana', 320, 10, 58, 6),
    meal('u-maria', today, 'breakfast', 'Black coffee', 5, 0, 1, 0),
    meal('u-maria', today, 'lunch', 'Grilled chicken + 1 cup rice', 520, 42, 55, 12),
  ];
  for (let d = 1; d <= 6; d++) {
    const k = dayKey(ago(d));
    meals.push(meal('u-maria', k, 'breakfast', 'Eggs & toast', 350, 20, 30, 15));
    meals.push(meal('u-maria', k, 'lunch', 'Chicken adobo + rice', 610, 35, 60, 22));
    meals.push(meal('u-maria', k, 'dinner', 'Sinigang na isda', 380 + Math.round(rand() * 200), 30, 25, 12));
  }

  const water: Record<string, number> = { [`u-maria|${today}`]: 5 };

  const plans = [
    { id: uid(), memberId: 'u-maria', instructorId: 'u-coach1', title: 'Upper Body Power', day: 1, createdAt: iso(ago(20)), exercises: [
      { name: 'Bench press', sets: 4, reps: '8-10' }, { name: 'Bent-over row', sets: 4, reps: '10' }, { name: 'Shoulder press', sets: 3, reps: '12' }, { name: 'Push-ups', sets: 3, reps: 'AMRAP' } ] },
    { id: uid(), memberId: 'u-maria', instructorId: 'u-coach1', title: 'Leg Day', day: 3, createdAt: iso(ago(20)), exercises: [
      { name: 'Back squat', sets: 4, reps: '8' }, { name: 'Romanian deadlift', sets: 3, reps: '10' }, { name: 'Walking lunges', sets: 3, reps: '12/leg' }, { name: 'Calf raises', sets: 4, reps: '15' } ] },
    { id: uid(), memberId: 'u-maria', instructorId: 'u-coach1', title: 'Core & Cardio Burn', day: 5, createdAt: iso(ago(20)), exercises: [
      { name: 'Rowing machine', sets: 1, reps: '10 min' }, { name: 'Plank', sets: 3, reps: '45s' }, { name: 'Russian twists', sets: 3, reps: '20' }, { name: 'Burpees', sets: 3, reps: '12' } ] },
  ];
  const todays = now.getDay();
  if (![1, 3, 5].includes(todays)) {
    plans.push({ id: uid(), memberId: 'u-maria', instructorId: 'u-coach1', title: 'Active Recovery', day: todays, createdAt: iso(ago(5)), exercises: [
      { name: 'Light jog', sets: 1, reps: '15 min' }, { name: 'Foam rolling', sets: 1, reps: '10 min' }, { name: 'Yoga flow', sets: 1, reps: '15 min' } ] });
  }

  const workoutLogs = [];
  for (let d = 1; d <= 20; d++) {
    if (rand() < 0.45) workoutLogs.push({ id: uid(), userId: 'u-maria', date: dayKey(ago(d)), title: ['Upper Body Power', 'Leg Day', 'Core & Cardio Burn'][d % 3], durationMin: 45 + Math.round(rand() * 20), calories: 300 + Math.round(rand() * 150) });
  }

  const classes = [
    { id: uid(), title: 'Morning HIIT', instructorId: 'u-coach2', day: 1, time: '06:30', durationMin: 45, capacity: 15, attendees: ['u-maria', 'u-leo'], premiumOnly: false, color: '#ff6a3d' },
    { id: uid(), title: 'Strength Lab', instructorId: 'u-coach1', day: 2, time: '18:00', durationMin: 60, capacity: 10, attendees: ['u-maria', 'u-ana'], premiumOnly: true, color: '#4b7bff' },
    { id: uid(), title: 'Zumba Party', instructorId: 'u-coach2', day: 3, time: '17:30', durationMin: 50, capacity: 25, attendees: ['u-juan', 'u-kat'], premiumOnly: false, color: '#e05dbb' },
    { id: uid(), title: 'Core Crusher', instructorId: 'u-coach1', day: 4, time: '07:00', durationMin: 30, capacity: 12, attendees: [], premiumOnly: true, color: '#8a5cff' },
    { id: uid(), title: 'Saturday Bootcamp', instructorId: 'u-coach2', day: 6, time: '08:00', durationMin: 60, capacity: 20, attendees: ['u-leo'], premiumOnly: false, color: '#22b07d' },
    { id: uid(), title: 'Mobility & Stretch', instructorId: 'u-coach1', day: todays, time: '19:00', durationMin: 40, capacity: 15, attendees: ['u-ana'], premiumOnly: false, color: '#14a9c9' },
  ];

  const announcements = [
    { id: uid(), title: 'New squat racks are in! 🏋️', body: 'We added two new power racks in the strength zone. Book a slot at the front desk during peak hours.', createdAt: iso(ago(1)), authorId: 'u-admin' },
    { id: uid(), title: 'Holiday hours', body: 'The gym will open 8AM–5PM on holidays this month. Regular hours resume after.', createdAt: iso(ago(5)), authorId: 'u-admin' },
  ];

  const settings = { gymName: 'IronPulse Gym', monthlyPrice: 1500, dayPassPrice: 100, currency: '₱' };

  const payments = [];
  const premiumIds = ['u-maria', 'u-ana', 'u-leo', 'u-paolo'];
  for (let m = 5; m >= 0; m--) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 3);
    premiumIds.forEach((id, i) => {
      if (m === 0 && id === 'u-paolo') return;
      if (rand() < 0.85 || m === 0) payments.push({ id: uid(), userId: id, amount: settings.monthlyPrice, date: dayKey(addDays(base, i)), kind: 'monthly' as const });
    });
    const passes = 6 + Math.floor(rand() * 14);
    for (let p = 0; p < passes; p++) {
      const d = addDays(base, Math.floor(rand() * 25));
      if (d > now) continue;
      payments.push({ id: uid(), userId: rand() < 0.5 ? 'u-juan' : 'u-kat', amount: settings.dayPassPrice, date: dayKey(d), kind: 'daypass' as const });
    }
  }

  const checkins = [];
  for (let d = 0; d <= 10; d++) {
    for (const u of users.filter((x) => x.role === 'member')) {
      if (rand() < 0.45) continue;
      const t = ago(d); t.setHours(6 + Math.floor(rand() * 14), Math.floor(rand() * 60));
      if (t > now) continue;
      checkins.push({ id: uid(), userId: u.id, at: iso(t), dayPass: u.plan === 'basic' });
    }
  }

  return {
    users, goals, weights, meals, water, sessions, plans, workoutLogs, classes, announcements, checkins, payments,
    requests: [{ id: uid(), userId: 'u-kat', createdAt: iso(ago(1)), status: 'pending' }],
    notes: [{ id: uid(), memberId: 'u-maria', instructorId: 'u-coach1', text: 'Great form on squats this week. Increase load by 2.5kg next session.', createdAt: iso(ago(2)) }],
    settings,
  };
}
