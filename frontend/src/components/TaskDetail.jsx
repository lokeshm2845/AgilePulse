/** Task details window - opened by clicking a card on the board */
import { useRealtime } from '../context/RealtimeContext';
import { COLUMN_META, PRIORITY_STYLES, STATUSES, nextStatus, timeAgo } from '../utils/constants';
import Avatar from './Avatar';
import { ArrowRightIcon, CheckIcon } from './Icons';
import Modal from './Modal';

export default function TaskDetail({ task, canMove, onMoveNext, onClose }) {
  const { activity } = useRealtime();
  if (!task) return null;

  const next = nextStatus(task.status);
  const stepIndex = STATUSES.indexOf(task.status);
  const history = activity.filter((a) => a.details?.includes(`"${task.title}"`)).slice(0, 6);

  return (
    <Modal
      open={Boolean(task)}
      onClose={onClose}
      size="lg"
      title={task.title}
      subtitle={`Updated ${timeAgo(task.updatedAt)}`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {canMove && next && (
            <button type="button" data-autofocus className="btn-primary" onClick={() => onMoveNext(task)}>
              Move to {next}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {/* Workflow stepper */}
        <ol className="grid grid-cols-4 gap-2" aria-label="Workflow">
          {STATUSES.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={s} className="flex flex-col items-center gap-1.5 text-center">
                <div className="flex w-full items-center">
                  <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : i <= stepIndex ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                      done ? 'bg-indigo-500 text-white' : current ? `${COLUMN_META[s].dot} text-white ring-4 ring-indigo-100` : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={`h-0.5 flex-1 ${i === STATUSES.length - 1 ? 'opacity-0' : i < stepIndex ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                </div>
                <span className={`text-[11px] font-semibold ${current ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
              </li>
            );
          })}
        </ol>

        {/* Meta */}
        <dl className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
          <div>
            <dt className="label">Points</dt>
            <dd className="text-lg font-bold text-indigo-600">{task.storyPoints}</dd>
          </div>
          <div>
            <dt className="label">Priority</dt>
            <dd>
              <span className={`chip ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="label">Assignee</dt>
            <dd className="flex items-center gap-2 text-sm font-medium text-slate-800">
              {task.assignedTo ? (
                <>
                  <Avatar name={task.assignedTo.name} size="sm" />
                  {task.assignedTo.name}
                </>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              )}
            </dd>
          </div>
        </dl>

        <div>
          <h3 className="label">Description</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{task.description || <span className="text-slate-400">No description.</span>}</p>
        </div>

        <div>
          <h3 className="label">Recent activity</h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">No recorded activity yet.</p>
          ) : (
            <ol className="relative space-y-3 border-l-2 border-slate-100 pl-4">
              {history.map((a) => (
                <li key={a._id} className="relative">
                  <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-4 ring-white" />
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{a.userId?.name || 'Someone'}</span> — {a.details}
                  </p>
                  <p className="text-[11px] text-slate-400">{timeAgo(a.timestamp)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
