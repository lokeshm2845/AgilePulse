export const STATUSES = ['To-Do', 'In Progress', 'Review', 'Done'];
export const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13];
export const PRIORITIES = ['High', 'Medium', 'Low'];

export const ROLE_LABELS = {
  PO: 'Product Owner',
  SM: 'Scrum Master',
  DEV: 'Developer',
};

/** Same rule as the backend (utils/workflow.js) so we can reject bad drops instantly */
const NEXT_STATUS = { 'To-Do': 'In Progress', 'In Progress': 'Review', Review: 'Done' };

export function nextStatus(status) {
  return NEXT_STATUS[status] || null;
}

export function validateTransition(from, to) {
  return NEXT_STATUS[from] === to;
}

export const PRIORITY_STYLES = {
  High: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
  Medium: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  Low: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
};

export const PRIORITY_BAR = {
  High: 'bg-rose-500',
  Medium: 'bg-amber-400',
  Low: 'bg-slate-300',
};

export const COLUMN_META = {
  'To-Do': { dot: 'bg-slate-400', tint: 'from-slate-100/80', ring: 'ring-slate-300' },
  'In Progress': { dot: 'bg-sky-500', tint: 'from-sky-50', ring: 'ring-sky-300' },
  Review: { dot: 'bg-violet-500', tint: 'from-violet-50', ring: 'ring-violet-300' },
  Done: { dot: 'bg-emerald-500', tint: 'from-emerald-50', ring: 'ring-emerald-300' },
};

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const formatShortDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

export function timeAgo(date) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatShortDate(date);
}

export function daysLeft(endDate) {
  const ms = new Date(endDate).setHours(23, 59, 59, 999) - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}
