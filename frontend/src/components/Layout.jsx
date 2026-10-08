import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { ROLE_LABELS } from '../utils/constants';
import Avatar from './Avatar';
import { BoardIcon, ListIcon, Logo, LogoutIcon, RocketIcon } from './Icons';

const NAV = [
  { to: '/board', label: 'Kanban Board', icon: BoardIcon },
  { to: '/backlog', label: 'Product Backlog', icon: ListIcon },
  { to: '/sprints', label: 'Sprints', icon: RocketIcon },
];

function LiveBadge({ connected, dark = false }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${
        connected ? (dark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : dark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
      }`}
      title={connected ? 'Real-time sync connected' : 'Reconnecting to real-time sync…'}
    >
      <span className="relative flex h-2 w-2">
        {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      </span>
      {connected ? 'Live' : 'Reconnecting'}
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { connected, onlineUsers } = useRealtime();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen lg:pl-64">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-950 text-slate-300 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.25),transparent_55%)]" />

        <div className="relative flex items-center gap-3 px-5 py-5">
          <Logo className="h-9 w-9" />
          <div>
            <div className="text-[15px] font-bold tracking-tight text-white">AgilePulse</div>
            <div className="text-[11px] text-slate-400">Scrum, in real time</div>
          </div>
        </div>

        <nav className="relative mt-2 space-y-1 px-3" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white/10 text-white shadow-inner shadow-white/5' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Presence */}
        <div className="relative mt-8 px-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Online now</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{onlineUsers.length}</span>
          </div>
          <ul className="space-y-2.5">
            {onlineUsers.map((u) => (
              <li key={u._id} className="flex animate-fade-up items-center gap-2.5">
                <Avatar name={u.name} size="sm" online className="[&>span:first-child]:ring-slate-950" />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[13px] text-slate-200">
                    {u.name}
                    {u._id === user._id && <span className="text-slate-500"> (you)</span>}
                  </div>
                  <div className="text-[11px] text-slate-500">{ROLE_LABELS[u.role] || ''}</div>
                </div>
              </li>
            ))}
            {onlineUsers.length === 0 && <li className="text-xs text-slate-500">Connecting…</li>}
          </ul>
        </div>

        {/* Current user */}
        <div className="relative mt-auto border-t border-white/5 p-4">
          <div className="mb-3">
            <LiveBadge connected={connected} dark />
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="md" className="[&>span]:ring-slate-950" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold text-white">{user.name}</div>
              <div className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</div>
            </div>
            <button type="button" onClick={handleLogout} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" title="Log out" aria-label="Log out">
              <LogoutIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- Top bar (mobile / tablet) ---------- */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Logo className="h-8 w-8" />
          <span className="font-bold tracking-tight text-slate-900">AgilePulse</span>
          <div className="ml-auto flex items-center gap-2">
            <LiveBadge connected={connected} />
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 3).map((u) => (
                <Avatar key={u._id} name={u.name} size="xs" />
              ))}
            </div>
            <button type="button" onClick={handleLogout} className="btn-ghost p-2" aria-label="Log out">
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
