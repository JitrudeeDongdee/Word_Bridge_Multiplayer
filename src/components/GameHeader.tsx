import { ArrowLeft, ArrowRight, Check, Link2, LogOut, Maximize2, Menu, RotateCcw, Users } from 'lucide-react';
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
        <div className="hidden md:flex items-center gap-3 text-sm text-gray-600 min-w-0">
          <span className="inline-flex items-center gap-2">
            <span className="font-bold text-brand-500 uppercase">{wordA}</span>
            <ArrowRight className="w-4 h-4 text-gray-400" aria-label="to" />
            <span className="font-bold text-brand-500 uppercase">{wordB}</span>
          </span>
          <span className="hidden lg:inline text-gray-400 text-xs whitespace-nowrap">{nodeCount} nodes</span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isHost && (
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={onNewGame}
                disabled={leavingLobby || leaving}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-brand-300 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                <span><span className="hidden lg:inline">New </span>Game</span>
              </button>
              <button
                onClick={onBackToLobby}
                disabled={leavingLobby || leaving}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {leavingLobby ? 'Returning…' : (
                  <>
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                    <span><span className="hidden lg:inline">Back to </span>Lobby</span>
                  </>
                )}
              </button>
            </div>
          )}
          <button
            onClick={onCopyLink}
            className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Link2 className="w-3.5 h-3.5" aria-hidden />}
            <span className="hidden lg:inline">{copied ? 'Copied!' : 'Invite'}</span>
          </button>
          <button
            onClick={onLeave}
            disabled={leaving || leavingLobby}
            aria-label="Leave room"
            className="flex items-center px-3 py-1 min-h-9 sm:min-h-0 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <span className="hidden sm:inline">{leaving ? 'Leaving…' : 'Leave'}</span>
            <LogOut className="sm:hidden w-4 h-4" aria-hidden />
          </button>
          <button
            onClick={onToggleSidebar}
            aria-label="Players and scores"
            className="flex items-center justify-center gap-1.5 h-9 min-w-9 md:h-auto md:px-3 md:py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 md:hidden" aria-hidden />
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
              <Users className="w-4 h-4" aria-hidden />
              <span className="hidden lg:inline">Players &amp; Scores</span>
            </span>
          </button>
          <button
            onClick={() => fitViewRef.current?.()}
            aria-label="Fit view"
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Maximize2 className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
