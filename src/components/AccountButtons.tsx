import { Link } from 'react-router-dom';
import { LogIn, UserPlus, UserRound } from 'lucide-react';

/**
 * Account entry points. The log in / sign up pages are a UI preview for now —
 * accounts aren't built yet, so everyone still plays as a guest.
 */
export default function AccountButtons() {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400">
        <UserRound className="w-3.5 h-3.5" aria-hidden /> Playing as guest
      </span>
      <Link
        to="/login"
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" aria-hidden /> Log in
      </Link>
      <Link
        to="/signup"
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" aria-hidden /> Sign up
      </Link>
    </div>
  );
}
