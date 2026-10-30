import { celebrate, toast } from '../../lib/fx';
import { useState } from 'react';
import { Check, Clock, Dumbbell, Lock, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { LIBRARY } from '../../lib/library';
import { goalOf, latestWeight, workoutsThisWeek } from '../../lib/stats';
import type { Exercise } from '../../lib/types';
import { DAYS, DAYS_LONG, cls, dayKey, fmtDate, isPremium, parseDay, uid } from '../../lib/utils';
import { Badge, Button, Card, Empty, Input, Locked, Modal, PageHeader, Progress, Segmented } from '../../components/ui';

interface Session { title: string; exercises: Exercise[]; minutes: number }

export default function Workouts() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const premium = isPremium(me);
  const [tab, setTab] = useState<'plan' | 'library' | 'history'>(premium ? 'plan' : 'library');
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
          { value: 'library', label: 'Library' },
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

      {tab === 'history' && (premium ? (
        <Card>
          {logs.length === 0 && <Empty icon={<Dumbbell size={26} />} text="No workouts logged yet." />}
          {logs.slice(0, 30).map((l) => (
            <div key={l.id} className="neu-sm list-item">
              <div className="neu-inset-sm center" style={{ width: 46, height: 46, display: 'grid', placeItems: 'center' }}><Check size={18} color="var(--green)" /></div>
              <div className="grow"><div className="bold">{l.title}</div><div className="xs muted bold">{fmtDate(l.date)} · {DAYS[parseDay(l.date).getDay()]}</div></div>
              <div className="small bold muted">{l.durationMin} min · {l.calories} kcal</div>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="center"><Empty icon={<Lock size={24} />} text="Workout history is a Premium feature"><Button variant="accent" onClick={() => nav('/app/upgrade')}>Go Premium</Button></Empty></Card>
      ))}

      {active && <WorkoutSession session={active} canLog={premium} onClose={() => setActive(null)} weight={latestWeight(db, me.id) || 65} />}
    </div>
  );
}

function WorkoutSession({ session, canLog, onClose, weight }: { session: Session; canLog: boolean; onClose: () => void; weight: number }) {
  const me = useMe();
  const [done, setDone] = useState<boolean[]>(session.exercises.map(() => false));
  const [minutes, setMinutes] = useState(session.minutes);
  const count = done.filter(Boolean).length;

  const finish = () => {
    update((d) => {
      d.workoutLogs.push({ id: uid(), userId: me.id, date: dayKey(), title: session.title, durationMin: minutes, calories: Math.round(5 * weight * (minutes / 60)) });
    });
    celebrate(`${session.title} complete! 💪`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={session.title}
      footer={canLog
        ? <><Button onClick={onClose}>Close</Button><Button variant="accent" disabled={count === 0} onClick={finish} icon={<Check size={16} />}>Finish & log</Button></>
        : <Button variant="accent" onClick={onClose}>Done</Button>}>
      <div className="col">
        <Progress value={count} max={session.exercises.length} />
        <div className="xs muted bold">{count} / {session.exercises.length} done</div>
        {session.exercises.map((e, i) => (
          <div key={i} className={cls('list-item', done[i] ? 'neu-inset-sm' : 'neu-sm')} style={{ cursor: 'pointer', marginTop: 4 }} onClick={() => {
            const next = done.map((v, j) => (j === i ? !v : v));
            setDone(next);
            if (next.every(Boolean) && !done.every(Boolean)) toast('All exercises done — finish to log it!', 'celebrate');
          }}>
            <span className={cls('check', done[i] && 'on')}><Check size={15} /></span>
            <div className="grow"><div className="bold" style={{ textDecoration: done[i] ? 'line-through' : undefined, opacity: done[i] ? 0.6 : 1 }}>{e.name}</div></div>
            <span className="small bold muted">{e.sets} × {e.reps}</span>
          </div>
        ))}
        {canLog && <div style={{ marginTop: 8 }}><Input label="Duration (min)" type="number" value={minutes} onChange={(e) => setMinutes(+e.target.value)} /></div>}
      </div>
    </Modal>
  );
}
