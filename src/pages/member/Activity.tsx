import { celebrate, toast } from '../../lib/fx';
import { useState } from 'react';
import { AlertTriangle, Flame, Footprints, Gauge, MapPin, Pause, Play, Plus, Square, Timer, Trash2 } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { goalOf, latestWeight, stepsOn, weekSteps } from '../../lib/stats';
import { useTracker } from '../../lib/useTracker';
import { activityCalories, dayKey, fmtDuration, fmtPace, fmtTime, relTime, uid } from '../../lib/utils';
import { AnimatedNumber, Badge, Button, Card, Empty, IconButton, Input, Modal, PageHeader, Ring, Segmented } from '../../components/ui';
import { BarChart, RouteSketch } from '../../components/charts';

export default function Activity() {
  const me = useMe();
  const db = useDB();
  const [mode, setMode] = useState<'walk' | 'run'>('walk');
  const [manual, setManual] = useState(false);
  const [manualSteps, setManualSteps] = useState(3000);
  const t = useTracker(mode);
  const g = goalOf(db, me.id);
  const today = dayKey();
  const goal = g?.dailySteps ?? 8000;
  const todaySteps = stepsOn(db, me.id, today);
  const weight = latestWeight(db, me.id) || 65;
  const liveKcal = activityCalories(mode, t.durationSec, weight);
  const history = db.sessions.filter((s) => s.userId === me.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12);
  const weekTotal = weekSteps(db, me.id).reduce((a, d) => a + d.value, 0);

  const finish = () => {
    if (t.steps > 0 || t.durationSec > 10) {
      if (todaySteps < goal && todaySteps + t.steps >= goal) celebrate('Daily step goal smashed! 👟');
      else toast(`${mode === 'run' ? 'Run' : 'Walk'} saved · ${t.steps.toLocaleString()} steps`);
      update((d) => {
        d.sessions.push({
          id: uid(), userId: me.id, date: today, startedAt: new Date(Date.now() - t.durationSec * 1000).toISOString(), type: mode,
          steps: t.steps, distanceKm: +t.distanceKm.toFixed(2), durationSec: t.durationSec, calories: liveKcal, route: t.route.slice(0, 500),
        });
      });
    }
    t.reset();
  };

  const addManual = () => {
    const km = +(manualSteps * 0.00075).toFixed(2);
    const dur = Math.round(manualSteps / 1.7);
    update((d) => {
      d.sessions.push({ id: uid(), userId: me.id, date: today, startedAt: new Date().toISOString(), type: 'walk', steps: manualSteps, distanceKm: km, durationSec: dur, calories: activityCalories('walk', dur, weight) });
    });
    setManual(false);
    if (todaySteps < goal && todaySteps + manualSteps >= goal) celebrate('Daily step goal smashed! 👟');
    else toast(`${manualSteps.toLocaleString()} steps added`);
  };

  const live = t.status !== 'idle';

  return (
    <div className="page">
      <PageHeader title="Activity" subtitle="Track walks and runs with your phone's sensors"
        action={<Button icon={<Plus size={16} />} onClick={() => setManual(true)}>Add steps</Button>} />

      <div className="grid g3">
        <Card className="span2">
          <div className="row between wrap" style={{ marginBottom: 22 }}>
            <Segmented value={mode} onChange={(m) => !live && setMode(m)} options={[{ value: 'walk', label: '🚶 Walk' }, { value: 'run', label: '🏃 Run' }]} />
            {live && <Badge tone={t.status === 'running' ? 'green' : 'yellow'}>{t.status === 'running' ? '● Recording' : 'Paused'}</Badge>}
          </div>

          <div className="row wrap" style={{ justifyContent: 'space-around', gap: 28 }}>
            <Ring value={todaySteps + (live ? t.steps : 0)} max={goal} size={230} stroke={16}>
              <Footprints size={22} color="var(--accent)" />
              <div className="heavy num" style={{ fontSize: 48, lineHeight: 1.05 }}>{live ? t.steps.toLocaleString() : <AnimatedNumber value={todaySteps} />}</div>
              <div className="xs muted bold">{live ? 'steps this session' : `of ${goal.toLocaleString()} today`}</div>
            </Ring>

            <div className="col" style={{ minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}>
              <div className="grid g2" style={{ gap: 14 }}>
                {[
                  { icon: <MapPin size={16} />, label: 'Distance', value: `${t.distanceKm.toFixed(2)} km` },
                  { icon: <Timer size={16} />, label: 'Duration', value: fmtDuration(t.durationSec) },
                  { icon: <Gauge size={16} />, label: 'Pace /km', value: fmtPace(t.durationSec, t.distanceKm) },
                  { icon: <Flame size={16} />, label: 'Calories', value: `${liveKcal}` },
                ].map((m) => (
                  <div key={m.label} className="neu-inset-sm" style={{ padding: 14 }}>
                    <div className="row xs muted bold" style={{ gap: 6 }}>{m.icon}{m.label}</div>
                    <div className="heavy" style={{ fontSize: 19, marginTop: 4 }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'center', gap: 18, marginTop: 10 }}>
                {t.status === 'idle' && (
                  <button className="icon-btn lg accent pulsing" style={{ width: 78, height: 78 }} onClick={t.start} aria-label="Start"><Play size={30} /></button>
                )}
                {t.status === 'running' && <IconButton size="lg" onClick={t.pause} aria-label="Pause"><Pause size={26} /></IconButton>}
                {t.status === 'paused' && <button className="icon-btn lg accent" onClick={t.resume} aria-label="Resume"><Play size={26} /></button>}
                {live && <IconButton size="lg" onClick={finish} aria-label="Finish" style={{ color: 'var(--red)' }}><Square size={24} /></IconButton>}
              </div>
              <div className="xs muted center">
                {t.status === 'idle' ? 'Tap play and keep your phone in your pocket or hand.' : `${t.sensors.motion ? 'Motion sensor ✓' : 'Motion sensor —'} · ${t.sensors.gps ? 'GPS ✓' : 'Waiting for GPS…'}`}
              </div>
            </div>
          </div>
          {t.error && <div className="row small bold neu-inset-sm" style={{ padding: 12, marginTop: 18, color: 'var(--yellow)' }}><AlertTriangle size={16} />{t.error}</div>}
        </Card>

        <Card>
          <div className="card-head"><div className="section-title"><MapPin size={17} /> Route</div></div>
          <RouteSketch route={t.route.length ? t.route : history.find((h) => h.route && h.route.length > 1)?.route ?? []} size={220} />
          <div className="xs muted center" style={{ marginTop: 10 }}>{t.route.length ? 'Live route' : 'Start a session with GPS to draw your route'}</div>
        </Card>
      </div>

      <div className="grid g2">
        <Card>
          <div className="card-head">
            <div className="section-title">Last 7 days</div>
            <span className="small bold muted">{weekTotal.toLocaleString()} steps</span>
          </div>
          <BarChart data={weekSteps(db, me.id)} highlight={6} goal={goal} format={(v) => `${(v / 1000).toFixed(1)}k`} />
        </Card>
        <Card>
          <div className="card-head"><div className="section-title">History</div></div>
          {history.length === 0 && <Empty icon={<Footprints size={24} />} text="No sessions yet" />}
          <div style={{ maxHeight: 330, overflow: 'auto', padding: 6, margin: -6 }}>
            {history.map((s) => (
              <div key={s.id} className="neu-sm list-item">
                <div className="neu-inset-sm" style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', fontSize: 20 }}>{s.type === 'run' ? '🏃' : '🚶'}</div>
                <div className="grow">
                  <div className="bold">{s.steps.toLocaleString()} steps · {s.distanceKm} km</div>
                  <div className="xs muted bold">{relTime(s.startedAt)} · {fmtTime(s.startedAt)} · {fmtDuration(s.durationSec)} · {s.calories} kcal</div>
                </div>
                <IconButton size="sm" aria-label="Delete" onClick={() => update((d) => { d.sessions = d.sessions.filter((x) => x.id !== s.id); })}><Trash2 size={13} /></IconButton>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={manual} onClose={() => setManual(false)} title="Add steps manually"
        footer={<><Button onClick={() => setManual(false)}>Cancel</Button><Button variant="accent" onClick={addManual}>Add</Button></>}>
        <div className="col gap-lg">
          <div className="small muted">Walked without the app? Add steps from your watch or another tracker.</div>
          <Input label="Steps" type="number" step={100} value={manualSteps} onChange={(e) => setManualSteps(+e.target.value)} />
          <div className="chip-row">
            {[1000, 2500, 5000, 10000].map((n) => <button key={n} className={`chip ${manualSteps === n ? 'on' : ''}`} onClick={() => setManualSteps(n)}>{n.toLocaleString()}</button>)}
          </div>
        </div>
      </Modal>
    </div>
  );
}
