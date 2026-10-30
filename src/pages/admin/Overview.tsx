import { applyPayment } from '../../lib/payments';
import { toast } from '../../lib/fx';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ClipboardCheck, Crown, RefreshCw, TrendingUp, UserCog, Users, X } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { DAYS_LONG, METRIC, MONTHS, daysLeft, dayKey, fmtTime, greeting, isPremium, money, relTime } from '../../lib/utils';
import { AnimatedNumber, Avatar, Badge, Button, Card, Empty, PageHeader, Ring, Stat } from '../../components/ui';
import { BarChart } from '../../components/charts';

export function renewMembership(userId: string) {
  update((d) => applyPayment(d, userId, 'monthly'));
  toast('Membership active for 30 more days 👑');
}

export default function AdminOverview() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const cur = db.settings.currency;
  const members = db.users.filter((u) => u.role === 'member');
  const premium = members.filter(isPremium);
  const today = dayKey();
  const todays = db.checkins.filter((c) => dayKey(new Date(c.at)) === today);
  const now = new Date();

  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const revenue = months.map((m) => ({
    label: MONTHS[m.getMonth()],
    value: db.payments.filter((p) => { const d = new Date(p.date); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); })
      .reduce((s, p) => s + p.amount, 0),
  }));
  const thisMonth = revenue[5].value, lastMonth = revenue[4].value;
  const growth = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;

  const pending = db.requests.filter((r) => r.status === 'pending');
  const expiring = members.filter((u) => u.plan === 'monthly' && daysLeft(u) <= 7).sort((a, b) => daysLeft(a) - daysLeft(b));
  const userOf = (id: string) => db.users.find((u) => u.id === id)!;

  return (
    <div className="page">
      <PageHeader eyebrow={`${DAYS_LONG[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()} · owner dashboard`}
        title={<>{greeting()}, <span className="neon">{me.name.split(' ')[0]}.</span></>} subtitle={`Here's how ${db.settings.gymName} is doing today.`} />

      <div className="grid g4">
        <Stat icon={<Users size={22} />} label="Total members" value={members.length} sub={`${members.length - premium.length} basic`} />
        <Stat icon={<Crown size={22} />} label="Active premium" value={premium.length} color="var(--yellow)" sub={`${expiring.length} expiring soon`} />
        <Stat icon={<UserCog size={22} />} label="Instructors" value={db.users.filter((u) => u.role === 'instructor').length} color="var(--purple)" />
        <Stat icon={<ClipboardCheck size={22} />} label="Check-ins today" value={todays.length} color="var(--green)" />
      </div>

      <div className="grid g3">
        <Card className="span2">
          <div className="card-head">
            <div>
              <div className="section-title">Revenue</div>
              <div className="row" style={{ gap: 10, marginTop: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 800 }}><AnimatedNumber value={thisMonth} format={(n) => money(n, cur)} /></span>
                <Badge tone={growth >= 0 ? 'green' : 'red'} icon={<TrendingUp size={12} />}>{growth >= 0 ? '+' : ''}{growth}% vs last month</Badge>
              </div>
            </div>
          </div>
          <BarChart data={revenue} highlight={5} format={(v) => `${cur}${(v / 1000).toFixed(1)}k`} />
        </Card>
        <Card>
          <div className="section-title" style={{ marginBottom: 18 }}>Membership mix</div>
          <div className="col" style={{ alignItems: 'center', gap: 18 }}>
            <Ring value={premium.length} max={members.length || 1} size={170} colors={METRIC.gold}>
              <div style={{ fontSize: 30, fontWeight: 800 }}>{members.length ? Math.round((premium.length / members.length) * 100) : 0}%</div>
              <div className="xs muted bold">premium</div>
            </Ring>
            <div className="row" style={{ gap: 18 }}>
              <span className="row small bold" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 5, background: '#ffb400', boxShadow: '0 0 8px #ffb400' }} />Premium {premium.length}</span>
              <span className="row small bold" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--track)' }} />Basic {members.length - premium.length}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid g3">
        <Card>
          <div className="card-head">
            <div className="section-title">Upgrade requests</div>
            {pending.length > 0 && <Badge tone="accent">{pending.length}</Badge>}
          </div>
          {pending.length === 0 && <Empty icon={<Crown size={24} />} text="No pending requests" />}
          {pending.map((r) => {
            const u = userOf(r.userId);
            return (
              <div key={r.id} className="neu-sm list-item">
                <Avatar name={u.name} color={u.color} size={38} />
                <div className="grow">
                  <div className="bold truncate">{u.name}</div>
                  <div className="xs muted">{relTime(r.createdAt)}</div>
                </div>
                <button className="icon-btn sm" style={{ color: 'var(--green)' }} title="Approve & record payment" onClick={() => renewMembership(u.id)}><Check size={16} /></button>
                <button className="icon-btn sm" style={{ color: 'var(--red)' }} title="Decline" onClick={() => { update((d) => { d.requests.find((x) => x.id === r.id)!.status = 'declined'; }); toast('Request declined', 'info'); }}><X size={16} /></button>
              </div>
            );
          })}
        </Card>

        <Card>
          <div className="card-head"><div className="section-title"><AlertTriangle size={17} color="var(--yellow)" /> Expiring / expired</div></div>
          {expiring.length === 0 && <Empty icon={<Check size={24} />} text="All subscriptions healthy" />}
          {expiring.map((u) => {
            const left = daysLeft(u);
            return (
              <div key={u.id} className="neu-sm list-item">
                <Avatar name={u.name} color={u.color} size={38} />
                <div className="grow">
                  <div className="bold truncate">{u.name}</div>
                  <div className="xs bold" style={{ color: left < 0 ? 'var(--red)' : 'var(--yellow)' }}>{left < 0 ? `Expired ${-left}d ago` : left === 0 ? 'Ends today' : `${left} days left`}</div>
                </div>
                <Button size="sm" icon={<RefreshCw size={13} />} onClick={() => renewMembership(u.id)}>Renew</Button>
              </div>
            );
          })}
        </Card>

        <Card>
          <div className="card-head">
            <div className="section-title">Recent check-ins</div>
            <Button size="sm" variant="flat" onClick={() => nav('/admin/checkin')}>Desk →</Button>
          </div>
          {todays.length === 0 && <Empty icon={<ClipboardCheck size={24} />} text="No check-ins yet today" />}
          {[...todays].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((c) => {
            const u = userOf(c.userId);
            return u && (
              <div key={c.id} className="neu-sm list-item">
                <Avatar name={u.name} color={u.color} size={34} />
                <div className="grow bold truncate">{u.name}</div>
                <span className="xs muted bold">{fmtTime(c.at)}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
