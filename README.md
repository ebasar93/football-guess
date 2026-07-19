# ⚽ Ortak Oyuncu — Football Guess

A multiplayer football guessing game for iOS and Android, built with
[Expo](https://expo.dev) / React Native.

## How the game works

Play **online against a friend** (each on your own phone) or pass-and-play
on one device:

1. **Player 1 names a team** — it appears on the screen.
2. **Player 2 names a second team** — only teams that share at least one
   player with the first team can be picked, so every round is solvable.
3. Both teams are shown. **Buzz in and name a footballer who played for
   BOTH teams.**
4. A correct answer scores a point. A wrong answer gives the other player
   a chance to steal. If nobody knows, the round can be skipped and the
   valid answers are revealed.
5. **First to 3 points wins the match.** 🏆

Answers are checked against a built-in dataset of 200+ well-known players
and their club histories (`src/data/players.ts`). Matching is forgiving:
surnames are accepted and accents/Turkish characters are ignored
(`sneijder`, `Hakan Sukur`, `ibrahimovic` all work).

Answers can be **spoken instead of typed**: tap the 🎤 button on the answer
box and say the player's name (uses the device's native speech recognition
in the device language).

## Online multiplayer

- **Quick Match**: tap **Play Online → Quick Match** to be paired with the
  next player searching for a public game, whoever they are.
- **Play with a friend**: one player taps **Create a Room** and gets a
  4-letter room code; the other joins with the code. The match starts
  automatically.
- The server is authoritative: it arbitrates who buzzed first, validates
  answers, and keeps both phones in sync. Skipping a round and rematches
  need both players to agree.
- If a player disconnects, the opponent is notified and the room closes.

### Running the game server

```bash
cd server
npm install
npm start            # listens on PORT (default 8080)
npm test             # end-to-end test: two clients play a full match
```

Deploy it anywhere that runs Node (Railway, Render, Fly.io — the free
tiers are fine): point the service at the repo, set the start command to
`cd server && npm install && npm start`, and note the public URL. Then set
that URL in `src/config.ts` (use `wss://…` in production), e.g.:

```ts
export const DEFAULT_SERVER_URL = 'wss://your-app.up.railway.app';
```

The server URL can also be changed in-app on the online lobby screen,
which is handy for testing against a laptop on the same Wi-Fi
(`ws://192.168.x.x:8080`).

## Voice recognition

Voice input uses [`expo-speech-recognition`](https://github.com/jamsch/expo-speech-recognition)
(Apple's SFSpeechRecognizer on iOS, Google's SpeechRecognizer on Android).
Because it is a native module it works in **development/EAS builds but not
in the Expo Go app** — in Expo Go the mic button simply hides and typing
still works. To try voice locally:

```bash
eas build --profile development --platform android   # or ios
npx expo start --dev-client
```

Microphone/speech permission texts are configured in `app.json`.

## Run it locally

```bash
npm install
npm start          # then scan the QR code with the Expo Go app
```

- `npm test` — game-logic smoke tests
- `npm run typecheck` — TypeScript check

## Ship it to the App Store and Google Play

The project is configured for [EAS Build](https://docs.expo.dev/build/introduction/)
(`eas.json`, bundle IDs in `app.json`):

```bash
npm install -g eas-cli
eas login                      # needs a free Expo account
eas build --platform android --profile production
eas build --platform ios --profile production      # needs an Apple Developer account
eas submit --platform android  # upload to Google Play Console
eas submit --platform ios      # upload to App Store Connect
```

Identifiers: `com.ebasar93.footballguess` (both stores). Icons and the
splash screen live in `assets/` and can be regenerated with
`node scripts/generate-assets.js`.

## Project structure

```
App.tsx                    # screen switching (home / local game / online)
src/
  data/players.ts          # player ↔ clubs dataset (add players here!)
  logic/game.ts            # pure game state machine + name matching
  logic/game.test.ts       # logic smoke tests
  online/protocol.ts       # client↔server message types (shared)
  online/useOnlineGame.ts  # WebSocket connection + room state hook
  voice/useVoiceInput.ts   # speech-to-text hook (graceful fallback)
  screens/                 # Home, Setup, Game, OnlineLobby, OnlineGame, Winner
  components/              # ScoreBoard, TeamPicker, TeamsBanner, AnswerInput…
  theme.ts                 # colors
server/
  index.ts                 # WebSocket game server entry (PORT env)
  rooms.ts                 # room manager + authoritative game handling
  server.test.ts           # end-to-end online match test
scripts/generate-assets.js # regenerates the PNG icons
```

## Adding more players

Edit `src/data/players.ts` — each entry is a name plus the list of clubs.
The team list and the "played for both" check are derived from it
automatically, and `npm test` verifies every team still has at least one
playable partner team.
