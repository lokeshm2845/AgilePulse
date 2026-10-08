/**
 * Product Backlog (FR-07 .. FR-11)
 * Everyone can view the prioritised backlog; only the Product Owner can add,
 * edit or delete user stories and set their Fibonacci story points.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { backlogApi, errorMessage } from '../services/api';
import { subscribe } from '../services/socket';
import { FIBONACCI_POINTS, PRIORITIES, PRIORITY_STYLES } from '../utils/constants';
import Alert from './Alert';

const EMPTY = { title: '', description: '', storyPoints: 1, priority: 'Medium' };

export default function Backlog() {
  const { user } = useAuth();
  const isPO = user.role === 'PO';

  const [stories, setStories] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => backlogApi.list().then(setStories), []);

  useEffect(() => {
    load()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    // Keep the list fresh when other users change it
    const offs = ['backlogChanged', 'taskUpdated', 'taskDeleted', 'sprintChanged'].map((e) => subscribe(e, () => load().catch(() => {})));
    return () => offs.forEach((off) => off());
  }, [load]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === 'storyPoints' ? Number(value) : value });
  };

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim()) {
      setError('Story title is required');
      return;
    }
    try {
      if (editingId) {
        await backlogApi.update(editingId, form);
        setSuccess('Story updated');
      } else {
        await backlogApi.create(form);
        setSuccess('Story added to backlog');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const startEdit = (story) => {
    setEditingId(story._id);
    setForm({ title: story.title, description: story.description || '', storyPoints: story.storyPoints, priority: story.priority });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (story) => {
    if (!window.confirm(`Delete "${story.title}" from the backlog?`)) return;
    setError('');
    try {
      await backlogApi.remove(story._id);
      setSuccess('Story deleted');
      if (editingId === story._id) resetForm();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const totalPoints = stories.reduce((sum, s) => sum + s.storyPoints, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ---- Story list ---- */}
      <section className={isPO ? 'lg:col-span-2' : 'lg:col-span-3'}>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="page-title">Product Backlog</h1>
            <p className="text-sm text-slate-500">
              {stories.length} stories · {totalPoints} points · sorted by priority
            </p>
          </div>
        </div>

        {!isPO && <Alert type="info" message="View only - the Product Owner manages backlog stories." />}

        {loading ? (
          <p className="text-slate-500">Loading backlog…</p>
        ) : stories.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">The backlog is empty.</div>
        ) : (
          <ul className="space-y-2">
            {stories.map((story) => (
              <li key={story._id} className={`card flex items-start gap-4 p-4 ${editingId === story._id ? 'ring-2 ring-indigo-300' : ''}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-sm shadow-indigo-500/30" title="Story points">
                  {story.storyPoints}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-slate-800">{story.title}</h3>
                    <span className={`chip ${PRIORITY_STYLES[story.priority]}`}>{story.priority}</span>
                  </div>
                  {story.description && <p className="mt-1 text-sm text-slate-500">{story.description}</p>}
                </div>
                {isPO && (
                  <div className="flex shrink-0 gap-2">
                    <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => startEdit(story)}>
                      Edit
                    </button>
                    <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => handleDelete(story)}>
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Add / edit form (PO only) ---- */}
      {isPO && (
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={handleSubmit} className="card space-y-4 p-5" noValidate>
            <h2 className="font-semibold text-slate-800">{editingId ? 'Edit user story' : 'New user story'}</h2>
            <Alert message={error} onClose={() => setError('')} />
            <Alert type="success" message={success} onClose={() => setSuccess('')} />

            <div>
              <label htmlFor="title" className="label">Title</label>
              <input id="title" name="title" className="input" placeholder="As a … I want … so that …" value={form.title} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="description" className="label">Description / acceptance criteria</label>
              <textarea id="description" name="description" rows={3} className="input" value={form.description} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="storyPoints" className="label">Story points</label>
                <select id="storyPoints" name="storyPoints" className="input" value={form.storyPoints} onChange={handleChange}>
                  {FIBONACCI_POINTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="priority" className="label">Priority</label>
                <select id="priority" name="priority" className="input" value={form.priority} onChange={handleChange}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                {editingId ? 'Save changes' : 'Add story'}
              </button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>
      )}
    </div>
  );
}
