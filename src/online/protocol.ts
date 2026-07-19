import { GameState } from '../logic/game';

/** Messages the app sends to the game server. */
export type ClientMessage =
  | { type: 'create'; name: string }
  | { type: 'join'; code: string; name: string }
  | { type: 'pickTeamA'; team: string }
  | { type: 'pickTeamB'; team: string }
  | { type: 'buzz' }
  | { type: 'guess'; text: string }
  | { type: 'giveUp' }
  | { type: 'pass' }
  | { type: 'nextRound' }
  | { type: 'rematch' };

export interface RoomSnapshot {
  code: string;
  names: [string, string];
  /** null while waiting for the second player to join. */
  state: GameState | null;
  /** Who has voted to skip the current buzzer round. */
  passed: [boolean, boolean];
  /** Who has voted for a rematch after game over. */
  rematchVotes: [boolean, boolean];
}

/** Messages the game server sends to the app. */
export type ServerMessage =
  | { type: 'joined'; youAre: 0 | 1; snapshot: RoomSnapshot }
  | { type: 'state'; snapshot: RoomSnapshot }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string };
