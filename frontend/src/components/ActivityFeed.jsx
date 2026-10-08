import { useEffect, useState } from 'react';
import { useRealtime } from '../context/RealtimeContext';
import { timeAgo } from '../utils/constants';
import Avatar from './Avatar';
import { ActivityIcon } from './Icons';

const ACTION_STYLE = {
  TASK_MOVED: 'bg-sky-500',
  TASK_CREATED: 'bg-indigo-500',
  TASK_EDITED: 'bg-slate-400',
  TASK_DELETED: 'bg-rose-500',
  STORY_CREATED: 'bg-indigo-500',
  STORY_UPDATED: 'bg-slate-400',
  STORY_DELETED: 'bg-rose-500',
  STORY_PLANNED: 'bg-violet-500',
  STORY_UNPLANNED: 'bg-amber-500',
  SPRINT_CREATED: 'bg-violet-500',
  SPRINT_UPDATED: 'bg-violet-400',
  SPRINT_CLOSED: 'bg-emerald-500',
  SPRINT_DELETED: 'bg-rose-500',
  LOGIN: 'bg-emerald-400',
  LOGOUT: 'bg-slate-300',
  REGISTER: 'bg-emerald-400',
  ACCOUNT_LOCKED: 'bg-rose-600',
};

/** Live audit trail (FR-24) - updates instantly via the 'activity' socket event */
export default function ActivityFeed({ limit = 12 }) {
  const { activity } = useRealtime();
  const [, tick] = useState(0);

  // Refresh "x minutes ago" labels every 30 s
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const items = activity.filter((a) => a.action !== 'LOGOUT').slice(0, limit);

  return (
    <div className="card flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <ActivityIcon className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-bold text-slate-800">Live activity</h2>
        <span className="relative ml-auto flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
        </span>
      </div>

      <ol className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.length === 0 && <li className="px-2 py-6 text-center text-xs text-slate-400">No activity yet - move a card!</li>}
        {items.map((a) => (
          <li key={a._id} className="flex animate-fade-up gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50">
            <div className="relative">
              <Avatar name={a.userId?.name || 'System'} size="sm" />
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${ACTION_STYLE[a.action] || 'bg-slate-300'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-snug text-slate-700">
                <span className="font-semibold text-slate-900">{a.userId?.name || 'Someone'}</span> <span className="text-slate-600">{describe(a)}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(a.timestamp)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function describe(a) {
  if (a.action === 'LOGIN') return 'signed in';
  if (a.action === 'REGISTER') return 'joined the team';
  // details look like: Task "X" moved to Done  ->  moved "X" to Done
  const moved = /^Task "(.+)" moved to (.+)$/.exec(a.details);
  if (moved) return `moved “${moved[1]}” → ${moved[2]}`;
  return a.details.charAt(0).toLowerCase() + a.details.slice(1);
}
