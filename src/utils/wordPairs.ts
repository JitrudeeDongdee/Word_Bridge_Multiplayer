// 90 curated word pairs across 6 categories for maximum variety
export type PairCategory = 'contrast' | 'nature' | 'journey' | 'abstract' | 'science' | 'story';

interface WordPairEntry {
  pair: [string, string];
  category: PairCategory;
}

const WORD_PAIRS_DATA: WordPairEntry[] = [
  // ── contrast ────────────────────────────────────────────────────────────────
  { pair: ['fire',    'snow'],      category: 'contrast' },
  { pair: ['ocean',   'mountain'],  category: 'contrast' },
  { pair: ['day',     'night'],     category: 'contrast' },
  { pair: ['war',     'peace'],     category: 'contrast' },
  { pair: ['love',    'hate'],      category: 'contrast' },
  { pair: ['rich',    'poor'],      category: 'contrast' },
  { pair: ['light',   'dark'],      category: 'contrast' },
  { pair: ['young',   'ancient'],   category: 'contrast' },
  { pair: ['king',    'peasant'],   category: 'contrast' },
  { pair: ['hero',    'villain'],   category: 'contrast' },
  { pair: ['victory', 'defeat'],    category: 'contrast' },
  { pair: ['birth',   'death'],     category: 'contrast' },
  { pair: ['giant',   'tiny'],      category: 'contrast' },
  { pair: ['brave',   'timid'],     category: 'contrast' },
  { pair: ['feast',   'famine'],    category: 'contrast' },

  // ── nature ───────────────────────────────────────────────────────────────────
  { pair: ['volcano',    'glacier'],  category: 'nature' },
  { pair: ['coral',      'tundra'],   category: 'nature' },
  { pair: ['rainforest', 'desert'],   category: 'nature' },
  { pair: ['tornado',    'rainbow'],  category: 'nature' },
  { pair: ['cave',       'summit'],   category: 'nature' },
  { pair: ['river',      'stone'],    category: 'nature' },
  { pair: ['bloom',      'frost'],    category: 'nature' },
  { pair: ['whale',      'eagle'],    category: 'nature' },
  { pair: ['jungle',     'meadow'],   category: 'nature' },
  { pair: ['tide',       'drought'],  category: 'nature' },
  { pair: ['forest',     'cliff'],    category: 'nature' },
  { pair: ['seed',       'ash'],      category: 'nature' },
  { pair: ['reef',       'dune'],     category: 'nature' },
  { pair: ['lightning',  'dew'],      category: 'nature' },
  { pair: ['swamp',      'aurora'],   category: 'nature' },

  // ── journey ──────────────────────────────────────────────────────────────────
  { pair: ['space',      'underground'], category: 'journey' },
  { pair: ['island',     'mainland'],    category: 'journey' },
  { pair: ['harbor',     'horizon'],     category: 'journey' },
  { pair: ['crossroads', 'destination'], category: 'journey' },
  { pair: ['compass',    'anchor'],      category: 'journey' },
  { pair: ['bridge',     'abyss'],       category: 'journey' },
  { pair: ['path',       'wall'],        category: 'journey' },
  { pair: ['voyage',     'shelter'],     category: 'journey' },
  { pair: ['frontier',   'home'],        category: 'journey' },
  { pair: ['summit',     'valley'],      category: 'journey' },
  { pair: ['sunrise',    'midnight'],    category: 'journey' },
  { pair: ['map',        'labyrinth'],   category: 'journey' },
  { pair: ['lighthouse', 'wreck'],       category: 'journey' },
  { pair: ['runway',     'burrow'],      category: 'journey' },
  { pair: ['port',       'wasteland'],   category: 'journey' },

  // ── abstract ─────────────────────────────────────────────────────────────────
  { pair: ['memory',    'forgetting'], category: 'abstract' },
  { pair: ['chaos',     'order'],      category: 'abstract' },
  { pair: ['secret',    'truth'],      category: 'abstract' },
  { pair: ['fear',      'courage'],    category: 'abstract' },
  { pair: ['hope',      'despair'],    category: 'abstract' },
  { pair: ['freedom',   'captivity'],  category: 'abstract' },
  { pair: ['dream',     'reality'],    category: 'abstract' },
  { pair: ['wisdom',    'folly'],      category: 'abstract' },
  { pair: ['pride',     'shame'],      category: 'abstract' },
  { pair: ['faith',     'doubt'],      category: 'abstract' },
  { pair: ['justice',   'mercy'],      category: 'abstract' },
  { pair: ['luck',      'fate'],       category: 'abstract' },
  { pair: ['time',      'eternity'],   category: 'abstract' },
  { pair: ['innocence', 'guilt'],      category: 'abstract' },
  { pair: ['silence',   'clamor'],     category: 'abstract' },

  // ── science ───────────────────────────────────────────────────────────────────
  { pair: ['atom',     'cosmos'],     category: 'science' },
  { pair: ['spark',    'vacuum'],     category: 'science' },
  { pair: ['gravity',  'orbit'],      category: 'science' },
  { pair: ['fossil',   'seedling'],   category: 'science' },
  { pair: ['virus',    'cure'],       category: 'science' },
  { pair: ['machine',  'garden'],     category: 'science' },
  { pair: ['code',     'instinct'],   category: 'science' },
  { pair: ['crystal',  'gas'],        category: 'science' },
  { pair: ['echo',     'origin'],     category: 'science' },
  { pair: ['signal',   'static'],     category: 'science' },
  { pair: ['mutation', 'blueprint'],  category: 'science' },
  { pair: ['element',  'void'],       category: 'science' },
  { pair: ['energy',   'entropy'],    category: 'science' },
  { pair: ['pattern',  'noise'],      category: 'science' },
  { pair: ['data',     'emotion'],    category: 'science' },

  // ── story ─────────────────────────────────────────────────────────────────────
  { pair: ['crown',       'exile'],     category: 'story' },
  { pair: ['dragon',      'knight'],    category: 'story' },
  { pair: ['magic',       'reason'],    category: 'story' },
  { pair: ['myth',        'fact'],      category: 'story' },
  { pair: ['ghost',       'body'],      category: 'story' },
  { pair: ['witch',       'harvest'],   category: 'story' },
  { pair: ['curse',       'blessing'],  category: 'story' },
  { pair: ['prophecy',    'accident'],  category: 'story' },
  { pair: ['legend',      'proof'],     category: 'story' },
  { pair: ['monster',     'guardian'],  category: 'story' },
  { pair: ['quest',       'rest'],      category: 'story' },
  { pair: ['shadow',      'lantern'],   category: 'story' },
  { pair: ['riddle',      'answer'],    category: 'story' },
  { pair: ['oracle',      'skeptic'],   category: 'story' },
  { pair: ['enchantment', 'logic'],     category: 'story' },
];

// Legacy export used by existing code paths that just want the raw pairs
export const WORD_PAIRS: [string, string][] = WORD_PAIRS_DATA.map((e) => e.pair);

/**
 * Picks a word pair that avoids recently-used pairs and recently-used categories.
 * @param usedPairs  History of used pairs stored as "wordA/wordB" strings (oldest → newest).
 */
export function pickWordPair(usedPairs: string[] = [], customWords?: string[]): [string, string] {
  const usedSet = new Set(usedPairs);

  // Determine categories used in the last 3 rounds so we can rotate away from them
  const recentCategories = new Set(
    usedPairs
      .slice(-3)
      .map((p) => WORD_PAIRS_DATA.find((e) => `${e.pair[0]}/${e.pair[1]}` === p)?.category)
      .filter((c): c is PairCategory => c !== undefined),
  );

  // If a custom word pool is provided and has >= 2 words, prefer picking two from it
  if (customWords && customWords.length >= 2) {
    // Attempt to pick two distinct words from customWords that haven't been used together recently
    const pool = Array.from(new Set(customWords.map((w) => w.toLowerCase())));
    const attempts = Math.min(20, pool.length * 2);
    for (let i = 0; i < attempts; i++) {
      const a = pool[Math.floor(Math.random() * pool.length)];
      let b = pool[Math.floor(Math.random() * pool.length)];
      // ensure distinct
      if (a === b) continue;
      // avoid recently used pair in either order
      if (usedSet.has(`${a}/${b}`) || usedSet.has(`${b}/${a}`)) continue;
      return [a, b];
    }
    // If we couldn't find a fresh pair, fall through to curated list
  }

  // 1st preference: unused pair from a fresh category
  let candidates = WORD_PAIRS_DATA.filter(
    (e) => !usedSet.has(`${e.pair[0]}/${e.pair[1]}`) && !recentCategories.has(e.category),
  );

  // 2nd preference: any unused pair
  if (candidates.length === 0) {
    candidates = WORD_PAIRS_DATA.filter((e) => !usedSet.has(`${e.pair[0]}/${e.pair[1]}`));
  }

  // Fallback: all pairs (full cycle reset)
  if (candidates.length === 0) candidates = WORD_PAIRS_DATA;

  return candidates[Math.floor(Math.random() * candidates.length)].pair;
}

