#!/usr/bin/env python3
# ĐỔI TOKEN FACEBOOK (box3, 25/10/2026 — thêm quyền read_insights cho số đo Reel): token người dùng ngắn hạn (Graph API Explorer, app Kenh Social Poster,
# htuan82) qua stdin → token dài hạn (app secret /root/.secrets/fb-app-kenh.secret) → kiểm đủ quyền → token Page mới (/me/accounts, token Page từ token
# dài hạn không hết hạn) ghi đè đúng các Page đã có trong /root/.secrets/fb-pages.json (+ Page mới), sao lưu tệp cũ trước. KHÔNG in token.
#   python3 scripts/fb/doi-token.py < token.txt        (thêm --xem: chỉ kiểm quyền + đếm Page, không ghi)
import json, sys, shutil, time, urllib.request, urllib.parse

APP = '1850293666145431'
CAN = {'pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'read_insights'}
SO, USER = '/root/.secrets/fb-pages.json', '/root/.secrets/fb-user-dai.token'
G = 'https://graph.facebook.com/v21.0'
def get(path, **q):
    try: return json.load(urllib.request.urlopen(f'{G}/{path}?{urllib.parse.urlencode(q)}', timeout=60))
    except urllib.error.HTTPError as e: raise SystemExit(f'Graph {e.code}: {json.load(e).get("error", {}).get("message", "")[:200]}')

ngan = sys.stdin.read().strip()
if not ngan.startswith('EAA'): raise SystemExit('stdin không phải token Facebook')
sec = open('/root/.secrets/fb-app-kenh.secret').read().strip()
dai = get('oauth/access_token', grant_type='fb_exchange_token', client_id=APP, client_secret=sec, fb_exchange_token=ngan)['access_token']
d = get('debug_token', input_token=dai, access_token=f'{APP}|{sec}')['data']
thieu = CAN - set(d.get('scopes', []))
if d.get('app_id') != APP or not d.get('is_valid') or thieu: raise SystemExit(f'token không đạt: app {d.get("app_id")} · hợp lệ {d.get("is_valid")} · thiếu {sorted(thieu)}')
ds, u = [], f'me/accounts'
q = dict(fields='id,name,access_token', limit=100, access_token=dai)
while True:
    r = get(u, **q); ds += r.get('data', [])
    nxt = r.get('paging', {}).get('next')
    if not nxt: break
    u, q = nxt.split('/v21.0/', 1)[1].split('?')[0], dict(urllib.parse.parse_qsl(nxt.split('?', 1)[1]))
cu = json.load(open(SO))
moi = {p['id']: {'ten': p['name'], 'token': p['access_token']} for p in ds}
mat = [k for k in cu if k not in moi]
print(f'token dài hạn: hợp lệ · quyền {sorted(d.get("scopes", []))} · Page qua token {len(moi)} (sổ cũ {len(cu)}, sổ cũ không còn thấy {len(mat)})')
if '--xem' in sys.argv: sys.exit(0)
bay = time.strftime('%Y%m%d%H%M')
shutil.copy2(SO, f'{SO}.bak-{bay}'); shutil.copy2(USER, f'{USER}.bak-{bay}')
gop = {**cu, **moi}   # Page sổ cũ mà token mới không thấy: giữ token cũ (không xoá)
open(SO, 'w').write(json.dumps(gop, ensure_ascii=False, indent=1)); open(USER, 'w').write(dai)
print(f'đã ghi {SO} ({len(gop)} Page) + {USER}; sao lưu .bak-{bay}')
