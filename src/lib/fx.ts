/* Feedback effects: toasts, haptics, confetti, press ripples. */
import { useSyncExternalStore } from 'react';

/* ---------- haptics ---------- */
export const haptic = (ms: number | number[] = 10) => {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
};

/* ---------- toasts ---------- */
export type ToastKind = 'success' | 'info' | 'error' | 'celebrate';
export interface Toast { id: number; msg: string; kind: ToastKind }

let toasts: Toast[] = [];
let nextId = 1;
const toastListeners = new Set<() => void>();
const emit = () => toastListeners.forEach((l) => l());

export function toast(msg: string, kind: ToastKind = 'success') {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, msg, kind }];
  emit();
  haptic(kind === 'error' ? [30, 40, 30] : kind === 'celebrate' ? [15, 30, 15, 30, 40] : 12);
  setTimeout(() => dismissToast(id), 2600);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const useToasts = () =>
  useSyncExternalStore((fn) => { toastListeners.add(fn); return () => toastListeners.delete(fn); }, () => toasts);

/* ---------- confetti ---------- */
const COLORS = ['#ff5e1a', '#ff8a3d', '#c6ff3d', '#29d8ff', '#b26bff', '#ffc93d', '#ff5fd2'];

export function confetti(originX = 0.5, originY = 0.45) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:300';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const parts = Array.from({ length: 140 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 10;
    return {
      x: innerWidth * originX, y: innerHeight * originY,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 7,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });

  const start = performance.now();
  const frame = (t: number) => {
    const life = (t - start) / 1800;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (life < 1) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

export function celebrate(msg: string) {
  confetti();
  toast(msg, 'celebrate');
}

/* ---------- press ripple (global) ---------- */
const PRESSABLE = '.btn, .icon-btn, .chip, .card.clickable, .side-link, .bn-link .ico, .segmented button, .check, .glass, .toggle';

export function installPressEffects() {
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(PRESSABLE);
    if (!el || (el as HTMLButtonElement).disabled) return;
    haptic(8);
    if (el.matches('.toggle, .glass, .check, .bn-link .ico')) return; // these have their own animation
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const ink = document.createElement('span');
    ink.className = 'ripple';
    ink.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    el.appendChild(ink);
    setTimeout(() => ink.remove(), 650);
  }, { passive: true });
}
