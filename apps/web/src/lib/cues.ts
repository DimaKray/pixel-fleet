import type { GameView, Shot, ShotOutcome } from '@pixelfleet/engine';

export type SoundName =
  | 'fire'
  | 'splash'
  | 'hit'
  | 'sunk'
  | 'turn'
  | 'start'
  | 'win'
  | 'lose'
  | 'click'
  | 'place'
  | 'deny';

export interface SoundCue {
  name: SoundName;
  delayMs: number;
}

const RESULT_SOUND: Record<ShotOutcome, SoundName> = { miss: 'splash', hit: 'hit', sunk: 'sunk' };

/** Після повернення в гру може прийти пачка пострілів. Озвучуємо лише останні. */
const MAX_SHOT_CUES = 2;
const SHOT_SPACING_MS = 600;
const IMPACT_DELAY_MS = 220;
const AFTER_SHOT_MS = 700;
const AFTER_FINISH_MS = 1100;

function added(before: readonly Shot[], after: readonly Shot[]): Shot[] {
  return after.length > before.length ? after.slice(before.length) : [];
}

function shotCues(prev: GameView, next: GameView): SoundCue[] {
  // Мої постріли по суперникові й постріли суперника по мені.
  const fresh = [
    ...added(prev.opponentBoard?.shots ?? [], next.opponentBoard?.shots ?? []),
    ...added(prev.ownBoard?.shots ?? [], next.ownBoard?.shots ?? []),
  ].slice(-MAX_SHOT_CUES);

  return fresh.flatMap((shot, i): SoundCue[] => [
    { name: 'fire', delayMs: i * SHOT_SPACING_MS },
    { name: RESULT_SOUND[shot.outcome], delayMs: i * SHOT_SPACING_MS + IMPACT_DELAY_MS },
  ]);
}

/** Чиста функція: які звуки зіграти, коли стан гри змінився з `prev` на `next`. */
export function soundsForTransition(prev: GameView | null, next: GameView): SoundCue[] {
  // Перший стан після завантаження сторінки не озвучуємо.
  if (!prev) return [];

  const cues = prev.phase === 'battle' ? shotCues(prev, next) : [];
  const wait = (ms: number): number => (cues.length > 0 ? ms : 0);

  if (prev.phase !== next.phase) {
    if (next.phase === 'battle') cues.push({ name: 'start', delayMs: 0 });
    if (next.phase === 'finished') {
      cues.push({
        name: next.winner === next.you ? 'win' : 'lose',
        delayMs: wait(AFTER_FINISH_MS),
      });
    }
  } else if (next.phase === 'battle' && !prev.yourTurn && next.yourTurn) {
    cues.push({ name: 'turn', delayMs: wait(AFTER_SHOT_MS) });
  }

  return cues;
}
