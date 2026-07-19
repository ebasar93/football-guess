import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useVoiceInput } from '../voice/useVoiceInput';
import { colors } from '../theme';
import BigButton from './BigButton';

interface Props {
  prompt: string;
  accent: string;
  onSubmit: (text: string) => void;
  onGiveUp: () => void;
}

/**
 * The answer box: type the player's name, or hold the mic button and say
 * it out loud. Voice fills the field (final results auto-submit), typing
 * always works as a fallback.
 */
export default function AnswerInput({ prompt, accent, onSubmit, onGiveUp }: Props) {
  const [text, setText] = useState('');
  const voice = useVoiceInput((finalText) => {
    setText(finalText);
    onSubmit(finalText);
  });

  // Mirror the live transcript into the field while listening.
  useEffect(() => {
    if (voice.listening && voice.transcript) setText(voice.transcript);
  }, [voice.listening, voice.transcript]);

  const submit = () => {
    if (!text.trim()) return;
    setText('');
    onSubmit(text);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: accent }]}>{prompt}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={voice.listening ? 'Listening…' : "Type the player's name…"}
          placeholderTextColor={colors.textDim}
          value={text}
          onChangeText={setText}
          autoCorrect={false}
          autoFocus={!voice.listening}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        {voice.supported && (
          <Pressable
            style={({ pressed }) => [
              styles.mic,
              voice.listening && styles.micActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => (voice.listening ? voice.stop() : voice.start())}
          >
            <Text style={styles.micIcon}>{voice.listening ? '⏹' : '🎤'}</Text>
          </Pressable>
        )}
      </View>
      {voice.listening && <Text style={styles.listening}>Say the player's name…</Text>}
      {voice.error && <Text style={styles.error}>{voice.error}</Text>}
      <BigButton label="Submit Answer" onPress={submit} />
      <BigButton
        label="Give up"
        color={colors.card}
        textColor={colors.textDim}
        small
        onPress={() => {
          voice.stop();
          setText('');
          onGiveUp();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  prompt: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 17,
  },
  mic: {
    backgroundColor: colors.card,
    borderRadius: 12,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: { backgroundColor: colors.danger },
  micIcon: { fontSize: 22 },
  listening: { color: colors.gold, textAlign: 'center', fontSize: 13 },
  error: { color: colors.danger, textAlign: 'center', fontSize: 13 },
});
