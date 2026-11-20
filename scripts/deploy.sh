#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
command -v node >/dev/null || fail 'Install Node.js 20+ first.'
command -v npm >/dev/null || fail 'Install npm first.'
command -v python3 >/dev/null || fail 'Install Python 3 first.'
command -v curl >/dev/null || fail 'Install curl first.'

if [[ ! -d node_modules/wrangler ]]; then
  say 'Installing Wrangler (internet connection needed)...'
  npm install --no-audit --no-fund || fail 'npm install failed; fix npm/registry access and retry.'
fi
say 'Checking Cloudflare login (browser sign-in may open)...'
if ! npx wrangler whoami >/dev/null 2>&1; then
  npx wrangler login || fail 'Cloudflare login failed.'
fi

DB_NAME='maher-portfolio-db'
BUCKET_NAME='maher-portfolio-media'

say 'Checking D1 database...'
LIST="$(npx wrangler d1 list --json)" || fail 'Could not list D1 databases.'
DB_ID="$(printf '%s' "$LIST" | python3 -c 'import sys,json;x=json.load(sys.stdin);a=x.get("result",x) if isinstance(x,dict) else x;print(next((d.get("uuid",d.get("id","")) for d in a if d.get("name")=="maher-portfolio-db"),""))')" || fail 'Could not parse D1 response.'
if [[ -z "$DB_ID" ]]; then
  say 'Creating D1 database...'
  npx wrangler d1 create "$DB_NAME" || fail 'Could not create D1.'
  LIST="$(npx wrangler d1 list --json)"
  DB_ID="$(printf '%s' "$LIST" | python3 -c 'import sys,json;x=json.load(sys.stdin);a=x.get("result",x) if isinstance(x,dict) else x;print(next((d.get("uuid",d.get("id","")) for d in a if d.get("name")=="maher-portfolio-db"),""))')"
fi
[[ -n "$DB_ID" ]] || fail 'D1 database UUID not found.'

say 'Checking R2 bucket (may require R2 billing activation)...'
if ! npx wrangler r2 bucket list | grep -Fq "$BUCKET_NAME"; then
  npx wrangler r2 bucket create "$BUCKET_NAME" || fail 'R2 creation failed. Enable R2 on your Cloudflare account (billing setup may be required) and retry.'
fi

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  read -r -p 'Your Cloudflare-managed domain/subdomain (blank for workers.dev only): ' DOMAIN
fi
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%/}"
if [[ -n "$DOMAIN" && ! "$DOMAIN" =~ ^([a-z0-9-]+\.)+[a-z]{2,}$ ]]; then
  fail 'Enter a hostname like portfolio.example.com, or leave it empty.'
fi

export DB_ID DOMAIN
python3 - <<'PY'
import json,os
from pathlib import Path
p=Path('wrangler.jsonc')
data=json.loads(p.read_text())
data['d1_databases'][0]['database_id']=os.environ['DB_ID']
domain=os.environ['DOMAIN']
data['vars']['SITE_ORIGIN']='https://'+domain if domain else ''
if domain:
 data['routes']=[{'pattern':domain,'custom_domain':True}]
else:data.pop('routes',None)
p.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
PY

say 'Applying remote D1 migrations (safe to rerun)...'
npx wrangler d1 migrations apply "$DB_NAME" --remote || fail 'D1 migration failed.'

TOKEN_FILE="$ROOT/.secrets/admin-token.txt"
mkdir -p "$ROOT/.secrets"
if [[ ! -f "$TOKEN_FILE" ]]; then
  python3 - <<'PY'
from pathlib import Path
import secrets,os
p=Path('.secrets/admin-token.txt')
with p.open('x') as f:
 os.chmod(p,0o600)
 f.write(secrets.token_urlsafe(32)+'\n') # cryptographically random 32 bytes
PY
fi
TOKEN="$(tr -d '\r\n' < "$TOKEN_FILE")"
[[ -n "$TOKEN" ]] || fail 'Admin token file is empty.'

say 'Deploying Worker + static assets...'
npx wrangler deploy || fail 'Worker deployment failed. Verify zone and DNS status.'
say 'Setting ADMIN_TOKEN secret (never committed to Git)...'
printf '%s' "$TOKEN" | npx wrangler secret put ADMIN_TOKEN || fail 'Could not upload ADMIN_TOKEN secret.'

say 'Success. Save this admin token privately (shown once on each local deploy):'
printf '\n%s\n\n' "$TOKEN"
if [[ -n "$DOMAIN" ]]; then
  printf 'Website:   https://%s/\nDashboard: https://%s/admin\n' "$DOMAIN" "$DOMAIN"
else
  printf 'Worker deployed to workers.dev. Find the URL in Wrangler output.\n'
fi
printf '\nKeep .secrets/admin-token.txt private. Do not send Cloudflare tokens or this admin token in chat.\n'
