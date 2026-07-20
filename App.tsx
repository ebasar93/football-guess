import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import GameScreen from './src/screens/GameScreen';
import HomeScreen from './src/screens/HomeScreen';
import OnlineGameScreen from './src/screens/OnlineGameScreen';
import OnlineLobbyScreen from './src/screens/OnlineLobbyScreen';
import SetupScreen from './src/screens/SetupScreen';
import WinnerScreen from './src/screens/WinnerScreen';
import { DEFAULT_LEAGUE, League } from './src/data/leagues';
import { GameState, newGame } from './src/logic/game';
import { useOnlineGame } from './src/online/useOnlineGame';
import { useRating } from './src/rating/useRating';
import { colors } from './src/theme';

type Screen = 'home' | 'setup' | 'game' | 'onlineLobby';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [league, setLeague] = useState<League>(DEFAULT_LEAGUE);
  const [game, setGame] = useState<GameState | null>(null);
  const online = useOnlineGame();
  const rating = useRating(league);

  const startMatch = (names: [string, string]) => {
    setGame(newGame(names, league));
    setScreen('game');
  };

  const goHome = () => {
    setGame(null);
    setScreen('home');
  };

  // Once connected to a room with a running game, the online match takes over.
  const inOnlineMatch =
    screen === 'onlineLobby' &&
    online.snapshot?.state != null &&
    (online.status === 'playing' || online.status === 'opponentLeft');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {screen === 'home' && (
          <HomeScreen
            league={league}
            onLeagueChange={setLeague}
            onPlayOnline={() => setScreen('onlineLobby')}
            onPlayLocal={() => setScreen('setup')}
          />
        )}
        {screen === 'setup' && <SetupScreen onReady={startMatch} />}
        {screen === 'game' && game && game.phase !== 'gameOver' && (
          <GameScreen game={game} setGame={setGame} onQuit={goHome} />
        )}
        {screen === 'game' && game && game.phase === 'gameOver' && (
          <WinnerScreen
            game={game}
            onRematch={() => setGame(newGame(game.playerNames, game.league))}
            onHome={goHome}
          />
        )}
        {screen === 'onlineLobby' && !inOnlineMatch && (
          <OnlineLobbyScreen
            online={online}
            league={league}
            rating={rating.rating}
            onBack={goHome}
          />
        )}
        {inOnlineMatch && (
          <OnlineGameScreen online={online} rating={rating} onLeave={goHome} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pitch },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
});
