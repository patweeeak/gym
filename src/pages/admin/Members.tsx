import { toast } from '../../lib/fx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Lock, Mail, Phone, Plus, RefreshCw, Search, Trash2, User as UserIcon, Users } from 'lucide-react';
import { update, useDB } from '../../lib/db';
import type { Plan, User } from '../../lib/types';
import { addDays, daysLeft, dayKey, fmtDate, memberStatus, randomColor, uid } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Empty, Input, Modal, PageHeader, Segmented, Select } from '../../components/ui';
import { renewMembership } from './Overview';

type Filter = 'all' | 'premium' | 'basic' | 'expired';

export default function AdminMembers() {
  const db = useDB();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const instructors = db.users.filter((u) => u.role === 'instructor');
  const members = db.users
    .filter((u) => u.role === 'member')
    .filter((u) => filter === 'all' || memberStatus(u) === filter)
    .filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <PageHeader title="Members" subtitle={`${db.users.filter((u) => u.role === 'member').length} registered members`}
        action={<Button variant="accent" icon={<Plus size={17} />} onClick={() => setAdding(true)}>Add member</Button>} />

      <div className="row wrap between">
        <div style={{ flex: '1 1 260px', maxWidth: 420 }}>
          <Input icon={<Search size={17} />} placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All' }, { value: 'premium', label: 'Premium' }, { value: 'basic', label: 'Basic' }, { value: 'expired', label: 'Expired' },
        ]} />
      </div>

      {members.length === 0 && <Card><Empty icon={<Users size={26} />} text="No members match." /></Card>}
      <div className="grid g3">
        {members.map((u) => {
          const st = memberStatus(u);
          const coach = db.users.find((x) => x.id === u.instructorId);
          return (
            <Card key={u.id} onClick={() => setEditing(u)}>
              <div className="row">
                <Avatar name={u.name} color={u.color} size={48} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="heavy truncate">{u.name}</div>
                  <div className="small muted truncate">{u.email}</div>
                </div>
              </div>
              <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
                {st === 'premium' && <Badge tone="gold" icon={<Crown size={12} />}>Premium · {daysLeft(u)}d</Badge>}
                {st === 'expired' && <Badge tone="red">Expired</Badge>}
                {st === 'basic' && <Badge>Basic</Badge>}
                {coach && <Badge tone="blue">{coach.name.replace('Coach ', '')}</Badge>}
              </div>
            </Card>
          );
        })}
      </div>

      <MemberForm open={adding} onClose={() => setAdding(false)} instructors={instructors} />
      {editing && (
        <EditMember user={db.users.find((u) => u.id === editing.id) ?? editing} onClose={() => setEditing(null)} instructors={instructors}
          onOpen={() => nav(`/admin/members/${editing.id}`)} />
      )}
    </div>
  );
}

function MemberForm({ open, onClose, instructors }: { open: boolean; onClose: () => void; instructors: User[] }) {
  const db = useDB();
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', plan: 'basic' as Plan, instructorId: '' });
  const [err, setErr] = useState('');
  const save = () => {
    if (!f.name.trim() || !f.email.trim() || f.password.length < 6) return setErr('Name, email and a 6+ character password are required.');
    if (db.users.some((u) => u.email.toLowerCase() === f.email.toLowerCase())) return setErr('That email is already registered.');
    const id = uid();
    update((d) => {
      d.users.push({
        id, role: 'member', name: f.name.trim(), email: f.email.trim(), password: f.password, phone: f.phone, color: randomColor(),
        createdAt: new Date().toISOString(), plan: f.plan, instructorId: f.instructorId || undefined,
        subscriptionEnd: f.plan === 'monthly' ? dayKey(addDays(new Date(), 30)) : undefined,
      });
      if (f.plan === 'monthly') d.payments.push({ id: uid(), userId: id, amount: d.settings.monthlyPrice, date: dayKey(), kind: 'monthly' });
    });
    toast(`${f.name.trim()} registered`);
    setF({ name: '', email: '', password: '', phone: '', plan: 'basic', instructorId: '' });
    setErr('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Register member"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save}>Create account</Button></>}>
      <div className="col gap-lg">
        <Input label="Full name" icon={<UserIcon size={16} />} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Email" type="email" icon={<Mail size={16} />} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <div className="grid g2" style={{ gap: 14 }}>
          <Input label="Temp password" icon={<Lock size={16} />} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Input label="Phone" icon={<Phone size={16} />} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div className="field">
          <label>Membership</label>
          <Segmented value={f.plan} onChange={(plan) => setF({ ...f, plan })} options={[
            { value: 'basic', label: 'Basic (pay per visit)' }, { value: 'monthly', label: <><Crown size={14} /> Monthly</> },
          ]} />
        </div>
        {f.plan === 'monthly' && (
          <Select label="Assigned coach" value={f.instructorId} onChange={(e) => setF({ ...f, instructorId: e.target.value })}>
            <option value="">— None —</option>
            {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
        )}
        {err && <div className="small bold" style={{ color: 'var(--red)' }}>{err}</div>}
      </div>
    </Modal>
  );
}

function EditMember({ user, onClose, instructors, onOpen }: { user: User; onClose: () => void; instructors: User[]; onOpen: () => void }) {
  const st = memberStatus(user);
  const set = (patch: Partial<User>) => { update((d) => { Object.assign(d.users.find((u) => u.id === user.id)!, patch); }); toast('Member updated'); };
  const remove = () => {
    if (!confirm(`Delete ${user.name}? This removes all their data.`)) return;
    update((d) => {
      d.users = d.users.filter((u) => u.id !== user.id);
      d.classes.forEach((c) => { c.attendees = c.attendees.filter((a) => a !== user.id); });
    });
    toast(`${user.name} deleted`, 'info');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Member"
      footer={<>
        <Button variant="danger" icon={<Trash2 size={15} />} onClick={remove}>Delete</Button>
        <Button onClick={onOpen}>Full profile</Button>
        <Button variant="accent" onClick={onClose}>Done</Button>
      </>}>
      <div className="col gap-lg">
        <div className="row">
          <Avatar name={user.name} color={user.color} size={56} />
          <div style={{ minWidth: 0 }}>
            <div className="heavy" style={{ fontSize: 18 }}>{user.name}</div>
            <div className="small muted">{user.email}{user.phone && ` · ${user.phone}`}</div>
          </div>
        </div>
        <div className="neu-inset-sm row between wrap" style={{ padding: 16 }}>
          <div>
            <div className="bold">{st === 'premium' ? 'Premium (monthly)' : st === 'expired' ? 'Monthly — expired' : 'Basic'}</div>
            <div className="xs muted">{user.subscriptionEnd ? `${st === 'expired' ? 'Ended' : 'Valid until'} ${fmtDate(user.subscriptionEnd)}` : 'Pays a day pass per visit'}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" variant="accent" icon={<RefreshCw size={13} />} onClick={() => renewMembership(user.id)}>{st === 'basic' ? 'Upgrade +30d' : 'Renew +30d'}</Button>
            {user.plan === 'monthly' && <Button size="sm" onClick={() => set({ plan: 'basic', subscriptionEnd: undefined })}>Set basic</Button>}
          </div>
        </div>
        <Select label="Assigned coach" value={user.instructorId ?? ''} onChange={(e) => set({ instructorId: e.target.value || undefined })}>
          <option value="">— None —</option>
          {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </Select>
        <div className="xs muted">Member since {fmtDate(dayKey(new Date(user.createdAt)))}</div>
      </div>
    </Modal>
  );
}
