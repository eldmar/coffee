import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../../lib/analytics';
import { loadLearnPaths } from '../../lib/retention/learnPaths';
import {
  nextLessonForPath,
  pathProgress,
  type LessonReference,
} from '../../lib/retention/learnProgress';
import {
  RETENTION_KEYS,
  getLearnProgress,
  subscribeRetentionKey,
  type LearnPathProgress,
} from '../../lib/retention/storage';

interface Props {
  pathSlug: string;
  /** Enough to render the untouched card without the lesson list. */
  lessonCount: number;
  readingTime: string;
  firstLessonSlug: string;
  firstLessonHref: string;
}

/**
 * Unlike the other retention widgets this one renders for everybody: an
 * untouched path still needs its lesson count and its Start button, and those
 * have to be in the HTML rather than waiting on a fetch. So the card renders
 * server-side from four small props, and the lesson list — the only part that
 * was ever large — is fetched only once the stored progress says this path has
 * actually been started.
 */
export default function PathCardProgress({
  pathSlug,
  lessonCount,
  readingTime,
  firstLessonSlug,
  firstLessonHref,
}: Props) {
  const [progress, setProgress] = useState<LearnPathProgress>();
  const [lessons, setLessons] = useState<LessonReference[]>([]);

  useEffect(() => {
    const refresh = () => setProgress(getLearnProgress().paths[pathSlug]);
    refresh();
    return subscribeRetentionKey(RETENTION_KEYS.learnProgress, refresh);
  }, [pathSlug]);

  const hasStarted = Boolean(progress?.lastVisitedLesson || progress?.completedLessons.length);

  useEffect(() => {
    if (!hasStarted || lessons.length > 0) return;

    let active = true;
    void loadLearnPaths().then((paths) => {
      const own = paths.find((path) => path.slug === pathSlug);
      if (active && own) setLessons(own.lessons);
    });
    return () => {
      active = false;
    };
  }, [hasStarted, lessons.length, pathSlug]);

  const summary = pathProgress(progress, lessons);
  const continuation = useMemo(() => nextLessonForPath(progress, lessons), [lessons, progress]);

  // Until the lesson list is in hand there is nothing to compute a position
  // from, so the card stays exactly as it was served.
  const started = hasStarted && continuation !== null;

  return (
    <div className="mt-4">
      <p className="text-sm text-ink-soft">
        {lessonCount} lessons · {readingTime}
      </p>
      {started && (
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
        href={started ? continuation.lesson.href : firstLessonHref}
        onClick={() =>
          trackRetentionEvent('learn_path_continued', {
            path_slug: pathSlug,
            lesson_slug: started ? continuation.lesson.slug : firstLessonSlug,
          })
        }
        className="mt-4 inline-flex min-h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-dark"
      >
        {started && summary.complete ? 'Review path' : started ? 'Continue path' : 'Start the path'}
      </a>
    </div>
  );
}
