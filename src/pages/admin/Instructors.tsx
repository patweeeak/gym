import { toast } from '../../lib/fx';
import { useState } from 'react';
import { CalendarDays, Dumbbell, Lock, Mail, Phone, Plus, Trash2, User as UserIcon, UserCog, Users } from 'lucide-react';
import { update, useDB } from '../../lib/db';
import { randomColor, uid } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Empty, IconButton, Input, Modal, PageHeader } from '../../components/ui';

export default function AdminInstructors() {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', specialty: '' });
  const [err, setErr] = useState('');
  const coaches = db.users.filter((u) => u.role === 'instructor');

  const save = () => {
    if (!f.name.trim() || !f.email.trim() || f.password.length < 6) return setErr('Name, email and a 6+ character password are required.');
    if (db.users.some((u) => u.email.toLowerCase() === f.email.toLowerCase())) return setErr('That email is already registered.');
    update((d) => {
      d.users.push({ id: uid(), role: 'instructor', name: f.name.trim(), email: f.email.trim(), password: f.password, phone: f.phone,
        specialty: f.specialty, color: randomColor(), createdAt: new Date().toISOString() });
    });
    toast(`${f.name.trim()} added as instructor`);
    setF({ name: '', email: '', password: '', phone: '', specialty: '' });
    setErr('');
    setOpen(false);
  };

  const remove = (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Their members will be unassigned and classes deleted.`)) return;
    update((d) => {
      d.users = d.users.filter((u) => u.id !== id);
      d.users.forEach((u) => { if (u.instructorId === id) u.instructorId = undefined; });
      d.classes = d.classes.filter((c) => c.instructorId !== id);
    });
    toast(`${name} removed`, 'info');
  };

  return (
    <div className="page">
      <PageHeader title="Instructors" subtitle="Coaches can manage classes, plans and goals — but cannot register members."
        action={<Button variant="accent" icon={<Plus size={17} />} onClick={() => setOpen(true)}>Add instructor</Button>} />
      {coaches.length === 0 && <Card><Empty icon={<UserCog size={26} />} text="No instructors yet." /></Card>}
      <div className="grid g3">
        {coaches.map((c) => {
          const members = db.users.filter((u) => u.instructorId === c.id).length;
          const classes = db.classes.filter((k) => k.instructorId === c.id).length;
          return (
            <Card key={c.id}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <Avatar name={c.name} color={c.color} size={58} />
                <IconButton size="sm" onClick={() => remove(c.id, c.name)} aria-label="Remove"><Trash2 size={14} /></IconButton>
              </div>
              <div className="heavy" style={{ fontSize: 17, marginTop: 14 }}>{c.name}</div>
              <div className="small muted">{c.email}</div>
              {c.specialty && <div style={{ marginTop: 10 }}><Badge tone="purple" icon={<Dumbbell size={12} />}>{c.specialty}</Badge></div>}
              <div className="grid g2" style={{ gap: 12, marginTop: 18 }}>
                <div className="neu-inset-sm center" style={{ padding: 12 }}>
                  <div className="heavy num" style={{ fontSize: 28 }}><Users size={14} /> {members}</div>
                  <div className="xs muted bold">members</div>
                </div>
                <div className="neu-inset-sm center" style={{ padding: 12 }}>
                  <div className="heavy num" style={{ fontSize: 28 }}><CalendarDays size={14} /> {classes}</div>
                  <div className="xs muted bold">classes / wk</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add instructor"
        footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="accent" onClick={save}>Create account</Button></>}>
        <div className="col gap-lg">
          <Input label="Full name" icon={<UserIcon size={16} />} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Coach …" />
          <Input label="Email" type="email" icon={<Mail size={16} />} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <div className="grid g2" style={{ gap: 14 }}>
            <Input label="Temp password" icon={<Lock size={16} />} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <Input label="Phone" icon={<Phone size={16} />} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>
          <Input label="Specialty" icon={<Dumbbell size={16} />} value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="e.g. Yoga, Powerlifting" />
          {err && <div className="small bold" style={{ color: 'var(--red)' }}>{err}</div>}
        </div>
      </Modal>
    </div>
  );
}
