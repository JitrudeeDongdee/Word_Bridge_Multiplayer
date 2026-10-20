import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { authErrorMessage, deleteMyData, isMember } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';

const PRIVACY_URL = `${import.meta.env.BASE_URL}privacy.html`;

/** Delete everything stored about this player (guest or member) — linked from the data deletion page. */
export default function DeleteDataPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const memberName = useAuthStore((s) => s.memberName);
  const setAuth = useAuthStore((s) => s.set);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // What was deleted (the page is already a fresh guest by the time the message shows)
  const [done, setDone] = useState<'member' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const member = isMember(user);

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    const wasMember = member;
    try {
      await deleteMyData();
      setAuth({ memberName: null });
      useGameStore.setState({ playerId: null, playerName: null, room: null });
      setDone(wasMember ? 'member' : 'guest');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
        <button
          onClick={() => navigate('/')}
          className="self-start inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> Home
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
          <h1 className="text-2xl font-black text-brand-600">Delete my data</h1>

          {done ? (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-3 text-sm text-green-700">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden />
              <span>
                Done. Your {done === 'member' ? 'account, profile' : 'guest identity'}, link votes and room seats were deleted.
                You can keep playing as a new guest.
              </span>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {member ? (
                  <>You're logged in as <b>{memberName ?? user?.displayName ?? 'a member'}</b>. </>
                ) : (
                  <>You're playing as a guest. </>
                )}
                This permanently deletes:
              </p>
              <ul className="text-sm text-gray-600 list-disc pl-5 flex flex-col gap-1">
                {member && <li>your account, saved display name and profile picture</li>}
                {member && <li>your name and picture on the leaderboard</li>}
                <li>your votes to link words</li>
                <li>your seat (name, IP address) in any room you're in</li>
                <li>{member ? 'your sign-in (Google / Facebook / email) with Word Bridge' : 'your guest sign-in'}</li>
              </ul>
              <p className="text-xs text-gray-400">
                Rooms, chat and words on the boards are deleted automatically when rooms expire.
                Words already added to the shared word list stay, without your name.
                See the <a href={PRIVACY_URL} className="text-brand-600 hover:underline">privacy policy</a>.
              </p>
              <button
                onClick={() => setConfirming(true)}
                disabled={busy || !user}
                className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden /> Delete my data
              </button>
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete your data?"
          message="This can't be undone."
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
