import { ArrowRight, Flag, PartyPopper, Sparkles, Trophy, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import type { Room } from '../types';
import { NEXT_ROUND_DELAY_MS, NEXT_ROUND_RETRY_MS, startNextRound } from '../services/roomService';

const pts = (n: number) => `${n} pt${n === 1 ? '' : 's'}`;

interface VictoryModalProps {
  room: Room;
  roomId: string;
  playerColorMap: Record<string, string>;
}

export default function VictoryModal({ room, roomId, playerColorMap }: VictoryModalProps) {
  const navigate = useNavigate();
  const [minimized, setMinimized] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(NEXT_ROUND_DELAY_MS / 1000));

  const { gameState, nodes, winningPath } = room;
  const wordA = gameState?.wordA ?? '?';
  // Identifies this round, so only one player's countdown restarts it
  const round = String(gameState?.startedAt ?? (winningPath ?? []).join('|'));

  const next = useCallback(() => startNextRound(roomId, round).catch(() => false), [roomId, round]);

  // Next round starts by itself, so the room keeps going without the host. Every player
  // counts down; startNextRound lets only the first one through. If that player vanished
  // mid-restart, the claim expires and the others try again.
  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((NEXT_ROUND_DELAY_MS - (Date.now() - started)) / 1000)));
    }, 250);
    const first = setTimeout(() => void next(), NEXT_ROUND_DELAY_MS);
    const retry = setTimeout(() => void next(), NEXT_ROUND_DELAY_MS + NEXT_ROUND_RETRY_MS);
    return () => { clearInterval(tick); clearTimeout(first); clearTimeout(retry); };
  }, [next]);

  useEffect(() => {
    // Fire two bursts from the bottom corners
    const fire = (x: number) =>
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { x, y: 0.9 },
        startVelocity: 55,
        ticks: 200,
      });
    fire(0.2);
    const t = setTimeout(() => fire(0.8), 150);
    return () => clearTimeout(t);
  }, []);
  const wordB = gameState?.wordB ?? '?';
  const path = winningPath ?? [];
  const breakdown = room.roundBreakdown;
  // Firebase drops empty arrays, so these can be missing
  const bridgeIds = breakdown?.bridgeNodeIds ?? [];
  const creativeIds = breakdown?.creativeNodeIds ?? [];
  const nameOf = (pid: string) => room.players?.[pid]?.name ?? 'Someone';

  const roundEntries = Object.entries(room.roundScores ?? {}).sort(([, a], [, b]) => b - a);
  const totalEntries = Object.entries(room.scores ?? {}).sort(([, a], [, b]) => b - a);

  const handlePlayAgain = async () => {
    setRestarting(true);
    // Component unmounts when status → 'playing'
    if (!(await next())) setRestarting(false);
  };

  const countdown = restarting || secondsLeft === 0 ? 'Starting…' : `Next round in ${secondsLeft}`;

  /* ── Minimised: floating pill at bottom-right ── */
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-white border-2 border-brand-400 rounded-2xl shadow-2xl text-brand-600 font-bold text-sm hover:bg-brand-50 transition-all"
      >
        <Trophy className="w-4 h-4" aria-hidden /> View Results
        <span className="font-normal text-gray-500 tabular-nums">· {countdown}</span>
      </button>
    );
  }

  /* ── Full modal ── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Semi-transparent backdrop — lets the canvas show through */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => setMinimized(true)}
        title="Click to minimise"
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-3 flex-shrink-0">
          <div>
            <p className="text-3xl font-black text-brand-600 flex items-center gap-2">
              <PartyPopper className="w-7 h-7" aria-hidden /> You Win!
            </p>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
              <span className="font-bold uppercase text-gray-800">{wordA}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" aria-label="to" />
              <span className="font-bold uppercase text-gray-800">{wordB}</span>
            </p>
          </div>
          <button
            onClick={() => setMinimized(true)}
            title="See the board"
            aria-label="See the board"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 flex flex-col gap-5">
          {/* How this round was scored */}
          {breakdown && (
            // One grid so every row lines up: icon | what (and who) | points, right-aligned
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
              <Zap className="w-3.5 h-3.5" aria-hidden />
              <span className="min-w-0">
                {breakdown.intermediates}-word bridge
                {bridgeIds.length > 1 && (
                  <span className="text-amber-600"> · {breakdown.perWord} per word</span>
                )}
              </span>
              <span className="font-bold tabular-nums text-right">{pts(breakdown.pot)}</span>
              {breakdown.finisherId && (
                <>
                  <Flag className="w-3.5 h-3.5" aria-hidden />
                  <span className="min-w-0 truncate">
                    Finisher · <b>{nameOf(breakdown.finisherId)}</b>
                  </span>
                  <span className="font-bold tabular-nums text-right">+{pts(breakdown.finisherBonus)}</span>
                </>
              )}
              {creativeIds.length > 0 && (
                <>
                  <Sparkles className="w-3.5 h-3.5" aria-hidden />
                  <span className="min-w-0">
                    Creative link ·{' '}
                    <b className="uppercase">
                      {creativeIds.map((id) => nodes?.[id]?.word ?? '?').join(', ')}
                    </b>
                  </span>
                  <span className="font-bold tabular-nums text-right">+{pts(breakdown.creativeBonus)}</span>
                </>
              )}
            </div>
          )}
          {/* Winning path */}
          {path.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Winning Path
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {path.map((nodeId, i) => {
                  const node = nodes?.[nodeId];
                  const color = node?.isStart
                    ? '#0ea5e9'
                    : (playerColorMap[node?.createdBy ?? ''] ?? '#94a3b8');
                  return (
                    <span key={nodeId} className="flex items-center gap-1.5">
                      <span
                        className="px-2.5 py-0.5 rounded-full border-2 font-semibold text-xs uppercase"
                        style={{ borderColor: color, color, backgroundColor: `${color}18` }}
                      >
                        {node?.word ?? nodeId}
                      </span>
                      {i < path.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-gray-300" aria-hidden />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Round scores */}
          {roundEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                This Round
              </p>
              <div className="flex flex-col gap-1">
                {roundEntries.map(([pid, pts]) => {
                  const color = playerColorMap[pid] ?? '#94a3b8';
                  const name = room.players?.[pid]?.name ?? pid;
                  return (
                    <div
                      key={pid}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-gray-700">{name}</span>
                      </span>
                      <span className="text-sm font-bold text-green-600">
                        +{pts} pt{pts !== 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Total scores */}
          {totalEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Total Scores
              </p>
              <div className="flex flex-col gap-1">
                {totalEntries.map(([pid, pts], rank) => {
                  const color = playerColorMap[pid] ?? '#94a3b8';
                  const name = room.players?.[pid]?.name ?? pid;
                  return (
                    <div
                      key={pid}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{rank + 1}.</span>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-gray-700">{name}</span>
                      </span>
                      <span className="text-sm font-bold text-gray-800">{pts}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {/* Anyone can skip the countdown */}
          <button
            onClick={handlePlayAgain}
            disabled={restarting || secondsLeft === 0}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 disabled:opacity-60 transition-colors tabular-nums"
          >
            {restarting || secondsLeft === 0 ? 'Starting…' : `Play Again · ${secondsLeft}`}
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
