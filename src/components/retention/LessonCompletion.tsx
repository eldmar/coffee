import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../../lib/analytics';
import { nextLessonForPath, pathProgress, type LessonReference } from '../../lib/retention/learnProgress';
import {
  RETENTION_KEYS,
  getLearnProgress,
  setLessonCompleted,
  subscribeRetentionKey,
  type LearnPathProgress,
} from '../../lib/retention/storage';

interface Props {
  pathSlug: string;
  lessonSlug: string;
  lessons: LessonReference[];
}

export default function LessonCompletion({ pathSlug, lessonSlug, lessons }: Props) {
  const [progress, setProgress] = useState<LearnPathProgress>();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const refresh = () => setProgress(getLearnProgress().paths[pathSlug]);
    refresh();
    return subscribeRetentionKey(RETENTION_KEYS.learnProgress, refresh);
  }, [pathSlug]);

  const completed = progress?.completedLessons.includes(lessonSlug) ?? false;
  const summary = pathProgress(progress, lessons);
  const continuation = useMemo(() => nextLessonForPath(progress, lessons), [lessons, progress]);

  function toggleComplete() {
    const nextCompleted = !completed;
    const nextProgress = setLessonCompleted(pathSlug, lessonSlug, nextCompleted);
    if (nextProgress) setProgress(nextProgress);
    setAnnouncement(nextCompleted ? 'Lesson marked as complete.' : 'Lesson marked as incomplete.');
    if (nextCompleted) {
      trackRetentionEvent('learn_lesson_completed', {
        path_slug: pathSlug,
        lesson_slug: lessonSlug,
      });
    }
  }

  return (
    <section className="mt-12 border-y border-line py-8 print:hidden" aria-labelledby="lesson-completion-heading">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 id="lesson-completion-heading" className="font-display text-2xl font-medium">
            {completed ? 'Lesson complete' : 'Finished this lesson?'}
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            {summary.completedCount} of {summary.totalCount} lessons completed · {summary.percentage}% complete
          </p>
        </div>
        <button
          type="button"
          onClick={toggleComplete}
          aria-pressed={completed}
          aria-label={completed ? 'Mark lesson as incomplete' : 'Mark lesson as complete'}
          className={
            completed
              ? 'min-h-11 rounded-md border border-ink/25 bg-card px-5 text-sm font-medium hover:border-ink/50'
              : 'min-h-11 rounded-md bg-accent px-5 text-sm font-medium text-accent-ink hover:bg-accent-dark'
          }
        >
          {completed ? 'Completed ✓' : 'Mark lesson as complete'}
        </button>
      </div>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={summary.completedCount}
        aria-valuemin={0}
        aria-valuemax={summary.totalCount}
        aria-label={`${summary.completedCount} of ${summary.totalCount} lessons complete`}
      >
        <span className="block h-full bg-accent" style={{ width: `${summary.percentage}%` }} />
      </div>

      {completed && continuation && (
        <a
          href={continuation.lesson.href}
          onClick={() =>
            trackRetentionEvent('learn_path_continued', {
              path_slug: pathSlug,
              lesson_slug: continuation.lesson.slug,
            })
          }
          className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:underline"
        >
          {continuation.complete ? 'Review this path' : 'Continue to next lesson'}
          <span aria-hidden="true">&#8594;</span>
        </a>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
