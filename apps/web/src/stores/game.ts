import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { GameView, PlacedShip, PlayerId } from '@pixelfleet/engine';
import type {
  ActionAck,
  ErrorCode,
  Presence,
  ResumeAck,
  SeatAck,
  WireError,
} from '@pixelfleet/protocol';
import { socket } from '@/lib/socket';
import { useSessionStore } from './session';
import { soundsForTransition } from '@/lib/cues';
import { playCues } from '@/lib/sound';
import { useSettingsStore } from './settings';

export type ClientError = WireError | { code: 'network' };
export type SessionResult = { ok: true; code: string } | { ok: false; error: ClientError };
export type ActionResult = { ok: true } | { ok: false; error: ClientError };
export type ErrorKey = ErrorCode | 'network';

const NETWORK_FAILURE = { ok: false, error: { code: 'network' } } as const;
type NetworkFailure = typeof NETWORK_FAILURE;

const REQUEST_TIMEOUT_MS = 8000;
const CONNECT_TIMEOUT_MS = 5000;

/** Перетворює emit із колбеком на проміс, який не зависає назавжди. */
function request<T>(send: (callback: (reply: T) => void) => void): Promise<T | NetworkFailure> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(NETWORK_FAILURE), REQUEST_TIMEOUT_MS);
    send((reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
  });
}

function ensureConnected(): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);

  return new Promise((resolve) => {
    const finish = (ok: boolean): void => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      resolve(ok);
    };
    const onConnect = (): void => finish(true);
    const onError = (): void => finish(false);
    const timer = setTimeout(() => finish(false), CONNECT_TIMEOUT_MS);

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  });
}

export const useGameStore = defineStore('game', () => {
  const session = useSessionStore();
  const settings = useSettingsStore();

  const connected = ref(socket.connected);
  const code = ref<string | null>(null);
  const player = ref<PlayerId | null>(null);
  const view = ref<GameView | null>(null);
  const opponentPresence = ref<Presence>('empty');
  /** Момент (за годинником клієнта), коли закінчиться час на хід. */
  const turnDeadline = ref<number | null>(null);
  const rematch = ref({ you: false, opponent: false });

  function reset(): void {
    session.clearToken();
    code.value = null;
    player.value = null;
    view.value = null;
    opponentPresence.value = 'empty';
    turnDeadline.value = null;
    rematch.value = { you: false, opponent: false };
  }

  function adopt(reply: SeatAck | ResumeAck | NetworkFailure): SessionResult {
    if (!reply.ok) return { ok: false, error: reply.error };

    code.value = reply.code;
    player.value = reply.player;
    if ('token' in reply) session.setToken(reply.token);
    return { ok: true, code: reply.code };
  }

  async function createRoom(): Promise<SessionResult> {
    if (!(await ensureConnected())) return NETWORK_FAILURE;
    return adopt(await request<SeatAck>((cb) => socket.emit('room:create', cb)));
  }

  async function joinRoom(roomCode: string): Promise<SessionResult> {
    if (!(await ensureConnected())) return NETWORK_FAILURE;
    return adopt(await request<SeatAck>((cb) => socket.emit('room:join', { code: roomCode }, cb)));
  }

  /** Повернення за токеном: після перезавантаження сторінки або втрати зв'язку. */
  async function resume(): Promise<SessionResult> {
    const token = session.playerToken;
    if (!token) return { ok: false, error: { code: 'unknown_token' } };
    if (!(await ensureConnected())) return NETWORK_FAILURE;

    const reply = await request<ResumeAck>((cb) => socket.emit('room:resume', { token }, cb));
    // Сервер перезапустили або кімнату видалено: токен більше нічого не означає.
    if (!reply.ok && reply.error.code === 'unknown_token') reset();
    return adopt(reply);
  }

  async function placeFleet(ships: readonly PlacedShip[]): Promise<ActionResult> {
    return request<ActionAck>((cb) => socket.emit('fleet:place', { ships: [...ships] }, cb));
  }

  async function fire(x: number, y: number): Promise<ActionResult> {
    return request<ActionAck>((cb) => socket.emit('shot:fire', { x, y }, cb));
  }

  async function resign(): Promise<ActionResult> {
    return request<ActionAck>((cb) => socket.emit('game:resign', cb));
  }

  async function requestRematch(): Promise<ActionResult> {
    return request<ActionAck>((cb) => socket.emit('game:rematch', cb));
  }

  function leave(): void {
    reset();
    socket.disconnect();
  }

  socket.on('game:state', (next) => {
    playCues(soundsForTransition(view.value, next), settings.muted);
    view.value = next;
  });
  socket.on('room:meta', (meta) => {
    // Сервер шле скільки лишилось, а не абсолютний час: годинники клієнта й сервера можуть різнитися.
    turnDeadline.value = meta.turnRemainingMs === null ? null : Date.now() + meta.turnRemainingMs;
    rematch.value = meta.rematch;
  });
  socket.on('opponent:presence', (status) => {
    opponentPresence.value = status;
  });
  socket.on('disconnect', () => {
    connected.value = false;
  });
  socket.on('connect', () => {
    connected.value = true;
    // Зв'язок відновився посеред гри: займаємо своє місце знову.
    if (code.value && session.playerToken) void resume();
  });

  return {
    connected,
    code,
    player,
    view,
    opponentPresence,
    turnDeadline,
    rematch,
    createRoom,
    joinRoom,
    resume,
    placeFleet,
    fire,
    resign,
    requestRematch,
    leave,
  };
});
