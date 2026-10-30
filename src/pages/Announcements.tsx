import { toast } from '../lib/fx';
import { useState } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useMe } from '../lib/auth';
import { update, useDB } from '../lib/db';
import { relTime, uid } from '../lib/utils';
import { Avatar, Button, Card, Empty, IconButton, Input, Modal, PageHeader, Textarea } from '../components/ui';

export function AnnouncementList({ limit }: { limit?: number }) {
  const db = useDB();
  const items = [...db.announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  if (!items.length) return <Empty icon={<Megaphone size={24} />} text="No announcements yet." />;
  return (
    <div className="col">
      {items.map((a) => (
        <div key={a.id} className="neu-inset-sm" style={{ padding: 16 }}>
          <div className="bold">{a.title}</div>
          <div className="small muted" style={{ marginTop: 4 }}>{a.body}</div>
          <div className="xs muted bold" style={{ marginTop: 8 }}>{relTime(a.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

export default function Announcements() {
  const me = useMe();
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const items = [...db.announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const post = () => {
    if (!title.trim()) return;
    update((d) => { d.announcements.push({ id: uid(), title, body, createdAt: new Date().toISOString(), authorId: me.id }); });
    setTitle(''); setBody(''); setOpen(false);
    toast('Announcement posted 📣');
  };

  return (
    <div className="page">
      <PageHeader title="Announcements" subtitle="Posts appear on every member's home screen"
        action={<Button variant="accent" icon={<Plus size={17} />} onClick={() => setOpen(true)}>New post</Button>} />
      {items.length === 0 && <Card><Empty icon={<Megaphone size={26} />} text="Nothing posted yet." /></Card>}
      <div className="grid g2">
        {items.map((a) => {
          const author = db.users.find((u) => u.id === a.authorId);
          return (
            <Card key={a.id}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div className="row">
                  {author && <Avatar name={author.name} color={author.color} size={36} />}
                  <div>
                    <div className="bold small">{author?.name ?? 'Staff'}</div>
                    <div className="xs muted">{relTime(a.createdAt)}</div>
                  </div>
                </div>
                {(me.role === 'admin' || a.authorId === me.id) && (
                  <IconButton size="sm" aria-label="Delete" onClick={() => update((d) => { d.announcements = d.announcements.filter((x) => x.id !== a.id); })}>
                    <Trash2 size={14} />
                  </IconButton>
                )}
              </div>
              <h3 style={{ fontSize: 17, marginTop: 14 }}>{a.title}</h3>
              <p className="muted" style={{ marginTop: 6 }}>{a.body}</p>
            </Card>
          );
        })}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New announcement"
        footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="accent" onClick={post}>Post</Button></>}>
        <div className="col gap-lg">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening?" />
          <Textarea label="Message" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details for members…" />
        </div>
      </Modal>
    </div>
  );
}
