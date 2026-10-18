import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useGameActions } from '../hooks/useGameActions';
import { useCustomWordsSubscription } from '../hooks/useCustomWordsSubscription';

interface AddWordPanelProps {
  roomId: string;
  onSuccess?: () => void;
  /** Show the error bubble under the input (when the dock sits at the top of the screen) */
  popupBelow?: boolean;
}

export default function AddWordPanel({ roomId, onSuccess, popupBelow = false }: AddWordPanelProps) {
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const sugAbortRef = useRef<AbortController | null>(null);
  const suppressSugRef = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);
  const { handleAddWord } = useGameActions(roomId);
  const customWords = useCustomWordsSubscription();

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
        const apiSuggestions = data.map((d) => d.word);
        
        // Merge with custom words (custom words first, then API suggestions)
        const merged = [
          ...customWords.filter((w) => w.startsWith(trimmed.toLowerCase())),
          ...apiSuggestions.filter((w) => !customWords.includes(w)),
        ];
        
        setSuggestions(merged);
        if (inputRef.current === document.activeElement) {
          setDropdownRect(inputRef.current?.getBoundingClientRect() ?? null);
          setShowSuggestions(true);
        }
      } catch {
        // aborted or network error — ignore
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [word, customWords]);

  const selectSuggestion = (w: string) => {
    suppressSugRef.current = true;
    sugAbortRef.current?.abort();
    setWord(w);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = i < suggestions.length - 1 ? i + 1 : 0;
        scrollSuggestionIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = i > 0 ? i - 1 : suggestions.length - 1;
        scrollSuggestionIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const scrollSuggestionIntoView = (index: number) => {
    const item = listRef.current?.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  };

  const openSuggestions = () => {
    if (inputRef.current && suggestions.length > 0) {
      setDropdownRect(inputRef.current.getBoundingClientRect());
      setShowSuggestions(true);
    }
  };

  // Ensure input and dropdown are visible on mobile when virtual keyboard opens
  const ensureInputVisible = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    // Prefer visualViewport if available (gives keyboard height)
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (vv) {
      // Recompute dropdown rect after viewport changes
      setDropdownRect(el.getBoundingClientRect());
      // Compute target scroll so the input is centered inside the visual viewport
      const rect = el.getBoundingClientRect();
      const offsetTop = rect.top - (vv.height / 2) + (rect.height / 2);
      window.scrollTo({ top: window.scrollY + offsetTop, behavior: 'smooth' });
    } else {
      // Fallback: native scrollIntoView
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return undefined;

    const onResize = () => {
      // If input is focused, re-center it
      if (document.activeElement === inputRef.current) {
        ensureInputVisible();
      }
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, [ensureInputVisible]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuggestions([]);
    setShowSuggestions(false);
    setError(null);

    const trimmed = word.trim().toLowerCase();
    if (!trimmed) {
      setError('Word cannot be empty.');
      return;
    }

    // Placing the word is quick (format checks + one write); the dictionary check and
    // linking run in the background, so the input is free for the next word right away
    setPlacing(true);
    const result = await handleAddWord(trimmed);
    setPlacing(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setWord('');
    onSuccess?.();
    result.done.then((problem) => {
      if (problem) setError(problem);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
      <div className="relative flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={word}
          onChange={(e) => { setWord(e.target.value); setError(null); setShowSuggestions(false); setActiveIndex(-1); }}
          onBlur={() => setTimeout(() => { setShowSuggestions(false); setActiveIndex(-1); }, 150)}
          onFocus={openSuggestions}
          onKeyDown={handleKeyDown}
          placeholder="Add a word…"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          disabled={placing}
          maxLength={30}
          autoComplete="off"
          inputMode="text"
          enterKeyHint="done"
        />
        <button
          type="submit"
          disabled={!word.trim() || placing}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
        {showSuggestions && suggestions.length > 0 && dropdownRect && createPortal(
          <ul
            ref={listRef}
            style={{
              position: 'fixed',
              // The input usually sits in the bottom dock, so open upward when in the lower half
              ...(dropdownRect.top > window.innerHeight / 2
                ? { bottom: window.innerHeight - dropdownRect.top + 4 }
                : { top: dropdownRect.bottom + 4 }),
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
            }}
            className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={() => selectSuggestion(s)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    i === activeIndex
                      ? 'bg-gray-200 text-gray-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
      </div>
      {/* Floats above the dock so the input never moves when a message appears */}
      {error && (
        <p
          role="alert"
          className={`absolute left-0 right-0 px-3 py-2 rounded-xl bg-white border border-red-200 shadow-lg text-red-500 text-xs ${popupBelow ? 'top-full mt-3' : 'bottom-full mb-3'}`}
        >
          {error}
        </p>
      )}
    </form>
  );
}
