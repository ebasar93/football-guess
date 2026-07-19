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
import { ClientMessage, RoomSnapshot, ServerMessage } from '../src/online/protocol';

/** Minimal socket interface so rooms can be tested without real sockets. */
export interface PlayerSocket {
  send(data: string): void;
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
  sockets: [PlayerSocket | null, PlayerSocket | null] = [null, null];
  game: GameState | null = null;
  passed: [boolean, boolean] = [false, false];
  rematchVotes: [boolean, boolean] = [false, false];

  constructor(code: string) {
    this.code = code;
  }

  snapshot(): RoomSnapshot {
    return {
      code: this.code,
      names: this.names,
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

export class RoomManager {
  rooms = new Map<string, Room>();

  create(socket: PlayerSocket, name: string): Room {
    const room = new Room(makeCode((c) => this.rooms.has(c)));
    room.sockets[0] = socket;
    room.names[0] = name;
    this.rooms.set(room.code, room);
    room.sendTo(0, { type: 'joined', youAre: 0, snapshot: room.snapshot() });
    return room;
  }

  join(socket: PlayerSocket, code: string, name: string): Room | null {
    const room = this.rooms.get(code.trim().toUpperCase());
    if (!room || room.sockets[1]) return null;
    room.sockets[1] = socket;
    room.names[1] = name;
    room.game = newGame(room.names);
    room.sendTo(1, { type: 'joined', youAre: 1, snapshot: room.snapshot() });
    room.broadcast();
    return room;
  }

  /** A player's connection dropped: tell the opponent and close the room. */
  leave(room: Room, i: 0 | 1) {
    room.sockets[i] = null;
    room.sendTo(other(i), { type: 'opponentLeft' });
    this.rooms.delete(room.code);
  }
}
