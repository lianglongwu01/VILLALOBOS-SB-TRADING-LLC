import { jwtVerify, SignJWT } from 'jose';
import { env, HttpError, readJson } from './http.js';

const issuer = 'villalobos-media-gateway';
const audience = 'villalobos-tiktok-minis';
const lifetimeSeconds = 3600;

function signingKey() {
  const secret = env('SESSION_SIGNING_SECRET');
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    console.error('[drama-api] SESSION_SIGNING_SECRET must be 64 hexadecimal characters');
    throw new HttpError(503, 'SERVICE_NOT_CONFIGURED', 'The service is not configured.');
  }
  return Buffer.from(secret, 'hex');
}

function isOpenId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
    && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

export async function requireSession(request: Request): Promise<string> {
  const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token || token.length > 4096) {
    throw new HttpError(401, 'SESSION_REQUIRED', 'A valid gateway session is required.');
  }
  const key = signingKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'], issuer, audience,
      requiredClaims: ['sub', 'iat', 'exp'], maxTokenAge: lifetimeSeconds,
    });
    if (isOpenId(payload.sub)) return payload.sub;
  } catch {
    // The caller receives a single error for invalid and expired tokens.
  }
  throw new HttpError(401, 'INVALID_SESSION', 'The gateway session is invalid or expired.');
}

export function matchOpenId(input: unknown, verified: string): void {
  if (!isOpenId(input)) throw new HttpError(400, 'INVALID_INPUT', 'A valid openid is required.');
  if (input !== verified) throw new HttpError(403, 'OPENID_MISMATCH', 'This session cannot access that user.');
}

export async function createSession(request: Request) {
  const { code } = await readJson(request);
  if (typeof code !== 'string' || !code.trim() || code.length > 4096) {
    throw new HttpError(400, 'INVALID_INPUT', 'A TikTok Minis login code is required.');
  }
  const key = signingKey();
  const form = new URLSearchParams({
    client_key: env('TIKTOK_CLIENT_KEY'),
    client_secret: env('TIKTOK_CLIENT_SECRET'),
    code,
    grant_type: 'authorization_code',
  });
  let response: Response;
  try {
    response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
  } catch {
    throw new HttpError(502, 'TIKTOK_UNAVAILABLE', 'TikTok login is temporarily unavailable.');
  }
  const payload = await response.json().catch(() => null) as { open_id?: unknown; error?: unknown } | null;
  if (payload?.error === 'invalid_grant') {
    throw new HttpError(401, 'INVALID_LOGIN_CODE', 'The TikTok login code has expired or already been used.');
  }
  if (response.status === 429) {
    throw new HttpError(503, 'TIKTOK_BUSY', 'TikTok login is busy. Try again with a new code.');
  }
  if (!response.ok || !isOpenId(payload?.open_id)) {
    console.error('[drama-api] TikTok login exchange failed', response.status);
    throw new HttpError(502, 'TIKTOK_LOGIN_FAILED', 'TikTok could not confirm the login.');
  }

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(payload.open_id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + lifetimeSeconds)
    .sign(key);
  return { data: { openid: payload.open_id, token, expires_in: lifetimeSeconds } };
}
