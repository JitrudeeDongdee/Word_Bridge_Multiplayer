import { PanelRightClose } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import ChatPanel from './ChatPanel';

interface ChatSidePanelProps {
  roomId: string;
  playerId: string;
  playerName: string;
  playerColorMap: Record<string, string>;
  onCollapse: () => void;
}

/** Chat docked at the right edge (md and up) so it stays visible while playing. */
export default function ChatSidePanel({ roomId, playerId, playerName, playerColorMap, onCollapse }: ChatSidePanelProps) {
  const { messages, sendMessage } = useChat(roomId, playerId, playerName);
  return (
    // Content is absolutely positioned so a long chat scrolls inside instead of stretching the page
    <aside className="hidden md:block relative w-80 flex-shrink-0 border-l border-gray-200 bg-white">
      <div className="absolute inset-0 flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chat</p>
        <button
          onClick={onCollapse}
          aria-label="Collapse chat"
          title="Collapse chat"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <PanelRightClose className="w-4 h-4" aria-hidden />
        </button>
      </div>
      <ChatPanel messages={messages} sendMessage={sendMessage} playerId={playerId} playerColorMap={playerColorMap} fill />
      </div>
    </aside>
  );
}
