import { Platform } from 'react-native';

let nativeSpeech: typeof import('expo-speech') | null = null;

async function getNativeSpeech(): Promise<typeof import('expo-speech') | null> {
  if (nativeSpeech) return nativeSpeech;
  try {
    nativeSpeech = await import('expo-speech');
    return nativeSpeech;
  } catch {
    return null;
  }
}

/** Speak a prompt: Web Speech API on web, expo-speech on device. Never throws. */
export async function speakSafe(text: string): Promise<void> {
  if (!text) return;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return;
    }
    const S = await getNativeSpeech();
    S?.stop();
    S?.speak(text);
  } catch {
    /* TTS unavailable */
  }
}

export async function stopSafe(): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      return;
    }
    (await getNativeSpeech())?.stop();
  } catch {
    /* noop */
  }
}
