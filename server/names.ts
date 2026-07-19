import { normalizeName } from '../src/logic/game';

// Quick-match opponents are strangers, so display names get a basic
// profanity screen (English + Turkish). Long unambiguous terms are
// blocked as substrings; short terms only as whole words to avoid
// false positives (e.g. Turkish "klasik" contains "sik").
const BANNED_SUBSTRINGS = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'nigger', 'nigga',
  'faggot', 'whore', 'slut', 'dickhead', 'wanker', 'retard',
  'orospu', 'yarrak', 'sikerim', 'siktir', 'amina koy', 'amk', 'pezevenk',
  'kahpe', 'surtuk', 'ibne', 'gavat', 'amcik',
];
const BANNED_WORDS = [
  'dick', 'cock', 'pussy', 'twat', 'prick',
  'sik', 'am', 'got', 'pic', 'aq', 'oc', 'mk',
];

export function isCleanName(name: string): boolean {
  const n = normalizeName(name);
  if (BANNED_SUBSTRINGS.some((b) => n.includes(b))) return false;
  const words = n.split(/[\s'-]+/);
  return !BANNED_WORDS.some((b) => words.includes(b));
}

/** Trim, cap length, and replace empty or profane names with a default. */
export function sanitizeName(raw: unknown): string {
  const name = String(raw ?? '').trim().slice(0, 20);
  if (!name || !isCleanName(name)) return 'Player';
  return name;
}

export function sanitizeRating(raw: unknown): number {
  const r = Number(raw);
  if (!Number.isFinite(r)) return 1000;
  return Math.min(4000, Math.max(100, Math.round(r)));
}
