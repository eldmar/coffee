import { useEffect, useMemo, useRef, useState } from 'react';
import { diagnose } from '../../lib/brew-assistant/rules';
import { hasBlockingError, parseNumber, validate } from '../../lib/brew-assistant/validation';
import {
  clearAll,
  loadSessions,
  newSession,
  saveAttempt,
  storageAvailable,
  updateSession,
} from '../../lib/brew-assistant/storage';
import type {
  Behaviour,
  BrewAttempt,
  BrewInput,
  BrewSession,
  Method,
  Roast,
  Taste,
} from '../../lib/brew-assistant/types';
import { ChoiceButton, ChoiceGroup, NumberField, SelectField } from './fields';
import BrewResultCard from './BrewResultCard';

const METHODS: [Method, string][] = [
  ['espresso', 'Espresso'],
  ['v60', 'V60'],
  ['aeropress', 'AeroPress'],
  ['french-press', 'French Press'],
];

const TASTES: [Taste, string][] = [
  ['sour', 'Sour'],
  ['bitter', 'Bitter'],
  ['weak', 'Weak or watery'],
  ['strong', 'Too strong'],
  ['dry', 'Dry or astringent'],
  ['hollow', 'Hollow'],
  ['muddy', 'Muddy'],
  ['unsure', 'Not sure'],
];

const BEHAVIOURS: Record<Method, [Behaviour, string][]> = {
  espresso: [
    ['espresso-fast', 'Too fast'],
    ['espresso-slow', 'Too slow'],
    ['espresso-spraying', 'Spraying or uneven flow'],
    ['none', 'No visible problem'],
  ],
  v60: [
    ['v60-stalled', 'Drawdown stalled'],
    ['v60-fast', 'Drained very quickly'],
    ['v60-uneven', 'Uneven coffee bed'],
    ['none', 'No visible problem'],
  ],
  aeropress: [
    ['aeropress-easy', 'Very easy to press'],
    ['aeropress-hard', 'Very hard to press'],
    ['none', 'No visible problem'],
  ],
  'french-press': [
    ['french-press-sediment', 'Too much sediment'],
    ['french-press-hard', 'Difficult to press'],
    ['none', 'No visible problem'],
  ],
};

const ROASTS: readonly (readonly [string, string])[] = [
  ['unknown', 'Not sure'],
  ['light', 'Light'],
  ['medium', 'Medium'],
  ['dark', 'Dark'],
];

const STEPS = ['Method', 'Recipe', 'Taste', 'Adjustment'];

interface Draft {
  dose: string;
  yieldOut: string;
  water: string;
  minutes: string;
  seconds: string;
  temperature: string;
  roast: Roast;
}

const emptyDraft = (): Draft => ({
  dose: '',
  yieldOut: '',
  water: '',
  minutes: '',
  seconds: '',
  temperature: '',
  roast: 'unknown',
});

/** Espresso is timed in seconds; the filter methods in minutes and seconds. */
const totalSeconds = (draft: Draft, method: Method) =>
  method === 'espresso'
    ? (parseNumber(draft.seconds) ?? NaN)
    : (parseNumber(draft.minutes) ?? 0) * 60 + (parseNumber(draft.seconds) ?? 0);

/** The homepage sends ?mode= and ?issue=. Anything else in the URL is ignored. */
function fromUrl() {
  if (typeof window === 'undefined') return { method: null, taste: null, behaviour: null };
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const issue = params.get('issue');
  return {
    method: METHODS.some(([m]) => m === mode) ? (mode as Method) : null,
    taste: TASTES.some(([t]) => t === issue) ? (issue as Taste) : null,
    behaviour: BEHAVIOURS.espresso.some(([b]) => b === issue) ? (issue as Behaviour) : null,
  };
}

export default function BrewAssistant() {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>('espresso');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [tastes, setTastes] = useState<Taste[]>([]);
  const [behaviour, setBehaviour] = useState<Behaviour>('none');
  const [session, setSession] = useState<BrewSession | null>(null);
  const [feedback, setFeedback] = useState<'yes' | 'not_yet'>();
  const [showErrors, setShowErrors] = useState(false);
  const [changedField, setChangedField] = useState<string | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const [history, setHistory] = useState<BrewSession[]>([]);

  useEffect(() => {
    setHistory(loadSessions());
    const seed = fromUrl();
    if (seed.method) setMethod(seed.method);
    if (seed.taste) setTastes([seed.taste]);
    if (seed.behaviour) setBehaviour(seed.behaviour);
  }, []);

  // Moving between steps must be announced, not just rendered.
  useEffect(() => {
    if (step > 0) stepHeading.current?.focus();
  }, [step]);

  const input: Partial<BrewInput> = useMemo(
    () => ({
      method,
      dose: parseNumber(draft.dose) ?? undefined,
      yieldOut: method === 'espresso' ? (parseNumber(draft.yieldOut) ?? undefined) : undefined,
      water: method === 'espresso' ? undefined : (parseNumber(draft.water) ?? undefined),
      time: Number.isNaN(totalSeconds(draft, method)) ? undefined : totalSeconds(draft, method),
      temperature: parseNumber(draft.temperature) ?? undefined,
      roast: draft.roast,
    }),
    [draft, method],
  );

  const issues = useMemo(() => validate(method, input), [method, input]);
  const issueFor = (field: string) =>
    showErrors ? issues.find((i) => i.field === field) : undefined;

  const diagnosis = useMemo(() => {
    if (step !== 3) return null;
    return diagnose({ ...(input as BrewInput), tastes, behaviour });
  }, [step, input, tastes, behaviour]);

  const toggleTaste = (taste: Taste) => {
    setTastes((current) => {
      // "Not sure" is an answer on its own; it cannot sit beside a description.
      if (taste === 'unsure') return current.includes('unsure') ? [] : ['unsure'];
      const without = current.filter((t) => t !== 'unsure');
      if (without.includes(taste)) return without.filter((t) => t !== taste);
      return [...without, taste].slice(-2);
    });
  };

  const goToRecipe = () => {
    setStep(1);
  };

  const goToTaste = () => {
    setShowErrors(true);
    if (hasBlockingError(issues)) return;
    setStep(2);
  };

  const runDiagnosis = () => {
    const result = diagnose({ ...(input as BrewInput), tastes, behaviour });
    const attempt: BrewAttempt = {
      input: { ...(input as BrewInput), tastes, behaviour },
      diagnosis: result,
      at: new Date().toISOString(),
    };
    const current = session ?? newSession(method);
    const saved = saveAttempt(current, attempt);
    setSession(saved);
    setHistory(loadSessions());
    setFeedback(undefined);
    setStep(3);
  };

  /** Keep everything except the variable the last answer asked you to move. */
  const recordNextAttempt = () => {
    const last = session?.attempts.at(-1)?.diagnosis;
    setChangedField(last?.adjustment.variable ?? null);
    if (last?.nextTarget.yieldOut !== undefined) {
      setDraft((d) => ({ ...d, yieldOut: String(last.nextTarget.yieldOut) }));
    }
    setTastes([]);
    setBehaviour('none');
    setShowErrors(false);
    setStep(1);
  };

  const restart = () => {
    setSession(null);
    setDraft(emptyDraft());
    setTastes([]);
    setBehaviour('none');
    setChangedField(null);
    setShowErrors(false);
    setStep(0);
  };

  const recordFeedback = (value: 'yes' | 'not_yet') => {
    setFeedback(value);
    if (!session) return;
    const attempts = [...session.attempts];
    const last = attempts.at(-1);
    if (last) attempts[attempts.length - 1] = { ...last, helpful: value };
    const updated = { ...session, attempts, updatedAt: new Date().toISOString() };
    setSession(updated);
    updateSession(updated);
    setHistory(loadSessions());
  };

  const attempts = session?.attempts ?? [];

  return (
    <div className="flex flex-col gap-8">
      <ol className="flex flex-wrap gap-x-2 gap-y-1 text-sm" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-ink-soft">
                &#8594;
              </span>
            )}
            <span
              className={index === step ? 'font-medium text-accent' : 'text-ink-soft'}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="sr-only">Step </span>
              {index + 1} {label}
            </span>
          </li>
        ))}
      </ol>

      <h2 ref={stepHeading} tabIndex={-1} className="sr-only">
        Step {step + 1} of 4: {STEPS[step]}
      </h2>

      {step === 0 && (
        <div className="flex flex-col gap-6">
          <ChoiceGroup legend="What are you brewing?">
            {METHODS.map(([value, label]) => (
              <ChoiceButton key={value} selected={method === value} onClick={() => setMethod(value)}>
                {label}
              </ChoiceButton>
            ))}
          </ChoiceGroup>
          <div>
            <button
              type="button"
              onClick={goToRecipe}
              className="min-h-11 rounded-md bg-accent px-5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-dark"
            >
              Continue &#8594;
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            goToTaste();
          }}
          noValidate
        >
          <div>
            <h3 className="font-medium">What did you brew?</h3>
            {changedField && (
              <p className="mt-1 text-sm text-ink-soft">
                Everything is carried over from your last attempt. Change the{' '}
                <strong className="font-medium text-ink">{changedField}</strong> and leave the rest.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="dose"
              label="Coffee dose"
              unit="g"
              value={draft.dose}
              onChange={(v) => setDraft((d) => ({ ...d, dose: v }))}
              issue={issueFor('dose')}
              autoFocus
            />
            {method === 'espresso' ? (
              <NumberField
                id="yieldOut"
                label="Yield out"
                unit="g"
                value={draft.yieldOut}
                onChange={(v) => setDraft((d) => ({ ...d, yieldOut: v }))}
                issue={issueFor('yieldOut')}
              />
            ) : (
              <NumberField
                id="water"
                label="Water"
                unit="g / ml"
                value={draft.water}
                onChange={(v) => setDraft((d) => ({ ...d, water: v }))}
                issue={issueFor('water')}
              />
            )}
          </div>

          {method === 'espresso' ? (
            <NumberField
              id="time"
              label="Shot time"
              unit="sec"
              value={draft.seconds}
              onChange={(v) => setDraft((d) => ({ ...d, seconds: v }))}
              issue={issueFor('time')}
            />
          ) : (
            <div>
              <span className="block text-sm font-medium">Total brew time</span>
              <div className="mt-1.5 grid grid-cols-2 gap-4">
                <NumberField
                  id="minutes"
                  label="Minutes"
                  unit="min"
                  value={draft.minutes}
                  onChange={(v) => setDraft((d) => ({ ...d, minutes: v }))}
                />
                <NumberField
                  id="seconds"
                  label="Seconds"
                  unit="sec"
                  value={draft.seconds}
                  onChange={(v) => setDraft((d) => ({ ...d, seconds: v }))}
                  issue={issueFor('time')}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="roast"
              label="Roast level (optional)"
              value={draft.roast}
              onChange={(v) => setDraft((d) => ({ ...d, roast: v as Roast }))}
              options={ROASTS}
            />
            <NumberField
              id="temperature"
              label="Water temperature (optional)"
              unit="°C"
              value={draft.temperature}
              onChange={(v) => setDraft((d) => ({ ...d, temperature: v }))}
              issue={issueFor('temperature')}
            />
          </div>

          {showErrors && hasBlockingError(issues) && (
            <p role="alert" className="text-sm font-medium text-accent">
              Check the highlighted fields before continuing.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="min-h-11 rounded-md bg-accent px-5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-dark"
            >
              Continue &#8594;
            </button>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="min-h-11 rounded-md border border-ink/25 px-5 text-sm font-medium hover:border-ink/50"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-6">
          <ChoiceGroup legend="How did it taste?" hint="Choose up to two.">
            {TASTES.map(([value, label]) => (
              <ChoiceButton
                key={value}
                selected={tastes.includes(value)}
                onClick={() => toggleTaste(value)}
              >
                {label}
              </ChoiceButton>
            ))}
          </ChoiceGroup>

          <ChoiceGroup legend="What did the brew do?">
            {BEHAVIOURS[method].map(([value, label]) => (
              <ChoiceButton
                key={value}
                selected={behaviour === value}
                onClick={() => setBehaviour(value)}
              >
                {label}
              </ChoiceButton>
            ))}
          </ChoiceGroup>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runDiagnosis}
              className="min-h-11 rounded-md bg-accent px-5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-dark"
            >
              Suggest one change &#8594;
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-11 rounded-md border border-ink/25 px-5 text-sm font-medium hover:border-ink/50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === 3 && diagnosis && (
        <div aria-live="polite">
          <BrewResultCard
            diagnosis={diagnosis}
            onNextAttempt={recordNextAttempt}
            onRestart={restart}
            onFeedback={recordFeedback}
            feedback={feedback}
          />
        </div>
      )}

      {attempts.length > 0 && (
        <section aria-labelledby="history-heading" className="border-t border-line pt-6">
          <h2 id="history-heading" className="font-display text-xl font-medium">
            This brew so far
          </h2>
          <ol className="mt-4 flex flex-col gap-4">
            {attempts.map((attempt, index) => (
              <li key={attempt.at} className="text-sm">
                <p className="font-medium">Attempt {index + 1}</p>
                <p className="text-ink-soft">
                  {attempt.input.dose} g
                  {attempt.input.yieldOut !== undefined && ` → ${attempt.input.yieldOut} g`}
                  {attempt.input.water !== undefined && ` → ${attempt.input.water} g water`}
                  {' · '}
                  {attempt.input.time} sec
                </p>
                <p className="text-ink-soft">
                  {attempt.input.tastes.length > 0 ? attempt.input.tastes.join(', ') : 'no taste noted'}
                </p>
                {!attempt.diagnosis.needsClarification && (
                  <p className="mt-1 text-ink-soft">
                    Suggested: <span className="text-ink">{attempt.diagnosis.adjustment.title}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="border-t border-line pt-6 text-sm text-ink-soft">
        {storageAvailable() ? (
          <>
            <p>Your brew history is stored in this browser unless you choose to clear it.</p>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete every brew saved in this browser?')) {
                    clearAll();
                    setHistory([]);
                    restart();
                  }
                }}
                className="mt-3 min-h-11 rounded-md border border-line px-4 font-medium hover:border-ink/30"
              >
                Clear all saved brews
              </button>
            )}
          </>
        ) : (
          <p>
            You can still use the assistant, but this brew will not be saved after you leave the
            page.
          </p>
        )}
      </section>
    </div>
  );
}
