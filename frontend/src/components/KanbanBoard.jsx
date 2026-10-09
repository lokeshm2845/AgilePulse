/**
 * KanbanBoard - the "Developer Moves a Task Card" scenario:
 *  1. Developer drags a card   2. frontend validates the move
 *  3. PUT /api/tasks/:id       4-6. backend verifies JWT, workflow, saves
 *  7-8. server broadcasts 'taskUpdated' to every dashboard
 *  9. board re-renders with visual feedback
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { errorMessage, sprintApi, taskApi } from '../services/api';
import { subscribe } from '../services/socket';
import { COLUMN_META, STATUSES, daysLeft, formatShortDate, nextStatus, validateTransition } from '../utils/constants';
import ActivityFeed from './ActivityFeed';
import Column from './Column';
import TaskDetail from './TaskDetail';
import { burst } from '../utils/celebrate';
import { CheckIcon, ClockIcon, InfoIcon, RocketIcon, TargetIcon, UsersIcon } from './Icons';

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="card flex items-center gap-3.5 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-xl font-bold tracking-tight text-slate-900">{value}</div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const { user } = useAuth();
  const { onlineUsers } = useRealtime();
  const toast = useToast();
  const canMove = user.role === 'DEV';

  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState(null);
  const [rejectedId, setRejectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const flash = (id) => {
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1400);
  };
  const reject = (id) => {
    setRejectedId(id);
    setTimeout(() => setRejectedId((cur) => (cur === id ? null : cur)), 600);
  };

  // Load sprints; default to the Active sprint (or the most recent one)
  const loadSprints = useCallback(async () => {
    const list = await sprintApi.list();
    setSprints(list);
    setSprintId((current) => {
      if (current && list.some((s) => s._id === current)) return current;
      return (list.find((s) => s.status === 'Active') || list[0])?._id || '';
    });
  }, []);

  const loadTasks = useCallback(async (id) => {
    if (!id) {
      setTasks([]);
      return;
    }
    setTasks(await taskApi.list(id));
  }, []);

  useEffect(() => {
    loadSprints()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [loadSprints, toast]);

  useEffect(() => {
    loadTasks(sprintId).catch((err) => toast.error(errorMessage(err)));
  }, [sprintId, loadTasks, toast]);

  // ---- Real-time sync (FR-20) ----
  useEffect(() => {
    const offs = [
      subscribe('taskUpdated', (task) => {
        setTasks((prev) => {
          const exists = prev.some((t) => t._id === task._id);
          if (task.sprintId !== sprintId) return prev.filter((t) => t._id !== task._id); // left this sprint
          return exists ? prev.map((t) => (t._id === task._id ? task : t)) : [...prev, task];
        });
        flash(task._id);
        loadSprints().catch(() => {}); // committed points may have changed
      }),
      subscribe('taskCreated', (task) => {
        if (task.sprintId === sprintId) setTasks((prev) => (prev.some((t) => t._id === task._id) ? prev : [...prev, task]));
      }),
      subscribe('taskDeleted', ({ _id }) => setTasks((prev) => prev.filter((t) => t._id !== _id))),
      subscribe('sprintChanged', () => loadSprints().catch(() => {})),
      subscribe('backlogChanged', () => loadTasks(sprintId).catch(() => {})),
      // After a dropped connection, re-sync everything we may have missed
      subscribe('connect', () => {
        loadSprints().catch(() => {});
        loadTasks(sprintId).catch(() => {});
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [sprintId, loadSprints, loadTasks]);

  // ---- Moving a card ----
  const moveTask = async (taskId, newStatus) => {
    setDragging(null);
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === newStatus) return;

    // Step 2: frontend validation - instant feedback, no network round-trip
    if (!validateTransition(task.status, newStatus)) {
      reject(taskId);
      toast.error(`Cards move one step at a time: To-Do → In Progress → Review → Done.`, {
        title: `Can't move "${task.status}" → "${newStatus}"`,
      });
      return;
    }

    // Optimistic update so the card moves immediately
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)));

    try {
      const updated = await taskApi.move(taskId, newStatus);
      setTasks((prev) => prev.map((t) => (t._id === taskId ? updated : t)));
      flash(taskId);
      if (newStatus === 'Done') {
        toast.success(`"${task.title}" is done!`, { title: 'Nice work 🎉' });
        const el = document.querySelector(`[data-task-id="${taskId}"]`);
        const r = el?.getBoundingClientRect();
        burst(r ? (r.left + r.width / 2) / window.innerWidth : 0.5, r ? (r.top + r.height / 2) / window.innerHeight : 0.5);
      }
    } catch (err) {
      setTasks(previous); // roll back
      reject(taskId);
      toast.error(errorMessage(err), { title: 'Move rejected' });
    }
  };

  const handleMoveNext = (task) => {
    const next = nextStatus(task.status);
    if (next) moveTask(task._id, next);
  };

  // ---- Derived data ----
  const sprint = sprints.find((s) => s._id === sprintId);
  const byStatus = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, tasks.filter((t) => t.status === s)])), [tasks]);
  const totalPoints = tasks.reduce((sum, t) => sum + t.storyPoints, 0);
  const donePoints = byStatus.Done.reduce((sum, t) => sum + t.storyPoints, 0);
  const progress = totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0;

  const dropStateFor = (status) => {
    if (!dragging || dragging.status === status) return null;
    return validateTransition(dragging.status, status) ? 'valid' : 'invalid';
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((s) => (
          <div key={s} className="h-96 animate-pulse rounded-2xl bg-slate-200/60" />
        ))}
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <RocketIcon className="h-7 w-7" />
        </span>
        <h1 className="text-lg font-bold text-slate-900">No sprints yet</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user.role === 'SM' ? 'Create your first sprint and plan backlog stories into it.' : 'Your Scrum Master needs to create a sprint before tasks appear here.'}
        </p>
        {user.role === 'SM' && (
          <Link to="/sprints" className="btn-primary mt-5">
            Create a sprint
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="page-title">{sprint?.name || 'Kanban Board'}</h1>
            {sprint && (
              <span
                className={`chip ${sprint.status === 'Active' ? 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200' : sprint.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-slate-100 text-slate-600'}`}
              >
                {sprint.status}
              </span>
            )}
          </div>
          {sprint && (
            <p className="text-sm text-slate-500">
              {formatShortDate(sprint.startDate)} – {formatShortDate(sprint.endDate)} · Kanban board
            </p>
          )}
        </div>
        <div className="w-full sm:w-64">
          <label htmlFor="sprint" className="label">Sprint</label>
          <select id="sprint" className="input" value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
            {sprints.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} · {s.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---------- Stats ---------- */}
      {sprint && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <div className="card col-span-2 p-4 xl:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sprint progress</span>
              <span className="text-sm font-bold text-slate-900">{progress}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {donePoints} of {totalPoints} points done
            </div>
          </div>
          <StatCard icon={TargetIcon} label="Velocity" value={`${totalPoints}/${sprint.velocityCapacity}`} sub="points committed" accent="bg-indigo-50 text-indigo-600" />
          <StatCard icon={ClockIcon} label="Time left" value={sprint.status === 'Completed' ? 'Closed' : `${daysLeft(sprint.endDate)} days`} sub={`ends ${formatShortDate(sprint.endDate)}`} accent="bg-amber-50 text-amber-600" />
          <StatCard icon={UsersIcon} label="Team online" value={onlineUsers.length} sub={onlineUsers.map((u) => u.name.split(' ')[0]).join(', ') || '—'} accent="bg-emerald-50 text-emerald-600" />
        </div>
      )}

      {!canMove && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm text-indigo-700">
          <InfoIcon className="h-4 w-4 shrink-0" />
          View only — Developers move cards. You still see every change live.
        </div>
      )}

      {/* ---------- Board + feed ---------- */}
      <div className="grid gap-6 2xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
        {/* Phone: tap a tab to jump to that column */}
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:hidden" role="tablist" aria-label="Columns">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                const col = document.querySelector(`section[aria-label="${s} column"]`);
                const row = col?.parentElement;
                if (row) row.scrollTo({ left: col.offsetLeft - row.offsetLeft - 16, behavior: 'smooth' });
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm active:scale-95"
            >
              <span className={`h-2 w-2 rounded-full ${COLUMN_META[s].dot}`} />
              {s}
              <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{byStatus[s].length}</span>
            </button>
          ))}
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={byStatus[status]}
              canMove={canMove}
              highlightId={highlightId}
              rejectedId={rejectedId}
              draggingId={dragging?._id}
              dropState={dropStateFor(status)}
              onDropTask={moveTask}
              onMoveNext={handleMoveNext}
              onDragStart={setDragging}
              onDragEnd={() => setDragging(null)}
              onOpen={(t) => setDetailId(t._id)}
            />
          ))}
        </div>
        </div>
        <div className="2xl:sticky 2xl:top-8 2xl:h-[calc(100vh-14rem)] h-96">
          <ActivityFeed limit={20} />
        </div>
      </div>

      <TaskDetail
        task={tasks.find((t) => t._id === detailId) || null}
        canMove={canMove}
        onMoveNext={handleMoveNext}
        onClose={() => setDetailId(null)}
      />

      <p className="text-center text-xs text-slate-400 sm:hidden">Swipe sideways to see all four columns →</p>

      {canMove && (
        <p className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
          <CheckIcon className="h-3.5 w-3.5" />
          Drag cards between columns, or focus a card with <kbd className="rounded border border-slate-300 bg-white px-1">Tab</kbd> and press{' '}
          <kbd className="rounded border border-slate-300 bg-white px-1">Enter</kbd> to move it forward.
        </p>
      )}
    </div>
  );
}
