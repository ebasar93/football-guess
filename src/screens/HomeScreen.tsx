import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BigButton from '../components/BigButton';
import { League, LEAGUES } from '../data/leagues';
import { WINNING_SCORE } from '../logic/game';
import { colors } from '../theme';

interface Props {
  league: League;
  onLeagueChange: (league: League) => void;
  onPlayOnline: () => void;
  onPlayLocal: () => void;
}

export default function HomeScreen({ league, onLeagueChange, onPlayOnline, onPlayLocal }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.ball}>{LEAGUES[league].emoji}</Text>
      <Text style={styles.title}>Ortak Oyuncu</Text>
      <Text style={styles.subtitle}>The Common Player Game</Text>

      <View style={styles.leagueRow}>
        {(Object.keys(LEAGUES) as League[]).map((l) => (
          <Pressable
            key={l}
            style={[styles.leagueChip, league === l && styles.leagueChipActive]}
            onPress={() => onLeagueChange(l)}
          >
            <Text style={[styles.leagueChipText, league === l && styles.leagueChipTextActive]}>
              {LEAGUES[l].emoji} {LEAGUES[l].label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.rules}>
        <Text style={styles.rule}>1. One player names a team.</Text>
        <Text style={styles.rule}>2. The other player names a second team.</Text>
        <Text style={styles.rule}>
          3. Buzz in and name a {league === 'nba' ? 'basketball' : 'football'} player who
          played for BOTH teams.
        </Text>
        <Text style={styles.rule}>
          4. Correct answer wins the round. First to {WINNING_SCORE} points wins!
        </Text>
      </View>
      <BigButton label="Play Online" onPress={onPlayOnline} />
      <BigButton
        label="Play on One Device"
        color={colors.card}
        textColor={colors.text}
        onPress={onPlayLocal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 12 },
  ball: { fontSize: 64, textAlign: 'center' },
  title: {
    color: colors.gold,
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 16,
    textAlign: 'center',
  },
  leagueRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  leagueChip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  leagueChipActive: { borderColor: colors.gold, backgroundColor: colors.pitchLight },
  leagueChipText: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  leagueChipTextActive: { color: colors.gold },
  rules: {
    backgroundColor: colors.pitchLight,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 4,
  },
  rule: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
