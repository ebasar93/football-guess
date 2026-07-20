import { PlayerRecord, PLAYERS as FOOTBALL_PLAYERS, TEAMS as FOOTBALL_TEAMS } from './players';
import { NBA_PLAYERS, NBA_TEAMS } from './nba';

export type League = 'football' | 'nba';

export interface LeagueInfo {
  label: string;
  emoji: string;
  players: PlayerRecord[];
  teams: string[];
}

export const LEAGUES: Record<League, LeagueInfo> = {
  football: {
    label: 'Football',
    emoji: '⚽',
    players: FOOTBALL_PLAYERS,
    teams: FOOTBALL_TEAMS,
  },
  nba: {
    label: 'NBA',
    emoji: '🏀',
    players: NBA_PLAYERS,
    teams: NBA_TEAMS,
  },
};

export const DEFAULT_LEAGUE: League = 'football';

export function sanitizeLeague(raw: unknown): League {
  return raw === 'nba' ? 'nba' : 'football';
}
