import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Footprints, Target, Utensils, Check } from 'lucide-react';
import { Button, Card, Ring } from '../../components/ui';

const FEATURES: Record<string, { title: string; icon: ReactNode; points: string[] }> = {
  activity: { title: 'Run & Walk Tracker', icon: <Footprints size={34} />, points: ['Live step counter using your phone sensors', 'GPS distance, pace and route sketch', 'Weekly step history and streaks'] },
  diet: { title: 'Diet Tracker', icon: <Utensils size={34} />, points: ['Log meals with a Filipino-friendly food list', 'Calories and macros vs. your daily target', 'Water intake tracker'] },
  goals: { title: 'Body Goals', icon: <Target size={34} />, points: ['Set weight, calorie, step and workout targets', 'Weight trend chart and BMI', 'Your coach can review and adjust your goals'] },
};

export default function PremiumGate({ feature }: { feature: string }) {
  const nav = useNavigate();
  const f = FEATURES[feature] ?? FEATURES.goals;
  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <Card className="hero center">
        <div className="col" style={{ alignItems: 'center', gap: 20 }}>
          <div className="floaty">
            <Ring value={3} max={4} size={150}>
              <div style={{ color: 'var(--accent)' }}>{f.icon}</div>
            </Ring>
          </div>
          <div>
            <div className="badge gold" style={{ marginBottom: 10 }}><Crown size={12} /> PREMIUM</div>
            <h1 style={{ fontSize: 26 }}>{f.title}</h1>
            <p className="muted" style={{ marginTop: 6 }}>This feature is included with the monthly membership.</p>
          </div>
          <div className="col" style={{ textAlign: 'left', width: '100%', maxWidth: 380 }}>
            {f.points.map((p) => (
              <div key={p} className="row neu-inset-sm" style={{ padding: '12px 14px' }}>
                <span className="check on" style={{ width: 22, height: 22 }}><Check size={13} /></span>
                <span className="small bold">{p}</span>
              </div>
            ))}
          </div>
          <Button variant="accent" icon={<Crown size={16} />} onClick={() => nav('/app/upgrade')}>See membership options</Button>
        </div>
      </Card>
    </div>
  );
}
