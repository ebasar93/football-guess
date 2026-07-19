// Football Guess online game server.
//   cd server && npm install && npm start   (listens on PORT, default 8080)
import { WebSocket, WebSocketServer } from 'ws';
import { ClientMessage } from '../src/online/protocol';
import { sanitizeName, sanitizeRating } from './names';
import { Room, RoomManager } from './rooms';

const PORT = Number(process.env.PORT) || 8080;
const SWEEP_MS = Number(process.env.QM_SWEEP_MS) || 3000;
const manager = new RoomManager();

interface Session {
  room: Room | null;
  idx: 0 | 1;
}

type LiveSocket = WebSocket & { isAlive?: boolean };

const sessions = new Map<WebSocket, Session>();

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws: LiveSocket) => {
  const session: Session = { room: null, idx: 0 };
  sessions.set(ws, session);
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message.' }));
      return;
    }

    if (msg.type === 'create') {
      if (session.room) return;
      session.room = manager.create(ws, sanitizeName(msg.name), sanitizeRating(msg.rating));
      session.idx = 0;
      return;
    }
    if (msg.type === 'join') {
      if (session.room) return;
      const room = manager.join(ws, msg.code, sanitizeName(msg.name), sanitizeRating(msg.rating));
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found or already full.' }));
        return;
      }
      session.room = room;
      session.idx = 1;
      return;
    }
    if (msg.type === 'quickMatch') {
      if (session.room) return;
      const room = manager.quickMatch(ws, sanitizeName(msg.name), sanitizeRating(msg.rating));
      if (room) bindRoomSessions(room);
      return;
    }
    if (msg.type === 'cancelQuickMatch') {
      manager.cancelQuickMatch(ws);
      return;
    }
    if (session.room) session.room.handle(session.idx, msg);
  });

  ws.on('close', () => {
    manager.cancelQuickMatch(ws);
    if (session.room) manager.leave(session.room, session.idx);
    session.room = null;
    sessions.delete(ws);
  });
});

/** Point both matched sockets' sessions at their new room. */
function bindRoomSessions(room: Room) {
  ([0, 1] as const).forEach((idx) => {
    const s = sessions.get(room.sockets[idx] as WebSocket);
    if (s) {
      s.room = room;
      s.idx = idx;
    }
  });
}

manager.onlineCount = () => wss.clients.size;

// Pair queued players whose tolerances have widened, refresh online counts.
const sweeper = setInterval(() => {
  for (const room of manager.sweepQueue()) bindRoomSessions(room);
}, SWEEP_MS);
wss.on('close', () => clearInterval(sweeper));

// Drop dead connections so abandoned rooms get cleaned up.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients as Set<LiveSocket>) {
    if (ws.isAlive === false) {
      ws.terminate(); // triggers 'close', which tears down the room
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

console.log(`Football Guess server listening on port ${PORT}`);
