# Private admin Web Push

No npm dependency or paid notification service. Requires HTTPS and a supported browser. On iOS/iPadOS 16.4+ install `/admin` via Add to Home Screen, then enable from within the installed app. Notifications contain a generic inbox alert only; no sender name, contact details, or message body. They are best effort, not guaranteed delivery. The contact response is independent of notification success. Five devices maximum. Expired endpoints (404/410) are removed. No retries; the inbox remains the source of truth.

## One-time setup

From the repository, after deployment, generate a persistent private VAPID JWK outside Git and store it as a Cloudflare Worker secret. Do not rotate it casually (existing subscriptions must be recreated). Never publish or paste the JWK into chat.

```sh
mkdir -p "$HOME/.config/maher-portfolio" && chmod 700 "$HOME/.config/maher-portfolio" && \
(umask 077; set -C; node scripts/generate-push-key.mjs > "$HOME/.config/maher-portfolio/push-vapid.json") && \
npx wrangler secret put PUSH_VAPID_JWK < "$HOME/.config/maher-portfolio/push-vapid.json"
```

If the file already exists, reuse it in `wrangler secret put`, don't regenerate it. The `push_devices` table is created on first configured use (no migration needed), and the SQL database backup includes it. Treat the backup as private. Keep the VAPID key separately, since Worker secrets are not exported in the database dump.

Open `/admin`, authenticate, choose Notifications, enter device label and Enable on this device. Accept the permission prompt; use Test and confirm the device receives the notification. Then submit a real contact message to verify the full workflow. Removing a device stops server delivery; removing the current browser also unsubscribes it locally. A dashboard logout intentionally does not disable push. Clicking opens `/admin?tab=inbox` and still requires admin authentication.

Authenticated API (same admin bearer auth as existing APIs): GET `/api/admin/push` returns configured/publicKey/device labels and IDs (not endpoints); POST `/api/admin/push/subscribe` body `{endpoint,publicKey,label}`; DELETE `/api/admin/push/devices/:id`; POST `/api/admin/push/devices/:id/test` returns push-service acceptance, not proof of device delivery. Endpoint destinations are restricted to known browser push service hosts and redirects forbidden. No payload encryption is required because there is no payload. VAPID authenticates sending; private signing key stays on the Worker.

## Registration troubleshooting

Permission alone does not create a subscription. The Notifications tab displays existing devices without registering a worker on page load. Enable on this device requests permission and reuses an active matching worker, or registers one on demand. If registration fails, check that site storage is allowed and use a normal browser (or installed Home Screen app on iOS); press Enable again. Check `curl -I https://maher2004.dev/push-sw.js` for HTTP 200 and JavaScript MIME. Existing VAPID keys should not be rotated to troubleshoot registration.

Device Test sends a real remote push. Status 0 means no provider HTTP response, not a provider rejection. The result includes a safe reason (`network_error`, `timeout`, `signing_failed`, `invalid_endpoint`, `key_mismatch`, or `provider_rejected` for non-expired HTTP errors). Worker logs include a sanitized transport failure type and provider hostname, never subscription URLs or signing keys. An accepted response still does not prove delivery. Expired subscriptions are removed automatically; register again on the affected browser.
