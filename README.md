# ⚽ Ortak Oyuncu — Football Guess

A multiplayer football guessing game for iOS and Android, built with
[Expo](https://expo.dev) / React Native.

## How the game works

Two players play on one device (pass-and-play):

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
App.tsx                    # screen switching (home → setup → game → winner)
src/
  data/players.ts          # player ↔ clubs dataset (add players here!)
  logic/game.ts            # pure game state machine + name matching
  logic/game.test.ts       # smoke tests
  screens/                 # Home, Setup, Game, Winner screens
  components/              # ScoreBoard, TeamPicker, BigButton
  theme.ts                 # colors
scripts/generate-assets.js # regenerates the PNG icons
```

## Adding more players

Edit `src/data/players.ts` — each entry is a name plus the list of clubs.
The team list and the "played for both" check are derived from it
automatically, and `npm test` verifies every team still has at least one
playable partner team.
