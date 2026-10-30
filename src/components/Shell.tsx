import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BicepsFlexed, Calculator, CalendarDays, ClipboardCheck, Crown, Dumbbell, Footprints, Home, LayoutDashboard, LogOut,
  Megaphone, Menu, Moon, Settings, Sun, Target, User as UserIcon, UserCog, Users, Utensils,
} from 'lucide-react';
import { useAuth, useMe } from '../lib/auth';
import { useDB } from '../lib/db';
import { cls, isPremium } from '../lib/utils';
import type { User } from '../lib/types';
import { Avatar, Badge, IconButton, Modal, Toaster, Toggle } from './ui';
import { haptic } from '../lib/fx';

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

const I = 18;
const SHOW_CLASSES = false; // the Classes menu button (hidden for now; the pages still exist)
function navFor(u: User): NavItem[] {
  return allNavFor(u).filter((n) => SHOW_CLASSES || !n.to.endsWith('/classes'));
}
function allNavFor(u: User): NavItem[] {
  if (u.role === 'admin') return [
    { to: '/admin', label: 'Overview', icon: <LayoutDashboard size={I} />, end: true },
    { to: '/admin/members', label: 'Members', icon: <Users size={I} /> },
    { to: '/admin/instructors', label: 'Coaches', icon: <UserCog size={I} /> },
    { to: '/admin/classes', label: 'Classes', icon: <CalendarDays size={I} /> },
    { to: '/admin/checkin', label: 'Check-in', icon: <ClipboardCheck size={I} /> },
    { to: '/admin/announcements', label: 'News', icon: <Megaphone size={I} /> },
    { to: '/admin/settings', label: 'Settings', icon: <Settings size={I} /> },
  ];
  if (u.role === 'instructor') return [
    { to: '/coach', label: 'Today', icon: <LayoutDashboard size={I} />, end: true },
    { to: '/coach/members', label: 'Members', icon: <Users size={I} /> },
    { to: '/coach/classes', label: 'Classes', icon: <CalendarDays size={I} /> },
    { to: '/coach/checkin', label: 'Check-in', icon: <ClipboardCheck size={I} /> },
    { to: '/coach/announcements', label: 'News', icon: <Megaphone size={I} /> },
  ];
  if (isPremium(u)) return [
    { to: '/app', label: 'Home', icon: <Home size={I} />, end: true },
    { to: '/app/activity', label: 'Activity', icon: <Footprints size={I} /> },
    { to: '/app/diet', label: 'Diet', icon: <Utensils size={I} /> },
    { to: '/app/goals', label: 'Goals', icon: <Target size={I} /> },
    { to: '/app/workouts', label: 'Workouts', icon: <Dumbbell size={I} /> },
    { to: '/app/classes', label: 'Classes', icon: <CalendarDays size={I} /> },
    { to: '/app/tools', label: 'Tools', icon: <Calculator size={I} /> },
    { to: '/app/profile', label: 'Profile', icon: <UserIcon size={I} /> },
  ];
  return [
    { to: '/app', label: 'Home', icon: <Home size={I} />, end: true },
    { to: '/app/classes', label: 'Classes', icon: <CalendarDays size={I} /> },
    { to: '/app/workouts', label: 'Workouts', icon: <Dumbbell size={I} /> },
    { to: '/app/tools', label: 'Tools', icon: <Calculator size={I} /> },
    { to: '/app/upgrade', label: 'Premium', icon: <Crown size={I} /> },
    { to: '/app/profile', label: 'Profile', icon: <UserIcon size={I} /> },
  ];
}

// theme is module-level so every component sees the same value
type Theme = 'light' | 'dark';
let theme: Theme = (localStorage.getItem('ironpulse-theme') as Theme) || 'dark';
const themeListeners = new Set<() => void>();
function applyTheme(t: Theme) {
  theme = t;
  document.documentElement.dataset.theme = t;
  localStorage.setItem('ironpulse-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#17191e' : '#e6ebf1');
  themeListeners.forEach((l) => l());
}
applyTheme(theme);

export function useTheme() {
  const t = useSyncExternalStore((fn) => { themeListeners.add(fn); return () => themeListeners.delete(fn); }, () => theme);
  return { theme: t, toggle: () => applyTheme(t === 'dark' ? 'light' : 'dark') };
}

const roleLabel = (u: User) =>
  u.role === 'admin' ? 'Owner · Admin' : u.role === 'instructor' ? 'Instructor' : isPremium(u) ? 'Premium member' : 'Basic member';

export default function Shell() {
  const me = useMe();
  const { logout } = useAuth();
  const db = useDB();
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const items = navFor(me);
  const mobileItems = items.slice(0, 5);

  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);

  // swipe left/right on phones to move between bottom-nav tabs
  const nav = useNavigate();
  const [swipe, setSwipe] = useState<'' | 'swipe-out-left' | 'swipe-out-right'>('');
  useEffect(() => {
    let sx = 0, sy = 0, t0 = 0, ignore = false;
    const start = (e: TouchEvent) => {
      const el = e.target as HTMLElement;
      ignore = !!el.closest('.segmented, input, textarea, select, .modal, .bars, [data-noswipe]');
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now();
    };
    const end = (e: TouchEvent) => {
      if (ignore || window.innerWidth > 900) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - t0 > 600) return;
      const idx = mobileItems.findIndex((it) => (it.end ? loc.pathname === it.to : loc.pathname.startsWith(it.to)));
      const next = mobileItems[idx + (dx < 0 ? 1 : -1)];
      if (idx < 0 || !next) return;
      haptic(12);
      setSwipe(dx < 0 ? 'swipe-out-left' : 'swipe-out-right');
      setTimeout(() => { nav(next.to); setSwipe(''); }, 170);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchend', end, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchend', end); };
  }, [loc.pathname, mobileItems, nav]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><BicepsFlexed size={22} /></div>
          <div>
            <div className="brand-name">{db.settings.gymName}</div>
            <div className="brand-sub">{roleLabel(me)}</div>
          </div>
        </div>
        <nav className="side-nav">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cls('side-link', isActive && 'active')}>
              <span className="ico">{it.icon}</span>{it.label}
            </NavLink>
          ))}
        </nav>
        <div className="neu-sm" style={{ padding: 14 }}>
          <div className="row">
            <Avatar name={me.name} color={me.color} size={38} />
            <div className="grow" style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small truncate">{me.name}</div>
              <div className="xs muted truncate">{me.email}</div>
            </div>
          </div>
          <div className="row between" style={{ marginTop: 14 }}>
            <div className="row small bold muted" style={{ gap: 8 }}>{theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />} Dark</div>
            <Toggle checked={theme === 'dark'} onChange={toggle} label="Dark mode" />
          </div>
          <button className="btn flat sm block danger" style={{ marginTop: 10 }} onClick={logout}><LogOut size={15} /> Log out</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="row">
            <div className="brand-logo" style={{ width: 40, height: 40, borderRadius: 13 }}><BicepsFlexed size={20} /></div>
            <div>
              <div className="brand-name" style={{ fontSize: 16 }}>{db.settings.gymName}</div>
              <div className="brand-sub">{roleLabel(me)}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <IconButton onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
            <IconButton onClick={() => setMenu(true)} aria-label="Menu"><Menu size={18} /></IconButton>
          </div>
        </header>
        <div key={loc.pathname} className={swipe}><Outlet /></div>
      </main>
      <Toaster />

      <nav className="bottom-nav neu">
        {mobileItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cls('bn-link', isActive && 'active')}>
            <span className="ico">{it.icon}</span>
            <span className="truncate" style={{ maxWidth: '100%' }}>{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <Modal open={menu} onClose={() => setMenu(false)} title="Menu">
        <div className="row" style={{ marginBottom: 18 }}>
          <Avatar name={me.name} color={me.color} size={48} />
          <div style={{ minWidth: 0 }}>
            <div className="heavy truncate">{me.name}</div>
            <Badge tone={me.role === 'member' && isPremium(me) ? 'gold' : 'accent'}>{roleLabel(me)}</Badge>
          </div>
        </div>
        <div className="col">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cls('side-link', isActive && 'active')}>
              <span className="ico">{it.icon}</span>{it.label}
            </NavLink>
          ))}
          <button className="btn danger block" style={{ marginTop: 8 }} onClick={logout}><LogOut size={16} /> Log out</button>
        </div>
      </Modal>
    </div>
  );
}
