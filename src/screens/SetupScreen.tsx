import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import BigButton from '../components/BigButton';
import { colors } from '../theme';

interface Props {
  onReady: (names: [string, string]) => void;
}

export default function SetupScreen({ onReady }: Props) {
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');

  const start = () => {
    onReady([name1.trim() || 'Player 1', name2.trim() || 'Player 2']);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who is playing?</Text>
      <Text style={[styles.label, { color: colors.p1 }]}>Player 1</Text>
      <TextInput
        style={styles.input}
        placeholder="Player 1 name"
        placeholderTextColor={colors.textDim}
        value={name1}
        onChangeText={setName1}
        maxLength={20}
      />
      <Text style={[styles.label, { color: colors.p2 }]}>Player 2</Text>
      <TextInput
        style={styles.input}
        placeholder="Player 2 name"
        placeholderTextColor={colors.textDim}
        value={name2}
        onChangeText={setName2}
        maxLength={20}
      />
      <View style={styles.spacer} />
      <BigButton label="Start Match" onPress={start} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 17,
    marginBottom: 16,
  },
  spacer: { height: 8 },
});
