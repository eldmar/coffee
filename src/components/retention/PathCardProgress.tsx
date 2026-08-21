import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../../lib/analytics';
import { nextLessonForPath, pathProgress, type LessonReference } from '../../lib/retention/learnProgress';
import {
  RETENTION_KEYS,
  getLearnProgress,
  subscribeRetentionKey,
  type LearnPathProgress,
} from '../../lib/retention/storage';

interface Props {
  pathSlug: string;
  lessons: LessonReference[];
  readingTime: string;
}

export default function PathCardProgress({ pathSlug, lessons, readingTime }: Props) {
  const [progress, setProgress] = useState<LearnPathProgress>();

  useEffect(() => {
    const refresh = () => setProgress(getLearnProgress().paths[pathSlug]);
    refresh();
    return subscribeRetentionKey(RETENTION_KEYS.learnProgress, refresh);
  }, [pathSlug]);

  const summary = pathProgress(progress, lessons);
  const continuation = useMemo(() => nextLessonForPath(progress, lessons), [lessons, progress]);
  if (!continuation) return null;
  const hasStarted = Boolean(progress?.lastVisitedLesson || progress?.completedLessons.length);

  return (
    <div className="mt-4">
      <p className="text-sm text-ink-soft">
        {lessons.length} lessons · {readingTime}
      </p>
      {hasStarted && (
        <>
          <p className="mt-2 text-xs text-ink-soft">
            {summary.completedCount} of {summary.totalCount} completed · {summary.percentage}% complete
          </p>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={summary.completedCount}
            aria-valuemin={0}
            aria-valuemax={summary.totalCount}
            aria-label={`${summary.completedCount} of ${summary.totalCount} lessons complete`}
          >
            <span className="block h-full bg-accent" style={{ width: `${summary.percentage}%` }} />
          </div>
        </>
      )}
      <a
        href={continuation.lesson.href}
        onClick={() =>
          trackRetentionEvent('learn_path_continued', {
            path_slug: pathSlug,
            lesson_slug: continuation.lesson.slug,
          })
        }
        className="mt-4 inline-flex min-h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-dark"
      >
        {summary.complete ? 'Review path' : hasStarted ? 'Continue path' : 'Start the path'}
      </a>
    </div>
  );
}
