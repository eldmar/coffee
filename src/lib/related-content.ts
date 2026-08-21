export interface RelatedRecipeData {
  slug: string;
  title: string;
  category: string;
  brewMethod: string;
  temperature: string;
  milk: string;
  ingredientNames: string[];
  seasonalTags?: string[];
  popular?: boolean;
}

const GENERIC_INGREDIENT_WORDS = new Set([
  'coffee',
  'espresso',
  'water',
  'milk',
  'ice',
  'freshly',
  'ground',
  'cold',
  'hot',
  'filtered',
  'whole',
  'target',
  'yield',
  'or',
  'and',
  'for',
  'the',
]);

function ingredientTokens(names: string[]): Set<string> {
  return new Set(
    names
      .flatMap((name) => name.toLowerCase().split(/[^a-z0-9]+/))
      .filter((word) => word.length > 2 && !GENERIC_INGREDIENT_WORDS.has(word)),
  );
}

function intersects(left: Iterable<string>, right: Set<string>): boolean {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

export function relatedRecipeScore(
  source: RelatedRecipeData,
  candidate: RelatedRecipeData,
): number {
  let score = 0;
  if (candidate.category === source.category) score += 4;
  if (candidate.brewMethod === source.brewMethod) score += 3;
  if (candidate.temperature === source.temperature) score += 2;
  if (candidate.milk === source.milk) score += 1;
  if (intersects(ingredientTokens(source.ingredientNames), ingredientTokens(candidate.ingredientNames))) {
    score += 1;
  }
  if (intersects(source.seasonalTags ?? [], new Set(candidate.seasonalTags ?? []))) score += 1;
  return score;
}

export function selectRelatedRecipeSlugs(
  source: RelatedRecipeData,
  candidates: RelatedRecipeData[],
  manual: string[] = [],
  limit = 2,
): string[] {
  const available = candidates.filter((candidate) => candidate.slug !== source.slug);
  const bySlug = new Map(available.map((candidate) => [candidate.slug, candidate]));
  const selected: RelatedRecipeData[] = [];
  const selectedSlugs = new Set<string>();
  const categoryCounts = new Map<string, number>();

  const add = (candidate: RelatedRecipeData | undefined) => {
    if (!candidate || selectedSlugs.has(candidate.slug) || selected.length >= limit) return;
    if ((categoryCounts.get(candidate.category) ?? 0) >= 2) return;
    selected.push(candidate);
    selectedSlugs.add(candidate.slug);
    categoryCounts.set(candidate.category, (categoryCounts.get(candidate.category) ?? 0) + 1);
  };

  manual.forEach((slug) => add(bySlug.get(slug)));

  available
    .filter((candidate) => !selectedSlugs.has(candidate.slug))
    .sort((left, right) => {
      const scoreDifference = relatedRecipeScore(source, right) - relatedRecipeScore(source, left);
      if (scoreDifference) return scoreDifference;
      const popularityDifference = Number(right.popular) - Number(left.popular);
      if (popularityDifference) return popularityDifference;
      return left.slug.localeCompare(right.slug);
    })
    .forEach(add);

  return selected.map((candidate) => candidate.slug);
}
