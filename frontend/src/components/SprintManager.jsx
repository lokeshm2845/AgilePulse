/**
 * Sprint Manager (FR-12 .. FR-15)
 * Scrum Master creates sprints with a velocity cap, starts / closes them and
 * plans backlog stories into a sprint. The server blocks any story that would
 * exceed the velocity capacity ("Sprint Capacity Exceeded").
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi, backlogApi, errorMessage, sprintApi, taskApi } from '../services/api';
import { subscribe } from '../services/socket';
import { PRIORITY_STYLES, formatDate } from '../utils/constants';
import Alert from './Alert';

const today = () => new Date().toISOString().slice(0, 10);
const inTwoWeeks = () => new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);
const EMPTY = () => ({ name: '', startDate: today(), endDate: inTwoWeeks(), velocityCapacity: 20 });

const STATUS_BADGE = {
  Planned: 'bg-slate-100 text-slate-700',
  Active: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

export default function SprintManager() {
  const { user } = useAuth();
  const isSM = user.role === 'SM';

  const [sprints, setSprints] = useState([]);
  const [backlog, setBacklog] = useState([]);
  const [sprintTasks, setSprintTasks] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = sprints.find((s) => s._id === selectedId);

  const loadAll = useCallback(async () => {
    const [sprintList, backlogList] = await Promise.all([sprintApi.list(), backlogApi.list()]);
    setSprints(sprintList);
    setBacklog(backlogList);
    setSelectedId((cur) => (cur && sprintList.some((s) => s._id === cur) ? cur : sprintList[0]?._id || ''));
  }, []);

  useEffect(() => {
    loadAll().catch((err) => setError(errorMessage(err)));
    authApi
      .users()
      .then((users) => setDevelopers(users.filter((u) => u.role === 'DEV')))
      .catch(() => {});
    const offs = ['sprintChanged', 'backlogChanged', 'taskUpdated', 'taskCreated', 'taskDeleted'].map((e) =>
      subscribe(e, () => loadAll().catch(() => {}))
    );
    return () => offs.forEach((off) => off());
  }, [loadAll]);

  // Stories of the selected sprint (refreshes whenever sprint totals change)
  useEffect(() => {
    if (!selectedId) {
      setSprintTasks([]);
      return;
    }
    taskApi.list(selectedId).then(setSprintTasks).catch((err) => setError(errorMessage(err)));
  }, [selectedId, sprints]);

  // Wrap an action: clear messages, run it, reload, show result
  const run = async (fn, okMessage) => {
    setError('');
    setSuccess('');
    try {
      await fn();
      if (okMessage) setSuccess(okMessage);
      await loadAll();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Sprint name is required');
      return;
    }
    if (form.endDate < form.startDate) {
      setError('End date must be on or after the start date');
      return;
    }
    run(async () => {
      const sprint = await sprintApi.create({ ...form, velocityCapacity: Number(form.velocityCapacity) });
      setSelectedId(sprint._id);
      setForm(EMPTY());
    }, 'Sprint created');
  };

  const setStatus = (sprint, status) => run(() => sprintApi.update(sprint._id, { status }), `Sprint ${status === 'Completed' ? 'closed' : 'started'}`);

  const deleteSprint = (sprint) => {
    if (!window.confirm(`Delete "${sprint.name}"? Its stories go back to the backlog.`)) return;
    run(() => sprintApi.remove(sprint._id), 'Sprint deleted');
  };

  const addStory = (story) => run(() => sprintApi.addTask(selectedId, story._id), `"${story.title}" added to ${selected?.name}`);
  const removeStory = (story) => run(() => sprintApi.removeTask(selectedId, story._id), `"${story.title}" returned to backlog`);
  const assign = (task, devId) => run(() => taskApi.update(task._id, { assignedTo: devId || null }));

  const used = selected?.committedPoints || 0;
  const capacity = selected?.velocityCapacity || 0;
  const pct = capacity ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
  const editable = isSM && selected && selected.status !== 'Completed';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Sprints</h1>
        <p className="page-subtitle">Create sprints, set velocity capacity and plan backlog stories.</p>
      </div>

      {!isSM && <Alert type="info" message="View only - the Scrum Master creates and plans sprints." />}
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---- Sprint list + create form ---- */}
        <section className="space-y-4">
          {isSM && (
            <form onSubmit={handleCreate} className="card space-y-3 p-5" noValidate>
              <h2 className="font-semibold text-slate-800">New sprint</h2>
              <div>
                <label htmlFor="sname" className="label">Name</label>
                <input id="sname" className="input" placeholder="Sprint 1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
                <label htmlFor="cap" className="label">Velocity capacity (story points)</label>
                <input id="cap" type="number" min="1" className="input" value={form.velocityCapacity} onChange={(e) => setForm({ ...form, velocityCapacity: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary w-full">Create sprint</button>
            </form>
          )}

          <ul className="space-y-2">
            {sprints.length === 0 && <li className="card p-4 text-sm text-slate-500">No sprints yet.</li>}
            {sprints.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s._id)}
                  className={`card w-full p-3 text-left transition hover:border-indigo-300 ${selectedId === s._id ? 'border-indigo-400 ring-2 ring-indigo-200' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className={`chip ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatDate(s.startDate)} – {formatDate(s.endDate)} · {s.committedPoints}/{s.velocityCapacity} pts
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ---- Sprint planning ---- */}
        <section className="space-y-4 lg:col-span-2">
          {!selected ? (
            <div className="card p-8 text-center text-sm text-slate-500">Select or create a sprint to plan it.</div>
          ) : (
            <>
              <div className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">{selected.name}</h2>
                    <p className="text-sm text-slate-500">
                      {formatDate(selected.startDate)} – {formatDate(selected.endDate)}
                    </p>
                  </div>
                  {isSM && (
                    <div className="flex flex-wrap gap-2">
                      {selected.status === 'Planned' && (
                        <button type="button" className="btn-primary" onClick={() => setStatus(selected, 'Active')}>Start sprint</button>
                      )}
                      {selected.status === 'Active' && (
                        <button type="button" className="btn-primary" onClick={() => setStatus(selected, 'Completed')}>Close sprint</button>
                      )}
                      <button type="button" className="btn-danger" onClick={() => deleteSprint(selected)}>Delete</button>
                    </div>
                  )}
                </div>

                {/* Velocity bar */}
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-600">
                    <span>Velocity used</span>
                    <span className="font-medium">
                      {used} / {capacity} pts
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full transition-all duration-500 ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Stories in this sprint */}
                <div className="card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">In this sprint ({sprintTasks.length})</h3>
                  <ul className="space-y-2">
                    {sprintTasks.length === 0 && <li className="text-xs text-slate-400">No stories planned yet.</li>}
                    {sprintTasks.map((t) => (
                      <li key={t._id} className="rounded-md border border-slate-200 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm text-slate-800">{t.title}</span>
                          <span className="shrink-0 text-xs font-semibold text-indigo-700">{t.storyPoints} pts</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">{t.status}</span>
                          {isSM ? (
                            <select
                              aria-label={`Assign ${t.title}`}
                              className="input ml-auto w-auto py-1 text-xs"
                              value={t.assignedTo?._id || ''}
                              onChange={(e) => assign(t, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {developers.map((d) => (
                                <option key={d._id} value={d._id}>{d.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="ml-auto text-[11px] text-slate-500">{t.assignedTo?.name || 'Unassigned'}</span>
                          )}
                          {editable && (
                            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeStory(t)}>
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Backlog to pick from */}
                <div className="card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Product backlog ({backlog.length})</h3>
                  <ul className="space-y-2">
                    {backlog.length === 0 && <li className="text-xs text-slate-400">Backlog is empty.</li>}
                    {backlog.map((story) => {
                      const fits = used + story.storyPoints <= capacity;
                      return (
                        <li key={story._id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-slate-800">{story.title}</div>
                            <span className={`chip ${PRIORITY_STYLES[story.priority]}`}>{story.priority}</span>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-indigo-700">{story.storyPoints} pts</span>
                          {editable && (
                            <button
                              type="button"
                              className={`btn px-2 py-1 text-xs ${fits ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-100 text-slate-400'}`}
                              title={fits ? 'Add to sprint' : 'Would exceed velocity capacity'}
                              onClick={() => addStory(story)}
                            >
                              Add
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
