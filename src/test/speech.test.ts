import { describe, it, expect, vi, afterEach } from 'vitest';

class FakeUtterance {
  lang = '';
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

function installSpeech(voices: Array<{ lang: string; name: string }>) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    cancel: vi.fn(),
    getVoices: () => voices,
    speak: (u: FakeUtterance) => { spoken.push(u); setTimeout(() => u.onend?.(), 0); },
  };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return { synth, spoken };
}

describe('speakWord', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('speaks the word in English, cancelling anything already playing', async () => {
    const { synth, spoken } = installSpeech([{ lang: 'th-TH', name: 'Thai' }, { lang: 'en-GB', name: 'UK' }, { lang: 'en-US', name: 'US' }]);
    const { speakWord, canSpeak } = await import('../utils/speech');
    expect(canSpeak()).toBe(true);
    await speakWord('lantern');
    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken[0]).toMatchObject({ text: 'lantern', lang: 'en-US', voice: { name: 'US' } });
  });

  it('still speaks with the language hint when no voices have loaded yet', async () => {
    const { spoken } = installSpeech([]);
    const { speakWord } = await import('../utils/speech');
    await speakWord('harbor');
    expect(spoken[0]).toMatchObject({ text: 'harbor', lang: 'en-US', voice: null });
  });

  it('does nothing when the browser has no speech synthesis', async () => {
    const { speakWord, canSpeak } = await import('../utils/speech');
    expect(canSpeak()).toBe('speechSynthesis' in window);
    if (!canSpeak()) await expect(speakWord('x')).resolves.toBeUndefined();
  });
});
