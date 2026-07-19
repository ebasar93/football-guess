import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BigButton from '../components/BigButton';
import { GameState } from '../logic/game';
import { colors } from '../theme';

interface Props {
  game: GameState;
  onRematch: () => void;
  onHome: () => void;
}

export default function WinnerScreen({ game, onRematch, onHome }: Props) {
  const winner = game.winner ?? 0;
  return (
    <View style={styles.container}>
      <Text style={styles.trophy}>🏆</Text>
      <Text style={[styles.name, { color: winner === 0 ? colors.p1 : colors.p2 }]}>
        {game.playerNames[winner]}
      </Text>
      <Text style={styles.wins}>wins the match!</Text>
      <Text style={styles.score}>
        {game.scores[0]} – {game.scores[1]}
      </Text>
      <View style={styles.buttons}>
        <BigButton label="Rematch" onPress={onRematch} />
        <BigButton
          label="Back to Home"
          color={colors.card}
          textColor={colors.text}
          onPress={onHome}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  trophy: { fontSize: 72 },
  name: { fontSize: 34, fontWeight: '900' },
  wins: { color: colors.text, fontSize: 20, fontWeight: '600' },
  score: { color: colors.gold, fontSize: 28, fontWeight: '800', marginTop: 8 },
  buttons: { alignSelf: 'stretch', gap: 12, marginTop: 28 },
});
