import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../../lib/analytics';
import { loadRetentionCatalogue } from '../../lib/retention/catalogue';
import {
  RETENTION_KEYS,
  getSavedRecipes,
  setRecipeSaved,
  subscribeRetentionKey,
  type SavedRecipeEntry,
} from '../../lib/retention/storage';
import RecentlyViewed from './RecentlyViewed';
import RetentionRecipeCard, { type RetentionRecipe } from './RetentionRecipeCard';

export default function SavedRecipesPage() {
  const [entries, setEntries] = useState<SavedRecipeEntry[]>([]);
  const [catalogue, setCatalogue] = useState<RetentionRecipe[]>();
  const [hydrated, setHydrated] = useState(false);
  const [removalAnnouncement, setRemovalAnnouncement] = useState(0);

  useEffect(() => {
    const refresh = () => setEntries(getSavedRecipes().items);
    refresh();
    setHydrated(true);
    trackRetentionEvent('saved_recipes_opened', {});
    const unsubscribe = subscribeRetentionKey(RETENTION_KEYS.savedRecipes, refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      unsubscribe();
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  // Nobody with an empty collection needs the catalogue, and anybody with a
  // full one must not see the empty state flash while it arrives — hence
  // `ready` rather than `hydrated` in the render below.
  useEffect(() => {
    if (entries.length === 0 || catalogue) return;

    let active = true;
    void loadRetentionCatalogue().then((loaded) => {
      if (active) setCatalogue(loaded);
    });
    return () => {
      active = false;
    };
  }, [catalogue, entries.length]);

  const ready = hydrated && (entries.length === 0 || catalogue !== undefined);

  const saved = useMemo(() => {
    const bySlug = new Map((catalogue ?? []).map((recipe) => [recipe.slug, recipe]));
    return [...entries]
      .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))
      .map((entry) => bySlug.get(entry.slug))
      .filter((recipe): recipe is RetentionRecipe => Boolean(recipe));
  }, [catalogue, entries]);

  return (
    <>
      {ready && (
        <p className="mt-6 text-sm font-medium text-ink-soft">
          {saved.length} saved {saved.length === 1 ? 'recipe' : 'recipes'}
        </p>
      )}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-2 min-h-5 text-sm font-medium text-accent"
      >
        {removalAnnouncement > 0 && (
          <span key={removalAnnouncement}>Recipe removed from saved recipes.</span>
        )}
      </div>
      <div className="mt-3 min-h-48">
        {!ready ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-lg border border-line bg-card" />
            ))}
          </div>
        ) : saved.length === 0 ? (
          <div className="border-y border-line py-12 text-center">
            <h2 className="font-display text-2xl font-medium">No saved recipes yet</h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              Save recipes you want to brew again and they'll appear here.
            </p>
            <a
              href="/recipes/"
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-ink hover:bg-accent-dark"
            >
              Explore recipes <span aria-hidden="true">&#8594;</span>
            </a>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((recipe) => (
              <li key={recipe.slug}>
                <RetentionRecipeCard
                  recipe={recipe}
                  headingLevel="h2"
                  onRemove={() => {
                    setRecipeSaved(recipe.slug, false);
                    setRemovalAnnouncement((current) => current + 1);
                    trackRetentionEvent('recipe_removed', { recipe_slug: recipe.slug });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecentlyViewed className="mt-16 border-t border-line pt-10" />
    </>
  );
}
