# BỘ SET 3D sân ga — phim mẫu "Tàu nước ngọt" (#2934 tập #2936), anh 12/11/2026: làm theo lối hybrid Blender (khối thô → AI vẽ lại).
# Dựng từ sơ đồ cảnh mau/phim-mau-tau-nuoc-ngot-khong-gian.json (m, x đông, y bắc) → cm cùng trục; z lên. Tàu là KHỐI (đạo cụ 'Tàu xanh') để #12 lăn bánh.
#   python3 scripts/du-lieu/bo-set/tau-nuoc-ngot.py > scripts/du-lieu/bo-set/tau-nuoc-ngot.json
#   XV_KHOI=1 python3 scripts/du-lieu/bo-set/tau-nuoc-ngot.py > scripts/du-lieu/bo-set/tau-nuoc-ngot-khoi.json   (video thô khối, phim #3071)
import json, math
SD = json.load(open('mau/phim-mau-tau-nuoc-ngot-khong-gian.json'))
C = SD['chung']['so_do']; M = {k: [v[0] * 100, v[1] * 100] for k, v in C['moc'].items()}
M['duoi_cua_so'] = [-20, 500]
M['dau_ga'] = [100, 100]   # đầu sân ga phía nam — chú nhìn quanh (#1) bắt đầu từ đây rồi quét lên phía bắc tới khi thấy nhóc
# NGỮ PHÁP SHOT (anh 12/11/2026: "người nói thì phải có shot quay vào mặt người đó, gần hơn, quay riêng… không phải lúc nào cũng toàn cảnh, khó tạo cảm xúc"):
# chuỗi NHÌN → THẤY → PHẢN ỨNG (POV structure: glance → object → reaction) và mỗi lượt nói một CẬN RIÊNG của người nói (single, shot / reverse shot).
# Shot thêm ngoài sơ đồ mẫu (mau/…-khong-gian.json giữ nguyên cho phim mẫu #2934): mã chữ, xếp thứ tự bằng thu_tu trong DB.
SD['shot'].update({
    '0': {'sd': {'may': 'toan_ga', 'o': {'Chú': 'cua_so', 'Nhóc': 'giua_ga'}, 'nhin': {'Chú': 'dau_ga', 'Nhóc': 'cua_so'}}},   # THIẾT LẬP mở tập: sân ga chiều muộn, tàu đỗ, chú ở ô cửa, nhóc đứng giữa ga (vai thiet_lap)
    '2b': {'sd': {'may': 'chu_thay_nhoc', 'o': {'Chú': 'cua_so'}, 'nhin': {'Chú': 'giua_ga'}, 'khung': ['Chú']}},          # PHẢN ỨNG: thấy nhóc, gọi
    '2c': {'sd': {'may': 'mat_nhoc_xa', 'o': {'Nhóc': 'giua_ga'}, 'nhin': {'Nhóc': 'cua_so'}, 'khung': ['Nhóc']}},     # mặt nhóc nghe gọi → chạy lại
    '3a': {'sd': {'may': 'chu_tu_duoi', 'o': {'Chú': 'cua_so'}, 'nhin': {'Chú': 'duoi_cua_so'}, 'khung': ['Chú']}},       # cận chú: "Chú cho cháu 5k"
    '4a': {'sd': {'may': 'chu_tu_duoi', 'o': {'Chú': 'cua_so'}, 'nhin': {'Chú': 'duoi_cua_so'}, 'khung': ['Chú']}},       # cận chú dặn việc
    '9a': {'sd': {'may': 'chu_tu_duoi', 'o': {'Chú': 'cua_so'}, 'nhin': {'Chú': 'duoi_cua_so'}, 'khung': ['Chú']}},       # cận chú hỏi dồn
    '9b': {'sd': {'may': 'mat_nhoc', 'o': {'Nhóc': 'duoi_cua_so'}, 'nhin': {'Nhóc': 'Chú'}, 'khung': ['Nhóc']}},      # cận nhóc xin lỗi, trả tiền thừa
})
SD['shot']['4']['sd']['may'] = 'mat_nhoc'   # nhóc nghe xong dặn: thấy MẶT (máy cũ phía đông-nam chỉ thấy lưng / gáy)
SD['shot']['5']['sd']['may'] = 'chu_nhin_tiem'    # chú gọi với theo nhóc chạy về tiệm: cận vừa thấy mặt, không toàn ga
SD['shot']['7']['sd']['may'] = 'chu_nhin_tiem'     # chú sốt ruột chờ, nhìn về tiệm: máy trước mặt (can_chu phía nam chỉ thấy gáy — đo 116°)
SD['shot']['1']['sd']['may'] = 'chu_thay_nhoc'    # nhìn quanh rồi thấy nhóc: CÙNG máy với cận phản ứng #3 (glance và reaction một góc — Murch: hướng máy chủ các cận chú)
# MÁY THÊM Ở ĐÂY PHẢI VỀ SƠ ĐỒ TẬP: in ra 'may_so_do' → bo-set.mts --tap ghi vào xv_tap.khong_gian[*].so_do.may (13/11/2026: thiếu bước này, bộ đối
# chiếu ảnh sập 'sơ đồ không có máy chu_tu_duoi' ở 10/20 shot — keyframe sai không ai chấm).
C['may'].update({
    'mat_nhoc_xa': {'dat': [2.6, 7.1], 'nhin': [1.0, 9], 'cao': 1.0, 'ong': 85},   # phía đông-nam nhóc: hướng máy 130° nằm trong ±45° hướng chủ cảnh (153°) mà vẫn thấy 3/4 mặt nhóc nhìn về ô cửa   # hướng máy ≤ 45° với các cận nhóc khác (#8, #15) — hậu cảnh không nhảy     # trước mặt nhóc ở giữa sân ga, cùng phía trục với mọi máy; lệch đông 0,5 m khỏi đường nhóc chạy về ô cửa
    # QUA VAI CHÚ (reverse shot): máy lơ lửng ngay ngoài ô cửa, cao ngang vai chú, nhìn xuống mặt nhóc đang ngước lên — máy đặt dưới sân ga chỉ thấy gáy nhóc
    'mat_nhoc': {'dat': [-0.92, 4.45], 'nhin': [-0.2, 5], 'cao': 1.7, 'ong': 35},
    # CẬN CHÚ TỪ TẦM MẮT NHÓC: máy thấp trên sân ga cạnh chỗ nhóc, ngước lên mặt chú đang nhoài ra cúi nhìn xuống — máy cao (mat_chu 2,35 m) chỉ thấy đỉnh đầu
    'chu_tu_duoi': {'dat': [0.2, 4.35], 'nhin': [-1.1, 5], 'cao': 1.15, 'ong': 40},
    # chú nhìn theo nhóc về tiệm (phía bắc): máy phía đông-bắc ô cửa, thấy mặt — máy phía nam (can_chu) chỉ thấy gáy
    # chú THẤY nhóc ở giữa ga (nhìn chéo lên phía đông-bắc): máy trước mặt theo hướng đó, cùng phía trục chú–nhóc — máy thấp cạnh ô cửa chỉ thấy má (lệch 84°)
    'chu_thay_nhoc': {'dat': [1.0, 6.3], 'nhin': [-1.1, 5], 'cao': 1.9, 'ong': 35},
    'chu_nhin_tiem': {'dat': [0.6, 6.2], 'nhin': [-1.2, 5], 'cao': 1.9, 'ong': 35},
})   # nhóc đứng sát mép sân ga (mép x = -60) — tầm tay với chú ở ô cửa để trao tiền (sơ đồ 2D đặt 0,4 m: quá xa tay)
# KÍCH THƯỚC TOA (anh 12/11/2026 "tàu cao có đúng tỷ lệ không" — bản đầu nóc 3,94 m, rộng 3,2 m, sàn 0,4 m, bánh lơ lửng): theo toa khách khổ 1 m thường gặp
# (ƯỚC, chưa đối chiếu phụ lục khổ giới hạn TT 12/2015): rộng ~2,9 m, nóc ~3,75 m trên mặt ray, sàn ~1,1 m trên mặt ray. Sân ga thấp: mặt ray thấp hơn sân ga 30 cm.
RAY = -30                     # mặt ray (cm, so với mặt sân ga)
SAN, BAU, DINH, NOC = 80, 160, 250, 340   # sàn toa · bậu cửa sổ (sàn + 80 — dáng chong_ban của mau.html cho tay chạm đúng mức này) · đỉnh ô cửa · nóc (≈ 3,7 m trên ray)
# Ô CỬA CỦA CHÚ rộng 100 cm (13/11/2026: bản 120 × 90 gần vuông — cận góc thấp ô cửa choán cả khung, model vẽ thành CỬA LÊN XUỐNG ở #2 #4 #20)
CUA_Y0, CUA_Y1 = 450, 550
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
# CẬN CHÚ QUA Ô CỬA PHẢI THẤY BẬU (13/11/2026): ngắm tầm mặt thì bậu (sàn + 90) rơi dưới mép khung — ô cửa không đáy đọc ra CỬA LÊN XUỐNG (#2 #4 #10 #12 #20).
# Chú ĐỨNG THẲNG (không nhoài) thì ô cửa 90 cm cao hơn khung cận ống 50: dùng ống 35 + ngắm cằm (MAT_CHU − 25) — thấy cả đầu lẫn bậu cho bậu lọt mép dưới; #6 #8 #15 (chu_tu_duoi) vốn thấy bậu nên ảnh ra đúng ô cửa sổ.
CAO_NHIN = {'chu_thay_nhoc': MAT_CHU - 25, 'mat_nhoc_xa': 110, 'mat_nhoc': 105, 'chu_tu_duoi': MAT_CHU - 25, 'chu_nhin_tiem': MAT_CHU - 25, 'can_chu': MAT_CHU, 'pov_chu': 110, 'toan_ga': 150, 'can_nhoc': 110, 'banh_xe': 10, 'nhoc_ve': 110, 'mat_chu': MAT_CHU, 'theo_cua_so': MAT_CHU}
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
    p('vách đông nam', VD, (-1000 + CUA_Y0) / 2, BAU, [6, CUA_Y0 + 1000, DINH - BAU], XANH, 'green train side'),
    p('vách đông bắc', VD, (CUA_Y1 + 2200) / 2, BAU, [6, 2200 - CUA_Y1, DINH - BAU], XANH, 'green train side'),
    # TRONG TOA KHÁC MÀU NGOÀI (13/11/2026: vách tây trong toa cùng xanh với vách đông ngoài → nhìn qua ô cửa chỉ thấy xanh, mép cửa biến mất, khung three.js
    # đọc như chú đứng ĐÈ lên thành tàu; model ảnh vẽ chú đứng ngoài tàu ở 5 cận #2 #4 #8 #12 #15). Mặt trong toa = kem, ô cửa của chú có khung kim loại sáng.
    p('vách tây', VT, 600, 50, [6, 3200, NOC - 50], '#d9cfb4', 'cream train interior wall'),
    p('vách đông trong', VD - 5, 600, SAN, [2, 3200, BAU - SAN], '#d9cfb4', 'cream train interior wall'),
    *[p(f'khung cửa {t}', VD + 5, y, z, co, '#c4c8cc', 'metal window frame') for t, y, z, co in (
        ('dưới', 500, BAU - 4, [6, CUA_Y1 - CUA_Y0 + 8, 8]), ('trên', 500, DINH - 4, [6, CUA_Y1 - CUA_Y0 + 8, 8]), ('nam', CUA_Y0 - 3, BAU, [6, 8, DINH - BAU]), ('bắc', CUA_Y1 + 3, BAU, [6, 8, DINH - BAU]))],
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
    # chai nước ngọt THỦY TINH có ống hút (anh 12/11/2026: "cầm chai vừa đi vừa uống thì ai có hiểu không") — khối nâu trơn thì model đoán bừa; dáng chai + cổ + ống hút
    # trắng đọc được ngay trong clip tham chiếu
    'Chai nước ngọt': {'hinh': 'hop', 'co': [6.5, 6.5, 15], 'mau': '#3a1f12', 'mat': False, 'phan': [
        {'hinh': 'hop', 'co': [4.2, 4.2, 4], 'mau': '#3a1f12', 'tam': [0, 0, 15]}, {'hinh': 'hop', 'co': [2.4, 2.4, 3.5], 'mau': '#3a1f12', 'tam': [0, 0, 19]},
        {'hinh': 'hop', 'co': [0.7, 0.7, 9], 'mau': '#f4f4f4', 'tam': [0.4, 0, 21]}, {'hinh': 'hop', 'co': [6.7, 6.7, 3], 'mau': '#c8202a', 'tam': [0, 0, 6]}]},
    'Tiền thừa': {'hinh': 'hop', 'co': [10, 6, 2], 'mau': '#c9b96a', 'mat': False},
}
if os.environ.get('XV_KHOI') == '1':
    khoi.update(KHOI_NGUOI)
# SỔ ĐỒ VẬT theo shot (khớp so_vat của sơ đồ cảnh): (món, người cầm lúc mở, người nhận lúc kết | None, hết sau shot này)
DO = {
    '1': [('Tờ 5 nghìn', 'Chú', None, False)], '2': [('Tờ 5 nghìn', 'Chú', None, False)],
    '2b': [('Tờ 5 nghìn', 'Chú', None, False)], '3a': [('Tờ 5 nghìn', 'Chú', None, False)],
    '9b': [('Chai nước ngọt', 'Nhóc', None, False), ('Tiền thừa', 'Nhóc', None, False)],
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
    # MÁI CHE SÂN GA (13/11/2026: ảnh mẫu bối cảnh có mái tôn trên hàng cột sắt gỉ, 3D không có → mỗi keyframe tự vẽ nền một kiểu: #10 #12 #19 có mái,
    # #1 #14 #18 sân trống). anchor = bối cảnh Sân ga (một phần của ảnh mẫu đó, không là đối tượng riêng). Mái lệch về phía xa tàu như ảnh mẫu (dải sát tàu để nắng chiều chiếu vào), cột cách 6 m.
    {'ten': 'Mái che sân ga', 'hinh': 'hop', 'tam': [380, 1200, 360], 'co': [440, 4200, 10], 'mau': '#8a8f94', 'en': 'corrugated metal platform canopy', 'anchor': 'Sân ga tàu xanh'},
    *[{'ten': f'Cột mái {y}', 'hinh': 'hop', 'tam': [440, y, 0], 'co': [18, 18, 360], 'mau': '#6b4a36', 'en': 'rusty iron canopy pillar', 'anchor': 'Sân ga tàu xanh'} for y in range(-700, 3200, 600)],
    {'ten': 'Ghế đá', 'hinh': 'hop', 'tam': [330, 1300, 0], 'co': [60, 180, 45], 'mau': '#7a756c', 'en': 'stone bench'},
    {'ten': 'Cột đèn', 'hinh': 'hop', 'tam': [330, 700, 0], 'co': [12, 12, 380], 'mau': '#3a3a3a', 'en': 'platform lamp post'},
    # BÁNH TÀU riêng một vật (mặt ngoài bánh gần, sát sân ga) — chủ thể của cận chèn #10; trước chủ thể là khối gốc 'Tàu xanh' (thanh dầm giữa ray) nằm ngoài khung
    {'ten': 'Bánh tàu', 'hinh': 'hop', 'tam': [-190, 620, -30], 'co': [3, 84, 84], 'mau': '#6a6a6a', 'en': 'train wheel', 'chat': 'son'},
    {'ten': 'Cột đèn 2', 'hinh': 'hop', 'tam': [330, 2100, 0], 'co': [12, 12, 380], 'mau': '#3a3a3a', 'en': 'platform lamp post'},
]
may = {}
# MÁY HAI NGƯỜI (anh 12/11/2026 "các cảnh không rõ, xem không hiểu gì" — toàn ga 26 mm, người chỉ cao 15–20 % khung): đứng trên sân ga phía đông-nam ô cửa,
# ống 32 mm, khung ôm cả ô cửa (chú) lẫn chỗ nhóc đứng — đọc được trao đồ, hướng mặt. Shot toàn ga giữ cho #11 (nhóc chạy xa) để thấy đường chạy.
MAY_HAI = {'dat': [190, 330, 150], 'nhin': [-60, 520, 150], 'ong_kinh': 32}
TRANG_PHUC = {'Chú': 'Bộ đi tàu: áo khoác xanh navy + áo thun xám', 'Nhóc': 'Bộ áo be sờn + quần soóc ô liu'}   # xv_bien_the #1492 #1493 (ảnh mẫu 13/11/2026)
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
        # HƯỚNG NHÌN (anh 12/11/2026: quay đầu / hướng nhìn phải nối liền mạch giữa các shot, xác minh ngay ở bản 3D): tên người hoặc mốc đang nhìn lúc mở / kết —
        # trang three.js xoay ĐẦU độc lập thân về đích này, soát nối shot + sinh câu prompt hướng nhìn từ cùng dữ liệu
        x['nhin_ai'] = n or next((k for k in sd['o'] if k != ai), None)
        x['nhin_ai_den'] = (kt.get('nhin', {}).get(ai) if ai in kt.get('o', {}) or ai in kt.get('nhin', {}) else None) or x['nhin_ai']
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
        if ma == '8': x['tam'] = [100, 1250, 0]; x['den'] = [88, 1050, 0]; x['huong_den'] = x.get('huong', 0)   # vừa đi về vừa uống: 2 m trong 1,5 s (đi thong thả ~1,3 m/s; 5,5 m là chạy — câu nhịp tự ghi 'runs' làm lộ lỗi)
        if ma == '9': x['tam'] = [M['nhoc_ve'][0], M['nhoc_ve'][1], 0]; x['den'] = [M['duoi_cua_so'][0], M['duoi_cua_so'][1], 0]; x['huong'] = huong(x['tam'], CHU); x['huong_den'] = huong(x['den'], CHU)   # hướng thân tính từ CHỖ MỚI (soát nối #8→#9: lệch 66°)
        if ma == '11': x['huong'] = huong(x['tam'], CHU); x['nhin_ai'] = 'Chú'   # mở ra vẫn quay về chú như kết #10, rồi mới quay người chạy về tiệm (soát nối #10→#11: lệch 93°)
    # CHÚ NHOÀI RA Ô CỬA khi nói / trao đồ với nhóc: dáng 'chong_ban' (thư viện DONG_TAC) — chống tay lên bậu cửa (mép trên vách, z 150), máy tự cúi cột sống tới khi
    # bàn tay chạm bậu → đầu + vai nhô qua ô cửa. Shot chú chỉ nhìn theo (#1 #5 #7 #12) thì đứng thẳng trong toa.
    # CHỖ ĐỨNG cho bộ đối chiếu ảnh (vi_tri.o_dau): chú luôn TRONG toa sau ô cửa sổ, nhóc luôn trên sân ga — #12 từng ra chú đứng sân ga mà không mục nào bắt
    for x in vt:
        if x['ten'] == 'Chú': x['o_dau'] = 'inside the train carriage, behind the open passenger window (not standing on the platform)'
        if x['ten'] == 'Nhóc': x['o_dau'] = 'standing on the platform outside the train'
    for x in vt:
        if x['ten'] == 'Chú' and ma in ('1', '2b', '3a', '3', '4a', '5', '9a', '10', '11'): x['dien'] = ['chong_ban']   # '1' (13/11/2026): ngó tìm người = nhoài ra cửa sổ; đứng thẳng thì bậu sát mép khung, keyframe #2 ra cửa lên xuống 4 lần liền   # #5: nhoài ra nhìn về tiệm — đứng thẳng trong toa thì máy phía nam không thấy chú
    # NHOÀI RA CỬA = THÂN HƯỚNG RA Ô CỬA (anh 14/11/2026, shot #10 = mã '5': "Chú vẫn phải nhoài người ra cửa toa để gọi theo nhưng đang không vẽ đúng"): dáng
    # chong_ban cúi về PHÍA TRƯỚC thân — thân quay dọc toa (174°, nhìn về tiệm) thì cúi dọc hành lang, nhìn như đứng trong toa. Thân ra cửa (90° = ra sân ga),
    # chỉ xoay nghiêng ≤ 45° về phía nhìn; phần còn lại đầu xoay (trang three.js: đầu ±75° độc lập thân). Mã '1' và '2b' (150°) cùng kiểu lệch — chờ anh chốt.
    for x in vt:
        if x['ten'] == 'Chú' and ma == '5' and 'chong_ban' in x.get('dien', []) and 'huong' in x:
            x['huong'] = 90 + max(-45, min(45, ((x['huong'] - 90 + 180) % 360) - 180))
    # SỔ TRANG PHỤC: cả phim một ngày, một bộ đồ — khai ở MỌI shot. Chỉ khai ở shot đầu thì shot có 'nhay' (dịch chuyển ngoài khung) làm sổ quên đồ (noiHookup coi nhay
    # là cắt thời gian) → #7 bị chặn "Nhóc chưa có trang phục" (13/11/2026). Tên = biến thể có ảnh mẫu.
    if True:
        for x in vt:
            if x['ten'] in TRANG_PHUC: x['trang_phuc'] = TRANG_PHUC[x['ten']]
    cho_nv = {x['ten']: x for x in vt}
    for mon, ai, nhan, het in DO.get(ma, []):
        a = cho_nv.get(ai)
        if not a: continue   # người cầm ngoài khung shot này
        x = {'ten': mon, 'tam': [a['tam'][0], a['tam'][1], a['tam'][2] + 100], 'cam': ai}
        if nhan and nhan in cho_nv: b = cho_nv[nhan]; bt = b.get('den') or b['tam']; x['den'] = [bt[0], bt[1], bt[2] + 100]   # đổi tay: kết gần tay người nhận
        if het: x['het'] = True
        if mon == 'Chai nước ngọt': x['tay_cam'] = 'trai'   # chai tay trái — tay phải để cầm / đưa tiền (#9 giơ tiền thừa, #10 đưa)
        vt.append(x)
    # NỐI HÀNH ĐỘNG QUA CÚ CẮT (anh 12/11/2026: "đưa tiền lẻ thì quay gần tay đưa… bé nhận tiền xong phải quay đầu về hướng chạy… mọi thứ phải liền mạch"):
    # nhip = mốc động tác trong shot (u 0..1), trao = khoảng chuyền tay, tay = mức giơ tay. Trang three.js dựng + soát + viết câu nhịp cho prompt từ đây.
    nv_ = {x['ten']: x for x in vt}
    D = lambda k: [M[k][0], M[k][1], 0]
    # NHÂN QUẢ LỜI → HÀNH ĐỘNG (anh 12/11/2026: "giao tiền xong chưa nói việc gì đã thấy bé chạy. Sai"): nhóc chỉ đi SAU khi nghe xong câu sai đi.
    # Lời dặn ở #4 = MỘT hơi "Đi mua hai chai nước ngọt. Cháu một chai, chú một chai!" (0,3–3,85 s) → #3 nhận tiền xong vẫn đứng nhìn chú; #4 nghe HẾT lời dặn rồi mới
    # quay + chạy (shot 5,3 s, phat_toi_thieu). #5 chú chỉ gọi với theo "Đi nhanh về nhanh nhé!" khi nhóc đã chạy (anh 12/11/2026: "chưa giao xong đã thấy chạy đi")
    if ma == '3' and 'Nhóc' in nv_:
        nv_['Nhóc']['nhip'] = [{'u': 0, 'h': -90, 'nhin': 'Chú'}, {'u': 1, 'h': -90, 'nhin': 'Chú'}]
        nv_['Tờ 5 nghìn']['trao'] = [0.35, 0.6]
    if ma == '4' and 'Nhóc' in nv_:   # lời dặn đã TRỌN ở cận chú #4a → #4 là phản ứng: 0–0,6 s còn nhìn chú (gật) · 0,6–1,0 s quay về tiệm · 1,0–2,2 s chạy
        nv_['Nhóc']['nhip'] = [{'u': 0, 'p': D('duoi_cua_so'), 'h': -90, 'nhin': 'Chú'}, {'u': 0.27, 'p': D('duoi_cua_so'), 'h': -90, 'nhin': 'Chú'},
                               {'u': 0.45, 'p': D('duoi_cua_so'), 'h': 180, 'nhin': 'tiem'}, {'u': 1, 'p': [40, 880, 0], 'h': 180}]
        nv_['Nhóc']['den'] = [40, 880, 0]; nv_['Nhóc']['huong'] = -90; nv_['Nhóc']['nhin_ai'] = 'Chú'
        nv_['Nhóc']['tay'] = [[0, 0.5], [0.3, 0.5], [0.45, 0]]   # mở shot: tờ tiền vừa nhận GIƠ ngang ngực (tay buông thì tờ tiền sát đáy khung — keyframe #9 vẽ rơi dưới đất 3 lần), quay đi thì hạ tay
    if ma == '8' and 'Nhóc' in nv_:   # VỪA ĐI VỪA UỐNG: tay trái đưa chai lên miệng hút hai ngụm — hiện trong clip tham chiếu, câu nhịp ghi đúng giây
        nv_['Nhóc']['dien'] = ['uong@0.12-0.4', 'uong@0.62-0.88']
    if ma == '9' and 'Nhóc' in nv_:   # đi về sát cửa sổ (tới nơi ở cuối shot); lời hỏi / xin lỗi tách ra cận riêng #9a / #9b
        nv_['Nhóc']['nhip'] = [{'u': 0, 'p': [88, 1050, 0], 'h': huong([88, 1050, 0], CHU), 'nhin': 'Chú'}, {'u': 0.92, 'p': D('duoi_cua_so'), 'h': -90}]   # đi tiếp từ đúng chỗ #8 dừng
    if ma == '9b' and 'Nhóc' in nv_:   # cận nhóc xin lỗi; cuối lời giơ tay cầm tiền thừa lên (nối sang cận tay #10)
        nv_['Nhóc']['tay'] = [[0.75, 0], [1, 0.55]]
    if ma == '1':   # NHÌN QUANH: chú đảo mắt từ đầu ga phía nam lên phía bắc, dừng lại ở giữa sân ga (chỗ nhóc) — nối sang POV #2
        for x in vt:
            if x['ten'] == 'Chú': x['nhin_ai'] = 'dau_ga'; x['nhip'] = [{'u': 0, 'nhin': 'dau_ga'}, {'u': 0.3, 'nhin': 'dau_ga'}, {'u': 0.6, 'nhin': 'nhoc_xa'}, {'u': 0.8, 'nhin': 'giua_ga'}]
    if ma == '2c' and 'Nhóc' in nv_:   # nghe gọi: ngẩng nhìn ô cửa 0–0,45 → chạy về phía cửa sổ, ra khỏi khung
        nv_['Nhóc']['nhip'] = [{'u': 0, 'p': D('giua_ga'), 'h': huong(D('giua_ga'), CHU), 'nhin': 'Chú'}, {'u': 0.45, 'p': D('giua_ga'), 'h': huong(D('giua_ga'), CHU), 'nhin': 'Chú'},
                               {'u': 1, 'p': [25, 650, 0], 'h': huong(D('giua_ga'), CHU)}]   # 2,6 m trong 0,8 s = chạy
        nv_['Nhóc']['den'] = [25, 650, 0]
    if ma == '3a' and 'Chú' in nv_:   # chìa tờ tiền ra theo lời "Chú cho cháu 5k" — nối sang hai người trao ở #3
        nv_['Chú']['tay'] = [[0.3, 0], [1, 0.6]]
        nv_['Chú']['nhay'] = 'nhóc đã chạy tới dưới cửa sổ (shot #4 xen giữa): chú quay xuống nhìn nhóc'   # hướng mặt không nối từ #3 (đang nhìn nhóc ở giữa ga)
    if ma == '10':   # CẬN TAY ở bậu cửa: tay nhóc đưa tiền thừa, tay chú đón — thay cận mặt (không thấy được động tác trao)
        may[ma] = may.get(ma, {})
        if 'Nhóc' in nv_: nv_['Nhóc']['tay'] = [[0, 0.55]]
        if 'Tiền thừa' in nv_: nv_['Tiền thừa']['trao'] = [0.15, 0.55]
    if ma == '11' and 'Nhóc' in nv_:   # mở ra vẫn quay về chú → quay người về tiệm (0–25 %) rồi mới chạy
        nv_['Nhóc']['nhip'] = [{'u': 0, 'h': -90, 'nhin': 'Chú'}, {'u': 0.25, 'h': 180, 'nhin': 'tiem'}, {'u': 1, 'p': D('nhoc_xa'), 'h': 180}]
    if ma == '12':   # mở ra chú vẫn quay về phía nhóc như kết #11, rồi xoay theo nhóc chạy xa (soát nối #11→#12: thân lệch 80°)
        for x in vt:
            if x['ten'] == 'Chú': x['huong_den'] = x['huong']; x['huong'] = 90
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
        may[ma].update({'dat': [-62, 540, 25], 'nhin': [-198, 620, 12], 'ong_kinh': 28, 'khoa_nhin': True, 'khung': ['Bánh tàu']})   # máy ở MÉP SÂN GA, thấp 25 cm: nhìn qua khe 50 cm giữa sân ga và đáy thân toa vào bánh (máy đặt ngoài sân ga bị kẹp vào trong)
    if ma == '3': may[ma].update(MAY_HAI)
    # VIDEO THÔ: máy đặt sao giữ vậy (khoa_nhin) — để Blender tự ngắm lại thì #9 quay về điểm giữa 4 chủ thể, #12 xoay dần ở khung kết trông như rung
    may[ma]['khoa_nhin'] = True
    if ma == '0': may[ma].update({'dat': [450, 200, 200], 'nhin': [-60, 800, 150], 'ong_kinh': 26, 'khung': ['Chú', 'Nhóc']})   # thiết lập từ phía đông-nam sân ga: thấy đầu chú qua ô cửa (máy toàn ga dọc mép sân ga nhìn xiên vách toa → đầu chú bị vách che)
    if ma == '9': may[ma].update({'dat': [450, 420, 160], 'nhin': [118, 644, 130], 'ong_kinh': 26, 'khung': ['Nhóc', 'Chú']})   # tổng thể từ phía đông-nam, CÙNG PHÍA trục chú–nhóc lúc nhóc tới ô cửa (y < 500): thấy mặt chú nhìn nhóc về + mặt nhóc đi tới — máy cũ: mặt chú lệch 106°   # TỔNG THỂ cảnh "Quay về": đứng yên thấy cả chú ở ô cửa lẫn đường nhóc đi về (Murch: thiếu tổng thể + lệch hướng chủ 49° khi lia theo nhóc)
    if ma == '8': may[ma].update({'dat': [254, 960, 100], 'nhin': [90, 1150, 110], 'ong_kinh': 50})   # nhóc vừa đi vừa uống: máy phía đông-nam, hướng 130° (hướng chủ cảnh 150°) thấy 3/4 mặt
    if ma == '12': may[ma].update({'dat': [100, 800, 170], 'nhin': [-128, 520, 220], 'ong_kinh': 35})   # chú nhìn theo nhóc khi tàu chuyển bánh: máy phía bắc thấy mặt (theo_cua_so phía đông: nghiêng 90°)
    if ma == '9b': may[ma].update({'nhin': [-20, 500, 88], 'ong_kinh': 26})   # cận nhóc trả tiền thừa: phải THẤY hai tay (chai tay trái + tiền giơ tay phải) — 35 mm ngắm 105 cm cắt ngang ngực, model không thấy món nên vẽ tay không (13/11/2026)
    if ma == '11': may[ma].update({'dat': [350, 2100, 150], 'nhin': [-80, 650, 140], 'ong_kinh': 35, 'qua_truc': True, 'khung': ['Nhóc', 'Chú'], 'nham': 'Nhóc'})   # chủ thể = hai người (tiền thừa trong tay chú không phải chủ thể); lia theo nhóc chạy về phía máy   # qua_truc: cú máy TRUNG LẬP đầu trục (head-on) — máy nằm trên đường nhóc chạy (lệch 8°), ngành cho đổi phía trục qua cú máy này   # tổng thể từ CUỐI sân ga nhìn ngược về tàu: nhóc chạy VỀ PHÍA máy (thấy mặt lúc nói 'Cháu đi nhé'), chú nhìn theo cũng quay mặt về máy — máy phía nam cũ thấy lưng cả hai   # TỔNG THỂ cảnh "Tiền thừa": thấy chú + nhóc ở ô cửa và đường nhóc chạy về cuối ga (hướng 105°)
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
    if ma == '10':   # cận tay ở bậu cửa: chủ thể = nắm tiền thừa; tiền đang được nhóc GIƠ lên (tay 0,55) ngang bậu — chỗ đứng của món theo tay giơ, không theo hông
        # máy THẤP trên sân ga ngước lên bậu cửa: thấy tay chú đón + nắm tiền + mặt nhóc đang giơ (cận trao — luật vật cầm phải thấy người cầm)
        may[ma].update({'dat': [60, 380, 120], 'nhin': [-60, 500, 135], 'ong_kinh': 40, 'khung': ['Tiền thừa', 'Nhóc']})
        for x in vt:
            if x['ten'] == 'Tiền thừa': x['tam'] = [-70, 500, 155]   # chỗ hai bàn tay gặp nhau ở bậu (nhóc giơ 0,55 — trang three.js dựng tay tới đây)   # chủ thể cận tay = nắm tiền thừa (mặt chú ngoài khung là đúng)   # cận tay ở bậu cửa: ngang tầm hai bàn tay (nhóc giơ tới ~1,4 m, tay chú qua bậu 1,6 m)   # ma-nơ-canh: lùi máy 60 cm — sát quá thì thân đang nhoài choán hết khung (three.js 12/11)   # khối: đầu đứng thẳng cao hơn đầu ma-nơ-canh đang nhoài   # cận mặt chú đang NHOÀI (chong_ban): đầu thấp + ra trước so với lúc đứng thẳng   # máy lia theo nhóc chạy lên tiệm (video thô 12/11: cuối shot nhóc ra khỏi khung)   # sân ga chừa khe 40 cm trước thành tàu (mép x = -60) — máy đứng trong khe
# #13 CẬN PHẢN ỨNG chốt cảnh (anh 12/11/2026 "đoạn cuối cần shot mặt gần của Chú để rõ cảm xúc" — ngành: close-up reaction shot, kiểu hài double take /
# slow burn, chốt cảnh = button): nối hướng nhìn từ cuối #12 (nhìn theo nhóc) → cúi nhìn nắm tiền thừa → ngẩng lên nhìn lại, mặt đứng hình; máy đẩy chậm vào mặt
M['tay_chu'] = [CHU[0] + 30, CHU[1] - 6, CHU[2] + 125]   # nắm tiền đưa lên ngang ngực
may['13'] = {'dat': [40, 600, 222], 'nhin': [-125, 505, 212], 'ong_kinh': 35,   # ngắm ngực: bậu cửa lọt mép dưới (xem CAO_NHIN)
               # trước mặt chú đang nhìn theo nhóc về phía bắc (máy cũ phía nam: mặt lệch 98°, cận phản ứng không thấy mặt)
             'khoa_nhin': True, 'khung': ['Chú'],   # khung ôm mặt + nắm tiền khi chú đưa lên nhìn
             'vi_tri': [{'ten': 'Chú', 'tam': CHU, 'huong': 170, 'nhin_ai': 'nhoc_xa', 'nhin_ai_den': 'nhoc_xa',
                         'nhip': [{'u': 0, 'nhin': 'nhoc_xa'}, {'u': 0.33, 'nhin': 'nhoc_xa'}, {'u': 0.45, 'nhin': 'tay_chu'}, {'u': 0.6, 'nhin': 'tay_chu'}, {'u': 0.72, 'nhin': 'nhoc_xa'}],
                         'dien': ['xem@0.3-0.76']},   # gập khuỷu đưa nắm tiền thừa lên trước ngực khi cúi nhìn — khung phải thấy chú nhìn CÁI GÌ
                        {'ten': 'Tiền thừa', 'tam': [CHU[0], CHU[1], CHU[2] + 100], 'cam': 'Chú'},
                        {'ten': 'Tàu xanh', 'tam': [TAU[0], TAU[1] - 15, 0], 'huong': 0}]}
vat += DUONG
# MÔ TẢ ĐỒ cho dòng đồ vật của prompt (số lượng + trạng thái — chặn model vẽ hai chai, tiền to, chai rỗng / đầy)
DO_EN = {'Chai nước ngọt': ['MỘT chai nước ngọt thủy tinh đã uống dở, có ống hút', 'exactly ONE half-drunk glass cola bottle with a straw'],
         'Tờ 5 nghìn': ['MỘT tờ 5 nghìn gấp đôi', 'exactly ONE folded 5,000-dong note'], 'Tiền thừa': ['vài tờ tiền lẻ nhàu', 'a few crumpled small change notes']}
MOC = {k: (v if len(v) == 3 else [v[0], v[1], 110]) for k, v in M.items()}   # mốc nhìn (cm, tầm mắt người đứng sân ga) cho trang three.js
MOC['Chú'] = [CHU[0] + 25, CHU[1], CHU[2] + 150]   # chú vắng khung (#4 #8) vẫn là đích nhìn: mặt chú ở ô cửa
print(json.dumps({'may_so_do': C['may'], 'ngoai_troi': True, 'do_en': DO_EN, 'moc': MOC, 'ten_moc': {**C['ten'], 'tay_chu': 'the crumpled change in his own hand', 'dau_ga': 'the near end of the platform'}, 'ten_moc_vi': {'dau_ga': 'đầu sân ga'}, 'ten': 'Sân ga tàu xanh (Tàu nước ngọt)', 'ghi_chu': 'Đơn vị cm, x đông, y bắc, z lên; dựng từ sơ đồ cảnh mau/phim-mau-tau-nuoc-ngot-khong-gian.json bằng scripts/du-lieu/bo-set/tau-nuoc-ngot.py.',
                  'vat': vat, 'vung': {'Sân ga tàu xanh': [100, 900, 0]}, 'khoi': khoi, 'may': may}, ensure_ascii=False, indent=1))
