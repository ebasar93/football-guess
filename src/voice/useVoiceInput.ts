import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// expo-speech-recognition is a native module: present in dev/EAS builds
// (configured via its plugin in app.json) but absent in Expo Go. Load it
// defensively so the app still runs everywhere — the mic button simply
// hides when voice is unavailable.
let speech: typeof import('expo-speech-recognition') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  speech = require('expo-speech-recognition');
  if (!speech?.ExpoSpeechRecognitionModule) speech = null;
} catch {
  speech = null;
}

export interface VoiceInput {
  /** False when the native speech module isn't available on this build. */
  supported: boolean;
  listening: boolean;
  /** Live transcript (interim results included). */
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useVoiceInput(onFinalResult: (text: string) => void): VoiceInput {
  const supported = speech !== null && Platform.OS !== 'web';
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onFinal = useRef(onFinalResult);
  onFinal.current = onFinalResult;

  useEffect(() => {
    if (!supported || !speech) return;
    const subs = [
      speech.ExpoSpeechRecognitionModule.addListener('result', (e) => {
        const text = e.results?.[0]?.transcript ?? '';
        setTranscript(text);
        if (e.isFinal && text) onFinal.current(text);
      }),
      speech.ExpoSpeechRecognitionModule.addListener('end', () => {
        setListening(false);
      }),
      speech.ExpoSpeechRecognitionModule.addListener('error', (e) => {
        setError(e.message ?? e.error ?? 'Speech recognition failed');
        setListening(false);
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [supported]);

  const start = async () => {
    if (!supported || !speech || listening) return;
    setError(null);
    setTranscript('');
    try {
      const perm = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission denied');
        return;
      }
      speech.ExpoSpeechRecognitionModule.start({
        interimResults: true,
        continuous: false,
        // No `lang`: use the device language, so both Turkish and English
        // devices can say player names naturally.
      });
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start voice input');
      setListening(false);
    }
  };

  const stop = () => {
    if (!supported || !speech) return;
    try {
      speech.ExpoSpeechRecognitionModule.stop();
    } catch {
      // already stopped
    }
    setListening(false);
  };

  return { supported, listening, transcript, error, start, stop };
}
