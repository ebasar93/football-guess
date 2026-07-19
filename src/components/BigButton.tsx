import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  small?: boolean;
}

export default function BigButton({ label, onPress, color, textColor, small }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        { backgroundColor: color ?? colors.gold, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.label, small && styles.smallLabel, { color: textColor ?? '#1b1b1b' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  small: { paddingVertical: 10, paddingHorizontal: 14 },
  label: { fontSize: 18, fontWeight: '800' },
  smallLabel: { fontSize: 14 },
});
