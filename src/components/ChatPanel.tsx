import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useChat } from '../hooks/useChat';

interface ChatPanelProps {
  roomId: string;
  playerId: string;
  playerName: string;
  playerColorMap: Record<string, string>;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ roomId, playerId, playerName, playerColorMap }: ChatPanelProps) {
  const { messages, sendMessage } = useChat(roomId, playerId, playerName);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

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
    <div className="flex flex-col gap-2">
      {/* Message list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex flex-col gap-1.5 max-h-96 overflow-y-auto pr-1"
      >
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 italic text-center py-3">No messages yet</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.playerId === playerId;
          const color = playerColorMap[msg.playerId] ?? '#94a3b8';
          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] font-semibold" style={{ color }}>
                  {isMe ? 'You' : msg.playerName}
                </span>
                <span className="text-[10px] text-gray-300">{formatTime(msg.sentAt)}</span>
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          maxLength={200}
          autoComplete="off"
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-2.5 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-xs rounded-lg transition-colors shrink-0 font-semibold"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
