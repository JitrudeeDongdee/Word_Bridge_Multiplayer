import { ArrowUp, Ban, Flag, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../types';
import { useGameStore } from '../store/useGameStore';
import Avatar from './Avatar';
import ConfirmDialog from './ConfirmDialog';
import ReportDialog from './ReportDialog';
import {
  blockPlayer, hideBlocked, reportMessage, subscribeBlocks, unblockPlayer, type BlockedPlayer,
} from '../services/moderationService';

interface ChatPanelProps {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  playerId: string;
  playerColorMap: Record<string, string>;
  autoFocus?: boolean;
  /** Fill the parent's height (side panel) instead of a capped list height */
  fill?: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ messages, sendMessage, playerId, playerColorMap, autoFocus, fill = false }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  // Pictures of the players in this room (members who set one)
  const players = useGameStore((s) => s.room?.players);
  const roomId = useGameStore((s) => s.room?.id);

  // Report / block (Play Store user-generated-content policy)
  const [blocks, setBlocks] = useState<Record<string, BlockedPlayer>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [blocking, setBlocking] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => (playerId ? subscribeBlocks(playerId, setBlocks) : undefined), [playerId]);
  const { visible, hiddenFrom } = hideBlocked(messages, blocks);

  // Close the message menu on any outside click
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuFor]);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visible.length, autoScroll]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(input);
      setInput('');
      setAutoScroll(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2${fill ? ' flex-1 min-h-0' : ''}`}>
      {/* Message list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className={`flex flex-col gap-1.5 overflow-y-auto pr-1 ${fill ? 'flex-1 min-h-0' : 'max-h-[50vh] md:max-h-80'}`}
      >
        {hiddenFrom.length > 0 && (
          <p className="text-[10px] text-gray-400 text-center">
            Messages from {hiddenFrom.map((p) => p.name).join(', ')} are hidden (blocked) ·{' '}
            {hiddenFrom.map((p) => (
              <button key={p.id} onClick={() => unblockPlayer(playerId, p.id).catch(() => {})} className="text-brand-600 hover:underline mr-1">
                Unblock{hiddenFrom.length > 1 ? ` ${p.name}` : ''}
              </button>
            ))}
          </p>
        )}
        {visible.length === 0 && hiddenFrom.length === 0 && (
          <p className="text-xs text-gray-400 italic text-center py-3">No messages yet</p>
        )}
        {visible.map((msg) => {
          const isMe = msg.playerId === playerId;
          const color = playerColorMap[msg.playerId] ?? '#94a3b8';
          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1">
                {players?.[msg.playerId]?.photo ? (
                  <Avatar name={msg.playerName} photo={players[msg.playerId].photo} size={16} />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="text-[10px] font-semibold" style={{ color }}>
                  {isMe ? 'You' : msg.playerName}
                </span>
                <span className="text-[10px] text-gray-300">{formatTime(msg.sentAt)}</span>
                {!isMe && roomId && (
                  <span className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === msg.id ? null : msg.id); }}
                      aria-label={`Report or block ${msg.playerName}`}
                      aria-haspopup="menu"
                      aria-expanded={menuFor === msg.id}
                      className="p-0.5 -my-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    {menuFor === msg.id && (
                      <span role="menu" className="absolute left-0 top-full mt-1 z-20 w-36 flex flex-col bg-white rounded-lg shadow-lg ring-1 ring-black/5 py-1 text-xs">
                        <button role="menuitem" onClick={() => { setMenuFor(null); setReporting(msg); }} className="flex items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50">
                          <Flag className="w-3.5 h-3.5" aria-hidden /> Report message
                        </button>
                        <button role="menuitem" onClick={() => { setMenuFor(null); setBlocking({ id: msg.playerId, name: msg.playerName }); }} className="flex items-center gap-2 px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50">
                          <Ban className="w-3.5 h-3.5" aria-hidden /> Block {msg.playerName.length > 10 ? 'player' : msg.playerName}
                        </button>
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div
                className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-xs leading-snug break-words ${
                  isMe
                    ? 'bg-brand-500 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {reporting && roomId && (
        <ReportDialog
          message={reporting}
          onClose={() => setReporting(null)}
          onSubmit={async (reason, alsoBlock) => {
            await reportMessage(playerId, roomId, reporting, reason);
            if (alsoBlock) await blockPlayer(playerId, { id: reporting.playerId, name: reporting.playerName });
          }}
        />
      )}
      {blocking && (
        <ConfirmDialog
          title={`Block ${blocking.name}?`}
          message="You won't see their chat messages in any room. You can unblock them from the chat later."
          confirmLabel="Block"
          danger
          onCancel={() => setBlocking(null)}
          onConfirm={() => { blockPlayer(playerId, blocking).catch(() => {}); setBlocking(null); }}
        />
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          maxLength={200}
          autoComplete="off"
          autoFocus={autoFocus}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="px-2.5 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-xs rounded-lg transition-colors shrink-0 font-semibold"
        >
          <ArrowUp className="w-4 h-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
