#!/usr/bin/env python3
# KIỂM KÊ FANPAGE → VAULT (anh 25/10/2026 "các page này là tài sản, show lên city"): Page Facebook htuan82 quản = tài sản, ghi vào platform_accounts
# (platform_key facebook · account_kind 'page' · handle "<tên> (Page)" · represents_account_id 19 = htuan82 · account_stats {page_id, followers, cum, nguon}).
# KHÔNG gán project_id → không tự thành toà kênh trên city (kênh chỉ là tài khoản có dự án); khu Tài nguyên city hiện "Kho Fanpage" từ các dòng này.
# Page đang chạy đọc /me/accounts bằng token htuan82 (/root/.secrets/fb-user-dai.token); Page đã tắt từ scripts/fb/page-da-tat.json (status 'closed' + account_stats.da_tat).
# Thêm / cập nhật theo page_id (rồi theo tên), KHÔNG xoá dòng nào. Chạy trên box3: python3 scripts/fb/kiem-ke-page.py
import json, os, subprocess, urllib.parse, urllib.request
GOC = os.path.dirname(os.path.abspath(__file__))
# cụm người xem (tiendo social S06) theo tên Page
CUM = {'du-lich': ['Abandoned Lives', 'Geological Wonders', 'Cities.gg', 'FlyBaboo', 'This Killed My Wallet', 'Hotel Scam Alerts', 'Before You Land'],
       'hoai-co': ['Retro Cars Club', 'Classical Motorcycle', 'Classic Car', 'Classic Car Collection', 'Classical Car', 'Cooking Inspiration', 'Creative Collection', 'Hobby Hub: Inspiring Ideas from Hobby Lobby', 'Front Porch Puzzles', 'Classic Car Club', 'Motor'],
       'quan-doi': ['Military Markdown', 'Bigger Life', 'MilitaryCalc'], 'game': ['World of Tanks So Easy', 'Megapolis Neighbors Village', 'Gardens of Time', 'Games for Girls Space', 'PlayDor'],
       'cong-cu': ['Trust Reviews', 'Daily Kaspersky Key', 'Discounting Domain', 'Earns.io', 'ValueImpression', 'Pocpoc.io', 'RingPi'], 'tai-chinh': ['CryptoNull'], 'tu-vi': ['Eyes On Stars'], 'viet': ['Lời hay ý đẹp'],
       'thu-cung': ['Animals Guru', 'Funny Cats', 'Cats of the World', 'Adorable Dogs', 'Meow meow', 'Lovely Cats', 'Animals Care', 'Dog Rescure', 'Funny Dogs', 'Paws for Life', 'Fish Lovers', 'Snake Cares', 'Kitty Paw Rock', 'Kitty Paw Rocks', 'Reptile Lover On The World', 'Beautiful Snakes', 'Fisher Guru'],
       # dự phòng chưa có sản phẩm (S06 bước 13, anh quyết) — xếp 25/10/2026 cho 21 Page còn 'chua-xep'
       'tin-tuc': ['Radar News', 'I Viral', 'BimBim Viral', 'Taiwan New', 'UFO'], 'the-thao': ['AdviceSport', 'ManUtd - Red Devils Fan'],
       'mua-sam': ['Brides Life Gear', "Sisters'shop", 'ShoesBuzz', 'KuteCraft.com', 'Hobbier Store', 'Hommie Ideas', 'Three Tea Trees'],
       'suc-khoe': ['SafeHealth', 'Safe Healthy Food', 'The Humand Mind'],
       'khong-quang-ba': ['Jude Law', 'Maggie Gyllenhaal Fansite', 'Free Julian Assange', 'BhawaniGarg']}
CUM_CUA = {t.lower(): c for c, ds in CUM.items() for t in ds}
def graph(u):
    return json.load(urllib.request.urlopen(u, timeout=30))
tok = open('/root/.secrets/fb-user-dai.token').read().strip()
u = 'https://graph.facebook.com/v21.0/me/accounts?' + urllib.parse.urlencode({'fields': 'id,name,followers_count,fan_count,category', 'limit': 100, 'access_token': tok})
song = []
while u:
    r = graph(u); song += r.get('data', []); u = r.get('paging', {}).get('next')
tat = json.load(open(os.path.join(GOC, 'page-da-tat.json')))['ds']
ds = [dict(id=p['id'], ten=p['name'], st='active', nguoi=p.get('followers_count') or p.get('fan_count') or 0, loai=p.get('category', ''), quan='htuan82') for p in song] \
   + [dict(id=x['id'], ten=x['ten'], st='closed', nguoi=None, loai='', quan=x['quan']) for x in tat]   # vault không có trạng thái 'deactivated' → closed + da_tat
env = dict(os.environ)
for l in open('/opt/earns-marketing-os-v2/.env.production'):
    if l.startswith('DATABASE_URL='): env['DATABASE_URL'] = l.split('=', 1)[1].strip().strip('"\'')
def psql(q):
    r = subprocess.run(['psql', env['DATABASE_URL'], '-tAc', q], capture_output=True, text=True)
    if r.returncode: raise SystemExit('psql lỗi: ' + r.stderr.strip()[:300])   # không in chuỗi kết nối (có mật khẩu)
    return r.stdout.strip()
lit = lambda s: "'" + str(s).replace("'", "''") + "'"
them = sua = 0
for p in ds:
    st = json.dumps({'page_id': p['id'], 'followers': p['nguoi'], 'cum': CUM_CUA.get(p['ten'].lower(), 'chua-xep'), 'nguon': p['quan'], 'chuyen_muc': p['loai'], 'da_tat': p['st'] == 'closed', 'kiem_ke': '2026-10-25'}, ensure_ascii=False)
    tim = f"account_stats->>'page_id' = {lit(p['id'])}" if p['id'] else "false"
    co = psql(f"SELECT id FROM platform_accounts WHERE platform_key='facebook' AND ({tim} OR lower(handle) = lower({lit(p['ten'] + ' (Page)')})) ORDER BY id LIMIT 1")
    if co:
        psql(f"UPDATE platform_accounts SET account_stats = account_stats || {lit(st)}::jsonb, account_kind = 'page', status = CASE WHEN project_id IS NULL THEN {lit(p['st'])} ELSE status END, updated_at = now() WHERE id = {co}"); sua += 1
    else:
        psql(f"INSERT INTO platform_accounts (platform_key, handle, status, account_kind, represents_account_id, category, notes, tags, account_stats) VALUES ('facebook', {lit(p['ten'] + ' (Page)')}, {lit(p['st'])}, 'page', 19, 'social', 'Fanpage — kiểm kê 25/10/2026 (tiendo social S06), quản bởi ' || {lit(p['quan'])}, '[\"fanpage\"]'::jsonb, {lit(st)}::jsonb)"); them += 1
print(f'Page đang chạy {len(song)} · đã tắt {len(tat)} → vault thêm {them}, cập nhật {sua}')
