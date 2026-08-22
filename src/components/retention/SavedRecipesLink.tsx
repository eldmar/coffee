import { useEffect, useMemo, useState } from 'react';
import {
  RETENTION_KEYS,
  getSavedRecipes,
  subscribeRetentionKey,
} from '../../lib/retention/storage';

interface Props {
  validSlugs: string[];
}

export default function SavedRecipesLink({ validSlugs }: Props) {
  const validSlugSet = useMemo(() => new Set(validSlugs), [validSlugs]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const saved = getSavedRecipes().items.filter((entry) => validSlugSet.has(entry.slug));
      setCount(saved.length);
    };

    refresh();
    const unsubscribe = subscribeRetentionKey(RETENTION_KEYS.savedRecipes, refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      unsubscribe();
      window.removeEventListener('pageshow', refresh);
    };
  }, [validSlugSet]);

  return (
    <a
      href="/recipes/saved/"
      data-saved-recipes-link
      aria-label={`Saved recipes, ${count}`}
      className="mt-5 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-line bg-card px-4 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:mt-0"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21Z" />
      </svg>
      <span>Saved recipes</span>
      <span className="text-ink-soft" aria-hidden="true">
        ({count})
      </span>
    </a>
  );
}
