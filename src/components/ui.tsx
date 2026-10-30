import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Check, Info, Lock, PartyPopper, X, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cls, initials } from '../lib/utils';
import { dismissToast, useToasts } from '../lib/fx';

export function useIsMobile(max = 600) {
  const q = `(max-width: ${max}px)`;
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

/** Returns `value` after first paint so CSS transitions animate from zero on mount. */
export function useMounted<T>(value: T, from: T): T {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready ? value : from;
}

/** Counts up/down smoothly to `value`. */
export function AnimatedNumber({ value, decimals = 0, duration = 900, format }: {
  value: number; decimals?: number; duration?: number; format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = from + (value - from) * eased;
      setShown(v);
      fromRef.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const n = +shown.toFixed(decimals);
  return <>{format ? format(n) : n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

export function Toaster() {
  const toasts = useToasts();
  const icon = { success: <Check size={16} />, info: <Info size={16} />, error: <AlertCircle size={16} />, celebrate: <PartyPopper size={16} /> };
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cls('toast neu-sm', t.kind)} onClick={() => dismissToast(t.id)}>
          <span className="toast-ico">{icon[t.kind]}</span>
          <span className="bold small">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

export function Card({ children, className, inset, onClick, style }: {
  children: ReactNode; className?: string; inset?: boolean; onClick?: () => void; style?: CSSProperties;
}) {
  return (
    <div className={cls(inset ? 'neu-inset' : 'neu', 'card', onClick && 'clickable', className)} onClick={onClick} style={style}>
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'raised' | 'accent' | 'danger' | 'flat'; icon?: ReactNode; size?: 'sm' | 'md'; block?: boolean;
};
export function Button({ variant = 'raised', icon, size = 'md', block, className, children, ...rest }: BtnProps) {
  return (
    <button className={cls('btn', variant !== 'raised' && variant, size === 'sm' && 'sm', block && 'block', className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ children, className, size, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'lg'; active?: boolean }) {
  return <button className={cls('icon-btn', size, active && 'active', className)} {...rest}>{children}</button>;
}

export function Input({ label, icon, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; icon?: ReactNode }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="input-wrap">{icon}<input {...rest} /></div>
    </div>
  );
}

export function Select({ label, icon, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; icon?: ReactNode }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="input-wrap">{icon}<select {...rest}>{children}</select></div>
    </div>
  );
}

export function Textarea({ label, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="input-wrap"><textarea {...rest} /></div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" aria-label={label} aria-pressed={checked} className={cls('toggle', checked && 'on')} onClick={() => onChange(!checked)} />;
}

export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={cls(o.value === value && 'on')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal neu" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <IconButton size="sm" onClick={onClose} aria-label="Close"><X size={16} /></IconButton>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Avatar({ name, color, size = 42 }: { name: string; color: string; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}cc, ${color})`, fontSize: size * 0.36 }}>
      {initials(name)}
    </div>
  );
}

export function Badge({ tone = 'muted', children, icon }: { tone?: string; children: ReactNode; icon?: ReactNode }) {
  return <span className={cls('badge', tone)}>{icon}{children}</span>;
}

export function Stat({ icon, label, value, sub, color = 'var(--accent)' }: {
  icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; color?: string;
}) {
  return (
    <div className="neu stat">
      <div className="ico" style={{ color }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="val">{typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</div>
        <div className="lbl">{label}</div>
        {sub && <div className="xs muted" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon, text, children }: { icon: ReactNode; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <div className="bold">{text}</div>
      {children}
    </div>
  );
}

export function Progress({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = useMounted(max > 0 ? Math.min(100, (value / max) * 100) : 0, 0);
  return <div className="progress"><div style={{ width: `${pct}%`, background: color }} /></div>;
}

export function Ring({ value, max, size = 150, stroke = 12, colors = ['#ffa05a', '#ff5e1a'], children }: {
  value: number; max: number; size?: number; stroke?: number; colors?: [string, string]; children?: ReactNode;
}) {
  const id = useId();
  const pad = 10;
  const r = size / 2 - pad - stroke / 2;
  const c = 2 * Math.PI * r;
  const target = max > 0 ? Math.min(1, value / max) : 0;
  const pct = useMounted(target, 0);
  const inner = size - (pad + stroke) * 2 - 8;
  return (
    <div className={cls('ring', target >= 1 && 'complete')} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors[0]} />
            <stop offset="1" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle className="val" style={{ filter: `drop-shadow(0 0 6px ${colors[1]}99)` }} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-center" style={{ width: inner, height: inner }}>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Locked({ children, title = 'Premium feature', text = 'Upgrade to a monthly membership to unlock this.' }: {
  children: ReactNode; title?: string; text?: string;
}) {
  const nav = useNavigate();
  return (
    <div className="locked">
      <div className="locked-content">{children}</div>
      <div className="locked-over">
        <div className="lock-ico"><Lock size={22} /></div>
        <div className="heavy">{title}</div>
        <div className="small muted" style={{ maxWidth: 260 }}>{text}</div>
        <Button variant="accent" size="sm" onClick={() => nav('/app/upgrade')}>Go Premium</Button>
      </div>
    </div>
  );
}
