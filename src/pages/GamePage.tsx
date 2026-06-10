import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { useWinDetection } from '../hooks/useWinDetection';
import GameCanvas from '../components/GameCanvas';
import AddWordPanel from '../components/AddWordPanel';
import VictoryModal from '../components/VictoryModal';
import NewGameModal from '../components/NewGameModal';
import JoinGameForm from '../components/JoinGameForm';
import GameHeader from '../components/GameHeader';
import GameSidebar from '../components/GameSidebar';
import { getPlayerColorMap } from '../utils/playerColors';
import { resetToLobby, requestJoinGame, leaveRoom } from '../services/roomService';
import type { Room } from '../types';

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);

  useRoomSubscription(roomId);
  useWinDetection(roomId ?? '');

  const [leavingLobby, setLeavingLobby] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fitViewRef = useRef<(() => void) | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const playerColorMap = useMemo(
    () => getPlayerColorMap(room?.players ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room?.players],
  );

  const isHost = room?.hostId === playerId;
  const isSpectator = !!room?.players?.[playerId ?? '']?.spectator;
  const hasJoinRequest = !!room?.players?.[playerId ?? '']?.joinRequest;

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/join/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestJoin = async () => {
    if (!roomId || !playerId) return;
    await requestJoinGame(roomId, playerId);
  };

  const handleLeave = async () => {
    if (!roomId || !playerId || !room) return;
    setLeaving(true);
    try {
      await leaveRoom(roomId, playerId, room.players ?? {});
      navigate('/');
    } catch {
      setLeaving(false);
    }
  };

  const handleBackToLobby = async () => {
    if (!roomId) return;
    setLeavingLobby(true);
    try {
      await resetToLobby(roomId);
      // navigation happens via useRoomSubscription watching status === 'waiting'
    } catch {
      setLeavingLobby(false);
    }
  };

  const handleJoined = (pid: string, name: string, joinedRoom: Room) => {
    setIdentity(pid, name);
    setRoom(joinedRoom);
  };

  // No playerId at all → show join form
  if (roomId && !playerId) {
    return <JoinGameForm roomId={roomId} onJoined={handleJoined} />;
  }

  // Still loading (playerId may be restored from localStorage — reconnecting)
  if (!room || !roomId || !playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-brand-500 animate-spin" />
          <span className="text-sm">{playerId ? 'Reconnecting…' : 'Connecting…'}</span>
          <button
            onClick={() => navigate('/')}
            className="mt-2 text-sm text-brand-500 hover:text-brand-700 underline underline-offset-2"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  const { wordA, wordB } = room.gameState ?? { wordA: '?', wordB: '?' };
  const nodeCount = Object.keys(room.nodes ?? {}).length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <GameHeader
        roomId={roomId}
        wordA={wordA}
        wordB={wordB}
        nodeCount={nodeCount}
        isHost={isHost}
        leavingLobby={leavingLobby}
        leaving={leaving}
        copied={copied}
        fitViewRef={fitViewRef}
        onCopyLink={handleCopyLink}
        onNewGame={() => setShowNewGameModal(true)}
        onBackToLobby={handleBackToLobby}
        onLeave={handleLeave}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <main className="flex-1 relative">
          <GameCanvas
            room={room}
            roomId={roomId}
            playerId={playerId}
            playerColorMap={playerColorMap}
            fitViewRef={fitViewRef}
            onNodeSelect={setSelectedNodeId}
          />

          {/* Empty canvas hint */}
          <div
            className={[
              'absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500',
              nodeCount <= 2 ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            <p className="text-gray-300 text-sm font-medium text-center px-8 select-none">
              Type a word that bridges<br />
              <span className="text-brand-300 font-bold uppercase">{wordA}</span>
              <span className="mx-2">→</span>
              <span className="text-brand-300 font-bold uppercase">{wordB}</span>
            </p>
          </div>

          {showNewGameModal && room.status === 'playing' && (
            <NewGameModal
              room={room}
              roomId={roomId}
              playerId={playerId}
              playerColorMap={playerColorMap}
              onClose={() => setShowNewGameModal(false)}
            />
          )}

          {room.status === 'won' && (
            <VictoryModal
              room={room}
              roomId={roomId}
              playerId={playerId}
              playerColorMap={playerColorMap}
            />
          )}

          {/* FAB — mobile only, non-spectators only */}
          {!isSpectator && (
            <div className="fixed bottom-6 right-6 z-20 md:hidden flex flex-col items-end gap-3">
              {fabOpen && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-72">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Word</p>
                  <AddWordPanel roomId={roomId} onSuccess={() => setFabOpen(false)} />
                </div>
              )}
              <button
                onClick={() => setFabOpen((v) => !v)}
                aria-label="Add word"
                className={[
                  'w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-200 active:scale-95',
                  fabOpen ? 'bg-gray-400 hover:bg-gray-500' : 'bg-brand-500 hover:bg-brand-600',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-3xl font-light leading-none inline-block transition-transform duration-200',
                    fabOpen ? 'rotate-45' : '',
                  ].join(' ')}
                >
                  +
                </span>
              </button>
            </div>
          )}
        </main>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <GameSidebar
          room={room}
          roomId={roomId}
          playerId={playerId}
          isOpen={sidebarOpen}
          isHost={isHost}
          isSpectator={isSpectator}
          hasJoinRequest={hasJoinRequest}
          leavingLobby={leavingLobby}
          leaving={leaving}
          copied={copied}
          selectedNodeId={selectedNodeId}
          playerColorMap={playerColorMap}
          onClose={() => setSidebarOpen(false)}
          onCopyLink={handleCopyLink}
          onNewGame={() => { setShowNewGameModal(true); setSidebarOpen(false); }}
          onBackToLobby={handleBackToLobby}
          onRequestJoin={handleRequestJoin}
        />
      </div>
    </div>
  );
}

