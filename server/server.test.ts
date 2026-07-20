// End-to-end test: starts the real server logic on a random port and plays
// a full online match with two WebSocket clients.  cd server && npm test
import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import { RoomSnapshot, ServerMessage } from '../src/online/protocol';

const PORT = 8123 + Math.floor(Math.random() * 1000);

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  }
}

/** Test client that queues server messages so the test can await them. */
class Client {
  ws: WebSocket;
  youAre: 0 | 1 | null = null;
  private queue: ServerMessage[] = [];
  private waiters: ((m: ServerMessage) => void)[] = [];

  constructor() {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      if (msg.type === 'joined') this.youAre = msg.youAre;
      const waiter = this.waiters.shift();
      if (waiter) waiter(msg);
      else this.queue.push(msg);
    });
  }

  open(): Promise<void> {
    // The 'open' event may have fired before this is called (e.g. a client
    // constructed earlier in the test) -- check readyState first.
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((res, rej) => {
      this.ws.once('open', () => res());
      this.ws.once('error', rej);
    });
  }

  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }

  next(timeoutMs = 4000): Promise<ServerMessage> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timed out waiting for message')), timeoutMs);
      this.waiters.push((m) => {
        clearTimeout(t);
        res(m);
      });
    });
  }

  /** Wait until a state snapshot satisfying `pred` arrives. */
  async until(pred: (s: RoomSnapshot) => boolean): Promise<RoomSnapshot> {
    for (let i = 0; i < 30; i++) {
      const msg = await this.next();
      const snap =
        msg.type === 'state' || msg.type === 'joined' ? msg.snapshot : null;
      if (snap && pred(snap)) return snap;
    }
    throw new Error('condition never satisfied');
  }

  /** Wait until an error message arrives, skipping state broadcasts. */
  async untilError(): Promise<string> {
    for (let i = 0; i < 30; i++) {
      const msg = await this.next();
      if (msg.type === 'error') return msg.message;
    }
    throw new Error('no error message arrived');
  }
}

async function main() {
  const server = spawn('npx', ['tsx', 'index.ts'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      // Fast matchmaking widening so the skill-gap test completes quickly.
      QM_WIDEN_PER_SEC: '2000',
      QM_SWEEP_MS: '300',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((res, rej) => {
    server.stdout.on('data', (d: Buffer) => {
      if (d.toString().includes('listening')) res();
    });
    server.on('exit', () => rej(new Error('server exited early')));
    setTimeout(() => rej(new Error('server start timeout')), 15000);
  });

  try {
    const alice = new Client();
    await alice.open();
    alice.send({ type: 'create', name: 'Alice' });
    const joined = await alice.next();
    assert(joined.type === 'joined', 'creator receives joined');
    const code = joined.type === 'joined' ? joined.snapshot.code : '';
    assert(/^[A-Z]{4}$/.test(code), `room code looks valid (${code})`);
    assert(joined.type === 'joined' && joined.snapshot.state === null, 'game waits for player 2');

    // Joining a bogus room fails.
    const nosy = new Client();
    await nosy.open();
    nosy.send({ type: 'join', code: 'ZZZZ', name: 'Nosy' });
    const nope = await nosy.next();
    assert(nope.type === 'error', 'joining unknown room errors');
    nosy.ws.close();

    const bob = new Client();
    await bob.open();
    bob.send({ type: 'join', code, name: 'Bob' });
    await bob.until((s) => s.state !== null);
    let snap = await alice.until((s) => s.state !== null);
    assert(snap.names[0] === 'Alice' && snap.names[1] === 'Bob', 'both names registered');
    assert(snap.state!.phase === 'pickTeamA' && snap.state!.chooser === 0, 'match starts');

    // Round 1: Alice picks, Bob picks, Bob buzzes and scores.
    bob.send({ type: 'pickTeamA', team: 'Galatasaray' }); // not Bob's turn
    assert((await bob.untilError()).length > 0, 'wrong player cannot pick first team');

    alice.send({ type: 'pickTeamA', team: 'Galatasaray' });
    snap = await bob.until((s) => s.state?.phase === 'pickTeamB');
    assert(snap.state!.teamA === 'Galatasaray', 'first team shows for both players');

    bob.send({ type: 'pickTeamB', team: 'Inter' });
    await bob.until((s) => s.state?.phase === 'buzzer');
    await alice.until((s) => s.state?.phase === 'buzzer');

    bob.send({ type: 'buzz' });
    alice.send({ type: 'buzz' }); // loses the race, silently ignored
    snap = await bob.until((s) => s.state?.phase === 'answer');
    assert(snap.state!.answering === 1, 'first buzz wins the race');

    alice.send({ type: 'guess', text: 'Sneijder' }); // not answering
    assert((await alice.untilError()).length > 0, 'only the buzzer winner can answer');

    bob.send({ type: 'guess', text: 'sneijder' });
    snap = await alice.until((s) => s.state?.phase === 'roundResult');
    assert(snap.state!.scores[1] === 1, 'correct online guess scores');

    alice.send({ type: 'nextRound' });
    bob.send({ type: 'nextRound' }); // double-tap is harmless
    snap = await alice.until((s) => s.state?.phase === 'pickTeamA');
    assert(snap.state!.round === 2 && snap.state!.chooser === 1, 'round 2, chooser swaps');

    // Round 2: wrong answer -> steal -> Alice scores.
    bob.send({ type: 'pickTeamA', team: 'Chelsea' });
    await alice.until((s) => s.state?.phase === 'pickTeamB');
    alice.send({ type: 'pickTeamB', team: 'Arsenal' });
    await alice.until((s) => s.state?.phase === 'buzzer');
    bob.send({ type: 'buzz' });
    await bob.until((s) => s.state?.phase === 'answer');
    bob.send({ type: 'guess', text: 'Messi' });
    snap = await alice.until((s) => s.state?.phase === 'steal');
    assert(snap.state!.answering === 0, 'steal passes to the opponent');
    alice.send({ type: 'guess', text: 'cech' });
    snap = await alice.until((s) => s.state?.phase === 'roundResult');
    assert(snap.state!.scores[0] === 1, 'steal scores online');
    alice.send({ type: 'nextRound' });
    await bob.until((s) => s.state?.phase === 'pickTeamA');

    // Round 3: both pass -> round skipped, answers revealed.
    alice.send({ type: 'pickTeamA', team: 'Liverpool' });
    await bob.until((s) => s.state?.phase === 'pickTeamB');
    bob.send({ type: 'pickTeamB', team: 'Barcelona' });
    await alice.until((s) => s.state?.phase === 'buzzer');
    alice.send({ type: 'pass' });
    snap = await bob.until((s) => s.passed[0]);
    assert(snap.state!.phase === 'buzzer', 'one pass alone does not end the round');
    bob.send({ type: 'pass' });
    snap = await bob.until((s) => s.state?.phase === 'roundResult');
    assert(snap.state!.lastResult?.scorer === null, 'double pass skips round');
    assert(snap.state!.lastResult!.validAnswers.length > 0, 'answers revealed after pass');
    bob.send({ type: 'nextRound' });

    // Rounds 4-5: Bob wins two quick rounds to take the match 3-1.
    for (const [teamA, teamB, answer] of [
      ['Real Madrid', 'Fenerbahçe', 'roberto carlos'],
      ['Manchester United', 'Real Madrid', 'ronaldo'],
    ] as const) {
      const s = await alice.until((x) => x.state?.phase === 'pickTeamA');
      const chooser = s.state!.chooser === 0 ? alice : bob;
      const otherC = s.state!.chooser === 0 ? bob : alice;
      chooser.send({ type: 'pickTeamA', team: teamA });
      await otherC.until((x) => x.state?.phase === 'pickTeamB');
      otherC.send({ type: 'pickTeamB', team: teamB });
      await bob.until((x) => x.state?.phase === 'buzzer');
      bob.send({ type: 'buzz' });
      await bob.until((x) => x.state?.phase === 'answer');
      bob.send({ type: 'guess', text: answer });
      const done = await alice.until(
        (x) => x.state?.phase === 'roundResult' || x.state?.phase === 'gameOver',
      );
      if (done.state!.phase === 'roundResult') {
        alice.send({ type: 'nextRound' });
      }
    }
    snap = await bob.until((s) => s.state?.phase === 'gameOver');
    assert(snap.state!.winner === 1 && snap.state!.scores[1] === 3, 'Bob wins 3 points');

    // Rematch needs both votes.
    alice.send({ type: 'rematch' });
    snap = await bob.until((s) => s.rematchVotes[0]);
    assert(snap.state!.phase === 'gameOver', 'one rematch vote is not enough');
    bob.send({ type: 'rematch' });
    snap = await alice.until((s) => s.state?.phase === 'pickTeamA');
    assert(
      snap.state!.scores[0] === 0 && snap.state!.scores[1] === 0 && snap.state!.round === 1,
      'rematch resets the match',
    );

    // Disconnect tears the room down for the opponent.
    bob.ws.close();
    const left = await alice.next();
    assert(left.type === 'opponentLeft', 'opponent is told about a disconnect');
    alice.ws.close();

    // ── Public matchmaking ──────────────────────────────────────
    // First searcher waits in the queue.
    const carol = new Client();
    await carol.open();
    carol.send({ type: 'quickMatch', name: 'Carol' });
    const searching = await carol.next();
    assert(searching.type === 'searching', 'first quick-matcher waits in queue');

    // Cancelling removes you from the queue: Dave should not match Carol.
    carol.send({ type: 'cancelQuickMatch' });
    const dave = new Client();
    await dave.open();
    dave.send({ type: 'quickMatch', name: 'Dave' });
    const daveSearch = await dave.next();
    assert(daveSearch.type === 'searching', 'queue is empty after a cancel');

    // A disconnected searcher must not be matched either.
    dave.ws.close();
    await new Promise((r) => setTimeout(r, 200)); // let the close reach the server

    // Two fresh searchers get paired into a running game.
    const erin = new Client();
    const frank = new Client();
    await erin.open();
    erin.send({ type: 'quickMatch', name: 'Erin' });
    const erinSearch = await erin.next();
    assert(erinSearch.type === 'searching', 'dead sockets are cleaned from the queue');
    await frank.open();
    frank.send({ type: 'quickMatch', name: 'Frank' });

    const erinJoin = await erin.next();
    const frankJoin = await frank.next();
    assert(
      erinJoin.type === 'joined' && erinJoin.youAre === 0,
      'waiting searcher becomes player 1',
    );
    assert(
      frankJoin.type === 'joined' && frankJoin.youAre === 1,
      'second searcher becomes player 2',
    );
    let qSnap = frankJoin.type === 'joined' ? frankJoin.snapshot : null;
    assert(
      qSnap?.names[0] === 'Erin' && qSnap?.names[1] === 'Frank',
      'matched players see both names',
    );
    assert(qSnap?.state?.phase === 'pickTeamA', 'quick match starts immediately');

    // The matched room is fully playable (both sessions wired correctly).
    erin.send({ type: 'pickTeamA', team: 'Galatasaray' });
    qSnap = await frank.until((s) => s.state?.phase === 'pickTeamB');
    assert(qSnap.state!.teamA === 'Galatasaray', 'quick-match room accepts moves');
    frank.send({ type: 'pickTeamB', team: 'Inter' });
    await erin.until((s) => s.state?.phase === 'buzzer');
    erin.send({ type: 'buzz' });
    await erin.until((s) => s.state?.phase === 'answer');
    erin.send({ type: 'guess', text: 'sneijder' });
    qSnap = await frank.until((s) => s.state?.phase === 'roundResult');
    assert(qSnap.state!.scores[0] === 1, 'both quick-match sessions are playable');

    erin.ws.close();
    const frankLeft = await frank.next();
    assert(frankLeft.type === 'opponentLeft', 'quick-match rooms tear down on disconnect');
    frank.ws.close();

    // ── Name filtering & ratings ────────────────────────────────
    const potty = new Client();
    await potty.open();
    potty.send({ type: 'create', name: 'fuckface', rating: 1234 });
    const pottyJoin = await potty.next();
    assert(
      pottyJoin.type === 'joined' && pottyJoin.snapshot.names[0] === 'Player',
      'profane names are replaced',
    );
    assert(
      pottyJoin.type === 'joined' && pottyJoin.snapshot.ratings[0] === 1234,
      'rating is stored in the snapshot',
    );
    potty.ws.close();

    const ayse = new Client();
    await ayse.open();
    ayse.send({ type: 'create', name: 'Ayşe', rating: 99999 });
    const ayseJoin = await ayse.next();
    assert(
      ayseJoin.type === 'joined' && ayseJoin.snapshot.names[0] === 'Ayşe',
      'clean names pass the filter unchanged',
    );
    assert(
      ayseJoin.type === 'joined' && ayseJoin.snapshot.ratings[0] === 4000,
      'absurd ratings are clamped',
    );
    ayse.ws.close();

    // ── Skill-based pairing ─────────────────────────────────────
    // A 1000-point gap exceeds the base tolerance, so the pair must wait
    // for the tolerance to widen (fast in this test via QM_WIDEN_PER_SEC).
    const rookie = new Client();
    const pro = new Client();
    await rookie.open();
    rookie.send({ type: 'quickMatch', name: 'Rookie', rating: 1000 });
    const rookieSearch = await rookie.next();
    assert(rookieSearch.type === 'searching', 'rookie queues');
    assert(
      rookieSearch.type === 'searching' && rookieSearch.online >= 1,
      'searching reports the online player count',
    );
    await pro.open();
    pro.send({ type: 'quickMatch', name: 'Pro', rating: 2000 });
    const proFirst = await pro.next();
    assert(
      proFirst.type === 'searching',
      'a large rating gap is not paired immediately',
    );
    // The sweep widens the tolerance and pairs them shortly after.
    const rookieMatched = await rookie.until((s) => s.state !== null);
    assert(
      rookieMatched.names.includes('Pro'),
      'widening tolerance eventually pairs across the gap',
    );
    assert(
      rookieMatched.ratings[0] === 1000 && rookieMatched.ratings[1] === 2000,
      'both ratings appear in the matched snapshot',
    );
    await pro.until((s) => s.state !== null);
    rookie.ws.close();
    pro.ws.close();

    // ── NBA league ──────────────────────────────────────────────
    // An NBA room only accepts NBA teams.
    const hoopA = new Client();
    await hoopA.open();
    hoopA.send({ type: 'create', name: 'HoopA', league: 'nba' });
    const hoopJoin = await hoopA.next();
    assert(
      hoopJoin.type === 'joined' && hoopJoin.snapshot.league === 'nba',
      'room carries the NBA league',
    );
    const hoopCode = hoopJoin.type === 'joined' ? hoopJoin.snapshot.code : '';
    const hoopB = new Client();
    await hoopB.open();
    hoopB.send({ type: 'join', code: hoopCode, name: 'HoopB' });
    await hoopA.until((s) => s.state !== null);
    hoopA.send({ type: 'pickTeamA', team: 'Galatasaray' }); // wrong sport
    assert((await hoopA.untilError()).length > 0, 'football teams rejected in NBA rooms');
    hoopA.send({ type: 'pickTeamA', team: 'Lakers' });
    let hoopSnap = await hoopB.until((s) => s.state?.phase === 'pickTeamB');
    assert(hoopSnap.state!.teamA === 'Lakers', 'NBA team accepted');
    hoopB.send({ type: 'pickTeamB', team: 'Heat' });
    await hoopA.until((s) => s.state?.phase === 'buzzer');
    hoopA.send({ type: 'buzz' });
    await hoopA.until((s) => s.state?.phase === 'answer');
    hoopA.send({ type: 'guess', text: 'lebron' });
    hoopSnap = await hoopB.until((s) => s.state?.phase === 'roundResult');
    assert(hoopSnap.state!.scores[0] === 1, 'NBA answers validate in online rooms');
    hoopA.ws.close();
    await hoopB.next(); // opponentLeft
    hoopB.ws.close();

    // Quick-match queues are per league: same rating, different sport.
    const footFan = new Client();
    await footFan.open();
    footFan.send({ type: 'quickMatch', name: 'FootFan', rating: 1000 });
    await footFan.next(); // searching
    const hoopFan = new Client();
    await hoopFan.open();
    hoopFan.send({ type: 'quickMatch', name: 'HoopFan', rating: 1000, league: 'nba' });
    const hoopSearch = await hoopFan.next();
    assert(
      hoopSearch.type === 'searching',
      'different leagues never pair despite equal ratings',
    );
    const hoopFan2 = new Client();
    await hoopFan2.open();
    hoopFan2.send({ type: 'quickMatch', name: 'HoopFan2', rating: 1000, league: 'nba' });
    const hoopPair = await hoopFan2.until((s) => s.state !== null);
    assert(hoopPair.league === 'nba', 'NBA searchers pair together');
    assert(
      hoopPair.names.includes('HoopFan') && !hoopPair.names.includes('FootFan'),
      'the football searcher is left in the queue',
    );
    footFan.ws.close();
    hoopFan.ws.close();
    hoopFan2.ws.close();
  } finally {
    server.kill();
  }

  if (failures === 0) {
    console.log('All server tests passed.');
    process.exit(0); // the spawned server's stdio pipe would otherwise keep us alive
  } else {
    console.error(`${failures} server test(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
