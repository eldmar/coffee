import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { cardImage } from '../lib/cardImage';
import type { RetentionRecipe } from '../components/retention/RetentionRecipeCard';

/**
 * The catalogue behind Recently viewed and Saved recipes, served as one static
 * file instead of being inlined into every page that carries those widgets.
 * See src/lib/retention/catalogue.ts for why.
 */
export const GET: APIRoute = async () => {
  const recipes: RetentionRecipe[] = (await getCollection('recipes')).map((recipe) => ({
    slug: recipe.id,
    title: recipe.data.title,
    image: cardImage(recipe.data.image),
    imageAlt: recipe.data.imageAlt,
    category: recipe.data.category,
    activeTime: recipe.data.activeTime,
    totalTime: recipe.data.totalTime,
    totalTimeLabel: recipe.data.totalTimeLabel,
  }));

  return new Response(JSON.stringify(recipes), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
