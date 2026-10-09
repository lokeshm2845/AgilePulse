import { useState } from 'react';
import TaskCard from './TaskCard';
import { COLUMN_META } from '../utils/constants';

/**
 * One Kanban column - a drop target that renders its TaskCards.
 * While a card is being dragged the column shows whether it is a valid target:
 *   dropState = 'valid'   -> green, "Drop to move here"
 *   dropState = 'invalid' -> dimmed (workflow rule would reject it)
 */
export default function Column({ status, tasks, canMove, highlightId, rejectedId, draggingId, dropState, onDropTask, onMoveNext, onDragStart, onDragEnd, onOpen }) {
  const [isOver, setIsOver] = useState(false);
  const meta = COLUMN_META[status];
  const points = tasks.reduce((sum, t) => sum + t.storyPoints, 0);

  const handleDragOver = (e) => {
    e.preventDefault(); // required, otherwise the browser does not allow a drop
    e.dataTransfer.dropEffect = 'move'; // invalid drops still fire so we can explain why they were rejected
    if (!isOver) setIsOver(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onDropTask(taskId, status);
  };

  const stateClass =
    dropState === 'valid'
      ? `ring-2 ${isOver ? 'ring-emerald-400 bg-emerald-50/70' : 'ring-emerald-300/70'}`
      : dropState === 'invalid'
        ? `opacity-55 ${isOver ? 'ring-2 ring-rose-300' : ''}`
        : '';

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsOver(false);
      }}
      onDrop={handleDrop}
      aria-label={`${status} column`}
      className={`flex min-h-[18rem] w-[82vw] sm:min-h-[28rem] max-w-sm shrink-0 snap-center flex-col rounded-2xl sm:w-auto sm:max-w-none border border-slate-200/70 bg-gradient-to-b ${meta.tint} to-slate-50/60 p-3 transition-all duration-200 ${stateClass}`}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
        <h2 className="text-[13px] font-bold text-slate-800">{status}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">{tasks.length}</span>
        <span className="ml-auto text-[11px] font-medium text-slate-400">{points} pts</span>
      </header>

      <div className="flex flex-1 flex-col gap-2.5">
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            canMove={canMove}
            highlight={highlightId === task._id}
            rejected={rejectedId === task._id}
            dragging={draggingId === task._id}
            onMoveNext={onMoveNext}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onOpen={onOpen}
          />
        ))}

        {dropState === 'valid' ? (
          <div className={`flex items-center justify-center rounded-xl border-2 border-dashed py-6 text-xs font-semibold transition ${isOver ? 'border-emerald-400 bg-emerald-100/60 text-emerald-700' : 'border-emerald-300 text-emerald-600'}`}>
            Drop to move to {status}
          </div>
        ) : (
          tasks.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
              <span className={`mb-2 h-2 w-2 rounded-full ${meta.dot} opacity-40`} />
              <p className="text-xs font-medium text-slate-400">No tasks here</p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
