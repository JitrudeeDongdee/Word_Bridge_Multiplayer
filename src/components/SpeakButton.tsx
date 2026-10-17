import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { canSpeak, speakWord } from '../utils/speech';

/** Speaker button that reads a word aloud. Renders nothing if the browser can't speak. */
export default function SpeakButton({ word }: { word: string }) {
  const [speaking, setSpeaking] = useState(false);
  if (!canSpeak()) return null;

  const speak = async () => {
    setSpeaking(true);
    await speakWord(word);
    setSpeaking(false);
  };

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`Pronounce ${word}`}
      title="Listen"
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
        speaking ? 'text-brand-600 bg-brand-50 animate-pulse' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'
      }`}
    >
      <Volume2 className="w-4 h-4" aria-hidden />
    </button>
  );
}
