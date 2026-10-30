import { toast } from '../lib/fx';
import { useState } from 'react';
import { CalendarDays, Clock, Crown, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useMe } from '../lib/auth';
import { update, useDB } from '../lib/db';
import type { GymClass } from '../lib/types';
import { DAYS, DAYS_LONG, PALETTE, cls, uid } from '../lib/utils';
import { Avatar, Badge, Button, Card, Empty, IconButton, Input, Modal, PageHeader, Segmented, Select, Toggle } from '../components/ui';

const blank = (instructorId: string): GymClass => ({
  id: '', title: '', instructorId, day: new Date().getDay(), time: '07:00', durationMin: 45, capacity: 15, attendees: [], premiumOnly: false, color: PALETTE[0],
});

export default function ClassesManager() {
  const me = useMe();
  const db = useDB();
  const isAdmin = me.role === 'admin';
  const [scope, setScope] = useState<'mine' | 'all'>(isAdmin ? 'all' : 'mine');
  const [day, setDay] = useState<number | 'week'>('week');
  const [edit, setEdit] = useState<GymClass | null>(null);
  const [viewing, setViewing] = useState<GymClass | null>(null);

  const instructors = db.users.filter((u) => u.role === 'instructor');
  const name = (id: string) => db.users.find((u) => u.id === id)?.name ?? 'Unassigned';
  const list = db.classes
    .filter((c) => scope === 'all' || c.instructorId === me.id)
    .filter((c) => day === 'week' || c.day === day)
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  const canEdit = (c: GymClass) => isAdmin || c.instructorId === me.id;

  const save = () => {
    if (!edit || !edit.title.trim()) return;
    update((d) => {
      if (edit.id) d.classes = d.classes.map((c) => (c.id === edit.id ? edit : c));
      else d.classes.push({ ...edit, id: uid() });
    });
    toast(edit.id ? 'Class updated' : `${edit.title} added to the schedule`);
    setEdit(null);
  };
  const remove = (id: string) => {
    if (!confirm('Delete this class?')) return;
    update((d) => { d.classes = d.classes.filter((c) => c.id !== id); });
    toast('Class deleted', 'info');
    setEdit(null);
  };

  const days = day === 'week' ? [...new Set(list.map((c) => c.day))] : [day];

  return (
    <div className="page">
      <PageHeader title="Class Schedule" subtitle="Weekly recurring group classes"
        action={<Button variant="accent" icon={<Plus size={17} />} onClick={() => setEdit(blank(isAdmin ? instructors[0]?.id ?? '' : me.id))}>New class</Button>} />

      <div className="row wrap between">
        <Segmented value={day} onChange={setDay} options={[{ value: 'week' as const, label: 'Week' }, ...DAYS.map((d, i) => ({ value: i, label: d }))]} />
        {!isAdmin && <Segmented value={scope} onChange={setScope} options={[{ value: 'mine', label: 'My classes' }, { value: 'all', label: 'All' }]} />}
      </div>

      {list.length === 0 && <Card><Empty icon={<CalendarDays size={26} />} text="No classes scheduled here yet." /></Card>}

      {days.map((d) => (
        <div key={d} className="col">
          <div className="section-title">{DAYS_LONG[d]}{d === new Date().getDay() && <Badge tone="accent">Today</Badge>}</div>
          <div className="grid g3">
            {list.filter((c) => c.day === d).map((c) => (
              <Card key={c.id} onClick={() => setViewing(c)}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="row" style={{ minWidth: 0 }}>
                    <div style={{ width: 10, alignSelf: 'stretch', borderRadius: 6, background: c.color, minHeight: 44 }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="heavy truncate">{c.title}</div>
                      <div className="small muted truncate">{name(c.instructorId)}</div>
                    </div>
                  </div>
                  {canEdit(c) && <IconButton size="sm" onClick={(e) => { e.stopPropagation(); setEdit(c); }} aria-label="Edit"><Pencil size={14} /></IconButton>}
                </div>
                <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
                  <Badge icon={<Clock size={12} />}>{c.time} · {c.durationMin}m</Badge>
                  <Badge tone={c.attendees.length >= c.capacity ? 'red' : 'blue'} icon={<Users size={12} />}>{c.attendees.length}/{c.capacity}</Badge>
                  {c.premiumOnly && <Badge tone="yellow" icon={<Crown size={12} />}>Premium</Badge>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title}>
        {viewing && (
          <div className="col">
            <div className="small muted">{DAYS_LONG[viewing.day]} · {viewing.time} · {name(viewing.instructorId)}</div>
            <div className="section-title" style={{ marginTop: 8 }}>Booked ({viewing.attendees.length}/{viewing.capacity})</div>
            {viewing.attendees.length === 0 && <div className="muted small">No bookings yet.</div>}
            {viewing.attendees.map((id) => {
              const u = db.users.find((x) => x.id === id);
              return u && (
                <div key={id} className="neu-sm list-item">
                  <Avatar name={u.name} color={u.color} size={34} />
                  <div className="grow bold">{u.name}</div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit class' : 'New class'}
        footer={<>
          {edit?.id && <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => remove(edit.id)}>Delete</Button>}
          <Button onClick={() => setEdit(null)}>Cancel</Button>
          <Button variant="accent" onClick={save}>Save</Button>
        </>}>
        {edit && (
          <div className="col gap-lg">
            <Input label="Class name" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. Morning HIIT" />
            {isAdmin && (
              <Select label="Instructor" value={edit.instructorId} onChange={(e) => setEdit({ ...edit, instructorId: e.target.value })}>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            )}
            <div className="grid g2" style={{ gap: 14 }}>
              <Select label="Day" value={edit.day} onChange={(e) => setEdit({ ...edit, day: +e.target.value })}>
                {DAYS_LONG.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
              <Input label="Start time" type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} />
              <Input label="Duration (min)" type="number" min={10} value={edit.durationMin} onChange={(e) => setEdit({ ...edit, durationMin: +e.target.value })} />
              <Input label="Capacity" type="number" min={1} value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: +e.target.value })} />
            </div>
            <div className="field">
              <label>Color</label>
              <div className="row wrap">
                {PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setEdit({ ...edit, color: c })} aria-label={c}
                    className={cls('icon-btn sm', edit.color === c && 'active')}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: c }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="row between neu-inset-sm" style={{ padding: 14 }}>
              <div>
                <div className="bold">Premium members only</div>
                <div className="xs muted">Basic members will see it locked</div>
              </div>
              <Toggle checked={edit.premiumOnly} onChange={(v) => setEdit({ ...edit, premiumOnly: v })} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
