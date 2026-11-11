export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error('[drama-api] missing environment variable', name);
    throw new HttpError(503, 'SERVICE_NOT_CONFIGURED', 'The service is not configured.');
  }
  return value;
}

const siteOrigin = 'https://villalobos-media.vercel.app';
const allowedRequestHeaders = new Set(['authorization', 'content-type']);

export async function handleRequest(
  request: Request,
  methods: readonly string[],
  run: () => Promise<unknown>,
): Promise<Response> {
  const origin = request.headers.get('origin');
  const origins = [siteOrigin, ...(process.env.CORS_ALLOWED_ORIGINS ?? '').split(',')]
    .map(value => value.trim().replace(/\/$/, ''));
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  });
  const allowedOrigin = origin !== null && origin !== 'null' && origins.includes(origin);
  if (allowedOrigin) headers.set('Access-Control-Allow-Origin', origin);

  try {
    if (origin !== null && !allowedOrigin) {
      throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This browser origin is not allowed.');
    }
    if (!methods.length) throw new HttpError(404, 'NOT_FOUND', 'API route not found.');

    const allowedMethods = [...methods, 'OPTIONS'].join(', ');
    if (request.method === 'OPTIONS') {
      const requestedMethod = request.headers.get('access-control-request-method');
      const requestedHeaders = (request.headers.get('access-control-request-headers') ?? '')
        .split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
      if (requestedMethod && !methods.includes(requestedMethod)) {
        headers.set('Allow', allowedMethods);
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'This method is not allowed.');
      }
      if (requestedHeaders.some(name => !allowedRequestHeaders.has(name))) {
        throw new HttpError(400, 'CORS_HEADER_NOT_ALLOWED', 'A requested header is not allowed.');
      }
      headers.set('Allow', allowedMethods);
      headers.set('Access-Control-Allow-Methods', allowedMethods);
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.set('Access-Control-Max-Age', '600');
      headers.set('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
      return new Response(null, { status: 204, headers });
    }

    if (!methods.includes(request.method)) {
      headers.set('Allow', allowedMethods);
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'This method is not allowed.');
    }
    return Response.json(await run(), { headers });
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) headers.set('WWW-Authenticate', 'Bearer');
      return Response.json({ error: { code: error.code, message: error.message } }, {
        status: error.status,
        headers,
      });
    }
    // Log the error class without credentials, bodies, OpenIDs or upstream responses.
    console.error('[drama-api] unexpected failure', error instanceof Error ? error.name : typeof error);
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }, {
      status: 500,
      headers,
    });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const mime = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (mime !== 'application/json') {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send an application/json request body.');
  }
  if (Number(request.headers.get('content-length')) > 8192) {
    throw new HttpError(413, 'BODY_TOO_LARGE', 'Request body exceeds 8 KB.');
  }
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > 8192) {
    throw new HttpError(413, 'BODY_TOO_LARGE', 'Request body exceeds 8 KB.');
  }
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Use the same client error for invalid JSON and non-object JSON values.
  }
  throw new HttpError(400, 'INVALID_BODY', 'Send a valid JSON object.');
}

export function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) {
    throw new HttpError(400, 'INVALID_INPUT', field + ' must be a UUID.');
  }
  return value.toLowerCase();
}

export function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, 'INVALID_INPUT', field + ' must be an integer between ' + min + ' and ' + max + '.');
  }
  return value;
}

export function pagination(params: URLSearchParams) {
  function get(name: string, fallback: number, min: number, max: number) {
    const raw = params.get(name);
    if (raw === null) return fallback;
    return integer(/^\d+$/.test(raw) ? Number(raw) : NaN, name, min, max);
  }
  return { limit: get('limit', 50, 1, 100), offset: get('offset', 0, 0, 100000) };
}

export function pageOf<T>(rows: T[], { limit, offset }: ReturnType<typeof pagination>) {
  return { data: rows.slice(0, limit), pagination: { limit, offset, has_more: rows.length > limit } };
}
