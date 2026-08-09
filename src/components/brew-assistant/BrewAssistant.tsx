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

const PRE_INFUSION: readonly (readonly [string, string])[] = [
  ['unknown', 'Not sure'],
  ['yes', 'Yes, it is included'],
  ['no', 'No, timed from the pump'],
];

const GRINDS: readonly (readonly [string, string])[] = [
  ['unknown', 'Not sure'],
  ['fine', 'Fine'],
  ['medium-fine', 'Medium-fine'],
  ['medium', 'Medium'],
  ['medium-coarse', 'Medium-coarse'],
  ['coarse', 'Coarse'],
];

const AEROPRESS_STYLES: readonly (readonly [string, string])[] = [
  ['unknown', 'Not sure'],
  ['standard', 'Standard'],
  ['inverted', 'Inverted'],
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
  preInfusion: 'unknown' | 'yes' | 'no';
  grind: 'unknown' | 'fine' | 'medium-fine' | 'medium' | 'medium-coarse' | 'coarse';
  aeropressStyle: 'unknown' | 'standard' | 'inverted';
}

const emptyDraft = (): Draft => ({
  dose: '',
  yieldOut: '',
  water: '',
  minutes: '',
  seconds: '',
  temperature: '',
  roast: 'unknown',
  preInfusion: 'unknown',
  grind: 'unknown',
  aeropressStyle: 'unknown',
});

/** Espresso is timed in seconds; the filter methods in minutes and seconds. */
const totalSeconds = (draft: Draft, method: Method) =>
  method === 'espresso'
    ? (parseNumber(draft.seconds) ?? NaN)
    : (parseNumber(draft.minutes) ?? 0) * 60 + (parseNumber(draft.seconds) ?? 0);

const FILTER_METHODS: Method[] = ['v60', 'aeropress', 'french-press'];

/**
 * The homepage sends ?mode= (one method) or ?group=filter (choose from the three
 * filter brewers), plus ?issue=. Anything else in the URL is ignored.
 */
function fromUrl() {
  const empty = { method: null, group: null, taste: null, behaviour: null, fresh: false };
  if (typeof window === 'undefined') return empty;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const issue = params.get('issue');
  return {
    method: METHODS.some(([m]) => m === mode) ? (mode as Method) : null,
    group: params.get('group') === 'filter' ? ('filter' as const) : null,
    taste: TASTES.some(([t]) => t === issue) ? (issue as Taste) : null,
    behaviour: BEHAVIOURS.espresso.some(([b]) => b === issue) ? (issue as Behaviour) : null,
    fresh: params.get('new') === '1',
  };
}

export default function BrewAssistant() {
  const [step, setStep] = useState(0);
  // null while a group has been requested but no brewer picked yet.
  const [method, setMethod] = useState<Method | null>('espresso');
  /**
   * Resolved after mount. Reading localStorage during render makes the server
   * and the first client render disagree, which is a hydration mismatch.
   */
  const [storageStatus, setStorageStatus] = useState<'checking' | 'available' | 'unavailable'>(
    'checking',
  );
  const [methodChoices, setMethodChoices] = useState<Method[]>(METHODS.map(([m]) => m));
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
    setStorageStatus(storageAvailable() ? 'available' : 'unavailable');
    setHistory(loadSessions());

    /**
     * The URL is the instruction; whatever the page was showing before is not.
     * Re-read it on pageshow as well, because a page restored from the back
     * button's cache keeps its old React state and never remounts.
     */
    const applyUrl = () => {
      const seed = fromUrl();
      if (seed.fresh) setSession(null);
      if (seed.group === 'filter') {
        // Ask which filter brewer rather than picking one on their behalf.
        setMethodChoices(FILTER_METHODS);
        setMethod(null);
        setStep(0);
      } else if (seed.method) {
        setMethodChoices(METHODS.map(([m]) => m));
        setMethod(seed.method);
      }
      if (seed.taste) setTastes([seed.taste]);
      if (seed.behaviour) setBehaviour(seed.behaviour);
    };

    applyUrl();
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) applyUrl();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  // Moving between steps must be announced, not just rendered.
  useEffect(() => {
    if (step > 0) stepHeading.current?.focus();
  }, [step]);

  /** Safe to use once past step 0, which cannot be left until a method is picked. */
  const chosen: Method = method ?? 'espresso';

  const input: Partial<BrewInput> = useMemo(
    () => ({
      method: chosen,
      dose: parseNumber(draft.dose) ?? undefined,
      yieldOut: chosen === 'espresso' ? (parseNumber(draft.yieldOut) ?? undefined) : undefined,
      water: chosen === 'espresso' ? undefined : (parseNumber(draft.water) ?? undefined),
      time: Number.isNaN(totalSeconds(draft, chosen)) ? undefined : totalSeconds(draft, chosen),
      temperature: parseNumber(draft.temperature) ?? undefined,
      roast: draft.roast,
      preInfusionIncluded: chosen === 'espresso' ? draft.preInfusion : undefined,
      grind: chosen === 'espresso' ? undefined : draft.grind,
      aeropressStyle: chosen === 'aeropress' ? draft.aeropressStyle : undefined,
    }),
    [draft, chosen],
  );

  const issues = useMemo(() => validate(chosen, input), [chosen, input]);
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
    const current = session ?? newSession(chosen);
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
          <ChoiceGroup
            legend="What are you brewing?"
            hint={
              methodChoices.length < METHODS.length
                ? 'Filter coffee covers three brewers. Which one did you use?'
                : undefined
            }
          >
            {METHODS.filter(([value]) => methodChoices.includes(value)).map(([value, label]) => (
              <ChoiceButton key={value} selected={method === value} onClick={() => setMethod(value)}>
                {label}
              </ChoiceButton>
            ))}
          </ChoiceGroup>
          {methodChoices.length < METHODS.length && (
            <button
              type="button"
              onClick={() => setMethodChoices(METHODS.map(([m]) => m))}
              className="self-start text-sm font-medium text-accent hover:underline"
            >
              Show every method
            </button>
          )}
          <div>
            <button
              type="button"
              onClick={goToRecipe}
              disabled={method === null}
              className={`min-h-11 rounded-md px-5 text-sm font-medium transition-colors ${
                method === null
                  ? 'border border-line bg-paper text-ink-soft'
                  : 'bg-accent text-accent-ink hover:bg-accent-dark'
              }`}
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
                Your recommended target has been pre-filled. Adjust the{' '}
                <strong className="font-medium text-ink">{changedField}</strong>, brew again and
                record the result.
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
            {chosen === 'espresso' ? (
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

          {chosen === 'espresso' ? (
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
            {chosen === 'espresso' ? (
              <SelectField
                id="preInfusion"
                label="Pre-infusion included in the time? (optional)"
                value={draft.preInfusion}
                onChange={(v) => setDraft((d) => ({ ...d, preInfusion: v as Draft['preInfusion'] }))}
                options={PRE_INFUSION}
              />
            ) : (
              <SelectField
                id="grind"
                label="Grind (optional)"
                value={draft.grind}
                onChange={(v) => setDraft((d) => ({ ...d, grind: v as Draft['grind'] }))}
                options={GRINDS}
              />
            )}
            {chosen === 'aeropress' && (
              <SelectField
                id="aeropressStyle"
                label="Standard or inverted? (optional)"
                value={draft.aeropressStyle}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, aeropressStyle: v as Draft['aeropressStyle'] }))
                }
                options={AEROPRESS_STYLES}
              />
            )}
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
            {BEHAVIOURS[chosen].map(([value, label]) => (
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
        {/* Reserve the line while checking so the layout does not jump. */}
        {storageStatus === 'checking' && <p aria-hidden="true">&nbsp;</p>}
        {storageStatus === 'available' && (
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
        )}
        {storageStatus === 'unavailable' && (
          <p>
            You can still use the assistant, but this brew will not be saved after you leave the
            page.
          </p>
        )}
      </section>
    </div>
  );
}
