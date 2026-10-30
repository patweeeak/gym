import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Info, Search, Users } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { useDB } from '../../lib/db';
import { goalOf, goalProgress, latestWeight } from '../../lib/stats';
import { memberStatus } from '../../lib/utils';
import { Avatar, Badge, Card, Empty, Input, PageHeader, Progress, Segmented } from '../../components/ui';

export default function CoachMembers() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [q, setQ] = useState('');
  const list = db.users
    .filter((u) => u.role === 'member' && (scope === 'all' || u.instructorId === me.id))
    .filter((u) => u.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <PageHeader title="Members" subtitle="Track progress, set goals and assign workout plans" />
      <div className="neu-inset-sm row small muted" style={{ padding: '12px 16px' }}>
        <Info size={16} /> New members are registered by the gym owner at the front desk.
      </div>
      <div className="row wrap between">
        <div style={{ flex: '1 1 240px', maxWidth: 400 }}>
          <Input icon={<Search size={17} />} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={scope} onChange={setScope} options={[{ value: 'mine', label: 'Assigned to me' }, { value: 'all', label: 'All members' }]} />
      </div>
      {list.length === 0 && <Card><Empty icon={<Users size={26} />} text="No members here." /></Card>}
      <div className="grid g3">
        {list.map((u) => {
          const g = goalOf(db, u.id);
          const w = latestWeight(db, u.id);
          const st = memberStatus(u);
          return (
            <Card key={u.id} onClick={() => nav(`/coach/members/${u.id}`)}>
              <div className="row">
                <Avatar name={u.name} color={u.color} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="heavy truncate">{u.name}</div>
                  {st === 'premium' ? <Badge tone="gold" icon={<Crown size={11} />}>Premium</Badge> : <Badge tone={st === 'expired' ? 'red' : 'muted'}>{st === 'expired' ? 'Expired' : 'Basic'}</Badge>}
                </div>
              </div>
              {g ? (
                <div style={{ marginTop: 16 }}>
                  <div className="row between xs bold muted" style={{ marginBottom: 6 }}>
                    <span>{w} kg</span><span>Goal {g.targetWeight} kg</span>
                  </div>
                  <Progress value={goalProgress(g, w)} max={1} />
                </div>
              ) : <div className="xs muted" style={{ marginTop: 16 }}>No goals set yet</div>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
