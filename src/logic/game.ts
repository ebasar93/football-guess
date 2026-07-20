import { League, LEAGUES } from '../data/leagues';
import { PlayerRecord } from '../data/players';

export const WINNING_SCORE = 3;

/**
 * Normalize a name for comparison: lowercase, strip diacritics,
 * collapse whitespace. Handles Turkish dotless ı and similar letters
 * that NFD decomposition alone doesn't map to ASCII.
 */
export function normalizeName(input: string): string {
  return input
    .toLocaleLowerCase('en')
    .replace(/ı/g, 'i')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'd')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Players in the league's dataset who played for both clubs. */
export function commonPlayers(
  teamA: string,
  teamB: string,
  league: League = 'football',
): PlayerRecord[] {
  return LEAGUES[league].players.filter(
    (p) => p.clubs.includes(teamA) && p.clubs.includes(teamB),
  );
}

/** Teams that share at least one player with `team` (excluding itself). */
export function teamsWithCommonPlayer(team: string, league: League = 'football'): string[] {
  return LEAGUES[league].teams.filter(
    (other) => other !== team && commonPlayers(team, other, league).length > 0,
  );
}

/**
 * Check a typed guess against the set of valid connecting players.
 * Accepts a full-name match, or a match on the final word of the name
 * (surname) when it is 3+ characters, or a single-word player name.
 * Returns the matched player, or null if the guess is wrong.
 */
export function checkGuess(
  guess: string,
  candidates: PlayerRecord[],
): PlayerRecord | null {
  const g = normalizeName(guess);
  if (g.length < 2) return null;
  for (const p of candidates) {
    const full = normalizeName(p.name);
    if (g === full) return p;
    const parts = full.split(' ');
    const surname = parts[parts.length - 1];
    if (parts.length > 1 && surname.length >= 3 && g === surname) return p;
    // Any distinctive single token works too: "lebron", "cristiano", "hakan".
    if (parts.length > 1 && g.length >= 4 && parts.includes(g)) return p;
    // Multi-word subsets like "van persie" for "robin van persie".
    if (parts.length > 2 && full.includes(g) && g.length >= 4) return p;
  }
  return null;
}

export type Phase =
  | 'pickTeamA' // round chooser picks the first team
  | 'pickTeamB' // other player picks the second team
  | 'buzzer' // both teams shown; first player to buzz answers
  | 'answer' // buzzed player types a guess
  | 'steal' // wrong guess: the other player may answer
  | 'roundResult' // show who scored (or that nobody did)
  | 'gameOver';

export interface GameState {
  playerNames: [string, string];
  league: League;
  scores: [number, number];
  round: number;
  /** Index of the player who picks the first team this round. */
  chooser: 0 | 1;
  phase: Phase;
  teamA: string | null;
  teamB: string | null;
  /** Player currently answering (buzzer winner, then stealer). */
  answering: 0 | 1 | null;
  /** Result of the last round, for the result screen. */
  lastResult: {
    scorer: 0 | 1 | null;
    matchedPlayer: string | null;
    validAnswers: string[];
  } | null;
  winner: 0 | 1 | null;
}

export function newGame(names: [string, string], league: League = 'football'): GameState {
  return {
    playerNames: names,
    league,
    scores: [0, 0],
    round: 1,
    chooser: 0,
    phase: 'pickTeamA',
    teamA: null,
    teamB: null,
    answering: null,
    lastResult: null,
    winner: null,
  };
}

export function pickTeamA(state: GameState, team: string): GameState {
  return { ...state, teamA: team, phase: 'pickTeamB' };
}

export function pickTeamB(state: GameState, team: string): GameState {
  return { ...state, teamB: team, phase: 'buzzer' };
}

export function buzz(state: GameState, player: 0 | 1): GameState {
  return { ...state, answering: player, phase: 'answer' };
}

function other(player: 0 | 1): 0 | 1 {
  return player === 0 ? 1 : 0;
}

function withPoint(state: GameState, scorer: 0 | 1, matched: PlayerRecord): GameState {
  const scores: [number, number] = [...state.scores];
  scores[scorer] += 1;
  const valid = commonPlayers(state.teamA!, state.teamB!, state.league).map((p) => p.name);
  const won = scores[scorer] >= WINNING_SCORE;
  return {
    ...state,
    scores,
    phase: won ? 'gameOver' : 'roundResult',
    winner: won ? scorer : null,
    lastResult: { scorer, matchedPlayer: matched.name, validAnswers: valid },
  };
}

/** Submit a guess for whoever is answering. */
export function submitGuess(state: GameState, guess: string): GameState {
  if (state.answering === null || !state.teamA || !state.teamB) return state;
  const candidates = commonPlayers(state.teamA, state.teamB, state.league);
  const matched = checkGuess(guess, candidates);
  if (matched) return withPoint(state, state.answering, matched);
  if (state.phase === 'answer') {
    // Wrong first answer: the other player may steal.
    return { ...state, answering: other(state.answering), phase: 'steal' };
  }
  // Wrong steal too: nobody scores this round.
  return {
    ...state,
    phase: 'roundResult',
    answering: null,
    lastResult: {
      scorer: null,
      matchedPlayer: null,
      validAnswers: candidates.map((p) => p.name),
    },
  };
}

/** Both players give up without buzzing. */
export function passRound(state: GameState): GameState {
  const valid =
    state.teamA && state.teamB
      ? commonPlayers(state.teamA, state.teamB, state.league).map((p) => p.name)
      : [];
  return {
    ...state,
    phase: 'roundResult',
    answering: null,
    lastResult: { scorer: null, matchedPlayer: null, validAnswers: valid },
  };
}

/** The player answering gives up; treated like a wrong answer. */
export function giveUp(state: GameState): GameState {
  return submitGuess(state, '');
}

export function nextRound(state: GameState): GameState {
  if (state.phase === 'gameOver') return state;
  return {
    ...state,
    round: state.round + 1,
    chooser: other(state.chooser),
    phase: 'pickTeamA',
    teamA: null,
    teamB: null,
    answering: null,
  };
}
