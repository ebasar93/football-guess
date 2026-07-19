import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import BigButton from '../components/BigButton';
import { OnlineGame } from '../online/useOnlineGame';
import { DEFAULT_SERVER_URL } from '../config';
import { colors } from '../theme';

interface Props {
  online: OnlineGame;
  onBack: () => void;
}

export default function OnlineLobbyScreen({ online, onBack }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  const playerName = name.trim() || 'Player';
  const busy = online.status === 'connecting' || online.status === 'waiting';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Play Online</Text>

      {online.status === 'waiting' && online.snapshot ? (
        <View style={styles.waitBox}>
          <Text style={styles.waitLabel}>Room code</Text>
          <Text style={styles.code}>{online.snapshot.code}</Text>
          <Text style={styles.waitText}>
            Share this code with your friend.{'\n'}Waiting for them to join…
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textDim}
            value={name}
            onChangeText={setName}
            maxLength={20}
          />

          <BigButton
            label={online.status === 'connecting' ? 'Connecting…' : 'Create a Room'}
            onPress={() => !busy && online.createRoom(serverUrl, playerName)}
          />

          <View style={styles.divider}>
            <Text style={styles.dividerText}>— or join a friend's room —</Text>
          </View>

          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="ROOM CODE"
            placeholderTextColor={colors.textDim}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
          />
          <BigButton
            label="Join Room"
            color={colors.card}
            textColor={colors.text}
            onPress={() => !busy && code.trim() && online.joinRoom(serverUrl, code, playerName)}
          />

          <Text style={styles.serverLabel}>Game server</Text>
          <TextInput
            style={styles.serverInput}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      {online.error && <Text style={styles.error}>{online.error}</Text>}

      <View style={styles.spacer} />
      <BigButton
        label="Back"
        color={colors.card}
        textColor={colors.textDim}
        small
        onPress={() => {
          online.leave();
          onBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 12 },
  title: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 17,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
  },
  divider: { alignItems: 'center', marginVertical: 4 },
  dividerText: { color: colors.textDim, fontSize: 13 },
  waitBox: {
    backgroundColor: colors.pitchLight,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  waitLabel: { color: colors.textDim, fontSize: 13 },
  code: {
    color: colors.gold,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 12,
  },
  waitText: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  serverLabel: { color: colors.textDim, fontSize: 11, marginTop: 8 },
  serverInput: {
    backgroundColor: colors.pitchLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.textDim,
    fontSize: 12,
  },
  error: { color: colors.danger, textAlign: 'center', fontSize: 14 },
  spacer: { height: 4 },
});
