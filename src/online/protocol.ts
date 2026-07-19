import { GameState } from '../logic/game';

/** Messages the app sends to the game server. */
export type ClientMessage =
  | { type: 'create'; name: string; rating?: number }
  | { type: 'join'; code: string; name: string; rating?: number }
  | { type: 'quickMatch'; name: string; rating?: number }
  | { type: 'cancelQuickMatch' }
  | { type: 'pickTeamA'; team: string }
  | { type: 'pickTeamB'; team: string }
  | { type: 'buzz' }
  | { type: 'guess'; text: string }
  | { type: 'giveUp' }
  | { type: 'pass' }
  | { type: 'nextRound' }
  | { type: 'rematch' };

export const DEFAULT_RATING = 1000;

export interface RoomSnapshot {
  code: string;
  /** Unique id for the current game in this room (changes on rematch). */
  matchId: string;
  names: [string, string];
  /** Each player's rating when they connected (used for Elo updates). */
  ratings: [number, number];
  /** null while waiting for the second player to join. */
  state: GameState | null;
  /** Who has voted to skip the current buzzer round. */
  passed: [boolean, boolean];
  /** Who has voted for a rematch after game over. */
  rematchVotes: [boolean, boolean];
}

/** Messages the game server sends to the app. */
export type ServerMessage =
  | { type: 'searching'; online: number } // in the quick-match queue
  | { type: 'joined'; youAre: 0 | 1; snapshot: RoomSnapshot }
  | { type: 'state'; snapshot: RoomSnapshot }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string };

/**
 * Elo rating update, K=32. Returns the player's new rating.
 * Only depends on both starting ratings and whether the player won,
 * so both clients compute their own update independently.
 */
export function eloUpdate(myRating: number, oppRating: number, iWon: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
  const score = iWon ? 1 : 0;
  return Math.max(100, Math.round(myRating + 32 * (score - expected)));
}
