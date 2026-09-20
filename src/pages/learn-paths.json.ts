import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { LEARN_PATHS } from '../lib/learn';
import type { PathReference } from '../lib/retention/learnProgress';

/**
 * Published paths and their lessons, served as one static file instead of
 * riding along in the homepage HTML. See src/lib/retention/learnPaths.ts.
 */
export const GET: APIRoute = async () => {
  const allLessons = await getCollection('lessons');

  const paths: PathReference[] = LEARN_PATHS.filter((path) => path.status === 'published').map(
    (path) => ({
      slug: path.slug,
      title: path.title,
      lessons: allLessons
        .filter((lesson) => lesson.data.path === path.slug)
        .sort((left, right) => left.data.order - right.data.order)
        .map((lesson) => ({
          slug: lesson.id.split('/').at(-1) ?? lesson.id,
          title: lesson.data.title,
          href: `/learn/${lesson.id}/`,
        })),
    }),
  );

  return new Response(JSON.stringify(paths), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
