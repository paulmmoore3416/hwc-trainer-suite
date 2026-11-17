import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldAlert,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { APP_SHORT, APP_VERSION } from '../lib/config';
import { titleCase } from '../lib/format';
import { cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  show?: boolean;
}

export function Layout() {
  const { profile, isSuper, isAdmin, facilities, scope, setScope, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  const nav: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
    { to: '/students', label: 'Students', icon: <Users className="h-4.5 w-4.5" /> },
    { to: '/classes', label: 'Classes', icon: <CalendarDays className="h-4.5 w-4.5" /> },
    { to: '/certificates', label: 'Certificates', icon: <Award className="h-4.5 w-4.5" /> },
    { to: '/incidents', label: 'Training Incidents', icon: <ShieldAlert className="h-4.5 w-4.5" /> },
    { to: '/reports', label: 'Reports & Metrics', icon: <BarChart3 className="h-4.5 w-4.5" /> },
    { to: '/team', label: 'Instructors & Invites', icon: <Building2 className="h-4.5 w-4.5" /> },
    { to: '/admin', label: 'Administration', icon: <Settings className="h-4.5 w-4.5" />, show: isSuper },
    { to: '/logs', label: 'System Logs', icon: <ScrollText className="h-4.5 w-4.5" />, show: isSuper },
  ];

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-900 text-slate-200">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-brand to-brand-500 shadow-lg">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="font-serif text-lg font-semibold text-white italic">Handle With Care</div>
          <div className="text-[11px] tracking-[0.2em] text-slate-400 uppercase">Trainer Suite</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {nav
          .filter((n) => n.show !== false)
          .map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <NavLink
          to="/profile"
          onClick={() => setOpen(false)}
          className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5')}
        >
          <UserCircle className="h-5 w-5" />
          <div className="min-w-0">
            <div className="truncate font-medium text-white">{profile?.full_name || profile?.email}</div>
            <div className="text-[11px] text-slate-400">{isSuper ? 'Super Admin' : titleCase(profile?.role ?? '')}</div>
          </div>
        </NavLink>
        <button onClick={() => void signOut()} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
          <LogOut className="h-4.5 w-4.5" /> Sign out
        </button>
        <div className="mt-2 px-3 text-[10px] text-slate-500">
          {APP_SHORT} v{APP_VERSION}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <select
              aria-label="Facility scope"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="">{isSuper ? 'All facilities' : facilities.length > 1 ? 'All my facilities' : facilities[0]?.name ?? 'No facility'}</option>
              {facilities.length > 1 || isSuper
                ? facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))
                : null}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            {isAdmin && !isSuper && <span className="rounded-full bg-teal-50 px-2 py-0.5 font-medium text-teal-800">Facility Admin</span>}
            {isSuper && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Super Admin</span>}
          </div>
        </header>
        <main key={loc.pathname} className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
