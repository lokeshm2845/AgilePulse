import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons';

/**
 * Accessible dialog: Esc closes, focus moves into the dialog, page scroll is locked.
 * variant="center" (default) or "drawer" (slides in from the right).
 */
export default function Modal({ open, onClose, title, subtitle, children, footer, variant = 'center', size = 'md' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // focus the first field (or the panel itself)
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector('input, textarea, select, button[data-autofocus]');
      (first || panelRef.current)?.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  const drawer = variant === 'drawer';

  return createPortal(
    <div className={`fixed inset-0 z-40 flex ${drawer ? 'justify-end' : 'items-end justify-center p-0 sm:items-center sm:p-4'}`}>
      <div className="absolute inset-0 animate-[fadeIn_0.2s_ease-out] bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={`relative flex max-h-full w-full flex-col bg-white shadow-2xl outline-none ${
          drawer
            ? 'h-full max-w-md animate-[drawerIn_0.35s_cubic-bezier(0.16,1,0.3,1)] sm:rounded-l-2xl'
            : `${widths[size]} max-h-[92vh] animate-[popIn_0.25s_cubic-bezier(0.16,1,0.3,1)] rounded-t-2xl sm:rounded-2xl`
        }`}
      >
        <header className="flex items-start gap-4 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:rounded-b-2xl">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

/** Small confirmation dialog, replaces window.confirm() */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', tone = 'danger', onConfirm, onClose, busy }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            data-autofocus
            className={tone === 'danger' ? 'btn bg-rose-600 text-white shadow-sm shadow-rose-500/30 hover:bg-rose-700' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  );
}
