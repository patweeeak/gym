import { useEffect, useMemo, useState } from 'react';
import { Check, Info, Minus, Plus, Timer, Trophy, X } from 'lucide-react';
import { celebrate, haptic, toast } from '../lib/fx';
import { useMe } from '../lib/auth';
import { update, useDB } from '../lib/db';
import { EXERCISES, findExercise, logKindOf, type ExerciseInfo, type LogKind } from '../lib/exercises';
import { describeRecord, exerciseKey, newRecords, personalRecords } from '../lib/training';
import type { Exercise, LoggedSet } from '../lib/types';
import { cls, dayKey, fmtDuration, uid } from '../lib/utils';
import { ExerciseDetail } from './ExerciseDetail';
import { Button, Modal, Progress, Select } from './ui';

interface Row { weight: string; reps: string; seconds: string; done: boolean }
interface Block { name: string; kind: LogKind; target: string; rows: Row[] }

const firstNumber = (s: string) => Number(/\d+(\.\d+)?/.exec(s)?.[0] ?? '');
/** "45s" → 45, "10 min" → 600 */
const targetSeconds = (reps: string) => {
  const n = firstNumber(reps);
  return /min/i.test(reps) ? n * 60 : n;
};

/**
 * Logs a workout set by set: weight and reps (or time), a rest timer after each set, and personal
 * records on finish. Members without logging (basic plan) can still follow along.
 */
export function WorkoutLogger({ title, exercises, minutes, canLog, onClose, bodyWeight }: {
  title: string; exercises: Exercise[]; minutes: number; canLog: boolean; onClose: () => void; bodyWeight: number;
}) {
  const me = useMe();
  const db = useDB();
  // the last weight used per exercise, to pre-fill
  const lastWeight = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of [...db.workoutLogs].filter((x) => x.userId === me.id).sort((a, b) => a.date.localeCompare(b.date))) {
      for (const s of l.sets ?? []) if (s.weight) m.set(exerciseKey(s.exercise), s.weight);
    }
    return m;
  }, [db.workoutLogs, me.id]);
  const records = useMemo(() => new Map(personalRecords(db, me.id).map((r) => [r.key, r])), [db, me.id]);

  const blockFor = (name: string, sets: number, reps: string): Block => {
    const kind = logKindOf(name, reps);
    const w = lastWeight.get(exerciseKey(name));
    const row = (): Row => ({
      weight: kind === 'weight' && w ? String(w) : '',
      reps: kind === 'time' ? '1' : firstNumber(reps) ? String(firstNumber(reps)) : '',
      seconds: kind === 'time' && targetSeconds(reps) ? String(targetSeconds(reps)) : '',
      done: false,
    });
    return { name, kind, target: `${sets} × ${reps}`, rows: Array.from({ length: Math.max(1, Math.min(sets, 8)) }, row) };
  };
  const [blocks, setBlocks] = useState<Block[]>(() => exercises.map((e) => blockFor(e.name, e.sets, e.reps)));
  const [minutesIn, setMinutesIn] = useState(minutes);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [restLen, setRestLen] = useState(90);
  const [info, setInfo] = useState<ExerciseInfo | null>(null);
  const [adding, setAdding] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const restLeft = rest ? Math.max(0, Math.ceil((rest.until - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && restLeft === 0) {
      haptic([120, 80, 120]);
      toast('Rest over — next set! 💪', 'info');
      setRest(null);
    }
  }, [rest, restLeft]);

  const setRow = (bi: number, ri: number, patch: Partial<Row>) =>
    setBlocks((bs) => bs.map((b, i) => (i !== bi ? b : { ...b, rows: b.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) })));
  const toggleDone = (bi: number, ri: number) => {
    const row = blocks[bi].rows[ri];
    setRow(bi, ri, { done: !row.done });
    if (!row.done) { haptic(20); setRest({ until: Date.now() + restLen * 1000, total: restLen }); }
  };
  const addSet = (bi: number) => setBlocks((bs) => bs.map((b, i) => (i !== bi ? b : { ...b, rows: [...b.rows, { ...b.rows[b.rows.length - 1], done: false }] })));
  const removeBlock = (bi: number) => setBlocks((bs) => bs.filter((_, i) => i !== bi));
  const addExercise = (id: string) => {
    const ex = EXERCISES.find((e) => e.id === id);
    if (ex) setBlocks((bs) => [...bs, blockFor(ex.name, 3, ex.log === 'time' ? '30s' : '10')]);
    setAdding('');
  };

  const doneSets = blocks.flatMap((b) => b.rows.filter((r) => r.done).map((r): LoggedSet => ({
    exercise: b.name,
    reps: b.kind === 'time' ? 1 : Math.max(0, Math.round(Number(r.reps) || 0)),
    ...(b.kind === 'weight' && Number(r.weight) > 0 ? { weight: Number(r.weight) } : {}),
    ...(b.kind === 'time' ? { seconds: Math.max(0, Math.round(Number(r.seconds) || 0)) } : {}),
  })));
  const totalSets = blocks.reduce((n, b) => n + b.rows.length, 0);
  const volume = doneSets.reduce((v, s) => v + (s.weight ?? 0) * s.reps, 0);

  const finish = () => {
    const prs = newRecords(db, me.id, doneSets);
    update((d) => {
      d.workoutLogs.push({ id: uid(), userId: me.id, date: dayKey(), title, durationMin: minutesIn,
        calories: Math.round(5 * bodyWeight * (minutesIn / 60)), sets: doneSets });
    });
    if (prs.length) celebrate(`New PR${prs.length > 1 ? 's' : ''}! ${prs.map((p) => `${p.name} ${describeRecord(p)}`).join(' · ')} 🏆`);
    else celebrate(`${title} complete! 💪`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={title}
      footer={canLog
        ? <><Button onClick={onClose}>Close</Button><Button variant="accent" disabled={doneSets.length === 0} onClick={finish} icon={<Check size={16} />}>Finish & log</Button></>
        : <Button variant="accent" onClick={onClose}>Done</Button>}>
      <div className="col">
        <div className="row between small bold">
          <span className="row" style={{ gap: 6 }}><Timer size={15} /> {fmtDuration(Math.round((now - startedAt) / 1000))}</span>
          <span className="muted">{doneSets.length} / {totalSets} sets{volume ? ` · ${Math.round(volume).toLocaleString()} kg lifted` : ''}</span>
        </div>
        <Progress value={doneSets.length} max={Math.max(1, totalSets)} />

        {rest && (
          <div className="neu-inset-sm row between" style={{ padding: '10px 14px', marginTop: 4 }}>
            <span className="bold">Rest <span className="num" style={{ fontSize: 22, marginLeft: 6 }}>{Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}</span></span>
            <span className="row" style={{ gap: 6 }}>
              <button className="icon-btn sm" aria-label="15 seconds less" onClick={() => setRest({ ...rest, until: rest.until - 15000 })}><Minus size={14} /></button>
              <button className="icon-btn sm" aria-label="15 seconds more" onClick={() => setRest({ ...rest, until: rest.until + 15000 })}><Plus size={14} /></button>
              <Button size="sm" onClick={() => setRest(null)}>Skip</Button>
            </span>
          </div>
        )}

        {blocks.map((b, bi) => {
          const lib = findExercise(b.name), pr = records.get(exerciseKey(b.name));
          return (
            <div key={bi} className="neu-sm" style={{ padding: 14, borderRadius: 16, marginTop: 6 }}>
              <div className="row between">
                <div className="grow">
                  <div className="bold row" style={{ gap: 6 }}>
                    {b.name}
                    {lib && <button className="icon-btn sm" aria-label={`How to do ${b.name}`} style={{ width: 26, height: 26 }} onClick={() => setInfo(lib)}><Info size={13} /></button>}
                  </div>
                  <div className="xs muted bold">Target {b.target}{pr ? <> · <Trophy size={11} style={{ verticalAlign: -1 }} /> PR {describeRecord(pr)}</> : null}</div>
                </div>
                <button className="icon-btn sm" aria-label={`Remove ${b.name}`} onClick={() => removeBlock(bi)}><X size={14} /></button>
              </div>
              <div className="col" style={{ gap: 6, marginTop: 10 }}>
                {b.rows.map((r, ri) => (
                  <div key={ri} className={cls('row', 'set-row', r.done && 'done')} style={{ gap: 8 }}>
                    <span className="xs bold muted" style={{ width: 34 }}>Set {ri + 1}</span>
                    {b.kind === 'weight' && <SetInput value={r.weight} unit="kg" label="Weight" onChange={(v) => setRow(bi, ri, { weight: v })} step="2.5" />}
                    {b.kind !== 'time' && <SetInput value={r.reps} unit="reps" label="Reps" onChange={(v) => setRow(bi, ri, { reps: v })} />}
                    {b.kind === 'time' && <SetInput value={r.seconds} unit="sec" label="Seconds" onChange={(v) => setRow(bi, ri, { seconds: v })} step="5" />}
                    <button className={cls('check', r.done && 'on')} aria-label={`Set ${ri + 1} done`} onClick={() => toggleDone(bi, ri)}><Check size={15} /></button>
                  </div>
                ))}
              </div>
              <button className="btn flat sm" style={{ marginTop: 6 }} onClick={() => addSet(bi)}><Plus size={14} /> Add set</button>
            </div>
          );
        })}

        <Select label="Add exercise" value={adding} onChange={(e) => addExercise(e.target.value)}>
          <option value="">Choose an exercise…</option>
          {EXERCISES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>

        <div className="row between" style={{ marginTop: 6 }}>
          <span className="small bold muted">Rest between sets</span>
          <span className="row" style={{ gap: 6 }}>
            {[60, 90, 120, 180].map((s) => <button key={s} className={cls('chip', restLen === s && 'on')} onClick={() => setRestLen(s)}>{s < 120 ? `${s}s` : `${s / 60} min`}</button>)}
          </span>
        </div>
        {canLog && (
          <div className="row between">
            <span className="small bold muted">Duration</span>
            <span className="row" style={{ gap: 6 }}>
              <button className="icon-btn sm" aria-label="5 minutes less" onClick={() => setMinutesIn((m) => Math.max(5, m - 5))}><Minus size={14} /></button>
              <span className="bold" style={{ minWidth: 56, textAlign: 'center' }}>{minutesIn} min</span>
              <button className="icon-btn sm" aria-label="5 minutes more" onClick={() => setMinutesIn((m) => m + 5)}><Plus size={14} /></button>
            </span>
          </div>
        )}
      </div>
      {info && <ExerciseDetail ex={info} onClose={() => setInfo(null)} />}
    </Modal>
  );
}

function SetInput({ value, unit, label, onChange, step = '1' }: { value: string; unit: string; label: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="set-input">
      <input type="number" inputMode="decimal" min="0" step={step} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      <span className="xs muted bold">{unit}</span>
    </label>
  );
}
