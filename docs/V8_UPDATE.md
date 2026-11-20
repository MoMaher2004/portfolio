# Portfolio V8 — Live CMS update

## New features

1. **Enter-to-add tags:** Project tracks, stack, Highlights in English/Arabic/Spanish, additional project links, and hard-skill lists. Click a chip to remove it; paste comma- or newline-separated values. Comma/newline semantics of the saved fields remain unchanged.
2. **Fallback theme fixed:** Blue, Gold, Rose and Violet are now applied to project card and project-page background **only when no cover or gallery image is available**.
3. **Plain-language first:** `summary` is a 1–2-sentence non-technical teaser; `overview` tells the user-focused story; `problem` and `solution` describe the need/outcome; `technicalDetails` (and Ar/Es translations) appears later under a technical deep dive; `stack` and Highlights are technical details. Existing field content remains untouched and backwards compatible.
4. **Media Library preview:** Click a media thumbnail or Preview to open images, videos or PDFs in a same-page overlay. PDF preview is allowed in an iframe on the **same origin only**; HTML pages and admin remain protected from iframe embedding. Escape or click outside to close.
5. **Multiple CV PDFs:** Dashboard → Settings → Downloadable CVs. Upload a PDF to R2, supply a button title (e.g. `Backend Developer CV`). On the homepage the buttons show each title (or a drop-down if more than one). The public download endpoint is `GET /cv/:id`. The original `GET /cv` still works if you already uploaded a single CV. Removing a CV removes the button but not the uploaded file, which can be deleted separately in Media Library.

## Deployment

Use `bash portfolio-v8-update/install.sh` from the existing project root **after extracting this zip into that root**. The installer backs up affected source files and `wrangler.jsonc` to `.backups/`, updates `run_worker_first` with `/cv/*`, runs `npm run check` and `npm test`, then deploys via `npx wrangler deploy`.

**Important:** The package does NOT contain a replacement `wrangler.jsonc`, `.secrets`, or SQL migrations. It does not create/delete D1/R2 resources or reset the database. You do **not** need to recreate projects, CVs, existing media, or your admin token. The V8 data fields are stored as JSON in your existing D1 configuration/content tables.

For a local dry run without deployment, use `bash portfolio-v8-update/install.sh --no-deploy`. You still need Node/npm installed for tests.

## API additions

- `POST /api/admin/files?name=my-cv.pdf` with `Authorization: Bearer <token>`, `Content-Type: application/pdf`, PDF binary body. Register upload in the `media` collection (the CMS does this automatically).
- `PUT /api/admin/state` saves `settings.cvs` list. Each item: `{ "id": "backend-cv", "title": "Backend CV", "mediaId": "uploaded-media-uuid", "src": "/media/uploaded-media-uuid" }`. Preserve all other state fields; use a recent state snapshot.
- `GET /cv/backend-cv` downloads the named PDF. Missing CV/non-PDF media returns 404.
- `GET /media/:uuid` serves files. PDFs get same-origin iframe preview headers (`X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`) only for inline PDF; public site and admin stay `DENY`.

## Suggested content style

**Summary:** “A web platform that helps patients collect their information before visiting a doctor.”

**Project Story:** “Patients answer a guided set of questions and submit test results. The system organizes information into a preliminary report that the doctor can review.”

**Technical Implementation:** “The backend exposes REST APIs to Python microservices; model inputs and results are validated and integrated into the patient workflow.”

These are illustrative sentences, not verified claims about a specific project.
