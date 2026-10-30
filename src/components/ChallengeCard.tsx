import { useNavigate } from 'react-router-dom';
import { ChevronRight, Trophy } from 'lucide-react';
import { useMe } from '../lib/auth';
import { useDB } from '../lib/db';
import { daysLeftLabel, fmtValue, isLive, progressFor } from '../lib/challenges';
import { dayKey } from '../lib/utils';
import { Card, Progress } from './ui';

/** Home: the member's live challenge (furthest along first), or an invite to join one. */
export function ChallengeCard() {
  const me = useMe();
  const db = useDB();
  const nav = useNavigate();
  const today = dayKey();
  const live = db.challenges.filter((c) => isLive(c, today));
  if (!live.length) return null;
  const mine = live.filter((c) => db.entries.some((e) => e.challengeId === c.id && e.userId === me.id))
    .map((c) => ({ c, v: progressFor(db, c, me.id) })).sort((a, b) => b.v / b.c.target - a.v / a.c.target);
  const top = mine[0];
  return (
    <Card className="row" onClick={() => nav('/app/challenges')}>
      <div className="icon-btn lg" style={{ color: 'var(--yellow)', flexShrink: 0 }}><Trophy size={24} /></div>
      <div className="grow col" style={{ gap: 6 }}>
        {top ? <>
          <div className="row between"><span className="heavy">{top.c.title}</span><span className="xs bold muted">{daysLeftLabel(top.c.end, today)}</span></div>
          <Progress value={Math.min(top.v, top.c.target)} max={top.c.target} />
          <div className="xs bold">{fmtValue(top.v, top.c.metric)} of {fmtValue(top.c.target, top.c.metric)}{mine.length > 1 ? ` · +${mine.length - 1} more` : ''}</div>
        </> : <>
          <div className="heavy">{live.length} challenge{live.length === 1 ? '' : 's'} running</div>
          <div className="small muted">Join {live[0].title} and climb the leaderboard.</div>
        </>}
      </div>
      <ChevronRight size={18} />
    </Card>
  );
}
