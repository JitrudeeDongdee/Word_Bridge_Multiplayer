import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface WordNodeData {
  word: string;
  isStart: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
  playerColor?: string;
  isPathNode?: boolean;
  isHighlighted?: boolean;
  connectedWords?: string[];
}

interface WordNodeProps {
  id: string;
  data: WordNodeData;
  selected: boolean;
}

function WordNode({ id, data, selected }: WordNodeProps) {
  const { word, isStart, canDelete, onDelete, playerColor, isPathNode, isHighlighted } = data;

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

  const invisibleHandle = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 } as const;

  return (
    <div className="relative group">
      {/* source handles — one per side */}
      <Handle id="s-top"    type="source" position={Position.Top}    style={invisibleHandle} />
      <Handle id="s-right"  type="source" position={Position.Right}  style={invisibleHandle} />
      <Handle id="s-bottom" type="source" position={Position.Bottom} style={invisibleHandle} />
      <Handle id="s-left"   type="source" position={Position.Left}   style={invisibleHandle} />
      {/* Target handles — one per side */}
      <Handle id="t-top"    type="target" position={Position.Top}    style={invisibleHandle} />
      <Handle id="t-right"  type="target" position={Position.Right}  style={invisibleHandle} />
      <Handle id="t-bottom" type="target" position={Position.Bottom} style={invisibleHandle} />
      <Handle id="t-left"   type="target" position={Position.Left}   style={invisibleHandle} />
      {/* Winning-path highlight ring */}
      {isPathNode && (
        <div
          className="absolute inset-0 rounded-xl border-2 border-brand-400 animate-pulse pointer-events-none"
          style={{ margin: '-3px' }}
        />
      )}
      {isHighlighted && (
        <div
          className="absolute inset-0 rounded-xl border-2 border-sky-400 shadow-[0_0_8px_2px_rgba(56,189,248,0.5)] pointer-events-none"
          style={{ margin: '-3px' }}
        />
      )}
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
