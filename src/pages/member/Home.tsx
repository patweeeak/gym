import { ChallengeCard } from '../../components/ChallengeCard';
import { celebrate, toast } from '../../lib/fx';
import { useNavigate } from 'react-router-dom';
import { Calculator, CalendarDays, ChevronRight, Crown, Droplets, Dumbbell, Flame, Footprints, Play, Ticket } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { caloriesOn, goalOf, goalProgress, latestWeight, stepsOn, streak, waterOn, weekSteps } from '../../lib/stats';
import { DAYS, DAYS_LONG, METRIC, MONTHS, dayKey, daysLeft, isPremium, money } from '../../lib/utils';
import { BarChart } from '../../components/charts';
import { AnimatedNumber, Badge, Button, Card, Locked, PageHeader, Progress, Ring, Stat, useIsMobile } from '../../components/ui';
import MemberCard from '../../components/MemberCard';
import { AnnouncementList } from '../Announcements';

export default function MemberHome() {
  const me = useMe();
  return isPremium(me) ? <PremiumHome /> : <BasicHome />;
}

function PremiumHome() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const today = dayKey();
  const g = goalOf(db, me.id);
  const steps = stepsOn(db, me.id, today);
  const kcal = caloriesOn(db, me.id, today);
  const water = waterOn(db, me.id, today);
  const w = latestWeight(db, me.id);
  const s = streak(db, me.id);
  const todaysPlan = db.plans.find((p) => p.memberId === me.id && p.day === new Date().getDay());
  const coach = db.users.find((u) => u.id === me.instructorId);
  const left = daysLeft(me);
  const mobile = useIsMobile();

  const addWater = () => {
    update((d) => { const k = `${me.id}|${today}`; d.water[k] = (d.water[k] ?? 0) + 1; });
    if (water + 1 === (g?.dailyWater ?? 8)) celebrate('Hydration goal reached! 💧');
    else toast(`+1 glass · ${water + 1} of ${g?.dailyWater ?? 8}`, 'info');
  };

  const now = new Date();
  const stepGoal = g?.dailySteps ?? 8000;
  const stepPct = Math.round(Math.min(1, steps / stepGoal) * 100);
  const week = weekSteps(db, me.id);
  const waterGoal = g?.dailyWater ?? 8;
  const kcalGoal = g?.dailyCalories ?? 2000;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{DAYS[now.getDay()]} · {now.getDate()} {MONTHS[now.getMonth()]} · {s}-day streak 🔥</div>
          <h1 className="display" style={{ marginTop: 8 }}>Let's move,<br /><span className="neon">{me.name.split(' ')[0]}.</span></h1>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {coach && <Badge tone="blue">Coach {coach.name.replace('Coach ', '').split(' ')[0]}</Badge>}
          <Badge tone={left <= 5 ? 'red' : 'gold'} icon={<Crown size={12} />}>{left} days left</Badge>
        </div>
      </div>

      {left <= 7 && (
        <Card className="row wrap between" onClick={() => nav('/app/upgrade')}>
          <div className="row">
            <div className="icon-btn" style={{ color: left <= 3 ? 'var(--red)' : 'var(--yellow)' }}><Crown size={20} /></div>
            <div>
              <div className="heavy">{left <= 0 ? 'Your membership ends today' : `Your membership ends in ${left} day${left === 1 ? '' : 's'}`}</div>
              <div className="small muted">Renew online with GCash, Maya or card to keep your plans and tracking.</div>
            </div>
          </div>
          <Button variant="accent" icon={<Crown size={15} />}>Renew online</Button>
        </Card>
      )}

      <ChallengeCard />

      <div className="grid g3">
        <Card className="span2 hero-steps" onClick={() => nav('/app/activity')}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Steps today</div>
            <div className="mega"><AnimatedNumber value={steps} /></div>
            <div className="small muted" style={{ marginTop: 8 }}>of {stepGoal.toLocaleString()} · <span className="neon bold">{stepPct}%</span></div>
            <div className="row" style={{ marginTop: 24 }}>
              <span className="play-btn"><Play size={22} /></span>
              <div><div className="bold">Start a run</div><div className="xs muted">Live steps · GPS route</div></div>
            </div>
          </div>
          <Ring value={steps} max={stepGoal} size={mobile ? 128 : 200} stroke={mobile ? 11 : 16} colors={METRIC.steps}>
            <Footprints size={mobile ? 18 : 24} color="var(--accent)" />
            <div className="heavy" style={{ fontSize: mobile ? 24 : 34 }}>{stepPct}%</div>
          </Ring>
        </Card>
        <Card>
          <div className="card-head">
            <div className="section-title">This week</div>
            <span className="xs muted bold">{(week.reduce((a, d) => a + d.value, 0) / 1000).toFixed(1)}k steps</span>
          </div>
          <BarChart data={week} highlight={6} goal={stepGoal} format={(v) => `${(v / 1000).toFixed(1)}k`} />
        </Card>
      </div>

      <div className="grid chips3">
        {[
          { label: 'Kcal', value: kcal, hint: `${Math.max(0, kcalGoal - kcal)} left`, color: METRIC.kcal[1], max: kcalGoal, onClick: () => nav('/app/diet'), fmt: undefined, dec: 0 },
          { label: 'Water', value: water, hint: 'Tap for +1 glass', color: METRIC.water[1], max: waterGoal, onClick: addWater, fmt: (n: number) => `${n}/${waterGoal}`, dec: 0 },
          { label: 'Kg', value: w, hint: g ? `Goal ${g.targetWeight} kg` : 'Set a goal', color: METRIC.weight[1], max: 0, onClick: () => nav('/app/goals'), fmt: (n: number) => n.toFixed(1), dec: 1 },
        ].map((m) => (
          <Card key={m.label} className="metric-chip" onClick={m.onClick}>
            <span className="dot" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}` }} />
            <div className="num" style={{ color: 'var(--text)' }}><AnimatedNumber value={m.value} format={m.fmt} decimals={m.dec} /></div>
            <div className="eyebrow">{m.label}</div>
            <div className="xs muted hint">{m.hint}</div>
            {m.max > 0 && <div style={{ marginTop: 6 }}><Progress value={m.value} max={m.max} color={`linear-gradient(90deg, ${m.color}88, ${m.color})`} /></div>}
          </Card>
        ))}
      </div>

      <div className="grid g3">
        <Card onClick={() => nav('/app/workouts')}>
          <div className="row">
            <span className="play-btn" style={{ animationDelay: '-1s' }}><Dumbbell size={20} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow">Today's workout</div>
              <div className="bold truncate" style={{ fontSize: 18, marginTop: 2 }}>{todaysPlan ? todaysPlan.title : 'Rest day'}</div>
              <div className="xs muted">{todaysPlan ? `${todaysPlan.exercises.length} exercises · from ${coach?.name.replace('Coach ', '') ?? 'your coach'}` : 'Light walk recommended 🚶'}</div>
            </div>
          </div>
          {todaysPlan && (
            <div className="col" style={{ marginTop: 16, gap: 8 }}>
              {todaysPlan.exercises.map((e) => (
                <div key={e.name} className="row between small neu-inset-sm" style={{ padding: '10px 12px' }}>
                  <span className="bold">{e.name}</span><span className="muted">{e.sets} × {e.reps}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="card-head">
            <div className="section-title">Goal progress</div>
            <Button size="sm" variant="flat" onClick={() => nav('/app/goals')}>Goals <ChevronRight size={14} /></Button>
          </div>
          {g ? (
            <div className="col gap-lg">
              <div className="row between">
                <div><div className="xs muted bold">START</div><div className="heavy">{g.startWeight} kg</div></div>
                <div className="center"><div className="xs muted bold">NOW</div><div className="heavy num grad-text" style={{ fontSize: 34 }}><AnimatedNumber value={w} decimals={1} /> kg</div></div>
                <div style={{ textAlign: 'right' }}><div className="xs muted bold">TARGET</div><div className="heavy">{g.targetWeight} kg</div></div>
              </div>
              <Progress value={goalProgress(g, w)} max={1} />
              <div className="small muted center">{Math.round(goalProgress(g, w) * 100)}% of the way there — keep going!</div>
            </div>
          ) : (
            <div className="col"><div className="muted small">You haven't set body goals yet.</div><Button variant="accent" onClick={() => nav('/app/goals')}>Set my goals</Button></div>
          )}
        </Card>

        <Card>
          <div className="card-head"><div className="section-title">Gym news</div></div>
          <AnnouncementList limit={2} />
        </Card>
      </div>
    </div>
  );
}

function BasicHome() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const cur = db.settings.currency;
  const now = new Date();
  const monthStart = dayKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const visits = db.checkins.filter((c) => c.userId === me.id && dayKey(new Date(c.at)) >= monthStart).length;
  const spent = db.payments.filter((p) => p.userId === me.id && p.date >= monthStart).reduce((a, p) => a + p.amount, 0);
  const breakEven = Math.ceil(db.settings.monthlyPrice / db.settings.dayPassPrice);
  const openClasses = db.classes.filter((c) => !c.premiumOnly).sort((a, b) => ((a.day - now.getDay() + 7) % 7) - ((b.day - now.getDay() + 7) % 7)).slice(0, 3);

  return (
    <div className="page">
      <PageHeader eyebrow={`${DAYS_LONG[now.getDay()]} · Basic member`} title={<>Ready to train,<br /><span className="neon">{me.name.split(' ')[0]}.</span></>} subtitle="Welcome back to the gym!" />

      <ChallengeCard />

      <div className="grid g2">
        <MemberCard user={me} />
        <Card className="col" style={{ justifyContent: 'space-between' }}>
          <div className="section-title"><Ticket size={17} /> This month</div>
          <div className="grid g2" style={{ gap: 14 }}>
            <div className="neu-inset-sm center" style={{ padding: 14 }}><div className="heavy num" style={{ fontSize: 34 }}>{visits}</div><div className="xs muted bold">visits</div></div>
            <div className="neu-inset-sm center" style={{ padding: 14 }}><div className="heavy num" style={{ fontSize: 34 }}>{money(spent, cur)}</div><div className="xs muted bold">on day passes</div></div>
          </div>
          <div className="small muted">
            Monthly is <b>{money(db.settings.monthlyPrice, cur)}</b> — it pays for itself after <b>{breakEven} visits</b> and unlocks tracking, goals and a personal coach.
          </div>
          <Button variant="accent" icon={<Crown size={16} />} onClick={() => nav('/app/upgrade')}>Go Premium</Button>
        </Card>
      </div>

      <div className="section-title">Your fitness dashboard</div>
      <Locked title="Track steps, diet & goals" text="Premium members get a live step tracker, meal log, body goals and coach-made workout plans.">
        <div className="grid g4">
          <Stat icon={<Footprints size={22} />} label="Steps today" value="6,842" />
          <Stat icon={<Flame size={22} />} label="Calories" value="1,420" color="var(--red)" />
          <Stat icon={<Droplets size={22} />} label="Water" value="5 / 8" color="var(--blue)" />
          <Stat icon={<Dumbbell size={22} />} label="Workouts" value="3 / wk" color="var(--purple)" />
        </div>
      </Locked>

      <div className="grid g3">
        <Card onClick={() => nav('/app/workouts')} className="row">
          <div className="icon-btn lg" style={{ color: 'var(--green)' }}><Dumbbell size={24} /></div>
          <div><div className="heavy">Starter workouts</div><div className="small muted">Free routines to follow</div></div>
        </Card>
        <Card onClick={() => nav('/app/tools')} className="row">
          <div className="icon-btn lg" style={{ color: 'var(--blue)' }}><Calculator size={24} /></div>
          <div><div className="heavy">Fitness calculators</div><div className="small muted">BMI, calories, 1-rep max</div></div>
        </Card>
        <Card onClick={() => nav('/app/classes')} className="row">
          <div className="icon-btn lg" style={{ color: 'var(--accent)' }}><CalendarDays size={24} /></div>
          <div><div className="heavy">Open classes</div><div className="small muted">Book a spot</div></div>
        </Card>
      </div>

      <div className="grid g2">
        <Card>
          <div className="card-head"><div className="section-title">Upcoming open classes</div></div>
          {openClasses.map((c) => (
            <div key={c.id} className="neu-sm list-item">
              <div style={{ width: 6, alignSelf: 'stretch', borderRadius: 4, background: c.color }} />
              <div className="grow"><div className="bold">{c.title}</div><div className="xs muted bold">{DAYS_LONG[c.day]} · {c.time}</div></div>
              <Badge tone="blue">{c.capacity - c.attendees.length} spots</Badge>
            </div>
          ))}
        </Card>
        <Card>
          <div className="card-head"><div className="section-title">Gym news</div></div>
          <AnnouncementList limit={3} />
        </Card>
      </div>
    </div>
  );
}
