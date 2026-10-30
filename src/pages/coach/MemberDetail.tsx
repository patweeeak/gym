import { toast } from '../../lib/fx';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Crown, Dumbbell, Flame, Footprints, Pencil, Plus, StickyNote, Target, Trash2 } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { caloriesOn, goalOf, goalProgress, latestWeight, shortDate, stepsOn, weekSteps, weightsOf, workoutsThisWeek } from '../../lib/stats';
import type { Exercise, WorkoutPlan } from '../../lib/types';
import { DAYS, DAYS_LONG, bmi, bmiLabel, daysLeft, dayKey, memberStatus, relTime, uid } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Empty, IconButton, Input, Modal, Progress, Select, Stat } from '../../components/ui';
import { BarChart, LineChart } from '../../components/charts';
import GoalEditor, { GOAL_TYPES } from '../../components/GoalEditor';

export default function MemberDetail() {
  const { id = '' } = useParams();
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const [goalOpen, setGoalOpen] = useState(false);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [note, setNote] = useState('');
  const u = db.users.find((x) => x.id === id && x.role === 'member');
  if (!u) return <div className="page"><Card><Empty icon={<Target />} text="Member not found." /></Card></div>;

  const today = dayKey();
  const g = goalOf(db, u.id);
  const w = latestWeight(db, u.id);
  const weights = weightsOf(db, u.id).slice(-10).map((x) => ({ label: shortDate(x.date), value: x.weight }));
  const plans = db.plans.filter((p) => p.memberId === u.id).sort((a, b) => a.day - b.day);
  const notes = db.notes.filter((n) => n.memberId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const st = memberStatus(u);
  const b = g ? bmi(w, g.heightCm) : 0;

  const addNote = () => {
    if (!note.trim()) return;
    update((d) => { d.notes.push({ id: uid(), memberId: u.id, instructorId: me.id, text: note.trim(), createdAt: new Date().toISOString() }); });
    setNote('');
    toast('Note added');
  };

  return (
    <div className="page">
      <div className="row">
        <IconButton onClick={() => nav(-1)} aria-label="Back"><ChevronLeft size={18} /></IconButton>
        <span className="bold muted">Back</span>
      </div>

      <Card className="hero">
        <div className="row wrap between gap-lg">
          <div className="row gap-lg">
            <Avatar name={u.name} color={u.color} size={72} />
            <div>
              <h1 style={{ fontSize: 24 }}>{u.name}</h1>
              <div className="small muted">{u.email}{u.phone && ` · ${u.phone}`}</div>
              <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
                {st === 'premium' ? <Badge tone="gold" icon={<Crown size={12} />}>Premium · {daysLeft(u)} days left</Badge> : <Badge tone={st === 'expired' ? 'red' : 'muted'}>{st === 'expired' ? 'Subscription expired' : 'Basic member'}</Badge>}
                {g && <Badge tone="accent">{GOAL_TYPES.find((t) => t.value === g.type)?.emoji} {GOAL_TYPES.find((t) => t.value === g.type)?.label}</Badge>}
              </div>
            </div>
          </div>
          <Button variant="accent" icon={<Target size={16} />} onClick={() => setGoalOpen(true)}>{g ? 'Edit goals' : 'Set goals'}</Button>
        </div>
      </Card>

      <div className="grid g4">
        <Stat icon={<Footprints size={22} />} label="Steps today" value={stepsOn(db, u.id, today).toLocaleString()} sub={g && `Goal ${g.dailySteps.toLocaleString()}`} />
        <Stat icon={<Flame size={22} />} label="Calories eaten" value={caloriesOn(db, u.id, today)} sub={g && `Goal ${g.dailyCalories}`} color="var(--red)" />
        <Stat icon={<Dumbbell size={22} />} label="Workouts (7d)" value={workoutsThisWeek(db, u.id)} sub={g && `Goal ${g.weeklyWorkouts}/wk`} color="var(--purple)" />
        <Stat icon={<Target size={22} />} label="BMI" value={b ? b.toFixed(1) : '—'} sub={b ? bmiLabel(b).label : undefined} color="var(--green)" />
      </div>

      <div className="grid g2">
        <Card>
          <div className="card-head">
            <div className="section-title">Weight trend</div>
            {g && <span className="small bold muted">{w} → {g.targetWeight} kg</span>}
          </div>
          <LineChart data={weights} unit="kg" target={g?.targetWeight} />
          {g && <div style={{ marginTop: 14 }}><Progress value={goalProgress(g, w)} max={1} /></div>}
        </Card>
        <Card>
          <div className="card-head"><div className="section-title">Steps this week</div></div>
          <BarChart data={weekSteps(db, u.id)} highlight={6} format={(v) => `${(v / 1000).toFixed(1)}k`} goal={g?.dailySteps} />
        </Card>
      </div>

      <div className="grid g2">
        <Card>
          <div className="card-head">
            <div className="section-title"><Dumbbell size={17} /> Workout plans</div>
            <Button size="sm" variant="accent" icon={<Plus size={14} />}
              onClick={() => setPlan({ id: '', memberId: u.id, instructorId: me.id, title: '', day: 1, exercises: [{ name: '', sets: 3, reps: '10' }], createdAt: '' })}>Plan</Button>
          </div>
          {plans.length === 0 && <Empty icon={<Dumbbell size={24} />} text="No plans assigned" />}
          {plans.map((p) => (
            <div key={p.id} className="neu-sm list-item">
              <div className="neu-inset-sm center heavy" style={{ width: 46, height: 46, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--accent)' }}>{DAYS[p.day]}</div>
              <div className="grow">
                <div className="bold truncate">{p.title}</div>
                <div className="xs muted truncate">{p.exercises.map((e) => e.name).join(' · ')}</div>
              </div>
              <IconButton size="sm" onClick={() => setPlan(p)} aria-label="Edit"><Pencil size={14} /></IconButton>
            </div>
          ))}
        </Card>

        <Card>
          <div className="card-head"><div className="section-title"><StickyNote size={17} /> Coach notes</div></div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Input placeholder="Add a note for this member…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} /></div>
            <IconButton className="accent" onClick={addNote} aria-label="Add note"><Plus size={18} /></IconButton>
          </div>
          <div className="col" style={{ marginTop: 16 }}>
            {notes.map((n) => (
              <div key={n.id} className="neu-inset-sm" style={{ padding: 14 }}>
                <div className="small">{n.text}</div>
                <div className="xs muted bold" style={{ marginTop: 6 }}>{db.users.find((x) => x.id === n.instructorId)?.name ?? 'Staff'} · {relTime(n.createdAt)}</div>
              </div>
            ))}
          </div>
          {g?.note && <div className="small muted" style={{ marginTop: 14 }}>Member's motivation: <i>"{g.note}"</i></div>}
        </Card>
      </div>

      <GoalEditor userId={u.id} open={goalOpen} onClose={() => setGoalOpen(false)} />
      {plan && <PlanEditor key={plan.id || 'new'} plan={plan} onClose={() => setPlan(null)} />}
    </div>
  );
}

function PlanEditor({ plan, onClose }: { plan: WorkoutPlan; onClose: () => void }) {
  const [p, setP] = useState(plan);

  const setEx = (i: number, patch: Partial<Exercise>) => setP({ ...p, exercises: p.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const save = () => {
    const clean = { ...p, exercises: p.exercises.filter((e) => e.name.trim()) };
    if (!clean.title.trim() || !clean.exercises.length) return;
    update((d) => {
      if (clean.id) d.plans = d.plans.map((x) => (x.id === clean.id ? clean : x));
      else d.plans.push({ ...clean, id: uid(), createdAt: new Date().toISOString() });
    });
    toast(clean.id ? 'Plan updated' : `${clean.title} assigned`);
    onClose();
  };
  const remove = () => {
    update((d) => { d.plans = d.plans.filter((x) => x.id !== p.id); });
    onClose();
  };
  const close = onClose;

  return (
    <Modal open onClose={close} title={p.id ? 'Edit plan' : 'New workout plan'}
      footer={<>
        {p.id && <Button variant="danger" icon={<Trash2 size={15} />} onClick={remove}>Delete</Button>}
        <Button onClick={close}>Cancel</Button>
        <Button variant="accent" onClick={save}>Save plan</Button>
      </>}>
      <div className="col gap-lg">
        <div className="grid g2" style={{ gap: 14 }}>
          <Input label="Title" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} placeholder="e.g. Upper body" />
          <Select label="Day" value={p.day} onChange={(e) => setP({ ...p, day: +e.target.value })}>
            {DAYS_LONG.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </Select>
        </div>
        <div className="section-title">Exercises</div>
        {p.exercises.map((ex, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-end', gap: 8 }}>
            <div style={{ flex: 3 }}><Input placeholder="Exercise" value={ex.name} onChange={(e) => setEx(i, { name: e.target.value })} /></div>
            <div style={{ flex: 1 }}><Input placeholder="Sets" type="number" value={ex.sets} onChange={(e) => setEx(i, { sets: +e.target.value })} /></div>
            <div style={{ flex: 1.3 }}><Input placeholder="Reps" value={ex.reps} onChange={(e) => setEx(i, { reps: e.target.value })} /></div>
            <IconButton size="sm" onClick={() => setP({ ...p, exercises: p.exercises.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 size={13} /></IconButton>
          </div>
        ))}
        <Button icon={<Plus size={15} />} onClick={() => setP({ ...p, exercises: [...p.exercises, { name: '', sets: 3, reps: '10' }] })}>Add exercise</Button>
      </div>
    </Modal>
  );
}
