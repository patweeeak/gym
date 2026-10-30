/*
 * Exercise library: how to do each movement, what it works, and how it is logged.
 * `demo` is a Body Lab animation (public/models/anims/<demo>.glb) shown on the exercise page.
 */
export type Muscle = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Core' | 'Glutes' | 'Legs' | 'Full body' | 'Cardio';
export type LogKind = 'weight' | 'reps' | 'time';

export interface ExerciseInfo {
  id: string;
  name: string;
  aliases?: string[];
  muscles: Muscle[];
  equipment: string;
  log: LogKind;
  steps: string[];
  tip: string;
  demo?: DemoClip;
}

export type DemoClip = 'squat' | 'pushup' | 'jumping-jacks' | 'jog' | 'burpee' | 'stretch' | 'curl' | 'shoulder-press' | 'row' | 'core' | 'glute-bridge';
export type GymProp = 'dumbbells' | 'barbell' | 'mat';

/** Body Lab demos available: Mixamo clips in public/models/anims, plus the hand-animated ones in BodyModel. */
export const READY_CLIPS = new Set<DemoClip>(['squat', 'pushup', 'jumping-jacks', 'jog', 'burpee', 'stretch',
  'curl', 'shoulder-press', 'row', 'core', 'glute-bridge']);

/** One 3D demo per workout focus, with the equipment it uses. */
export const FOCUS_DEMOS: Record<Muscle, { clip: DemoClip; props: GymProp[]; label: string }> = {
  Chest: { clip: 'pushup', props: ['mat'], label: 'Push-ups' },
  Back: { clip: 'row', props: ['barbell'], label: 'Bent-over row' },
  Shoulders: { clip: 'shoulder-press', props: ['dumbbells'], label: 'Shoulder press' },
  Arms: { clip: 'curl', props: ['dumbbells'], label: 'Bicep curl' },
  Core: { clip: 'core', props: ['mat'], label: 'Crunches' },
  Glutes: { clip: 'glute-bridge', props: ['mat'], label: 'Glute bridge' },
  Legs: { clip: 'squat', props: [], label: 'Squats' },
  'Full body': { clip: 'burpee', props: [], label: 'Burpees' },
  Cardio: { clip: 'jumping-jacks', props: [], label: 'Jumping jacks' },
};
const PROPS_FOR: Partial<Record<DemoClip, GymProp[]>> = Object.fromEntries(Object.values(FOCUS_DEMOS).map((f) => [f.clip, f.props]));

/** The demo for an exercise: its own clip, else its main focus's; null when that clip isn't available yet. */
export function demoFor(ex: ExerciseInfo): { clip: DemoClip; props: GymProp[]; focus?: Muscle } | null {
  if (ex.demo && READY_CLIPS.has(ex.demo)) return { clip: ex.demo, props: PROPS_FOR[ex.demo] ?? [] };
  const focus = ex.muscles.find((m) => READY_CLIPS.has(FOCUS_DEMOS[m].clip));
  return focus ? { clip: FOCUS_DEMOS[focus].clip, props: FOCUS_DEMOS[focus].props, focus } : null;
}

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Glutes', 'Legs', 'Full body', 'Cardio'];

export const EXERCISES: ExerciseInfo[] = [
  { id: 'bench-press', name: 'Bench press', muscles: ['Chest', 'Arms', 'Shoulders'], equipment: 'Barbell, bench', log: 'weight',
    steps: ['Lie on the bench with eyes under the bar, feet flat.', 'Grip slightly wider than shoulders; unrack with straight arms.', 'Lower the bar to mid-chest with elbows about 45° from your body.', 'Press back up until the arms are straight.'],
    tip: 'Keep shoulder blades squeezed together and your butt on the bench.' },
  { id: 'incline-db-press', name: 'Incline DB press', aliases: ['Incline dumbbell press'], muscles: ['Chest', 'Shoulders', 'Arms'], equipment: 'Dumbbells, incline bench', log: 'weight',
    steps: ['Set the bench to 30–45°.', 'Start with dumbbells over the upper chest.', 'Lower them to chest level with elbows slightly tucked.', 'Press up and slightly together.'],
    tip: 'A lower incline keeps the work on the chest instead of the shoulders.' },
  { id: 'push-ups', name: 'Push-ups', aliases: ['Push-up', 'Pushups'], muscles: ['Chest', 'Arms', 'Core'], equipment: 'Bodyweight', log: 'reps', demo: 'pushup',
    steps: ['Hands a little wider than shoulders, body in a straight line.', 'Lower your chest to just above the floor.', 'Push the floor away until the arms are straight.'],
    tip: "Squeeze glutes and abs so the hips don't sag." },
  { id: 'knee-push-ups', name: 'Knee push-ups', muscles: ['Chest', 'Arms'], equipment: 'Bodyweight', log: 'reps', demo: 'pushup',
    steps: ['Kneel with hands under the shoulders.', 'Keep a straight line from knees to head.', 'Lower the chest, then press back up.'],
    tip: 'Move to full push-ups once you can do 3 × 15 with good form.' },
  { id: 'tricep-dips', name: 'Tricep dips', aliases: ['Dips'], muscles: ['Arms', 'Chest'], equipment: 'Bench or dip bars', log: 'reps',
    steps: ['Hands on the edge of a bench behind you, legs out.', 'Bend the elbows straight back to about 90°.', 'Press up until the arms are straight.'],
    tip: 'Keep your back close to the bench to protect the shoulders.' },
  { id: 'shoulder-press', name: 'Shoulder press', aliases: ['Overhead press'], muscles: ['Shoulders', 'Arms'], equipment: 'Dumbbells or barbell', log: 'weight',
    steps: ['Stand or sit tall with weights at shoulder height.', 'Press straight overhead until the arms lock out.', 'Lower back to the shoulders with control.'],
    tip: "Brace your core and don't lean back." },
  { id: 'lateral-raise', name: 'Lateral raise', muscles: ['Shoulders'], equipment: 'Dumbbells', log: 'weight',
    steps: ['Hold light dumbbells at your sides, slight bend in the elbows.', 'Raise them out to shoulder height.', 'Lower slowly.'],
    tip: 'Lead with the elbows; lighter weight, strict form.' },
  { id: 'bent-over-row', name: 'Bent-over row', aliases: ['Barbell row'], muscles: ['Back', 'Arms'], equipment: 'Barbell or dumbbells', log: 'weight',
    steps: ['Hinge at the hips with a flat back, bar hanging below the shoulders.', 'Pull the weight to your lower ribs.', 'Lower with control.'],
    tip: 'Squeeze the shoulder blades together at the top.' },
  { id: 'back-squat', name: 'Back squat', aliases: ['Barbell squat'], muscles: ['Legs', 'Glutes', 'Core'], equipment: 'Barbell, rack', log: 'weight', demo: 'squat',
    steps: ['Bar on the upper back, feet shoulder-width, toes slightly out.', 'Sit back and down until the thighs are at least parallel.', 'Drive up through the whole foot.'],
    tip: 'Knees track over the toes; keep the chest up.' },
  { id: 'bodyweight-squats', name: 'Bodyweight squats', aliases: ['Air squats', 'Squats'], muscles: ['Legs', 'Glutes'], equipment: 'Bodyweight', log: 'reps', demo: 'squat',
    steps: ['Feet shoulder-width, arms forward for balance.', 'Sit down and back as low as is comfortable.', 'Stand up tall and squeeze the glutes.'],
    tip: 'Weight in the heels and mid-foot, not the toes.' },
  { id: 'jump-squats', name: 'Jump squats', muscles: ['Legs', 'Glutes', 'Cardio'], equipment: 'Bodyweight', log: 'reps', demo: 'squat',
    steps: ['Squat down to parallel.', 'Explode upward into a jump.', 'Land softly and go straight into the next rep.'],
    tip: 'Land quietly with bent knees.' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian split squat', muscles: ['Legs', 'Glutes'], equipment: 'Bench, dumbbells', log: 'weight',
    steps: ['Rear foot on a bench, front foot a stride ahead.', 'Lower straight down until the front thigh is parallel.', 'Push up through the front heel.'],
    tip: 'Most of the weight stays on the front leg.' },
  { id: 'walking-lunges', name: 'Walking lunges', aliases: ['Lunges'], muscles: ['Legs', 'Glutes'], equipment: 'Bodyweight or dumbbells', log: 'reps',
    steps: ['Step forward and lower until both knees are at 90°.', 'Push off the front foot and step into the next lunge.'],
    tip: 'Keep the torso upright and the front knee over the ankle.' },
  { id: 'romanian-deadlift', name: 'Romanian deadlift', aliases: ['RDL'], muscles: ['Legs', 'Glutes', 'Back'], equipment: 'Barbell or dumbbells', log: 'weight',
    steps: ['Stand holding the weight at the hips, knees soft.', 'Push the hips back and slide the weight down the legs.', 'Stop when you feel the hamstrings stretch; stand back up.'],
    tip: 'A flat back the whole way; the hips do the work.' },
  { id: 'leg-press', name: 'Leg press', muscles: ['Legs', 'Glutes'], equipment: 'Leg press machine', log: 'weight',
    steps: ['Feet shoulder-width on the platform.', 'Lower until the knees are at about 90°.', 'Press back up without locking the knees.'],
    tip: "Keep your lower back against the pad." },
  { id: 'hamstring-curl', name: 'Hamstring curl', aliases: ['Leg curl'], muscles: ['Legs'], equipment: 'Leg curl machine', log: 'weight',
    steps: ['Pad just above the heels.', 'Curl the heels toward the glutes.', 'Lower slowly.'],
    tip: 'Control the way down — that half builds the most strength.' },
  { id: 'calf-raises', name: 'Calf raises', muscles: ['Legs'], equipment: 'Step or machine', log: 'reps',
    steps: ['Balls of the feet on a step, heels hanging.', 'Rise as high as you can.', 'Lower the heels below the step.'],
    tip: 'Pause at the top for a second.' },
  { id: 'glute-bridge', name: 'Glute bridge', aliases: ['Hip bridge'], muscles: ['Glutes', 'Core'], equipment: 'Bodyweight', log: 'reps',
    steps: ['Lie on your back, knees bent, feet flat.', 'Drive the hips up until knees, hips and shoulders line up.', 'Lower slowly.'],
    tip: 'Squeeze the glutes at the top; ribs stay down.' },
  { id: 'plank', name: 'Plank', muscles: ['Core'], equipment: 'Bodyweight', log: 'time',
    steps: ['Forearms under the shoulders, legs straight.', 'Hold a straight line from head to heels.', 'Breathe steadily.'],
    tip: "Squeeze glutes and abs; don't let the hips sag or pike." },
  { id: 'side-plank', name: 'Side plank', muscles: ['Core'], equipment: 'Bodyweight', log: 'time',
    steps: ['Lie on one side, forearm under the shoulder.', 'Lift the hips into a straight line.', 'Hold, then switch sides.'],
    tip: 'Stack the feet, or stagger them for balance.' },
  { id: 'dead-bug', name: 'Dead bug', muscles: ['Core'], equipment: 'Bodyweight', log: 'reps',
    steps: ['On your back, arms up, knees bent at 90°.', 'Lower the opposite arm and leg toward the floor.', 'Return and switch sides.'],
    tip: 'Press the lower back into the floor the whole time.' },
  { id: 'bird-dog', name: 'Bird dog', muscles: ['Core', 'Back'], equipment: 'Bodyweight', log: 'reps',
    steps: ['On hands and knees.', 'Reach one arm forward and the opposite leg back.', 'Hold a second, return, switch.'],
    tip: 'Keep the hips level — imagine a glass of water on your back.' },
  { id: 'russian-twists', name: 'Russian twists', muscles: ['Core'], equipment: 'Bodyweight or plate', log: 'reps',
    steps: ['Sit leaning back slightly, feet up or on the floor.', 'Rotate the torso side to side, touching the floor.'],
    tip: 'Turn from the ribs, not just the arms.' },
  { id: 'mountain-climbers', name: 'Mountain climbers', muscles: ['Core', 'Cardio'], equipment: 'Bodyweight', log: 'time',
    steps: ['Start in a high plank.', 'Drive the knees toward the chest one at a time, fast.'],
    tip: 'Keep the hips low and the shoulders over the hands.' },
  { id: 'burpees', name: 'Burpees', aliases: ['Burpee'], muscles: ['Full body', 'Cardio'], equipment: 'Bodyweight', log: 'reps', demo: 'burpee',
    steps: ['Squat and place your hands on the floor.', 'Jump the feet back to a plank.', 'Jump the feet in and leap up with arms overhead.'],
    tip: 'Find a steady rhythm you can keep for the whole set.' },
  { id: 'jumping-jacks', name: 'Jumping jacks', muscles: ['Cardio', 'Full body'], equipment: 'Bodyweight', log: 'reps', demo: 'jumping-jacks',
    steps: ['Stand with feet together, arms by your sides.', 'Jump the feet out while swinging the arms overhead.', 'Jump back to the start.'],
    tip: 'Stay light on the balls of your feet.' },
  { id: 'battle-ropes', name: 'Battle ropes', muscles: ['Arms', 'Shoulders', 'Cardio'], equipment: 'Battle ropes', log: 'time',
    steps: ['Half squat holding one rope end in each hand.', 'Whip the arms up and down in alternating waves.'],
    tip: 'Power comes from the hips and core, not just the arms.' },
  { id: 'rowing-machine', name: 'Rowing machine', aliases: ['Rower'], muscles: ['Cardio', 'Back', 'Legs'], equipment: 'Rowing machine', log: 'time',
    steps: ['Push with the legs first.', 'Then lean back slightly and pull the handle to the ribs.', 'Return arms, body, then legs.'],
    tip: 'Legs – body – arms on the way out; reverse on the way in.' },
  { id: 'jog', name: 'Jog', aliases: ['Light jog', 'Jog in place', 'Jog 1 min / walk 1 min'], muscles: ['Cardio', 'Legs'], equipment: 'Treadmill or outdoors', log: 'time', demo: 'jog',
    steps: ['Easy pace where you can still talk.', 'Land under your hips with short, quick steps.', 'Relax the shoulders; arms swing forward and back.'],
    tip: 'Most runs should feel easy — that builds the base.' },
  { id: 'walk', name: 'Walk', aliases: ['Warm-up walk', 'Cool-down walk'], muscles: ['Cardio'], equipment: 'Treadmill or outdoors', log: 'time',
    steps: ['Walk at a comfortable, brisk pace.', 'Keep a tall posture and swing the arms.'],
    tip: 'Use it to warm up before and cool down after hard work.' },
  { id: 'stretch', name: 'Warm-up stretch', aliases: ['Stretch', 'Yoga flow', 'Mobility'], muscles: ['Full body'], equipment: 'Mat', log: 'time', demo: 'stretch',
    steps: ['Move each joint through its full range slowly.', 'Hold each stretch about 20–30 seconds.', 'Breathe out as you ease deeper.'],
    tip: 'Stretch to mild tension, never pain.' },
  { id: 'foam-rolling', name: 'Foam rolling', muscles: ['Full body'], equipment: 'Foam roller', log: 'time',
    steps: ['Roll slowly over each muscle for 30–60 seconds.', 'Pause on tight spots and breathe.'],
    tip: 'Avoid rolling directly on joints or the lower back.' },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/s\b/g, '');
const INDEX = new Map<string, ExerciseInfo>();
for (const e of EXERCISES) for (const n of [e.name, ...(e.aliases ?? [])]) INDEX.set(norm(n), e);

/** The library entry for an exercise name as written in a plan (case, plurals and aliases ignored). */
export const findExercise = (name: string) => INDEX.get(norm(name));

/** How an exercise is logged: from the library, or guessed from the plan's reps ("45s", "10 min" → time). */
export const logKindOf = (name: string, reps = ''): LogKind =>
  findExercise(name)?.log ?? (/\d\s*(s|sec|min)\b/i.test(reps) ? 'time' : 'reps');

/** Estimated one-rep max (Epley); reps beyond 12 are capped so light, high-rep sets don't inflate it. */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + Math.min(reps, 12) / 30));
