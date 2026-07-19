import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import BigButton from '../components/BigButton';
import ScoreBoard from '../components/ScoreBoard';
import TeamPicker from '../components/TeamPicker';
import { TEAMS } from '../data/players';
import {
  buzz,
  GameState,
  giveUp,
  nextRound,
  passRound,
  pickTeamA,
  pickTeamB,
  submitGuess,
  teamsWithCommonPlayer,
} from '../logic/game';
import { colors } from '../theme';

interface Props {
  game: GameState;
  setGame: (g: GameState) => void;
  onQuit: () => void;
}

function TeamsBanner({ teamA, teamB }: { teamA: string; teamB: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTeam} numberOfLines={2}>
        {teamA}
      </Text>
      <Text style={styles.bannerVs}>×</Text>
      <Text style={styles.bannerTeam} numberOfLines={2}>
        {teamB}
      </Text>
    </View>
  );
}

export default function GameScreen({ game, setGame, onQuit }: Props) {
  const [guess, setGuess] = useState('');
  const chooserColor = game.chooser === 0 ? colors.p1 : colors.p2;
  const otherColor = game.chooser === 0 ? colors.p2 : colors.p1;
  const chooserName = game.playerNames[game.chooser];
  const otherName = game.playerNames[game.chooser === 0 ? 1 : 0];

  const submit = () => {
    if (!guess.trim()) return;
    setGame(submitGuess(game, guess));
    setGuess('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScoreBoard names={game.playerNames} scores={game.scores} round={game.round} />

      {game.phase === 'pickTeamA' && (
        <TeamPicker
          title={`${chooserName}, pick the first team`}
          subtitle="The other player will pick the second team."
          teams={TEAMS}
          accent={chooserColor}
          onPick={(t) => setGame(pickTeamA(game, t))}
        />
      )}

      {game.phase === 'pickTeamB' && game.teamA && (
        <TeamPicker
          title={`${otherName}, pick the second team`}
          subtitle={`First team: ${game.teamA}. Only teams with at least one common player are listed.`}
          teams={teamsWithCommonPlayer(game.teamA)}
          accent={otherColor}
          onPick={(t) => setGame(pickTeamB(game, t))}
        />
      )}

      {game.phase === 'buzzer' && game.teamA && game.teamB && (
        <View style={styles.center}>
          <TeamsBanner teamA={game.teamA} teamB={game.teamB} />
          <Text style={styles.prompt}>
            Name a player who played for BOTH teams.{'\n'}First to buzz answers!
          </Text>
          <View style={styles.buzzRow}>
            {( [0, 1] as const ).map((i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.buzzer,
                  { backgroundColor: i === 0 ? colors.p1 : colors.p2, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => setGame(buzz(game, i))}
              >
                <Text style={styles.buzzerText}>{game.playerNames[i]}</Text>
                <Text style={styles.buzzerSub}>BUZZ!</Text>
              </Pressable>
            ))}
          </View>
          <BigButton
            label="Nobody knows — skip round"
            color={colors.card}
            textColor={colors.textDim}
            small
            onPress={() => setGame(passRound(game))}
          />
        </View>
      )}

      {(game.phase === 'answer' || game.phase === 'steal') &&
        game.teamA &&
        game.teamB &&
        game.answering !== null && (
          <View style={styles.center}>
            <TeamsBanner teamA={game.teamA} teamB={game.teamB} />
            {game.phase === 'steal' && (
              <Text style={styles.stealNote}>Wrong answer! Steal chance:</Text>
            )}
            <Text
              style={[
                styles.prompt,
                { color: game.answering === 0 ? colors.p1 : colors.p2, fontWeight: '800' },
              ]}
            >
              {game.playerNames[game.answering]}, your answer:
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Type the player's name…"
              placeholderTextColor={colors.textDim}
              value={guess}
              onChangeText={setGuess}
              autoCorrect={false}
              autoFocus
              onSubmitEditing={submit}
              returnKeyType="done"
            />
            <BigButton label="Submit Answer" onPress={submit} />
            <BigButton
              label="Give up"
              color={colors.card}
              textColor={colors.textDim}
              small
              onPress={() => {
                setGuess('');
                setGame(giveUp(game));
              }}
            />
          </View>
        )}

      {game.phase === 'roundResult' && game.lastResult && (
        <View style={styles.center}>
          {game.lastResult.scorer !== null ? (
            <>
              <Text style={styles.resultEmoji}>🎉</Text>
              <Text
                style={[
                  styles.resultTitle,
                  { color: game.lastResult.scorer === 0 ? colors.p1 : colors.p2 },
                ]}
              >
                {game.playerNames[game.lastResult.scorer]} scores!
              </Text>
              <Text style={styles.resultText}>
                {game.lastResult.matchedPlayer} played for both teams.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.resultEmoji}>😅</Text>
              <Text style={[styles.resultTitle, { color: colors.textDim }]}>
                No points this round
              </Text>
              <Text style={styles.resultText}>
                Possible answers:{'\n'}
                {game.lastResult.validAnswers.join(', ')}
              </Text>
            </>
          )}
          <BigButton label="Next Round" onPress={() => setGame(nextRound(game))} />
        </View>
      )}

      <Pressable onPress={onQuit} style={styles.quit}>
        <Text style={styles.quitText}>Quit match</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', gap: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pitchLight,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  bannerTeam: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  bannerVs: { color: colors.gold, fontSize: 24, fontWeight: '900' },
  prompt: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  stealNote: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  buzzRow: { flexDirection: 'row', gap: 12 },
  buzzer: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 26,
    alignItems: 'center',
  },
  buzzerText: { color: '#1b1b1b', fontSize: 17, fontWeight: '800' },
  buzzerSub: { color: '#1b1b1b', fontSize: 13, fontWeight: '700', opacity: 0.7 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 17,
  },
  resultEmoji: { fontSize: 48, textAlign: 'center' },
  resultTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  resultText: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  quit: { alignItems: 'center', paddingVertical: 10 },
  quitText: { color: colors.textDim, fontSize: 13 },
});
