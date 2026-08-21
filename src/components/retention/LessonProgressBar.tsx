import { useEffect, useRef, useState } from 'react';
import {
  RETENTION_KEYS,
  getLearnProgress,
  recordLessonVisit,
  subscribeRetentionKey,
  type LearnPathProgress,
} from '../../lib/retention/storage';
import { pathProgress, type LessonReference } from '../../lib/retention/learnProgress';

interface Props {
  pathSlug: string;
  pathTitle: string;
  lessonSlug: string;
  lessons: LessonReference[];
}

export default function LessonProgressBar({ pathSlug, pathTitle, lessonSlug, lessons }: Props) {
  const [progress, setProgress] = useState<LearnPathProgress>();
  const recorded = useRef(false);

  useEffect(() => {
    const refresh = () => setProgress(getLearnProgress().paths[pathSlug]);
    if (!recorded.current) {
      recorded.current = true;
      recordLessonVisit(pathSlug, lessonSlug);
    }
    refresh();
    return subscribeRetentionKey(RETENTION_KEYS.learnProgress, refresh);
  }, [lessonSlug, pathSlug]);

  const summary = pathProgress(progress, lessons);

  return (
    <div className="mt-3 max-w-xs print:hidden">
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={summary.completedCount}
        aria-valuemin={0}
        aria-valuemax={summary.totalCount}
        aria-label={`${summary.completedCount} of ${summary.totalCount} lessons complete in ${pathTitle}`}
      >
        <span
          className="block h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${summary.percentage}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">
        {summary.completedCount} of {summary.totalCount} lessons completed · {summary.percentage}% complete
      </p>
    </div>
  );
}
