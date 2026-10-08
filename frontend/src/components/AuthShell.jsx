import { ActivityIcon, BoardIcon, Logo, RocketIcon } from './Icons';

const FEATURES = [
  { icon: BoardIcon, title: 'Drag-and-drop Kanban', text: 'Workflow rules keep every card honest: To-Do → In Progress → Review → Done.' },
  { icon: ActivityIcon, title: 'Real-time sync', text: 'Every move appears on every teammate’s screen in under a second.' },
  { icon: RocketIcon, title: 'Sprints with velocity caps', text: 'Plan from a prioritised backlog without ever over-committing.' },
];

/** Split-screen layout shared by the Login and Register pages */
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* ---- Brand panel ---- */}
      <div className="relative hidden w-[46%] overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/30 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />

        <div className="relative flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <span className="text-lg font-bold tracking-tight">AgilePulse</span>
        </div>

        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Ship sprints together,{' '}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">in real time.</span>
          </h2>
          <p className="mt-4 text-slate-400">The Agile project management tool for Scrum teams — Product Owners, Scrum Masters and Developers on one live board.</p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-indigo-200 ring-1 ring-white/10">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-white">{t}</p>
                  <p className="text-sm text-slate-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">Software Engineering Lab · Lokesh Magare (B292)</p>
      </div>

      {/* ---- Form panel ---- */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10" />
            <span className="text-lg font-bold tracking-tight text-slate-900">AgilePulse</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mb-8 mt-1.5 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
