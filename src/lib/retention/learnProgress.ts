import type { LearnPathProgress, LearnProgressState } from './storage';

export interface LessonReference {
  slug: string;
  title: string;
  href: string;
}

export interface ContinueLearningResult {
  lesson: LessonReference;
  completedCount: number;
  totalCount: number;
  complete: boolean;
  reason: 'last-visited' | 'next-incomplete' | 'review';
}

export function pathProgress(
  path: LearnPathProgress | undefined,
  lessons: LessonReference[],
): { completedCount: number; totalCount: number; percentage: number; complete: boolean } {
  const lessonSlugs = new Set(lessons.map((lesson) => lesson.slug));
  const completedCount = path
    ? new Set(path.completedLessons.filter((slug) => lessonSlugs.has(slug))).size
    : 0;
  const totalCount = lessons.length;
  return {
    completedCount,
    totalCount,
    percentage: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
    complete: totalCount > 0 && completedCount === totalCount,
  };
}

export function nextLessonForPath(
  path: LearnPathProgress | undefined,
  lessons: LessonReference[],
): ContinueLearningResult | null {
  if (lessons.length === 0) return null;
  const progress = pathProgress(path, lessons);
  if (!path) {
    return { lesson: lessons[0], ...progress, reason: 'next-incomplete' };
  }

  const completed = new Set(path.completedLessons);
  const lastIndex = lessons.findIndex((lesson) => lesson.slug === path.lastVisitedLesson);
  if (lastIndex >= 0 && !completed.has(lessons[lastIndex].slug)) {
    return { lesson: lessons[lastIndex], ...progress, reason: 'last-visited' };
  }

  for (let offset = 1; offset <= lessons.length; offset += 1) {
    const index = (Math.max(lastIndex, -1) + offset) % lessons.length;
    if (!completed.has(lessons[index].slug)) {
      return { lesson: lessons[index], ...progress, reason: 'next-incomplete' };
    }
  }

  const reviewLesson = lastIndex >= 0 ? lessons[lastIndex] : lessons[0];
  return { lesson: reviewLesson, ...progress, reason: 'review' };
}

export function mostRecentlyVisitedPath(
  state: LearnProgressState,
  paths: Array<{ slug: string; lessons: LessonReference[] }>,
): { pathSlug: string; result: ContinueLearningResult } | null {
  const candidates = paths
    .map((path) => ({
      pathSlug: path.slug,
      progress: state.paths[path.slug],
      result: nextLessonForPath(state.paths[path.slug], path.lessons),
    }))
    .filter((candidate) => candidate.progress?.lastVisitedAt && candidate.result)
    .sort(
      (left, right) =>
        Date.parse(right.progress?.lastVisitedAt ?? '') -
        Date.parse(left.progress?.lastVisitedAt ?? ''),
    );
  const first = candidates[0];
  return first?.result ? { pathSlug: first.pathSlug, result: first.result } : null;
}
