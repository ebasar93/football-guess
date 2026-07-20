import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { League } from '../data/leagues';
import { DEFAULT_RATING, eloUpdate } from '../online/protocol';

export interface Rating {
  /** Current rating for the selected league; DEFAULT_RATING until loaded. */
  rating: number;
  /**
   * Apply the result of an online match. Guarded by matchId so a match
   * is never counted twice (e.g. re-renders of the game-over screen).
   * Returns the new rating, or null if this match was already recorded.
   */
  recordMatch: (matchId: string, oppRating: number, won: boolean) => number | null;
}

/** Per-league Elo rating persisted on the device. */
export function useRating(league: League): Rating {
  const ratingKey = `footballguess.rating.${league}`;
  const lastMatchKey = `footballguess.lastRatedMatch.${league}`;
  const [rating, setRating] = useState(DEFAULT_RATING);
  const lastMatch = useRef<string | null>(null);
  const ratingRef = useRef(rating);
  ratingRef.current = rating;

  useEffect(() => {
    let cancelled = false;
    setRating(DEFAULT_RATING);
    lastMatch.current = null;
    (async () => {
      try {
        const [stored, storedMatch] = await Promise.all([
          AsyncStorage.getItem(ratingKey),
          AsyncStorage.getItem(lastMatchKey),
        ]);
        if (cancelled) return;
        if (stored) {
          const r = Number(stored);
          if (Number.isFinite(r)) setRating(r);
        }
        if (storedMatch) lastMatch.current = storedMatch;
      } catch {
        // storage unavailable: play with the in-memory default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ratingKey, lastMatchKey]);

  const recordMatch = useCallback(
    (matchId: string, oppRating: number, won: boolean): number | null => {
      if (lastMatch.current === matchId) return null;
      lastMatch.current = matchId;
      const next = eloUpdate(ratingRef.current, oppRating, won);
      setRating(next);
      AsyncStorage.multiSet([
        [ratingKey, String(next)],
        [lastMatchKey, matchId],
      ]).catch(() => {});
      return next;
    },
    [ratingKey, lastMatchKey],
  );

  return { rating, recordMatch };
}
