import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useGameActions } from '../hooks/useGameActions';
import { useCustomWordsSubscription } from '../hooks/useCustomWordsSubscription';
import { addCustomWord } from '../services/customWordsService';
import { checkRealWord } from '../utils/validation';

interface AddWordPanelProps {
  roomId: string;
  onSuccess?: () => void;
}

export default function AddWordPanel({ roomId, onSuccess }: AddWordPanelProps) {
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<string | null>(null); // 'checking' | 'valid' | 'not_found' | null
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sugAbortRef = useRef<AbortController | null>(null);
  const validateAbortRef = useRef<AbortController | null>(null);
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
    setValidationStatus(null);

    const trimmed = word.trim().toLowerCase();
    if (!trimmed) {
      setError('Word cannot be empty.');
      return;
    }

    // Step 1: Check if word exists in dictionary (custom validation)
    setValidating(true);
    setValidationStatus('checking');
    
    validateAbortRef.current?.abort();
    const validateController = new AbortController();
    validateAbortRef.current = validateController;

    const checkResult = await checkRealWord(trimmed, validateController.signal);
    
    if (validateController.signal.aborted) {
      setValidating(false);
      return;
    }

    if (checkResult === 'network_error') {
      setError('Network error. Unable to verify word.');
      setValidating(false);
      return;
    }

    if (checkResult === 'not_found') {
      setValidationStatus('not_found');
      setError('Word not found in dictionary.');
      setValidating(false);
      return;
    }

    // Step 2: Word is valid — add to global custom words pool
    setValidationStatus('valid');
    try {
      await addCustomWord(trimmed);
    } catch (err) {
      console.error('Error saving custom word:', err);
      setError('Failed to save word to database.');
      setValidating(false);
      return;
    }

    // Step 3: Proceed with game logic (add to room)
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const result = await handleAddWord(trimmed, controller.signal);
    abortRef.current = null;

    if (controller.signal.aborted) {
      setLoading(false);
      setValidating(false);
      return;
    }

    if (result.error) {
      setError(result.error);
    } else {
      setWord('');
      setValidationStatus(null);
      onSuccess?.();
    }

    setLoading(false);
    setValidating(false);
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
          onChange={(e) => { setWord(e.target.value); setShowSuggestions(false); setActiveIndex(-1); }}
          onBlur={() => setTimeout(() => { setShowSuggestions(false); setActiveIndex(-1); }, 150)}
          onFocus={openSuggestions}
          onKeyDown={handleKeyDown}
          placeholder="Add a word…"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          disabled={loading}
          maxLength={30}
          autoComplete="off"
          inputMode="text"
          enterKeyHint="done"
        />
        {loading || validating ? (
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
            ref={listRef}
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 4,
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
      {(loading || validating) && (
        <p className="text-xs text-gray-400 flex items-center gap-0.5 h-4">
          {validationStatus === 'checking' && (
            <>
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
              <span className="ml-1">Checking word…</span>
            </>
          )}
          {loading && !validating && (
            <>
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </>
          )}
        </p>
      )}
      {validationStatus === 'valid' && !loading && !validating && (
        <p className="text-xs text-green-500">✓ Word is valid!</p>
      )}
      {!loading && !validating && error && <p className="text-red-500 text-xs">{error}</p>}
    </form>
  );
}
