import { useState, type FormEvent } from 'react';
import { KeyRound, Lock, LockOpen, Pencil, Settings } from 'lucide-react';
import { updateRoomSettings } from '../services/roomService';
import { defaultRoomName } from '../services/roomIndexService';
import type { Room } from '../types';

interface RoomSettingsProps {
  room: Room;
  roomId: string;
  /** Tighter layout for the in-game drawer */
  compact?: boolean;
}

/**
 * Host-only: rename the room, set a new join password, or remove the lock.
 * The current password can't be shown (only its hash is stored), but the host can
 * always replace it — no old password needed.
 */
export default function RoomSettings({ room, roomId, compact = false }: RoomSettingsProps) {
  const hostName = room.players?.[room.hostId]?.name ?? 'Someone';
  const locked = !!room.passwordHash;
  const [name, setName] = useState(room.name ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const run = async (settings: Parameters<typeof updateRoomSettings>[1], done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await updateRoomSettings(roomId, settings);
      setMessage({ text: done, tone: 'ok' });
      return true;
    } catch {
      setMessage({ text: "Couldn't save. Check your connection.", tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    run({ name }, name.trim() ? 'Room name saved.' : 'Room name reset to the default.');
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    if (await run({ password }, 'New password set. Share it with players who still need to join.')) {
      setPassword('');
    }
  };

  const removeLock = () => run({ password: null }, 'Lock removed — anyone can join now.');

  const field = 'flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
  const btn = 'flex-shrink-0 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors';

  return (
    <section className={`flex flex-col gap-3 ${compact ? '' : 'rounded-xl border border-gray-200 p-4'}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <Settings className="w-3.5 h-3.5" aria-hidden /> Room settings
        <span className="normal-case font-normal text-gray-400">· host only</span>
      </p>

      <form onSubmit={saveName} className="flex flex-col gap-1">
        <label htmlFor={`room-name-${roomId}`} className="text-xs text-gray-600 flex items-center gap-1">
          <Pencil className="w-3 h-3" aria-hidden /> Room name
        </label>
        <div className="flex gap-2">
          <input
            id={`room-name-${roomId}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultRoomName(hostName)}
            maxLength={30}
            className={field}
          />
          <button
            type="submit"
            disabled={busy || name.trim() === (room.name ?? '')}
            className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
          >
            Save
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className="flex flex-col gap-1">
        <label htmlFor={`room-pass-${roomId}`} className="text-xs text-gray-600 flex items-center gap-1">
          <KeyRound className="w-3 h-3" aria-hidden />
          {locked ? 'New password' : 'Add a password'}
          <span className={`ml-auto inline-flex items-center gap-1 ${locked ? 'text-amber-600' : 'text-emerald-600'}`}>
            {locked ? <Lock className="w-3 h-3" aria-hidden /> : <LockOpen className="w-3 h-3" aria-hidden />}
            {locked ? 'Locked' : 'Open'}
          </span>
        </label>
        <div className="flex gap-2">
          <input
            id={`room-pass-${roomId}`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={locked ? 'Replaces the current password' : 'Players will need it to join'}
            maxLength={40}
            autoComplete="new-password"
            className={field}
          />
          <button
            type="submit"
            disabled={busy || !password}
            className={`${btn} bg-brand-500 text-white hover:bg-brand-600`}
          >
            Set
          </button>
        </div>
        {locked && (
          <p className="text-[11px] text-gray-400">
            Forgot it? The current password can't be shown, but you can set a new one here.
          </p>
        )}
      </form>

      {locked && (
        <button
          type="button"
          onClick={removeLock}
          disabled={busy}
          className={`${btn} self-start inline-flex items-center gap-1.5 border border-amber-300 text-amber-700 hover:bg-amber-50`}
        >
          <LockOpen className="w-4 h-4" aria-hidden /> Remove lock
        </button>
      )}

      {message && (
        <p role="status" className={`text-xs ${message.tone === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
