/**
 * Sprint Manager (FR-12 .. FR-15)
 * The Scrum Master creates sprints with a velocity cap, starts / closes them and
 * plans backlog stories into a sprint - by drag-and-drop or the Add button.
 * The capacity meter previews the result while dragging; the server still
 * enforces the cap ("Sprint Capacity Exceeded").
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi, backlogApi, errorMessage, sprintApi, taskApi } from '../services/api';
import { subscribe } from '../services/socket';
import { celebrate } from '../utils/celebrate';
import { PRIORITY_BAR, PRIORITY_STYLES, daysLeft, formatShortDate } from '../utils/constants';
import Alert from './Alert';
import Avatar from './Avatar';
import { CalendarIcon, CheckIcon, GripIcon, InfoIcon, LayersIcon, ListIcon, PlayIcon, PlusIcon, RocketIcon, TrashIcon, XIcon } from './Icons';
import Modal, { ConfirmDialog } from './Modal';
import { EmptyState, Skeleton, SkeletonList } from './ui';

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const EMPTY = () => ({ name: '', startDate: iso(Date.now()), endDate: iso(Date.now() + 13 * 86400000), velocityCapacity: 20 });

const STATUS_BADGE = {
  Planned: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  Active: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  Completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
};
const TASK_STATUS_DOT = { 'To-Do': 'bg-slate-400', 'In Progress': 'bg-sky-500', Review: 'bg-violet-500', Done: 'bg-emerald-500' };

/** Velocity meter with a live preview segment while a story is dragged */
function CapacityMeter({ used, capacity, preview = 0 }) {
  const after = used + preview;
  const over = after > capacity;
  const pct = (n) => `${Math.min(100, (n / Math.max(capacity, 1)) * 100)}%`;
  const free = capacity - used;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Velocity</span>
        <span className="text-sm">
          {preview > 0 ? (
            over ? (
              <span className="font-semibold text-rose-600">Exceeds capacity by {after - capacity} pts</span>
            ) : (
              <span className="font-semibold text-emerald-600">
                +{preview} → {after}/{capacity} pts
              </span>
            )
          ) : (
            <>
              <span className="font-bold text-slate-900">{used}</span>
              <span className="text-slate-400"> / {capacity} pts</span>
              <span className={`ml-2 text-xs font-medium ${free === 0 ? 'text-amber-600' : 'text-slate-500'}`}>{free === 0 ? 'full' : `${free} free`}</span>
            </>
          )}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${used >= capacity ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`}
          style={{ width: pct(used) }}
        />
        {preview > 0 && (
          <div
            className={`absolute inset-y-0 animate-pulse transition-all duration-300 ${over ? 'bg-rose-400' : 'bg-emerald-400'}`}
            style={{ left: pct(used), width: over ? `calc(100% - ${pct(used)})` : pct(preview) }}
          />
        )}
      </div>
    </div>
  );
}

export default function SprintManager() {
  const { user } = useAuth();
  const toast = useToast();
  const isSM = user.role === 'SM';

  const [sprints, setSprints] = useState([]);
  const [backlog, setBacklog] = useState([]);
  const [sprintTasks, setSprintTasks] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [busyId, setBusyId] = useState(null); // story currently being moved

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  // drag-and-drop planning
  const [drag, setDrag] = useState(null); // { story, from: 'backlog' | 'sprint' }
  const [overZone, setOverZone] = useState(null);

  const selected = sprints.find((s) => s._id === selectedId);
  const editable = isSM && selected && selected.status !== 'Completed';

  const loadAll = useCallback(async () => {
    const [sprintList, backlogList] = await Promise.all([sprintApi.list(), backlogApi.list()]);
    setSprints(sprintList);
    setBacklog(backlogList);
    setSelectedId((cur) => {
      if (cur && sprintList.some((s) => s._id === cur)) return cur;
      return (sprintList.find((s) => s.status === 'Active') || sprintList[0])?._id || '';
    });
  }, []);

  // Stories of the selected sprint - ignore stale responses when switching quickly
  const reqRef = useRef(0);
  const loadSprintTasks = useCallback(async (id, { silent = false } = {}) => {
    const req = ++reqRef.current;
    if (!id) {
      setSprintTasks([]);
      return;
    }
    if (!silent) setLoadingTasks(true);
    try {
      const list = await taskApi.list(id);
      if (req === reqRef.current) setSprintTasks(list);
    } finally {
      if (req === reqRef.current) setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadAll()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
    authApi
      .users()
      .then((users) => setDevelopers(users.filter((u) => u.role === 'DEV')))
      .catch(() => {});
  }, [loadAll, toast]);

  useEffect(() => {
    loadSprintTasks(selectedId).catch((err) => toast.error(errorMessage(err)));
  }, [selectedId, loadSprintTasks, toast]);

  // Live updates from teammates
  useEffect(() => {
    const refresh = () => {
      loadAll().catch(() => {});
      loadSprintTasks(selectedId, { silent: true }).catch(() => {});
    };
    const offs = ['sprintChanged', 'backlogChanged', 'taskUpdated', 'taskCreated', 'taskDeleted', 'connect'].map((e) => subscribe(e, refresh));
    return () => offs.forEach((off) => off());
  }, [selectedId, loadAll, loadSprintTasks]);

  // ---- actions ----
  const run = async (fn, okMessage) => {
    try {
      await fn();
      if (okMessage) toast.success(okMessage);
      await Promise.all([loadAll(), loadSprintTasks(selectedId, { silent: true })]);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return setFormError('Give the sprint a name');
    if (form.endDate < form.startDate) return setFormError('End date must be on or after the start date');
    setFormError('');
    try {
      const sprint = await sprintApi.create({ ...form, velocityCapacity: Number(form.velocityCapacity) });
      toast.success(`${sprint.name} created`);
      setCreateOpen(false);
      setForm(EMPTY());
      setSelectedId(sprint._id);
      await loadAll();
    } catch (err) {
      setFormError(errorMessage(err));
    }
    return undefined;
  };

  const setStatus = async (status) => {
    const ok = await run(() => sprintApi.update(selected._id, { status }), status === 'Completed' ? `${selected.name} closed — great sprint!` : `${selected.name} started`);
    if (ok && status === 'Completed') celebrate();
  };

  const deleteSprint = async () => {
    const s = toDelete;
    setToDelete(null);
    await run(() => sprintApi.remove(s._id), `${s.name} deleted — its stories went back to the backlog`);
  };

  const addStory = async (story) => {
    setBusyId(story._id);
    await run(() => sprintApi.addTask(selectedId, story._id), `"${story.title}" planned into ${selected?.name}`);
    setBusyId(null);
  };
  const removeStory = async (story) => {
    setBusyId(story._id);
    await run(() => sprintApi.removeTask(selectedId, story._id), `"${story.title}" returned to the backlog`);
    setBusyId(null);
  };
  const assign = (task, devId) => run(() => taskApi.update(task._id, { assignedTo: devId || null }), devId ? 'Assignee updated' : 'Unassigned');

  // ---- drag & drop ----
  const dragProps = (story, from) =>
    editable
      ? {
          draggable: true,
          onDragStart: (e) => {
            e.dataTransfer.setData('text/plain', story._id);
            e.dataTransfer.effectAllowed = 'move';
            setDrag({ story, from });
          },
          onDragEnd: () => {
            setDrag(null);
            setOverZone(null);
          },
        }
      : {};

  const zoneProps = (zone) => ({
    onDragOver: (e) => {
      if (!drag || drag.from === zone) return;
      e.preventDefault();
      if (overZone !== zone) setOverZone(zone);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOverZone(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      const d = drag;
      setDrag(null);
      setOverZone(null);
      if (!d || d.from === zone) return;
      if (zone === 'sprint') addStory(d.story);
      else removeStory(d.story);
    },
  });

  // ---- derived ----
  const used = selected?.committedPoints || 0;
  const capacity = selected?.velocityCapacity || 0;
  const preview = drag?.from === 'backlog' ? drag.story.storyPoints : 0;
  const donePoints = sprintTasks.filter((t) => t.status === 'Done').reduce((sum, t) => sum + t.storyPoints, 0);
  const sprintZoneActive = drag?.from === 'backlog';
  const backlogZoneActive = drag?.from === 'sprint';

  // ---------- render ----------
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <SkeletonList rows={3} className="h-24" />
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <div className="grid gap-4 md:grid-cols-2">
              <SkeletonList rows={4} />
              <SkeletonList rows={4} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Sprints</h1>
          <p className="page-subtitle">Plan stories into time-boxed sprints without exceeding the team's velocity.</p>
        </div>
        {isSM && (
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            New sprint
          </button>
        )}
      </div>

      {!isSM && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm text-indigo-700">
          <InfoIcon className="h-4 w-4 shrink-0" />
          View only — the Scrum Master plans sprints. Changes appear here live.
        </div>
      )}

      {sprints.length === 0 ? (
        <EmptyState
          icon={RocketIcon}
          title="No sprints yet"
          text={isSM ? 'Create your first sprint, then drag stories from the backlog into it.' : 'The Scrum Master has not created a sprint yet.'}
          action={
            isSM && (
              <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="h-4 w-4" /> New sprint
              </button>
            )
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          {/* ---------- Sprint list ---------- */}
          <nav aria-label="Sprints" className="flex gap-3 overflow-x-auto pb-1 no-scrollbar lg:flex-col lg:overflow-visible">
            {sprints.map((s) => {
              const active = s._id === selectedId;
              const pctUsed = Math.min(100, (s.committedPoints / Math.max(s.velocityCapacity, 1)) * 100);
              return (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => setSelectedId(s._id)}
                  className={`w-60 shrink-0 rounded-xl border bg-white p-4 text-left transition lg:w-auto ${
                    active ? 'border-indigo-400 shadow-glow' : 'border-slate-200/80 shadow-soft hover:border-slate-300 hover:shadow-lift'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-800">{s.name}</span>
                    <span className={`chip ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {formatShortDate(s.startDate)} – {formatShortDate(s.endDate)}
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${pctUsed}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
                    <span>
                      {s.committedPoints}/{s.velocityCapacity} pts
                    </span>
                    <span>{s.taskCount} stories</span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* ---------- Selected sprint ---------- */}
          {selected && (
            <section className="min-w-0 space-y-5">
              <div className="card overflow-hidden">
                <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight">{selected.name}</h2>
                        <span className="chip bg-white/15 text-white ring-1 ring-inset ring-white/25">{selected.status}</span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-indigo-100">
                        <CalendarIcon className="h-4 w-4" />
                        {formatShortDate(selected.startDate)} – {formatShortDate(selected.endDate)}
                        {selected.status !== 'Completed' && <> · {daysLeft(selected.endDate)} days left</>}
                      </p>
                    </div>
                    {isSM && (
                      <div className="flex flex-wrap gap-2">
                        {selected.status === 'Planned' && (
                          <button type="button" className="btn bg-white text-indigo-700 shadow-sm hover:bg-indigo-50" onClick={() => setStatus('Active')}>
                            <PlayIcon className="h-4 w-4" /> Start sprint
                          </button>
                        )}
                        {selected.status === 'Active' && (
                          <button type="button" className="btn bg-white text-indigo-700 shadow-sm hover:bg-indigo-50" onClick={() => setStatus('Completed')}>
                            <CheckIcon className="h-4 w-4" /> Close sprint
                          </button>
                        )}
                        <button type="button" className="btn bg-white/10 text-white ring-1 ring-inset ring-white/25 hover:bg-white/20" onClick={() => setToDelete(selected)}>
                          <TrashIcon className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-5 p-6 sm:grid-cols-[1fr_auto]">
                  <CapacityMeter used={used} capacity={capacity} preview={preview} />
                  <div className="flex gap-6 sm:border-l sm:border-slate-100 sm:pl-6">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stories</div>
                      <div className="text-xl font-bold text-slate-900">{selected.taskCount}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Done</div>
                      <div className="text-xl font-bold text-emerald-600">
                        {donePoints}
                        <span className="text-sm font-medium text-slate-400"> pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {editable && (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <GripIcon className="h-4 w-4 text-slate-400" />
                  Drag stories between the two lists, or use the buttons. The meter previews the capacity while you drag.
                </p>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                {/* Sprint backlog (drop zone) */}
                <div
                  {...zoneProps('sprint')}
                  className={`card flex min-h-[18rem] flex-col p-4 transition ${
                    sprintZoneActive ? (overZone === 'sprint' ? (used + preview > capacity ? 'ring-2 ring-rose-300' : 'bg-emerald-50/40 ring-2 ring-emerald-400') : 'ring-2 ring-emerald-200') : ''
                  }`}
                >
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <LayersIcon className="h-4 w-4 text-indigo-500" />
                    In this sprint
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{sprintTasks.length}</span>
                  </h3>
                  {loadingTasks ? (
                    <SkeletonList rows={3} className="h-[4.25rem]" />
                  ) : (
                    <ul className="flex flex-1 flex-col gap-2">
                      {sprintTasks.map((t) => (
                        <li
                          key={t._id}
                          {...dragProps(t, 'sprint')}
                          className={`group relative flex animate-fade-up items-center gap-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 pl-4 transition hover:border-slate-300 hover:shadow-soft ${
                            editable ? 'cursor-grab active:cursor-grabbing' : ''
                          } ${drag?.story._id === t._id ? 'opacity-40' : ''} ${busyId === t._id ? 'animate-pulse' : ''}`}
                        >
                          <span className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_BAR[t.priority]}`} />
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-sm font-medium leading-snug text-slate-800">{t.title}</div>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                              <span className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_DOT[t.status]}`} />
                              {t.status}
                              <span className="text-slate-300">·</span>
                              <span className="font-semibold text-indigo-600">{t.storyPoints} pts</span>
                            </div>
                          </div>
                          {isSM ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar name={t.assignedTo?.name || '?'} size="xs" />
                              <select
                                aria-label={`Assignee for ${t.title}`}
                                className="max-w-[7.5rem] rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-6 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                                value={t.assignedTo?._id || ''}
                                onChange={(e) => assign(t, e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {developers.map((d) => (
                                  <option key={d._id} value={d._id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            t.assignedTo && <Avatar name={t.assignedTo.name} size="xs" />
                          )}
                          {editable && (
                            <button
                              type="button"
                              onClick={() => removeStory(t)}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              title="Return to backlog"
                              aria-label={`Return ${t.title} to backlog`}
                            >
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                      {sprintZoneActive ? (
                        <li
                          className={`flex flex-1 items-center justify-center rounded-xl border-2 border-dashed py-6 text-xs font-semibold ${
                            used + preview > capacity ? 'border-rose-300 text-rose-500' : 'border-emerald-300 text-emerald-600'
                          }`}
                        >
                          {used + preview > capacity ? 'Not enough capacity for this story' : `Drop to plan (+${preview} pts)`}
                        </li>
                      ) : (
                        sprintTasks.length === 0 && (
                          <li className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                            {editable ? 'Drag stories here from the backlog' : 'No stories planned yet'}
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </div>

                {/* Product backlog (drop zone for returning stories) */}
                <div
                  {...zoneProps('backlog')}
                  className={`card flex min-h-[18rem] flex-col p-4 transition ${backlogZoneActive ? (overZone === 'backlog' ? 'bg-amber-50/40 ring-2 ring-amber-400' : 'ring-2 ring-amber-200') : ''}`}
                >
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <ListIcon className="h-4 w-4 text-slate-500" />
                    Product backlog
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{backlog.length}</span>
                  </h3>
                  <ul className="flex flex-1 flex-col gap-2">
                    {backlog.map((story) => {
                      const fits = used + story.storyPoints <= capacity;
                      return (
                        <li
                          key={story._id}
                          {...dragProps(story, 'backlog')}
                          className={`group relative flex animate-fade-up items-center gap-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 pl-4 transition hover:border-slate-300 hover:shadow-soft ${
                            editable ? 'cursor-grab active:cursor-grabbing' : ''
                          } ${drag?.story._id === story._id ? 'opacity-40' : ''} ${busyId === story._id ? 'animate-pulse' : ''}`}
                        >
                          <span className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_BAR[story.priority]}`} />
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-sm font-medium leading-snug text-slate-800">{story.title}</div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`chip ${PRIORITY_STYLES[story.priority]}`}>{story.priority}</span>
                              {editable && !fits && <span className="text-[11px] text-rose-500">won't fit</span>}
                            </div>
                          </div>
                          <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">{story.storyPoints} pts</span>
                          {editable && (
                            <button
                              type="button"
                              onClick={() => addStory(story)}
                              className={`btn px-2.5 py-1.5 text-xs ${fits ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                              title={fits ? 'Add to sprint' : 'Would exceed the velocity capacity'}
                            >
                              <PlusIcon className="h-3.5 w-3.5" />
                              Add
                            </button>
                          )}
                        </li>
                      );
                    })}
                    {backlogZoneActive ? (
                      <li className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-amber-300 py-6 text-xs font-semibold text-amber-600">
                        Drop to return to the backlog
                      </li>
                    ) : (
                      backlog.length === 0 && (
                        <li className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-8 text-xs text-slate-400">The backlog is empty</li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ---------- Create sprint ---------- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New sprint"
        subtitle="Usually a 1–4 week time-box."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleCreate}>
              Create sprint
            </button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-5" noValidate>
          <Alert message={formError} onClose={() => setFormError('')} />
          <div>
            <label htmlFor="sname" className="label">Name</label>
            <input id="sname" className="input" placeholder={`Sprint ${sprints.length + 1}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="start" className="label">Start</label>
              <input id="start" type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="end" className="label">End</label>
              <input id="end" type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="cap" className="label">Velocity capacity</label>
              <span className="text-sm font-bold text-indigo-600">{form.velocityCapacity} pts</span>
            </div>
            <input
              id="cap"
              type="range"
              min="5"
              max="80"
              step="1"
              className="w-full accent-indigo-600"
              value={form.velocityCapacity}
              onChange={(e) => setForm({ ...form, velocityCapacity: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-slate-400">The maximum story points the team commits to. Stories beyond this are blocked.</p>
          </div>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.name || 'sprint'}?`}
        message="The sprint is removed for everyone and all of its stories return to the product backlog (reset to To-Do)."
        onConfirm={deleteSprint}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
