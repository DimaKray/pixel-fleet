import type { PlayerId } from '@pixelfleet/engine';
import { portraits } from './assets';
import type { PortraitId } from './assets';

const at = (index: number): PortraitId => portraits[index % portraits.length] ?? 'captain';

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/**
 * Капітани обох гравців визначаються кодом кімнати, тому обидва клієнти бачать однаково,
 * а передавати аватари через сервер не потрібно. Два капітани ніколи не збігаються.
 */
export function captainsFor(code: string): Record<PlayerId, PortraitId> {
  const value = hash(code);
  const first = value % portraits.length;
  const offset = 1 + (Math.floor(value / portraits.length) % (portraits.length - 1));
  return { a: at(first), b: at(first + offset) };
}

export function opponentPortrait(code: string, you: PlayerId): PortraitId {
  const captains = captainsFor(code);
  return you === 'a' ? captains.b : captains.a;
}
