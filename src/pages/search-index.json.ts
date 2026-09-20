import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { categoryLabel, formatTimeShort } from '../lib/recipes';
import { equipmentFor } from '../lib/equipment';
import { LEARN_PATHS, pathHref } from '../lib/learn';
import type { SearchDoc } from '../lib/search';

/**
 * The whole search corpus, served as one static file.
 *
 * It used to be serialised into /search/ as island props: 316 KB of JSON
 * inside a 348 KB page, 92% of it the low-weight `body` field, re-parsed on
 * every visit because HTML is served `must-revalidate`. As a file it is
 * cacheable, and the page itself is now small enough to paint the search box
 * immediately. See src/lib/search-index.ts for the browser half.
 */
export const GET: APIRoute = async () => {
  /** Strip markdown syntax so the index holds words, not punctuation. */
  const plain = (body: string) =>
    body
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#*_`>\[\]()-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const [recipes, guides, journal, lessons] = await Promise.all([
    getCollection('recipes'),
    getCollection('guides'),
    getCollection('journal'),
    getCollection('lessons'),
  ]);

  const pathTitle = (slug: string) =>
    LEARN_PATHS.find((p) => p.slug === slug)?.title ?? slug;

  const docs: SearchDoc[] = [
    {
      type: 'recipe' as const,
      title: 'Iced Coffee Recipes',
      description: 'Explore easy iced coffee recipes including Iced Americano, Iced Latte, shaken espresso, Cold Brew, Espresso Tonic and flavoured coffee drinks.',
      url: '/recipes/iced-coffee/',
      meta: 'Recipe collection',
      keywords: 'iced coffee recipes cold brew iced espresso milk drinks',
      body: 'Iced Americano Iced Latte Brown Sugar Shaken Espresso Iced Caramel Latte Iced Salted Vanilla Cloud Foam Cold Brew Vietnamese Iced Coffee Freddo Espresso Espresso Tonic',
    },
    ...recipes.map((r) => ({
      type: 'recipe' as const,
      title: r.data.title,
      description: r.data.description,
      url: `/recipes/${r.id}/`,
      meta: `${categoryLabel(r.data.category)} · ${formatTimeShort(r.data)}`,
      keywords: [
        categoryLabel(r.data.category),
        r.data.category,
        r.data.brewMethod,
        r.data.temperature,
        r.data.milk,
        ...r.data.seoKeywords,
      ].join(' '),
      body: [
        ...r.data.ingredients.flatMap((ingredient) => [
          ingredient.name,
          ingredient.note ?? '',
          ingredient.displayAmount ?? '',
        ]),
        ...equipmentFor(r.data.equipmentSet),
        ...r.data.equipmentExtra,
        ...r.data.equipmentOptional,
        r.data.vessel.name,
        plain(r.body ?? ''),
      ].join(' '),
    })),
    ...guides.map((g) => ({
      type: 'guide' as const,
      title: g.data.title,
      description: g.data.description,
      url: `/guides/${g.id}/`,
      meta: 'Brew guide',
      keywords: [g.data.method, g.data.difficulty, g.data.quickPick].join(' '),
      summary: g.data.summary,
      body: [
        g.data.bestFor,
        g.data.intent,
        g.data.grind,
        ...g.data.intro,
        ...g.data.howItWorks,
        ...g.data.technique.flatMap((s) => [s.action, s.why]),
        ...g.data.variables.map((v) => v.name),
        ...g.data.choosingCoffee,
        ...(g.data.milk ?? []),
        ...g.data.troubleshooting.flatMap((t) => [t.problem, t.cause, t.first]),
        ...g.data.cleaning,
      ].join(' '),
    })),
    ...LEARN_PATHS.map((p) => ({
      type: 'learn' as const,
      title: p.title,
      description: p.description,
      url: pathHref(p),
      meta: 'Learning path',
      keywords: 'learn learning path',
      summary: p.short,
      body: '',
    })),
    ...lessons.map((l) => ({
      type: 'learn' as const,
      title: l.data.title,
      description: l.data.excerpt,
      url: `/learn/${l.id}/`,
      meta: `${pathTitle(l.data.path)} \u00b7 ${l.data.contentType}`,
      keywords: `${pathTitle(l.data.path)} ${l.data.path} learn ${l.data.contentType}`,
      summary: l.data.seoDescription,
      body: plain(l.body ?? ''),
    })),
    ...journal.map((p) => ({
      type: 'journal' as const,
      title: p.data.title,
      description: p.data.description,
      url: `/journal/${p.id}/`,
      meta: p.data.date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      keywords: [p.data.category ?? '', 'journal'].join(' '),
      summary: p.data.excerpt,
      body: plain(p.body ?? ''),
    })),
  ];

  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
