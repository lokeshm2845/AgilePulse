/** Small shared UI pieces: skeletons, empty states, point picker, segmented control */
import { FIBONACCI_POINTS } from '../utils/constants';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function SkeletonList({ rows = 4, className = 'h-16' }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`${className} rounded-xl`} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Planning-poker style Fibonacci picker (FR-10) */
export function PointsPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Story points">
      {FIBONACCI_POINTS.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p)}
            className={`relative flex aspect-[3/4] items-center justify-center rounded-xl border-2 text-lg font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
              active
                ? '-translate-y-1 border-indigo-500 bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30'
                : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control, e.g. priority selector or filters */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {o.dot && <span className={`h-2 w-2 rounded-full ${o.dot}`} />}
            {o.label}
            {o.count !== undefined && <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-slate-100 text-slate-600' : 'bg-white/70 text-slate-500'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function MiniStat({ label, value, hint, tone = 'text-slate-900' }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tracking-tight ${tone}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
