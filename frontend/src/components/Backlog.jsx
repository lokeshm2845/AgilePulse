/**
 * Product Backlog (FR-07 .. FR-11)
 * Everyone sees the prioritised backlog live; only the Product Owner can add,
 * edit or delete user stories and set their Fibonacci story points.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { backlogApi, errorMessage } from '../services/api';
import { subscribe } from '../services/socket';
import { PRIORITIES, PRIORITY_BAR, PRIORITY_STYLES, timeAgo } from '../utils/constants';
import Alert from './Alert';
import Avatar from './Avatar';
import { EditIcon, InfoIcon, ListIcon, PlusIcon, SearchIcon, TrashIcon } from './Icons';
import Modal, { ConfirmDialog } from './Modal';
import { EmptyState, MiniStat, PointsPicker, Segmented, SkeletonList } from './ui';

const EMPTY = { title: '', description: '', storyPoints: 3, priority: 'Medium' };
const PRIORITY_DOTS = { High: 'bg-rose-500', Medium: 'bg-amber-400', Low: 'bg-slate-400' };

export default function Backlog() {
  const { user } = useAuth();
  const toast = useToast();
  const isPO = user.role === 'PO';

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [highlightId, setHighlightId] = useState(null);

  // editor drawer
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // delete confirmation
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => backlogApi.list().then(setStories), []);

  useEffect(() => {
    load()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));

    // Live: refresh and highlight whatever a teammate changed
    const offs = [
      subscribe('backlogChanged', ({ _id }) => {
        load().catch(() => {});
        setHighlightId(_id);
        setTimeout(() => setHighlightId((cur) => (cur === _id ? null : cur)), 1500);
      }),
      ...['taskUpdated', 'taskDeleted', 'sprintChanged', 'connect'].map((e) => subscribe(e, () => load().catch(() => {}))),
    ];
    return () => offs.forEach((off) => off());
  }, [load, toast]);

  // ---- editor ----
  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY);
    setFormError('');
    setEditorOpen(true);
  };
  const openEdit = (story) => {
    setEditingId(story._id);
    setForm({ title: story.title, description: story.description || '', storyPoints: story.storyPoints, priority: story.priority });
    setFormError('');
    setEditorOpen(true);
  };
  const closeEditor = useCallback(() => setEditorOpen(false), []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.title.trim()) {
      setFormError('Give the story a title');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await backlogApi.update(editingId, form);
        toast.success(`"${form.title}" updated`);
      } else {
        await backlogApi.create(form);
        toast.success(`"${form.title}" added to the backlog`);
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await backlogApi.remove(toDelete._id);
      toast.success(`"${toDelete.title}" deleted`);
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // ---- derived ----
  const counts = useMemo(() => Object.fromEntries(PRIORITIES.map((p) => [p, stories.filter((s) => s.priority === p).length])), [stories]);
  const totalPoints = stories.reduce((sum, s) => sum + s.storyPoints, 0);
  const visible = stories.filter(
    (s) => (filter === 'All' || s.priority === filter) && (!query || `${s.title} ${s.description}`.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Product Backlog</h1>
          <p className="page-subtitle">Every user story not yet planned into a sprint, highest priority first.</p>
        </div>
        {isPO && (
          <button type="button" className="btn-primary" onClick={openNew}>
            <PlusIcon className="h-4 w-4" />
            New story
          </button>
        )}
      </div>

      {/* ---------- Stats ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MiniStat label="Stories" value={loading ? '–' : stories.length} hint="waiting to be planned" />
        <MiniStat label="Total points" value={loading ? '–' : totalPoints} hint="estimated effort" tone="text-indigo-600" />
        <MiniStat label="High priority" value={loading ? '–' : counts.High} hint="plan these first" tone="text-rose-600" />
        <MiniStat label="Average size" value={loading || !stories.length ? '–' : (totalPoints / stories.length).toFixed(1)} hint="points per story" />
      </div>

      {!isPO && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm text-indigo-700">
          <InfoIcon className="h-4 w-4 shrink-0" />
          View only — the Product Owner manages stories. Changes appear here live.
        </div>
      )}

      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" className="input pl-9" placeholder="Search stories…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search stories" />
        </div>
        <div className="overflow-x-auto">
          <Segmented
            label="Filter by priority"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'All', label: 'All', count: stories.length },
              ...PRIORITIES.map((p) => ({ value: p, label: p, dot: PRIORITY_DOTS[p], count: counts[p] })),
            ]}
          />
        </div>
      </div>

      {/* ---------- List ---------- */}
      {loading ? (
        <SkeletonList rows={5} className="h-20" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ListIcon}
          title={stories.length === 0 ? 'The backlog is empty' : 'No stories match'}
          text={stories.length === 0 ? (isPO ? 'Add your first user story to get started.' : 'The Product Owner has not added stories yet.') : 'Try a different search or filter.'}
          action={
            isPO && stories.length === 0 ? (
              <button type="button" className="btn-primary" onClick={openNew}>
                <PlusIcon className="h-4 w-4" /> New story
              </button>
            ) : null
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {visible.map((story, i) => (
            <li
              key={story._id}
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
              className={`group relative flex ${highlightId === story._id ? 'animate-flash' : 'animate-fade-up'} items-center gap-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 pl-5 shadow-soft transition hover:border-slate-300 hover:shadow-lift`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_BAR[story.priority]}`} aria-hidden />

              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/30" title="Story points">
                <span className="text-base font-bold leading-none">{story.storyPoints}</span>
                <span className="text-[9px] font-medium uppercase opacity-80">pts</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{story.title}</h3>
                  <span className={`chip ${PRIORITY_STYLES[story.priority]}`}>{story.priority}</span>
                </div>
                {story.description && <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{story.description}</p>}
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  {story.createdBy?.name && <Avatar name={story.createdBy.name} size="xs" />}
                  <span>
                    {story.createdBy?.name ? `${story.createdBy.name} · ` : ''}
                    {timeAgo(story.createdAt)}
                  </span>
                </div>
              </div>

              {isPO && (
                <div className="flex shrink-0 gap-1 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <button type="button" className="btn-ghost p-2" onClick={() => openEdit(story)} aria-label={`Edit ${story.title}`} title="Edit">
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost p-2 hover:bg-rose-50 hover:text-rose-600" onClick={() => setToDelete(story)} aria-label={`Delete ${story.title}`} title="Delete">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ---------- Story editor (drawer) ---------- */}
      <Modal
        open={editorOpen}
        onClose={closeEditor}
        variant="drawer"
        title={editingId ? 'Edit user story' : 'New user story'}
        subtitle={editingId ? 'Changes sync to everyone instantly.' : 'It goes to the bottom of its priority group.'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeEditor}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add story'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <Alert message={formError} onClose={() => setFormError('')} />
          <div>
            <label htmlFor="story-title" className="label">Title</label>
            <input
              id="story-title"
              className="input"
              placeholder="As a developer, I want… so that…"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="story-desc" className="label">Description & acceptance criteria</label>
            <textarea
              id="story-desc"
              rows={4}
              className="input resize-none"
              placeholder="What does done look like?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <span className="label">Story points</span>
            <PointsPicker value={form.storyPoints} onChange={(p) => setForm({ ...form, storyPoints: p })} />
            <p className="mt-2 text-xs text-slate-400">Fibonacci scale — bigger numbers mean more uncertainty.</p>
          </div>
          <div>
            <span className="label">Priority</span>
            <Segmented
              label="Priority"
              value={form.priority}
              onChange={(p) => setForm({ ...form, priority: p })}
              options={PRIORITIES.map((p) => ({ value: p, label: p, dot: PRIORITY_DOTS[p] }))}
            />
          </div>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this story?"
        message={toDelete ? `"${toDelete.title}" will be removed from the backlog for everyone. This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
        busy={deleting}
      />
    </div>
  );
}
