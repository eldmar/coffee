import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SERVER_ERROR_MESSAGE,
  SUCCESS_MESSAGE,
  VALIDATION_MESSAGE,
  worker,
  type Env,
} from './index';

const BREVO_URL = 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation';

function makeEnv(overrides: Partial<Env> = {}) {
  const assetsFetch = vi.fn(async () => new Response('asset response'));
  const emailLimit = vi.fn(async () => ({ success: true }));
  const ipLimit = vi.fn(async () => ({ success: true }));
  const env: Env = {
    ASSETS: { fetch: assetsFetch },
    SUBSCRIBE_RATE_LIMITER: { limit: emailLimit },
    SUBSCRIBE_IP_RATE_LIMITER: { limit: ipLimit },
    BREVO_API_KEY: 'brevo-secret',
    BREVO_LIST_ID: '42',
    BREVO_DOI_TEMPLATE_ID: '7',
    SITE_URL: 'https://coffee.example/',
    ...overrides,
  };
  return { env, assetsFetch, emailLimit, ipLimit };
}

function subscribeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Request {
  return new Request('https://coffee.example/api/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'CF-Connecting-IP': '203.0.113.10',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('subscription worker routing', () => {
  it('redirects the legacy Worker hostname while preserving path and query', async () => {
    const { env, assetsFetch } = makeEnv();
    const response = await worker.fetch(
      new Request(
        'https://coffee.ridkous.workers.dev/recipes/espresso-tonic/?utm_source=migration',
      ),
      env,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(
      'https://kavovo.uk/recipes/espresso-tonic/?utm_source=migration',
    );
    expect(assetsFetch).not.toHaveBeenCalled();
  });

  it('redirects www and plain HTTP to the canonical HTTPS origin', async () => {
    const { env, assetsFetch } = makeEnv();
    const wwwResponse = await worker.fetch(
      new Request('https://www.kavovo.uk/learn/?from=www'),
      env,
    );
    const httpResponse = await worker.fetch(
      new Request('http://kavovo.uk/guides/v60/?from=http'),
      env,
    );

    expect(wwwResponse.status).toBe(301);
    expect(wwwResponse.headers.get('Location')).toBe('https://kavovo.uk/learn/?from=www');
    expect(httpResponse.status).toBe(301);
    expect(httpResponse.headers.get('Location')).toBe(
      'https://kavovo.uk/guides/v60/?from=http',
    );
    expect(assetsFetch).not.toHaveBeenCalled();
  });

  it('redirects the legacy Saved route while preserving the query string', async () => {
    const { env, assetsFetch } = makeEnv();
    const response = await worker.fetch(
      new Request('https://kavovo.uk/saved/?from=bookmark'),
      env,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(
      'https://kavovo.uk/recipes/saved/?from=bookmark',
    );
    expect(assetsFetch).not.toHaveBeenCalled();
  });

  it('delegates non-API requests to static assets', async () => {
    const { env, assetsFetch } = makeEnv();
    const request = new Request('https://coffee.example/recipes/');

    const response = await worker.fetch(request, env);

    expect(await response.text()).toBe('asset response');
    expect(assetsFetch).toHaveBeenCalledWith(request);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const { env } = makeEnv();
    const response = await worker.fetch(
      new Request('https://coffee.example/api/unknown', {
        headers: { Accept: 'application/json' },
      }),
      env,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual({ ok: false, code: 'not_found', message: 'Not found.' });
  });

  it('allows only POST on the subscription endpoint', async () => {
    const { env } = makeEnv();
    const response = await worker.fetch(
      new Request('https://coffee.example/api/subscribe', {
        headers: { Accept: 'application/json' },
      }),
      env,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
  });
});

describe('subscription validation and protection', () => {
  it('rejects an invalid email before calling Brevo', async () => {
    const brevoFetch = vi.fn();
    vi.stubGlobal('fetch', brevoFetch);
    const { env } = makeEnv();

    const response = await worker.fetch(
      subscribeRequest({ email: 'not-an-email', source: 'homepage-newsletter', website: '' }),
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'invalid_email',
      message: VALIDATION_MESSAGE,
    });
    expect(brevoFetch).not.toHaveBeenCalled();
  });

  it('accepts only known form sources', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { env } = makeEnv();
    const response = await worker.fetch(
      subscribeRequest({ email: 'reader@example.com', source: 'unknown', website: '' }),
      env,
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_source');
  });

  it('silently absorbs honeypot submissions', async () => {
    const brevoFetch = vi.fn();
    vi.stubGlobal('fetch', brevoFetch);
    const { env, emailLimit, ipLimit } = makeEnv();

    const response = await worker.fetch(
      subscribeRequest({ email: 'bot@example.com', source: 'unknown', website: 'spam.test' }),
      env,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe(SUCCESS_MESSAGE);
    expect(emailLimit).not.toHaveBeenCalled();
    expect(ipLimit).not.toHaveBeenCalled();
    expect(brevoFetch).not.toHaveBeenCalled();
  });

  it('rejects oversized request bodies', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { env } = makeEnv();
    const response = await worker.fetch(
      subscribeRequest({
        email: 'reader@example.com',
        source: 'homepage-newsletter',
        website: 'x'.repeat(2_100),
      }),
      env,
    );

    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe('body_too_large');
  });

  it('blocks cross-origin submissions', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { env } = makeEnv();
    const response = await worker.fetch(
      subscribeRequest(
        { email: 'reader@example.com', source: 'homepage-newsletter', website: '' },
        { Origin: 'https://other.example' },
      ),
      env,
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('origin_not_allowed');
  });

  it('rate-limits repeated requests without exposing the address', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const emailLimit = vi.fn(async () => ({ success: false }));
    const { env, ipLimit } = makeEnv({
      SUBSCRIBE_RATE_LIMITER: { limit: emailLimit },
    });
    const response = await worker.fetch(
      subscribeRequest({
        email: 'reader@example.com',
        source: 'homepage-newsletter',
        website: '',
      }),
      env,
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'rate_limited',
      message: SERVER_ERROR_MESSAGE,
    });
    expect(emailLimit).toHaveBeenCalledTimes(1);
    expect(String(emailLimit.mock.calls[0][0].key)).not.toContain('reader@example.com');
    expect(ipLimit).toHaveBeenCalledTimes(1);
  });

  it('rate-limits address rotation without exposing the client IP', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const ipLimit = vi.fn(async () => ({ success: false }));
    const { env, emailLimit } = makeEnv({
      SUBSCRIBE_IP_RATE_LIMITER: { limit: ipLimit },
    });
    const response = await worker.fetch(
      subscribeRequest({
        email: 'another-reader@example.com',
        source: 'homepage-newsletter',
        website: '',
      }),
      env,
    );

    expect(response.status).toBe(429);
    expect(emailLimit).toHaveBeenCalledTimes(1);
    expect(ipLimit).toHaveBeenCalledTimes(1);
    expect(String(ipLimit.mock.calls[0][0].key)).not.toContain('203.0.113.10');
  });
});

describe('Brevo double opt-in', () => {
  it('sends the approved fields and returns a neutral success response', async () => {
    const brevoFetch = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', brevoFetch);
    const { env, emailLimit, ipLimit } = makeEnv();

    const response = await worker.fetch(
      subscribeRequest({
        email: 'Reader@Example.com',
        source: 'shop-waitlist',
        website: '',
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      code: 'confirmation_sent',
      message: SUCCESS_MESSAGE,
    });
    expect(emailLimit).toHaveBeenCalledTimes(1);
    expect(String(emailLimit.mock.calls[0][0].key)).not.toContain('reader@example.com');
    expect(ipLimit).toHaveBeenCalledTimes(1);
    expect(String(ipLimit.mock.calls[0][0].key)).not.toContain('203.0.113.10');
    expect(brevoFetch).toHaveBeenCalledTimes(1);

    const [url, init] = brevoFetch.mock.calls[0];
    expect(url).toBe(BREVO_URL);
    expect(init?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        'api-key': 'brevo-secret',
      }),
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'reader@example.com',
      includeListIds: [42],
      templateId: 7,
      redirectionUrl: 'https://coffee.example/subscription-confirmed/',
      attributes: { SOURCE: 'shop-waitlist' },
    });
  });

  it('does not reveal an existing or repeated subscription', async () => {
    const brevoFetch = vi.fn(async () =>
      Response.json(
        { code: 'duplicate_parameter', message: 'Contact already exists' },
        { status: 400 },
      ),
    );
    vi.stubGlobal('fetch', brevoFetch);
    const { env } = makeEnv();

    const response = await worker.fetch(
      subscribeRequest({
        email: 'reader@example.com',
        source: 'homepage-newsletter',
        website: '',
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe(SUCCESS_MESSAGE);
  });

  it('keeps provider failures generic', async () => {
    const brevoFetch = vi.fn(async () =>
      Response.json({ code: 'unauthorized', message: 'Bad key' }, { status: 401 }),
    );
    vi.stubGlobal('fetch', brevoFetch);
    const { env } = makeEnv();

    const response = await worker.fetch(
      subscribeRequest({
        email: 'reader@example.com',
        source: 'homepage-newsletter',
        website: '',
      }),
      env,
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'provider_error',
      message: SERVER_ERROR_MESSAGE,
    });
  });

  it('returns an understandable HTML fallback without JavaScript', async () => {
    const brevoFetch = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', brevoFetch);
    const { env } = makeEnv();
    const request = new Request('https://coffee.example/api/subscribe', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: 'reader@example.com',
        source: 'homepage-newsletter',
        website: '',
      }),
    });

    const response = await worker.fetch(request, env);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(html).toContain(SUCCESS_MESSAGE);
    expect(html).not.toContain('reader@example.com');
  });
});
