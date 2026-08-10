import { linksFor } from '../../lib/brew-assistant/content';
import type { BrewDiagnosis, Method } from '../../lib/brew-assistant/types';

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** One unit for the pair, so a window reads "27–30 sec" rather than repeating it. */
const timeRange = (min: number, max: number) =>
  max >= 60 ? `${clock(min)}–${clock(max)}` : `${min}–${max} sec`;

function targetLine(method: Method, target: BrewDiagnosis['nextTarget']): string {
  const parts: string[] = [];
  if (target.dose !== undefined) parts.push(`${target.dose} g in`);
  if (target.yieldOut !== undefined) parts.push(`${target.yieldOut} g out`);
  if (target.water !== undefined) parts.push(`${target.water} g water`);
  if (target.bypass !== undefined) parts.push(`${target.bypass} g bypass after pressing`);
  const time =
    target.timeMin !== undefined && target.timeMax !== undefined
      ? timeRange(target.timeMin, target.timeMax)
      : null;
  const joined = parts.join(' → ');
  const withTime = [joined, time].filter(Boolean).join(' · ');
  return target.temperature ? `${withTime} · ${target.temperature}°C` : withTime;
}

export default function BrewResultCard({
  diagnosis,
  onNextAttempt,
  onRestart,
  onFeedback,
  feedback,
  onContentClick,
}: {
  diagnosis: BrewDiagnosis;
  onNextAttempt: () => void;
  onRestart: () => void;
  onFeedback: (value: 'yes' | 'not_yet') => void;
  feedback?: 'yes' | 'not_yet';
  onContentClick?: (href: string) => void;
}) {
  const links = linksFor(diagnosis.relatedContent);

  if (diagnosis.needsClarification) {
    return (
      <section aria-labelledby="result-heading" className="rounded-lg border border-line bg-card p-6">
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
          One more detail
        </p>
        <h2 id="result-heading" className="mt-2 font-display text-2xl font-medium">
          {diagnosis.clarificationQuestion}
        </h2>
        <p className="mt-3 text-ink-soft">
          We need that before suggesting a change — a confident answer from this much information
          would be a guess.
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-5 min-h-11 rounded-md border border-ink/25 px-5 text-sm font-medium hover:border-ink/50"
        >
          Go back and add it
        </button>
        {links.length > 0 && (
          <ul className="mt-6 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => onContentClick?.(link.href)}
                  className="font-medium text-accent hover:underline"
                >
                  {link.label} &#8594;
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="result-heading"
      className="rounded-lg border-2 border-accent/25 bg-card p-6"
    >
      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-accent uppercase">
        One change for your next brew
      </p>
      <h2 id="result-heading" className="mt-2 font-display text-3xl font-medium">
        {diagnosis.adjustment.title}
      </h2>

      <dl className="mt-6 flex flex-col gap-4">
        <div>
          <dt className="text-[0.6875rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
            Next target
          </dt>
          <dd className="mt-1 font-medium">{targetLine(diagnosis.method, diagnosis.nextTarget)}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
            Keep unchanged
          </dt>
          <dd className="mt-1 text-ink-soft">{diagnosis.keepConstant.join(' · ')}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
            Why this should help
          </dt>
          <dd className="mt-1 flex flex-col gap-2 text-ink-soft">
            {diagnosis.reasons.map((reason) => (
              <span key={reason}>{reason}</span>
            ))}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onNextAttempt}
          className="min-h-11 rounded-md bg-accent px-5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-dark"
        >
          Record next attempt &#8594;
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="min-h-11 rounded-md border border-ink/25 px-5 text-sm font-medium hover:border-ink/50"
        >
          Start a new brew
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5 text-sm">
        <span className="font-medium">Was this helpful?</span>
        {(['yes', 'not_yet'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={feedback === value}
            onClick={() => onFeedback(value)}
            className={`min-h-11 rounded-md border px-4 transition-colors ${
              feedback === value ? 'border-accent bg-accent/8 font-medium' : 'border-line hover:border-ink/30'
            }`}
          >
            {value === 'yes' ? 'Yes' : 'Not yet'}
          </button>
        ))}
        {feedback && <span className="text-ink-soft">Thanks — that helps us tune the advice.</span>}
      </div>

      {links.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-ink-soft uppercase">
            Learn why
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => onContentClick?.(link.href)}
                  className="font-medium text-accent hover:underline"
                >
                  {link.label} &#8594;
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
