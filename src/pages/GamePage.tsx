import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { useWinDetection } from '../hooks/useWinDetection';
import GameCanvas from '../components/GameCanvas';
import AddWordPanel from '../components/AddWordPanel';
import ChatDock from '../components/ChatDock';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import VictoryModal from '../components/VictoryModal';
import NewGameModal from '../components/NewGameModal';
import JoinGameForm from '../components/JoinGameForm';
import GameHeader from '../components/GameHeader';
import GameSidebar from '../components/GameSidebar';
import { getPlayerColorMap } from '../utils/playerColors';
import { resetToLobby, requestJoinGame, leaveRoom } from '../services/roomService';
import { useHasHydrated } from '../hooks/useHasHydrated';
import { preloadEmbeddingModel } from '../utils/embeddingSimilarity';
import type { Room } from '../types';

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const hasHydrated = useHasHydrated();
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);

  useRoomSubscription(roomId);
  useWinDetection(roomId ?? '');

  const [leavingLobby, setLeavingLobby] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fitViewRef = useRef<(() => void) | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const keyboardInset = useKeyboardInset();

  // Download the word-similarity model in the background so the first word isn't slow
  useEffect(() => {
    preloadEmbeddingModel();
  }, []);

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

  // No playerId at all → show join form (wait for hydration first)
  if (hasHydrated && roomId && !playerId) {
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
            className="mt-2 inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-700 underline underline-offset-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back to Home
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
            selectedNodeId={selectedNodeId}
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
              <span className="inline-flex items-center gap-2">
                <span className="text-brand-300 font-bold uppercase">{wordA}</span>
                <ArrowRight className="w-4 h-4" aria-label="to" />
                <span className="text-brand-300 font-bold uppercase">{wordB}</span>
              </span>
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

          {/* Word dock: add-word input + chat, floating at the bottom of the canvas */}
          {room.status === 'playing' && (
            <div
              className="fixed inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
              style={{ bottom: 16 + keyboardInset }}
            >
              <div className="pointer-events-auto relative w-full max-w-xl flex items-end gap-2">
                <div className="flex-1 min-w-0 bg-white/95 backdrop-blur border border-gray-200 rounded-2xl shadow-lg px-3 py-2">
                  {isSpectator ? (
                    <div className="flex items-center justify-between gap-2 min-h-10">
                      <p className="text-xs text-yellow-700">
                        <b>Watching</b> — you'll join the next round
                      </p>
                      {!hasJoinRequest ? (
                        <button
                          onClick={handleRequestJoin}
                          className="flex-shrink-0 text-xs bg-brand-500 text-white rounded-lg py-1.5 px-3 hover:bg-brand-600 font-semibold transition-colors"
                        >
                          Join now
                        </button>
                      ) : (
                        <p className="flex-shrink-0 text-xs text-blue-600 font-medium">Waiting for host…</p>
                      )}
                    </div>
                  ) : (
                    <AddWordPanel roomId={roomId} />
                  )}
                </div>
                <ChatDock
                  roomId={roomId}
                  playerId={playerId}
                  playerName={room.players?.[playerId]?.name ?? 'Player'}
                  playerColorMap={playerColorMap}
                  keyboardInset={keyboardInset}
                />
              </div>
            </div>
          )}
        </main>

        {/* Drawer backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <GameSidebar
          room={room}
          roomId={roomId}
          playerId={playerId}
          isOpen={sidebarOpen}
          isHost={isHost}
          leavingLobby={leavingLobby}
          leaving={leaving}
          copied={copied}
          selectedNodeId={selectedNodeId}
          playerColorMap={playerColorMap}
          onClose={() => setSidebarOpen(false)}
          onCopyLink={handleCopyLink}
          onNewGame={() => { setShowNewGameModal(true); setSidebarOpen(false); }}
          onBackToLobby={handleBackToLobby}
        />
      </div>
    </div>
  );
}

