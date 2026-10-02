import { io } from 'socket.io-client';

/** Один спільний сокет на весь клієнт. Підключаємось вручну, коли потрібно. */
export const socket = io({ autoConnect: false });
