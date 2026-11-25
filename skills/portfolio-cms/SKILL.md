---
name: portfolio-cms
summary: Manage Mohamed Maher's Cloudflare portfolio CMS projects, covers, galleries and content using its documented authenticated HTTP API.
---

# Portfolio CMS agent skill

Use this skill whenever the user asks an agent to add, edit, publish, unpublish, inspect or remove a project, attach images/videos, or manage CMS collections on `maher2004.dev`.

## Safety and source of truth

- **Read first, edit second.** Query the live API to obtain current project IDs and data. Never invent project achievements, metrics, roles, source code URLs or testimonials.
- Do not publish a draft, delete an item, or overwrite an existing cover without the user's explicit instruction. Never upload sensitive documents without permission.
- The CMS is live: all writes can change public pages and sitemap. For an uncertain draft, set `published: false` and `featured: false`.
- Never ask for the Cloudflare account token: the agent needs only the **portfolio ADMIN_TOKEN** scoped to the CMS. Do not print it, commit it, include it in logs, or send it to any AI API.
- All `/api/admin/*` endpoints use `Authorization: Bearer <ADMIN_TOKEN>`. Public data is readable without this header; writes are not.
- On the user's computer, the deployment script puts the token in `.secrets/admin-token.txt` (`0600`). The optional helper below reads this file or `PORTFOLIO_ADMIN_TOKEN`; outside the owner's machine use a secure environment variable or credential store. Obtain explicit permission before reading a token file.
- The API is designed for one editor. Before updating, fetch the latest version; preserve every unknown property, other media ID, and existing translation. Do not replace an entire CMS state blindly.

## Working API and helper

Base URL: `https://maher2004.dev` (override with `PORTFOLIO_URL` for testing).

From the portfolio project directory:

```bash
python3 scripts/portfolio_agent.py verify
python3 scripts/portfolio_agent.py list-projects
python3 scripts/portfolio_agent.py get-project smart-hospital
python3 scripts/portfolio_agent.py upsert-project --file /path/to/project.json
python3 scripts/portfolio_agent.py upload --file /path/to/cover.webp --project smart-hospital --cover
python3 scripts/portfolio_agent.py upload --file /path/to/screen.webp --project smart-hospital --gallery
```

`upsert-project` performs a **shallow merge** when the project exists, so unspecified properties (e.g., mediaIds, category translations, links, features) survive. For a new project it requires `id`, `title`, `tracks`, and a clear summary, and should default to **draft**. The script validates IDs, requests authentication, and prints JSON results without tokens. It registers uploaded media in the CMS media collection, then optionally links it to the project as the cover or gallery entry. Each upload is limited to 90 MiB.

### Key requests (for agents not using Python)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/verify` | Check token |
| GET | `/api/admin/collections/projects` | List all projects including drafts |
| GET | `/api/admin/collections/projects/:id` | Read one project |
| PUT | `/api/admin/collections/projects/:id` | Upsert one project; JSON body must use the same `id` |
| DELETE | `/api/admin/collections/projects/:id` | Delete one project (requires explicit permission) |
| POST | `/api/admin/files?name=cover.webp` | Raw binary upload to R2; set `Content-Type` and known `Content-Length` |
| PUT | `/api/admin/collections/media/:id` | Register uploaded media item with `{id,name,type,src,bytes}` |
| PATCH | `/api/admin/files/:id` | Rename with `{ "name": "new-name.webp" }`; keep extension, ID and URL |
| GET | `/api/admin/files/:id/references` | Check references (including drafts) before deletion |
| DELETE | `/api/admin/files/:id` | Delete unreferenced media only, with explicit permission; 409 if in use |
| GET/HEAD | `/media/:id` | Public media or metadata; GET accepts a single byte range |
| PUT | `/api/admin/portrait?name=portrait.webp` | Upload supported image, register it and set homepage portrait |
| PUT | `/api/admin/cv` | Upload PDF and set legacy CV link |
| GET | `/cv` or `/cv/:id` | Download legacy or named CV; named ID is a CV entry ID |
| GET | `/api/admin/state` | CMS state including settings / translations and up to 250 messages (sensitive) |
| PUT | `/api/admin/state` | Replace content/config snapshot; avoid unless necessary; message read flags only |
| GET | `/api/admin/messages` | Read up to 250 newest inbox messages, including archived items (private) |
| PATCH | `/api/admin/messages/:id` | Set `read` and/or `archived` booleans |
| DELETE | `/api/admin/messages/:id` | Delete message and details; requires explicit permission |
| GET | `/api/admin/analytics?days=30` | D1 pageviews; 7, 30 or 90 days |
| GET | `/api/admin/analytics/cloudflare` | Optional zone-level request metrics |
| GET | `/api/admin/export?parts=database,media` | Full SQL backup, optionally with original R2 files in streamed TAR (omit `,media` for SQL only) |
| GET | `/api/admin/push` | List device summaries and VAPID public configuration (private) |
| POST | `/api/admin/push/subscribe` | Register a real browser subscription, optionally with preview encryption keys |
| POST | `/api/admin/push/devices/:id/test` | Send a real test notification only with permission |
| DELETE | `/api/admin/push/devices/:id` | Remove registered device only with permission |
| GET | `/api/site-data` | Public published data |
| GET | `/api/contact/options` | Country and dialing code options |
| POST | `/api/contact` | Public contact form; do not send test messages without permission |

Architecture and code-maintenance reference: `README.md`. Full API specification: `docs/API.md` (routes, payloads, limits and response types). The Python CLI is a project/upload helper and **does not** expose commands for every API route. Use the documented HTTP contract directly for other operations; do not invent CLI commands. Collection APIs also support GET/PUT on list collections and GET/PUT/POST/DELETE on an individual item; read the schema first and preserve unknown fields. Do not run seed, bulk replacement or destructive actions without explicit permission.

### Media and backup rules

- A draft preview is available inside the authenticated admin UI only; no public draft URL or preview API exists. Draft media bytes can still be retrieved by public media ID. Do not treat unlisted URLs as private storage.
- Generic upload is a two-step operation (binary upload, then register the returned media object). Rename through PATCH; do not use collection DELETE to remove R2 files. Read the references endpoint and stop if used; never detach projects without approval. Conversion is browser-local, not a server API; editing a copy creates a new ID. Preserve old files and references unless the user explicitly requests otherwise.
- Export is read-only, but the full database contains private inbox/contact and IP-related records. Obtain authorization before exporting. Use `parts=database` for SQL or `parts=database,media` for a TAR containing `backup.sql` and original R2 files. Old JSON part selections are no longer supported. Use a streaming binary download, not the helper’s JSON-only client; verify `X-Export-Bytes`, store securely, and never commit the backup. Restore only to a fresh database with explicit permission, verify foreign keys, and restore media separately to the same object keys. See `docs/API.md` for limits and exclusions.

## Project schema — important distinctions

```json
{
  "id": "smart-hospital",
  "title": "Smart Hospital System",
  "titleAr": "نظام المستشفى الذكي",
  "summary": "One or two sentences explaining the purpose and value.",
  "overview": "Short paragraph: what it does, audience, and scope.",
  "problem": "Challenge or real-world need.",
  "solution": "How the implementation addresses the challenge.",
  "technicalDetails": "Verified implementation details.",
  "role": "Backend Development · AI Integration",
  "category": "Web / AI Platform",
  "tracks": ["Backend", "AI Integration", "Full-stack"],
  "stack": ["Node.js", "Flask"],
  "features": ["A concrete implemented feature", "Another verified feature"],
  "coverMediaId": "",
  "mediaIds": [],
  "links": [],
  "year": "2026",
  "status": "Completed",
  "published": false,
  "featured": false
}
```

- **Summary:** short project-card teaser and SEO description.
- **Overview:** one short paragraph describing the product and your involvement.
- **Challenge / Approach:** why the project was needed and how you solved it.
- **My role (`role`):** concise contributions such as `Backend Development · AI Integration`; use details in Overview/Approach rather than a long role paragraph.
- **Tracks (`tracks`):** array of **multiple areas**, not one string. Used for category filters and focused portfolio share links. E.g. `Backend`, `Automation`, `AI`, `Embedded`, `IoT`.
- **Highlights (`features`):** short list of actual features. The interface uses “Highlights” for this field.
- **Featured:** boosts priority in the homepage's selected work. It does not independently publish the project; `published` controls public visibility.
- **Cover (`coverMediaId`):** one uploaded **image's media ID** to show on homepage card; optional `mediaIds` are the project gallery. If no explicit cover, the first available gallery image is used; otherwise a neutral graphic, never project initials.
- For Arabic, add `titleAr`, `categoryAr`, `summaryAr`, `overviewAr`, `problemAr`, `solutionAr`, `roleAr`, `technicalDetailsAr`, `featuresAr`; similarly `Es` suffix for Spanish. Never fabricate translations; untranslated fields fall back to English.
- `links`: list of `{ "id": "...", "label": "GitHub", "url": "https://..." }`. Existing legacy `github` and `demo` fields are also supported.

## Example workflow — create a new project safely

1. Fetch `GET /api/admin/collections/projects`, compare existing slugs.
2. Ask for missing facts rather than making up technologies or outcomes; prepare project JSON based on provided facts.
3. `upsert-project` as a **draft**.
4. Upload chosen cover and gallery assets using `upload --cover`/`--gallery`.
5. Fetch the project again; ensure image URLs and tracks appear correctly.
6. Ask the user before publishing; when approved update only `published` and optionally `featured`.
7. Confirm that the published project's page and `/sitemap.xml` resolve. Do not assume Google indexed it.

## Errors & diagnostics

- `401`: missing/invalid admin token; don't expose it in debug output.
- `409`: media still referenced; inspect references and do not bypass the guard.
- `411`: upload request is missing the file Content-Length. Python helper sends known size automatically.
- `413`: file exceeds 90 MiB.
- `415`: unsupported content type; convert to PNG/JPEG/WebP/AVIF/GIF, MP4/WebM, PDF, JSON or plain text as appropriate.
- `416`: invalid or unsatisfiable media byte range; check size using HEAD.
- `429`: authorization or contact rate limit; stop requests rather than repeatedly retrying.
- `500`: inspect Worker logs with the owner's permission; do not retry writes blindly.


## Notification and code-maintenance boundaries

- Read `docs/WEB_PUSH.md` and the actual handler contracts before touching notifications. Do not invent device endpoints or encryption keys: enrollment is a real browser permission and PushSubscription flow.
- The device list intentionally omits raw endpoint and encryption secrets. Never export these for debugging. Do not rotate the VAPID key, send tests or remove subscriptions without explicit authorization.
- Notification tests are external side effects; provider acceptance is not proof of device display. Contact writes can trigger notifications, so use a local isolated environment for automated testing.
- Legacy subscriptions receive generic alerts; preview-capable devices use encrypted message previews. Preserve existing registrations and never introduce plaintext payload fallback.
- Collection API writes internally read and replace the CMS snapshot. They remain subject to snapshot size/statement limits and concurrent-editor risks. Read current data and preserve all unknown fields.
- For repository changes (as opposed to live content edits), follow the maintainer and AI-agent guide in README.md, inspect source/tests at the current ref, run checks, and do not push/deploy without authorization.
