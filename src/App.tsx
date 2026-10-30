import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { homeFor, useAuth } from './lib/auth';
import { isPremium } from './lib/utils';
import type { Role } from './lib/types';
import Shell from './components/Shell';
import Login from './pages/Login';
import Announcements from './pages/Announcements';
import CheckInDesk from './pages/CheckInDesk';
import ClassesManager from './pages/ClassesManager';
import AdminOverview from './pages/admin/Overview';
import AdminMembers from './pages/admin/Members';
import AdminInstructors from './pages/admin/Instructors';
import AdminSettings from './pages/admin/Settings';
import CoachToday from './pages/coach/Today';
import CoachMembers from './pages/coach/Members';
import MemberDetail from './pages/coach/MemberDetail';
import MemberHome from './pages/member/Home';
import Activity from './pages/member/Activity';
import Diet from './pages/member/Diet';
import Goals from './pages/member/Goals';
import Workouts from './pages/member/Workouts';
import MemberClasses from './pages/member/Classes';
import Tools from './pages/member/Tools';
import Upgrade from './pages/member/Upgrade';
import Profile from './pages/member/Profile';
import PremiumGate from './pages/member/PremiumGate';

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function PremiumOnly({ children, feature }: { children: ReactNode; feature: string }) {
  const { user } = useAuth();
  return isPremium(user) ? <>{children}</> : <PremiumGate feature={feature} />;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="center muted small" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>Loading…</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <Login />} />

      <Route element={<RequireRole role="admin"><Shell /></RequireRole>}>
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="/admin/members" element={<AdminMembers />} />
        <Route path="/admin/members/:id" element={<MemberDetail />} />
        <Route path="/admin/instructors" element={<AdminInstructors />} />
        <Route path="/admin/classes" element={<ClassesManager />} />
        <Route path="/admin/checkin" element={<CheckInDesk />} />
        <Route path="/admin/announcements" element={<Announcements />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      <Route element={<RequireRole role="instructor"><Shell /></RequireRole>}>
        <Route path="/coach" element={<CoachToday />} />
        <Route path="/coach/members" element={<CoachMembers />} />
        <Route path="/coach/members/:id" element={<MemberDetail />} />
        <Route path="/coach/classes" element={<ClassesManager />} />
        <Route path="/coach/checkin" element={<CheckInDesk />} />
        <Route path="/coach/announcements" element={<Announcements />} />
      </Route>

      <Route element={<RequireRole role="member"><Shell /></RequireRole>}>
        <Route path="/app" element={<MemberHome />} />
        <Route path="/app/activity" element={<PremiumOnly feature="activity"><Activity /></PremiumOnly>} />
        <Route path="/app/diet" element={<PremiumOnly feature="diet"><Diet /></PremiumOnly>} />
        <Route path="/app/goals" element={<PremiumOnly feature="goals"><Goals /></PremiumOnly>} />
        <Route path="/app/workouts" element={<Workouts />} />
        <Route path="/app/classes" element={<MemberClasses />} />
        <Route path="/app/tools" element={<Tools />} />
        <Route path="/app/upgrade" element={<Upgrade />} />
        <Route path="/app/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? homeFor(user) : '/login'} replace />} />
    </Routes>
  );
}
