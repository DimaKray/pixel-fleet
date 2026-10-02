# Pixel Fleet

Online battleship in pixel art. Monorepo: pure TypeScript game engine, Socket.IO server, Vue 3 client.

## Structure

- `packages/engine` — game rules, no framework or I/O dependencies
- `apps/server` — authoritative Socket.IO server
- `apps/web` — Vue 3 + Pinia + vue-i18n client

## Run

```bash
npm install
npm run dev     # server on :3001, client on :5173
npm test
```
