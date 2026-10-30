import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, ClipboardCheck, Crown, Users } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { useDB } from '../../lib/db';
import { stepsOn } from '../../lib/stats';
import { DAYS_LONG, addDays, dayKey, greeting, isPremium } from '../../lib/utils';
import { Avatar, Badge, Card, Empty, PageHeader, Progress, Stat } from '../../components/ui';
import { AnnouncementList } from '../Announcements';

export default function CoachToday() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const today = dayKey();
  const dow = new Date().getDay();
  const mine = db.users.filter((u) => u.role === 'member' && u.instructorId === me.id);
  const myClasses = db.classes.filter((c) => c.instructorId === me.id && c.day === dow).sort((a, b) => a.time.localeCompare(b.time));
  const checkedIn = new Set(db.checkins.filter((c) => dayKey(new Date(c.at)) === today).map((c) => c.userId));

  // members with no logged activity in the last 3 days
  const since = dayKey(addDays(new Date(), -3));
  const quiet = mine.filter((u) =>
    !db.sessions.some((s) => s.userId === u.id && s.date >= since) && !db.workoutLogs.some((w) => w.userId === u.id && w.date >= since));

  return (
    <div className="page">
      <PageHeader eyebrow={`${DAYS_LONG[dow]} · ${me.specialty ?? 'Instructor'}`}
        title={<>Coach mode, <span className="neon">{me.name.replace('Coach ', '').split(' ')[0]}.</span></>} subtitle={`${greeting()} — here's your day.`} />

      <div className="grid g4">
        <Stat icon={<Users size={22} />} label="My members" value={mine.length} />
        <Stat icon={<Crown size={22} />} label="Premium" value={mine.filter(isPremium).length} color="var(--yellow)" />
        <Stat icon={<CalendarDays size={22} />} label="Classes today" value={myClasses.length} color="var(--blue)" />
        <Stat icon={<ClipboardCheck size={22} />} label="In the gym" value={mine.filter((u) => checkedIn.has(u.id)).length} color="var(--green)" />
      </div>

      <div className="grid g3">
        <Card>
          <div className="card-head"><div className="section-title">Today's classes</div></div>
          {myClasses.length === 0 && <Empty icon={<CalendarDays size={24} />} text="No classes today" />}
          {myClasses.map((c) => (
            <div key={c.id} className="neu-sm list-item" style={{ alignItems: 'stretch' }}>
              <div style={{ width: 6, borderRadius: 4, background: c.color }} />
              <div className="grow">
                <div className="bold">{c.title}</div>
                <div className="xs muted bold">{c.time} · {c.durationMin} min</div>
                <div style={{ marginTop: 8 }}><Progress value={c.attendees.length} max={c.capacity} /></div>
                <div className="xs muted" style={{ marginTop: 4 }}>{c.attendees.length}/{c.capacity} booked</div>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <div className="card-head">
            <div className="section-title">My members</div>
            <button className="btn flat sm" onClick={() => nav('/coach/members')}>All →</button>
          </div>
          {mine.length === 0 && <Empty icon={<Users size={24} />} text="No members assigned yet" />}
          {mine.slice(0, 6).map((u) => {
            const steps = stepsOn(db, u.id, today);
            return (
              <div key={u.id} className="neu-sm list-item" style={{ cursor: 'pointer' }} onClick={() => nav(`/coach/members/${u.id}`)}>
                <Avatar name={u.name} color={u.color} size={38} />
                <div className="grow">
                  <div className="bold truncate">{u.name}</div>
                  <div className="xs muted bold">{steps.toLocaleString()} steps today</div>
                </div>
                {checkedIn.has(u.id) && <Badge tone="green">In gym</Badge>}
              </div>
            );
          })}
        </Card>

        <div className="col gap-lg">
          <Card>
            <div className="card-head"><div className="section-title"><AlertCircle size={17} color="var(--yellow)" /> Needs a nudge</div></div>
            {quiet.length === 0
              ? <div className="small muted">Everyone's been active in the last 3 days. 🎉</div>
              : quiet.map((u) => (
                <div key={u.id} className="neu-sm list-item" style={{ cursor: 'pointer' }} onClick={() => nav(`/coach/members/${u.id}`)}>
                  <Avatar name={u.name} color={u.color} size={34} />
                  <div className="grow bold truncate">{u.name}</div>
                  <span className="xs muted">3+ days idle</span>
                </div>
              ))}
          </Card>
          <Card>
            <div className="card-head"><div className="section-title">Announcements</div></div>
            <AnnouncementList limit={2} />
          </Card>
        </div>
      </div>
    </div>
  );
}
