import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../../lib/analytics';
import { nextLessonForPath, pathProgress, type LessonReference } from '../../lib/retention/learnProgress';
import {
  RETENTION_KEYS,
  getLearnProgress,
  resetLearnPath,
  subscribeRetentionKey,
  type LearnPathProgress,
} from '../../lib/retention/storage';

interface Props {
  pathSlug: string;
  pathTitle: string;
  lessons: LessonReference[];
}

export default function PathProgressPanel({ pathSlug, pathTitle, lessons }: Props) {
  const [progress, setProgress] = useState<LearnPathProgress>();
  const [hydrated, setHydrated] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const refresh = () => {
      setProgress(getLearnProgress().paths[pathSlug]);
      setHydrated(true);
    };
    refresh();
    return subscribeRetentionKey(RETENTION_KEYS.learnProgress, refresh);
  }, [pathSlug]);

  useEffect(() => {
    const completed = new Set(progress?.completedLessons ?? []);
    for (const card of document.querySelectorAll<HTMLElement>(`[data-path-card="${pathSlug}"]`)) {
      const isComplete = completed.has(card.dataset.lessonSlug ?? '');
      card.dataset.complete = String(isComplete);
      const status = card.querySelector<HTMLElement>('[data-lesson-complete-status]');
      if (status) status.hidden = !isComplete;
    }
  }, [pathSlug, progress]);

  const summary = pathProgress(progress, lessons);
  const continuation = useMemo(() => nextLessonForPath(progress, lessons), [lessons, progress]);
  if (!continuation) return null;

  const hasStarted = Boolean(progress?.lastVisitedLesson || progress?.completedLessons.length);
  const ctaLabel = summary.complete
    ? 'Review this path'
    : hasStarted
      ? `Continue: ${continuation.lesson.title}`
      : 'Start lesson 1';

  function reset() {
    if (
      !window.confirm(
        `Reset your progress for ${pathTitle}?\nYour completed lessons will be cleared on this device.`,
      )
    ) {
      return;
    }
    resetLearnPath(pathSlug);
    setAnnouncement('Path progress reset.');
    trackRetentionEvent('learn_progress_reset', { path_slug: pathSlug });
  }

  return (
    <div className="mt-8 border-y border-line py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            {summary.completedCount} of {summary.totalCount} lessons completed · {summary.percentage}% complete
          </p>
          <div
            className="mt-2 h-2 w-64 max-w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={summary.completedCount}
            aria-valuemin={0}
            aria-valuemax={summary.totalCount}
            aria-label={`${summary.completedCount} of ${summary.totalCount} lessons complete in ${pathTitle}`}
          >
            <span className="block h-full bg-accent" style={{ width: `${summary.percentage}%` }} />
          </div>
        </div>
        {hydrated && hasStarted && (
          <button
            type="button"
            onClick={reset}
            className="min-h-11 px-2 text-sm font-medium text-ink-soft hover:text-ink hover:underline"
          >
            Reset progress
          </button>
        )}
      </div>
      <a
        href={continuation.lesson.href}
        onClick={() =>
          trackRetentionEvent('learn_path_continued', {
            path_slug: pathSlug,
            lesson_slug: continuation.lesson.slug,
          })
        }
        className="mt-5 inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-ink hover:bg-accent-dark"
      >
        {ctaLabel}
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
