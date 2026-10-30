import { toast } from '../lib/fx';
import { useState } from 'react';
import { Check, ClipboardCheck, Search, Ticket } from 'lucide-react';
import { useMe } from '../lib/auth';
import { update, useDB } from '../lib/db';
import { dayKey, fmtTime, isPremium, memberStatus, money, uid } from '../lib/utils';
import { Avatar, Badge, Button, Card, Empty, Input, PageHeader, Stat } from '../components/ui';

export default function CheckInDesk() {
  useMe();
  const db = useDB();
  const [q, setQ] = useState('');
  const today = dayKey();
  const todays = db.checkins.filter((c) => dayKey(new Date(c.at)) === today).sort((a, b) => b.at.localeCompare(a.at));
  const inToday = new Set(todays.map((c) => c.userId));
  const members = db.users
    .filter((u) => u.role === 'member' && u.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(inToday.has(a.id)) - Number(inToday.has(b.id)) || a.name.localeCompare(b.name));

  const checkIn = (userId: string) => {
    const u = db.users.find((x) => x.id === userId)!;
    const dayPass = !isPremium(u);
    update((d) => {
      d.checkins.push({ id: uid(), userId, at: new Date().toISOString(), dayPass });
      if (dayPass) d.payments.push({ id: uid(), userId, amount: d.settings.dayPassPrice, date: today, kind: 'daypass' });
    });
    toast(`${u.name} checked in${dayPass ? ' · day pass charged' : ''}`);
  };

  const passes = todays.filter((c) => c.dayPass).length;

  return (
    <div className="page">
      <PageHeader title="Check-in Desk" subtitle="Log arrivals. Basic members are charged a day pass automatically." />
      <div className="grid g3">
        <Stat icon={<ClipboardCheck size={22} />} label="Check-ins today" value={todays.length} />
        <Stat icon={<Ticket size={22} />} label="Day passes sold" value={passes} color="var(--blue)" />
        <Stat icon={<span className="heavy">₱</span>} label="Day pass revenue" value={money(passes * db.settings.dayPassPrice, db.settings.currency)} color="var(--green)" />
      </div>
      <div className="grid g2">
        <Card>
          <div className="card-head"><div className="section-title">Members</div></div>
          <Input icon={<Search size={17} />} placeholder="Search member…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div style={{ marginTop: 18 }}>
            {members.map((u) => {
              const st = memberStatus(u);
              return (
                <div key={u.id} className="neu-sm list-item">
                  <Avatar name={u.name} color={u.color} size={38} />
                  <div className="grow">
                    <div className="bold truncate">{u.name}</div>
                    <Badge tone={st === 'premium' ? 'gold' : st === 'expired' ? 'red' : 'muted'}>{st === 'premium' ? 'Premium' : st === 'expired' ? 'Expired' : 'Basic'}</Badge>
                  </div>
                  {inToday.has(u.id)
                    ? <Badge tone="green" icon={<Check size={12} />}>In</Badge>
                    : <Button size="sm" variant="accent" onClick={() => checkIn(u.id)}>Check in</Button>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <div className="card-head"><div className="section-title">Today's log</div></div>
          {todays.length === 0 && <Empty icon={<ClipboardCheck size={26} />} text="No one has checked in yet." />}
          {todays.map((c) => {
            const u = db.users.find((x) => x.id === c.userId);
            return u && (
              <div key={c.id} className="neu-sm list-item">
                <Avatar name={u.name} color={u.color} size={34} />
                <div className="grow bold truncate">{u.name}</div>
                {c.dayPass && <Badge tone="blue">Day pass</Badge>}
                <span className="small muted bold">{fmtTime(c.at)}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
