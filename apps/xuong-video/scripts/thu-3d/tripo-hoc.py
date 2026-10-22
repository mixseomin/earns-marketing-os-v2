# HỌC TỪ TRIPO (anh 22/10/2026: "học lại từ họ để sau không phụ thuộc… ngắt API là mình ngu ngay") — rig + áp động tác có sẵn của Tripo lên
# mô hình của mình, TẢI về mọi tệp .glb (xương + trọng số + đường cong) để mổ / chép vào thư viện của mình. Chạy trên BOX (khoá
# /root/.secrets/tripo.key; API v3 QUỐC TẾ openapi.tripo3d.ai — bản .com là Trung Quốc, báo key sai). TỐN CREDIT: rig 25, mỗi động tác 10
# ($0,01/credit); kiểm rig miễn phí; việc hỏng không trừ. Chỉ chạy khi anh đã duyệt.
# Preset rig v2.5: hai chân preset:idle walk run dive climb jump slash shoot hurt fall turn · bốn chân preset:quadruped:walk ·
# preset:hexapod:walk · preset:octopod:walk · preset:serpentine:march · preset:aquatic:march
#   python3 tripo-hoc.py <ten> <link .glb công khai> <quadruped|biped|…> <preset> [preset…]   → /root/px/tripo/<ten>/
import json, sys, time, os, urllib.request
ten, url, loai, presets = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
K = open('/root/.secrets/tripo.key').read().strip(); B = 'https://openapi.tripo3d.ai/v3'; RA = f'/root/px/tripo/{ten}'; os.makedirs(RA, exist_ok=True)
def goi(duong, body=None):
    rq = urllib.request.Request(B + duong, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET',
                                headers={'Authorization': f'Bearer {K}', 'Content-Type': 'application/json'})
    try: return json.load(urllib.request.urlopen(rq, timeout=60))
    except urllib.error.HTTPError as e: return json.loads(e.read() or b'{}')
def chay(duong, body, nhan):
    r = goi(duong, body); tid = (r.get('data') or {}).get('task_id')
    if not tid: print(nhan, 'LOI', json.dumps(r)[:300]); sys.exit(1)
    for _ in range(150):
        d = goi(f'/tasks/{tid}').get('data') or {}
        if d.get('status') in ('success', 'failed', 'cancelled', 'banned', 'expired', 'unknown'): break
        time.sleep(4)
    json.dump(d, open(f'{RA}/{nhan}.json', 'w'), ensure_ascii=False, indent=1)
    print(nhan, d.get('status'), 'credit', d.get('credits_consumed'), list((d.get('output') or {}).keys()))
    for k, v in (d.get('output') or {}).items():
        if isinstance(v, str) and v.startswith('http'):
            ext = v.split('?')[0].rsplit('.', 1)[-1][:5]; f = f'{RA}/{nhan}.{k}.{ext}'
            urllib.request.urlretrieve(v, f); print('  tải', f, os.path.getsize(f))
    if d.get('status') != 'success': sys.exit(1)
    return tid
ck = chay('/animations/rig-check', {'input': url}, 'kiem')
rig = chay('/animations/rig', {'input': url, 'rig_type': loai, 'model_version': 'v2.5-20260210', 'out_format': 'glb'}, 'rig')
for p in presets:
    chay('/animations/retarget', {'input': rig, 'animation': p, 'out_format': 'glb', 'animate_in_place': True}, p.replace(':', '_'))
rq = urllib.request.Request('https://api.tripo3d.ai/v2/openapi/user/balance', headers={'Authorization': f'Bearer {K}'})
print('so du', json.load(urllib.request.urlopen(rq))['data'])
