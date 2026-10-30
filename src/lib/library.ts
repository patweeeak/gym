import type { Exercise } from './types';

export interface Routine {
  id: string;
  title: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  minutes: number;
  focus: string;
  color: string;
  free: boolean;
  exercises: Exercise[];
}

export const LIBRARY: Routine[] = [
  { id: 'r1', title: 'Full Body Starter', level: 'Beginner', minutes: 30, focus: 'Full body', color: '#22b07d', free: true, exercises: [
    { name: 'Bodyweight squats', sets: 3, reps: '12' }, { name: 'Knee push-ups', sets: 3, reps: '10' }, { name: 'Glute bridge', sets: 3, reps: '15' }, { name: 'Plank', sets: 3, reps: '30s' } ] },
  { id: 'r2', title: 'Treadmill Intervals', level: 'Beginner', minutes: 20, focus: 'Cardio', color: '#ff6a3d', free: true, exercises: [
    { name: 'Warm-up walk', sets: 1, reps: '3 min' }, { name: 'Jog 1 min / walk 1 min', sets: 6, reps: '2 min' }, { name: 'Cool-down walk', sets: 1, reps: '5 min' } ] },
  { id: 'r3', title: 'Core Basics', level: 'Beginner', minutes: 15, focus: 'Core', color: '#4b7bff', free: true, exercises: [
    { name: 'Dead bug', sets: 3, reps: '10' }, { name: 'Bird dog', sets: 3, reps: '10/side' }, { name: 'Side plank', sets: 2, reps: '20s/side' } ] },
  { id: 'r4', title: 'Push Pull Legs — Push', level: 'Intermediate', minutes: 55, focus: 'Chest, shoulders, triceps', color: '#8a5cff', free: false, exercises: [
    { name: 'Bench press', sets: 4, reps: '8' }, { name: 'Incline DB press', sets: 3, reps: '10' }, { name: 'Lateral raise', sets: 3, reps: '15' }, { name: 'Tricep dips', sets: 3, reps: '12' } ] },
  { id: 'r5', title: 'Fat Burn HIIT', level: 'Intermediate', minutes: 25, focus: 'Conditioning', color: '#ec4757', free: false, exercises: [
    { name: 'Burpees', sets: 4, reps: '40s' }, { name: 'Mountain climbers', sets: 4, reps: '40s' }, { name: 'Jump squats', sets: 4, reps: '40s' }, { name: 'Battle ropes', sets: 4, reps: '40s' } ] },
  { id: 'r6', title: 'Powerbuilding Legs', level: 'Advanced', minutes: 70, focus: 'Legs & glutes', color: '#f2a900', free: false, exercises: [
    { name: 'Back squat', sets: 5, reps: '5' }, { name: 'Bulgarian split squat', sets: 3, reps: '10/leg' }, { name: 'Leg press', sets: 4, reps: '12' }, { name: 'Hamstring curl', sets: 3, reps: '12' } ] },
];

export interface Food { name: string; calories: number; protein: number; carbs: number; fat: number }

export const FOODS: Food[] = [
  { name: '1 cup white rice', calories: 205, protein: 4, carbs: 45, fat: 0 },
  { name: '1 cup brown rice', calories: 215, protein: 5, carbs: 45, fat: 2 },
  { name: 'Chicken breast (150g)', calories: 250, protein: 46, carbs: 0, fat: 5 },
  { name: 'Chicken adobo (1 serving)', calories: 400, protein: 30, carbs: 6, fat: 28 },
  { name: 'Pork sinigang (1 bowl)', calories: 330, protein: 25, carbs: 12, fat: 20 },
  { name: 'Grilled tilapia', calories: 220, protein: 40, carbs: 0, fat: 5 },
  { name: '2 boiled eggs', calories: 155, protein: 13, carbs: 1, fat: 11 },
  { name: 'Oatmeal (1 cup cooked)', calories: 160, protein: 6, carbs: 27, fat: 3 },
  { name: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: 'Whey protein shake', calories: 130, protein: 25, carbs: 3, fat: 2 },
  { name: 'Pandesal (2 pcs)', calories: 240, protein: 6, carbs: 42, fat: 4 },
  { name: 'Greek yogurt', calories: 120, protein: 15, carbs: 8, fat: 3 },
  { name: 'Peanut butter (1 tbsp)', calories: 95, protein: 4, carbs: 3, fat: 8 },
  { name: 'Mixed vegetables', calories: 80, protein: 3, carbs: 15, fat: 1 },
];
