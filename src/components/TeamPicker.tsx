import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { normalizeName } from '../logic/game';
import { colors } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  teams: string[];
  accent: string;
  onPick: (team: string) => void;
}

export default function TeamPicker({ title, subtitle, teams, accent, onPick }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    if (!q) return teams;
    return teams.filter((t) => normalizeName(t).includes(q));
  }, [query, teams]);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: accent }]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <TextInput
        style={styles.search}
        placeholder="Search teams…"
        placeholderTextColor={colors.textDim}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <FlatList
        data={filtered}
        keyExtractor={(t) => t}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onPick(item)}
          >
            <Text style={styles.rowText}>{item}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No team matches your search.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  subtitle: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  search: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
    marginBottom: 8,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  rowPressed: { backgroundColor: colors.line },
  rowText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 24 },
});
