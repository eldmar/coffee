import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../../lib/analytics';
import {
  RETENTION_KEYS,
  getSavedRecipes,
  setRecipeSaved,
  subscribeRetentionKey,
  type SavedRecipeEntry,
} from '../../lib/retention/storage';
import RecentlyViewed from './RecentlyViewed';
import RetentionRecipeCard, { type RetentionRecipe } from './RetentionRecipeCard';

interface Props {
  recipes: RetentionRecipe[];
}

export default function SavedRecipesPage({ recipes }: Props) {
  const [entries, setEntries] = useState<SavedRecipeEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setEntries(getSavedRecipes().items);
    refresh();
    setHydrated(true);
    trackRetentionEvent('saved_recipes_opened', {});
    return subscribeRetentionKey(RETENTION_KEYS.savedRecipes, refresh);
  }, []);

  const saved = useMemo(() => {
    const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]));
    return [...entries]
      .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))
      .map((entry) => bySlug.get(entry.slug))
      .filter((recipe): recipe is RetentionRecipe => Boolean(recipe));
  }, [entries, recipes]);

  return (
    <>
      {hydrated && (
        <p className="mt-6 text-sm font-medium text-ink-soft" aria-live="polite">
          {saved.length} saved {saved.length === 1 ? 'recipe' : 'recipes'}
        </p>
      )}
      <div className="mt-8 min-h-48" aria-live="polite">
        {!hydrated ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-lg border border-line bg-card" />
            ))}
          </div>
        ) : saved.length === 0 ? (
          <div className="border-y border-line py-12 text-center">
            <h2 className="font-display text-2xl font-medium">No saved recipes yet</h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              Save recipes you want to brew again and they'll appear here on this device.
            </p>
            <a
              href="/recipes/"
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-ink hover:bg-accent-dark"
            >
              Browse recipes <span aria-hidden="true">&#8594;</span>
            </a>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((recipe) => (
              <li key={recipe.slug}>
                <RetentionRecipeCard
                  recipe={recipe}
                  onRemove={() => {
                    setRecipeSaved(recipe.slug, false);
                    trackRetentionEvent('recipe_removed', { recipe_slug: recipe.slug });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecentlyViewed recipes={recipes} className="mt-16 border-t border-line pt-10" />
    </>
  );
}
