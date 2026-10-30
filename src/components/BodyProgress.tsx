import { useEffect, useRef, useState } from 'react';
import { Camera, Columns2, Lock, Ruler, Trash2 } from 'lucide-react';
import { toast } from '../lib/fx';
import { useMe } from '../lib/auth';
import { update, useDB } from '../lib/db';
import { deletePhotoFile, photoUrl, savePhoto } from '../lib/photos';
import type { Measurement, ProgressPhoto } from '../lib/types';
import { cls, dayKey, fmtDate, uid } from '../lib/utils';
import { LineChart } from './charts';
import { Badge, Button, Card, Empty, Input, Modal, Segmented } from './ui';

const FIELDS: { key: keyof Omit<Measurement, 'id' | 'userId' | 'date'>; label: string; unit: string }[] = [
  { key: 'waist', label: 'Waist', unit: 'cm' }, { key: 'hips', label: 'Hips', unit: 'cm' }, { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' }, { key: 'thigh', label: 'Thigh', unit: 'cm' }, { key: 'bodyFat', label: 'Body fat', unit: '%' },
];
type Field = (typeof FIELDS)[number]['key'];

/** Body measurements over time and private progress photos with a before / after compare. */
export default function BodyProgress() {
  const me = useMe();
  const db = useDB();
  const ms = db.measurements.filter((m) => m.userId === me.id).sort((a, b) => a.date.localeCompare(b.date));
  const photos = db.photos.filter((p) => p.userId === me.id).sort((a, b) => b.date.localeCompare(a.date));
  const [field, setField] = useState<Field>('waist');
  const [measuring, setMeasuring] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const fileRef = useRef<HTMLInputElement>(null);

  const series = ms.filter((m) => m[field] !== undefined).map((m) => ({ label: fmtDate(m.date).replace(/, \d{4}$/, ''), value: m[field]! }));
  const unit = FIELDS.find((f) => f.key === field)!.unit;
  const first = series[0]?.value, last = series[series.length - 1]?.value;

  const addPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const id = uid();
    try {
      const stored = await savePhoto(me.id, id, file);
      update((d) => { d.photos.push({ id, userId: me.id, date: dayKey(), pose, ...stored }); });
      toast('Progress photo saved 📸');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const removePhoto = async (p: ProgressPhoto) => {
    if (!confirm('Delete this photo?')) return;
    await deletePhotoFile(p.path);
    update((d) => { d.photos = d.photos.filter((x) => x.id !== p.id); });
    setViewing(null);
  };

  return (
    <>
      <div className="grid g2">
        <Card>
          <div className="card-head">
            <div className="section-title"><Ruler size={17} /> Measurements</div>
            <Button size="sm" variant="accent" onClick={() => setMeasuring(true)}>Log</Button>
          </div>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            {FIELDS.map((f) => <button key={f.key} className={cls('chip', field === f.key && 'on')} onClick={() => setField(f.key)}>{f.label}</button>)}
          </div>
          {series.length >= 2
            ? <>
              <LineChart data={series} unit={` ${unit}`} height={160} />
              <div className="small bold center" style={{ marginTop: 6 }}>
                {last! - first! === 0 ? 'No change yet' : `${last! - first! > 0 ? '+' : ''}${(last! - first!).toFixed(1)} ${unit} since ${fmtDate(ms.find((m) => m[field] !== undefined)!.date)}`}
              </div>
            </>
            : <Empty icon={<Ruler size={24} />} text={series.length ? 'Log once more to see a trend' : 'No measurements yet'} />}
        </Card>

        <Card>
          <div className="card-head">
            <div className="section-title"><Camera size={17} /> Progress photos</div>
            <div className="row" style={{ gap: 8 }}>
              {photos.length >= 2 && <Button size="sm" icon={<Columns2 size={14} />} onClick={() => setComparing(true)}>Compare</Button>}
              <Button size="sm" variant="accent" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Saving…' : 'Add'}</Button>
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <Segmented value={pose} onChange={setPose} options={[{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]} />
            <span className="xs muted bold row" style={{ gap: 4 }}><Lock size={11} /> Only you can see these</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addPhoto(e.target.files?.[0])} />
          {photos.length === 0
            ? <Empty icon={<Camera size={24} />} text="Take a photo every few weeks in the same spot and light." />
            : <div className="photo-grid">
              {photos.slice(0, 12).map((p) => <PhotoThumb key={p.id} photo={p} onClick={() => setViewing(p)} />)}
            </div>}
        </Card>
      </div>

      {measuring && <MeasureForm last={ms[ms.length - 1]} onClose={() => setMeasuring(false)} />}
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={`${fmtDate(viewing.date)} · ${viewing.pose}`}
          footer={<><Button variant="danger" icon={<Trash2 size={15} />} onClick={() => removePhoto(viewing)}>Delete</Button><Button variant="accent" onClick={() => setViewing(null)}>Close</Button></>}>
          <PhotoImg photo={viewing} style={{ width: '100%', borderRadius: 14 }} />
        </Modal>
      )}
      {comparing && <Compare photos={photos} onClose={() => setComparing(false)} />}
    </>
  );
}

function PhotoImg({ photo, style }: { photo: ProgressPhoto; style?: React.CSSProperties }) {
  const [src, setSrc] = useState(photo.dataUrl ?? '');
  useEffect(() => { let on = true; photoUrl(photo).then((u) => on && setSrc(u)); return () => { on = false; }; }, [photo]);
  return src ? <img src={src} alt={`Progress photo, ${photo.pose}, ${fmtDate(photo.date)}`} style={{ display: 'block', objectFit: 'cover', ...style }} /> : <div className="photo-ph" style={style} />;
}

function PhotoThumb({ photo, onClick }: { photo: ProgressPhoto; onClick: () => void }) {
  return (
    <button className="photo-thumb" onClick={onClick} aria-label={`Photo from ${fmtDate(photo.date)}`}>
      <PhotoImg photo={photo} style={{ width: '100%', height: '100%' }} />
      <span className="xs bold">{fmtDate(photo.date).replace(/, \d{4}$/, '')}</span>
    </button>
  );
}

/** Before / after: the oldest and newest photo of the same pose side by side. */
function Compare({ photos, onClose }: { photos: ProgressPhoto[]; onClose: () => void }) {
  const poses = (['front', 'side', 'back'] as const).filter((p) => photos.filter((x) => x.pose === p).length >= 2);
  const [pose, setPose] = useState<ProgressPhoto['pose']>(poses[0] ?? 'front');
  const list = photos.filter((p) => p.pose === pose).sort((a, b) => a.date.localeCompare(b.date));
  const before = list[0], after = list[list.length - 1];
  return (
    <Modal open onClose={onClose} title="Before & after">
      <div className="col gap-lg">
        {poses.length > 1 && <Segmented value={pose} onChange={setPose} options={poses.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} />}
        {before && after && before !== after
          ? <div className="grid g2" style={{ gap: 10 }}>
            {[before, after].map((p, i) => (
              <div key={p.id} className="col" style={{ gap: 6 }}>
                <Badge tone={i ? 'accent' : 'muted'}>{i ? 'After' : 'Before'} · {fmtDate(p.date)}</Badge>
                <PhotoImg photo={p} style={{ width: '100%', aspectRatio: '3 / 4', borderRadius: 14 }} />
              </div>
            ))}
          </div>
          : <Empty icon={<Columns2 size={24} />} text="Add two photos of the same pose to compare them." />}
      </div>
    </Modal>
  );
}

function MeasureForm({ last, onClose }: { last?: Measurement; onClose: () => void }) {
  const me = useMe();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, last?.[f.key] !== undefined ? String(last[f.key]) : ''])));
  const save = () => {
    const entry: Measurement = { id: uid(), userId: me.id, date: dayKey() };
    for (const f of FIELDS) { const n = parseFloat(v[f.key]); if (n > 0) entry[f.key] = Math.round(n * 10) / 10; }
    if (Object.keys(entry).length <= 3) return toast('Enter at least one measurement.', 'error');
    update((d) => {
      d.measurements = d.measurements.filter((m) => !(m.userId === me.id && m.date === entry.date));
      d.measurements.push(entry);
    });
    toast('Measurements saved');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Log measurements"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save}>Save</Button></>}>
      <div className="col gap-lg">
        <div className="small muted">Measure in the morning, relaxed, with the tape snug but not tight. Leave any blank.</div>
        <div className="grid g2" style={{ gap: 12 }}>
          {FIELDS.map((f) => (
            <Input key={f.key} label={`${f.label} (${f.unit})`} type="number" inputMode="decimal" step="0.1" value={v[f.key]}
              onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
          ))}
        </div>
      </div>
    </Modal>
  );
}
