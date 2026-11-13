import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { REPORT_REASONS, type ReportReason } from '../services/moderationService';
import type { ChatMessage } from '../types';

interface ReportDialogProps {
  message: ChatMessage;
  onSubmit: (reason: ReportReason, alsoBlock: boolean) => Promise<void>;
  onClose: () => void;
}

/** Report a chat message (and optionally block its sender). */
export default function ReportDialog({ message, onSubmit, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && state !== 'sending') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, onClose]);

  const submit = async () => {
    if (!reason) return;
    setState('sending');
    try {
      await onSubmit(reason, alsoBlock);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={state === 'sending' ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        {state === 'sent' ? (
          <>
            <div>
              <h2 id="report-title" className="text-lg font-bold text-gray-800">Thanks for reporting</h2>
              <p className="text-sm text-gray-500 mt-1">
                We'll review this message.{alsoBlock ? ` You won't see messages from ${message.playerName} any more.` : ''}
              </p>
              <p lang="th" className="text-sm text-gray-500 mt-1">ขอบคุณที่แจ้ง เราจะตรวจสอบข้อความนี้</p>
            </div>
            <button onClick={onClose} className="self-end px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600">
              Done
            </button>
          </>
        ) : (
          <>
            <div>
              <h2 id="report-title" className="text-lg font-bold text-gray-800 inline-flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" aria-hidden /> Report message
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold">{message.playerName}:</span>{' '}
                <span className="break-words">“{message.text}”</span>
              </p>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-semibold text-gray-500 mb-1">What's wrong with it?</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
              Also block {message.playerName}
            </label>
            {state === 'error' && <p className="text-sm text-red-600">Couldn't send the report. Please try again.</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} disabled={state === 'sending'} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!reason || state === 'sending'}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40"
              >
                {state === 'sending' ? 'Sending…' : 'Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
