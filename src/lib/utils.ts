import type { User } from './types';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const dayKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const daysBetween = (from: string, to: string) =>
  Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000);

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmtDate = (key: string) => {
  const d = parseDay(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export const fmtPace = (sec: number, km: number) => {
  if (km < 0.01) return '--';
  const p = sec / km;
  return `${Math.floor(p / 60)}'${String(Math.round(p % 60)).padStart(2, '0')}"`;
};

export const relTime = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(dayKey(new Date(iso)));
};

export const money = (n: number, cur = '₱') => `${cur}${n.toLocaleString()}`;

export const initials = (name: string) =>
  name.replace(/^Coach\s+/i, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export const isPremium = (u?: User | null) =>
  !!u && u.role === 'member' && u.plan === 'monthly' && !!u.subscriptionEnd && u.subscriptionEnd >= dayKey();

export const daysLeft = (u: User) => (u.subscriptionEnd ? daysBetween(dayKey(), u.subscriptionEnd) : 0);

export const memberStatus = (u: User): 'premium' | 'expired' | 'basic' =>
  isPremium(u) ? 'premium' : u.plan === 'monthly' ? 'expired' : 'basic';

export const bmi = (kg: number, cm: number) => (cm > 0 ? kg / (cm / 100) ** 2 : 0);
export const bmiLabel = (b: number) =>
  b < 18.5 ? { label: 'Underweight', tone: 'blue' } :
  b < 25 ? { label: 'Healthy', tone: 'green' } :
  b < 30 ? { label: 'Overweight', tone: 'yellow' } : { label: 'Obese', tone: 'red' };

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export const PALETTE = ['#ff5e1a', '#29d8ff', '#b26bff', '#8fd400', '#4b7bff', '#ffc93d', '#ff4d6d', '#ff5fd2'];

/** Each metric owns one neon colour, used for its rings, dots and bars. */
export const METRIC: Record<'steps' | 'kcal' | 'water' | 'weight' | 'gold', [string, string]> = {
  steps: ['#ffa05a', '#ff5e1a'],
  kcal: ['#e4ff8a', '#9be000'],
  water: ['#8ff3ff', '#12b5e0'],
  weight: ['#d6a8ff', '#9b4dff'],
  gold: ['#ffe08a', '#ffb400'],
};
export const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];

// MET-based estimate
export const activityCalories = (type: 'walk' | 'run', durationSec: number, weightKg = 65) =>
  Math.round((type === 'run' ? 9.8 : 3.5) * weightKg * (durationSec / 3600));
