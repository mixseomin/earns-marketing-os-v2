# Lượt một lần 19/11/2026 (kho militarycalc substack): chạy TRÊN box3 khi iMac không chạy được sinh-bai-dai.mjs.
# Mỗi góc: may-dung --viet-bai-dai → dựng dòng nạp y như puzzle-books nap-bai.mjs › dungDong (bài .html) → may-dung --nap → --xuat <slug>.
#   ssh root@167.233.241.16 'python3 - militarycalc 42938,42955' < nap-dai-box3.py
import json, re, subprocess, sys, html as H

may, gocs = sys.argv[1], [int(x) for x in sys.argv[2].split(',')]
ENV = 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a'
def sh(c, inp=None): return subprocess.run(['bash', '-c', c], input=inp, capture_output=True, text=True)
def studio(args, inp=None):
    r = sh(f'{ENV} && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts --may {may} {args}', inp)
    if r.returncode: raise SystemExit(f'studio {args}: {r.stderr[-600:]}')
    return r.stdout
spy = sh("U=$(grep ^DATABASE_URL= /root/.secrets/spy.env | cut -d= -f2-); psql \"$U\" -tA -c \"select json_agg(json_build_object('sp', sp_id, 'id', id, 'loai', loai, 'ten', ten)) from goc where id = any(array[%s])\"" % ','.join(map(str, gocs))).stdout
G = {g['id']: g for g in json.loads(spy)}
site = sh(f"{ENV} && psql \"$DATABASE_URL\" -tA -c \"select site_dich from xv_may where ma = '{may}'\"").stdout.strip()
chu_html = lambda h: re.sub(r'\n{3,}', '\n\n', H.unescape(re.sub(r'<[^>]+>', '', re.sub(r'</(p|h[1-6]|li)>', '\n\n', h)))).strip()
tieu_cu, tien = [], 0.0
for gid in gocs:
    g = G[gid]
    vb = json.loads(studio('--viet-bai-dai', json.dumps({'goc': g, 'slug': f'dai-{gid}', 'tieu_de_cu': tieu_cu})).strip().split('\n')[-1])
    tien += float(vb.get('vnd') or 0)
    if not vb.get('ok'): print(f'✗ góc #{gid}: {vb.get("loi")}'); continue
    h = vb['html']; title = vb['tieu_de']; chu = chu_html(h)
    slug = f"dai-{gid}-" + '-'.join(re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-').split('-')[:5])
    link = re.search(r'https?://(www\.)?' + re.escape(site) + r'[^\s)"<]*', chu, re.I).group(0)
    phu = chu_html(re.search(r'<em[^>]*>([\s\S]*?)</em>', h).group(1))
    dong = {'slug': slug, 'chu_de': f'Bài viết: {title}'[:200], 'de': {'loai': 'bai-viet', 'truy': vb['truy']}, 'nen_url': vb['anh'],
            'dang': {'loai': 'bai', 'title': title, 'description': chu, 'html': h, 'phu_de': phu, 'link': link, 'dang_bai': 'bai-viet', 'goc': g, 'nhom': 'Góc spy'}}
    print('nạp', slug, studio('--nap', json.dumps([dong])).strip()[-200:])
    print(studio(f'--xuat {slug}').strip()[-200:])
    tieu_cu.append(title)
print(f'tiền AI {round(tien)}₫')
