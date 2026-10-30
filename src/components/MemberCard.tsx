import { Crown } from 'lucide-react';
import { useDB } from '../lib/db';
import type { User } from '../lib/types';
import { daysLeft, fmtDate, isPremium } from '../lib/utils';

/** Decorative check-in code derived from the member id (shown at the front desk). */
function CodeGrid({ seed }: { seed: string }) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const N = 11;
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 3 && y >= oy && y < oy + 3;
    return inBox(0, 0) || inBox(N - 3, 0) || inBox(0, N - 3);
  };
  const cells = Array.from({ length: N * N }, (_, i) => {
    const x = i % N, y = Math.floor(i / N);
    if (finder(x, y)) return true;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return (h >>> 0) % 100 < 48;
  });
  return <div className="qr">{cells.map((on, i) => <i key={i} className={on ? '' : 'off'} />)}</div>;
}

export default function MemberCard({ user }: { user: User }) {
  const db = useDB();
  const premium = isPremium(user);
  return (
    <div className={`member-card ${premium ? 'premium' : 'basic'}`}>
      <div className="row between" style={{ alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        <div>
          <div className="xs bold" style={{ opacity: 0.75, letterSpacing: '.12em', textTransform: 'uppercase' }}>{db.settings.gymName}</div>
          <div className="heavy" style={{ fontSize: 22, marginTop: 6 }}>{user.name}</div>
          <div className="row" style={{ gap: 6, marginTop: 10 }}>
            {premium
              ? <span className="badge gold"><Crown size={12} /> PREMIUM</span>
              : <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', boxShadow: 'none' }}>BASIC · PAY PER VISIT</span>}
          </div>
          <div className="small" style={{ opacity: 0.85, marginTop: 18 }}>
            {premium && user.subscriptionEnd ? <>Valid until <b>{fmtDate(user.subscriptionEnd)}</b> · {daysLeft(user)} days left</> : 'Show this at the front desk to check in'}
          </div>
          <div className="xs" style={{ opacity: 0.6, marginTop: 4, fontFamily: 'monospace' }}>ID {user.id.toUpperCase().slice(0, 10)}</div>
        </div>
        <CodeGrid seed={user.id} />
      </div>
    </div>
  );
}
