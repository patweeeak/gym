import { celebrate, toast } from '../../lib/fx';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CreditCard, Crown, Hourglass, Loader2, Receipt, Ticket, X } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { remote, update, useDB } from '../../lib/db';
import { PAY_METHODS, confirmCheckout, methodLabel, paymentsTestMode, simulatePayment, startCheckout, type PayKind } from '../../lib/payments';
import { daysLeft, fmtDate, isPremium, money, uid } from '../../lib/utils';
import { Badge, Button, Card, Empty, Modal, PageHeader } from '../../components/ui';

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
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { monthlyPrice, dayPassPrice, currency } = db.settings;
  const premium = isPremium(me);
  const pending = db.requests.find((r) => r.userId === me.id && r.status === 'pending');
  const payments = db.payments.filter((p) => p.userId === me.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const [busy, setBusy] = useState<PayKind | null>(null);
  const [demo, setDemo] = useState<PayKind | null>(null);
  const [confirming, setConfirming] = useState(false);

  const request = () => {
    update((d) => { d.requests.push({ id: uid(), userId: me.id, createdAt: new Date().toISOString(), status: 'pending' }); });
    toast('Request sent! The front desk will confirm it.');
  };

  const pay = async (kind: PayKind) => {
    if (!remote) return setDemo(kind);
    setBusy(kind);
    try { await startCheckout(kind); } catch (e) { toast((e as Error).message, 'error'); setBusy(null); }
  };

  // back from the checkout page: confirm the payment (retrying briefly while it is still processing)
  const handled = useRef(false);
  useEffect(() => {
    const state = params.get('checkout');
    if (!state || handled.current) return;
    handled.current = true;
    nav('/app/upgrade', { replace: true });
    if (state === 'cancelled') { toast('Payment cancelled — nothing was charged.', 'info'); return; }
    setConfirming(true);
    (async () => {
      for (let i = 0; i < 6; i++) {
        try {
          const r = await confirmCheckout();
          if (!r || r.status === 'paid') {
            celebrate(r?.kind === 'daypass' ? 'Day pass paid — see you at the gym! 🎟️' : 'Payment received — Premium is active! 👑');
            break;
          }
          if (r.status === 'expired') { toast('That checkout expired. Please try again.', 'error'); break; }
        } catch (e) { toast((e as Error).message, 'error'); break; }
        await new Promise((res) => setTimeout(res, 2500));
      }
      setConfirming(false);
    })();
  }, [params, nav]);

  const payBtn = (kind: PayKind, label: string, variant: 'accent' | 'raised' = 'accent') => (
    <Button variant={variant} block disabled={!!busy || confirming} onClick={() => pay(kind)}
      icon={busy === kind ? <Loader2 size={16} className="spin" /> : kind === 'monthly' ? <Crown size={16} /> : <Ticket size={16} />}>
      {busy === kind ? 'Opening checkout…' : label}
    </Button>
  );

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHeader title="Membership" subtitle="Choose what fits your training" />

      {confirming && (
        <Card className="row"><Loader2 size={20} className="spin" /><div className="bold">Confirming your payment…</div></Card>
      )}

      {premium && (
        <Card className="row wrap between">
          <div className="row">
            <div className="icon-btn lg" style={{ color: 'var(--yellow)' }}><Crown size={26} /></div>
            <div><div className="heavy">You're Premium 🎉</div><div className="small muted">Valid until {fmtDate(me.subscriptionEnd!)} · {daysLeft(me)} days left.</div></div>
          </div>
          <div style={{ minWidth: 220 }}>{payBtn('monthly', `Renew online · ${money(monthlyPrice, currency)}`)}</div>
        </Card>
      )}

      <div className="row wrap" style={{ gap: 8 }}>
        <span className="xs bold muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>Pay online with</span>
        {PAY_METHODS.map((m) => <Badge key={m.value}>{m.label}</Badge>)}
        {paymentsTestMode && <Badge tone="yellow">Test mode · no real money</Badge>}
      </div>

      <div className="grid g2">
        <Card className="col gap-lg">
          <div>
            <Badge>BASIC</Badge>
            <div className="heavy num" style={{ fontSize: 42, marginTop: 10 }}>{money(dayPassPrice, currency)}<span className="small muted"> / visit</span></div>
            <div className="small muted">Pay only when you come in — at the desk, or online before you arrive.</div>
          </div>
          <div className="col" style={{ gap: 10 }}>
            {ROWS.map(([label, basic]) => (
              <div key={label} className="row small" style={{ opacity: basic ? 1 : 0.45 }}>
                <span className={basic ? 'check on' : 'check'} style={{ width: 22, height: 22, color: basic ? '#fff' : 'var(--faint)' }}>{basic ? <Check size={13} /> : <X size={12} />}</span>
                <span className="bold">{label}</span>
              </div>
            ))}
          </div>
          {!premium && payBtn('daypass', `Buy a day pass · ${money(dayPassPrice, currency)}`, 'raised')}
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
            <div className="col" style={{ position: 'relative', zIndex: 1, gap: 10 }}>
              {payBtn('monthly', `Pay ${money(monthlyPrice, currency)} online`)}
              {pending
                ? <div className="xs bold center" style={{ color: '#ffd36b' }}><Hourglass size={12} /> Front-desk request sent — or pay online now.</div>
                : <button className="btn flat sm" style={{ color: 'inherit', opacity: 0.8 }} onClick={request}>Pay at the front desk instead</button>}
            </div>
          )}
        </div>
      </div>

      <Card>
        <div className="card-head"><div className="section-title"><Receipt size={17} /> Payment history</div></div>
        {payments.length === 0 && <Empty icon={<CreditCard size={24} />} text="No payments yet" />}
        {payments.map((p) => (
          <div key={p.id} className="neu-sm list-item">
            <div className="icon-btn sm" style={{ color: p.kind === 'monthly' ? 'var(--yellow)' : 'var(--cyan)' }}>{p.kind === 'monthly' ? <Crown size={15} /> : <Ticket size={15} />}</div>
            <div className="grow">
              <div className="bold">{p.kind === 'monthly' ? 'Premium · 30 days' : 'Day pass'}</div>
              <div className="xs muted bold">{fmtDate(p.date)} · {p.online ? methodLabel(p.method) : 'Front desk'}</div>
            </div>
            <div className="heavy">{money(p.amount, currency)}</div>
          </div>
        ))}
      </Card>

      {demo && <DemoCheckout kind={demo} onClose={() => setDemo(null)} amount={money(demo === 'monthly' ? monthlyPrice : dayPassPrice, currency)}
        onPaid={(method) => {
          simulatePayment(me.id, demo, method);
          celebrate(demo === 'daypass' ? 'Day pass paid — see you at the gym! 🎟️' : 'Payment received — Premium is active! 👑');
          setDemo(null);
        }} />}
    </div>
  );
}

/** Offline demo mode: a stand-in for Xendit's checkout page. */
function DemoCheckout({ kind, amount, onClose, onPaid }: { kind: PayKind; amount: string; onClose: () => void; onPaid: (method: string) => void }) {
  const [method, setMethod] = useState('gcash');
  return (
    <Modal open onClose={onClose} title="Demo checkout"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="accent" onClick={() => onPaid(method)}>Pay {amount}</Button></>}>
      <div className="col gap-lg">
        <div className="small muted">Offline demo — no payment is made. With the online mode this opens Xendit's secure checkout.</div>
        <div className="bold">{kind === 'monthly' ? 'Premium · 30 days' : 'Day pass'} · {amount}</div>
        <div className="chip-row">
          {PAY_METHODS.map((m) => <button key={m.value} className={method === m.value ? 'chip on' : 'chip'} onClick={() => setMethod(m.value)}>{m.label}</button>)}
        </div>
      </div>
    </Modal>
  );
}
