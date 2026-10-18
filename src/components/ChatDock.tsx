import { MessageCircle, PanelRightOpen, X } from 'lucide-react';
import { useState } from 'react';
import { useChat } from '../hooks/useChat';
import ChatPanel from './ChatPanel';

interface ChatDockProps {
  roomId: string;
  playerId: string;
  playerName: string;
  playerColorMap: Record<string, string>;
  /** Height hidden by the on-screen keyboard, so the mobile sheet stays above it */
  keyboardInset?: number;
  /** When set, the keyboard covers the bottom of the screen: open the mobile sheet from this y instead */
  sheetTop?: number | null;
  /** The chat is pinned to the right edge on md+ screens: this dock is for small screens only */
  pinnedOnDesktop?: boolean;
  /** Pin the chat to the right edge (md+) */
  onPin?: () => void;
}

/**
 * Chat collapsed to an icon button with an unread badge.
 * Opens as a popover above the word dock (a bottom sheet on mobile).
 */
export default function ChatDock({ roomId, playerId, playerName, playerColorMap, keyboardInset = 0, sheetTop = null, pinnedOnDesktop = false, onPin }: ChatDockProps) {
  const { messages, sendMessage } = useChat(roomId, playerId, playerName);
  const [open, setOpen] = useState(false);
  // Messages from before this player opened the page count as already read
  const [lastSeenAt, setLastSeenAt] = useState(() => Date.now());

  const latestAt = messages.length > 0 ? messages[messages.length - 1].sentAt : 0;

  // While the panel is open nothing is unread; closing it marks everything so far as read
  const unread = open
    ? 0
    : messages.filter((m) => m.playerId !== playerId && m.sentAt > lastSeenAt).length;

  const toggle = () => {
    if (open) setLastSeenAt(Math.max(Date.now(), latestAt));
    setOpen((v) => !v);
  };

  return (
    <>
      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={toggle} />
          <div
            style={{ '--kb': `${keyboardInset}px`, '--sheet-top': `${sheetTop ?? 0}px` } as React.CSSProperties}
            className={[
              'z-50 bg-white border border-gray-200 shadow-xl p-3 flex flex-col gap-2',
              // Mobile: bottom sheet above the keyboard, or a top sheet when the keyboard covers the bottom;
              // desktop: popover above the dock, right-aligned
              sheetTop != null ? 'fixed inset-x-0 top-[var(--sheet-top)] rounded-b-2xl' : 'fixed inset-x-0 bottom-[var(--kb)] rounded-t-2xl',
              'md:absolute md:inset-x-auto md:right-0 md:bottom-full md:mb-2 md:w-80 md:rounded-2xl',
              pinnedOnDesktop ? 'md:hidden' : '',
            ].join(' ')}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chat</p>
              <div className="flex items-center gap-1">
              {onPin && (
                <button
                  onClick={() => { toggle(); onPin(); }}
                  aria-label="Pin chat to the right"
                  title="Keep chat open on the right"
                  className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <PanelRightOpen className="w-4 h-4" aria-hidden />
                </button>
              )}
              <button
                onClick={toggle}
                aria-label="Close chat"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
              </div>
            </div>
            <ChatPanel
              messages={messages}
              sendMessage={sendMessage}
              playerId={playerId}
              playerColorMap={playerColorMap}
              autoFocus
            />
          </div>
        </>
      )}
      <button
        onClick={toggle}
        aria-label={unread > 0 ? `Chat, ${unread} unread` : 'Chat'}
        className={[
          'relative flex-shrink-0 w-12 h-12 rounded-2xl border shadow-lg flex items-center justify-center transition-colors',
          pinnedOnDesktop ? 'md:hidden' : '',
          open ? 'bg-brand-500 border-brand-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
        ].join(' ')}
      >
        <MessageCircle className="w-5 h-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-5 text-center animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
