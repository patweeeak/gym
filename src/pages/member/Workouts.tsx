import { useState } from 'react';
import { Check, ChevronRight, Clock, Dumbbell, Lock, PlayCircle, Search, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../../lib/auth';
import { useDB } from '../../lib/db';
import { EXERCISES, FOCUS_DEMOS, MUSCLES, READY_CLIPS, demoFor, type ExerciseInfo, type Muscle } from '../../lib/exercises';
import { describeRecord, personalRecords } from '../../lib/training';
import { WorkoutLogger } from '../../components/WorkoutLogger';
import { DemoViewer, ExerciseDetail } from '../../components/ExerciseDetail';
import { LIBRARY } from '../../lib/library';
import { goalOf, latestWeight, workoutsThisWeek } from '../../lib/stats';
import type { Exercise, LoggedSet, WorkoutLog } from '../../lib/types';
import { DAYS, DAYS_LONG, cls, fmtDate, isPremium, parseDay } from '../../lib/utils';
import { Badge, Button, Card, Empty, Input, Locked, PageHeader, Progress, Segmented } from '../../components/ui';

interface Session { title: string; exercises: Exercise[]; minutes: number }

export default function Workouts() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const premium = isPremium(me);
  const [tab, setTab] = useState<'plan' | 'library' | 'exercises' | 'history'>(premium ? 'plan' : 'library');
  const [active, setActive] = useState<Session | null>(null);
  const plans = db.plans.filter((p) => p.memberId === me.id).sort((a, b) => a.day - b.day);
  const dow = new Date().getDay();
  const logs = db.workoutLogs.filter((w) => w.userId === me.id).sort((a, b) => b.date.localeCompare(a.date));
  const g = goalOf(db, me.id);
  const weekly = workoutsThisWeek(db, me.id);
  const coach = db.users.find((u) => u.id === me.instructorId);

  return (
    <div className="page">
      <PageHeader title="Workouts" subtitle={premium ? (coach ? `Plans from ${coach.name}` : 'Your training') : 'Free starter routines'}
        action={<Segmented value={tab} onChange={setTab} options={[
          { value: 'plan', label: premium ? 'My plan' : <><Lock size={12} /> My plan</> },
          { value: 'library', label: 'Routines' },
          { value: 'exercises', label: 'Exercises' },
          { value: 'history', label: premium ? 'History' : <><Lock size={12} /> History</> },
        ]} />} />

      {premium && (
        <Card className="row wrap between">
          <div className="row">
            <div className="icon-btn lg" style={{ color: 'var(--yellow)' }}><Trophy size={26} /></div>
            <div><div className="heavy">{weekly} workout{weekly === 1 ? '' : 's'} in the last 7 days</div><div className="small muted">Target: {g?.weeklyWorkouts ?? 3} per week</div></div>
          </div>
          <div style={{ flex: '0 1 260px', minWidth: 160 }}><Progress value={weekly} max={g?.weeklyWorkouts ?? 3} /></div>
        </Card>
      )}

      {tab === 'plan' && (premium ? (
        plans.length === 0
          ? <Card><Empty icon={<Dumbbell size={26} />} text="Your coach hasn't assigned a plan yet." /></Card>
          : <div className="grid g3">
            {plans.map((p) => (
              <Card key={p.id} style={p.day === dow ? { boxShadow: 'var(--raise), inset 0 0 0 2px var(--accent)' } : undefined}>
                <div className="row between">
                  <Badge tone={p.day === dow ? 'accent' : 'muted'}>{p.day === dow ? 'TODAY' : DAYS_LONG[p.day]}</Badge>
                  <span className="xs muted bold">{p.exercises.length} exercises</span>
                </div>
                <div className="heavy" style={{ fontSize: 18, marginTop: 12 }}>{p.title}</div>
                <div className="col" style={{ gap: 6, marginTop: 12 }}>
                  {p.exercises.map((e) => <div key={e.name} className="row between small"><span>{e.name}</span><span className="muted bold">{e.sets}×{e.reps}</span></div>)}
                </div>
                <Button block variant={p.day === dow ? 'accent' : 'raised'} style={{ marginTop: 16 }} onClick={() => setActive({ title: p.title, exercises: p.exercises, minutes: 50 })}>Start workout</Button>
              </Card>
            ))}
          </div>
      ) : (
        <Locked title="Personal coaching plans" text="Premium members get weekly workout plans written by their coach.">
          <div className="grid g3">{['Upper Body', 'Leg Day', 'Core Burn'].map((t) => <Card key={t}><div className="heavy">{t}</div><div className="small muted">4 exercises</div></Card>)}</div>
        </Locked>
      ))}

      {tab === 'library' && (
        <div className="grid g3">
          {LIBRARY.map((r) => {
            const open = premium || r.free;
            const body = (
              <Card key={r.id} onClick={open ? () => setActive({ title: r.title, exercises: r.exercises, minutes: r.minutes }) : undefined}>
                <div className="row between">
                  <div className="neu-inset-sm" style={{ width: 46, height: 46, display: 'grid', placeItems: 'center', color: r.color }}><Dumbbell size={20} /></div>
                  {r.free ? <Badge tone="green">FREE</Badge> : <Badge tone="gold">PREMIUM</Badge>}
                </div>
                <div className="heavy" style={{ fontSize: 17, marginTop: 14 }}>{r.title}</div>
                <div className="small muted">{r.focus}</div>
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <Badge icon={<Clock size={11} />}>{r.minutes} min</Badge>
                  <Badge tone="blue">{r.level}</Badge>
                </div>
              </Card>
            );
            return open ? body : <Locked key={r.id} title="Premium routine">{body}</Locked>;
          })}
        </div>
      )}

      {tab === 'exercises' && <ExerciseLibrary />}

      {tab === 'history' && (premium ? (
        <>
        <PersonalRecords />
        <Card>
          {logs.length === 0 && <Empty icon={<Dumbbell size={26} />} text="No workouts logged yet." />}
          {logs.slice(0, 30).map((l) => <LogRow key={l.id} log={l} />)}
        </Card>
        </>
      ) : (
        <Card className="center"><Empty icon={<Lock size={24} />} text="Workout history is a Premium feature"><Button variant="accent" onClick={() => nav('/app/upgrade')}>Go Premium</Button></Empty></Card>
      ))}

      {active && <WorkoutLogger title={active.title} exercises={active.exercises} minutes={active.minutes} canLog={premium}
        onClose={() => setActive(null)} bodyWeight={latestWeight(db, me.id) || 65} />}
    </div>
  );
}

/** One logged workout; tap to see its sets. */
function LogRow({ log }: { log: WorkoutLog }) {
  const [open, setOpen] = useState(false);
  const groups = new Map<string, LoggedSet[]>();
  for (const st of log.sets ?? []) groups.set(st.exercise, [...(groups.get(st.exercise) ?? []), st]);
  return (
    <div className="neu-sm list-item" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: groups.size ? 'pointer' : undefined }} onClick={() => setOpen(!open)}>
      <div className="row">
        <div className="neu-inset-sm center" style={{ width: 46, height: 46, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Check size={18} color="var(--green)" /></div>
        <div className="grow"><div className="bold">{log.title}</div><div className="xs muted bold">{fmtDate(log.date)} · {DAYS[parseDay(log.date).getDay()]}{groups.size ? ` · ${log.sets!.length} sets` : ''}</div></div>
        <div className="small bold muted">{log.durationMin} min · {log.calories} kcal</div>
        {groups.size > 0 && <ChevronRight size={16} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .2s' }} />}
      </div>
      {open && (
        <div className="col small" style={{ gap: 4, marginTop: 10, paddingLeft: 58 }}>
          {[...groups].map(([name, sets]) => (
            <div key={name} className="row between">
              <span className="bold">{name}</span>
              <span className="muted bold">{sets.map((x) => (x.seconds ? `${x.seconds}s` : x.weight ? `${x.weight}×${x.reps}` : `${x.reps}`)).join(' · ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonalRecords() {
  const me = useMe();
  const db = useDB();
  const prs = personalRecords(db, me.id).filter((r) => r.kind === 'weight').slice(0, 6);
  if (!prs.length) return null;
  return (
    <Card>
      <div className="card-head"><div className="section-title"><Trophy size={17} /> Personal records</div></div>
      <div className="grid g3" style={{ gap: 12 }}>
        {prs.map((r) => (
          <div key={r.key} className="neu-inset-sm" style={{ padding: 14 }}>
            <div className="xs bold muted">{r.name}</div>
            <div className="heavy num" style={{ fontSize: 26 }}>{describeRecord(r)}</div>
            <div className="xs muted bold">≈ {r.e1rm} kg 1-rep max · {fmtDate(r.date)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Searchable exercise library; each exercise opens its how-to page (with a 3D demo where available). */
function ExerciseLibrary() {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | ''>('');
  const [open, setOpen] = useState<ExerciseInfo | null>(null);
  const list = EXERCISES.filter((e) => (!muscle || e.muscles.includes(muscle))
    && (!q || `${e.name} ${(e.aliases ?? []).join(' ')} ${e.equipment}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <Card className="col">
        <Input icon={<Search size={16} />} placeholder="Search exercises or equipment" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chip-row">
          <button className={cls('chip', !muscle && 'on')} onClick={() => setMuscle('')}>All</button>
          {MUSCLES.map((m) => <button key={m} className={cls('chip', muscle === m && 'on')} onClick={() => setMuscle(m)}>{m}</button>)}
        </div>
      </Card>
      {muscle && READY_CLIPS.has(FOCUS_DEMOS[muscle].clip) && (
        <Card className="col">
          <div className="section-title"><PlayCircle size={17} /> {muscle} · {FOCUS_DEMOS[muscle].label}</div>
          <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
            <DemoViewer key={muscle} clip={FOCUS_DEMOS[muscle].clip} props={FOCUS_DEMOS[muscle].props} muscles={FOCUS_DEMOS[muscle].muscles} />
          </div>
        </Card>
      )}
      <div className="grid g3">
        {list.map((e) => (
          <Card key={e.id} onClick={() => setOpen(e)}>
            <div className="row between">
              <div className="heavy">{e.name}</div>
              {demoFor(e) && <Badge tone="accent" icon={<PlayCircle size={11} />}>3D demo</Badge>}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>{e.muscles.join(' · ')}</div>
            <div className="xs bold muted" style={{ marginTop: 8 }}>{e.equipment}</div>
          </Card>
        ))}
        {list.length === 0 && <Card><Empty icon={<Dumbbell size={24} />} text="No exercises match" /></Card>}
      </div>
      {open && <ExerciseDetail ex={open} onClose={() => setOpen(null)} />}
    </>
  );
}
