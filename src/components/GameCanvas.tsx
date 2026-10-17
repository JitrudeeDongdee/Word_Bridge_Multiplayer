import { ArrowLeftRight, BookOpen, Image as ImageIcon, Link2, X } from 'lucide-react';
import { useState, useCallback, useMemo, useEffect, useRef, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodeDrag,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import WordNode from './WordNode';
import type { Room } from '../types';
import { useGameActions } from '../hooks/useGameActions';
import { useCustomWordsSubscription } from '../hooks/useCustomWordsSubscription';
import { getPairVoteCount, pairKey, PAIR_VOTE_THRESHOLD } from '../services/pairVotesService';
import { lookupDefinition } from '../services/dictionary';
import DictImage from './DictImage';

const nodeTypes = { wordNode: WordNode };

/** Inner component to capture fitView — must live inside the ReactFlow context */
function FitViewCapture({ fitViewRef }: { fitViewRef?: MutableRefObject<(() => void) | null> }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (fitViewRef) fitViewRef.current = () => fitView({ padding: 0.2 });
  }, [fitView, fitViewRef]);
  return null;
}

const NODE_GAP = 8; // minimum gap between nodes in pixels

function nodesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w + NODE_GAP &&
    a.x + a.w + NODE_GAP > b.x &&
    a.y < b.y + b.h + NODE_GAP &&
    a.y + a.h + NODE_GAP > b.y
  );
}

interface GameCanvasProps {
  room: Room;
  roomId: string;
  playerId: string;
  playerColorMap: Record<string, string>;
  fitViewRef?: MutableRefObject<(() => void) | null>;
  onNodeSelect?: (nodeId: string | null) => void;
  selectedNodeId?: string | null;
}

export default function GameCanvas({ room, roomId, playerId, playerColorMap, fitViewRef, onNodeSelect, selectedNodeId }: GameCanvasProps) {
  const { handleDeleteNode, handleNodeDragStop, handleVotePair } = useGameActions(roomId);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const customWords = useCustomWordsSubscription();

  // Link voting: pick two words, then vote that they should be connected
  const [linkMode, setLinkMode] = useState(false);
  const [linkPicks, setLinkPicks] = useState<string[]>([]);
  // count null = the vote count couldn't be loaded
  const [linkVoteInfo, setLinkVoteInfo] = useState<{ key: string; count: number | null } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const resetLink = useCallback(() => setLinkPicks([]), []);

  // Dictionary
  const [dictMode, setDictMode] = useState(false);
  // Pictures on Dict cards: on unless this viewer switched them off (remembered per browser)
  const [dictImages, setDictImages] = useState(() => {
    try { return localStorage.getItem('wb-dict-images') !== 'off'; } catch { return true; }
  });
  const toggleDictImages = useCallback(() => {
    setDictImages((on) => {
      try { localStorage.setItem('wb-dict-images', on ? 'off' : 'on'); } catch { /* storage unavailable */ }
      return !on;
    });
  }, []);
  type DictCard = { word: string; definition: string; partOfSpeech: string };
  const [dictChain, setDictChain] = useState<DictCard[]>([]);
  const [dictChainLoading, setDictChainLoading] = useState(false);
  const [dictSearch, setDictSearch] = useState('');
  const [dictSuggestions, setDictSuggestions] = useState<string[]>([]);
  const [showDictSuggestions, setShowDictSuggestions] = useState(false);
  const [dictDropdownRect, setDictDropdownRect] = useState<DOMRect | null>(null);
  const dictInputRef = useRef<HTMLInputElement>(null);
  const sugAbortRef = useRef<AbortController | null>(null);
  const defCache = useRef(new Map<string, { definition: string; partOfSpeech: string }>());

  // Autocomplete suggestions for dict search
  useEffect(() => {
    const trimmed = dictSearch.trim();
    if (trimmed.length < 2) { setDictSuggestions([]); return; }
    const timer = setTimeout(async () => {
      sugAbortRef.current?.abort();
      const controller = new AbortController();
      sugAbortRef.current = controller;
      try {
        const res = await fetch(
          `https://api.datamuse.com/sug?s=${encodeURIComponent(trimmed)}&max=6`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as Array<{ word: string }>;
        const apiSuggestions = data.map((d) => d.word);
        
        // Merge with custom words (custom words first, then API suggestions)
        const merged = [
          ...customWords.filter((w) => w.startsWith(trimmed.toLowerCase())),
          ...apiSuggestions.filter((w) => !customWords.includes(w)),
        ];
        
        setDictSuggestions(merged);
      } catch { /* aborted */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [dictSearch, customWords]);

  const fetchDictCard = useCallback(async (rawWord: string): Promise<DictCard> => {
    const word = rawWord.trim().toLowerCase();
    if (defCache.current.has(word)) return { word, ...defCache.current.get(word)! };
    const entry = await lookupDefinition(word);
    if (entry) {
      defCache.current.set(word, entry);
      return { word, ...entry };
    }
    return { word, definition: 'Definition not found.', partOfSpeech: '' };
  }, []);

  // Replace whole chain (search box / node click)
  const fetchDefinition = useCallback(async (rawWord: string) => {
    const word = rawWord.trim().toLowerCase();
    if (!word) return;
    setDictSearch(rawWord.trim());
    setDictChainLoading(true);
    setDictChain([]);
    try {
      const card = await fetchDictCard(word);
      setDictChain([card]);
    } catch {
      setDictChain([{ word, definition: 'Could not fetch definition.', partOfSpeech: '' }]);
    }
    setDictChainLoading(false);
  }, [fetchDictCard]);

  // Append to chain (clicking word inside a definition)
  const appendDefinition = useCallback(async (rawWord: string) => {
    const word = rawWord.trim().toLowerCase();
    if (!word) return;
    setDictChainLoading(true);
    try {
      const card = await fetchDictCard(word);
      setDictChain((prev) => [...prev, card]);
    } catch {
      setDictChain((prev) => [...prev, { word, definition: 'Could not fetch definition.', partOfSpeech: '' }]);
    }
    setDictChainLoading(false);
  }, [fetchDictCard]);

  const removeFromChain = useCallback((index: number) => {
    setDictChain((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (linkMode) {
      setLinkMessage(null);
      setLinkPicks((picks) => {
        if (picks.includes(node.id)) return picks.filter((id) => id !== node.id);
        if (picks.length >= 2) return [node.id];
        return [...picks, node.id];
      });
      return;
    }
    // Toggle: click selected node again to deselect
    onNodeSelect?.(node.id === selectedNodeId ? null : node.id);
    if (dictMode) fetchDefinition(node.data.word as string);
  }, [linkMode, dictMode, fetchDefinition, onNodeSelect, selectedNodeId]);

  const linkWords = linkPicks.map((id) => room.nodes?.[id]?.word).filter(Boolean) as string[];

  const linkKey = linkWords.length === 2 ? pairKey(linkWords[0], linkWords[1]) : null;
  const linkVoteInfoForPair = linkKey && linkVoteInfo?.key === linkKey ? linkVoteInfo : null;

  // Show how many players already voted for the picked pair
  useEffect(() => {
    if (!linkKey) return;
    let cancelled = false;
    const [w1, w2] = linkKey.split('|');
    getPairVoteCount(w1, w2)
      .then((count) => { if (!cancelled) setLinkVoteInfo({ key: linkKey, count }); })
      .catch(() => { if (!cancelled) setLinkVoteInfo({ key: linkKey, count: null }); });
    return () => { cancelled = true; };
  }, [linkKey]);

  const submitLinkVote = useCallback(async () => {
    if (linkPicks.length !== 2) return;
    const [w1, w2] = linkWords;
    setLinkBusy(true);
    try {
      const res = await handleVotePair(linkPicks[0], linkPicks[1]);
      if (res.error) {
        setLinkMessage({ text: res.error, tone: 'error' });
      } else if (res.linked) {
        setLinkMessage({ text: `Linked! Players taught the game that ${w1} and ${w2} belong together.`, tone: 'ok' });
        resetLink();
      } else {
        const left = res.threshold - res.count;
        setLinkMessage({
          text: `Vote saved (${res.count}/${res.threshold}). ${left} more player${left === 1 ? '' : 's'} needed to link ${w1} and ${w2}.`,
          tone: 'ok',
        });
        resetLink();
      }
    } catch {
      setLinkMessage({ text: 'Could not save your vote. Please try again.', tone: 'error' });
    }
    setLinkBusy(false);
  }, [handleVotePair, linkPicks, linkWords, resetLink]);

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Adjacency: nodeId → connected words list (for tooltip)
  const adjacencyWords = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of Object.values(room.edges ?? {})) {
      const srcWord = room.nodes?.[edge.source]?.word;
      const tgtWord = room.nodes?.[edge.target]?.word;
      if (tgtWord) { if (!map.has(edge.source)) map.set(edge.source, []); map.get(edge.source)!.push(tgtWord); }
      if (srcWord) { if (!map.has(edge.target)) map.set(edge.target, []); map.get(edge.target)!.push(srcWord); }
    }
    return map;
  }, [room.edges, room.nodes]);

  // Set of node IDs connected to the hovered node
  const highlightedIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const set = new Set<string>();
    for (const edge of Object.values(room.edges ?? {})) {
      if (edge.source === hoveredNodeId) set.add(edge.target);
      if (edge.target === hoveredNodeId) set.add(edge.source);
    }
    return set;
  }, [hoveredNodeId, room.edges]);

  // Build React Flow nodes from Firebase state
  const rfNodes: Node[] = useMemo(() => {
    const pathIds = new Set(
      room.status === 'won' ? (room.winningPath ?? []) : [],
    );
    return Object.values(room.nodes ?? {}).map((n) => ({
      id: n.id,
      type: 'wordNode',
      position: { x: n.x, y: n.y },
      data: {
        word: n.word,
        isStart: n.isStart,
        // Not while pending: its background check would keep linking a deleted node
        canDelete: n.createdBy === playerId && !n.isStart && !n.pending,
        isPending: !!n.pending,
        onDelete: handleDeleteNode,
        playerColor: n.isStart ? undefined : (playerColorMap[n.createdBy] ?? '#94a3b8'),
        isPathNode: pathIds.has(n.id),
        connectedWords: adjacencyWords.get(n.id) ?? [],
        isHighlighted: highlightedIds.has(n.id),
        isLinkPick: linkPicks.includes(n.id),
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.nodes, room.winningPath, room.status, playerId, playerColorMap, adjacencyWords, highlightedIds, linkPicks]);

  // Build React Flow edges from Firebase state
  const rfEdges: Edge[] = useMemo(() => {
    const nodeMap = new Map(rfNodes.map((n) => [n.id, n.position]));

    // Build a map of edgeId → highlight color for winning-path edges
    const pathEdgeColors = new Map<string, string>();
    if (room.status === 'won' && room.winningPath && room.winningPath.length >= 2) {
      const pairColor = new Map<string, string>();
      for (let i = 0; i < room.winningPath.length - 1; i++) {
        const aId = room.winningPath[i];
        const bId = room.winningPath[i + 1];
        const bNode = room.nodes?.[bId];
        const aNode = room.nodes?.[aId];
        const colorNode =
          bNode && !bNode.isStart ? bNode
          : aNode && !aNode.isStart ? aNode
          : null;
        const color = colorNode
          ? (playerColorMap[colorNode.createdBy] ?? '#0ea5e9')
          : '#0ea5e9';
        pairColor.set([aId, bId].sort().join('|'), color);
      }
      for (const e of Object.values(room.edges ?? {})) {
        const key = [e.source, e.target].sort().join('|');
        const color = pairColor.get(key);
        if (color) pathEdgeColors.set(e.id, color);
      }
    }

    return Object.values(room.edges ?? {}).map((e) => {
      const srcPos = nodeMap.get(e.source);
      const tgtPos = nodeMap.get(e.target);

      let sourceHandle = 's-right';
      let targetHandle = 't-left';

      if (srcPos && tgtPos) {
        const dx = tgtPos.x - srcPos.x;
        const dy = tgtPos.y - srcPos.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
          sourceHandle = dx >= 0 ? 's-right' : 's-left';
          targetHandle = dx >= 0 ? 't-left'  : 't-right';
        } else {
          sourceHandle = dy >= 0 ? 's-bottom' : 's-top';
          targetHandle = dy >= 0 ? 't-top'    : 't-bottom';
        }
      }

      const pathColor = pathEdgeColors.get(e.id);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle,
        targetHandle,
        type: 'default',
        animated: pathColor !== undefined,
        style: pathColor ? { stroke: pathColor, strokeWidth: 3 } : undefined,
      };
    });
  }, [room.edges, room.winningPath, room.status, room.nodes, rfNodes, playerColorMap]);

  const [localNodes, setLocalNodes] = useState<Node[]>(rfNodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(rfEdges);

  // Keep local state in sync when Firebase state updates
  const syncedNodes = rfNodes;
  const syncedEdges = rfEdges;

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setLocalNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setLocalEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_event, node) => {
      const dw = (node.measured?.width ?? 150);
      const dh = (node.measured?.height ?? 44);
      const dragged = { x: node.position.x, y: node.position.y, w: dw, h: dh };

      const hasOverlap = syncedNodes.some((other) => {
        if (other.id === node.id) return false;
        return nodesOverlap(dragged, {
          x: other.position.x,
          y: other.position.y,
          w: (other.measured?.width ?? 150),
          h: (other.measured?.height ?? 44),
        });
      });

      if (!hasOverlap) {
        handleNodeDragStop(node.id, node.position.x, node.position.y);
      }
      // If overlapping, skip Firebase update → node reverts to original position
    },
    [handleNodeDragStop, syncedNodes],
  );

  const onNodeMouseEnter = useCallback<NodeMouseHandler>((_e, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback<NodeMouseHandler>(() => {
    setHoveredNodeId(null);
  }, []);

  // Use Firebase-derived nodes/edges as the source of truth (controlled mode)
  void localNodes;
  void localEdges;

  return (
    <div className={`w-full h-full${dictMode || linkMode ? ' [&_.react-flow__node]:cursor-pointer' : ''}`}>
      <ReactFlow
        nodes={syncedNodes}
        edges={syncedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        connectOnClick={false}
        nodesConnectable={false}
        connectionMode={ConnectionMode.Loose}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        // Default minZoom (0.5) can't fit the two goal words on a phone-width screen
        minZoom={0.2}
        deleteKeyCode={null}
      >
        <Background />
        <Controls className="!hidden md:!flex" />
        <MiniMap position="top-right" className="hidden md:block" nodeColor={(n) => (n.data.isStart ? '#0ea5e9' : ((n.data.playerColor as string) ?? '#e2e8f0'))} />
        <FitViewCapture fitViewRef={fitViewRef} />
        <Panel position="top-left" className="flex flex-col gap-2">
          {room.status === 'playing' && (
            <button
              onClick={() => {
                setLinkMode((m) => !m);
                setDictMode(false);
                resetLink();
                setLinkMessage(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border transition-colors ${
                linkMode
                  ? 'bg-amber-500 border-amber-600 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" aria-hidden />
              Vote link {linkMode ? 'ON' : 'OFF'}
            </button>
          )}
          <button
            onClick={() => { setDictMode((d) => !d); setLinkMode(false); resetLink(); setDictChain([]); setDictSearch(''); }}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border transition-colors ${
              dictMode
                ? 'bg-brand-500 border-brand-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden />
            Dict {dictMode ? 'ON' : 'OFF'}
          </button>
          {dictMode && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-56 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
              <button
                type="button"
                onClick={toggleDictImages}
                aria-pressed={dictImages}
                className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors ${
                  dictImages
                    ? 'bg-brand-50 border-brand-300 text-brand-600'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <ImageIcon className="w-3 h-3" aria-hidden />
                Images {dictImages ? 'ON' : 'OFF'}
              </button>
              <form
                onSubmit={(e) => { e.preventDefault(); setShowDictSuggestions(false); fetchDefinition(dictSearch); }}
                className="flex gap-1"
              >
                <input
                  ref={dictInputRef}
                  value={dictSearch}
                  onChange={(e) => {
                    setDictSearch(e.target.value);
                    if (dictInputRef.current) setDictDropdownRect(dictInputRef.current.getBoundingClientRect());
                    setShowDictSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowDictSuggestions(false), 150)}
                  onFocus={() => {
                    if (dictSuggestions.length > 0 && dictInputRef.current) {
                      setDictDropdownRect(dictInputRef.current.getBoundingClientRect());
                      setShowDictSuggestions(true);
                    }
                  }}
                  placeholder="Search word…"
                  className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-400"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={!dictSearch.trim()}
                  className="px-2 py-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-xs rounded-md transition-colors shrink-0"
                >
                  Go
                </button>
              </form>
              {showDictSuggestions && dictSuggestions.length > 0 && dictDropdownRect && createPortal(
                <ul
                  style={{
                    position: 'fixed',
                    top: dictDropdownRect.bottom + 4,
                    left: dictDropdownRect.left,
                    width: dictDropdownRect.width + 44, // include Go button width
                    zIndex: 9999,
                  }}
                  className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
                >
                  {dictSuggestions.map((s) => (
                    <li key={s} className="list-none">
                      <button
                        type="button"
                        onMouseDown={() => { setDictSearch(s); setShowDictSuggestions(false); fetchDefinition(s); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>,
                document.body,
              )}

              {dictChain.map((card, i) => (
                <div key={`${card.word}-${i}`} className="relative rounded-lg border border-gray-100 bg-gray-50 p-2 flex flex-col gap-1">
                  <button
                    onClick={() => removeFromChain(i)}
                    className="absolute top-1.5 right-1.5 text-gray-300 hover:text-gray-500"
                    title="Remove"
                    aria-label="Remove"
                  ><X className="w-3.5 h-3.5" aria-hidden /></button>
                  <div className="font-semibold text-gray-800 capitalize text-sm pr-4">{card.word}</div>
                  {dictImages && <DictImage word={card.word} />}
                  {card.partOfSpeech && (
                    <div className="text-xs text-brand-500 italic">{card.partOfSpeech}</div>
                  )}
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {card.definition.split(/\b/).map((token, ti) => {
                      const isWord = /^[a-zA-Z]{2,}$/.test(token);
                      return isWord ? (
                        <button
                          key={ti}
                          type="button"
                          onClick={() => appendDefinition(token)}
                          className="text-brand-600 hover:underline hover:text-brand-700 cursor-pointer bg-transparent border-none p-0 font-[inherit] text-[inherit]"
                        >{token}</button>
                      ) : token;
                    })}
                  </p>
                </div>
              ))}

              {dictChainLoading && <p className="text-xs text-gray-400">Loading…</p>}
              {!dictChainLoading && dictChain.length === 0 && (
                <p className="text-xs text-gray-400">Click a word or type to search</p>
              )}
            </div>
          )}
        </Panel>
        {linkMode && (
          <Panel position="top-center" className="!mt-3">
            <div className="bg-white border border-amber-300 rounded-xl shadow-lg px-4 py-3 w-[min(22rem,calc(100vw-2rem))] flex flex-col gap-2 text-sm">
              {linkWords.length < 2 ? (
                <p className="text-gray-600">
                  {linkWords.length === 0
                    ? 'Tap two words that should be connected.'
                    : <>Picked <b className="uppercase">{linkWords[0]}</b> — now tap the second word.</>}
                </p>
              ) : (
                <>
                  <p className="text-gray-700">
                    Link <b className="uppercase">{linkWords[0]}</b>{' '}
                    <ArrowLeftRight className="inline w-3.5 h-3.5 text-gray-400 align-[-2px]" aria-label="and" />{' '}
                    <b className="uppercase">{linkWords[1]}</b>?
                  </p>
                  <p className="text-xs text-gray-500">
                    {!linkVoteInfoForPair
                      ? 'Checking votes…'
                      : linkVoteInfoForPair.count === null
                        ? "Couldn't load the vote count."
                        : `${linkVoteInfoForPair.count}/${PAIR_VOTE_THRESHOLD} players voted.`}{' '}
                    Once {PAIR_VOTE_THRESHOLD} different players agree, these words connect in every game.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={submitLinkVote}
                      disabled={linkBusy}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                    >
                      {linkBusy ? 'Saving…' : 'Vote to link'}
                    </button>
                    <button
                      onClick={resetLink}
                      disabled={linkBusy}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {linkMessage && (
                <p className={`text-xs ${linkMessage.tone === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {linkMessage.text}
                </p>
              )}
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
