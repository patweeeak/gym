import { useState, type FormEvent } from 'react';
import { BicepsFlexed, Crown, Lock, Mail, Shield, User, UserCog } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useDB } from '../lib/db';
import { Button, Input } from '../components/ui';
import { useTheme } from '../components/Shell';

const DEMOS = [
  { label: 'Owner', email: 'owner@gym.com', pw: 'admin123', icon: <Shield size={15} /> },
  { label: 'Coach', email: 'coach@gym.com', pw: 'coach123', icon: <UserCog size={15} /> },
  { label: 'Premium', email: 'maria@gym.com', pw: 'member123', icon: <Crown size={15} /> },
  { label: 'Basic', email: 'juan@gym.com', pw: 'member123', icon: <User size={15} /> },
];

export default function Login() {
  useTheme();
  const { login } = useAuth();
  const db = useDB();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErr(login(email, pw));
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }} className="col gap-lg">
        <div className="center col" style={{ alignItems: 'center', gap: 16, marginBottom: 6 }}>
          <div className="neu floaty" style={{ width: 112, height: 112, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
            <div className="brand-logo" style={{ width: 72, height: 72, borderRadius: '50%' }}><BicepsFlexed size={36} /></div>
          </div>
          <div>
            <h1 className="num neon" style={{ fontSize: 64, lineHeight: 0.9 }}>{db.settings.gymName}</h1>
            <p className="eyebrow" style={{ marginTop: 10 }}>Train harder · Track everything</p>
          </div>
        </div>

        <form onSubmit={submit} className="neu card col gap-lg" style={{ padding: 26 }}>
          <Input label="Email" type="email" icon={<Mail size={17} />} placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" type="password" icon={<Lock size={17} />} placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="current-password" />
          {err && <div className="small bold" style={{ color: 'var(--red)' }}>{err}</div>}
          <Button variant="accent" block type="submit" style={{ padding: 15 }}>Sign in</Button>
          <p className="xs muted center">Accounts are created by the gym. Ask the front desk to register you.</p>
        </form>

        <div className="col" style={{ gap: 10 }}>
          <div className="xs bold muted center" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>Demo accounts — tap to fill</div>
          <div className="chip-row" style={{ justifyContent: 'center' }}>
            {DEMOS.map((d) => (
              <button key={d.label} className="chip row" style={{ gap: 6 }} onClick={() => { setEmail(d.email); setPw(d.pw); setErr(null); }}>
                {d.icon}{d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
