import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_RATING, eloUpdate } from '../online/protocol';

const RATING_KEY = 'footballguess.rating';
const LAST_MATCH_KEY = 'footballguess.lastRatedMatch';

export interface Rating {
  /** Current rating; DEFAULT_RATING until storage has loaded. */
  rating: number;
  /**
   * Apply the result of an online match. Guarded by matchId so a match
   * is never counted twice (e.g. re-renders of the game-over screen).
   * Returns the new rating, or null if this match was already recorded.
   */
  recordMatch: (matchId: string, oppRating: number, won: boolean) => number | null;
}

export function useRating(): Rating {
  const [rating, setRating] = useState(DEFAULT_RATING);
  const lastMatch = useRef<string | null>(null);
  const ratingRef = useRef(rating);
  ratingRef.current = rating;

  useEffect(() => {
    (async () => {
      try {
        const [stored, storedMatch] = await Promise.all([
          AsyncStorage.getItem(RATING_KEY),
          AsyncStorage.getItem(LAST_MATCH_KEY),
        ]);
        if (stored) {
          const r = Number(stored);
          if (Number.isFinite(r)) setRating(r);
        }
        if (storedMatch && lastMatch.current === null) lastMatch.current = storedMatch;
      } catch {
        // storage unavailable: play with the in-memory default
      }
    })();
  }, []);

  const recordMatch = useCallback(
    (matchId: string, oppRating: number, won: boolean): number | null => {
      if (lastMatch.current === matchId) return null;
      lastMatch.current = matchId;
      const next = eloUpdate(ratingRef.current, oppRating, won);
      setRating(next);
      AsyncStorage.multiSet([
        [RATING_KEY, String(next)],
        [LAST_MATCH_KEY, matchId],
      ]).catch(() => {});
      return next;
    },
    [],
  );

  return { rating, recordMatch };
}
