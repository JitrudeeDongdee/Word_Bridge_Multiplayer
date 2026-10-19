import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { ArrowLeft, Camera, KeyRound, LogOut, Trash2, UserRound } from 'lucide-react';
import Avatar from '../components/Avatar';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  NAME_MAX,
  authErrorMessage,
  changePassword,
  deleteMyData,
  isMember,
  logOut,
  providerIds,
  reauthenticate,
  updateMyProfile,
} from '../services/authService';
import { resizeToAvatar } from '../utils/avatar';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';

type Notice = { text: string; tone: 'ok' | 'error' } | null;

const PROVIDER_LABEL: Record<string, string> = { password: 'Email & password', 'google.com': 'Google', 'facebook.com': 'Facebook' };

/** Account settings for members: name, picture, password, delete account. */
export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const memberName = useAuthStore((s) => s.memberName);
  const memberPhoto = useAuthStore((s) => s.memberPhoto);
  const setAuth = useAuthStore((s) => s.set);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentName = memberName ?? user?.displayName ?? '';
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? currentName;
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState<'name' | 'photo' | 'password' | 'delete' | null>(null);
  const [notice, setNotice] = useState<{ section: string; n: Notice }>({ section: '', n: null });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthPw, setReauthPw] = useState('');

  const ids = providerIds(user);
  const hasPassword = ids.includes('password');
  const say = (section: string, text: string, tone: 'ok' | 'error' = 'ok') => setNotice({ section, n: { text, tone } });
  const noticeFor = (section: string) => (notice.section === section ? notice.n : null);

  if (!isMember(user)) {
    return (
      <Shell onBack={() => navigate('/')}>
        <div className="flex flex-col items-center gap-3 text-center">
          <UserRound className="w-10 h-10 text-brand-500" aria-hidden />
          <h1 className="text-2xl font-black text-brand-600">Profile</h1>
          <p className="text-sm text-gray-500">You're playing as a guest. Sign up to keep a name and picture across devices.</p>
          <Link to="/signup" className="mt-1 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600">
            Sign up
          </Link>
          <Link to="/login" className="text-sm text-brand-600 hover:underline">Log in</Link>
        </div>
      </Shell>
    );
  }

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) { say('name', 'Enter a name.', 'error'); return; }
    setBusy('name');
    try {
      await updateMyProfile({ name: clean });
      setAuth({ memberName: clean });
      useGameStore.setState({ playerName: clean });
      setName(null);
      say('name', 'Name saved. New rooms will use it.');
    } catch (err) {
      say('name', authErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    try {
      const photo = await resizeToAvatar(file);
      await updateMyProfile({ photo });
      setAuth({ memberPhoto: photo });
      say('photo', 'Picture updated.');
    } catch (err) {
      say('photo', err instanceof Error && err.message === 'not an image' ? 'Choose an image file.' : authErrorMessage(err), 'error');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    setBusy('photo');
    try {
      await updateMyProfile({ photo: null });
      setAuth({ memberPhoto: null });
      say('photo', 'Picture removed.');
    } catch (err) {
      say('photo', authErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) { say('password', 'Use at least 6 characters.', 'error'); return; }
    if (newPw !== confirmPw) { say('password', "The new passwords don't match.", 'error'); return; }
    setBusy('password');
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      say('password', 'Password changed.');
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      say('password', code === 'auth/invalid-credential' || code === 'auth/wrong-password' ? 'Your current password is wrong.' : authErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    setBusy('delete');
    try {
      await deleteMyData();
      setAuth({ memberName: null, memberPhoto: null });
      useGameStore.setState({ playerId: null, playerName: null, room: null });
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof FirebaseError && err.code === 'auth/requires-recent-login') {
        setNeedsReauth(true);
        say('delete', hasPassword ? 'For your security, enter your password to delete the account.' : 'For your security, confirm it’s you, then delete again.', 'error');
      } else {
        say('delete', authErrorMessage(err), 'error');
      }
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  const confirmIdentity = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('delete');
    try {
      await reauthenticate(hasPassword ? reauthPw : undefined);
      setNeedsReauth(false);
      setReauthPw('');
      setBusy(null);
      await doDelete();
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      say('delete', code === 'auth/invalid-credential' || code === 'auth/wrong-password' ? 'Wrong password.' : authErrorMessage(err), 'error');
      setBusy(null);
    }
  };

  const handleLogOut = async () => {
    await logOut();
    setAuth({ memberName: null, memberPhoto: null });
    navigate('/');
  };

  const field = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
  const btn = 'px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors';

  return (
    <Shell onBack={() => navigate('/')}>
      <h1 className="text-2xl font-black text-brand-600">Profile settings</h1>

      {/* Picture */}
      <Section title="Picture" icon={<Camera className="w-4 h-4" aria-hidden />} notice={noticeFor('photo')}>
        <div className="flex items-center gap-4">
          <Avatar name={currentName || 'Player'} photo={memberPhoto} size={72} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={`${btn} bg-brand-500 text-white hover:bg-brand-600`}>
              {busy === 'photo' ? 'Saving…' : memberPhoto ? 'Change picture' : 'Add picture'}
            </button>
            {memberPhoto && (
              <button type="button" onClick={removePhoto} disabled={busy !== null} className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}>
                Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} aria-label="Choose a picture" />
        </div>
        <p className="text-xs text-gray-400">Cropped to a square and shrunk to 128 px.</p>
      </Section>

      {/* Name */}
      <Section title="Display name" icon={<UserRound className="w-4 h-4" aria-hidden />} notice={noticeFor('name')}>
        <form onSubmit={saveName} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} aria-label="Display name" className={field} />
          <button type="submit" disabled={busy !== null || name.trim() === currentName} className={`${btn} flex-shrink-0 bg-brand-500 text-white hover:bg-brand-600`}>
            {busy === 'name' ? 'Saving…' : 'Save'}
          </button>
        </form>
        <p className="text-xs text-gray-400">Shown to other players. Rooms you're already in keep the old name.</p>
      </Section>

      {/* Sign-in & password */}
      <Section title="Sign-in" icon={<KeyRound className="w-4 h-4" aria-hidden />} notice={noticeFor('password')}>
        <p className="text-sm text-gray-600">
          {user?.email && <><b>{user.email}</b> · </>}
          {ids.map((id) => PROVIDER_LABEL[id] ?? id).join(', ') || 'Unknown'}
        </p>
        {hasPassword ? (
          <form onSubmit={savePassword} className="flex flex-col gap-2">
            <input type="password" autoComplete="current-password" placeholder="Current password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required className={field} />
            <input type="password" autoComplete="new-password" placeholder="New password (6+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={6} required className={field} />
            <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required className={field} />
            <button type="submit" disabled={busy !== null} className={`${btn} self-start bg-brand-500 text-white hover:bg-brand-600`}>
              {busy === 'password' ? 'Changing…' : 'Change password'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-gray-400">You sign in with {ids.map((id) => PROVIDER_LABEL[id] ?? id).join(' / ')}, so there's no Word Bridge password to change.</p>
        )}
      </Section>

      {/* Danger zone */}
      <Section title="Delete account" icon={<Trash2 className="w-4 h-4" aria-hidden />} notice={noticeFor('delete')} danger>
        <p className="text-sm text-gray-600">
          Permanently deletes your account, name, picture, link votes and room seats. This can't be undone.
        </p>
        {needsReauth ? (
          <form onSubmit={confirmIdentity} className="flex gap-2">
            {hasPassword && (
              <input type="password" autoComplete="current-password" placeholder="Your password" value={reauthPw} onChange={(e) => setReauthPw(e.target.value)} required className={field} />
            )}
            <button type="submit" disabled={busy !== null} className={`${btn} flex-shrink-0 bg-red-500 text-white hover:bg-red-600`}>
              {busy === 'delete' ? 'Deleting…' : hasPassword ? 'Confirm & delete' : 'Confirm it’s me & delete'}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy !== null} className={`${btn} self-start bg-red-500 text-white hover:bg-red-600`}>
            Delete my account
          </button>
        )}
      </Section>

      <button onClick={handleLogOut} className="self-center inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <LogOut className="w-4 h-4" aria-hidden /> Log out
      </button>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete your account?"
          message="Your account and everything saved with it will be deleted. This can't be undone."
          confirmLabel="Delete account"
          danger
          busy={busy === 'delete'}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Shell>
  );
}

function Shell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-start sm:items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4 py-4">
        <button onClick={onBack} className="self-start inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" aria-hidden /> Home
        </button>
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-5">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, notice, danger = false, children }: {
  title: string; icon: React.ReactNode; notice: Notice; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col gap-2 rounded-xl border p-4 ${danger ? 'border-red-200' : 'border-gray-200'}`}>
      <h2 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${danger ? 'text-red-500' : 'text-gray-500'}`}>
        {icon} {title}
      </h2>
      {children}
      {notice && (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-xs ${notice.tone === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {notice.text}
        </p>
      )}
    </section>
  );
}
