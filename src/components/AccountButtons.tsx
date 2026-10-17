import { LogIn, UserPlus, UserRound } from 'lucide-react';

/**
 * Placeholder for player accounts (sign up / log in). Accounts don't exist yet, so the
 * buttons are disabled and everyone plays as a guest. Wire them up when auth lands.
 */
export default function AccountButtons() {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400">
        <UserRound className="w-3.5 h-3.5" aria-hidden /> Playing as guest
      </span>
      <button
        type="button"
        disabled
        title="Accounts are coming soon"
        aria-label="Log in (coming soon)"
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white/70 text-xs font-medium text-gray-400 cursor-not-allowed"
      >
        <LogIn className="w-3.5 h-3.5" aria-hidden /> Log in
      </button>
      <button
        type="button"
        disabled
        title="Accounts are coming soon"
        aria-label="Sign up (coming soon)"
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-500/40 text-xs font-semibold text-white cursor-not-allowed"
      >
        <UserPlus className="w-3.5 h-3.5" aria-hidden /> Sign up
        <span className="ml-0.5 rounded bg-white/30 px-1 text-[10px] font-bold uppercase">Soon</span>
      </button>
    </div>
  );
}
