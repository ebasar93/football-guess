import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AnswerInput from '../components/AnswerInput';
import BigButton from '../components/BigButton';
import ScoreBoard from '../components/ScoreBoard';
import TeamPicker from '../components/TeamPicker';
import TeamsBanner from '../components/TeamsBanner';
import { TEAMS } from '../data/players';
import { teamsWithCommonPlayer } from '../logic/game';
import { OnlineGame } from '../online/useOnlineGame';
import { colors } from '../theme';

interface Props {
  online: OnlineGame;
  onLeave: () => void;
}

function Waiting({ text }: { text: string }) {
  return (
    <View style={styles.waiting}>
      <Text style={styles.waitingText}>{text}</Text>
    </View>
  );
}

export default function OnlineGameScreen({ online, onLeave }: Props) {
  const snap = online.snapshot;
  const me = online.youAre;
  if (!snap || !snap.state || me === null) return null;
  const g = snap.state;
  const opp = me === 0 ? 1 : 0;
  const myColor = me === 0 ? colors.p1 : colors.p2;
  const oppName = snap.names[opp];

  const leave = () => {
    online.leave();
    onLeave();
  };

  if (online.status === 'opponentLeft') {
    return (
      <View style={styles.center}>
        <Text style={styles.leftEmoji}>🚪</Text>
        <Text style={styles.leftTitle}>{oppName || 'Your opponent'} left the match</Text>
        <BigButton label="Back to Lobby" onPress={leave} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScoreBoard names={snap.names} scores={g.scores} round={g.round} />

      {g.phase === 'pickTeamA' &&
        (g.chooser === me ? (
          <TeamPicker
            title="Your turn — pick the first team"
            subtitle={`${oppName} will pick the second team.`}
            teams={TEAMS}
            accent={myColor}
            onPick={(t) => online.send({ type: 'pickTeamA', team: t })}
          />
        ) : (
          <Waiting text={`${oppName} is picking the first team…`} />
        ))}

      {g.phase === 'pickTeamB' &&
        g.teamA &&
        (g.chooser !== me ? (
          <TeamPicker
            title="Your turn — pick the second team"
            subtitle={`First team: ${g.teamA}. Only teams with at least one common player are listed.`}
            teams={teamsWithCommonPlayer(g.teamA)}
            accent={myColor}
            onPick={(t) => online.send({ type: 'pickTeamB', team: t })}
          />
        ) : (
          <Waiting text={`First team: ${g.teamA}\n${oppName} is picking the second team…`} />
        ))}

      {g.phase === 'buzzer' && g.teamA && g.teamB && (
        <View style={styles.center}>
          <TeamsBanner teamA={g.teamA} teamB={g.teamB} />
          <Text style={styles.prompt}>
            Name a player who played for BOTH teams.{'\n'}Fastest buzz answers!
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.buzzer,
              { backgroundColor: myColor, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => online.send({ type: 'buzz' })}
          >
            <Text style={styles.buzzerText}>BUZZ!</Text>
          </Pressable>
          {snap.passed[me] ? (
            <Text style={styles.passNote}>
              You voted to skip. Waiting for {oppName}…
            </Text>
          ) : (
            <BigButton
              label="No idea — vote to skip"
              color={colors.card}
              textColor={colors.textDim}
              small
              onPress={() => online.send({ type: 'pass' })}
            />
          )}
          {snap.passed[opp] && !snap.passed[me] && (
            <Text style={styles.passNote}>{oppName} voted to skip this round.</Text>
          )}
        </View>
      )}

      {(g.phase === 'answer' || g.phase === 'steal') && g.teamA && g.teamB && (
        <View style={styles.center}>
          <TeamsBanner teamA={g.teamA} teamB={g.teamB} />
          {g.phase === 'steal' && (
            <Text style={styles.stealNote}>Wrong answer — steal chance!</Text>
          )}
          {g.answering === me ? (
            <AnswerInput
              prompt="Your answer:"
              accent={myColor}
              onSubmit={(text) => online.send({ type: 'guess', text })}
              onGiveUp={() => online.send({ type: 'giveUp' })}
            />
          ) : (
            <Waiting text={`${oppName} is answering…`} />
          )}
        </View>
      )}

      {g.phase === 'roundResult' && g.lastResult && (
        <View style={styles.center}>
          {g.lastResult.scorer !== null ? (
            <>
              <Text style={styles.resultEmoji}>
                {g.lastResult.scorer === me ? '🎉' : '😬'}
              </Text>
              <Text
                style={[
                  styles.resultTitle,
                  { color: g.lastResult.scorer === 0 ? colors.p1 : colors.p2 },
                ]}
              >
                {g.lastResult.scorer === me ? 'You score!' : `${oppName} scores!`}
              </Text>
              <Text style={styles.resultText}>
                {g.lastResult.matchedPlayer} played for both teams.
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
                {g.lastResult.validAnswers.join(', ')}
              </Text>
            </>
          )}
          <BigButton label="Next Round" onPress={() => online.send({ type: 'nextRound' })} />
        </View>
      )}

      {g.phase === 'gameOver' && g.winner !== null && (
        <View style={styles.center}>
          <Text style={styles.resultEmoji}>{g.winner === me ? '🏆' : '💔'}</Text>
          <Text
            style={[styles.resultTitle, { color: g.winner === 0 ? colors.p1 : colors.p2 }]}
          >
            {g.winner === me ? 'You win the match!' : `${oppName} wins the match`}
          </Text>
          <Text style={styles.finalScore}>
            {g.scores[0]} – {g.scores[1]}
          </Text>
          {snap.rematchVotes[me] ? (
            <Text style={styles.passNote}>Rematch requested. Waiting for {oppName}…</Text>
          ) : (
            <BigButton label="Rematch" onPress={() => online.send({ type: 'rematch' })} />
          )}
          {snap.rematchVotes[opp] && !snap.rematchVotes[me] && (
            <Text style={styles.passNote}>{oppName} wants a rematch!</Text>
          )}
        </View>
      )}

      <Pressable onPress={leave} style={styles.quit}>
        <Text style={styles.quitText}>Leave match</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', gap: 14 },
  waiting: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  waitingText: {
    color: colors.textDim,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  prompt: { color: colors.text, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  buzzer: { borderRadius: 16, paddingVertical: 30, alignItems: 'center' },
  buzzerText: { color: '#1b1b1b', fontSize: 24, fontWeight: '900' },
  passNote: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  stealNote: { color: colors.danger, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  resultEmoji: { fontSize: 48, textAlign: 'center' },
  resultTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  resultText: { color: colors.text, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  finalScore: { color: colors.gold, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  leftEmoji: { fontSize: 48, textAlign: 'center' },
  leftTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  quit: { alignItems: 'center', paddingVertical: 10 },
  quitText: { color: colors.textDim, fontSize: 13 },
});
