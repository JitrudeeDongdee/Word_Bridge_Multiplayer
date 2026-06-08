import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface WordNodeData {
  word: string;
  isStart: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
}

interface WordNodeProps {
  id: string;
  data: WordNodeData;
  selected: boolean;
}

function WordNode({ id, data, selected }: WordNodeProps) {
  const { word, isStart, canDelete, onDelete } = data;

  const baseClass =
    'px-4 py-2 rounded-xl border-2 shadow-md select-none text-sm font-semibold uppercase tracking-wide transition-all';
  const startClass = 'bg-brand-500 border-brand-700 text-white min-w-[90px] text-center';
  const normalClass = selected
    ? 'bg-white border-brand-500 text-gray-800'
    : 'bg-white border-gray-300 text-gray-800 hover:border-brand-500';

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-brand-500" />

      <div className={`${baseClass} ${isStart ? startClass : normalClass}`}>
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

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-brand-500" />
    </div>
  );
}

export default memo(WordNode);
