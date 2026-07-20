// Smoke tests for the game logic (no test framework needed): npm test
import {
  buzz,
  checkGuess,
  commonPlayers,
  newGame,
  nextRound,
  normalizeName,
  passRound,
  pickTeamA,
  pickTeamB,
  submitGuess,
  teamsWithCommonPlayer,
  WINNING_SCORE,
} from './game';
import { PLAYERS, TEAMS } from '../data/players';
import { NBA_PLAYERS, NBA_TEAMS } from '../data/nba';
import { eloUpdate } from '../online/protocol';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  }
}

// ── data sanity ──────────────────────────────────────────────────
assert(PLAYERS.length >= 100, `dataset has ${PLAYERS.length} players (want 100+)`);
assert(TEAMS.length >= 50, `dataset has ${TEAMS.length} teams (want 50+)`);
const names = new Set(PLAYERS.map((p) => p.name));
assert(names.size === PLAYERS.length, 'player names are unique');
for (const p of PLAYERS) {
  assert(new Set(p.clubs).size === p.clubs.length, `${p.name} has duplicate clubs`);
}
// Every team should be playable: at least one partner team with a common player.
for (const t of TEAMS) {
  assert(teamsWithCommonPlayer(t).length > 0, `team "${t}" has no playable partner`);
}

// ── normalization & matching ─────────────────────────────────────
assert(normalizeName('Zlatan Ibrahimović') === 'zlatan ibrahimovic', 'strips diacritics');
assert(normalizeName('Hakan ŞÜKÜR') === 'hakan sukur', 'handles Turkish letters');
assert(normalizeName('  KAKÁ ') === 'kaka', 'trims and lowercases');

const gsInter = commonPlayers('Galatasaray', 'Inter');
assert(gsInter.some((p) => p.name === 'Wesley Sneijder'), 'Sneijder links GS and Inter');
assert(checkGuess('sneijder', gsInter)?.name === 'Wesley Sneijder', 'surname match');
assert(checkGuess('Wesley Sneijder', gsInter)?.name === 'Wesley Sneijder', 'full name match');
assert(checkGuess('hakan sukur', gsInter)?.name === 'Hakan Şükür', 'diacritic-free full name');
assert(checkGuess('messi', gsInter) === null, 'wrong player rejected');
assert(checkGuess('', gsInter) === null, 'empty guess rejected');

const uclReal = commonPlayers('Manchester United', 'Real Madrid');
assert(checkGuess('ronaldo', uclReal) !== null, 'ronaldo matches Cristiano Ronaldo');

// ── game flow: full match ────────────────────────────────────────
let g = newGame(['Emir', 'Ayşe']);
assert(g.phase === 'pickTeamA' && g.chooser === 0, 'game starts with player 1 picking');

g = pickTeamA(g, 'Galatasaray');
g = pickTeamB(g, 'Inter');
assert(g.phase === 'buzzer', 'both teams picked -> buzzer phase');

g = buzz(g, 1);
assert(g.phase === 'answer' && g.answering === 1, 'player 2 buzzed in');

g = submitGuess(g, 'Sneijder');
assert(g.scores[1] === 1 && g.phase === 'roundResult', 'correct guess scores a point');
assert(g.lastResult?.scorer === 1, 'round result records scorer');

g = nextRound(g);
assert(g.round === 2 && g.chooser === 1, 'chooser alternates each round');

// Wrong answer then steal.
g = pickTeamA(g, 'Chelsea');
g = pickTeamB(g, 'Arsenal');
g = buzz(g, 0);
g = submitGuess(g, 'Messi');
assert(g.phase === 'steal' && g.answering === 1, 'wrong answer passes to steal');
g = submitGuess(g, 'Petr Cech');
assert(g.scores[1] === 2, 'steal scores a point');

// Wrong steal too: nobody scores.
g = nextRound(g);
g = pickTeamA(g, 'Liverpool');
g = pickTeamB(g, 'Barcelona');
g = buzz(g, 0);
g = submitGuess(g, 'nobody');
g = submitGuess(g, 'nobody again');
assert(g.phase === 'roundResult' && g.lastResult?.scorer === null, 'double miss = no score');
assert(g.lastResult!.validAnswers.length > 0, 'valid answers revealed');

// Pass a round.
g = nextRound(g);
g = pickTeamA(g, 'Milan');
g = pickTeamB(g, 'Juventus');
g = passRound(g);
assert(g.phase === 'roundResult' && g.lastResult?.scorer === null, 'pass ends round scoreless');

// Win the match.
g = nextRound(g);
g = pickTeamA(g, 'Real Madrid');
g = pickTeamB(g, 'Fenerbahçe');
g = buzz(g, 1);
g = submitGuess(g, 'Roberto Carlos');
assert(g.scores[1] === WINNING_SCORE, 'third point reached');
assert(g.phase === 'gameOver' && g.winner === 1, 'first to 3 wins the game');

// ── NBA league ───────────────────────────────────────────────────
assert(NBA_PLAYERS.length >= 120, `NBA dataset has ${NBA_PLAYERS.length} players (want 120+)`);
assert(NBA_TEAMS.length >= 30, `NBA dataset has ${NBA_TEAMS.length} teams (want 30+)`);
const nbaNames = new Set(NBA_PLAYERS.map((p) => p.name));
assert(nbaNames.size === NBA_PLAYERS.length, 'NBA player names are unique');
for (const p of NBA_PLAYERS) {
  assert(new Set(p.clubs).size === p.clubs.length, `${p.name} has duplicate teams`);
}
for (const t of NBA_TEAMS) {
  assert(teamsWithCommonPlayer(t, 'nba').length > 0, `NBA team "${t}" has no playable partner`);
}
// League separation: football helpers never leak NBA teams and vice versa.
assert(commonPlayers('Lakers', 'Heat').length === 0, 'football league ignores NBA teams');

const lakersHeat = commonPlayers('Lakers', 'Heat', 'nba');
assert(lakersHeat.some((p) => p.name === 'LeBron James'), 'LeBron links Lakers and Heat');
assert(lakersHeat.some((p) => p.name === "Shaquille O'Neal"), 'Shaq links Lakers and Heat');
assert(checkGuess('lebron', lakersHeat)?.name === 'LeBron James', 'first-name token matches');
assert(checkGuess('curry', lakersHeat) === null, 'wrong NBA player rejected');

// A short NBA match reaches game over like football does.
let nba = newGame(['A', 'B'], 'nba');
assert(nba.league === 'nba', 'game state carries the league');
nba = pickTeamA(nba, 'Lakers');
nba = pickTeamB(nba, 'Heat');
nba = buzz(nba, 0);
nba = submitGuess(nba, 'Gary Payton');
assert(nba.scores[0] === 1, 'NBA guesses validate against the NBA dataset');

// ── Elo rating math ──────────────────────────────────────────────
assert(eloUpdate(1000, 1000, true) === 1016, 'even-match win gains 16');
assert(eloUpdate(1000, 1000, false) === 984, 'even-match loss drops 16');
assert(eloUpdate(1000, 1400, true) > 1016, 'beating a stronger player gains more');
assert(eloUpdate(1000, 600, false) < 984, 'losing to a weaker player costs more');
assert(eloUpdate(100, 2000, false) === 100, 'rating never falls below the floor');

if (failures === 0) {
  console.log('All tests passed.');
} else {
  console.error(`${failures} test(s) failed.`);
  process.exit(1);
}
