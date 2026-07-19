import {
  buzz,
  commonPlayers,
  GameState,
  newGame,
  nextRound,
  passRound,
  pickTeamA,
  pickTeamB,
  submitGuess,
  teamsWithCommonPlayer,
} from '../src/logic/game';
import { TEAMS } from '../src/data/players';
import {
  ClientMessage,
  DEFAULT_RATING,
  RoomSnapshot,
  ServerMessage,
} from '../src/online/protocol';

/** Minimal socket interface so rooms can be tested without real sockets. */
export interface PlayerSocket {
  send(data: string): void;
}

// Skill-based matchmaking: two searchers pair when their rating gap is
// within a tolerance that widens the longer the older one has waited, so
// close matches are preferred but nobody waits forever. Tunable via env
// for tests.
const BASE_TOLERANCE = Number(process.env.QM_BASE_TOLERANCE) || 200;
const WIDEN_PER_SEC = Number(process.env.QM_WIDEN_PER_SEC) || 100;

export function pairTolerance(waitedMs: number): number {
  return BASE_TOLERANCE + (waitedMs / 1000) * WIDEN_PER_SEC;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion

function makeCode(taken: (code: string) => boolean): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!taken(code)) return code;
  }
}

function other(i: 0 | 1): 0 | 1 {
  return i === 0 ? 1 : 0;
}

export class Room {
  code: string;
  names: [string, string] = ['', ''];
  ratings: [number, number] = [DEFAULT_RATING, DEFAULT_RATING];
  sockets: [PlayerSocket | null, PlayerSocket | null] = [null, null];
  game: GameState | null = null;
  gameNo = 1;
  passed: [boolean, boolean] = [false, false];
  rematchVotes: [boolean, boolean] = [false, false];

  constructor(code: string) {
    this.code = code;
  }

  snapshot(): RoomSnapshot {
    return {
      code: this.code,
      matchId: `${this.code}#${this.gameNo}`,
      names: this.names,
      ratings: this.ratings,
      state: this.game,
      passed: this.passed,
      rematchVotes: this.rematchVotes,
    };
  }

  sendTo(i: 0 | 1, msg: ServerMessage) {
    this.sockets[i]?.send(JSON.stringify(msg));
  }

  broadcast() {
    const msg: ServerMessage = { type: 'state', snapshot: this.snapshot() };
    this.sendTo(0, msg);
    this.sendTo(1, msg);
  }

  /** Apply a message from player `i`. Illegal messages get an error reply. */
  handle(i: 0 | 1, msg: ClientMessage) {
    const fail = (message: string) => this.sendTo(i, { type: 'error', message });
    const g = this.game;

    switch (msg.type) {
      case 'pickTeamA': {
        if (!g || g.phase !== 'pickTeamA') return fail('Not picking a team now.');
        if (g.chooser !== i) return fail('Not your turn to pick.');
        if (!TEAMS.includes(msg.team) || teamsWithCommonPlayer(msg.team).length === 0) {
          return fail('Unknown team.');
        }
        this.game = pickTeamA(g, msg.team);
        break;
      }
      case 'pickTeamB': {
        if (!g || g.phase !== 'pickTeamB' || !g.teamA) return fail('Not picking a team now.');
        if (other(g.chooser) !== i) return fail('Not your turn to pick.');
        if (
          msg.team === g.teamA ||
          !TEAMS.includes(msg.team) ||
          commonPlayers(g.teamA, msg.team).length === 0
        ) {
          return fail('Pick a team that shares a player with the first team.');
        }
        this.game = pickTeamB(g, msg.team);
        break;
      }
      case 'buzz': {
        if (!g || g.phase !== 'buzzer') return; // lost the race; not an error
        this.game = buzz(g, i);
        break;
      }
      case 'guess': {
        if (!g || (g.phase !== 'answer' && g.phase !== 'steal')) return fail('Nothing to answer.');
        if (g.answering !== i) return fail('Not your turn to answer.');
        this.game = submitGuess(g, msg.text);
        break;
      }
      case 'giveUp': {
        if (!g || (g.phase !== 'answer' && g.phase !== 'steal')) return fail('Nothing to answer.');
        if (g.answering !== i) return fail('Not your turn to answer.');
        this.game = submitGuess(g, '');
        break;
      }
      case 'pass': {
        if (!g || g.phase !== 'buzzer') return fail('Nothing to pass.');
        this.passed[i] = true;
        if (this.passed[0] && this.passed[1]) {
          this.game = passRound(g);
          this.passed = [false, false];
        }
        break;
      }
      case 'nextRound': {
        if (!g || g.phase !== 'roundResult') return; // second tap; ignore
        this.game = nextRound(g);
        this.passed = [false, false];
        break;
      }
      case 'rematch': {
        if (!g || g.phase !== 'gameOver') return fail('The match is still on.');
        this.rematchVotes[i] = true;
        if (this.rematchVotes[0] && this.rematchVotes[1]) {
          this.game = newGame(this.names);
          this.gameNo += 1;
          this.rematchVotes = [false, false];
          this.passed = [false, false];
        }
        break;
      }
      default:
        return fail('Unexpected message.');
    }
    this.broadcast();
  }
}

interface QueueEntry {
  socket: PlayerSocket;
  name: string;
  rating: number;
  since: number;
}

export class RoomManager {
  rooms = new Map<string, Room>();
  /** Players waiting for a public quick match, oldest first. */
  queue: QueueEntry[] = [];
  /** Total connected clients; wired up by the server entry point. */
  onlineCount: () => number = () => this.queue.length;

  create(socket: PlayerSocket, name: string, rating: number): Room {
    const room = new Room(makeCode((c) => this.rooms.has(c)));
    room.sockets[0] = socket;
    room.names[0] = name;
    room.ratings[0] = rating;
    this.rooms.set(room.code, room);
    room.sendTo(0, { type: 'joined', youAre: 0, snapshot: room.snapshot() });
    return room;
  }

  join(socket: PlayerSocket, code: string, name: string, rating: number): Room | null {
    const room = this.rooms.get(code.trim().toUpperCase());
    if (!room || room.sockets[1]) return null;
    room.sockets[1] = socket;
    room.names[1] = name;
    room.ratings[1] = rating;
    room.game = newGame(room.names);
    room.sendTo(1, { type: 'joined', youAre: 1, snapshot: room.snapshot() });
    room.broadcast();
    return room;
  }

  private pairUp(a: QueueEntry, b: QueueEntry): Room {
    const room = new Room(makeCode((c) => this.rooms.has(c)));
    room.sockets[0] = a.socket;
    room.names[0] = a.name;
    room.ratings[0] = a.rating;
    room.sockets[1] = b.socket;
    room.names[1] = b.name;
    room.ratings[1] = b.rating;
    room.game = newGame(room.names);
    this.rooms.set(room.code, room);
    room.sendTo(0, { type: 'joined', youAre: 0, snapshot: room.snapshot() });
    room.sendTo(1, { type: 'joined', youAre: 1, snapshot: room.snapshot() });
    return room;
  }

  private sendSearching(entry: QueueEntry) {
    entry.socket.send(
      JSON.stringify({
        type: 'searching',
        online: this.onlineCount(),
      } satisfies ServerMessage),
    );
  }

  /**
   * Public matchmaking: pair with the closest-rated waiting player whose
   * rating gap fits the (wait-widened) tolerance, otherwise wait in the
   * queue. Returns the room when a match was made (the caller is player
   * 1, the waiting player is player 0), null while waiting.
   */
  quickMatch(socket: PlayerSocket, name: string, rating: number): Room | null {
    this.cancelQuickMatch(socket); // no duplicate queue entries
    const now = Date.now();
    let best: QueueEntry | null = null;
    for (const e of this.queue) {
      const gap = Math.abs(e.rating - rating);
      if (gap > pairTolerance(now - e.since)) continue;
      if (!best || gap < Math.abs(best.rating - rating)) best = e;
    }
    if (best) {
      this.queue = this.queue.filter((e) => e !== best);
      return this.pairUp(best, { socket, name, rating, since: now });
    }
    const entry: QueueEntry = { socket, name, rating, since: now };
    this.queue.push(entry);
    this.sendSearching(entry);
    return null;
  }

  /**
   * Periodic pass: pair queued players whose tolerances have widened
   * enough, and refresh the online count for everyone still waiting.
   * Returns the rooms created so the server can wire up its sessions.
   */
  sweepQueue(): Room[] {
    const created: Room[] = [];
    const now = Date.now();
    let matched = true;
    while (matched && this.queue.length >= 2) {
      matched = false;
      outer: for (let i = 0; i < this.queue.length; i++) {
        for (let j = i + 1; j < this.queue.length; j++) {
          const a = this.queue[i];
          const b = this.queue[j];
          const waited = Math.max(now - a.since, now - b.since);
          if (Math.abs(a.rating - b.rating) <= pairTolerance(waited)) {
            this.queue = this.queue.filter((e) => e !== a && e !== b);
            created.push(this.pairUp(a, b));
            matched = true;
            break outer;
          }
        }
      }
    }
    for (const e of this.queue) this.sendSearching(e);
    return created;
  }

  cancelQuickMatch(socket: PlayerSocket) {
    this.queue = this.queue.filter((e) => e.socket !== socket);
  }

  /** A player's connection dropped: tell the opponent and close the room. */
  leave(room: Room, i: 0 | 1) {
    room.sockets[i] = null;
    room.sendTo(other(i), { type: 'opponentLeft' });
    this.rooms.delete(room.code);
  }
}
