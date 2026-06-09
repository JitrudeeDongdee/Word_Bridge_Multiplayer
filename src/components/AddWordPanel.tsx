import { useState, type FormEvent } from 'react';
import { useGameActions } from '../hooks/useGameActions';

interface AddWordPanelProps {
  roomId: string;
}

export default function AddWordPanel({ roomId }: AddWordPanelProps) {
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { handleAddWord } = useGameActions(roomId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await handleAddWord(word.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setWord('');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Add a word…"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          disabled={loading}
          maxLength={30}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !word.trim()}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '…' : 'Add'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </form>
  );
}
