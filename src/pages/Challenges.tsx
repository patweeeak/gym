import { useEffect, useState } from 'react';
import { CalendarRange, Crown, Flag, Medal, Plus, Trash2, Trophy, Users } from 'lucide-react';
import { celebrate, toast } from '../lib/fx';
import { useMe } from '../lib/auth';
import { update, useDB } from '../lib/db';
import { METRICS, daysLeftLabel, fmtValue, isLive, isUpcoming, leaderboard, metricOf, progressFor, type Standing } from '../lib/challenges';
import type { Challenge, ChallengeMetric } from '../lib/types';
import { addDays, cls, dayKey, fmtDate } from '../lib/utils';
import { Avatar, Badge, Button, Card, Empty, Input, Modal, PageHeader, Progress, Select, Textarea } from '../components/ui';

const MEDAL = ['#f2a900', '#b8c0cc', '#c9814d'];

/** Gym challenges: members join and race on a leaderboard; staff create them. */
export default function Challenges() {
  const me = useMe();
  const db = useDB();
  const staff = me.role !== 'member';
  const today = dayKey();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Challenge | null>(null);
  const sorted = [...db.challenges].sort((a, b) => a.end.localeCompare(b.end));
  const live = sorted.filter((c) => isLive(c, today)), upcoming = sorted.filter((c) => isUpcoming(c, today));
  const past = sorted.filter((c) => c.end < today).reverse().slice(0, 6);
  const joined = (c: Challenge) => db.entries.some((e) => e.challengeId === c.id && e.userId === me.id);

  const join = (c: Challenge) => {
    update((d) => { d.entries.push({ id: `${c.id}|${me.id}`, challengeId: c.id, userId: me.id, joinedAt: new Date().toISOString() }); });
    toast(`You're in: ${c.title} 💪`);
  };
  const leave = (c: Challenge) => update((d) => { d.entries = d.entries.filter((e) => e.id !== `${c.id}|${me.id}`); });

  const card = (c: Challenge) => {
    const mine = progressFor(db, c, me.id), m = metricOf(c.metric), inIt = joined(c);
    const count = db.entries.filter((e) => e.challengeId === c.id).length;
    return (
      <Card key={c.id} onClick={() => setOpen(c)} className="col" style={{ gap: 10 }}>
        <div className="row between">
          <Badge tone={isLive(c, today) ? 'accent' : isUpcoming(c, today) ? 'blue' : 'muted'}>
            {isLive(c, today) ? daysLeftLabel(c.end, today) : isUpcoming(c, today) ? `Starts ${fmtDate(c.start)}` : 'Ended'}
          </Badge>
          <span className="xs bold muted row" style={{ gap: 4 }}><Users size={12} /> {count}</span>
        </div>
        <div className="heavy" style={{ fontSize: 18 }}>{c.title}</div>
        {c.description && <div className="small muted">{c.description}</div>}
        <div className="xs bold muted">Goal: {fmtValue(c.target, c.metric)} · {m.hint}</div>
        {!staff && inIt && (
          <div>
            <Progress value={Math.min(mine, c.target)} max={c.target} />
            <div className="xs bold" style={{ marginTop: 6 }}>{fmtValue(mine, c.metric)} of {fmtValue(c.target, c.metric)}{mine >= c.target ? ' · done! 🏆' : ''}</div>
          </div>
        )}
        {!staff && !inIt && c.end >= today && <Button variant="accent" icon={<Flag size={15} />} onClick={(e) => { e.stopPropagation(); join(c); }}>Join challenge</Button>}
      </Card>
    );
  };

  return (
    <div className="page">
      <PageHeader title="Challenges" subtitle={staff ? 'Run gym-wide challenges to keep members coming back' : 'Compete with the gym and earn your spot on the board'}
        action={staff && <Button variant="accent" icon={<Plus size={16} />} onClick={() => setCreating(true)}>New challenge</Button>} />
      {live.length === 0 && upcoming.length === 0 && (
        <Card><Empty icon={<Trophy size={26} />} text={staff ? 'No challenges running. Start one!' : 'No challenges right now — check back soon.'} /></Card>
      )}
      {live.length > 0 && <div className="grid g3">{live.map(card)}</div>}
      {upcoming.length > 0 && <><div className="section-title">Coming up</div><div className="grid g3">{upcoming.map(card)}</div></>}
      {past.length > 0 && <><div className="section-title">Finished</div><div className="grid g3">{past.map(card)}</div></>}

      {open && <ChallengeDetail c={open} onClose={() => setOpen(null)} joined={joined(open)} onLeave={() => { leave(open); setOpen(null); }} />}
      {creating && <CreateChallenge onClose={() => setCreating(false)} />}
    </div>
  );
}

function ChallengeDetail({ c, onClose, joined, onLeave }: { c: Challenge; onClose: () => void; joined: boolean; onLeave: () => void }) {
  const me = useMe();
  const db = useDB();
  const [board, setBoard] = useState<Standing[] | null>(null);
  const staff = me.role !== 'member';
  const entryCount = db.entries.filter((e) => e.challengeId === c.id).length;
  useEffect(() => {
    let on = true;
    leaderboard(db, c).then((b) => on && setBoard(b)).catch((e) => { toast((e as Error).message, 'error'); setBoard([]); });
    return () => { on = false; };
    // refresh when entries or the underlying activity change
  }, [c, entryCount, db.checkins.length, db.workoutLogs.length, db.sessions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const myRank = board ? board.findIndex((s) => s.userId === me.id) : -1;
  useEffect(() => {
    if (board && myRank === 0 && board[0].value >= c.target && sessionStorage.getItem(`won-${c.id}`) !== '1') {
      sessionStorage.setItem(`won-${c.id}`, '1');
      celebrate(`You're leading ${c.title}! 🏆`);
    }
  }, [board, myRank, c]);
  const remove = () => {
    if (!confirm(`Delete "${c.title}"?`)) return;
    update((d) => { d.challenges = d.challenges.filter((x) => x.id !== c.id); d.entries = d.entries.filter((e) => e.challengeId !== c.id); });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={c.title}
      footer={<>
        {staff && <Button variant="danger" icon={<Trash2 size={15} />} onClick={remove}>Delete</Button>}
        {!staff && joined && <Button onClick={onLeave}>Leave</Button>}
        <Button variant="accent" onClick={onClose}>Close</Button>
      </>}>
      <div className="col gap-lg">
        {c.description && <div className="small">{c.description}</div>}
        <div className="row wrap" style={{ gap: 6 }}>
          <Badge icon={<CalendarRange size={11} />}>{fmtDate(c.start)} – {fmtDate(c.end)}</Badge>
          <Badge tone="accent">Goal {fmtValue(c.target, c.metric)}</Badge>
          <Badge>{metricOf(c.metric).hint}</Badge>
        </div>
        <div className="section-title"><Medal size={17} /> Leaderboard</div>
        {board === null && <div className="small muted">Loading…</div>}
        {board?.length === 0 && <Empty icon={<Users size={24} />} text="Nobody has joined yet." />}
        <div className="col" style={{ gap: 6 }}>
          {board?.map((s, i) => (
            <div key={s.userId} className={cls('list-item', s.userId === me.id ? 'neu-inset-sm' : 'neu-sm')}>
              <span className="heavy num" style={{ width: 28, fontSize: 22, color: MEDAL[i] ?? 'var(--muted)' }}>{i + 1}</span>
              <Avatar name={s.name} color={s.color} size={34} />
              <div className="grow">
                <div className="bold">{s.name}{s.userId === me.id ? ' (you)' : ''}</div>
                <Progress value={Math.min(s.value, c.target)} max={c.target} />
              </div>
              <div className="small bold">{fmtValue(s.value, c.metric)}{s.value >= c.target && <Crown size={13} color="var(--yellow)" style={{ marginLeft: 4, verticalAlign: -1 }} />}</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function CreateChallenge({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const [f, setF] = useState({ title: '', description: '', metric: 'checkins' as ChallengeMetric, target: '12', start: dayKey(), end: dayKey(addDays(new Date(), 29)) });
  const [err, setErr] = useState('');
  const save = () => {
    const target = Number(f.target);
    if (!f.title.trim()) return setErr('Give the challenge a name.');
    if (!(target > 0)) return setErr('Set a goal above zero.');
    if (f.end < f.start) return setErr('The end date is before the start.');
    update((d) => {
      d.challenges.push({ id: `ch-${Date.now().toString(36)}`, title: f.title.trim(), description: f.description.trim() || undefined, metric: f.metric,
        target, start: f.start, end: f.end, createdBy: me.id, createdAt: new Date().toISOString() });
    });
    toast('Challenge created — members can join now');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="New challenge"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save}>Create</Button></>}>
      <div className="col gap-lg">
        <Input label="Name" placeholder="e.g. December Grind" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Textarea label="Description (optional)" placeholder="What's the prize? Any rules?" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="grid g2" style={{ gap: 14 }}>
          <Select label="Measured by" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value as ChallengeMetric })}>
            {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <Input label={`Goal (${metricOf(f.metric).unit})`} type="number" min="1" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
          <Input label="Starts" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
          <Input label="Ends" type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        </div>
        {err && <div className="small bold" style={{ color: 'var(--red)' }}>{err}</div>}
      </div>
    </Modal>
  );
}
