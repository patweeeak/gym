import { celebrate, toast } from '../../lib/fx';
import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Coffee, Cookie, Droplets, Moon, Plus, Search, Sun, Trash2 } from 'lucide-react';
import { useMe } from '../../lib/auth';
import { update, useDB } from '../../lib/db';
import { FOODS, type Food } from '../../lib/library';
import { burnedOn, goalOf, mealsOn, waterOn } from '../../lib/stats';
import type { MealType } from '../../lib/types';
import { METRIC, addDays, cls, dayKey, fmtDate, parseDay, uid } from '../../lib/utils';
import { AnimatedNumber, Button, Card, IconButton, Input, Modal, PageHeader, Progress, Ring, Segmented } from '../../components/ui';

const MEALS: { type: MealType; label: string; icon: ReactNode }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: <Coffee size={17} /> },
  { type: 'lunch', label: 'Lunch', icon: <Sun size={17} /> },
  { type: 'dinner', label: 'Dinner', icon: <Moon size={17} /> },
  { type: 'snack', label: 'Snacks', icon: <Cookie size={17} /> },
];

export default function Diet() {
  const me = useMe();
  const db = useDB();
  const [date, setDate] = useState(dayKey());
  const [adding, setAdding] = useState<MealType | null>(null);
  const g = goalOf(db, me.id);
  const meals = mealsOn(db, me.id, date);
  const total = meals.reduce((a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const goalKcal = g?.dailyCalories ?? 2000;
  const burned = burnedOn(db, me.id, date);
  const water = waterOn(db, me.id, date);
  const waterGoal = g?.dailyWater ?? 8;
  const isToday = date === dayKey();

  const setWater = (n: number) => {
    update((d) => { d.water[`${me.id}|${date}`] = Math.max(0, n); });
    if (n === waterGoal && n > water) celebrate('Hydration goal reached! 💧');
  };
  const shift = (n: number) => { const next = dayKey(addDays(parseDay(date), n)); if (next <= dayKey()) setDate(next); };

  // macro targets: protein from goal, remaining split 55/45 carbs/fat by calories
  const pT = g?.protein ?? 100;
  const rest = Math.max(0, goalKcal - pT * 4);
  const cT = Math.round((rest * 0.55) / 4), fT = Math.round((rest * 0.45) / 9);

  return (
    <div className="page">
      <PageHeader title="Diet" subtitle="Fuel your goals"
        action={
          <div className="row neu-sm" style={{ padding: 6, borderRadius: 18 }}>
            <IconButton size="sm" onClick={() => shift(-1)} aria-label="Previous day"><ChevronLeft size={16} /></IconButton>
            <div className="bold small center" style={{ minWidth: 110 }}>{isToday ? 'Today' : fmtDate(date)}</div>
            <IconButton size="sm" onClick={() => shift(1)} disabled={isToday} aria-label="Next day"><ChevronRight size={16} /></IconButton>
          </div>
        } />

      <div className="grid g3">
        <Card className="col" style={{ alignItems: 'center', gap: 18 }}>
          <Ring value={total.calories} max={goalKcal} size={200} stroke={15} colors={total.calories > goalKcal ? ['#ff8fa3', '#ff4d6d'] : METRIC.kcal}>
            <div className="heavy num" style={{ fontSize: 40, lineHeight: 1.05 }}><AnimatedNumber value={Math.abs(goalKcal - total.calories + burned)} /></div>
            <div className="xs muted bold">{goalKcal - total.calories + burned >= 0 ? 'kcal remaining' : 'kcal over'}</div>
          </Ring>
          <div className="row" style={{ gap: 26 }}>
            <div className="center"><div className="heavy">{goalKcal}</div><div className="xs muted bold">Goal</div></div>
            <div className="center"><div className="heavy">{total.calories}</div><div className="xs muted bold">Eaten</div></div>
            <div className="center"><div className="heavy" style={{ color: 'var(--green)' }}>+{burned}</div><div className="xs muted bold">Burned</div></div>
          </div>
        </Card>

        <Card>
          <div className="section-title" style={{ marginBottom: 18 }}>Macros</div>
          <div className="col gap-lg">
            {[
              { label: 'Protein', v: total.protein, t: pT, color: 'linear-gradient(90deg,#ffa05a,#ff5e1a)' },
              { label: 'Carbs', v: total.carbs, t: cT, color: 'linear-gradient(90deg,#e4ff8a,#9be000)' },
              { label: 'Fat', v: total.fat, t: fT, color: 'linear-gradient(90deg,#d6a8ff,#9b4dff)' },
            ].map((m) => (
              <div key={m.label}>
                <div className="row between small bold" style={{ marginBottom: 6 }}>
                  <span>{m.label}</span><span className="muted">{m.v} / {m.t} g</span>
                </div>
                <Progress value={m.v} max={m.t} color={m.color} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <div className="section-title"><Droplets size={17} color="var(--cyan)" /> Water</div>
            <span className="small bold muted">{water} / {waterGoal}</span>
          </div>
          <div className="row wrap" style={{ gap: 12 }}>
            {Array.from({ length: Math.max(waterGoal, water) }, (_, i) => (
              <button key={i} className={cls('glass', i < water && 'full')} onClick={() => setWater(i < water ? i : i + 1)} aria-label={`Glass ${i + 1}`} />
            ))}
          </div>
          <div className="row" style={{ marginTop: 18, gap: 10 }}>
            <Button size="sm" onClick={() => setWater(water - 1)}>−1</Button>
            <Button size="sm" variant="accent" onClick={() => setWater(water + 1)} icon={<Plus size={14} />}>Glass</Button>
          </div>
        </Card>
      </div>

      <div className="grid g2">
        {MEALS.map((m) => {
          const items = meals.filter((x) => x.type === m.type);
          const kcal = items.reduce((a, x) => a + x.calories, 0);
          return (
            <Card key={m.type}>
              <div className="card-head">
                <div className="section-title"><span className="neu-inset-sm" style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>{m.icon}</span>{m.label}</div>
                <div className="row" style={{ gap: 10 }}>
                  <span className="small bold muted">{kcal} kcal</span>
                  <IconButton size="sm" className="accent" onClick={() => setAdding(m.type)} aria-label={`Add ${m.label}`}><Plus size={16} /></IconButton>
                </div>
              </div>
              {items.length === 0 && <div className="small muted">Nothing logged.</div>}
              {items.map((x) => (
                <div key={x.id} className="neu-inset-sm row" style={{ padding: '10px 12px', marginTop: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bold small truncate">{x.name}</div>
                    <div className="xs muted">P {x.protein}g · C {x.carbs}g · F {x.fat}g</div>
                  </div>
                  <span className="small heavy">{x.calories}</span>
                  <button className="btn flat sm" aria-label="Remove" onClick={() => { update((d) => { d.meals = d.meals.filter((y) => y.id !== x.id); }); toast(`Removed ${x.name}`, 'info'); }}><Trash2 size={13} /></button>
                </div>
              ))}
            </Card>
          );
        })}
      </div>

      {adding && <AddMeal type={adding} date={date} onClose={() => setAdding(null)} />}
    </div>
  );
}

function AddMeal({ type, date, onClose }: { type: MealType; date: string; onClose: () => void }) {
  const me = useMe();
  const [tab, setTab] = useState<'quick' | 'custom'>('quick');
  const [q, setQ] = useState('');
  const [f, setF] = useState<Food>({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [mealType, setMealType] = useState<MealType>(type);

  const add = (food: Food) => {
    if (!food.name.trim()) return;
    update((d) => { d.meals.push({ id: uid(), userId: me.id, date, type: mealType, ...food }); });
    toast(`${food.name} added · ${food.calories} kcal`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Log food"
      footer={tab === 'custom' ? <><Button onClick={onClose}>Cancel</Button><Button variant="accent" onClick={() => add(f)}>Add food</Button></> : undefined}>
      <div className="col gap-lg">
        <Segmented value={mealType} onChange={setMealType} options={MEALS.map((m) => ({ value: m.type, label: m.label }))} />
        <Segmented value={tab} onChange={setTab} options={[{ value: 'quick', label: 'Food list' }, { value: 'custom', label: 'Custom' }]} />
        {tab === 'quick' ? (
          <>
            <Input icon={<Search size={16} />} placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="col" style={{ maxHeight: 320, overflow: 'auto', padding: 6, margin: -6 }}>
              {FOODS.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())).map((x) => (
                <button key={x.name} className="neu-sm list-item" style={{ border: 0, cursor: 'pointer', textAlign: 'left', marginTop: 0 }} onClick={() => add(x)}>
                  <div className="grow">
                    <div className="bold small">{x.name}</div>
                    <div className="xs muted">P {x.protein}g · C {x.carbs}g · F {x.fat}g</div>
                  </div>
                  <span className="heavy small">{x.calories}</span>
                  <Plus size={16} color="var(--accent)" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <Input label="Food name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Tapsilog" />
            <div className="grid g2" style={{ gap: 14 }}>
              <Input label="Calories" type="number" value={f.calories} onChange={(e) => setF({ ...f, calories: +e.target.value })} />
              <Input label="Protein (g)" type="number" value={f.protein} onChange={(e) => setF({ ...f, protein: +e.target.value })} />
              <Input label="Carbs (g)" type="number" value={f.carbs} onChange={(e) => setF({ ...f, carbs: +e.target.value })} />
              <Input label="Fat (g)" type="number" value={f.fat} onChange={(e) => setF({ ...f, fat: +e.target.value })} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
