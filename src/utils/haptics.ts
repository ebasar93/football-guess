import { Platform, Vibration } from 'react-native';

/**
 * Vibration feedback. No-ops on web, where there's no reliable device-buzz
 * API, instead of throwing or warning.
 */
export function haptic(patternMs: number | number[]) {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(patternMs as number & number[]);
  } catch {
    // device has no vibration motor / permission denied — ignore
  }
}
