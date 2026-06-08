import { useEffect, useState } from 'react';
import { getCardByName } from '@/services/scryfall/client';

const artCropCache = new Map<string, string | null>();

/**
 * Lazy-fetch the Scryfall `art_crop` URL for a card name (front-face for DFCs).
 * Returns `null` while loading or if the card can't be fetched.
 */
export function useCommanderArt(name: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!name) return null;
    return artCropCache.get(name) ?? null;
  });

  useEffect(() => {
    if (!name) {
      setUrl(null);
      return;
    }
    const cached = artCropCache.get(name);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const card = await getCardByName(name);
        const art =
          card.image_uris?.art_crop ??
          card.card_faces?.[0]?.image_uris?.art_crop ??
          null;
        artCropCache.set(name, art);
        if (!cancelled) setUrl(art);
      } catch {
        artCropCache.set(name, null);
        if (!cancelled) setUrl(null);
      }
    })();

    return () => { cancelled = true; };
  }, [name]);

  return url;
}
