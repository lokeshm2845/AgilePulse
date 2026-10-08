import { PRIORITY_BAR, PRIORITY_STYLES, nextStatus } from '../utils/constants';
import Avatar from './Avatar';
import { ArrowRightIcon, GripIcon } from './Icons';

/**
 * A single draggable card on the Kanban board.
 * Keyboard support (NFR-15): Tab to focus a card, Enter / → moves it to the next column.
 */
export default function TaskCard({ task, canMove, highlight, rejected, dragging, onMoveNext, onDragStart, onDragEnd }) {
  const next = nextStatus(task.status);
  const done = task.status === 'Done';

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(task);
  };

  const handleKeyDown = (e) => {
    if (!canMove || !next) return;
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      onMoveNext(task);
    }
  };

  return (
    <article
      draggable={canMove}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`${task.title}, ${task.storyPoints} points, ${task.priority} priority, ${task.status}`}
      className={`group relative overflow-hidden ${highlight ? "animate-flash" : rejected ? "animate-shake border-rose-300" : "animate-fade-up"} rounded-xl border border-slate-200/80 bg-white p-3.5 pl-4 shadow-soft outline-none transition duration-200
        hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift focus-visible:ring-4 focus-visible:ring-indigo-500/20
        ${canMove ? 'cursor-grab active:cursor-grabbing' : ''}
        ${dragging ? 'scale-[0.98] opacity-40' : ''}
`}
    >
      {/* priority stripe */}
      <span className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_BAR[task.priority]}`} aria-hidden />

      <div className="flex items-start gap-2">
        <h3 className={`flex-1 text-[13.5px] font-semibold leading-snug ${done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800'}`}>
          {task.title}
        </h3>
        {canMove && <GripIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100" />}
      </div>

      {task.description && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{task.description}</p>}

      <div className="mt-3 flex items-center gap-2">
        <span className={`chip ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
        <span className="chip bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100" title="Story points">
          {task.storyPoints} pts
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {canMove && next && (
            <button
              type="button"
              onClick={() => onMoveNext(task)}
              tabIndex={-1}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-indigo-600 opacity-0 transition hover:bg-indigo-50 group-focus-within:opacity-100 group-hover:opacity-100"
              title={`Move to ${next}`}
            >
              {next}
              <ArrowRightIcon className="h-3 w-3" />
            </button>
          )}
          {task.assignedTo ? (
            <Avatar name={task.assignedTo.name} size="xs" title={`Assigned to ${task.assignedTo.name}`} />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400" title="Unassigned">
              ?
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
