import { useState, useRef, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useGameActions } from '../hooks/useGameActions';

interface AddWordPanelProps {
  roomId: string;
  onSuccess?: () => void;
}

export default function AddWordPanel({ roomId, onSuccess }: AddWordPanelProps) {
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sugAbortRef = useRef<AbortController | null>(null);
  const suppressSugRef = useRef(false);
  const { handleAddWord } = useGameActions(roomId);

  // Fetch autocomplete suggestions with debounce
  useEffect(() => {
    const trimmed = word.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (suppressSugRef.current) { suppressSugRef.current = false; return; }
      sugAbortRef.current?.abort();
      const controller = new AbortController();
      sugAbortRef.current = controller;
      try {
        const res = await fetch(
          `https://api.datamuse.com/sug?s=${encodeURIComponent(trimmed)}&max=6`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as Array<{ word: string }>;
        setSuggestions(data.map((d) => d.word));
        if (inputRef.current === document.activeElement) {
          setDropdownRect(inputRef.current.getBoundingClientRect());
          setShowSuggestions(true);
        }
      } catch {
        // aborted or network error — ignore
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [word]);

  const selectSuggestion = (w: string) => {
    suppressSugRef.current = true;
    sugAbortRef.current?.abort();
    setWord(w);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const openSuggestions = () => {
    if (inputRef.current && suggestions.length > 0) {
      setDropdownRect(inputRef.current.getBoundingClientRect());
      setShowSuggestions(true);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuggestions([]);
    setShowSuggestions(false);
    setError(null);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const result = await handleAddWord(word.trim(), controller.signal);
    abortRef.current = null;

    if (controller.signal.aborted) {
      setLoading(false);
      return;
    }

    if (result.error) {
      setError(result.error);
    } else {
      setWord('');
      onSuccess?.();
    }

    setLoading(false);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="relative flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={word}
          onChange={(e) => { setWord(e.target.value); setShowSuggestions(false); }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={openSuggestions}
          placeholder="Add a word…"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          disabled={loading}
          maxLength={30}
          autoComplete="off"
          inputMode="text"
          enterKeyHint="done"
        />
        {loading ? (
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={!word.trim()}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        )}
        {showSuggestions && suggestions.length > 0 && !loading && dropdownRect && createPortal(
          <ul
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 4,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
            }}
            className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
          >
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
      </div>
      {loading && (
        <p className="text-xs text-gray-400 flex items-center gap-0.5 h-4">
          <span className="animate-bounce [animation-delay:0ms]">.</span>
          <span className="animate-bounce [animation-delay:150ms]">.</span>
          <span className="animate-bounce [animation-delay:300ms]">.</span>
        </p>
      )}
      {!loading && error && <p className="text-red-500 text-xs">{error}</p>}
    </form>
  );
}
