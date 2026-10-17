/** Word pronunciation via the browser's built-in speech synthesis (no API, no key). */

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/** Prefer an English voice; voices can load late, so fall back to the lang hint alone. */
function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'en-US') ?? voices.find((v) => v.lang.startsWith('en'));
}

/**
 * Reads a word aloud. Cancels anything already playing so taps never queue up.
 * Resolves when speech ends (or fails), so callers can show a "speaking" state.
 */
export function speakWord(word: string): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  const synth = window.speechSynthesis;
  synth.cancel();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    const voice = englishVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}
