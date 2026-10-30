import { toast } from '../../lib/fx';
import { Check, Crown, Hourglass, X } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { daysLeft, fmtDate, isPremium, money, uid } from '../../lib/utils';
import { Badge, Button, Card, PageHeader } from '../../components/ui';

const ROWS: [string, boolean, boolean][] = [
  ['Gym floor access', true, true],
  ['Open group classes', true, true],
  ['Starter workout library', true, true],
  ['BMI & calorie calculators', true, true],
  ['Digital check-in card', true, true],
  ['Unlimited visits (no day pass)', false, true],
  ['Live run & walk step tracker', false, true],
  ['Diet & water tracker', false, true],
  ['Body goals & weight trend', false, true],
  ['Personal coach & weekly plans', false, true],
  ['Premium-only classes', false, true],
  ['Full workout library & history', false, true],
];

export default function Upgrade() {
  const me = useMe();
  const db = useDB();
  const { monthlyPrice, dayPassPrice, currency } = db.settings;
  const premium = isPremium(me);
  const pending = db.requests.find((r) => r.userId === me.id && r.status === 'pending');

  const request = () => {
    update((d) => { d.requests.push({ id: uid(), userId: me.id, createdAt: new Date().toISOString(), status: 'pending' }); });
    toast('Request sent! The front desk will confirm it.');
  };

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHeader title="Membership" subtitle="Choose what fits your training" />

      {premium && (
        <Card className="row wrap between">
          <div className="row">
            <div className="icon-btn lg" style={{ color: 'var(--yellow)' }}><Crown size={26} /></div>
            <div><div className="heavy">You're Premium 🎉</div><div className="small muted">Valid until {fmtDate(me.subscriptionEnd!)} · {daysLeft(me)} days left. Renew at the front desk.</div></div>
          </div>
          {!pending ? <Button onClick={request}>Request renewal</Button> : <Badge tone="yellow" icon={<Hourglass size={12} />}>Renewal requested</Badge>}
        </Card>
      )}

      <div className="grid g2">
        <Card className="col gap-lg">
          <div>
            <Badge>BASIC</Badge>
            <div className="heavy num" style={{ fontSize: 42, marginTop: 10 }}>{money(dayPassPrice, currency)}<span className="small muted"> / visit</span></div>
            <div className="small muted">Pay only when you come in.</div>
          </div>
          <div className="col" style={{ gap: 10 }}>
            {ROWS.map(([label, basic]) => (
              <div key={label} className="row small" style={{ opacity: basic ? 1 : 0.45 }}>
                <span className={basic ? 'check on' : 'check'} style={{ width: 22, height: 22, color: basic ? '#fff' : 'var(--faint)' }}>{basic ? <Check size={13} /> : <X size={12} />}</span>
                <span className="bold">{label}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="member-card premium col gap-lg" style={{ padding: 24 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <span className="badge gold"><Crown size={12} /> PREMIUM MONTHLY</span>
            <div className="heavy num" style={{ fontSize: 42, marginTop: 10 }}>{money(monthlyPrice, currency)}<span className="small" style={{ opacity: 0.7 }}> / month</span></div>
            <div className="small" style={{ opacity: 0.75 }}>Pays for itself after {Math.ceil(monthlyPrice / dayPassPrice)} visits.</div>
          </div>
          <div className="col" style={{ gap: 10, position: 'relative', zIndex: 1 }}>
            {ROWS.map(([label]) => (
              <div key={label} className="row small">
                <span className="check on" style={{ width: 22, height: 22, boxShadow: 'none' }}><Check size={13} /></span>
                <span className="bold">{label}</span>
              </div>
            ))}
          </div>
          {!premium && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              {pending
                ? <div className="neu-inset-sm row small bold" style={{ padding: 14, background: 'rgba(255,255,255,.08)', boxShadow: 'none', color: '#ffd36b' }}><Hourglass size={16} /> Request sent — pay at the front desk to activate.</div>
                : <Button variant="accent" block onClick={request} icon={<Crown size={16} />}>Request upgrade</Button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
