import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function TeamsBanner({ teamA, teamB }: { teamA: string; teamB: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.team} numberOfLines={2}>
        {teamA}
      </Text>
      <Text style={styles.vs}>×</Text>
      <Text style={styles.team} numberOfLines={2}>
        {teamB}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pitchLight,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  team: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  vs: { color: colors.gold, fontSize: 24, fontWeight: '900' },
});
