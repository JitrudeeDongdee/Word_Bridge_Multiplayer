import { Lock, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeRoomIndex } from '../services/roomIndexService';
import type { RoomIndexEntry } from '../types';

const STATUS_LABEL: Record<RoomIndexEntry['status'], { text: string; className: string }> = {
  waiting: { text: 'Waiting', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  playing: { text: 'Playing', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  won: { text: 'Round over', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};

interface RoomListProps {
  onPick: (room: RoomIndexEntry) => void;
}

/** Central lobby: every active room, live. */
export default function RoomList({ onPick }: RoomListProps) {
  const [rooms, setRooms] = useState<RoomIndexEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(
    () =>
      subscribeRoomIndex(
        (entries) => {
          setRooms(entries);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [],
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Rooms</h2>
        {rooms && <span className="text-xs text-gray-400">{rooms.length} open</span>}
      </div>

      {failed && <p className="text-xs text-red-500">Couldn't load the room list.</p>}
      {!failed && rooms === null && <p className="text-xs text-gray-400">Loading rooms…</p>}
      {!failed && rooms?.length === 0 && (
        <p className="text-xs text-gray-400">No rooms right now — create one and invite friends.</p>
      )}

      {rooms && rooms.length > 0 && (
        <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto -mx-1 px-1">
          {rooms.map((r) => {
            const status = STATUS_LABEL[r.status];
            return (
              <li key={r.id}>
                <button
                  onClick={() => onPick(r)}
                  className="w-full text-left flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm flex items-center gap-1 min-w-0">
                      {r.hasPassword && (
                        <Lock className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" aria-label="Password required" />
                      )}
                      <span className="truncate">{r.name}</span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      Host {r.hostName} · <span className="font-mono">{r.id}</span>
                    </p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-gray-600" title="Players in the room">
                    <Users className="w-3.5 h-3.5" aria-hidden /> {r.playerCount}
                  </span>
                  <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.className}`}>
                    {status.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
