import type { GameView } from '@pixelfleet/engine';

export type GameStatus = 'waiting' | 'your_turn' | 'opponent_turn' | 'won' | 'lost';

export function gameStatus(view: GameView): GameStatus {
  if (view.phase === 'finished') return view.winner === view.you ? 'won' : 'lost';
  if (view.phase === 'placement') return 'waiting';
  return view.yourTurn ? 'your_turn' : 'opponent_turn';
}
