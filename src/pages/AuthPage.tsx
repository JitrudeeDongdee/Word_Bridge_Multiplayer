import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Mail, UserRound } from 'lucide-react';
import { FacebookIcon, GoogleIcon } from '../components/BrandIcons';
import PolicyLinks from '../components/PolicyLinks';
import {
  NAME_MAX,
  authErrorMessage,
  isMember,
  logInWithEmail,
  logOut,
  resetPassword,
  signInWithFacebook,
  signInWithGoogle,
  signUpWithEmail,
  type SignedIn,
} from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';

type Mode = 'login' | 'signup';

/**
 * Facebook Login stays off until the Meta app is published: it needs Meta business
 * verification, and until then only the app's admins/testers can sign in (everyone else
 * gets an error from Facebook). Flip to true once the app is Live.
 */
const FACEBOOK_LOGIN_ENABLED = false;

/**
 * Log in / Sign up with Google, Facebook or email + password (Firebase Auth).
 * A guest who signs up keeps their player id (the anonymous account is upgraded).
 */
export default function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const isSignup = mode === 'signup';
  const user = useAuthStore((s) => s.user);
  const memberName = useAuthStore((s) => s.memberName);
  const setAuth = useAuthStore((s) => s.set);
  const guestName = useGameStore((s) => s.playerName) ?? '';

  const [displayName, setDisplayName] = useState(guestName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = ({ name }: SignedIn) => {
    setAuth({ memberName: name });
    useGameStore.setState({ playerName: name });
    navigate('/');
  };

  const run = async (action: () => Promise<SignedIn>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      done(await action());
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const fallbackName = displayName.trim() || guestName || 'Player';

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    if (isSignup) run(() => signUpWithEmail(email.trim(), password, fallbackName));
    else run(() => logInWithEmail(email.trim(), password, fallbackName));
  };

  const forgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email above first.'); return; }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email.trim());
      setNotice(`If ${email.trim()} has an account, a reset link is on its way.`);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleLogOut = async () => {
    setBusy(true);
    try {
      await logOut();
      setAuth({ memberName: null });
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  const providerBtn =
    'w-full inline-flex items-center justify-center gap-3 py-2.5 rounded-xl border font-semibold text-sm transition-colors disabled:opacity-60';
  const field = 'px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
        <button
          onClick={() => navigate('/')}
          className="self-start inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> Home
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-5">
          {isMember(user) ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <UserRound className="w-10 h-10 text-brand-500" aria-hidden />
              <div>
                <h1 className="text-2xl font-black text-brand-600">You're logged in</h1>
                <p className="text-sm text-gray-500 mt-1">
                  as <b>{memberName ?? user?.displayName ?? 'Player'}</b>
                  {user?.email ? <> · {user.email}</> : null}
                </p>
              </div>
              <button
                onClick={handleLogOut}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" aria-hidden /> Log out
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-2xl font-black text-brand-600">
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {isSignup
                    ? 'Keep your name and rooms across devices.'
                    : 'Log in to pick up where you left off.'}
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => signInWithGoogle(fallbackName))}
                  className={`${providerBtn} bg-white border-gray-300 text-gray-700 hover:bg-gray-50`}
                >
                  <GoogleIcon /> Continue with Google
                </button>
                <button
                  type="button"
                  disabled={busy || !FACEBOOK_LOGIN_ENABLED}
                  onClick={() => run(() => signInWithFacebook(fallbackName))}
                  title={FACEBOOK_LOGIN_ENABLED ? undefined : 'Facebook sign-in is coming soon'}
                  className={`${providerBtn} bg-[#1877F2] border-[#1877F2] text-white hover:bg-[#166FE5] disabled:cursor-not-allowed disabled:hover:bg-[#1877F2]`}
                >
                  <FacebookIcon />
                  <span className="whitespace-nowrap">Continue with Facebook</span>
                  {!FACEBOOK_LOGIN_ENABLED && (
                    <span className="whitespace-nowrap rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Soon</span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex-1 h-px bg-gray-200" />
                or use your email
                <span className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={submitEmail} className="flex flex-col gap-3">
                {isSignup && (
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-600">Display name</span>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="What other players see"
                      maxLength={NAME_MAX}
                      required
                      className={field}
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600 inline-flex items-center gap-1">
                    <Mail className="w-4 h-4" aria-hidden /> Email
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={field}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600 flex items-center justify-between">
                    Password
                    {!isSignup && (
                      <button
                        type="button"
                        onClick={forgotPassword}
                        disabled={busy}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </span>
                  <input
                    type="password"
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    className={field}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
                </button>
              </form>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                  {notice}
                </p>
              )}

              <p className="text-sm text-gray-500 text-center">
                {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                <Link to={isSignup ? '/login' : '/signup'} className="font-semibold text-brand-600 hover:underline">
                  {isSignup ? 'Log in' : 'Sign up'}
                </Link>
              </p>
            </>
          )}
        </div>

        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {isMember(user) ? 'Back to the game' : 'Continue as guest'}
        </button>
        <PolicyLinks />
      </div>
    </div>
  );
}
