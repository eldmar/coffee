import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../../lib/analytics';
import { mostRecentlyVisitedPath, type LessonReference } from '../../lib/retention/learnProgress';
import {
  RETENTION_KEYS,
  getLearnProgress,
  subscribeRetentionKey,
  type LearnProgressState,
} from '../../lib/retention/storage';

interface PathReference {
  slug: string;
  title: string;
  lessons: LessonReference[];
}

interface Props {
  paths: PathReference[];
}

export default function ContinueLearning({ paths }: Props) {
  const [state, setState] = useState<LearnProgressState>();

  useEffect(() => {
    const refresh = () => setState(getLearnProgress());
    refresh();
    return subscribeRetentionKey(RETENTION_KEYS.learnProgress, refresh);
  }, []);

  const next = useMemo(() => (state ? mostRecentlyVisitedPath(state, paths) : null), [paths, state]);
  if (!next) return null;
  const path = paths.find((candidate) => candidate.slug === next.pathSlug);
  if (!path) return null;
  const lessonPosition =
    path.lessons.findIndex((lesson) => lesson.slug === next.result.lesson.slug) + 1;

  return (
    <div className="mt-6 border-l-2 border-accent pl-4">
      <span className="eyebrow">Continue where you left off</span>
      <p className="mt-1 text-sm font-medium">
        {path.title} · Lesson {lessonPosition} of {next.result.totalCount}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {next.result.completedCount} completed ·{' '}
        {Math.round((next.result.completedCount / next.result.totalCount) * 100)}% complete
      </p>
      <p className="mt-2 font-display text-lg font-medium">{next.result.lesson.title}</p>
      <a
        href={next.result.lesson.href}
        onClick={() =>
          trackRetentionEvent('learn_path_continued', {
            path_slug: path.slug,
            lesson_slug: next.result.lesson.slug,
          })
        }
        className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-accent hover:underline"
      >
        {next.result.complete ? 'Review this path' : 'Continue lesson'} <span aria-hidden="true">&#8594;</span>
      </a>
    </div>
  );
}
