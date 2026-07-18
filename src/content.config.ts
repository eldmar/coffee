import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/recipes' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    category: z.enum(['espresso', 'milk-based', 'filter', 'cold']),
    brewMethod: z.enum(['espresso', 'aeropress', 'v60', 'french-press', 'moka-pot', 'cold-brew']),
    temperature: z.enum(['hot', 'iced']),
    milk: z.enum(['black', 'milk']),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    time: z.number(),
    ingredients: z.array(z.string()),
    equipment: z.array(z.string()),
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
