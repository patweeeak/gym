import { celebrate, toast } from '../../lib/fx';
import { useState } from 'react';
import { CalendarClock, Droplets, Dumbbell, Flame, Footprints, Pencil, Plus, Scale, Target } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { goalOf, goalProgress, latestWeight, shortDate, weightsOf, workoutsThisWeek } from '../../lib/stats';
import { METRIC, bmi, bmiLabel, dayKey, daysBetween, fmtDate, uid } from '../../lib/utils';
import { AnimatedNumber, Badge, Button, Card, Empty, Input, Modal, PageHeader, Progress, Ring } from '../../components/ui';
import { LineChart } from '../../components/charts';
import GoalEditor, { GOAL_TYPES } from '../../components/GoalEditor';
import BodyProgress from '../../components/BodyProgress';

export default function Goals() {
  const me = useMe();
  const db = useDB();
  const [edit, setEdit] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const g = goalOf(db, me.id);
  const w = latestWeight(db, me.id);
  const [newW, setNewW] = useState<number>(w || 60);
  const weights = weightsOf(db, me.id);
  const coach = db.users.find((u) => u.id === me.instructorId);

  const logWeight = () => {
    if (!newW) return;
    update((d) => {
      d.weights = d.weights.filter((x) => !(x.userId === me.id && x.date === dayKey()));
      d.weights.push({ id: uid(), userId: me.id, date: dayKey(), weight: +newW.toFixed(1) });
    });
    setLogOpen(false);
    const reached = g && ((g.targetWeight <= g.startWeight && newW <= g.targetWeight) || (g.targetWeight > g.startWeight && newW >= g.targetWeight));
    if (reached) celebrate('You reached your target weight! 🏆');
    else toast(`Weight logged · ${newW.toFixed(1)} kg${w ? ` (${newW - w > 0 ? '+' : ''}${(newW - w).toFixed(1)})` : ''}`);
  };

  if (!g) {
    return (
      <div className="page" style={{ maxWidth: 620 }}>
        <Card className="hero center">
          <Empty icon={<Target size={28} />} text="Set your body goals">
            <div className="small muted" style={{ maxWidth: 320 }}>Tell us what you want to achieve. We'll set daily targets for calories, steps and water.</div>
            <Button variant="accent" onClick={() => setEdit(true)}>Get started</Button>
          </Empty>
        </Card>
        <GoalEditor userId={me.id} open={edit} onClose={() => setEdit(false)} />
      </div>
    );
  }

  const pct = goalProgress(g, w);
  const b = bmi(w, g.heightCm);
  const bl = bmiLabel(b);
  const daysToGo = daysBetween(dayKey(), g.targetDate);
  const remaining = +(g.targetWeight - w).toFixed(1);
  const type = GOAL_TYPES.find((t) => t.value === g.type)!;
  const weekly = workoutsThisWeek(db, me.id);

  return (
    <div className="page">
      <PageHeader title="Body Goals" subtitle={coach ? `${coach.name} can see and adjust your goals` : 'Your targets and progress'}
        action={<div className="row" style={{ gap: 10 }}>
          <Button icon={<Scale size={16} />} onClick={() => { setNewW(w); setLogOpen(true); }}>Log weight</Button>
          <Button variant="accent" icon={<Pencil size={15} />} onClick={() => setEdit(true)}>Edit goals</Button>
        </div>} />

      <div className="grid g3">
        <Card className="col" style={{ alignItems: 'center', gap: 16 }}>
          <Badge tone="accent">{type.emoji} {type.label}</Badge>
          <Ring value={pct} max={1} size={210} stroke={15} colors={METRIC.weight}>
            <div className="heavy num" style={{ fontSize: 48, lineHeight: 1 }}><AnimatedNumber value={Math.round(pct * 100)} />%</div>
            <div className="xs muted bold">complete</div>
          </Ring>
          <div className="small bold center">
            {remaining === 0 ? 'Goal reached! 🎉' : `${Math.abs(remaining)} kg to ${remaining < 0 ? 'lose' : 'gain'}`}
          </div>
        </Card>

        <Card className="span2">
          <div className="card-head">
            <div className="section-title">Weight journey</div>
            <span className="small bold muted">{g.startWeight} → {w} kg</span>
          </div>
          <LineChart data={weights.slice(-12).map((x) => ({ label: shortDate(x.date), value: x.weight }))} unit="kg" target={g.targetWeight} height={190} />
        </Card>
      </div>

      <div className="grid g4">
        <Card>
          <div className="row xs muted bold" style={{ gap: 6 }}><Scale size={15} /> BMI</div>
          <div className="heavy num" style={{ fontSize: 36, marginTop: 6 }}>{b.toFixed(1)}</div>
          <Badge tone={bl.tone}>{bl.label}</Badge>
        </Card>
        <Card>
          <div className="row xs muted bold" style={{ gap: 6 }}><CalendarClock size={15} /> Deadline</div>
          <div className="heavy num" style={{ fontSize: 36, marginTop: 6 }}>{Math.max(0, daysToGo)}<span className="small muted"> days</span></div>
          <div className="xs muted bold">{fmtDate(g.targetDate)}</div>
        </Card>
        <Card>
          <div className="row xs muted bold" style={{ gap: 6 }}><Dumbbell size={15} /> Workouts this week</div>
          <div className="heavy num" style={{ fontSize: 36, marginTop: 6 }}>{weekly}<span className="small muted"> / {g.weeklyWorkouts}</span></div>
          <Progress value={weekly} max={g.weeklyWorkouts} />
        </Card>
        <Card>
          <div className="row xs muted bold" style={{ gap: 6 }}><Target size={15} /> Height</div>
          <div className="heavy num" style={{ fontSize: 36, marginTop: 6 }}>{g.heightCm}<span className="small muted"> cm</span></div>
          <div className="xs muted bold">Healthy range {(18.5 * (g.heightCm / 100) ** 2).toFixed(0)}–{(24.9 * (g.heightCm / 100) ** 2).toFixed(0)} kg</div>
        </Card>
      </div>

      <Card>
        <div className="section-title" style={{ marginBottom: 16 }}>Daily targets</div>
        <div className="grid g4">
          {[
            { icon: <Flame size={20} />, label: 'Calories', value: `${g.dailyCalories} kcal`, color: 'var(--red)' },
            { icon: <Dumbbell size={20} />, label: 'Protein', value: `${g.protein} g`, color: 'var(--accent)' },
            { icon: <Footprints size={20} />, label: 'Steps', value: g.dailySteps.toLocaleString(), color: 'var(--purple)' },
            { icon: <Droplets size={20} />, label: 'Water', value: `${g.dailyWater} glasses`, color: 'var(--blue)' },
          ].map((t) => (
            <div key={t.label} className="neu-inset-sm row" style={{ padding: 16 }}>
              <span style={{ color: t.color }}>{t.icon}</span>
              <div><div className="heavy">{t.value}</div><div className="xs muted bold">{t.label}</div></div>
            </div>
          ))}
        </div>
        {g.note && <div className="small muted" style={{ marginTop: 18 }}>💬 <i>"{g.note}"</i></div>}
      </Card>

      <BodyProgress />

      <GoalEditor userId={me.id} open={edit} onClose={() => setEdit(false)} />
      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log today's weight"
        footer={<><Button onClick={() => setLogOpen(false)}>Cancel</Button><Button variant="accent" onClick={logWeight}>Save</Button></>}>
        <div className="col gap-lg" style={{ alignItems: 'center' }}>
          <div className="row" style={{ gap: 18 }}>
            <button className="icon-btn lg" onClick={() => setNewW(+(newW - 0.1).toFixed(1))}>−</button>
            <div className="neu-inset center" style={{ padding: '18px 26px', minWidth: 150 }}>
              <div className="heavy num" style={{ fontSize: 48 }}>{newW.toFixed(1)}</div>
              <div className="xs muted bold">kg</div>
            </div>
            <button className="icon-btn lg" onClick={() => setNewW(+(newW + 0.1).toFixed(1))}><Plus size={20} /></button>
          </div>
          <div style={{ width: '100%' }}><Input type="number" step="0.1" value={newW} onChange={(e) => setNewW(+e.target.value)} /></div>
        </div>
      </Modal>
    </div>
  );
}
