export interface BodyParams { heightCm: number; weightKg: number; age: number; sex: 'm' | 'f' }

export const SKIN_TONES = ['#f3d2bf', '#e0ac8a', '#c68863', '#9a6646', '#6b4630'];

export type HairStyle = 'buzz' | 'crop' | 'sidepart' | 'afro' | 'ponytail' | 'bob' | 'long' | 'braid';
export const HAIR_STYLES: { value: HairStyle; label: string }[] = [
  { value: 'buzz', label: 'Buzz' }, { value: 'crop', label: 'Crop' }, { value: 'sidepart', label: 'Side part' }, { value: 'afro', label: 'Afro' },
  { value: 'ponytail', label: 'Ponytail' }, { value: 'bob', label: 'Bob' }, { value: 'long', label: 'Long' }, { value: 'braid', label: 'Braid' },
];
export const HAIR_COLORS = [
  { label: 'Black', value: '#17130f' }, { label: 'Dark brown', value: '#2e2119' }, { label: 'Brown', value: '#5a3b26' },
  { label: 'Auburn', value: '#7a3a1f' }, { label: 'Blonde', value: '#b8915a' },
];
export type Outfit = 'compression' | 'tank' | 'tee' | 'leggings' | 'tracksuit';
export const OUTFITS: { value: Outfit; label: string }[] = [
  { value: 'compression', label: 'Compression' }, { value: 'tank', label: 'Tank & shorts' }, { value: 'tee', label: 'Tee & joggers' },
  { value: 'leggings', label: 'Leggings' }, { value: 'tracksuit', label: 'Tracksuit' },
];
export const OUTFIT_COLORS = [
  { label: 'Charcoal', value: '#2a2d35' }, { label: 'Ember', value: '#ff5e1a' }, { label: 'Navy', value: '#22324f' },
  { label: 'Olive', value: '#4b5537' }, { label: 'White', value: '#e6e6e3' },
];

export const defaultHairStyle = (sex: 'm' | 'f'): HairStyle => (sex === 'f' ? 'ponytail' : 'crop');

/** Deurenberg estimate from BMI, age and sex. */
export const bodyFatPct = (bmi: number, age: number, sex: 'm' | 'f') =>
  Math.max(3, Math.min(60, 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'm' ? 1 : 0) - 5.4));

export const bmiColor = (bmi: number) =>
  bmi < 18.5 ? '#29d8ff' : bmi < 25 ? '#9be000' : bmi < 30 ? '#ffc93d' : '#ff5e1a';
