import { BOARD_SIZE, FLEET } from './constants.js';
import { inBounds, shipCells } from './geometry.js';
import type { OpponentBoardView } from './projection.js';
import type { Coord, Orientation } from './types.js';

export const BOT_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

const key = ({ x, y }: Coord): string => `${x},${y}`;

const STEPS: readonly Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
const ORIENTATIONS: readonly Orientation[] = ['horizontal', 'vertical'];

/** Усе, що бот знає про поле суперника. Нічого іншого він бачити не має права. */
interface Knowledge {
  /** Куди стріляти безглуздо: уже стріляли або поруч із потопленим кораблем (кораблі не торкаються). */
  blocked: Set<string>;
  /** Влучання по кораблях, які ще на плаву. */
  openHits: Coord[];
  /** Розміри кораблів, що лишилися. */
  remaining: number[];
}

function analyze(view: OpponentBoardView): Knowledge {
  const sunkCells = view.sunkShips.flatMap((ship) => shipCells(ship));
  const sunkKeys = new Set(sunkCells.map(key));
  const blocked = new Set(view.shots.map((shot) => key(shot.at)));

  for (const cell of sunkCells) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) blocked.add(key({ x: cell.x + dx, y: cell.y + dy }));
    }
  }

  const sunkTypes = new Set(view.sunkShips.map((ship) => ship.type));
  return {
    blocked,
    openHits: view.shots
      .filter((shot) => shot.outcome !== 'miss' && !sunkKeys.has(key(shot.at)))
      .map((shot) => shot.at),
    remaining: FLEET.filter((entry) => !sunkTypes.has(entry.type)).map((entry) => entry.size),
  };
}

function allCells(): Coord[] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({
    x: i % BOARD_SIZE,
    y: Math.floor(i / BOARD_SIZE),
  }));
}

function pick<T>(items: readonly T[], random: () => number): T | undefined {
  return items[Math.floor(random() * items.length)];
}

/** Куди стріляти після влучання: продовжити лінію, якщо влучань уже два й більше, або сусідні клітинки. */
function targetCells(hits: readonly Coord[], isFree: (cell: Coord) => boolean): Coord[] {
  const first = hits[0];
  if (!first) return [];

  if (hits.length > 1) {
    const horizontal = hits.every((hit) => hit.y === first.y);
    const vertical = hits.every((hit) => hit.x === first.x);
    if (horizontal || vertical) {
      const along = hits.map((hit) => (horizontal ? hit.x : hit.y));
      const low = Math.min(...along);
      const high = Math.max(...along);
      const ends: Coord[] = horizontal
        ? [
            { x: low - 1, y: first.y },
            { x: high + 1, y: first.y },
          ]
        : [
            { x: first.x, y: low - 1 },
            { x: first.x, y: high + 1 },
          ];
      const open = ends.filter(isFree);
      if (open.length > 0) return open;
    }
  }

  return hits
    .flatMap((hit) => STEPS.map((step) => ({ x: hit.x + step.x, y: hit.y + step.y })))
    .filter(isFree);
}

function chooseNormal(
  knowledge: Knowledge,
  free: Coord[],
  isFree: (cell: Coord) => boolean,
  random: () => number,
): Coord | undefined {
  if (knowledge.openHits.length > 0) {
    const target = pick(targetCells(knowledge.openHits, isFree), random);
    if (target) return target;
  }
  // Полювання «шахівницею»: найменший корабель займає 2 клітинки, тож кожну другу можна пропускати.
  const parity = free.filter((cell) => (cell.x + cell.y) % 2 === 0);
  return pick(parity.length > 0 ? parity : free, random);
}

/** Для кожної клітинки рахуємо, у скількох можливих розстановках кораблів вона може бути зайнята. */
function chooseHard(knowledge: Knowledge, free: Coord[], random: () => number): Coord | undefined {
  const hitKeys = new Set(knowledge.openHits.map(key));
  const targeting = knowledge.openHits.length > 0;
  const score = new Map<string, number>();

  for (const size of knowledge.remaining) {
    for (const orientation of ORIENTATIONS) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const cells: Coord[] = Array.from({ length: size }, (_, i) => ({
            x: x + (orientation === 'horizontal' ? i : 0),
            y: y + (orientation === 'vertical' ? i : 0),
          }));
          if (!cells.every(inBounds)) continue;
          if (!cells.every((cell) => !knowledge.blocked.has(key(cell)) || hitKeys.has(key(cell)))) {
            continue;
          }

          const covered = cells.filter((cell) => hitKeys.has(key(cell))).length;
          // Є влучання без потоплення: цікавлять лише розстановки, що його пояснюють.
          if (targeting && covered === 0) continue;

          const weight = targeting ? covered * covered : 1;
          for (const cell of cells) {
            if (!hitKeys.has(key(cell))) score.set(key(cell), (score.get(key(cell)) ?? 0) + weight);
          }
        }
      }
    }
  }

  let best = 0;
  let bestCells: Coord[] = [];
  for (const cell of free) {
    const value = score.get(key(cell)) ?? 0;
    if (value > best) {
      best = value;
      bestCells = [cell];
    } else if (value === best && value > 0) {
      bestCells.push(cell);
    }
  }
  return pick(bestCells, random);
}

/**
 * Вибирає, куди стріляти. Бот бачить лише те, що бачить гравець: свої постріли та потоплені кораблі.
 * `random` передається ззовні, щоб у тестах хід був відтворюваним.
 */
export function chooseShot(
  view: OpponentBoardView,
  difficulty: BotDifficulty,
  random: () => number = Math.random,
): Coord {
  const knowledge = analyze(view);
  const isFree = (cell: Coord): boolean => inBounds(cell) && !knowledge.blocked.has(key(cell));
  const free = allCells().filter(isFree);

  const choice =
    difficulty === 'easy'
      ? pick(free, random)
      : difficulty === 'normal'
        ? chooseNormal(knowledge, free, isFree, random)
        : (chooseHard(knowledge, free, random) ?? pick(free, random));
  if (choice) return choice;

  // Крайній випадок: правила «без дотиків» заблокували все, але нестріляні клітинки ще є.
  const shot = new Set(view.shots.map((s) => key(s.at)));
  const any = pick(
    allCells().filter((cell) => !shot.has(key(cell))),
    random,
  );
  if (!any) throw new Error('No cells left to shoot at');
  return any;
}
