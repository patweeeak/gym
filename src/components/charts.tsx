import { useId, useRef, useState } from 'react';
import { useMounted } from './ui';
import { cls } from '../lib/utils';

export function BarChart({ data, highlight, format = (v) => v.toLocaleString(), goal }: {
  data: { label: string; value: number }[];
  highlight?: number;
  format?: (v: number) => string;
  goal?: number;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const grown = useMounted(true, false);
  const max = Math.max(1, goal ?? 0, ...data.map((d) => d.value));
  const active = sel ?? highlight ?? data.length - 1;
  return (
    <div className="bars" onPointerLeave={() => setSel(null)}>
      {data.map((d, i) => (
        <div key={i} className={cls('bar-col', i === highlight && 'hi', i === active && 'sel', goal != null && d.value >= goal && 'met')}
          onPointerEnter={() => setSel(i)} onClick={() => setSel(i)}>
          <div className="bar-tip">{format(d.value)}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: grown ? `${(d.value / max) * 100}%` : '0%', transitionDelay: `${i * 60}ms` }} />
          </div>
          <div className="lbl">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ data, height = 170, unit = '', target }: {
  data: { label: string; value: number }[]; height?: number; unit?: string; target?: number;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const drawn = useMounted(true, false);
  if (data.length < 2) return <div className="muted small center" style={{ padding: 30 }}>Log at least two entries to see your trend.</div>;
  const W = 320, H = height, P = 18;
  const vals = data.map((d) => d.value).concat(target != null ? [target] : []);
  const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
  const x = (i: number) => P + (i * (W - P * 2)) / (data.length - 1);
  const y = (v: number) => P + ((max - v) * (H - P * 2)) / (max - min);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const path = pts.reduce((acc, [px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [qx, qy] = pts[i - 1];
    const cx = (qx + px) / 2;
    return `${acc} C${cx},${qy} ${cx},${py} ${px},${py}`;
  }, '');
  const area = `${path} L${x(data.length - 1)},${H} L${x(0)},${H} Z`;
  const ai = hover ?? data.length - 1;
  const [axp, ayp] = pts[ai];
  const delta = ai > 0 ? +(data[ai].value - data[ai - 1].value).toFixed(1) : 0;

  const scrub = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((sx - P) / (W - P * 2)) * (data.length - 1)))));
  };

  return (
    <div style={{ position: 'relative' }} data-noswipe>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible', touchAction: 'pan-y', cursor: 'crosshair' }}
        onPointerMove={(e) => scrub(e.clientX)} onPointerDown={(e) => scrub(e.clientX)} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff5e1a" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ff5e1a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff8a3d" />
            <stop offset="1" stopColor="#ff5e1a" />
          </linearGradient>
        </defs>
        {target != null && (
          <g>
            <line x1={P} x2={W - P} y1={y(target)} y2={y(target)} stroke="var(--green)" strokeDasharray="5 5" strokeWidth="1.5" />
            <text x={W - P} y={y(target) - 6} textAnchor="end" fontSize="10" fontWeight="700" fill="var(--green)">Goal {target}{unit}</text>
          </g>
        )}
        <path d={area} fill={`url(#${id}a)`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 1s .4s' }} />
        <path d={path} fill="none" stroke={`url(#${id}l)`} strokeWidth="3.5" strokeLinecap="round" pathLength={1}
          strokeDasharray="1" strokeDashoffset={drawn ? 0 : 1} style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)' }} />
        <line x1={axp} x2={axp} y1={P / 2} y2={H} stroke="var(--faint)" strokeDasharray="3 4" strokeWidth="1" />
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={i === ai ? 6 : 3} fill={i === ai ? '#ff5e1a' : 'var(--bg)'} stroke="#ff5e1a" strokeWidth="2"
            style={{ transition: 'r .2s', opacity: drawn ? 1 : 0, transitionDelay: `${i * 60}ms` }} />
        ))}
        <circle cx={axp} cy={ayp} r="12" fill="#ff5e1a" opacity="0.18" />
      </svg>
      <div className="chart-tip neu-sm" style={{ left: `${(axp / W) * 100}%`, top: `${(ayp / H) * 100}%` }}>
        <b>{data[ai].value}{unit}</b>
        {ai > 0 && <span style={{ color: delta <= 0 ? 'var(--green)' : 'var(--accent)' }}> {delta > 0 ? '+' : ''}{delta}</span>}
        <div className="xs muted">{data[ai].label}</div>
      </div>
      <div className="row between xs muted bold" style={{ padding: '6px 10px 0' }}>
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

/** Mini route preview from GPS points (no map tiles needed). */
export function RouteSketch({ route, size = 160 }: { route: [number, number][]; size?: number }) {
  if (route.length < 2) {
    return <div className="neu-inset center small muted" style={{ height: size, display: 'grid', placeItems: 'center', padding: 12 }}>Your route will be drawn here</div>;
  }
  const lats = route.map((p) => p[0]), lngs = route.map((p) => p[1]);
  const [minA, maxA, minO, maxO] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = Math.max(maxA - minA, maxO - minO, 1e-5);
  const P = 16, S = 200;
  const pts = route.map(([a, o]) => `${P + ((o - minO) / span) * (S - P * 2)},${S - P - ((a - minA) / span) * (S - P * 2)}`).join(' ');
  const [sx, sy] = pts.split(' ')[0].split(',');
  const [ex, ey] = pts.split(' ').slice(-1)[0].split(',');
  return (
    <div className="neu-inset" style={{ height: size, padding: 8 }}>
      <svg viewBox={`0 0 ${S} ${S}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <polyline points={pts} fill="none" stroke="#ff5e1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={sx} cy={sy} r="6" fill="var(--green)" />
        <circle cx={ex} cy={ey} r="6" fill="#ff5e1a" />
      </svg>
    </div>
  );
}
