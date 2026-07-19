import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import GameScreen from './src/screens/GameScreen';
import HomeScreen from './src/screens/HomeScreen';
import SetupScreen from './src/screens/SetupScreen';
import WinnerScreen from './src/screens/WinnerScreen';
import { GameState, newGame } from './src/logic/game';
import { colors } from './src/theme';

type Screen = 'home' | 'setup' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [game, setGame] = useState<GameState | null>(null);

  const startMatch = (names: [string, string]) => {
    setGame(newGame(names));
    setScreen('game');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {screen === 'home' && <HomeScreen onStart={() => setScreen('setup')} />}
        {screen === 'setup' && <SetupScreen onReady={startMatch} />}
        {screen === 'game' && game && game.phase !== 'gameOver' && (
          <GameScreen
            game={game}
            setGame={setGame}
            onQuit={() => {
              setGame(null);
              setScreen('home');
            }}
          />
        )}
        {screen === 'game' && game && game.phase === 'gameOver' && (
          <WinnerScreen
            game={game}
            onRematch={() => setGame(newGame(game.playerNames))}
            onHome={() => {
              setGame(null);
              setScreen('home');
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pitch },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
});
