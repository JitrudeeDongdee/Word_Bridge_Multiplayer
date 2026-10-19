import { Link } from 'react-router-dom';
import { LogIn, UserPlus, UserRound } from 'lucide-react';
import { isMember } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import Avatar from './Avatar';

/** Account entry points: Log in / Sign up for guests, the member's name (→ account page) once logged in. */
export default function AccountButtons() {
  const user = useAuthStore((s) => s.user);
  const memberName = useAuthStore((s) => s.memberName);
  const memberPhoto = useAuthStore((s) => s.memberPhoto);

  if (isMember(user)) {
    return (
      <Link
        to="/profile"
        title="Profile settings"
        className="inline-flex items-center gap-1.5 max-w-[12rem] pl-1 pr-3 py-1 rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Avatar name={memberName ?? user?.displayName ?? 'Player'} photo={memberPhoto} size={22} />
        <span className="truncate">{memberName ?? user?.displayName ?? 'My account'}</span>
      </Link>
    );
  }

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
