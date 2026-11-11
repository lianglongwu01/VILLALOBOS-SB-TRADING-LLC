# VILLALOBOS MEDIA

Single-page website for VILLALOBOS SB TRADING LLC, focused on vertical micro-drama localization, AI-assisted dubbing, and digital syndication.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flianglongwu01%2FVILLALOBOS-SB-TRADING-LLC)

## Deployment

Import this repository into Vercel with the **Other** framework preset. The build runs TypeScript checks and copies the public HTML and CSS to `dist/`. Vercel builds the Node.js function from `api/index.ts` separately. The home page, `/privacy` and `/terms` continue to work without API credentials.

The project includes `vercel.json` with the public and API rewrites. Node.js 22 and the npm lockfile keep local and Vercel builds on the same dependency versions.

## Files

- `index.html`: complete page with 12 embedded project covers and supplied source metadata.
- `privacy.html`, `terms.html`, `legal.css`: TikTok Minis legal pages.
- `api/index.ts` and `lib/`: short-drama catalog, session and playback progress APIs.
- `supabase/migrations/001_drama_gateway.sql`: schema, permissions and continue-watching query.
- `supabase/seed.sql`: two sample dramas and five sample episodes for a test database.
- `vercel.json`: hosting and API routing configuration.

Fonts, Tailwind CSS, and Lucide icons load from external CDNs. Contact: aaes5616@outlook.com.

## Content maintenance

Episode totals reflect source records, not merged or edited upload counts. Cover display names and source titles are preserved separately. The ninth title has conflicting source-language metadata and is marked for confirmation. Playback links and episode runtimes have not yet been supplied. Distribution scope, territories, languages, and platform rights are confirmed per project agreement.

## Short-drama gateway

1. Run `supabase/migrations/001_drama_gateway.sql` once in the Supabase SQL Editor. It creates the three tables in one transaction. Run `supabase/seed.sql` in a test database if you need demo records. The `demo_*` IDs do not play real BytePlus video.
2. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as server environment variables in the Vercel project. An existing `SUPABASE_SERVICE_ROLE_KEY` is also supported. For TikTok login, also set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` and `SESSION_SIGNING_SECRET`. Use a random 32-byte secret represented as 64 hex characters. Generate it locally with `openssl rand -hex 32` or an equivalent secure generator. See `.env.example` for variable names.
3. If the Mini's H5 page has a different origin from `https://villalobos-media.vercel.app`, add its exact origin to `CORS_ALLOWED_ORIGINS`. Multiple origins are comma-separated. Add the gateway domain to the Mini's trusted domains in TikTok Developer Portal where required by the client configuration.
4. Run `npm ci` and `npm run build` before deploying. Configure the same environment variables in a test project or Vercel Preview environment before using real TikTok login or Supabase calls.

| Method and path | Request | Success response |
| --- | --- | --- |
| `GET /api/dramas` | Optional `tag`, `limit`, `offset`. Example `?tag=romance&limit=20`. Tags are lowercase slugs. | `{ data: Drama[], pagination }` with published titles only. |
| `GET /api/dramas/{id}` | Published drama UUID. | `{ data: { ...drama, episodes: [...] } }` with episodes in ascending order. |
| `POST /api/user/session` | `{ "code": "..." }` from `TTMinis.login()`. | `{ data: { openid, token, expires_in } }`. |
| `POST /api/user/progress` | Bearer token and `{ openid, drama_id, episode_num, progress_seconds }`. | `{ data: { drama_id, episode_num, progress_seconds, updated_at } }`. |
| `GET /api/user/progress` | Bearer token and `?openid=...`, with optional `limit`, `offset`. | `{ data: { continue_watching, history }, pagination }`. |

The gateway exchanges the one-time TikTok login code on the server and returns a one-hour gateway token. Use `Authorization: Bearer <token>` on both progress requests and send the same OpenID returned by login. A mismatched OpenID returns `403`. A missing or expired session returns `401`, in which case call `TTMinis.login()` again. The token endpoint returns only the gateway token and OpenID. Keep TikTok and Supabase credentials on the server.

History uses one row per user, drama and episode. Repeated saves update that row. Continue Watching returns the latest saved episode for up to 20 published dramas. History and catalog pagination default to 50 rows, cap each request at 100 and use `{ limit, offset, has_more }`. The API does not infer episode completion from position alone.

For cross-origin requests use `Content-Type: application/json` on POSTs and the `Authorization` header on progress requests. OPTIONS preflight returns `204` for the configured origins. Error responses use `{ "error": { "code": "...", "message": "..." } }`.

`byteplus_vid` and `is_free` are catalog metadata. Configure actual playback authorization in the approved TikTok Minis player and media workflow before publishing paid episodes.

Reference: [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [TikTok Minis silent login](https://developers.tiktok.com/docs/en/tiktok-minis-silent-login), and [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
