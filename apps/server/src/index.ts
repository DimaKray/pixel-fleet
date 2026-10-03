import type { RoomConfig } from './rooms.js';
import { createGameServer } from './server.js';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

function positiveNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

const config: Partial<RoomConfig> = {};
const turnMs = positiveNumber('TURN_MS');
const graceMs = positiveNumber('GRACE_MS');
const roomTtlMs = positiveNumber('ROOM_TTL_MS');
if (turnMs) config.turnMs = turnMs;
if (graceMs) config.graceMs = graceMs;
if (roomTtlMs) config.roomTtlMs = roomTtlMs;

const { httpServer } = createGameServer({ clientOrigin: CLIENT_ORIGIN, config });

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
