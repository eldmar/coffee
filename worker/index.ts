const BREVO_DOI_ENDPOINT = 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation';
const MAX_BODY_BYTES = 2_048;

export const SUCCESS_MESSAGE = 'Check your inbox to confirm your subscription.';
export const VALIDATION_MESSAGE = 'Enter a valid email address.';
export const SERVER_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const ALLOWED_SOURCES = ['homepage-newsletter', 'shop-waitlist'] as const;
type SubscribeSource = (typeof ALLOWED_SOURCES)[number];

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ASSETS: AssetsBinding;
  SUBSCRIBE_RATE_LIMITER: RateLimitBinding;
  SUBSCRIBE_IP_RATE_LIMITER: RateLimitBinding;
  BREVO_API_KEY?: string;
  BREVO_LIST_ID?: string;
  BREVO_DOI_TEMPLATE_ID?: string;
  SITE_URL?: string;
}

interface SubscribePayload {
  email: string;
  source: string;
  website: string;
}

interface ApiBody {
  ok: boolean;
  code: string;
  message: string;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const responseHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  Vary: 'Accept',
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });

function wantsHtml(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

function htmlResponse(status: number, body: ApiBody, source?: SubscribeSource): Response {
  const backHref = source === 'shop-waitlist' ? '/shop/' : '/#newsletter';
  const title = body.ok ? 'Almost there' : 'Subscription unavailable';
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${title} - KAVOVO</title>
    <style>
      body { margin: 0; background: #fbf8f2; color: #2b211b; font-family: ui-sans-serif, system-ui, sans-serif; }
      main { box-sizing: border-box; display: grid; min-height: 100vh; place-content: center; padding: 2rem; text-align: center; }
      h1 { margin: 0; font-family: Georgia, serif; font-size: clamp(2rem, 6vw, 3.5rem); font-weight: 500; }
      p { margin: 1rem auto 0; max-width: 34rem; color: #6f6357; line-height: 1.6; }
      a { display: inline-block; margin-top: 1.5rem; border-radius: .5rem; background: #a43b32; color: #f3ebdd; padding: .7rem 1rem; text-decoration: none; }
      a:focus-visible { outline: 2px solid #606848; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${escapeHtml(body.message)}</p>
      <a href="${backHref}">Back to KAVOVO</a>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      ...responseHeaders,
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function apiResponse(
  request: Request,
  status: number,
  body: ApiBody,
  source?: SubscribeSource,
): Response {
  if (wantsHtml(request)) return htmlResponse(status, body, source);
  return Response.json(body, { status, headers: responseHeaders });
}

function successResponse(request: Request, source?: SubscribeSource): Response {
  return apiResponse(
    request,
    200,
    { ok: true, code: 'confirmation_sent', message: SUCCESS_MESSAGE },
    source,
  );
}

function parseSource(value: string): SubscribeSource | null {
  return ALLOWED_SOURCES.includes(value as SubscribeSource) ? (value as SubscribeSource) : null;
}

function isValidEmail(email: string): boolean {
  if (email.length > 254 || email.includes('\r') || email.includes('\n')) return false;
  const [local = ''] = email.split('@');
  if (local.length === 0 || local.length > 64) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email);
}

async function readPayload(request: Request): Promise<SubscribePayload> {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ApiError(413, 'body_too_large', SERVER_ERROR_MESSAGE);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new ApiError(413, 'body_too_large', SERVER_ERROR_MESSAGE);
  }

  const contentType = (request.headers.get('Content-Type') ?? '').split(';', 1)[0].trim();
  let data: Record<string, unknown>;

  try {
    if (contentType === 'application/json') {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Body is not an object');
      }
      data = parsed as Record<string, unknown>;
    } else if (contentType === 'application/x-www-form-urlencoded') {
      data = Object.fromEntries(new URLSearchParams(raw));
    } else {
      throw new ApiError(415, 'unsupported_media_type', SERVER_ERROR_MESSAGE);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'invalid_body', SERVER_ERROR_MESSAGE);
  }

  return {
    email: typeof data.email === 'string' ? data.email.trim().toLowerCase() : '',
    source: typeof data.source === 'string' ? data.source : '',
    website: typeof data.website === 'string' ? data.website.trim() : '',
  };
}

function positiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/u.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function subscriptionConfig(env: Env): {
  apiKey: string;
  listId: number;
  templateId: number;
  redirectionUrl: string;
} | null {
  const listId = positiveInteger(env.BREVO_LIST_ID);
  const templateId = positiveInteger(env.BREVO_DOI_TEMPLATE_ID);
  if (!env.BREVO_API_KEY || !listId || !templateId || !env.SITE_URL) return null;

  try {
    return {
      apiKey: env.BREVO_API_KEY,
      listId,
      templateId,
      redirectionUrl: new URL('/subscription-confirmed/', env.SITE_URL).toString(),
    };
  } catch {
    return null;
  }
}

async function rateLimitHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return hash;
}

async function emailRateLimitKey(email: string, source: SubscribeSource): Promise<string> {
  return `${source}:email:${await rateLimitHash(email)}`;
}

async function ipRateLimitKey(ip: string): Promise<string> {
  return `ip:${await rateLimitHash(ip)}`;
}

async function subscribe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    const response = apiResponse(request, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: SERVER_ERROR_MESSAGE,
    });
    response.headers.set('Allow', 'POST');
    return response;
  }

  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return apiResponse(request, 403, {
          ok: false,
          code: 'origin_not_allowed',
          message: SERVER_ERROR_MESSAGE,
        });
      }
    } catch {
      return apiResponse(request, 403, {
        ok: false,
        code: 'origin_not_allowed',
        message: SERVER_ERROR_MESSAGE,
      });
    }
  }

  let payload: SubscribePayload;
  try {
    payload = await readPayload(request);
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(400, 'invalid_body', SERVER_ERROR_MESSAGE);
    return apiResponse(request, apiError.status, {
      ok: false,
      code: apiError.code,
      message: apiError.message,
    });
  }

  // Bots receive the same success response as people, without contacting Brevo.
  if (payload.website) return successResponse(request);

  const source = parseSource(payload.source);
  if (!source) {
    return apiResponse(request, 400, {
      ok: false,
      code: 'invalid_source',
      message: SERVER_ERROR_MESSAGE,
    });
  }

  if (!isValidEmail(payload.email)) {
    return apiResponse(
      request,
      400,
      { ok: false, code: 'invalid_email', message: VALIDATION_MESSAGE },
      source,
    );
  }

  const config = subscriptionConfig(env);
  if (!config) {
    return apiResponse(
      request,
      503,
      { ok: false, code: 'service_unavailable', message: SERVER_ERROR_MESSAGE },
      source,
    );
  }

  const clientIp = request.headers.get('CF-Connecting-IP');
  const rateLimits = [
    env.SUBSCRIBE_RATE_LIMITER.limit({
      key: await emailRateLimitKey(payload.email, source),
    }),
  ];
  if (clientIp) {
    rateLimits.push(
      env.SUBSCRIBE_IP_RATE_LIMITER.limit({
        key: await ipRateLimitKey(clientIp),
      }),
    );
  }

  const limits = await Promise.all(rateLimits);
  if (limits.some(({ success }) => !success)) {
    return apiResponse(
      request,
      429,
      { ok: false, code: 'rate_limited', message: SERVER_ERROR_MESSAGE },
      source,
    );
  }

  let brevoResponse: Response;
  try {
    brevoResponse = await fetch(BREVO_DOI_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
      },
      body: JSON.stringify({
        email: payload.email,
        includeListIds: [config.listId],
        templateId: config.templateId,
        redirectionUrl: config.redirectionUrl,
        attributes: { SOURCE: source },
      }),
    });
  } catch {
    return apiResponse(
      request,
      502,
      { ok: false, code: 'provider_unavailable', message: SERVER_ERROR_MESSAGE },
      source,
    );
  }

  if (brevoResponse.ok) return successResponse(request, source);

  let providerCode = '';
  try {
    const body = (await brevoResponse.json()) as { code?: unknown };
    if (typeof body.code === 'string') providerCode = body.code;
  } catch {
    // Provider details stay private. Only a known duplicate is handled specially.
  }

  if (
    brevoResponse.status === 400 &&
    (providerCode === 'duplicate_parameter' || providerCode === 'duplicate_request')
  ) {
    return successResponse(request, source);
  }

  return apiResponse(
    request,
    502,
    { ok: false, code: 'provider_error', message: SERVER_ERROR_MESSAGE },
    source,
  );
}

export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/subscribe') return subscribe(request, env);
    if (pathname.startsWith('/api/')) {
      return apiResponse(request, 404, {
        ok: false,
        code: 'not_found',
        message: 'Not found.',
      });
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
