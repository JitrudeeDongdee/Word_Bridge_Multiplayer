import { useEffect } from 'react';

interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel: string;
  /** Red confirm button for destructive actions */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-page replacement for window.confirm(), which some browsers never show
 * (in-app browsers such as Messenger, embedded previews) — there it just
 * returns false and the button seems dead.
 */
export default function ConfirmDialog({ title, message, confirmLabel, danger = false, busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={busy ? undefined : onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
      >
        <div>
          <h2 id="confirm-title" className="text-lg font-bold text-gray-800">{title}</h2>
          {message && <p className="text-sm text-gray-500 mt-1">{message}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className={`px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
