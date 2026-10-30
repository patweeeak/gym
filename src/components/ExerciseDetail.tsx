import { Suspense, lazy } from 'react';
import { Lightbulb, Trophy } from 'lucide-react';
import { useMe } from '../lib/auth';
import { useDB } from '../lib/db';
import { defaultHairStyle } from '../lib/body';
import { demoFor, workedMuscles, type DemoClip, type ExerciseInfo, type GymProp, type MuscleMap } from '../lib/exercises';
import { goalOf, latestWeight } from '../lib/stats';
import { describeRecord, personalRecords, progressOf } from '../lib/training';
import { fmtDate } from '../lib/utils';
import { LineChart } from './charts';
import { Badge, Modal } from './ui';

const BodyModel = lazy(() => import('./BodyModel'));

/** A looping Body Lab demo of one movement with its equipment and worked muscles lit, in the member's own look. */
export function DemoViewer({ clip, props, muscles }: { clip: DemoClip; props: GymProp[]; muscles: MuscleMap }) {
  const worked = workedMuscles(muscles);
  const me = useMe();
  const db = useDB();
  const lab = db.bodyLab?.[me.id];
  const params = lab
    ? { heightCm: lab.heightCm, weightKg: lab.weightKg, age: lab.age, sex: lab.sex }
    : { heightCm: goalOf(db, me.id)?.heightCm ?? 168, weightKg: latestWeight(db, me.id) || 65, age: 28, sex: 'm' as const };
  return (
    <div className="neu-inset-sm" style={{ borderRadius: 18, overflow: 'hidden' }}>
      <Suspense fallback={<div className="body-stage compact center muted small" style={{ display: 'grid', placeItems: 'center' }}>Loading demo…</div>}>
        <BodyModel demo={clip} props={props} highlight={muscles} params={params} skinTone={lab?.skinTone} hairStyle={lab?.hairStyle ?? defaultHairStyle(params.sex)}
          hairColor={lab?.hairColor} outfit={lab?.outfit} outfitColor={lab?.outfitColor} />
      </Suspense>
      <div className="row wrap" style={{ gap: 6, padding: '10px 14px 12px' }}>
        <span className="muscle-dot" /><span className="xs bold">Works: {worked.primary.join(', ')}</span>
        {worked.secondary.length > 0 && <span className="xs bold muted">· also {worked.secondary.join(', ').toLowerCase()}</span>}
      </div>
    </div>
  );
}

/** How to do an exercise, with a Body Lab demo when there is one, and the member's own progress on it. */
export function ExerciseDetail({ ex, onClose }: { ex: ExerciseInfo; onClose: () => void }) {
  const me = useMe();
  const db = useDB();
  const pr = personalRecords(db, me.id).find((r) => r.key === ex.id);
  const progress = progressOf(db, me.id, ex.id);
  const demo = demoFor(ex);

  return (
    <Modal open onClose={onClose} title={ex.name}>
      <div className="col gap-lg">
        <div className="row wrap" style={{ gap: 6 }}>
          {ex.muscles.map((m) => <Badge key={m} tone="accent">{m}</Badge>)}
          <Badge>{ex.equipment}</Badge>
        </div>
        {demo && <DemoViewer clip={demo.clip} props={demo.props} muscles={demo.muscles} />}
        <ol className="col small" style={{ gap: 8, paddingLeft: 20, margin: 0 }}>
          {ex.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <div className="neu-inset-sm row small" style={{ padding: 14, gap: 10 }}>
          <Lightbulb size={18} color="var(--yellow)" style={{ flexShrink: 0 }} /><span><b>Form tip:</b> {ex.tip}</span>
        </div>
        {pr && (
          <div className="row between">
            <div className="row"><Trophy size={18} color="var(--yellow)" /><span className="bold">Personal record</span></div>
            <div className="small bold">{describeRecord(pr)} <span className="muted">· {fmtDate(pr.date)}</span></div>
          </div>
        )}
        {progress.length >= 2 && (
          <div>
            <div className="xs bold muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
              {progress[0].kind === 'weight' ? 'Estimated 1-rep max' : progress[0].kind === 'time' ? 'Longest hold' : 'Best set'}
            </div>
            <LineChart data={progress.map((p) => ({ label: fmtDate(p.date).replace(/, \d{4}$/, ''), value: p.value }))}
              unit={progress[0].kind === 'weight' ? ' kg' : progress[0].kind === 'time' ? 's' : ''} height={150} />
          </div>
        )}
      </div>
    </Modal>
  );
}
