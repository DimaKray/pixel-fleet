import type { ShipType } from '@pixelfleet/engine';

const base = '/assets';

/** Кораблі намальовані збоку, носом праворуч. cells — довжина в клітинках, ratio — ширина/висота файлу. */
export const shipSprites: Record<ShipType, { src: string; cells: number; ratio: number }> = {
  carrier: { src: `${base}/ships/carrier.png`, cells: 5, ratio: 6.9 },
  battleship: { src: `${base}/ships/battleship.png`, cells: 4, ratio: 5.2 },
  cruiser: { src: `${base}/ships/cruiser.png`, cells: 3, ratio: 5.5 },
  submarine: { src: `${base}/ships/submarine.png`, cells: 3, ratio: 6.3 },
  destroyer: { src: `${base}/ships/destroyer.png`, cells: 2, ratio: 4.3 },
};

export const markers = {
  miss: `${base}/markers/miss.png`,
  hit: `${base}/markers/hit.png`,
  sunk: `${base}/markers/sunk.png`,
} as const;

/** 4 кадри води 234x234 і смуга 936x234 для анімації кроками. */
export const sea = {
  frames: [0, 1, 2, 3].map((i) => `${base}/tiles/sea-${i}.png`),
  strip: `${base}/tiles/sea-strip.png`,
  frameSize: 234,
} as const;

export const backgrounds = {
  menu: `${base}/backgrounds/menu.png`,
  battle: `${base}/backgrounds/battle.png`,
} as const;

export const ui = {
  panel: `${base}/ui/panel.png`,
  button: `${base}/ui/button.png`,
  buttonHover: `${base}/ui/button-hover.png`,
  buttonDisabled: `${base}/ui/button-disabled.png`,
  bannerWin: `${base}/ui/banner-win.png`,
  bannerLose: `${base}/ui/banner-lose.png`,
  crosshair: `${base}/ui/crosshair.png`,
} as const;

export const icons = {
  anchor: `${base}/icons/anchor.png`,
  soundOn: `${base}/icons/sound-on.png`,
  soundOff: `${base}/icons/sound-off.png`,
  copy: `${base}/icons/copy.png`,
  surrender: `${base}/icons/surrender.png`,
  timer: `${base}/icons/timer.png`,
  rotate: `${base}/icons/rotate.png`,
  target: `${base}/icons/target.png`,
} as const;

export const portraits = ['captain', 'sailor', 'admiral', 'robot'] as const;
export type PortraitId = (typeof portraits)[number];
export const portraitSrc = (id: PortraitId) => `${base}/portraits/${id}.png`;
