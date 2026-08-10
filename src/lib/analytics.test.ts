import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => vi.fn());
const init = vi.hoisted(() => vi.fn());
vi.mock('posthog-js', () => ({ default: { init, capture } }));

/**
 * `enabled` is driven by PUBLIC_ANALYTICS_ENABLED here rather than PROD, which
 * Vite inlines at transform time and cannot be stubbed. The module also needs a
 * window to initialise, so tests running under node get a stand-in.
 */
async function loadAnalytics(sending: boolean, env: Record<string, string> = {}) {
  vi.resetModules();
  capture.mockClear();
  init.mockClear();
  vi.stubGlobal('window', {});
  vi.stubEnv('PUBLIC_ANALYTICS_ENABLED', sending ? 'true' : '');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('./analytics');
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('analytics switched off', () => {
  it('logs instead of sending', async () => {
    const { trackBrewEvent } = await loadAnalytics(false);
    trackBrewEvent('brew_assistant_opened', { entry_point: 'homepage' });
    expect(capture).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
  });
});

describe('switched on without configuration', () => {
  it('warns once and stays silent', async () => {
    const { trackBrewEvent } = await loadAnalytics(true, {
      PUBLIC_POSTHOG_KEY: '',
      PUBLIC_POSTHOG_HOST: '',
    });
    trackBrewEvent('brew_assistant_opened', { entry_point: 'homepage' });
    trackBrewEvent('brew_assistant_opened', { entry_point: 'homepage' });
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalledTimes(1));
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('switched on with configuration', () => {
  const env = {
    PUBLIC_POSTHOG_KEY: 'phc_test',
    PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
  };

  it('stamps every event with the schema version', async () => {
    const { trackTypedBrewEvent } = await loadAnalytics(true, env);
    trackTypedBrewEvent('brew_method_selected', { method: 'espresso', entry_point: 'homepage' });
    await vi.waitFor(() =>
      expect(capture).toHaveBeenCalledWith(
        'brew_method_selected',
        expect.objectContaining({ analytics_version: 1 }),
      ),
    );
  });

  it('initialises with autocapture, profiles and replay all off', async () => {
    const { trackTypedBrewEvent } = await loadAnalytics(true, env);
    trackTypedBrewEvent('brew_method_selected', { method: 'v60', entry_point: 'direct' });
    await vi.waitFor(() =>
      expect(init).toHaveBeenCalledWith(
        'phc_test',
        expect.objectContaining({
          autocapture: false,
          capture_pageview: false,
          person_profiles: 'never',
          cookieless_mode: 'always',
          disable_session_recording: true,
        }),
      ),
    );
  });

  it('refuses to send a recipe value or free text', async () => {
    const { trackBrewEvent } = await loadAnalytics(true, env);
    trackBrewEvent('brew_diagnosis_completed', { method: 'espresso', dose: 18 });
    trackBrewEvent('brew_diagnosis_completed', { method: 'espresso', notes: 'tasted odd' });
    trackBrewEvent('brew_diagnosis_completed', { method: 'espresso', session_id: 'abc' });
    expect(capture).not.toHaveBeenCalled();
  });

  it('never throws out of a capture failure', async () => {
    const { trackTypedBrewEvent } = await loadAnalytics(true, env);
    capture.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    expect(() =>
      trackTypedBrewEvent('brew_method_selected', { method: 'espresso', entry_point: 'direct' }),
    ).not.toThrow();
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
  });
});

describe('normalisation', () => {
  it('maps the rule engine method onto the taxonomy', async () => {
    const { analyticsMethod } = await loadAnalytics(false);
    expect(analyticsMethod('french-press')).toBe('french_press');
    expect(analyticsMethod('espresso')).toBe('espresso');
  });

  it('maps homepage symptoms onto issue categories', async () => {
    const { analyticsIssue } = await loadAnalytics(false);
    expect(analyticsIssue('espresso-fast')).toBe('too_fast');
    expect(analyticsIssue('unsure')).toBe('not_sure');
    expect(analyticsIssue('something-else')).toBe('not_sure');
    expect(analyticsIssue(null)).toBe('not_sure');
  });

  it('falls back to direct for an unknown entry point', async () => {
    const { normaliseEntryPoint } = await loadAnalytics(false);
    expect(normaliseEntryPoint('guide')).toBe('guide');
    expect(normaliseEntryPoint('utm_campaign_spam')).toBe('direct');
    expect(normaliseEntryPoint(null)).toBe('direct');
  });

  it('reduces a link to a content type and slug, dropping the query', async () => {
    const { contentRef } = await loadAnalytics(false);
    expect(contentRef('/learn/dial-in-espresso/sour-vs-bitter-espresso/')).toEqual({
      content_type: 'learn',
      content_slug: 'sour-vs-bitter-espresso',
    });
    expect(contentRef('/guides/v60/?utm=x')).toEqual({
      content_type: 'guide',
      content_slug: 'v60',
    });
    expect(contentRef('/recipes/espresso/')).toEqual({
      content_type: 'recipe',
      content_slug: 'espresso',
    });
    expect(contentRef('/about/')).toBeNull();
  });
});
