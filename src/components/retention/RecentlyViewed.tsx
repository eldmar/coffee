import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../../lib/analytics';
import {
  RETENTION_KEYS,
  clearRecentRecipes,
  getRecentRecipes,
  subscribeRetentionKey,
  type RecentRecipeEntry,
} from '../../lib/retention/storage';
import RetentionRecipeCard, { type RetentionRecipe } from './RetentionRecipeCard';

interface Props {
  recipes: RetentionRecipe[];
  currentSlug?: string;
  className?: string;
  limit?: number;
}

export default function RecentlyViewed({
  recipes,
  currentSlug,
  className = '',
  limit = 4,
}: Props) {
  const [entries, setEntries] = useState<RecentRecipeEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setEntries(getRecentRecipes().items);
    refresh();
    setHydrated(true);
    return subscribeRetentionKey(RETENTION_KEYS.recentRecipes, refresh);
  }, []);

  const visible = useMemo(() => {
    const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]));
    return entries
      .filter((entry) => entry.slug !== currentSlug)
      .map((entry) => bySlug.get(entry.slug))
      .filter((recipe): recipe is RetentionRecipe => Boolean(recipe))
      .slice(0, limit);
  }, [currentSlug, entries, limit, recipes]);

  if (!hydrated || visible.length < 2) return null;

  return (
    <section className={className} aria-labelledby="recently-viewed-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Your history</span>
          <h2 id="recently-viewed-heading" className="mt-2 font-display text-2xl font-medium">
            Recently viewed
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            clearRecentRecipes();
            trackRetentionEvent('recent_history_cleared', {});
          }}
          className="min-h-11 shrink-0 px-2 text-sm font-medium text-ink-soft hover:text-ink hover:underline"
        >
          Clear history
        </button>
      </div>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((recipe) => (
          <li key={recipe.slug}>
            <RetentionRecipeCard
              recipe={recipe}
              onOpen={() =>
                trackRetentionEvent('recent_recipe_opened', { recipe_slug: recipe.slug })
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
