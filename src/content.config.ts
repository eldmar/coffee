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
    category: z.enum([
      'espresso-drinks',
      'milk-drinks',
      'filter-coffee',
      'iced-coffee',
      'coffee-desserts',
      'brewing-methods',
    ]),
    brewMethod: z.enum(['espresso', 'aeropress', 'v60', 'french-press', 'moka-pot', 'cold-brew']),
    temperature: z.enum(['hot', 'iced']),
    milk: z.enum(['black', 'milk']),
    // All times in minutes. activeTime is hands-on; totalTime is elapsed.
    prepTime: z.number(),
    brewTime: z.number(),
    activeTime: z.number(),
    totalTime: z.number(),
    // Set when a range is more honest than a single number, e.g. "12–18 hr".
    totalTimeLabel: z.string().optional(),
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
    ]),
    equipmentOptional: z.array(z.string()).default([]),
    popular: z.boolean().default(false),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    method: z.enum(['espresso', 'aeropress', 'v60', 'french-press', 'moka-pot']),
    tagline: z.string(),
  }),
});

const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    image: z.string().optional(),
  }),
});

export const collections = { recipes, guides, journal };
