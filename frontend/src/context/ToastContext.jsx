/**
 * Toast notifications - used for errors (NFR-14) and for live updates made by
 * teammates ("Riya moved X to Done").
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertIcon, CheckIcon, InfoIcon, XIcon } from '../components/Icons';
import Avatar from '../components/Avatar';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CheckIcon, color: 'text-emerald-600 bg-emerald-50' },
  error: { icon: AlertIcon, color: 'text-rose-600 bg-rose-50' },
  info: { icon: InfoIcon, color: 'text-indigo-600 bg-indigo-50' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (type, message, opts = {}) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((list) => [...list.slice(-3), { id, type, message, ...opts }]); // max 4 on screen
      setTimeout(() => dismiss(id), opts.duration || (type === 'error' ? 6000 : 4000));
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (msg, opts) => push('success', msg, opts),
      error: (msg, opts) => push('error', msg, opts),
      info: (msg, opts) => push('info', msg, opts),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, color } = STYLES[t.type];
          return (
            <div key={t.id} role="status" className="pointer-events-auto flex animate-slide-in items-start gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lift backdrop-blur">
              {t.actor ? (
                <Avatar name={t.actor} size="md" />
              ) : (
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1 pt-0.5 text-sm">
                {t.title && <p className="font-semibold text-slate-900">{t.title}</p>}
                <p className="text-slate-600">{t.message}</p>
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Dismiss">
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
