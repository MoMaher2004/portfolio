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
| GET | `/api/admin/state` | All CMS state including settings / translations (sensitive, admin only) |
| PUT | `/api/admin/state` | Replace entire CMS state — avoid unless absolutely necessary |
| GET | `/api/admin/analytics?days=30` | D1 pageviews |
| GET | `/api/site-data` | Public published data |

Full API specification: `docs/API.md`.

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
- For Arabic, add `titleAr`, `summaryAr`, `overviewAr`, `problemAr`, `solutionAr`, `roleAr`, `featuresAr`; similarly `Es` suffix for Spanish. Never fabricate translations; untranslated fields fall back to English.
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
- `411`: upload request is missing the file Content-Length. Python helper sends known size automatically.
- `413`: file exceeds 90 MiB.
- `415`: unsupported content type; convert to PNG/JPEG/WebP/AVIF/GIF, MP4/WebM, PDF or JSON as appropriate.
- `429`: authorization or contact rate limit; stop requests rather than repeatedly retrying.
- `500`: inspect Worker logs with the owner's permission; do not retry writes blindly.
