# Mohamed Maher — Cloudflare Portfolio & CMS

Real Worker + D1 + R2 implementation adapted from the **V6** prototype. The public site keeps its V6 visual design; `/admin` is a single-page CMS. Portfolio and individual project pages return **server-rendered HTML** with titles, descriptions, canonical URLs and structured crawlable links. Static CSS/JS live on Cloudflare Workers Static Assets.

## Quick start (Ubuntu/Linux/macOS)

Requires Node.js 20+, npm, Python 3, curl, Internet and a Cloudflare account with Workers, D1 and R2 enabled.

```bash
unzip maher-portfolio-cloudflare.zip
cd maher-portfolio-cloudflare
bash scripts/deploy.sh YOUR_DOMAIN.com
```

The script signs in to Cloudflare via Wrangler (a browser window may open), checks/creates `maher-portfolio-db` and `maher-portfolio-media`, updates `wrangler.jsonc`, applies remote migrations, deploys Worker + Static Assets, creates a cryptographically random **32-byte** admin token (43-character base64url representation), and writes it to `.secrets/admin-token.txt` with mode `0600`. It installs the token as a Worker secret and prints it for you. This is **initial setup**, not the routine update workflow; rerunning it can replace the admin secret.

For the existing GitHub-connected deployment, run checks locally, commit only intended changes, then push to `main` to trigger Cloudflare's build/deployment. Do not rerun the setup script or manually deploy for ordinary code updates. Verify the build result before assuming production has changed.

When your domain is already an **active Cloudflare zone**, Wrangler can bind the custom domain automatically, including DNS and TLS. If its nameservers are still set at your registrar, change them at the registrar first; the script **cannot** change registrar-side nameservers automatically. You do not need to share DNS1/DNS2 or any API keys in ChatGPT.

If you don't want a custom domain yet, run `bash scripts/deploy.sh` and leave the domain prompt blank to use the Worker’s `workers.dev` address. **R2 setup may require enabling billing even with free-tier usage.** This script cannot guarantee zero billing under future quotas or beyond limits.

### Start editing

- Public site: `https://YOUR_DOMAIN/`
- CMS: `https://YOUR_DOMAIN/admin`
- Paste your token into the login field. It lives **only in JavaScript memory**; reloading the page logs you out.
- Dashboard → Projects: create projects, choose tracks, and preview saved drafts within the authenticated admin session without publishing.
- Dashboard → Media Library: upload photos/videos, optionally convert, crop and scale locally, choose names/prefixes, rename existing media, edit as a new copy and browse paginated results. Referenced files cannot be deleted until detached.
- Dashboard → Homepage: change text and upload portrait or leave the gradient without an image.
- Dashboard → Settings: upload a logo, favicon and CV PDFs, set professional identity/default project filter and enable Spanish when ready.
- Dashboard → Visitor Analytics: charts and tables from D1 (7/30/90 days); optional Cloudflare GraphQL remains an independent API.
- Dashboard → Export / Backup: download the full application database as SQL (schema and data), optionally with original registered R2 media in a TAR archive. See `docs/API.md` for scope and restore instructions.

There are **no sample projects, fake messages, fabricated testimonials, demo offers or placeholder personal photos** in the database. Default skills/tools (Node.js, Express, PHP, TypeScript, databases, Python, React, Linux, Docker, Git, IoT and others) are provided as editable initial data. Check/adjust the list and homepage biography before sharing publicly.

## Architecture

```text
Browser ── GET /, /projects/:slug, /focus/:slug ──▶ Worker SSR ─▶ D1
    │                                                    │
    ├── GET /app.css, /app.js ───────────────────▶ Static Assets
    ├── GET /media/:uuid, /cv ───────────────────▶ Worker ─▶ R2
    ├── POST /api/contact ──────────────────────▶ Worker ─▶ D1
    └── /admin (SPA; in-memory token only)
              │ Authorization: Bearer 32-byte random token
              ├── /api/admin/state, collections ─▶ D1
              ├── /api/admin/files, cv ─────────▶ R2 + D1 metadata
              └── /api/admin/analytics ─────────▶ D1 / optional Cloudflare GraphQL
```

```text
src/index.js       HTTP routes, R2, login check, CORS, security headers, analytics
src/data.js        D1 reads/updates and input validation
src/render.js      Server-rendered HTML, metadata and sitemap links
src/defaults.js    Default site content imported by Worker
data/defaults.json Editable initial settings and skills
public/app.css     CSS extracted from V6
public/app.js      Original V6 dashboard / page interactions, connected to APIs
public/demos/      Put small static demos here; deployed with Worker assets
scripts/deploy.sh  Cloudflare setup & repeatable deployment
scripts/seed_sql.py Generates idempotent seed migration
scripts/seed_sql.py  Rebuilds the idempotent defaults migration from data/defaults.json
 database/         D1 schema & seed migrations
 docs/API.md       Complete HTTP API documentation
```

The database stores CMS records and project categories as editable arrays on each project. Public project category filters are generated from the unique tags of published projects; deleting the last project in a category removes that category from filters. Share Links use `/focus/:slug` and store selected project IDs + tracks. Sections, their items, project media and skills can be reordered from the dashboard.

The public site uses URLs like `/projects/example` rather than fragment routes. The Worker serves HTML content before JavaScript, so bots and clients can read actual headings, project summaries, canonical URLs and meta descriptions. CSS/JS are static CDN assets. No custom page cache is enabled (easy to introduce later after measuring performance).

## Security & external clients

- `ADMIN_TOKEN` is a **Worker secret**, not bundled client JavaScript. Browser memory holds a copy only between login and closing or refreshing the page.
- Token verification compares SHA-256 digests, requires HTTPS in production, and is repeated for **every admin endpoint**, with basic IP-based failed attempt throttling.
- Security headers include `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`: public pages and admin cannot be embedded in an iframe.
- Your own external backend, local AI tool and curl may call the APIs using Authorization. Browser-based dashboards on another origin need `ALLOWED_ORIGINS` set explicitly; for example: `http://localhost:5173,https://my-tool.example`.
- Contact form writes to D1, with validation, honeypot and basic rate limiting. This is not the same as a CAPTCHA; if spam occurs, enable Cloudflare Turnstile.
- R2 objects are private in the bucket and accessed through stable `/media/:uuid` URLs. The Worker checks MIME type and a conservative **90 MiB** request limit (under Cloudflare’s 100 MB Free-plan max); uploads have unique IDs.
- Content inserted into HTML is escaped. Arbitrary HTML is not supported by the generic item editor.
- For the small personal CMS, updates save complete content snapshots; **keep backups** of your D1 data and R2 assets. Do not give tokens to untrusted AI tools.

### Local development

Install dependencies after you can access the npm registry:

```bash
npm install
python3 scripts/seed_sql.py
npx wrangler d1 migrations apply maher-portfolio-db --local
# Put ADMIN_TOKEN=your-development-token into .dev.vars (excluded from Git)
npx wrangler dev
```

`npm run check` checks JavaScript syntax; `npm test` runs offline unit tests. `wrangler dev` uses local D1/R2 data unless configured otherwise.

### Backups and further configuration

- Use **Export / Backup** for full application database SQL downloads (`GET /api/admin/export?parts=database`); add `,media` for a streamed TAR containing `backup.sql` and original registered R2 objects. The SQL includes all application tables, indexes, views and triggers, including message details and country data. SQL is limited to 32 MiB; browser fallback downloads are limited to 64 MiB without direct-to-disk support. Keep exports private. No automatic restore endpoint exists.
- Restore SQL into a new SQLite/D1 database; use `PRAGMA foreign_key_check;` to verify references. Restore archived files separately to R2 at their original object keys. For larger or unsupported databases use `npx wrangler d1 export maher-portfolio-db --remote --output backup.sql` and back up R2 separately. Worker secrets and Cloudflare internal metadata are not included.
- Changing the admin token: replace `.secrets/admin-token.txt` securely and run `printf '%s' "$(cat .secrets/admin-token.txt)" | npx wrangler secret put ADMIN_TOKEN`; do **not** commit secrets.
- To activate Cloudflare zone analytics in the dashboard, add `CLOUDFLARE_ZONE_ID` to `vars` in `wrangler.jsonc` and set `CF_ANALYTICS_TOKEN` using `npx wrangler secret put CF_ANALYTICS_TOKEN` with **read-only Zone Analytics permissions**. The token is optional. GraphQL data is zone-level requests, not unique portfolio visitors.
- To whitelist local browser dashboards, change `vars.ALLOWED_ORIGINS` in Wrangler config and deploy through the configured GitHub workflow; other apps using curl or fetch server-side don't require CORS configuration.
- Static demos: add your HTML/CSS/JS under `public/demos/my-demo/index.html`, run the checks and push the intended changes to `main`; link to `/demos/my-demo/` from the project after deployment.

## Limits, prerequisites, and caveats

The repository describes the implementation, not the current deployment status. Check Cloudflare's build result and test the deployed site before public launch. The admin token is not required to inspect public pages. Public R2 media URLs are accessible by ID; draft status does not make their assets private.

The admin is optimized for a **single editor**. Simultaneous editing by multiple administrators could overwrite an earlier snapshot; add version checks if you later need multi-user editing. Pageview totals are not unique users, and there is no detailed session duration tracking. The Worker account free tier has usage quotas and 10ms CPU/request; test latency after publishing several projects. Raw uploads must provide a known Content-Length for streaming directly into R2. If a proxy or client sends chunked data without a known length, use a client that sets the file size or implement signed direct uploads. Project videos should be MP4/WebM compatible with browsers. Static demos are deployed with the Worker, not uploaded through the CMS.

## Official references

- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/analytics/graphql-api/

## Visitor Analytics dashboard

Open `/admin`, unlock using your admin token, then select **Visitor Analytics** in the sidebar. The tab automatically fetches `/api/admin/analytics?days=30`, supports 7/30/90-day windows and a refresh button, and renders:

- Pageviews for the selected period, UTC pageviews today, number of recorded countries and top page.
- Daily pageview trend (including zero-traffic days), country ranks, most-viewed paths and UTC hourly histogram.
- Interpretation notes at the bottom, explicitly stating the limits: **pageviews are not visitors**; bots and repeated requests may be included. No IP-based identity, sessions, or engagement durations are stored.

The existing `visit_hours` D1 table powers the dashboard; **no schema migration or Cloudflare GraphQL token is required**. New traffic records preserve full project `/projects/<slug>` and focus `/focus/<slug>` paths. Previous aggregated records such as `/projects/:slug` are preserved but cannot be broken down retroactively. Cloudflare zone-wide GraphQL metrics remain optional under `/api/admin/analytics/cloudflare` (they are broader HTTP counts and should not be mixed into these pageview KPIs).

Routine code updates use the GitHub-connected `main` deployment. Preserve the existing D1/R2 configuration and Worker secrets.

## Project covers, clearer editor and agent skill

These features are part of the repository; no legacy ZIP updater is needed.

- Project form: upload a cover image directly or choose a Media Library image; `coverMediaId` is stored with the project in D1. Public homepage cards and SSR use it. No more automatic project-name initials; missing images render an abstract fallback.
- Multiple specializations: choose any number of existing `tracks` and add new ones (comma separated). This already used a JSON array in D1; the editor now makes it obvious.
- `My role` is a concise contributions label, such as `Backend Development · AI Integration`; use Overview, Challenge and Approach for the actual details.
- The form explains **Summary, Overview, Challenge, Approach, Highlights**, and Featured. “Highlights” matches the public heading; content lives in `features` for backward compatibility.
- Project media viewer and thumbnails no longer display video filenames/types, and the old CMS upload caption was removed. Native video controls remain.
- `/favicon.png` is a blue/white logo generated in Python; an uploaded brand favicon overrides it. No AI-generated image.
- **Agent skill:** `skills/portfolio-cms/SKILL.md`. Companion CLI: `scripts/portfolio_agent.py` (Python standard library, defaults to your HTTPS domain, reads admin token securely). Use it when granting an authorized coding agent access to your CMS. The CLI implements a subset of the API, not every endpoint.

See `docs/API.md` for the current endpoint contracts, including export, rename, media references, range requests, portrait, multiple CVs and inbox archive actions. `src/index.js` and its imported handlers are the source of truth. Update the API documentation and agent skill whenever a route or its contract changes.
