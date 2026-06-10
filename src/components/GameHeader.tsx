import type { MutableRefObject } from 'react';

interface GameHeaderProps {
  roomId: string;
  wordA: string;
  wordB: string;
  nodeCount: number;
  isHost: boolean;
  leavingLobby: boolean;
  leaving: boolean;
  copied: boolean;
  fitViewRef: MutableRefObject<(() => void) | null>;
  onCopyLink: () => void;
  onNewGame: () => void;
  onBackToLobby: () => void;
  onLeave: () => void;
  onToggleSidebar: () => void;
}

export default function GameHeader({
  roomId, wordA, wordB, nodeCount,
  isHost, leavingLobby, leaving, copied,
  fitViewRef,
  onCopyLink, onNewGame, onBackToLobby, onLeave, onToggleSidebar,
}: GameHeaderProps) {
  return (
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

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isHost && (
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={onNewGame}
                disabled={leavingLobby || leaving}
                className="px-3 py-1 rounded-lg border border-brand-300 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
              >
                ↺ New Game
              </button>
              <button
                onClick={onBackToLobby}
                disabled={leavingLobby || leaving}
                className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {leavingLobby ? 'Returning…' : '← Back to Lobby'}
              </button>
            </div>
          )}
          <button
            onClick={onCopyLink}
            className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <span>{copied ? '✓' : '🔗'}</span>
            <span>{copied ? 'Copied!' : 'Invite'}</span>
          </button>
          <button
            onClick={onLeave}
            disabled={leaving || leavingLobby}
            className="px-3 py-1 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <span className="hidden sm:inline">{leaving ? 'Leaving…' : 'Leave'}</span>
            <span className="sm:hidden text-base leading-none">✕</span>
          </button>
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle panel"
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span className="text-lg leading-none">☰</span>
          </button>
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
  );
}
