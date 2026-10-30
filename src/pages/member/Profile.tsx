import { Award, CalendarCheck, Dumbbell, Footprints, LogOut, Mail, Moon, Phone, Zap } from 'lucide-react';
import { useAuth, useMe } from '../../lib/auth';
import { useDB } from '../../lib/db';
import { streak } from '../../lib/stats';
import { cls, fmtDate, dayKey, isPremium } from '../../lib/utils';
import { Button, Card, PageHeader, Stat, Toggle } from '../../components/ui';
import MemberCard from '../../components/MemberCard';
import { useTheme } from '../../components/Shell';

export default function Profile() {
  const me = useMe();
  const db = useDB();
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const visits = db.checkins.filter((c) => c.userId === me.id).length;
  const workouts = db.workoutLogs.filter((w) => w.userId === me.id).length;
  const steps = db.sessions.filter((s) => s.userId === me.id).reduce((a, s) => a + s.steps, 0);
  const s = streak(db, me.id);
  const coach = db.users.find((u) => u.id === me.instructorId);

  const badges = [
    { label: 'First visit', on: visits >= 1, emoji: '🏁' },
    { label: '10 visits', on: visits >= 10, emoji: '🔟' },
    { label: '3-day streak', on: s >= 3, emoji: '🔥' },
    { label: '100k steps', on: steps >= 100000, emoji: '👟' },
    { label: '10 workouts', on: workouts >= 10, emoji: '🏋️' },
    { label: 'Premium', on: isPremium(me), emoji: '👑' },
  ];

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHeader title="Profile" />
      <div className="grid g2">
        <MemberCard user={me} />
        <Card className="col gap-lg">
          <div className="row small"><Mail size={16} className="muted" /> {me.email}</div>
          {me.phone && <div className="row small"><Phone size={16} className="muted" /> {me.phone}</div>}
          <div className="row small"><CalendarCheck size={16} className="muted" /> Member since {fmtDate(dayKey(new Date(me.createdAt)))}</div>
          {coach && <div className="row small"><Dumbbell size={16} className="muted" /> Coach: <b>{coach.name}</b></div>}
          <div className="divider" />
          <div className="row between"><span className="row bold small"><Moon size={16} /> Dark mode</span><Toggle checked={theme === 'dark'} onChange={toggle} /></div>
          <Button variant="danger" icon={<LogOut size={16} />} onClick={logout}>Log out</Button>
        </Card>
      </div>
      <div className="grid g4">
        <Stat icon={<CalendarCheck size={22} />} label="Gym visits" value={visits} />
        <Stat icon={<Zap size={22} />} label="Day streak" value={s} color="var(--yellow)" />
        <Stat icon={<Dumbbell size={22} />} label="Workouts" value={workouts} color="var(--purple)" />
        <Stat icon={<Footprints size={22} />} label="Total steps" value={steps >= 1000 ? `${(steps / 1000).toFixed(0)}k` : steps} color="var(--green)" />
      </div>
      <Card>
        <div className="section-title" style={{ marginBottom: 16 }}><Award size={18} /> Achievements</div>
        <div className="grid g3" style={{ gap: 14 }}>
          {badges.map((b) => (
            <div key={b.label} className={cls('center', b.on ? 'neu-sm' : 'neu-inset-sm')} style={{ padding: 16, opacity: b.on ? 1 : 0.5 }}>
              <div style={{ fontSize: 30, filter: b.on ? undefined : 'grayscale(1)' }}>{b.emoji}</div>
              <div className="small bold" style={{ marginTop: 6 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
