import { toast } from '../lib/fx';
import { useEffect, useState, type ChangeEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { update, useDB } from '../lib/db';
import { defaultGoal, goalOf, latestWeight } from '../lib/stats';
import type { Goal, GoalType } from '../lib/types';
import { Button, Input, Modal, Segmented, Textarea } from './ui';

export const GOAL_TYPES: { value: GoalType; label: string; emoji: string }[] = [
  { value: 'lose', label: 'Lose fat', emoji: '🔥' },
  { value: 'gain', label: 'Build muscle', emoji: '💪' },
  { value: 'tone', label: 'Tone up', emoji: '✨' },
  { value: 'maintain', label: 'Maintain', emoji: '⚖️' },
];

export default function GoalEditor({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const db = useDB();
  const [g, setG] = useState<Goal>(() => goalOf(db, userId) ?? defaultGoal(userId, latestWeight(db, userId) || 65));

  useEffect(() => {
    if (open) setG(goalOf(db, userId) ?? defaultGoal(userId, latestWeight(db, userId) || 65));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // rough maintenance estimate (~31 kcal/kg) adjusted for goal
  const suggest = () => {
    const w = latestWeight(db, userId) || g.startWeight;
    const base = Math.round(w * 31);
    const adj = { lose: -450, gain: 350, tone: -150, maintain: 0 }[g.type];
    const protein = Math.round(w * (g.type === 'gain' ? 2 : g.type === 'maintain' ? 1.4 : 1.7));
    setG({ ...g, dailyCalories: Math.round((base + adj) / 10) * 10, protein });
  };

  const save = () => {
    update((d) => {
      const i = d.goals.findIndex((x) => x.userId === userId);
      if (i >= 0) d.goals[i] = g; else d.goals.push(g);
    });
    toast('Goals saved 🎯');
    onClose();
  };

  const num = (k: keyof Goal) => (e: ChangeEvent<HTMLInputElement>) => setG({ ...g, [k]: +e.target.value });

  return (
    <Modal open={open} onClose={onClose} title="Body goals"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save}>Save goals</Button></>}>
      <div className="col gap-lg">
        <div className="field">
          <label>Main goal</label>
          <Segmented value={g.type} onChange={(type) => setG({ ...g, type })} options={GOAL_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))} />
        </div>
        <div className="grid g3" style={{ gap: 14 }}>
          <Input label="Height (cm)" type="number" value={g.heightCm} onChange={num('heightCm')} />
          <Input label="Start weight (kg)" type="number" step="0.1" value={g.startWeight} onChange={num('startWeight')} />
          <Input label="Target weight (kg)" type="number" step="0.1" value={g.targetWeight} onChange={num('targetWeight')} />
        </div>
        <Input label="Target date" type="date" value={g.targetDate} onChange={(e) => setG({ ...g, targetDate: e.target.value })} />
        <div className="row between">
          <div className="section-title">Daily targets</div>
          <Button size="sm" icon={<Sparkles size={14} />} onClick={suggest}>Suggest</Button>
        </div>
        <div className="grid g2" style={{ gap: 14 }}>
          <Input label="Calories (kcal)" type="number" value={g.dailyCalories} onChange={num('dailyCalories')} />
          <Input label="Protein (g)" type="number" value={g.protein} onChange={num('protein')} />
          <Input label="Steps" type="number" step="500" value={g.dailySteps} onChange={num('dailySteps')} />
          <Input label="Water (glasses)" type="number" value={g.dailyWater} onChange={num('dailyWater')} />
          <Input label="Workouts / week" type="number" min={0} max={7} value={g.weeklyWorkouts} onChange={num('weeklyWorkouts')} />
        </div>
        <Textarea label="Motivation note" value={g.note ?? ''} onChange={(e) => setG({ ...g, note: e.target.value })} placeholder="Why does this goal matter to you?" />
      </div>
    </Modal>
  );
}
