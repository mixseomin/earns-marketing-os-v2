# BỘ SET 3D sân ga — phim mẫu "Tàu nước ngọt" (#2934 tập #2936), anh 12/11/2026: làm theo lối hybrid Blender (khối thô → AI vẽ lại).
# Dựng từ sơ đồ cảnh mau/phim-mau-tau-nuoc-ngot-khong-gian.json (m, x đông, y bắc) → cm cùng trục; z lên. Tàu là KHỐI (đạo cụ 'Tàu xanh') để #12 lăn bánh.
#   python3 scripts/du-lieu/bo-set/tau-nuoc-ngot.py > scripts/du-lieu/bo-set/tau-nuoc-ngot.json
import json, math
SD = json.load(open('mau/phim-mau-tau-nuoc-ngot-khong-gian.json'))
C = SD['chung']['so_do']; M = {k: [v[0] * 100, v[1] * 100] for k, v in C['moc'].items()}
TAU = [-260, 600, 0]          # tâm đáy khối tàu (cm); vách đông ở x = -103, cửa sổ của chú y 440–560, z 150–240
CHU = [-150, 500, 40]         # chú đứng trong toa, sàn toa cao 40
def huong(tu, den): return round(math.degrees(math.atan2(den[0] - tu[0], -(den[1] - tu[1]))))   # 0 = nhìn −y (về máy chính), 90 = nhìn +x
def cho(ai, moc):
    if ai == 'Chú': return CHU
    if moc in M: return [M[moc][0], M[moc][1], 0]
    raise KeyError(moc)
def dich(x):  # đích nhìn: tên người hoặc mốc
    return {'Chú': CHU, 'Nhóc': None}.get(x) or ([*M[x], 0] if x in M else None)
CAO_NHIN = {'can_chu': 200, 'pov_chu': 110, 'toan_ga': 150, 'can_nhoc': 110, 'banh_xe': 45, 'nhoc_ve': 110, 'mat_chu': 200, 'theo_cua_so': 200}
# vách tàu quanh ô cửa sổ mở (toạ độ phần TƯƠNG ĐỐI tâm đáy khối, cm)
X0, Y0 = TAU[0], TAU[1]
def p(ten, x, y, z, co, mau, en):
    return {'hinh': 'hop', 'tam': [x - X0, y - Y0, z], 'co': co, 'mau': mau, 'chat': 'son', 'ten_phan': ten, 'en': en}
XANH, KINH, GAM = '#2f7d4a', '#1d2a30', '#2a2a2a'
phan = [
    p('vách đông dưới', -103, 600, 40, [6, 3200, 110], XANH, 'green train side'),
    p('vách đông trên', -103, 600, 240, [6, 3200, 140], XANH, 'green train side'),
    p('vách đông nam', -103, -280, 150, [6, 1440, 90], XANH, 'green train side'),
    p('vách đông bắc', -103, 1380, 150, [6, 1640, 90], XANH, 'green train side'),
    p('vách tây', -417, 600, 40, [6, 3200, 340], XANH, 'green train side'),
    p('mái', -260, 600, 380, [330, 3200, 14], '#d8d8d0', 'train roof'),
    p('sàn toa', -260, 600, 36, [320, 3200, 4], '#5a4a3a', 'train floor'),
    p('sọc vàng', -99, 600, 120, [2, 3200, 12], '#e8c84a', 'yellow stripe'),
] + [p(f'kính {y}', -99, y, 155, [2, 110, 80], KINH, 'closed train window') for y in (-700, -450, -200, 50, 250, 750, 1000, 1250, 1500, 1750, 2000)] \
  + [p(f'bánh {y}', -110, y, -45, [12, 90, 90], GAM, 'train wheel') for y in (-800, -650, 620, 770, 1850, 2000)]
khoi = {
    'Chú': {'hinh': 'nguoi', 'gioi': 'nam', 'tuoi': 45, 'co': [46, 28, 170], 'mau': '#c99a74', 'ao': '#3c5a78', 'toc': 'short02', 'mau_toc': '#1a1612', 'dang': ['dung_vung']},
    'Nhóc': {'hinh': 'nguoi', 'gioi': 'nam', 'tuoi': 9, 'co': [32, 18, 125], 'mau': '#c99a74', 'ao': '#d9473a', 'toc': 'short02', 'mau_toc': '#141110', 'dang': ['dung_vung']},
    'Tàu xanh': {'hinh': 'hop', 'co': [300, 3200, 40], 'mau': GAM, 'mat': False, 'phan': phan},
}
vat = [
    {'ten': 'Sân ga', 'nen': True, 'hinh': 'hop', 'tam': [250, 1200, -2], 'co': [700, 4400, 2], 'mau': '#9a948a', 'en': 'concrete railway platform', 'chat': 'be_tong'},
    {'ten': 'Mép sân ga', 'nen': True, 'hinh': 'hop', 'tam': [-90, 1200, -2], 'co': [20, 4400, 3], 'mau': '#e8d24a', 'en': 'yellow platform edge line'},
    {'ten': 'Nền đường ray', 'nen': True, 'hinh': 'hop', 'tam': [-500, 1200, -100], 'co': [800, 4400, 2], 'mau': '#5a5248', 'en': 'gravel track bed below the platform'},
    {'ten': 'Tiệm nước', 'hinh': 'hop', 'tam': [M['tiem'][0], M['tiem'][1] + 150, 0], 'co': [320, 220, 270], 'mau': '#b8743a', 'en': 'small drinks kiosk at the far end of the platform', 'chat': 'go'},
    {'ten': 'Mái tiệm', 'hinh': 'hop', 'tam': [M['tiem'][0], M['tiem'][1] + 110, 270], 'co': [380, 300, 12], 'mau': '#c43a2e', 'en': 'red kiosk awning'},
    {'ten': 'Ghế đá', 'hinh': 'hop', 'tam': [330, 1300, 0], 'co': [60, 180, 45], 'mau': '#7a756c', 'en': 'stone bench'},
    {'ten': 'Cột đèn', 'hinh': 'hop', 'tam': [330, 700, 0], 'co': [12, 12, 380], 'mau': '#3a3a3a', 'en': 'platform lamp post'},
    {'ten': 'Cột đèn 2', 'hinh': 'hop', 'tam': [330, 2100, 0], 'co': [12, 12, 380], 'mau': '#3a3a3a', 'en': 'platform lamp post'},
]
may = {}
for ma, v in SD['shot'].items():
    sd, kt = v['sd'], v.get('sd_ket') or {}
    cm = C['may'][sd['may']]
    vt = []
    for ai in ('Chú', 'Nhóc'):
        if ai not in sd['o']: continue
        a = cho(ai, sd['o'][ai]); x = {'ten': ai, 'tam': a}
        n = sd.get('nhin', {}).get(ai); d = dich(n) if n else None
        if n == 'Nhóc': d = cho('Nhóc', sd['o']['Nhóc'])
        if not d and len(sd['o']) > 1: d = cho('Chú' if ai == 'Nhóc' else 'Nhóc', sd['o']['Chú' if ai == 'Nhóc' else 'Nhóc'])   # không khai nhìn ai: nhìn người kia
        if d: x['huong'] = huong(a, d)
        if ai in kt.get('o', {}):
            b = cho(ai, kt['o'][ai]); x['den'] = b
            nk = kt.get('nhin', {}).get(ai); dk = dich(nk) if nk else None
            if nk == 'Nhóc': dk = b
            if dk: x['huong_den'] = huong(b, dk)
            elif x.get('huong') is not None: x['huong_den'] = huong(a, b)
        vt.append(x)
    t = {'ten': 'Tàu xanh', 'tam': TAU, 'huong': 0}
    if ma == '12':   # tàu chuyển bánh, trôi sang trái màn (máy đứng phía đông nhìn sang tây → trái = nam): lăn 3 m; chú đi theo toa
        t['den'] = [TAU[0], TAU[1] - 300, 0]
        for x in vt:
            if x['ten'] == 'Chú': x['den'] = [CHU[0], CHU[1] - 300, CHU[2]]; x['huong_den'] = x.get('huong', 0)
    vt.append(t)
    may[ma] = {'dat': [cm['dat'][0] * 100, cm['dat'][1] * 100, cm['cao'] * 100], 'nhin': [cm['nhin'][0] * 100, cm['nhin'][1] * 100, CAO_NHIN[sd['may']]],
               'ong_kinh': cm['ong'], 'vi_tri': vt, 'khung': sd.get('khung') or [x['ten'] for x in vt if x['ten'] != 'Tàu xanh']}
    if not may[ma]['khung']: may[ma]['khung'] = ['Tàu xanh']
print(json.dumps({'ten': 'Sân ga tàu xanh (Tàu nước ngọt)', 'ghi_chu': 'Đơn vị cm, x đông, y bắc, z lên; dựng từ sơ đồ cảnh mau/phim-mau-tau-nuoc-ngot-khong-gian.json bằng scripts/du-lieu/bo-set/tau-nuoc-ngot.py.',
                  'vat': vat, 'vung': {'Sân ga tàu xanh': [100, 900, 0]}, 'khoi': khoi, 'may': may}, ensure_ascii=False, indent=1))
