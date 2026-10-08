import { AlertIcon, CheckIcon, InfoIcon, XIcon } from './Icons';

const STYLES = {
  error: { box: 'border-rose-200 bg-rose-50 text-rose-700', icon: AlertIcon },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckIcon },
  info: { box: 'border-indigo-100 bg-indigo-50/60 text-indigo-700', icon: InfoIcon },
};

/** Inline message banner (NFR-14: clear error messages) */
export default function Alert({ type = 'error', message, onClose }) {
  if (!message) return null;
  const { box, icon: Icon } = STYLES[type];
  return (
    <div role="alert" className={`mb-4 flex animate-fade-up items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${box}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
