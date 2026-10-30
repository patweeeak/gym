import { toast } from '../../lib/fx';
import { Clock, Crown, Lock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { DAYS_LONG, isPremium } from '../../lib/utils';
import { Badge, Button, Card, PageHeader, Progress } from '../../components/ui';

export default function MemberClasses() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const premium = isPremium(me);
  const dow = new Date().getDay();
  // order the week starting from today
  const list = [...db.classes].sort((a, b) => ((a.day - dow + 7) % 7) - ((b.day - dow + 7) % 7) || a.time.localeCompare(b.time));
  const days = [...new Set(list.map((c) => c.day))];

  const toggle = (id: string) => {
    const c0 = db.classes.find((x) => x.id === id)!;
    const leaving = c0.attendees.includes(me.id);
    update((d) => {
      const c = d.classes.find((x) => x.id === id)!;
      c.attendees = leaving ? c.attendees.filter((a) => a !== me.id) : c.attendees.length < c.capacity ? [...c.attendees, me.id] : c.attendees;
    });
    toast(leaving ? `Cancelled ${c0.title}` : `Booked ${c0.title} · ${DAYS_LONG[c0.day]} ${c0.time}`, leaving ? 'info' : 'success');
  };

  return (
    <div className="page">
      <PageHeader title="Classes" subtitle="Book group classes for the week" />
      {days.map((d) => (
        <div key={d} className="col">
          <div className="section-title">{d === dow ? 'Today' : d === (dow + 1) % 7 ? 'Tomorrow' : DAYS_LONG[d]}</div>
          <div className="grid g3">
            {list.filter((c) => c.day === d).map((c) => {
              const coach = db.users.find((u) => u.id === c.instructorId);
              const booked = c.attendees.includes(me.id);
              const full = c.attendees.length >= c.capacity;
              const locked = c.premiumOnly && !premium;
              return (
                <Card key={c.id} style={booked ? { boxShadow: 'var(--inset)' } : undefined}>
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div className="row" style={{ minWidth: 0 }}>
                      <div style={{ width: 8, alignSelf: 'stretch', borderRadius: 5, background: c.color, minHeight: 42 }} />
                      <div style={{ minWidth: 0 }}>
                        <div className="heavy truncate">{c.title}</div>
                        <div className="small muted truncate">{coach?.name}</div>
                      </div>
                    </div>
                    {c.premiumOnly && <Badge tone="gold" icon={<Crown size={11} />}>Premium</Badge>}
                  </div>
                  <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
                    <Badge icon={<Clock size={11} />}>{c.time} · {c.durationMin}m</Badge>
                    <Badge tone={full ? 'red' : 'blue'} icon={<Users size={11} />}>{c.capacity - c.attendees.length} left</Badge>
                  </div>
                  <div style={{ margin: '14px 0' }}><Progress value={c.attendees.length} max={c.capacity} color={c.color} /></div>
                  {locked
                    ? <Button block icon={<Lock size={14} />} onClick={() => nav('/app/upgrade')}>Premium only</Button>
                    : <Button block variant={booked ? 'raised' : 'accent'} disabled={!booked && full} onClick={() => toggle(c.id)}>
                      {booked ? '✓ Booked — cancel' : full ? 'Class full' : 'Book spot'}
                    </Button>}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
