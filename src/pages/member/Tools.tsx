import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Activity, Check, Dumbbell, HeartPulse, Minus, Plus } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { goalOf, latestWeight } from '../../lib/stats';
import { bmi, bmiLabel } from '../../lib/utils';
import { AnimatedNumber, Badge, Card, Input, PageHeader, Segmented, Select } from '../../components/ui';
import {
  HAIR_COLORS, HAIR_STYLES, OUTFITS, OUTFIT_COLORS, SKIN_TONES, bmiColor, bodyFatPct, defaultHairStyle, type BodyParams,
} from '../../lib/body';
import type { BodyLabPrefs } from '../../lib/types';
import { cls } from '../../lib/utils';

// three.js is heavy — load the 3D viewer only when this page opens
const BodyModel = lazy(() => import('../../components/BodyModel'));

type Lab = Omit<BodyLabPrefs, 'updatedAt'>;

export default function Tools() {
  const me = useMe();
  const db = useDB();
  // the member's saved setup, or a fresh one from their goal and latest weigh-in
  const [lab, setLab] = useState<Lab>(() => {
    const saved = db.bodyLab?.[me.id];
    if (saved) { const { updatedAt: _, scene: _s, ...rest } = saved as BodyLabPrefs & { scene?: string }; return rest; }
    return {
      heightCm: goalOf(db, me.id)?.heightCm ?? 168, weightKg: Math.round(latestWeight(db, me.id) || 65), age: 25, sex: 'm',
      skinTone: SKIN_TONES[1], hairStyle: null, hairColor: HAIR_COLORS[1].value,
      outfit: 'compression', outfitColor: OUTFIT_COLORS[0].value, activity: 1.55,
    };
  });
  const [saved, setSaved] = useState(false);
  const first = useRef(true);
  // save to the member's record shortly after they stop changing things
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved(false);
    const id = setTimeout(() => {
      update((d) => { (d.bodyLab ??= {})[me.id] = { ...lab, updatedAt: new Date().toISOString() }; });
      setSaved(true);
    }, 600);
    return () => clearTimeout(id);
  }, [lab, me.id]);
  const set = (patch: Partial<Lab>) => setLab((l) => ({ ...l, ...patch }));

  return (
    <div className="page">
      <PageHeader eyebrow="Free for every member" title={<>Body <span className="neon">Lab.</span></>}
        subtitle="Shape the model with your stats — everything updates live and is saved to your profile." />
      <BodyLab lab={lab} set={set} saved={saved} />
      <div className="grid g2">
        <HeartZones age={lab.age} />
        <OneRepMax />
      </div>
    </div>
  );
}

function Dots({ label, items, value, onPick }: { label: string; items: { label: string; value: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      {items.map((c) => (
        <button key={c.value} className={cls('tone-dot', value === c.value && 'on')} style={{ background: c.value }}
          aria-label={`${label} ${c.label}`} title={c.label} onClick={() => onPick(c.value)} />
      ))}
    </div>
  );
}

function Chips<T extends string>({ items, value, onPick }: { items: { value: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="chip-row" style={{ gap: 8 }}>
      {items.map((s) => (
        <button key={s.value} className={cls('chip', value === s.value && 'on')} aria-pressed={value === s.value} onClick={() => onPick(s.value)}>{s.label}</button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit, onChange, color }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void; color: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const set = (v: number) => onChange(Math.min(max, Math.max(min, +v.toFixed(1))));
  return (
    <div className="slider-field">
      <div className="row between">
        <span className="eyebrow">{label}</span>
        <span className="num" style={{ fontSize: 30, color }}>
          {step < 1 ? value.toFixed(1) : value}
          <span className="small muted" style={{ fontFamily: 'Space Grotesk, sans-serif' }}> {unit}</span>
        </span>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button className="icon-btn sm" aria-label={`Decrease ${label}`} onClick={() => set(value - step)}><Minus size={14} /></button>
        <input type="range" className="neo-range" min={min} max={max} step={step} value={value} aria-label={label}
          style={{ ['--pct' as string]: `${pct}%`, ['--c' as string]: color }} onChange={(e) => set(+e.target.value)} />
        <button className="icon-btn sm" aria-label={`Increase ${label}`} onClick={() => set(value + step)}><Plus size={14} /></button>
      </div>
    </div>
  );
}

function BodyLab({ lab, set, saved }: { lab: Lab; set: (patch: Partial<Lab>) => void; saved: boolean }) {
  const p: BodyParams = { heightCm: lab.heightCm, weightKg: lab.weightKg, age: lab.age, sex: lab.sex };
  const act = lab.activity;
  const style = lab.hairStyle ?? defaultHairStyle(p.sex);
  const H = p.heightCm / 100;
  const b = bmi(p.weightKg, p.heightCm);
  const bl = bmiLabel(b);
  const bf = bodyFatPct(b, p.age, p.sex);
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'm' ? 5 : -161); // Mifflin–St Jeor
  const tdee = Math.round(bmr * act);
  const lo = 18.5 * H * H, hi = 24.9 * H * H;
  const toHealthy = p.weightKg > hi ? hi - p.weightKg : p.weightKg < lo ? lo - p.weightKg : 0;
  const c = bmiColor(b);
  const markerPct = Math.min(100, Math.max(0, ((b - 15) / (40 - 15)) * 100));

  const readouts = [
    { label: 'BMI', value: b, dec: 1, suffix: '', color: c },
    { label: 'Body fat*', value: bf, dec: 1, suffix: '%', color: '#b26bff' },
    { label: 'BMR kcal', value: Math.round(bmr), dec: 0, suffix: '', color: '#ff5e1a' },
  ];

  return (
    <div className="grid g3">
      <Card className="span2 body-card">
        <Suspense fallback={<div className="body-stage muted small" style={{ display: 'grid', placeItems: 'center' }}>Loading 3D model…</div>}>
          <BodyModel params={p} skinTone={lab.skinTone} hairStyle={style} hairColor={lab.hairColor}
            outfit={lab.outfit} outfitColor={lab.outfitColor} />
        </Suspense>
        <div className="body-readout">
          {readouts.map((r) => (
            <div key={r.label} className="metric-mini">
              <span className="dot" style={{ background: r.color, boxShadow: `0 0 10px ${r.color}` }} />
              <div className="num" style={{ fontSize: 34 }}><AnimatedNumber value={r.value} decimals={r.dec} duration={300} />{r.suffix}</div>
              <div className="eyebrow">{r.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="col gap-lg">
        <div className="row between wrap">
          <div className="section-title">Your stats</div>
          <Segmented value={p.sex} onChange={(sex) => set({ sex })} options={[{ value: 'm', label: 'Male' }, { value: 'f', label: 'Female' }]} />
        </div>
        <div className="row between">
          <span className="eyebrow">Skin tone</span>
          <Dots label="Skin tone" items={SKIN_TONES.map((t) => ({ label: t, value: t }))} value={lab.skinTone} onPick={(skinTone) => set({ skinTone })} />
        </div>
        <div className="col" style={{ gap: 10 }}>
          <div className="row between">
            <span className="eyebrow">Hair</span>
            <Dots label="Hair colour" items={HAIR_COLORS} value={lab.hairColor} onPick={(hairColor) => set({ hairColor })} />
          </div>
          <Chips items={HAIR_STYLES} value={style} onPick={(hairStyle) => set({ hairStyle })} />
        </div>
        <div className="col" style={{ gap: 10 }}>
          <div className="row between">
            <span className="eyebrow">Sportswear</span>
            <Dots label="Outfit colour" items={OUTFIT_COLORS} value={lab.outfitColor} onPick={(outfitColor) => set({ outfitColor })} />
          </div>
          <Chips items={OUTFITS} value={lab.outfit} onPick={(outfit) => set({ outfit })} />
        </div>
        <Slider label="Height" unit="cm" min={130} max={215} value={p.heightCm} onChange={(heightCm) => set({ heightCm })} color="#29d8ff" />
        <Slider label="Weight" unit="kg" min={35} max={180} step={0.5} value={p.weightKg} onChange={(weightKg) => set({ weightKg })} color={c} />
        <Slider label="Age" unit="yrs" min={14} max={85} value={p.age} onChange={(age) => set({ age })} color="#b26bff" />

        <div>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="eyebrow">BMI scale</span>
            <Badge tone={bl.tone}>{bl.label}</Badge>
          </div>
          <div className="bmi-scale"><i style={{ left: `${markerPct}%`, background: c, boxShadow: `0 0 12px ${c}` }} /></div>
          <div className="bmi-ticks xs muted bold"><span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span></div>
          <div className="small muted" style={{ marginTop: 10 }}>
            Healthy weight for {p.heightCm} cm: <b style={{ color: 'var(--text)' }}>{lo.toFixed(0)}–{hi.toFixed(0)} kg</b>
            {toHealthy !== 0 && <> · <b style={{ color: toHealthy < 0 ? 'var(--accent)' : 'var(--cyan)' }}>{toHealthy > 0 ? '+' : ''}{toHealthy.toFixed(1)} kg</b> to reach it</>}
          </div>
        </div>

        <div className="divider" />
        <Select label="Activity level" icon={<Activity size={15} />} value={act} onChange={(e) => set({ activity: +e.target.value })}>
          <option value={1.2}>Sedentary</option>
          <option value={1.375}>Light (1–3 days/wk)</option>
          <option value={1.55}>Moderate (3–5 days/wk)</option>
          <option value={1.725}>Very active (6–7 days/wk)</option>
        </Select>
        <div className="grid g3" style={{ gap: 10 }}>
          {[{ l: 'Lose', v: tdee - 500, c: 'var(--accent)' }, { l: 'Maintain', v: tdee, c: 'var(--text)' }, { l: 'Gain', v: tdee + 350, c: 'var(--cyan)' }].map((x) => (
            <div key={x.l} className="neu-inset-sm center" style={{ padding: 12 }}>
              <div className="num" style={{ fontSize: 26, color: x.c }}><AnimatedNumber value={x.v} duration={300} /></div>
              <div className="eyebrow">{x.l}</div>
            </div>
          ))}
        </div>
        <div className="xs muted">*Body fat is a BMI-based estimate (Deurenberg formula), not a measurement. Calories use the Mifflin–St Jeor formula.</div>
        <div className="xs bold row" style={{ gap: 6, color: saved ? 'var(--lime, #9be000)' : 'var(--muted)' }}>
          {saved ? <><Check size={13} /> Saved to your profile</> : 'Changes save automatically'}
        </div>
      </Card>
    </div>
  );
}

function HeartZones({ age }: { age: number }) {
  const max = 220 - age;
  const zones = [
    { name: 'Warm-up', lo: 0.5, hi: 0.6, color: '#29d8ff' },
    { name: 'Fat burn', lo: 0.6, hi: 0.7, color: '#9be000' },
    { name: 'Cardio', lo: 0.7, hi: 0.8, color: '#ffc93d' },
    { name: 'Peak', lo: 0.8, hi: 0.9, color: '#ff5e1a' },
    { name: 'Max effort', lo: 0.9, hi: 1, color: '#ff4d6d' },
  ];
  return (
    <Card className="col gap-lg">
      <div className="row between">
        <div className="section-title"><HeartPulse size={18} /> Heart-rate zones</div>
        <span className="xs muted bold">Age {age} · from Body Lab</span>
      </div>
      <div className="neu-inset center" style={{ padding: 18 }}>
        <div className="num neon" style={{ fontSize: 48 }}><AnimatedNumber value={max} duration={300} /> bpm</div>
        <div className="eyebrow">Estimated max heart rate</div>
      </div>
      <div className="col" style={{ gap: 10 }}>
        {zones.map((z) => (
          <div key={z.name} className="row" style={{ gap: 12 }}>
            <span className="dot" style={{ background: z.color, boxShadow: `0 0 8px ${z.color}` }} />
            <span className="bold small" style={{ width: 86 }}>{z.name}</span>
            <div className="progress" style={{ flex: 1 }}><div style={{ width: `${z.hi * 100}%`, background: z.color, boxShadow: `0 0 10px ${z.color}88` }} /></div>
            <span className="small bold muted" style={{ width: 82, textAlign: 'right' }}>{Math.round(max * z.lo)}–{Math.round(max * z.hi)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OneRepMax() {
  const [w, setW] = useState(60);
  const [r, setR] = useState(8);
  const orm = r > 0 ? w * (1 + r / 30) : 0; // Epley
  return (
    <Card className="col gap-lg">
      <div className="section-title"><Dumbbell size={18} /> 1-rep max</div>
      <div className="neu-inset center" style={{ padding: 18 }}>
        <div className="num grad-text" style={{ fontSize: 48 }}>{orm.toFixed(1)} kg</div>
        <div className="eyebrow">Estimated max</div>
      </div>
      <div className="grid g2" style={{ gap: 12 }}>
        <Input label="Weight lifted" type="number" value={w} onChange={(e) => setW(+e.target.value)} />
        <Input label="Reps" type="number" value={r} onChange={(e) => setR(+e.target.value)} />
      </div>
      <div className="col" style={{ gap: 6 }}>
        {[90, 80, 70, 60].map((pc) => (
          <div key={pc} className="row between small"><span className="muted bold">{pc}%</span><span className="bold">{((orm * pc) / 100).toFixed(1)} kg</span></div>
        ))}
      </div>
    </Card>
  );
}
