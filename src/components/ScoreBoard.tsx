import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WINNING_SCORE } from '../logic/game';
import { colors } from '../theme';

interface Props {
  names: [string, string];
  scores: [number, number];
  round: number;
}

function Dots({ score, color }: { score: number; color: string }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: WINNING_SCORE }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i < score ? color : 'transparent', borderColor: color },
          ]}
        />
      ))}
    </View>
  );
}

export default function ScoreBoard({ names, scores, round }: Props) {
  return (
    <View style={styles.board}>
      <View style={styles.side}>
        <Text style={[styles.name, { color: colors.p1 }]} numberOfLines={1}>
          {names[0]}
        </Text>
        <Dots score={scores[0]} color={colors.p1} />
      </View>
      <View style={styles.center}>
        <Text style={styles.score}>
          {scores[0]} – {scores[1]}
        </Text>
        <Text style={styles.round}>Round {round}</Text>
      </View>
      <View style={styles.side}>
        <Text style={[styles.name, { color: colors.p2 }]} numberOfLines={1}>
          {names[1]}
        </Text>
        <Dots score={scores[1]} color={colors.p2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pitchLight,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  side: { flex: 1, alignItems: 'center', gap: 4 },
  center: { alignItems: 'center', paddingHorizontal: 10 },
  name: { fontSize: 15, fontWeight: '700', maxWidth: 110 },
  score: { color: colors.text, fontSize: 22, fontWeight: '800' },
  round: { color: colors.textDim, fontSize: 11 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
});
