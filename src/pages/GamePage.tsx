import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { useWinDetection } from '../hooks/useWinDetection';
import GameCanvas from '../components/GameCanvas';
import AddWordPanel from '../components/AddWordPanel';
import PlayerList from '../components/PlayerList';
import ScoreTable from '../components/ScoreTable';
import VictoryModal from '../components/VictoryModal';
import NewGameModal from '../components/NewGameModal';
import { getPlayerColorMap } from '../utils/playerColors';
import { resetToLobby, requestJoinGame, approveJoinRequest, denyJoinRequest, leaveRoom, joinRoom, kickPlayer } from '../services/roomService';

const ADJ = ['Swift', 'Bright', 'Clever', 'Bold', 'Quick', 'Sharp', 'Witty', 'Calm'];
const NOUN = ['Fox', 'Owl', 'Lynx', 'Wolf', 'Hawk', 'Bear', 'Deer', 'Crow'];
function randomName() {
  return ADJ[Math.floor(Math.random() * ADJ.length)] + NOUN[Math.floor(Math.random() * NOUN.length)];
}

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
  const [joinName, setJoinName] = useState(randomName);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const fitViewRef = useRef<(() => void) | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/join/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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



  if (!room || !roomId || !playerId) {
    // No playerId → user opened game link directly; show join form
    if (roomId && !playerId) {
      const handleJoin = async (e: FormEvent) => {
        e.preventDefault();
        if (!joinName.trim()) return;
        setJoining(true);
        setJoinError(null);
        try {
          const result = await joinRoom(roomId, joinName.trim());
          if (!result) {
            setJoinError('Room not found or game has already ended.');
            setJoining(false);
            return;
          }
          setIdentity(result.playerId, joinName.trim());
          setRoom(result.room);
        } catch {
          setJoinError('Failed to join. Check your connection.');
          setJoining(false);
        }
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-black text-brand-600 tracking-tight">Word Bridge</h1>
              <p className="mt-2 text-gray-500 text-sm">A game is in progress</p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <form onSubmit={handleJoin} className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Join Game</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Room <span className="font-mono font-bold tracking-wider">{roomId}</span>
                  </p>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">Your name</span>
                  <input
                    type="text"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Enter your name"
                    className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    maxLength={20}
                    autoFocus
                    disabled={joining}
                    inputMode="text"
                    enterKeyHint="go"
                  />
                </label>
                {joinError && <p className="text-red-500 text-xs">{joinError}</p>}
                <button
                  type="submit"
                  disabled={joining || !joinName.trim()}
                  className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {joining ? 'Joining…' : 'Join Game →'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
                >
                  ← Back to home
                </button>
              </form>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-brand-500 animate-spin" />
          <span className="text-sm">Connecting…</span>
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm px-4 md:px-6 py-2 md:py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Left: brand + room code */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black text-brand-600 text-lg md:text-xl whitespace-nowrap">Word Bridge</span>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span className="hidden sm:inline font-mono text-xs text-gray-500 truncate">{roomId}</span>
          </div>

          {/* Center: word pair + node count — desktop only */}
          <div className="hidden md:flex items-center gap-3 text-sm text-gray-600">
            <span>
              <span className="font-bold text-brand-500 uppercase">{wordA}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-bold text-brand-500 uppercase">{wordB}</span>
            </span>
            <span className="text-gray-400 text-xs">{nodeCount} nodes</span>
          </div>

          {/* Right: host buttons (desktop) + leave + sidebar toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isHost && (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => setShowNewGameModal(true)}
                  disabled={leavingLobby || leaving}
                  className="px-3 py-1 rounded-lg border border-brand-300 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                >
                  ↺ New Game
                </button>
                <button
                  onClick={handleBackToLobby}
                  disabled={leavingLobby || leaving}
                  className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  {leavingLobby ? 'Returning…' : '← Back to Lobby'}
                </button>
              </div>
            )}
            {/* Copy invite link — desktop */}
            <button
              onClick={handleCopyLink}
              className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <span>{copied ? '✓' : '🔗'}</span>
              <span>{copied ? 'Copied!' : 'Invite'}</span>
            </button>
            <button
              onClick={handleLeave}
              disabled={leaving || leavingLobby}
              className="px-3 py-1 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <span className="hidden sm:inline">{leaving ? 'Leaving…' : 'Leave'}</span>
              <span className="sm:hidden text-base leading-none">✕</span>
            </button>
            {/* Sidebar toggle — mobile only */}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle panel"
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <span className="text-lg leading-none">☰</span>
            </button>
            {/* Fit view — mobile only */}
            <button
              onClick={() => fitViewRef.current?.()}
              aria-label="Fit view"
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm leading-none">⤢</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <main className="flex-1 relative">
          <GameCanvas room={room} roomId={roomId} playerId={playerId} playerColorMap={playerColorMap} fitViewRef={fitViewRef} onNodeSelect={setSelectedNodeId} />

          {/* Empty canvas hint — fades out once words are added */}
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
          {/* Victory modal — mounts when game is won, unmounts on restart */}
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

        {/* Sidebar — overlay on mobile, static column on desktop */}
        <aside
          className={[
            'fixed top-0 right-0 bottom-0 z-40 w-72 bg-white border-l border-gray-200 flex flex-col gap-4 p-4 overflow-y-auto',
            'transform transition-transform duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0' : 'translate-x-full',
            'md:relative md:w-64 md:translate-x-0 md:z-auto md:top-auto md:right-auto md:bottom-auto',
          ].join(' ')}
        >
          {/* Mobile-only top section: word pair + host actions */}
          <div className="md:hidden border-b border-gray-100 pb-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                <span className="text-brand-500 uppercase">{wordA}</span>
                <span className="mx-1.5 text-gray-400 font-normal">→</span>
                <span className="text-brand-500 uppercase">{wordB}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{nodeCount} nodes</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close panel"
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            {isHost && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNewGameModal(true); setSidebarOpen(false); }}
                  disabled={leavingLobby || leaving}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-brand-300 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                >
                  ↺ New Game
                </button>
                <button
                  onClick={handleBackToLobby}
                  disabled={leavingLobby || leaving}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  {leavingLobby ? 'Returning…' : '← Lobby'}
                </button>
              </div>
            )}
            {/* Copy invite link — mobile sidebar */}
            <button
              onClick={handleCopyLink}
              className="w-full py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{copied ? '✓' : '🔗'}</span>
              <span>{copied ? 'Copied!' : 'Copy Invite Link'}</span>
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Add Word
            </p>
            {isSpectator ? (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-center flex flex-col gap-2">
                <p className="text-xs font-semibold text-yellow-700">Watching</p>
                <p className="text-xs text-yellow-600">You'll join the next round</p>
                {!hasJoinRequest ? (
                  <button
                    onClick={handleRequestJoin}
                    className="text-xs bg-brand-500 text-white rounded-lg py-1.5 px-2 hover:bg-brand-600 font-semibold transition-colors"
                  >
                    Request to join now
                  </button>
                ) : (
                  <p className="text-xs text-blue-600 font-medium">Waiting for host…</p>
                )}
              </div>
            ) : (
              <AddWordPanel roomId={roomId} />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Players
            </p>
            <PlayerList
              players={room.players ?? {}}
              currentPlayerId={playerId}
              hostId={room.hostId}
              playerColorMap={playerColorMap}
              onApprove={isHost ? (pid) => approveJoinRequest(roomId, pid) : undefined}
              onDeny={isHost ? (pid) => denyJoinRequest(roomId, pid) : undefined}
              onKick={isHost ? (pid) => kickPlayer(roomId, pid) : undefined}
            />
          </div>

          {/* Scores — cumulative leaderboard + all connected pairs */}
          {((room.scores && Object.keys(room.scores).length > 0) || Object.keys(room.edges ?? {}).length > 0) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Scores
              </p>
              {room.scores && Object.keys(room.scores).length > 0 && (
                <div className="flex flex-col gap-1 mb-3">
                  {Object.entries(room.scores)
                    .sort(([, a], [, b]) => b - a)
                    .map(([pid, pts], rank) => {
                      const color = playerColorMap[pid] ?? '#94a3b8';
                      const name = room.players?.[pid]?.name ?? pid;
                      return (
                        <div key={pid} className="flex items-center justify-between py-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400 w-3">{rank + 1}.</span>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs text-gray-700 truncate max-w-[110px]">{name}</span>
                          </span>
                          <span className="text-xs font-bold text-gray-800">{pts}</span>
                        </div>
                      );
                    })}
                </div>
              )}
              <ScoreTable
                nodes={room.nodes ?? {}}
                edges={room.edges ?? {}}
                startWords={room.gameState ? [room.gameState.wordA, room.gameState.wordB] : []}
                highlightNodeId={selectedNodeId}
              />
            </div>
          )}
          <div className="mt-auto">
            <p className="text-xs text-gray-400">
              Drag nodes to rearrange.
              You can only delete your own nodes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
