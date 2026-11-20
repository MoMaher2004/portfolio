#!/usr/bin/env python3
"""Small safe stdlib-only CLI for the Cloudflare portfolio CMS. No account API credentials needed."""
import argparse
import getpass
import json
import mimetypes
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

DEFAULT_URL = 'https://maher2004.dev'
MAX_BYTES = 90 * 1024 * 1024


def auth_token():
    token = os.environ.get('PORTFOLIO_ADMIN_TOKEN', '').strip()
    if token:
        return token
    file = Path('.secrets/admin-token.txt')
    if file.is_file():
        return file.read_text(encoding='utf-8').strip()
    return getpass.getpass('Portfolio ADMIN_TOKEN: ').strip()


def client(method, path, token, body=None, mime=None, origin=DEFAULT_URL):
    url = origin.rstrip('/') + path
    headers = {'Accept': 'application/json', 'Authorization': f'Bearer {token}'}
    data = None
    if body is not None:
        if isinstance(body, bytes):
            data = body
            headers['Content-Type'] = mime or 'application/octet-stream'
            headers['Content-Length'] = str(len(data))
        else:
            data = json.dumps(body, ensure_ascii=False).encode('utf-8')
            headers['Content-Type'] = 'application/json'
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=45) as response:
            value = response.read()
            return json.loads(value) if value else {}
    except HTTPError as exc:
        try:
            explanation = exc.read().decode('utf-8')[:450]
        except Exception:
            explanation = 'No response body'
        raise RuntimeError(f'{method} {path}: HTTP {exc.code} {explanation}') from None
    except URLError as exc:
        raise RuntimeError(f'Network failure contacting {url}: {exc.reason}') from None


def project_path(slug):
    if not re.fullmatch(r'[a-z0-9-]{1,90}', slug):
        raise ValueError('Project ID must use lowercase a-z, 0-9 and hyphen, max 90 chars')
    return '/api/admin/collections/projects/' + slug


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default=os.environ.get('PORTFOLIO_URL', DEFAULT_URL), help='https://portfolio.example')
    cmds = parser.add_subparsers(dest='command', required=True)
    cmds.add_parser('verify')
    cmds.add_parser('list-projects')
    get_cmd = cmds.add_parser('get-project'); get_cmd.add_argument('id')
    update_cmd = cmds.add_parser('upsert-project'); update_cmd.add_argument('--file', required=True, type=Path)
    upload_cmd = cmds.add_parser('upload'); upload_cmd.add_argument('--file', required=True, type=Path)
    upload_cmd.add_argument('--project', help='Existing project ID to link media to')
    choice = upload_cmd.add_mutually_exclusive_group(); choice.add_argument('--cover', action='store_true'); choice.add_argument('--gallery', action='store_true')
    args = parser.parse_args()
    if args.base_url.startswith('http://') and not args.base_url.startswith('http://localhost:'):
        parser.error('Use HTTPS for a real portfolio domain')
    token = auth_token()
    if not token:
        parser.error('Admin token is required')
    api = lambda method, path, body=None, mime=None: client(method, path, token, body, mime, args.base_url)
    if args.command == 'verify': result = api('POST','/api/admin/verify')
    elif args.command == 'list-projects': result = api('GET','/api/admin/collections/projects')
    elif args.command == 'get-project': result = api('GET',project_path(args.id))
    elif args.command == 'upsert-project':
        patch = json.loads(args.file.read_text(encoding='utf-8'))
        if not isinstance(patch, dict) or not patch.get('id'):
            raise ValueError('Project JSON must be an object with a nonempty id')
        path=project_path(patch['id']); old=api('GET',path)
        if old is None:
            needed={'id','title','tracks','summary'}
            missing=[key for key in needed if key not in patch]
            if missing: raise ValueError(f'New project missing: {", ".join(missing)}')
            if not isinstance(patch['tracks'], list): raise ValueError('tracks must be an array')
            result_obj={'published':False,'featured':False,'mediaIds':[], 'coverMediaId':'', **patch}
        else:
            result_obj={**old,**patch}
            if not isinstance(result_obj.get('tracks'),list): raise ValueError('tracks must be an array')
        result=api('PUT',path,result_obj)
    elif args.command == 'upload':
        f=args.file
        if not f.is_file(): raise FileNotFoundError(f)
        if f.stat().st_size > MAX_BYTES: raise ValueError('File exceeds 90 MiB')
        if f.stat().st_size == 0: raise ValueError('Empty file')
        mime=mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
        accepted={'image/png','image/jpeg','image/webp','image/gif','image/avif','video/mp4','video/webm','application/pdf','application/json','text/plain'}
        if mime not in accepted: raise ValueError(f'Unsupported media type: {mime}')
        if args.cover and not mime.startswith('image/'):
            raise ValueError('Cover must be an image')
        if (args.cover or args.gallery) and not args.project:
            raise ValueError('Pass --project when using --cover or --gallery')
        old=api('GET', project_path(args.project)) if args.project else None
        if args.project and old is None: raise ValueError('Create project before attaching media')
        result=api('POST','/api/admin/files?name='+quote(f.name, safe=''),f.read_bytes(),mime)
        api('PUT','/api/admin/collections/media/'+result['id'],result)
        if args.project:
            if args.cover: old['coverMediaId']=result['id']
            if args.gallery: old['mediaIds']=[*dict.fromkeys([*(old.get('mediaIds') or []),result['id']])]
            api('PUT',project_path(args.project),old)
            result['attachedToProject']=args.project
        # Do not print any token or request headers.
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    try: main()
    except (ValueError, RuntimeError, OSError, json.JSONDecodeError) as exc:
        print('ERROR:',exc,file=sys.stderr)
        sys.exit(1)
