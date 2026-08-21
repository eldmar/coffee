/**
 * Privacy-first product analytics for the Brew Assistant.
 *
 * Anonymous and aggregate only: no profiles, no session recording, no
 * autocapture, and nothing about the coffee itself. Recipe numbers, free text
 * and the local session id never leave the browser — see PROHIBITED below.
 */

export type BrewMethod = 'espresso' | 'v60' | 'aeropress' | 'french_press';

export type BrewEntryPoint =
  | 'homepage'
  | 'assistant_page'
  | 'guide'
  | 'recipe'
  | 'floating_widget'
  | 'direct';

export type BrewIssue =
  | 'sour'
  | 'bitter'
  | 'weak'
  | 'strong'
  | 'dry'
  | 'muddy'
  | 'flat'
  | 'crema'
  | 'too_fast'
  | 'too_slow'
  | 'not_sure';

export type BrewAdjustment =
  | 'grind'
  | 'dose'
  | 'yield'
  | 'water'
  | 'temperature'
  | 'agitation'
  | 'puck_preparation';

export type BrewDirection = 'finer' | 'coarser' | 'increase' | 'decrease' | 'improve';

export type BrewAnalyticsEventMap = {
  brew_widget_opened: Record<never, never>;
  brew_widget_closed: {
    method?: BrewMethod;
    issue_category?: BrewIssue;
    attempt_number?: number;
  };
  brew_widget_full_assistant_opened: {
    method: BrewMethod;
    issue_category: BrewIssue;
  };
  brew_assistant_opened: Record<never, never>;
  brew_assistant_started: {
    method?: BrewMethod;
    issue_category?: BrewIssue;
  };
  brew_method_selected: {
    method: BrewMethod;
  };
  brew_diagnosis_completed: {
    method: BrewMethod;
    issue_category: BrewIssue;
    rule_id: string;
    adjustment_variable: BrewAdjustment;
    adjustment_direction: BrewDirection;
    attempt_number: number;
  };
  brew_next_attempt_started: {
    method: BrewMethod;
    rule_id: string;
    attempt_number: number;
  };
  brew_next_attempt_completed: {
    method: BrewMethod;
    rule_id: string;
    attempt_number: number;
  };
  brew_feedback_submitted: {
    method: BrewMethod;
    issue_category: BrewIssue;
    rule_id: string;
    adjustment_variable: BrewAdjustment;
    adjustment_direction: BrewDirection;
    attempt_number: number;
    helpful: boolean;
  };
  brew_related_content_clicked: {
    method: BrewMethod;
    rule_id: string;
  };
  brew_validation_failed: {
    method: BrewMethod;
  };
};

export type RetentionAnalyticsEventMap = {
  learn_lesson_completed: {
    path_slug: string;
    lesson_slug: string;
  };
  learn_path_continued: {
    path_slug: string;
    lesson_slug: string;
  };
  learn_progress_reset: {
    path_slug: string;
  };
  recipe_servings_changed: {
    recipe_slug: string;
    servings: number;
  };
  recipe_units_changed: {
    recipe_slug: string;
    units: 'metric' | 'us';
  };
  espresso_dose_changed: {
    recipe_slug: string;
  };
  recipe_saved: {
    recipe_slug: string;
  };
  recipe_removed: {
    recipe_slug: string;
  };
  saved_recipes_opened: Record<never, never>;
  recent_recipe_opened: {
    recipe_slug: string;
  };
  recent_history_cleared: Record<never, never>;
  related_content_clicked: {
    recipe_slug: string;
    content_type: 'recipe' | 'guide' | 'learn' | 'journal';
    content_slug: string;
  };
};

type AnalyticsValue = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsValue>;

/**
 * Property names that must never reach an analytics service. Checked at
 * runtime rather than trusted, because a call site is easy to get wrong and a
 * leak is not something you can take back.
 */
const PROHIBITED = new Set([
  'dose',
  'yield',
  'yieldOut',
  'yield_out',
  'water',
  'brew_water',
  'time',
  'brew_time',
  'temperature',
  'brew_temperature',
  'notes',
  'session_id',
  'sessionId',
  'email',
  'name',
  'ip',
  'coffee',
  'origin',
  'referrer',
  'url',
]);

const ALLOWED_PROPERTIES = new Set([
  'method',
  'issue_category',
  'rule_id',
  'adjustment_variable',
  'adjustment_direction',
  'attempt_number',
  'helpful',
  'path_slug',
  'lesson_slug',
  'recipe_slug',
  'servings',
  'units',
  'content_type',
  'content_slug',
]);

type PostHogClient = (typeof import('posthog-js'))['default'];

let client: PostHogClient | null = null;
let initialising: Promise<PostHogClient | null> | null = null;
let warned = false;

/** Enabled in production, or locally when explicitly switched on. */
const enabled = () =>
  import.meta.env.PROD || import.meta.env.PUBLIC_ANALYTICS_ENABLED === 'true';

function analyticsClient(): Promise<PostHogClient | null> {
  if (client) return Promise.resolve(client);
  if (initialising) return initialising;
  if (typeof window === 'undefined' || !enabled()) return Promise.resolve(null);

  const projectKey = import.meta.env.PUBLIC_POSTHOG_KEY;
  const apiHost = import.meta.env.PUBLIC_POSTHOG_HOST;

  if (!projectKey || !apiHost) {
    // Once only: a missing key is a deployment gap, not a per-event problem.
    if (!warned) {
      warned = true;
      console.warn('[Analytics] PostHog configuration is missing.');
    }
    initialising = Promise.resolve(null);
    return initialising;
  }

  initialising = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(projectKey, {
        api_host: apiHost,
        autocapture: false,
        capture_pageview: false,
        person_profiles: 'never',
        cookieless_mode: 'always',
        disable_session_recording: true,
      });
      client = posthog;
      return client;
    })
    .catch(() => null);

  return initialising;
}

export function initAnalytics(): void {
  void analyticsClient();
}

export function trackBrewEvent(event: string, properties: AnalyticsProperties = {}): void {
  const rejected = Object.keys(properties).filter(
    (key) => PROHIBITED.has(key) || !ALLOWED_PROPERTIES.has(key),
  );
  if (rejected.length > 0) {
    if (import.meta.env.DEV) {
      console.error(`[Analytics] refusing to send ${event}: ${rejected.join(', ')}`);
    }
    return;
  }

  const payload = { analytics_version: 1, ...properties };

  if (!enabled()) {
    console.info('[Analytics]', event, payload);
    return;
  }

  void analyticsClient().then((posthog) => {
    if (!posthog) return;
    try {
      posthog.capture(event, payload);
    } catch {
      // Analytics is a bystander. It never blocks or breaks the assistant.
    }
  });
}

export function trackTypedBrewEvent<TEvent extends keyof BrewAnalyticsEventMap>(
  event: TEvent,
  properties: BrewAnalyticsEventMap[TEvent],
): void {
  trackBrewEvent(event, properties as AnalyticsProperties);
}

export function trackRetentionEvent<TEvent extends keyof RetentionAnalyticsEventMap>(
  event: TEvent,
  properties: RetentionAnalyticsEventMap[TEvent],
): void {
  trackBrewEvent(event, properties as AnalyticsProperties);
}

// --- Normalisation -------------------------------------------------------

const ENTRY_POINTS: BrewEntryPoint[] = [
  'homepage',
  'assistant_page',
  'guide',
  'recipe',
  'floating_widget',
  'direct',
];

/** Anything unrecognised becomes "direct" rather than travelling as-is. */
export const normaliseEntryPoint = (raw: string | null | undefined): BrewEntryPoint => {
  if (raw === 'widget') return 'floating_widget';
  return ENTRY_POINTS.includes(raw as BrewEntryPoint) ? (raw as BrewEntryPoint) : 'direct';
};

/** The rule engine uses hyphens; the event taxonomy uses underscores. */
export const analyticsMethod = (method: string): BrewMethod =>
  method === 'french-press' ? 'french_press' : (method as BrewMethod);

const ISSUES: Record<string, BrewIssue> = {
  sour: 'sour',
  bitter: 'bitter',
  weak: 'weak',
  strong: 'strong',
  dry: 'dry',
  muddy: 'muddy',
  flat: 'flat',
  crema: 'crema',
  fast: 'too_fast',
  slow: 'too_slow',
  'espresso-fast': 'too_fast',
  'espresso-slow': 'too_slow',
  unsure: 'not_sure',
};

export const analyticsIssue = (issue: string | null): BrewIssue => ISSUES[issue ?? ''] ?? 'not_sure';

/**
 * A KAVOVO href becomes a content type and its canonical slug. Full URLs and
 * query strings are deliberately dropped.
 */
export function contentRef(
  href: string,
): { content_type: 'learn' | 'guide' | 'recipe'; content_slug: string } | null {
  const [path] = href.split(/[?#]/);
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const [section] = parts;
  if (section !== 'learn' && section !== 'guides' && section !== 'recipes') return null;
  return {
    content_type: section === 'guides' ? 'guide' : section === 'recipes' ? 'recipe' : 'learn',
    content_slug: parts[parts.length - 1],
  };
}
