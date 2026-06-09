import { memo } from 'react';

interface WordNodeData {
  word: string;
  isStart: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
  playerColor?: string;
}

interface WordNodeProps {
  id: string;
  data: WordNodeData;
  selected: boolean;
}

function WordNode({ id, data, selected }: WordNodeProps) {
  const { word, isStart, canDelete, onDelete, playerColor } = data;

  const baseClass =
    'px-4 py-2 rounded-xl border-2 shadow-md select-none text-sm font-semibold uppercase tracking-wide transition-all';
  const startClass = 'bg-brand-500 border-brand-700 text-white min-w-[90px] text-center';
  const normalClass = selected
    ? 'bg-white border-brand-500 text-gray-800'
    : 'bg-white border-gray-300 text-gray-800';

  const nodeStyle =
    !isStart && playerColor
      ? {
          borderColor: playerColor,
          backgroundColor: `${playerColor}18`,
        }
      : undefined;

  return (
    <div className="relative group">
      <div
        className={`${baseClass} ${isStart ? startClass : normalClass}`}
        style={nodeStyle}
      >
        {word}
        {!isStart && canDelete && (
          <button
            className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none"
            onClick={() => onDelete(id)}
            title="Delete node"
          >
            ×
          </button>
        )}
      </div>

    </div>
  );
}

export default memo(WordNode);
