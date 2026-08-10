import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/recipes' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    image: z.string(),
    imageAlt: z.string(),
    // Shown above the recipe, e.g. an age advisory on alcoholic drinks.
    notice: z.string().optional(),
    category: z.enum([
      'espresso-drinks',
      'milk-drinks',
      'filter-coffee',
      'iced-coffee',
      'coffee-desserts',
      'coffee-cocktails',
      'brewing-methods',
    ]),
    brewMethod: z.enum([
      'espresso',
      'aeropress',
      'v60',
      'french-press',
      'moka-pot',
      'cold-brew',
      'filter',
      'phin',
      'cezve',
    ]),
    temperature: z.enum(['hot', 'iced']),
    milk: z.enum(['black', 'milk']),
    // All times in minutes. activeTime is hands-on; totalTime is elapsed.
    prepTime: z.number(),
    brewTime: z.number(),
    activeTime: z.number(),
    totalTime: z.number(),
    // Set when a range is more honest than a single number, e.g. "12–18 hr".
    totalTimeLabel: z.string().optional(),
    // Set when minutes are the wrong unit, e.g. an espresso shot in seconds.
    // Brew guides read their Quick start time from here, so it stays canonical.
    brewTimeLabel: z.string().optional(),
    yield: z.string().default('1 drink'),
    // Ground coffee going in, and the volume of finished drink coming out —
    // not the same thing as the capacity of the cup it is served in.
    dose: z.string(),
    drinkYield: z.string(),
    // Brew-method recipes only, where coffee-to-water is the whole recipe.
    water: z.string().optional(),
    brewerSize: z.string().optional(),
    vessel: z.object({
      name: z.string(),
      capacity: z.string(),
    }),
    author: z.string().default('KAVOVO'),
    datePublished: z.coerce.date(),
    dateModified: z.coerce.date(),
    ingredients: z.array(z.string()),
    // Essentials come from the shared dictionary; extras stay per recipe.
    equipmentSet: z.enum([
      'espresso',
      'milk',
      'americano',
      'aeropress',
      'french-press',
      'pour-over',
      'moka-pot',
      'cold-brew',
      'filter',
      'phin',
      'cezve',
    ]),
    // Essential but specific to one recipe, e.g. a teaspoon for a macchiato.
    equipmentExtra: z.array(z.string()).default([]),
    equipmentOptional: z.array(z.string()).default([]),
    popular: z.boolean().default(false),
  }),
});

const namedNote = z.object({ name: z.string(), note: z.string() });

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    // description is the meta description and the lede on the guide page.
    description: z.string(),
    method: z.enum(['espresso', 'aeropress', 'v60', 'french-press', 'moka-pot']),
    readingTime: z.number().int().positive(),

    // The homepage chooser compares methods with these five.
    summary: z.string(),
    cupStyle: z.string(),
    brewTime: z.string(),
    bestFor: z.string(),
    // "I want …" — the phrasing someone uses before they know the method name.
    intent: z.string(),

    // Comparison table on /guides/. Difficulty lives here and nowhere else:
    // on a recipe page it says nothing useful, but between methods it does.
    serving: z.string(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    equipmentCost: z.enum(['Low', 'Medium', 'High']),
    cleaningEffort: z.string(),
    // The shortcut chip above the table. One per method, so every column is
    // reachable from the quick links.
    quickPick: z.string(),

    // Quick start reads dose, water, time, brewer and the photo from this
    // recipe, so a recipe change cannot leave the guide quoting stale numbers.
    // Only what the recipe does not hold lives here.
    canonicalRecipe: z.string(),
    grind: z.string(),
    temperature: z.string(),
    // Espresso's basket is not a recipe field; every other method has brewerSize.
    brewerNote: z.string().optional(),

    intro: z.array(z.string()),
    equipmentEssential: z.array(namedNote),
    equipmentOptional: z.array(namedNote),
    howItWorks: z.array(z.string()),
    // Each step says what to do and why it matters.
    technique: z.array(z.object({ action: z.string(), why: z.string() })),
    variables: z.array(
      z.object({ name: z.string(), effect: z.string(), when: z.string() }),
    ),
    tasteAdjustments: z.array(
      z.object({ result: z.string(), cause: z.string(), change: z.string() }),
    ),
    choosingCoffee: z.array(z.string()),
    // Espresso only: milk is part of the method rather than an afterthought.
    milk: z.array(z.string()).optional(),
    troubleshooting: z.array(
      z.object({
        problem: z.string(),
        cause: z.string(),
        first: z.string(),
        next: z.string(),
      }),
    ),
    cleaning: z.array(z.string()),
    // Site-relative hrefs, checked by scripts/check-build.mjs.
    relatedLearning: z.array(
      z.object({ label: z.string(), href: z.string().startsWith('/'), why: z.string() }),
    ),
    // Used once per page, above the technique steps.
    keyPoint: z.string(),
    // A safety warning where the method has one, e.g. the moka pot valve.
    notice: z.string().optional(),
  }),
});

const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    // description is the meta description; excerpt is the lede on the page.
    description: z.string(),
    excerpt: z.string().optional(),
    date: z.coerce.date(),
    category: z.string().optional(),
    readingTime: z.number().int().positive().optional(),
    // Manifest key in src/lib/photos.json, like every other photo on the site.
    image: z.string().optional(),
    imageAlt: z.string().optional(),
  }),
});

/**
 * Learn lessons. The file path carries the routing: a lesson living at
 * `coffee-basics/grind-size.md` is served from `/learn/coffee-basics/grind-size/`,
 * so `path` and the folder name must agree.
 */
const lessons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lessons' }),
  schema: z.object({
    path: z.enum(['coffee-basics', 'dial-in-espresso', 'understand-your-beans']),
    order: z.number().int().positive(),
    title: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string(),
    excerpt: z.string(),
    readingTime: z.number().int().positive(),
    // Manifest key in src/lib/photos.json, set once the photo exists. The brief
    // is the record of what to shoot; the alt text is written ahead of it so a
    // new photo only needs the `image` line adding.
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageBrief: z.string().optional(),
    // Where to go next once the lesson makes sense. Hand-picked per lesson;
    // hrefs are site-relative and checked by scripts/check-build.mjs.
    related: z
      .array(z.object({ label: z.string(), href: z.string().startsWith('/') }))
      .default([]),
  }),
});

export const collections = { recipes, guides, journal, lessons };
