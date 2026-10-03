import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@pixelfleet/protocol';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** У розробці запити йдуть через проксі Vite. Для продакшену задамо VITE_SERVER_URL. */
const url = import.meta.env.VITE_SERVER_URL as string | undefined;

export const socket: GameSocket = url
  ? io(url, { autoConnect: false })
  : io({ autoConnect: false });
