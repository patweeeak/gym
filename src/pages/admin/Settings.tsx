import { toast } from '../../lib/fx';
import { useState } from 'react';
import { Building2, RotateCcw, Save } from 'lucide-react';
import { resetDemo, update, useDB } from '../../lib/db';
import { Button, Card, Input, PageHeader } from '../../components/ui';

export default function AdminSettings() {
  const db = useDB();
  const [s, setS] = useState(db.settings);
  const [saved, setSaved] = useState(false);

  const save = () => {
    const next = { ...s, gymName: s.gymName.trim() || db.settings.gymName }; // a blank name keeps the current one
    update((d) => { d.settings = next; });
    setS(next);
    toast('Settings saved');
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <PageHeader title="Settings" subtitle="Gym details and pricing" />
      <Card>
        <div className="col gap-lg">
          <Input label="Gym name" icon={<Building2 size={16} />} value={s.gymName} onChange={(e) => setS({ ...s, gymName: e.target.value })} />
          <div className="grid g3" style={{ gap: 14 }}>
            <Input label="Currency" value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} />
            <Input label="Monthly price" type="number" value={s.monthlyPrice} onChange={(e) => setS({ ...s, monthlyPrice: +e.target.value })} />
            <Input label="Day pass price" type="number" value={s.dayPassPrice} onChange={(e) => setS({ ...s, dayPassPrice: +e.target.value })} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="accent" icon={<Save size={16} />} onClick={save}>{saved ? 'Saved ✓' : 'Save changes'}</Button>
          </div>
        </div>
      </Card>
      <Card>
        <div className="row between wrap">
          <div>
            <div className="bold">Reset demo data</div>
            <div className="small muted">Restores the sample members, classes and history on this device.</div>
          </div>
          <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => confirm('Reset all data to the demo state?') && resetDemo()}>Reset</Button>
        </div>
      </Card>
    </div>
  );
}
