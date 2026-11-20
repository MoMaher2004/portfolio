# Visitor Analytics update (D1 dashboard)

This update adds a dedicated **Visitor Analytics** tab to the existing CMS, with charts for 7, 30 or 90 days, total pageviews, today's UTC pageviews, countries, top paths and hourly activity. Explanatory notes appear beneath the charts.

## Upgrade an existing Cloudflare deployment

1. From your existing site directory (for example `~/Desktop/maher-portfolio-cloudflare`), back up any locally changed source files if needed.
2. Copy only the supplied code files to the matching paths. The ZIP intentionally does **not** include `wrangler.jsonc`, secrets, migrations or seed data, so your account, custom domain, D1 and R2 bindings remain unchanged.
3. Run:

```bash
npm test
npx wrangler deploy
```

4. Visit `https://maher2004.dev/admin`, unlock, choose **Visitor Analytics**.

## API

`GET /api/admin/analytics?days=30` (Bearer admin token required). `days` accepts `7`, `30` or `90` and defaults to 30. Returns `total`, `byDay`, `byCountry`, `byHour`, `topPaths`, `periodDays` and `startDate`. Existing data from previous D1 events is not deleted.

The cloudflare-GraphQL integration is still optional and separate: `GET /api/admin/analytics/cloudflare`.

## Limitations

Metrics are **pageviews**, not distinct people. Repeated views, crawlers and monitoring may be included. No unique visitor tracking or session duration is added. Legacy path buckets such as `/projects/:slug` remain grouped; new events store each project's actual path. Date/time is UTC.
