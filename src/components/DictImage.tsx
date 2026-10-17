import { useEffect, useState } from 'react';
import { lookupWikiImage, type WikiImage } from '../services/wikiImage';

/** Picture for a 📖 Dict card. Renders nothing while loading or when there is no image. */
export default function DictImage({ word }: { word: string }) {
  // Keyed by word so a reused component never shows the previous word's image
  const [result, setResult] = useState<{ word: string; image: WikiImage | null } | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    lookupWikiImage(word).then((image) => {
      if (!cancelled) setResult({ word, image });
    });
    return () => {
      cancelled = true;
    };
  }, [word]);

  const image = result?.word === word ? result.image : null;
  if (!image || broken) return null;

  return (
    <figure className="flex flex-col gap-0.5">
      <img
        src={image.src}
        alt={image.title}
        loading="lazy"
        onError={() => setBroken(true)}
        className="w-full max-h-32 object-cover rounded-md bg-gray-100"
      />
      <figcaption className="text-[10px] text-gray-400 text-right">
        <a href={image.pageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {image.title} · Wikipedia
        </a>
      </figcaption>
    </figure>
  );
}
