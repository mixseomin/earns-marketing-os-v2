# BỘ SET 3D sân ga — phim mẫu "Tàu nước ngọt" (#2934 tập #2936), anh 12/11/2026: làm theo lối hybrid Blender (khối thô → AI vẽ lại).
# Dựng từ sơ đồ cảnh mau/phim-mau-tau-nuoc-ngot-khong-gian.json (m, x đông, y bắc) → cm cùng trục; z lên. Tàu là KHỐI (đạo cụ 'Tàu xanh') để #12 lăn bánh.
#   python3 scripts/du-lieu/bo-set/tau-nuoc-ngot.py > scripts/du-lieu/bo-set/tau-nuoc-ngot.json
#   XV_KHOI=1 python3 scripts/du-lieu/bo-set/tau-nuoc-ngot.py > scripts/du-lieu/bo-set/tau-nuoc-ngot-khoi.json   (video thô khối, phim #3071)
import json, math
SD = json.load(open('mau/phim-mau-tau-nuoc-ngot-khong-gian.json'))
C = SD['chung']['so_do']; M = {k: [v[0] * 100, v[1] * 100] for k, v in C['moc'].items()}
M['duoi_cua_so'] = [-20, 500]   # nhóc đứng sát mép sân ga (mép x = -60) — tầm tay với chú ở ô cửa để trao tiền (sơ đồ 2D đặt 0,4 m: quá xa tay)
TAU = [-260, 600, 0]          # tâm đáy khối tàu (cm); vách đông ở x = -103, cửa sổ của chú y 440–560, z 150–240
CHU = [-95, 500, 40]          # chú NGHIÊNG NGƯỜI ra ô cửa (vách x = -103): đứng sâu trong toa thì vách che mất ở mọi góc chéo (video thô 12/11: #3 #5 #9 #11 không thấy chú)
def huong(tu, den): return round(math.degrees(math.atan2(den[0] - tu[0], -(den[1] - tu[1]))))   # 0 = nhìn −y (về máy chính), 90 = nhìn +x
def cho(ai, moc):
    if ai == 'Chú': return CHU
    if moc in M: return [M[moc][0], M[moc][1], 0]
    raise KeyError(moc)
def dich(x):  # đích nhìn: tên người hoặc mốc
    return {'Chú': CHU, 'Nhóc': None}.get(x) or ([*M[x], 0] if x in M else None)
CAO_NHIN = {'can_chu': 200, 'pov_chu': 110, 'toan_ga': 150, 'can_nhoc': 110, 'banh_xe': 45, 'nhoc_ve': 110, 'mat_chu': 200, 'theo_cua_so': 200}
# sân ga chừa khe 40 cm trước thành tàu (mép x = -60): máy chèn bánh xe #6 đứng trong khe
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
import os
# KHỐI (XV_KHOI=1 — anh 12/11/2026, video thô như nửa dưới reel): người = khối trứng đứng có hai mắt chỉ hướng mặt, đúng chiều cao; chỉ để đọc nhịp máy, cỡ cảnh,
# đường đi, hướng nhìn, đồ đổi tay — không ma-nơ-canh. Không khai thì người = ma-nơ-canh có khớp (bản cho keyframe sau này).
KHOI_NGUOI = {'Chú': {'hinh': 'trung', 'co': [46, 30, 170], 'mau': '#3c5a78', 'mat': True}, 'Nhóc': {'hinh': 'trung', 'co': [34, 24, 125], 'mau': '#d9473a', 'mat': True}}
khoi = {
    'Chú': {'hinh': 'nguoi', 'gioi': 'nam', 'tuoi': 45, 'co': [46, 28, 170], 'mau': '#c99a74', 'ao': '#3c5a78', 'toc': 'short02', 'mau_toc': '#1a1612', 'dang': ['dung_vung']},
    'Nhóc': {'hinh': 'nguoi', 'gioi': 'nam', 'tuoi': 9, 'co': [32, 18, 125], 'mau': '#c99a74', 'ao': '#d9473a', 'toc': 'short02', 'mau_toc': '#141110', 'dang': ['dung_vung']},
    'Tàu xanh': {'hinh': 'hop', 'co': [300, 3200, 40], 'mau': GAM, 'mat': False, 'phan': phan},
    'Tờ 5 nghìn': {'hinh': 'hop', 'co': [14, 7, 1], 'mau': '#7fbf6a', 'mat': False},
    'Chai nước ngọt': {'hinh': 'hop', 'co': [7, 7, 24], 'mau': '#4a2a1a', 'mat': False},
    'Tiền thừa': {'hinh': 'hop', 'co': [10, 6, 2], 'mau': '#c9b96a', 'mat': False},
}
if os.environ.get('XV_KHOI') == '1': khoi.update(KHOI_NGUOI)
# SỔ ĐỒ VẬT theo shot (khớp so_vat của sơ đồ cảnh): (món, người cầm lúc mở, người nhận lúc kết | None, hết sau shot này)
DO = {
    '1': [('Tờ 5 nghìn', 'Chú', None, False)], '2': [('Tờ 5 nghìn', 'Chú', None, False)],
    '3': [('Tờ 5 nghìn', 'Chú', 'Nhóc', False)], '4': [('Tờ 5 nghìn', 'Nhóc', None, True)],
    '8': [('Chai nước ngọt', 'Nhóc', None, False)],
    '9': [('Chai nước ngọt', 'Nhóc', None, False), ('Tiền thừa', 'Nhóc', None, False)],
    '10': [('Chai nước ngọt', 'Nhóc', None, False), ('Tiền thừa', 'Nhóc', 'Chú', False)],
    '11': [('Chai nước ngọt', 'Nhóc', None, False), ('Tiền thừa', 'Chú', None, False)],
    '12': [('Tiền thừa', 'Chú', None, False)],
}
vat = [
    {'ten': 'Sân ga', 'nen': True, 'hinh': 'hop', 'tam': [270, 1200, -2], 'co': [660, 4400, 2], 'mau': '#9a948a', 'en': 'concrete railway platform', 'chat': 'be_tong'},
    {'ten': 'Mép sân ga', 'nen': True, 'hinh': 'hop', 'tam': [-50, 1200, -2], 'co': [20, 4400, 3], 'mau': '#e8d24a', 'en': 'yellow platform edge line'},
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
    # ĐƯỜNG ĐI CỦA NHÓC giữa các shot (máy nối chỗ đứng từ kết shot trước — không khai thì nhóc kẹt ở chỗ cũ)
    for x in vt:
        if x['ten'] != 'Nhóc': continue
        if ma == '3': x['nhay'] = 'nhóc chạy từ giữa sân ga tới dưới cửa sổ giữa hai shot'
        if ma == '8': x['nhay'] = 'nhóc mua nước xong, quay lại đi về phía tàu (ngoài khung)'
        if ma == '8': x['tam'] = [100, 1500, 0]; x['den'] = [M['nhoc_ve'][0], M['nhoc_ve'][1], 0]; x['huong_den'] = x.get('huong', 0)   # vừa đi về vừa uống
        if ma == '9': x['tam'] = [M['nhoc_ve'][0], M['nhoc_ve'][1], 0]; x['den'] = [M['duoi_cua_so'][0], M['duoi_cua_so'][1], 0]; x['huong_den'] = x['huong']
    cho_nv = {x['ten']: x for x in vt}
    for mon, ai, nhan, het in DO.get(ma, []):
        a = cho_nv.get(ai)
        if not a: continue   # người cầm ngoài khung shot này
        x = {'ten': mon, 'tam': [a['tam'][0], a['tam'][1], a['tam'][2] + 100], 'cam': ai}
        if nhan and nhan in cho_nv: b = cho_nv[nhan]; bt = b.get('den') or b['tam']; x['den'] = [bt[0], bt[1], bt[2] + 100]   # đổi tay: kết gần tay người nhận
        if het: x['het'] = True
        vt.append(x)
    t = {'ten': 'Tàu xanh', 'tam': TAU, 'huong': 0}
    if ma == '12':   # tàu VỪA chuyển bánh, nhích sang trái màn (máy phía đông nhìn sang tây → trái = nam) 35 cm trong 4 giây; chú ĐỨNG YÊN theo toa —
        # dời ≥ 40 cm thì máy gắn dáng đi bộ (video thô 12/11: chú bước đi trong toa)
        t['den'] = [TAU[0], TAU[1] - 35, 0]
        for x in vt:
            if x['ten'] in ('Chú', 'Tiền thừa'): x['den'] = [x['tam'][0], x['tam'][1] - 35, x['tam'][2]]; x.setdefault('huong_den', x.get('huong', 0)) if x['ten'] == 'Chú' else None
    vt.append(t)
    may[ma] = {'dat': [cm['dat'][0] * 100, cm['dat'][1] * 100, cm['cao'] * 100], 'nhin': [cm['nhin'][0] * 100, cm['nhin'][1] * 100, CAO_NHIN[sd['may']]],
               'ong_kinh': cm['ong'], 'vi_tri': vt, 'khung': sd.get('khung') or [x['ten'] for x in vt if x['ten'] != 'Tàu xanh']}
    if not may[ma]['khung']: may[ma]['khung'] = ['Tàu xanh']
    if ma == '6':   # chèn bánh xe: bánh nằm DƯỚI mặt sân ga → máy hạ sát mép sân ga, chúc xuống bánh
        may[ma].update({'dat': [-82, 470, 8], 'nhin': [-110, 640, 0], 'ong_kinh': 35})
    if ma == '4': may[ma]['nham'] = 'Nhóc'   # máy lia theo nhóc chạy lên tiệm (video thô 12/11: cuối shot nhóc ra khỏi khung)   # sân ga chừa khe 40 cm trước thành tàu (mép x = -60) — máy đứng trong khe
print(json.dumps({'ten': 'Sân ga tàu xanh (Tàu nước ngọt)', 'ghi_chu': 'Đơn vị cm, x đông, y bắc, z lên; dựng từ sơ đồ cảnh mau/phim-mau-tau-nuoc-ngot-khong-gian.json bằng scripts/du-lieu/bo-set/tau-nuoc-ngot.py.',
                  'vat': vat, 'vung': {'Sân ga tàu xanh': [100, 900, 0]}, 'khoi': khoi, 'may': may}, ensure_ascii=False, indent=1))
