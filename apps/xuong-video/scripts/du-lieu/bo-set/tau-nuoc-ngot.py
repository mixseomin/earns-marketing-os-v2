# BỘ SET 3D sân ga — phim mẫu "Tàu nước ngọt" (#2934 tập #2936), anh 12/11/2026: làm theo lối hybrid Blender (khối thô → AI vẽ lại).
# Dựng từ sơ đồ cảnh mau/phim-mau-tau-nuoc-ngot-khong-gian.json (m, x đông, y bắc) → cm cùng trục; z lên. Tàu là KHỐI (đạo cụ 'Tàu xanh') để #12 lăn bánh.
#   python3 scripts/du-lieu/bo-set/tau-nuoc-ngot.py > scripts/du-lieu/bo-set/tau-nuoc-ngot.json
#   XV_KHOI=1 python3 scripts/du-lieu/bo-set/tau-nuoc-ngot.py > scripts/du-lieu/bo-set/tau-nuoc-ngot-khoi.json   (video thô khối, phim #3071)
import json, math
SD = json.load(open('mau/phim-mau-tau-nuoc-ngot-khong-gian.json'))
C = SD['chung']['so_do']; M = {k: [v[0] * 100, v[1] * 100] for k, v in C['moc'].items()}
M['duoi_cua_so'] = [-20, 500]   # nhóc đứng sát mép sân ga (mép x = -60) — tầm tay với chú ở ô cửa để trao tiền (sơ đồ 2D đặt 0,4 m: quá xa tay)
# KÍCH THƯỚC TOA (anh 12/11/2026 "tàu cao có đúng tỷ lệ không" — bản đầu nóc 3,94 m, rộng 3,2 m, sàn 0,4 m, bánh lơ lửng): theo toa khách khổ 1 m thường gặp
# (ƯỚC, chưa đối chiếu phụ lục khổ giới hạn TT 12/2015): rộng ~2,9 m, nóc ~3,75 m trên mặt ray, sàn ~1,1 m trên mặt ray. Sân ga thấp: mặt ray thấp hơn sân ga 30 cm.
RAY = -30                     # mặt ray (cm, so với mặt sân ga)
SAN, BAU, DINH, NOC = 80, 160, 250, 340   # sàn toa · bậu cửa sổ (sàn + 80) · đỉnh ô cửa · nóc (≈ 3,7 m trên ray)
VD, VT = -103, -393           # vách đông (phía sân ga) · vách tây — rộng 2,9 m
TAU = [-248, 600, 0]          # tâm đáy khối tàu (cm); cửa sổ của chú y 440–560, z BAU–DINH
CHU = [-128, 500, SAN]        # chú đứng TRÊN SÀN TOA sát sau vách đông: vách che thân, đầu + tay qua ô cửa — đặt ngoài vách thì cả người đứng ngoài thành tàu
def huong(tu, den): return round(math.degrees(math.atan2(den[0] - tu[0], -(den[1] - tu[1]))))   # 0 = nhìn −y (về máy chính), 90 = nhìn +x
def cho(ai, moc):
    if ai == 'Chú': return CHU
    if moc in M: return [M[moc][0], M[moc][1], 0]
    raise KeyError(moc)
def dich(x):  # đích nhìn: tên người hoặc mốc
    return {'Chú': CHU, 'Nhóc': None}.get(x) or ([*M[x], 0] if x in M else None)
MAT_CHU = SAN + 160           # tầm mặt chú (đứng trên sàn toa)
CAO_NHIN = {'can_chu': MAT_CHU, 'pov_chu': 110, 'toan_ga': 150, 'can_nhoc': 110, 'banh_xe': 10, 'nhoc_ve': 110, 'mat_chu': MAT_CHU, 'theo_cua_so': MAT_CHU}
CAO_MAY = {'can_chu': 210, 'pov_chu': MAT_CHU + 5, 'mat_chu': MAT_CHU - 5, 'theo_cua_so': 200}   # máy nhìn chú nâng theo sàn toa mới (cm)
# sân ga chừa khe 40 cm trước thành tàu (mép x = -60): máy chèn bánh xe #6 đứng trong khe
X0, Y0 = TAU[0], TAU[1]
def p(ten, x, y, z, co, mau, en):
    return {'hinh': 'hop', 'tam': [x - X0, y - Y0, z], 'co': co, 'mau': mau, 'chat': 'son', 'ten_phan': ten, 'en': en}
XANH, KINH, GAM = '#2f7d4a', '#1d2a30', '#2a2a2a'
XG = (VD + VT) / 2; RONG = VD - VT
phan = [
    p('vách đông dưới', VD, 600, 50, [6, 3200, BAU - 50], XANH, 'green train side'),
    p('vách đông trên', VD, 600, DINH, [6, 3200, NOC - DINH], XANH, 'green train side'),
    p('vách đông nam', VD, -280, BAU, [6, 1440, DINH - BAU], XANH, 'green train side'),
    p('vách đông bắc', VD, 1380, BAU, [6, 1640, DINH - BAU], XANH, 'green train side'),
    p('vách tây', VT, 600, 50, [6, 3200, NOC - 50], XANH, 'green train side'),
    p('mái', XG, 600, NOC, [RONG + 10, 3200, 12], '#d8d8d0', 'train roof'),
    p('sàn toa', XG, 600, SAN - 4, [RONG - 6, 3200, 4], '#5a4a3a', 'train floor'),
    p('khung gầm', XG, 600, 54, [RONG - 60, 3000, SAN - 58], GAM, 'train underframe'),   # dưới sàn, lùi 30 cm khỏi hai vách: nhìn ngang sân ga thấy bánh bên dưới
    p('sọc vàng', VD + 4, 600, SAN + 40, [2, 3200, 12], '#e8c84a', 'yellow stripe'),
] + [p(f'kính {y}', VD + 4, y, BAU + 5, [2, 110, DINH - BAU - 10], KINH, 'closed train window') for y in (-700, -450, -200, 50, 250, 750, 1000, 1250, 1500, 1750, 2000)] \
  + [p(f'bánh {y}', x, y, RAY, [12, 84, 84], '#6a6a6a', 'train wheel') for y in (-800, -650, 620, 770, 1850, 2000) for x in (-198, -298)]   # bánh Ø84 tì lên ray (ray khổ 1 m ở x -198 / -298)
import os
# KHỐI (XV_KHOI=1 — anh 12/11/2026, video thô như nửa dưới reel): người = khối trứng đứng có hai mắt chỉ hướng mặt, đúng chiều cao; chỉ để đọc nhịp máy, cỡ cảnh,
# đường đi, hướng nhìn, đồ đổi tay — không ma-nơ-canh. Không khai thì người = ma-nơ-canh có khớp (bản cho keyframe sau này).
def nguoi_khoi(cao, rong, mau, chom=0):
    """Người khối như reel: THÂN trứng + ĐẦU cầu ở đúng tầm mắt người + MŨI hộp lồi ra trước (−y cục bộ = hướng mặt) + hai mắt — nhìn từ mọi phía đọc
    được hướng đầu. chom (cm) = đầu chồm ra trước (chú thò đầu ra ô cửa khi quay về phía nhóc). Phần: toạ độ so với đáy giữa khối, quay theo huong."""
    d = round(cao * 0.15); z = cao - d   # đầu cao ~1/7 người
    return {'hinh': 'trung', 'co': [rong, rong * 0.85, z], 'mau': mau, 'mat': False, 'phan': [
        {'hinh': 'cau', 'co': [d, d, d], 'mau': mau, 'tam': [0, -chom, z - d * 0.15]},
        {'hinh': 'hop', 'co': [d * 0.22, d * 0.45, d * 0.22], 'mau': '#f2d24a', 'tam': [0, -chom - d * 0.55, z + d * 0.25]},
        *[{'hinh': 'cau', 'co': [d * 0.24] * 3, 'mau': '#ffffff', 'tam': [sx * d * 0.22, -chom - d * 0.42, z + d * 0.45]} for sx in (-1, 1)],
        *[{'hinh': 'cau', 'co': [d * 0.12] * 3, 'mau': '#111111', 'tam': [sx * d * 0.22, -chom - d * 0.53, z + d * 0.5]} for sx in (-1, 1)]]}
KHOI_NGUOI = {'Chú': nguoi_khoi(172, 40, '#3c5a78', chom=22), 'Nhóc': nguoi_khoi(125, 32, '#d9473a')}
khoi = {
    'Chú': {'hinh': 'nguoi', 'gioi': 'nam', 'tuoi': 45, 'co': [46, 28, 170], 'mau': '#c99a74', 'ao': '#3c5a78', 'toc': 'short02', 'mau_toc': '#1a1612', 'dang': ['dung_vung']},
    'Nhóc': {'hinh': 'nguoi', 'gioi': 'nam', 'tuoi': 9, 'co': [32, 18, 125], 'mau': '#c99a74', 'ao': '#d9473a', 'toc': 'short02', 'mau_toc': '#141110', 'dang': ['dung_vung']},
    'Tàu xanh': {'hinh': 'hop', 'co': [90, 3000, 10], 'mau': GAM, 'mat': False, 'cung': True, 'phan': phan},   # cung: trượt thẳng, không chúi / lắc như người   # khối gốc = thanh dầm giữa toa (mỏng, nằm giữa hai ray): khung gầm rộng che mất bánh ở shot chèn #6
    'Tờ 5 nghìn': {'hinh': 'hop', 'co': [14, 7, 1], 'mau': '#7fbf6a', 'mat': False},
    'Chai nước ngọt': {'hinh': 'hop', 'co': [7, 7, 24], 'mau': '#4a2a1a', 'mat': False},
    'Tiền thừa': {'hinh': 'hop', 'co': [10, 6, 2], 'mau': '#c9b96a', 'mat': False},
}
if os.environ.get('XV_KHOI') == '1':
    khoi.update(KHOI_NGUOI)
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
    {'ten': 'Nền đường ray', 'nen': True, 'hinh': 'hop', 'tam': [-500, 1200, RAY - 16], 'co': [880, 4400, 2], 'mau': '#5a5248', 'en': 'gravel track bed below the platform'},
    {'ten': 'Ray gần', 'nen': True, 'hinh': 'hop', 'tam': [-198, 1200, RAY - 14], 'co': [7, 4400, 14], 'mau': '#8a8a8a', 'en': 'steel rail'},
    {'ten': 'Ray xa', 'nen': True, 'hinh': 'hop', 'tam': [-298, 1200, RAY - 14], 'co': [7, 4400, 14], 'mau': '#8a8a8a', 'en': 'steel rail'},
    {'ten': 'Tiệm nước', 'hinh': 'hop', 'tam': [M['tiem'][0], M['tiem'][1] + 150, 0], 'co': [320, 220, 270], 'mau': '#b8743a', 'en': 'small drinks kiosk at the far end of the platform', 'chat': 'go'},
    {'ten': 'Mái tiệm', 'hinh': 'hop', 'tam': [M['tiem'][0], M['tiem'][1] + 110, 270], 'co': [380, 300, 12], 'mau': '#c43a2e', 'en': 'red kiosk awning'},
    {'ten': 'Ghế đá', 'hinh': 'hop', 'tam': [330, 1300, 0], 'co': [60, 180, 45], 'mau': '#7a756c', 'en': 'stone bench'},
    {'ten': 'Cột đèn', 'hinh': 'hop', 'tam': [330, 700, 0], 'co': [12, 12, 380], 'mau': '#3a3a3a', 'en': 'platform lamp post'},
    {'ten': 'Cột đèn 2', 'hinh': 'hop', 'tam': [330, 2100, 0], 'co': [12, 12, 380], 'mau': '#3a3a3a', 'en': 'platform lamp post'},
]
may = {}
# MÁY HAI NGƯỜI (anh 12/11/2026 "các cảnh không rõ, xem không hiểu gì" — toàn ga 26 mm, người chỉ cao 15–20 % khung): đứng trên sân ga phía đông-nam ô cửa,
# ống 32 mm, khung ôm cả ô cửa (chú) lẫn chỗ nhóc đứng — đọc được trao đồ, hướng mặt. Shot toàn ga giữ cho #11 (nhóc chạy xa) để thấy đường chạy.
MAY_HAI = {'dat': [190, 330, 150], 'nhin': [-60, 520, 150], 'ong_kinh': 32}
DUONG = []   # dây vàng đường đi (như reel): mỗi phần tử = vật tuỳ chọn, bật ở đúng shot qua may.them
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
    # CHÚ NHOÀI RA Ô CỬA khi nói / trao đồ với nhóc: dáng 'chong_ban' (thư viện DONG_TAC) — chống tay lên bậu cửa (mép trên vách, z 150), máy tự cúi cột sống tới khi
    # bàn tay chạm bậu → đầu + vai nhô qua ô cửa. Shot chú chỉ nhìn theo (#1 #5 #7 #12) thì đứng thẳng trong toa.
    for x in vt:
        if x['ten'] == 'Chú' and ma in ('3', '5', '9', '10', '11'): x['dien'] = ['chong_ban']   # #5: nhoài ra nhìn về tiệm — đứng thẳng trong toa thì máy phía nam không thấy chú
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
        # chú KHÔNG khai 'den': người có 'den' là máy cho bước đi (video thô có khớp 12/11: chú bước 35 cm trong toa) — tàu chỉ nhích 15 cm, ô cửa 120 cm vẫn ôm chú
        t['den'] = [TAU[0], TAU[1] - 15, 0]
    vt.append(t)
    may[ma] = {'dat': [cm['dat'][0] * 100, cm['dat'][1] * 100, CAO_MAY.get(sd['may'], cm['cao'] * 100)], 'nhin': [cm['nhin'][0] * 100, cm['nhin'][1] * 100, CAO_NHIN[sd['may']]],
               'ong_kinh': cm['ong'], 'vi_tri': vt, 'khung': sd.get('khung') or [x['ten'] for x in vt if x['ten'] != 'Tàu xanh']}
    if not may[ma]['khung']: may[ma]['khung'] = ['Tàu xanh']   # chủ thể = khối gốc của tàu = thanh dầm thấp giữa hai ray: máy chèn #6 bị ngắm lại (dung-set › ngam_lai) vào đó thì vẫn nhìn ngang gầm, thấy bánh
    if ma == '6':   # chèn bánh xe: bánh nằm DƯỚI mặt sân ga → máy hạ sát mép sân ga, chúc xuống bánh
        may[ma].update({'dat': [-62, 540, 25], 'nhin': [-198, 620, 12], 'ong_kinh': 28, 'khoa_nhin': True})   # máy ở MÉP SÂN GA, thấp 25 cm: nhìn qua khe 50 cm giữa sân ga và đáy thân toa vào bánh (máy đặt ngoài sân ga bị kẹp vào trong)
    if ma in ('3', '5'): may[ma].update(MAY_HAI)
    # VIDEO THÔ: máy đặt sao giữ vậy (khoa_nhin) — để Blender tự ngắm lại thì #9 quay về điểm giữa 4 chủ thể, #12 xoay dần ở khung kết trông như rung
    may[ma]['khoa_nhin'] = True
    if ma == '9': may[ma].update({'dat': [190, 330, 150], 'nhin': [80, 950, 120], 'ong_kinh': 32, 'nham': 'Nhóc', 'khung': ['Nhóc', 'Chú']})   # lia theo nhóc đi về tới ô cửa
    if ma == '2': may[ma]['ong_kinh'] = 50   # POV từ ô cửa: nhóc to hơn trong khung
    # dây vàng: đường nhóc đi trong shot (tam → den) vẽ sát sàn + mũi tên ở cuối — người xem thấy ngay nhóc đi đâu
    for x in vt:
        if x['ten'] == 'Nhóc' and x.get('den'):
            a, b = x['tam'], x['den']; ten = f'Đường nhóc #{ma}'; L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1; ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
            DUONG.append({'ten': ten, 'nen': True, 'tuy_chon': True, 'hinh': 'day', 'ban_kinh': 2.5, 'mau': '#f2c200', 'en': 'yellow path line on the floor',
                          'diem': [[a[0], a[1], 1], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1], [b[0], b[1], 1]]})
            DUONG.append({'ten': f'Mũi tên nhóc #{ma}', 'nen': True, 'tuy_chon': True, 'hinh': 'day', 'ban_kinh': 2.5, 'mau': '#f2c200', 'en': 'yellow arrow head',
                          'diem': [[b[0] - 40 * ux - 25 * uy, b[1] - 40 * uy + 25 * ux, 1], [b[0], b[1], 1], [b[0] - 40 * ux + 25 * uy, b[1] - 40 * uy - 25 * ux, 1]], 'bac': 1})
            may[ma].setdefault('them', []).extend([ten, f'Mũi tên nhóc #{ma}'])
    if ma == '4': may[ma]['nham'] = 'Nhóc'
    if ma == '10': may[ma].update({'dat': [20, 450, 235], 'nhin': [-106, 500, 235]} if os.environ.get('XV_KHOI') == '1' else {'dat': [70, 455, 232], 'nhin': [-100, 500, 230]})   # ma-nơ-canh: lùi máy 60 cm — sát quá thì thân đang nhoài choán hết khung (three.js 12/11)   # khối: đầu đứng thẳng cao hơn đầu ma-nơ-canh đang nhoài   # cận mặt chú đang NHOÀI (chong_ban): đầu thấp + ra trước so với lúc đứng thẳng   # máy lia theo nhóc chạy lên tiệm (video thô 12/11: cuối shot nhóc ra khỏi khung)   # sân ga chừa khe 40 cm trước thành tàu (mép x = -60) — máy đứng trong khe
vat += DUONG
print(json.dumps({'ten': 'Sân ga tàu xanh (Tàu nước ngọt)', 'ghi_chu': 'Đơn vị cm, x đông, y bắc, z lên; dựng từ sơ đồ cảnh mau/phim-mau-tau-nuoc-ngot-khong-gian.json bằng scripts/du-lieu/bo-set/tau-nuoc-ngot.py.',
                  'vat': vat, 'vung': {'Sân ga tàu xanh': [100, 900, 0]}, 'khoi': khoi, 'may': may}, ensure_ascii=False, indent=1))
