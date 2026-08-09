import { useEffect, useRef, useState } from 'react';
import RecipeFinder, { type FinderRecipe } from './RecipeFinder';
import {
  analyticsIssue,
  initAnalytics,
  trackTypedBrewEvent,
} from '../lib/analytics';
import { loadSessions } from '../lib/brew-assistant/storage';

/**
 * "Filter coffee" is three brewers, so it travels as a group and the assistant
 * asks which one. Sending mode=v60 would quietly decide that for the reader.
 */
const METHODS = [
  ['mode=espresso', 'Espresso'],
  ['group=filter', 'Filter coffee'],
] as const;

const ISSUES = [
  ['sour', 'Sour'],
  ['bitter', 'Bitter'],
  ['weak', 'Weak'],
  ['dry', 'Dry'],
  ['espresso-fast', 'Too fast'],
  ['espresso-slow', 'Too slow'],
  ['unsure', 'Not sure'],
] as const;

const TABS = [
  { id: 'recipe', label: 'Find a recipe' },
  { id: 'fix', label: 'Fix my coffee' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Two jobs, one block: find something to brew, or fix what you just brewed.
 * "Find a recipe" stays the default so the familiar path is untouched.
 */
export default function TaskSelector({ recipes }: { recipes: FinderRecipe[] }) {
  const [tab, setTab] = useState<TabId>('recipe');
  // Kept across tab switches: flipping tabs by accident should not undo choices.
  const [method, setMethod] = useState<string | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  // Opening the tab is reported once, however many times it is switched to.
  const openedReported = useRef(false);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (tab !== 'fix' || openedReported.current) return;
    openedReported.current = true;
    trackTypedBrewEvent('brew_assistant_opened', {
      entry_point: 'homepage',
      // Whether anything is saved locally, never what or which.
      returning_brewer: loadSessions().length > 0,
    });
  }, [tab]);

  const ready = method !== null && issue !== null;
  // new=1 starts a fresh session; earlier brews stay in the history.
  const href = ready
    ? `/assistant/?${method}&issue=${issue}&new=1&entry=homepage`
    : '/assistant/';

  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-sm md:p-8">
      <h2 className="font-display text-2xl font-medium">How can KAVOVO help?</h2>

      <div role="tablist" aria-label="What would you like to do?" className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next = TABS[(TABS.findIndex((x) => x.id === tab) + 1) % TABS.length];
                setTab(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              }
            }}
            className={`min-h-11 flex-1 rounded-md border px-4 text-sm font-medium transition-colors sm:flex-none ${
              tab === t.id
                ? 'border-accent bg-accent/8'
                : 'border-line bg-paper text-ink-soft hover:border-ink/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="panel-recipe"
        aria-labelledby="tab-recipe"
        hidden={tab !== 'recipe'}
        className="mt-6"
      >
        <RecipeFinder recipes={recipes} embedded />
      </div>

      <div
        role="tabpanel"
        id="panel-fix"
        aria-labelledby="tab-fix"
        hidden={tab !== 'fix'}
        className="mt-6 max-w-[800px]"
      >
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-accent uppercase">
          KAVOVO Brew Assistant
        </p>
        <h3 className="mt-2 font-display text-xl font-medium">Fix your next cup</h3>
        <p className="mt-2 text-sm text-ink-soft">
          Tell us what you brewed and what went wrong. KAVOVO will suggest one clear adjustment for
          your next attempt.
        </p>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium">What are you brewing?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {METHODS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={method === value}
                onClick={() => setMethod(value)}
                className={`min-h-11 rounded-md border px-4 text-sm transition-colors ${
                  method === value
                    ? 'border-accent bg-accent/8 font-medium'
                    : 'border-line bg-paper hover:border-ink/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">What went wrong?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ISSUES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={issue === value}
                onClick={() => setIssue(value)}
                className={`min-h-11 rounded-md border px-4 text-sm transition-colors ${
                  issue === value
                    ? 'border-accent bg-accent/8 font-medium'
                    : 'border-line bg-paper hover:border-ink/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          {/*
            An anchor, not a button: without JavaScript it still opens the
            assistant, just without the two answers pre-filled.
          */}
          <a
            href={href}
            aria-disabled={!ready}
            onClick={(e) => {
              if (!ready) {
                e.preventDefault();
                return;
              }
              // Sent before navigation; capture() is fire-and-forget, so the
              // link is never held up waiting for it.
              trackTypedBrewEvent('brew_assistant_started', {
                entry_point: 'homepage',
                method_group: method === 'mode=espresso' ? 'espresso' : 'filter',
                initial_issue: analyticsIssue(issue),
              });
            }}
            className={`flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors ${
              ready
                ? 'bg-accent text-accent-ink hover:bg-accent-dark'
                : 'border border-line bg-paper text-ink-soft'
            }`}
          >
            Start diagnosis &#8594;
          </a>
          <p className="text-sm text-ink-soft">
            {ready ? 'One change at a time. No guesswork.' : 'Pick a method and a symptom to start.'}
          </p>
        </div>
      </div>
    </div>
  );
}
