# LIỀN MẠCH tập 19 (14/10/2026, anh: "bản 3D phải thể hiện được sự liền mạch về chuyển động, vị trí của mọi nhân vật ở các cảnh").
# Nguồn sự thật chỗ đứng: mỗi shot ghi chỗ MỞ (tam) → chỗ KẾT (den) + hướng nhìn (về phía một điểm / nhân vật) cho từng món; shot sau mở
# đúng chỗ lần cuối thấy món đó kết (bo-set-3d.ts › lienMachTap kiểm bằng số). Chạy: python3 tango-lien-mach.py → ghi vào tango-ban.json.
# Đường đi theo hồ sơ: Mouse Landing → khe giữa hai màn hình → Cable Jungle → trượt dọc cáp trắng (vắt qua loa) → thẻ cam cạnh đế cắm USB.
import json, math, os
P = os.path.join(os.path.dirname(__file__), 'tango-ban.json')
S = json.load(open(P, encoding='utf-8'))

def nhin(tu, toi):
    """Hướng mặt (độ) từ điểm tu nhìn về điểm toi: 0 = về phía người ngồi (−y), 90 = sang phải (+x)."""
    return round(math.degrees(math.atan2(toi[0] - tu[0], -(toi[1] - tu[1]))))

CAM = [0, -40]   # về phía máy / người xem
def v(ten, tam, den=None, ve=None, ve_den=None, **k):
    o = {'ten': ten, 'tam': tam}
    if den: o['den'] = den
    if ve is not None: o['huong'] = ve if isinstance(ve, (int, float)) else nhin(tam, ve)
    if ve_den is not None: o['huong_den'] = ve_den if isinstance(ve_den, (int, float)) else nhin(den or tam, ve_den)
    o.update(k); return o

# ── ĐỒ ĐẠC: thẻ cam và đế cắm KHÔNG chồng nhau (trước đây đế cắm nằm trùng khít trên thẻ → Tango "đứng trên thẻ" là đứng trong đế cắm).
# Thẻ cam phía trước, đế cắm ngay sau thẻ; đầu phích cáp trắng nằm trên thẻ sát mép trước đế cắm.
def vat(ten): return next(x for x in S['vat'] if x['ten'] == ten)
vat('Orange Card').update(tam=[57, 51, 0], co=[9, 6, 0.3])
vat('USB Hub').update(tam=[60, 56.5, 0], co=[10, 4.5, 1.3])
vat('Cable Plug').update(tam=[54.3, 52.6, 0.3])
vat('White Cable')['diem'] = [[36, 55, 0.3], [46, 47, 0.3], [51, 48, 0.3], [54.3, 50.6, 0.5]]
# Cáp trắng để trượt: vắt qua nóc loa đen (-8,76), dốc xuống ngay chỗ hai bạn (6,70), chạy ra khỏi rừng cáp tới cạnh đế cắm.
vat('Cable Jungle 2')['diem'] = [[-50, 66, 0.3], [-25, 64, 0.3], [-14, 73, 6], [-8, 76, 10.4], [-1, 72, 5.5], [6, 69, 2.4], [12, 66.5, 0.8], [20, 64, 0.3], [30, 61, 0.3], [46, 57.5, 0.3], [54, 56, 0.5]]
# Cáp trắng thứ hai lùi ra sau (trước đây chạy xuyên chỗ Tango đứng ở cảnh 4–6, lẫn với cáp trượt).
vat('Cable Jungle 4')['diem'] = [[-30, 58, 0.3], [-12, 76, 0.3], [4, 79, 0.3], [22, 80, 0.3], [30, 96, 0.3]]
# Hàng máy phía sau (Back Monitor, Silver iMac trên kệ nâng) úp mặt màn hình vào lưng hai máy phía trước (anh 14/10/2026) → bỏ cả hai + kệ;
# thay bằng MỘT MacBook Pro mở nắp ở giữa phía sau, màn hình quay ra trước. MacBook là đồ TUỲ CHỌN (tuy_chon): mặc định vắng, shot nào có
# thì khai may_3d.them = ['MacBook Pro'] — "lúc đặt, lúc không có".
S['vat'] = [x for x in S['vat'] if x['ten'] not in ('Back Monitor', 'Silver iMac', 'Kệ nâng sau')]
# BÀN ĐẶT GIỮA PHÒNG (anh 14/10/2026: "thực tế bàn đó đặt giữa phòng chứ không sát tường"): bỏ bức tường sát lưng bàn; dựng sàn (mặt bàn cao
# 75 cm), bốn chân bàn, bốn bức tường xa (phòng 5 × 5 m, bàn ở giữa), tường trước có ô cửa sổ tầng ba — đúng cú bay qua cửa sổ vào bàn ở 0.4.
BAN_T = [0, 62]   # tâm mặt bàn (x, y); mặt bàn 170 × 124
PHONG = [{'ten': 'Sàn phòng', 'nen': True, 'hinh': 'hop', 'tam': [0, 62, -76], 'co': [500, 500, 1], 'mau': '#4a3b30'}]
for i, (dx, dy) in enumerate([(-80, -56), (80, -56), (-80, 56), (80, 56)]):
    PHONG.append({'ten': f'Chân bàn {i + 1}', 'nen': True, 'hinh': 'hop', 'tam': [BAN_T[0] + dx, BAN_T[1] + dy, -75], 'co': [5, 5, 72], 'mau': '#5a3f28'})
PHONG += [
    {'ten': 'Tường sau', 'nen': True, 'hinh': 'hop', 'tam': [0, 312, -75], 'co': [500, 2, 270], 'mau': '#3a3c46'},
    {'ten': 'Tường trái', 'nen': True, 'hinh': 'hop', 'tam': [-250, 62, -75], 'co': [2, 500, 270], 'mau': '#3a3c46'},
    {'ten': 'Tường phải', 'nen': True, 'hinh': 'hop', 'tam': [250, 62, -75], 'co': [2, 500, 270], 'mau': '#3a3c46'},
    # Tường trước (phía người ngồi) có ô cửa sổ 120 × 100 cm, bậu cách sàn 100 cm, thẳng trước bàn: ghép bốn mảng quanh lỗ cửa.
    {'ten': 'Tường trước 1', 'nen': True, 'hinh': 'hop', 'tam': [-155, -188, -75], 'co': [190, 2, 270], 'mau': '#3a3c46'},
    {'ten': 'Tường trước 2', 'nen': True, 'hinh': 'hop', 'tam': [155, -188, -75], 'co': [190, 2, 270], 'mau': '#3a3c46'},
    {'ten': 'Tường trước 3', 'nen': True, 'hinh': 'hop', 'tam': [0, -188, -75], 'co': [120, 2, 100], 'mau': '#3a3c46'},
    {'ten': 'Tường trước 4', 'nen': True, 'hinh': 'hop', 'tam': [0, -188, 125], 'co': [120, 2, 70], 'mau': '#3a3c46'},
    {'ten': 'Khung cửa sổ', 'nen': True, 'hinh': 'hop', 'tam': [0, -188, 25], 'co': [124, 4, 2], 'mau': '#8a7a66'},
]
# Gỡ ĐÚNG mọi món phòng này tự thêm ở lần chạy trước rồi mới thêm lại — chạy lại bao nhiêu lần cũng ra một bộ (trước đây sót 'Khung cửa sổ': 16 khung chồng nhau).
S['vat'] = PHONG + [x for x in S['vat'] if x['ten'] not in {p['ten'] for p in PHONG}]
# Tên tiếng Anh gửi mô hình ảnh (danh sách khối trong prompt keyframe): tên tiếng Việt như 'Tường phải' model không hiểu là bức tường.
for x in S['vat']:
    if x['ten'].startswith('Tường') or x['ten'] == 'Khung cửa sổ': x['en'] = 'far plain room wall' if x['ten'] != 'Khung cửa sổ' else 'window frame on the far wall'
    elif x['ten'] == 'Sàn phòng': x['en'] = 'room floor far below the desk'
    elif x['ten'].startswith('Chân bàn'): x['en'] = 'desk leg'
    elif x['ten'] == 'Mặt bàn': x['en'] = 'wooden desk top'
vat('Mặt bàn')['nen'] = True
vat('Cable Jungle 3')['diem'] = [[-40, 96, 0.3], [-38, 90, 0.3], [-10, 80, 0.3], [15, 86, 0.3], [36, 92, 0.3], [34, 97, 0.3]]
# Nắp nghiêng ra sau 15°: bản lề ở mép sau thân máy (y = +11, z = 1.5); tâm nắp = bản lề + 10·(0, sin15°, cos15°); khối ghi z ĐÁY = tâm − nửa cao.
S['vat'] = [x for x in S['vat'] if x['ten'] != 'MacBook Pro'] + [{'ten': 'MacBook Pro', 'tuy_chon': True, 'anchor': 'MacBook Pro', 'goc': [0, 100], 'xoay': 0, 'phan': [
    {'hinh': 'hop', 'tam': [0, 0, 0], 'co': [31, 22, 1.5], 'mau': '#c7c9ce'},
    {'hinh': 'hop', 'tam': [0, -2, 1.5], 'co': [26, 10, 0.1], 'mau': '#2a2a2e'},
    {'hinh': 'hop', 'tam': [0, -8, 1.5], 'co': [11, 6.5, 0.05], 'mau': '#b8bac0'},
    {'hinh': 'hop', 'tam': [0, 13.59, 1.16], 'co': [31, 0.6, 20], 'mau': '#c7c9ce', 'nghieng': -15},
    {'hinh': 'hop', 'tam': [0, 13.2, 2.51], 'co': [28.5, 0.2, 17.5], 'mau': '#5b7fb8', 'sang': 1, 'nghieng': -15}]}]

# ── KHỐI CHI TIẾT: nhân vật có mắt (khung xám cho thấy nhìn đi đâu), đạo cụ có hình (kẹo hình gấu, bình xịt có vòi, bàn tay có ngón).
K = S['khoi']
K['Tango'] = {'hinh': 'trung', 'co': [2, 1.6, 2.6], 'mau': '#f08a3c', 'mat': True, 'phan': [
    {'hinh': 'hop', 'co': [0.18, 0.18, 0.9], 'mau': '#f08a3c', 'tam': [0.1, 0, 2.45], 'xoay': 15},
    {'hinh': 'cau', 'co': [0.6, 0.6, 0.6], 'mau': '#f08a3c', 'tam': [-1.1, 0, 0.9]}, {'hinh': 'cau', 'co': [0.6, 0.6, 0.6], 'mau': '#f08a3c', 'tam': [1.1, 0, 0.9]}]}
K['Lint'] = {'hinh': 'cau', 'co': [2.2, 2.2, 2], 'mau': '#9a9aa0', 'mat': True, 'phan': [
    {'hinh': 'hop', 'co': [1.6, 0.12, 0.12], 'mau': '#3b82f6', 'tam': [0, -1.0, 0.5]}]}
K['Mr. Wipe'] = {'hinh': 'hop', 'co': [7, 1.2, 8], 'mau': '#7f93a6', 'mat': True, 'phan': [
    {'hinh': 'hop', 'co': [2.4, 1.0, 2.4], 'mau': '#6b7f92', 'tam': [-2.6, 0, -1.2], 'xoay': 0}]}
K['Cordy'] = {'hinh': 'cau', 'co': [1, 1, 1], 'mau': '#4fc3ff', 'mat': True, 'sang': 3}
K['Gummy Bear'] = {'hinh': 'trung', 'co': [1.3, 0.9, 1.2], 'mau': '#d0202a', 'phan': [
    {'hinh': 'cau', 'co': [1.0, 0.8, 0.9], 'mau': '#d0202a', 'tam': [0, 0, 1.05]},
    {'hinh': 'cau', 'co': [0.35, 0.3, 0.35], 'mau': '#d0202a', 'tam': [-0.35, 0, 1.8]}, {'hinh': 'cau', 'co': [0.35, 0.3, 0.35], 'mau': '#d0202a', 'tam': [0.35, 0, 1.8]}]}
K['Blue Spray Bottle'] = {'hinh': 'hop', 'co': [3, 3, 5.5], 'mau': '#3b7bd8', 'phan': [
    {'hinh': 'hop', 'co': [1.4, 1.4, 1.2], 'mau': '#f2f2f2', 'tam': [0, 0, 5.5]}, {'hinh': 'hop', 'co': [1.6, 2.6, 1.3], 'mau': '#f2f2f2', 'tam': [0, -0.6, 6.7]},
    {'hinh': 'hop', 'co': [0.5, 1.2, 1.6], 'mau': '#f2f2f2', 'tam': [0, -0.3, 5.3]}]}
# Bàn tay Gã khổng lồ: lòng bàn tay + cẳng tay + ngón trỏ duỗi + các ngón co + ngón cái; ngón trỏ chỉ về −y cục bộ (quay theo huong).
K['The Giant'] = {'hinh': 'hop', 'co': [8, 10, 3.2], 'mau': '#c99a7a', 'phan': [
    {'hinh': 'hop', 'co': [7, 14, 4.2], 'mau': '#c99a7a', 'tam': [0, 12, 0.2]},
    {'hinh': 'hop', 'co': [1.7, 6.5, 1.7], 'mau': '#c99a7a', 'tam': [-2.6, -8, 0]},
    {'hinh': 'hop', 'co': [5, 3, 2.2], 'mau': '#bf8f6e', 'tam': [1.2, -6.2, 0]},
    {'hinh': 'hop', 'co': [1.9, 4.2, 1.7], 'mau': '#c99a7a', 'tam': [4.6, -3.2, 0.4], 'xoay': 30}]}

# KHUNG MÀU: chất liệu nhân vật (mo_hinh) + vật của set (chat) — Blender dựng hình thật bằng code (0đ): đất sét, lông, vải, kẹo, bông.
K['Tango']['mo_hinh'] = 'dat_set'; K['Tango']['phan'][0] = {'hinh': 'xoan', 'co': [0.7, 0.7, 1.1], 'ban_kinh': 0.09, 'vong': 2.5, 'mau': '#f08a3c', 'tam': [0.1, 0, 2.4], 'chat': 'dat_set'}
for p_ in K['Tango']['phan'][1:]: p_['chat'] = 'dat_set'
K['Lint']['mo_hinh'] = 'long'; K['Mr. Wipe']['mo_hinh'] = 'vai'; K['Mr. Wipe']['phan'] = []   # khối hộp 'nếp góc vải' bị model vẽ thành hộp thiết bị (thử #23 khung màu)
K['Gummy Bear']['mo_hinh'] = 'keo'
for p_ in K['Gummy Bear']['phan']: p_['chat'] = 'keo'
K['Cotton Ball']['mo_hinh'] = 'bong'
# ── KHỐI NHẬN RA ĐƯỢC DÁNG (15/10/2026, anh: "các khối mô hình nhân vật đang sơ sài nên AI ảnh và video dễ làm sai tư thế, nhận dạng, kích thước"):
# dựng theo ảnh mẫu từng nhân vật — silhouette phải đọc ra là ai ngay trên khung màu (Mr. Wipe trước đây là tấm hộp → #35 vẽ sai; Gummy là chồng
# quả cầu; Lint lẫn cục bông). Toạ độ phần tương đối ĐÁY GIỮA thân, quay theo hướng nhân vật; nằm thì cả người xoay theo (dung-set.py › nam_xuong).
DS = 'dat_set'
K['Tango']['phan'] = [K['Tango']['phan'][0],   # tóc xoắn lò xo
    {'hinh': 'trung', 'co': [0.45, 0.45, 0.95], 'mau': '#f08a3c', 'tam': [-1.02, -0.05, 0.5], 'chat': DS},   # hai tay ngắn buông hai bên
    {'hinh': 'trung', 'co': [0.45, 0.45, 0.95], 'mau': '#f08a3c', 'tam': [1.02, -0.05, 0.5], 'chat': DS},
    {'hinh': 'trung', 'co': [0.62, 0.85, 0.34], 'mau': '#e07c30', 'tam': [-0.42, -0.25, -0.06], 'chat': DS},   # hai bàn chân tròn chìa ra trước
    {'hinh': 'trung', 'co': [0.62, 0.85, 0.34], 'mau': '#e07c30', 'tam': [0.42, -0.25, -0.06], 'chat': DS}]
K['Lint']['phan'] = [
    {'hinh': 'hop', 'co': [0.08, 0.08, 0.75], 'mau': '#2f7fe8', 'tam': [0.12, 0.1, 1.82], 'nghieng': -14},   # túm chỉ xanh dựng trên đỉnh (dấu nhận diện)
    {'hinh': 'trung', 'co': [0.32, 0.32, 0.42], 'mau': '#5f5f66', 'tam': [-0.42, -0.25, -0.18]},   # hai chân lông nhỏ
    {'hinh': 'trung', 'co': [0.32, 0.32, 0.42], 'mau': '#5f5f66', 'tam': [0.42, -0.25, -0.18]}]
# Mr. Wipe = khăn lau trùm như con ma: thân nón rủ loe đáy, đầu tròn, hai mắt trên đầu (không dùng `mat`: mắt tự gắn
# lên mặt cầu đầu, không lơ lửng trước thân nón).
K['Mr. Wipe'].update({'hinh': 'khan', 'co': [6.6, 3.8, 6.8], 'mat': False})   # tấm khăn rủ dựng bằng lưới riêng (dung-set.py › khan_diem): đầu tròn, loe, 4 góc thõng
K['Mr. Wipe'].pop('dinh', None)
K['Mr. Wipe']['phan'] = [   # hai mắt nút áo trên mặt trước phần đầu (t = 0,2 → cao 5,4 cm, mặt trước lùi 1,57 cm)
    {'hinh': 'cau', 'co': [0.75, 0.4, 0.75], 'mau': '#f4f4f4', 'tam': [-0.62, -1.45, 5.07]}, {'hinh': 'cau', 'co': [0.75, 0.4, 0.75], 'mau': '#f4f4f4', 'tam': [0.62, -1.45, 5.07]},
    {'hinh': 'cau', 'co': [0.36, 0.2, 0.36], 'mau': '#111111', 'tam': [-0.6, -1.64, 5.2]}, {'hinh': 'cau', 'co': [0.36, 0.2, 0.36], 'mau': '#111111', 'tam': [0.6, -1.64, 5.2]}]
# Bàn tay Gã khổng lồ = bàn tay người thật (keyframe #5 / #6: tay người, tay áo len xanh): lòng bàn tay dẹt, ngón trỏ duỗi 3 đốt chỉ về −y,
# ba ngón co dưới lòng, ngón cái chếch, cẳng tay + tay áo len. Trước đây 5 khối hộp → khung màu đọc ra "mấy viên gạch hồng".
_da, _len = '#d9a582', '#2f4f8f'
K['The Giant'] = {'hinh': 'trung', 'co': [7.6, 9.0, 2.8], 'mau': _da, 'phan': [
    {'hinh': 'trung', 'co': [6.4, 15, 5.0], 'mau': _da, 'tam': [0.3, 11.5, 0.1]},                       # cẳng tay
    {'hinh': 'trung', 'co': [8.6, 13, 7.0], 'mau': _len, 'tam': [0.4, 21.5, -0.6], 'chat': 'vai'},      # tay áo len
    {'hinh': 'trung', 'co': [1.65, 7.0, 1.55], 'mau': _da, 'tam': [-2.55, -7.2, 0.5]},                  # ngón trỏ duỗi: một khối liền (ba đốt rời trông như xúc xích)
    {'hinh': 'trung', 'co': [1.9, 2.2, 1.9], 'mau': _da, 'tam': [-2.45, -4.4, 0.45]},                   # khớp gốc ngón trỏ
    {'hinh': 'trung', 'co': [1.7, 2.6, 2.0], 'mau': _da, 'tam': [-0.6, -4.9, 0.1]},                     # ngón giữa co
    {'hinh': 'trung', 'co': [1.6, 2.4, 1.9], 'mau': _da, 'tam': [1.1, -4.6, 0.1]},                      # ngón áp út co
    {'hinh': 'trung', 'co': [1.4, 2.1, 1.7], 'mau': _da, 'tam': [2.7, -4.0, 0.2]},                      # ngón út co
    {'hinh': 'trung', 'co': [1.8, 4.2, 1.7], 'mau': _da, 'tam': [4.3, -2.0, 0.6], 'xoay': 35}]}         # ngón cái
# Bình xịt: chai tròn hơi thon, vai + cổ, đầu bóp trắng có vòi chĩa −y, cò bóp (ảnh mẫu: chai xanh trong, đầu bóp trắng).
K['Blue Spray Bottle'] = {'hinh': 'non', 'co': [3.0, 3.0, 4.4], 'dinh': 0.9, 'mau': '#3b7bd8', 'phan': [
    {'hinh': 'cau', 'co': [2.7, 2.7, 1.2], 'mau': '#3b7bd8', 'tam': [0, 0, 3.8]},                       # vai chai
    {'hinh': 'non', 'co': [1.2, 1.2, 0.9], 'dinh': 0.9, 'mau': '#f2f2f2', 'tam': [0, 0, 4.7]},          # cổ / nắp vặn
    {'hinh': 'hop', 'co': [1.3, 2.9, 1.2], 'mau': '#f2f2f2', 'tam': [0, -0.55, 5.5]},                   # đầu bóp
    {'hinh': 'non', 'co': [0.55, 0.55, 0.7], 'dinh': 0.6, 'mau': '#f2f2f2', 'tam': [0, -2.05, 5.75], 'nghieng': 90},   # vòi phun
    {'hinh': 'hop', 'co': [0.45, 0.55, 1.6], 'mau': '#f2f2f2', 'tam': [0, -1.55, 4.15], 'nghieng': 12}]}               # cò bóp
# Kẹo dẻo hình GẤU: thân, đầu, hai tai, hai tay, hai chân (trước đây chồng ba quả cầu → model vẽ người tuyết đỏ).
K['Gummy Bear'].update({'hinh': 'trung', 'co': [0.9, 0.65, 0.75]})
K['Gummy Bear']['phan'] = [{'hinh': 'cau', 'co': [0.75, 0.6, 0.62], 'mau': '#d0202a', 'tam': [0, 0, 0.62], 'chat': 'keo'},
    {'hinh': 'cau', 'co': [0.26, 0.2, 0.26], 'mau': '#d0202a', 'tam': [-0.27, 0, 1.12], 'chat': 'keo'}, {'hinh': 'cau', 'co': [0.26, 0.2, 0.26], 'mau': '#d0202a', 'tam': [0.27, 0, 1.12], 'chat': 'keo'},
    {'hinh': 'trung', 'co': [0.24, 0.24, 0.42], 'mau': '#d0202a', 'tam': [-0.48, -0.05, 0.25], 'chat': 'keo'}, {'hinh': 'trung', 'co': [0.24, 0.24, 0.42], 'mau': '#d0202a', 'tam': [0.48, -0.05, 0.25], 'chat': 'keo'},
    {'hinh': 'trung', 'co': [0.3, 0.36, 0.28], 'mau': '#d0202a', 'tam': [-0.24, -0.12, -0.04], 'chat': 'keo'}, {'hinh': 'trung', 'co': [0.3, 0.36, 0.28], 'mau': '#d0202a', 'tam': [0.24, -0.12, -0.04], 'chat': 'keo'}]
# Cục bông: lổn nhổn nhiều cụm, KHÔNG mắt, trắng ngà — khác Lint (xám, mắt, túm chỉ xanh).
K['Cotton Ball']['mau'] = '#f3efe4'
K['Cotton Ball']['phan'] = [{'hinh': 'cau', 'co': [1.5, 1.3, 1.2], 'mau': '#f3efe4', 'tam': t, 'chat': 'bong'} for t in ([-0.85, 0.2, 0.45], [0.85, -0.3, 0.6], [0.15, 0.55, 1.2], [-0.2, -0.6, 1.0])]
# Cordy = đầu phích cáp trắng có mặt (ảnh mẫu), dây cuộn bên dưới; trước đây quả cầu xanh phát sáng 1 cm.
K['Cordy'] = {'hinh': 'hop', 'co': [0.75, 0.45, 1.05], 'mau': '#f2f2f2', 'mat': True, 'phan': [
    {'hinh': 'hop', 'co': [0.77, 0.47, 0.22], 'mau': '#1a1a1a', 'tam': [0, 0, -0.02]},
    {'hinh': 'hop', 'co': [0.42, 0.16, 0.5], 'mau': '#c9c9c9', 'tam': [0, 0, 1.05], 'chat': 'kim_loai'},
    {'hinh': 'trung', 'co': [1.3, 1.3, 0.25], 'mau': '#f2f2f2', 'tam': [0, 0.3, -0.25]}]}
# Sticky: tờ note vàng có góc gấp vểnh (dấu nhận diện khi nằm dẹt trên bàn).
K['Sticky']['phan'] = [{'hinh': 'hop', 'co': [1.1, 1.1, 0.05], 'mau': '#f6d04d', 'tam': [1.05, 1.05, 0.25], 'xoay': 45, 'nghieng': 35}]
CHAT = {'Mặt bàn': 'go', 'Chân bàn 1': 'go', 'Chân bàn 2': 'go', 'Chân bàn 3': 'go', 'Chân bàn 4': 'go', 'White Keyboard': 'nhua', 'Magic Mouse': 'nhua',
        'Left Monitor': 'kim_loai', 'Yellow iMac': 'nhua', 'USB Hub': 'kim_loai', 'Cable Plug': 'kim_loai', 'MacBook Pro': 'kim_loai', 'Desk Lamp': 'kim_loai',
        'White Cable': 'cao_su', 'Cable Jungle 1': 'cao_su', 'Cable Jungle 2': 'cao_su', 'Cable Jungle 3': 'cao_su', 'Cable Jungle 4': 'cao_su', 'Lamp Cord': 'cao_su',
        'Black Speaker': 'nhua', 'Coffee Mug': 'nhua', 'Clay Tub': 'nhua'}
for x in S['vat']:
    if x['ten'] in CHAT: x['chat'] = CHAT[x['ten']]

TANGO, LINT, GUMMY, STICKY, CBALL, WIPE, SPRAY, HAND, CORDY = 'Tango', 'Lint', 'Gummy Bear', 'Sticky', 'Cotton Ball', 'Mr. Wipe', 'Blue Spray Bottle', 'The Giant', 'Cordy'
GAP = [0, 50]          # khe giữa hai màn hình (Between the Screens)
SW = [46, 13, 1.4]     # công tắc đèn
G0 = [29, 23, 0]       # kẹo đặt cạnh chuột
NEP = [19.5, 25, 0]    # Tango nấp sau chuột
# Cảnh 4–6 (rừng cáp): chỗ của từng đứa
T4, L4, C4, K4 = [3, 70.5, 0], [8, 72, 0], [10, 73.5, 0], [6, 72, 0]
# Cảnh 7 (thẻ cam cạnh đế cắm)
T7, L7, KEO7, ST7 = [56, 51, 0.3], [57.6, 52.4, 0.3], [59.5, 49.8, 0.3], [60.6, 48.4, 0.05]
T7N, L7N = [51.6, 50.4, 0], [51.2, 52.2, 0]   # chỗ hai đứa nấp ở mép trái thẻ khi Mr. Wipe tới
PLUG = [54.3, 52.6, 0.8]
DAU_TAY = [55.8, 54.3, 0.8]
# SỔ TRẠNG THÁI (script supervisor): trạng thái cơ thể khai từng shot (trang / trang_den), cổng lienMachTap chặn shot quên — trạng thái không tự đổi qua cú cắt.
XU = 'frizzed STIFF by static electricity: every fibre standing on end, cloth rigid and puffed up, not limp'
MAY7 = [62, 46.5]   # chỗ máy chủ cảnh 7 (đông nam): Tango quay về đây ở khung kết #32 / mở #33 — mặt thấy ở shot phản ứng, hai shot nối hướng   # chỗ in dấu tay: mặt trước đế cắm, ngay sau đầu phích
# NHÌN NHAU CÓ CHEAT (15/10/2026): Tango (T7N) và Lint (L7N) đứng bắc–nam — nhìn thẳng nhau thì máy phía máy chủ (đông nam) chỉ thấy gáy Tango.
# Mọi lúc hai bạn nhìn nhau ở cảnh 7 dùng chung cặp hướng xoay về máy chủ (cổng mạch chặn hướng quay ngoắt qua cú cắt nếu chỗ này cheat chỗ kia không).
T_NHIN_L, L_NHIN_T = 125, 45
MAU_GIAY = [53, 50.5, 0.3]    # mẩu giấy vàng rách kẹt ở mép trái thẻ cam (manh mối kẻ trộm)

VT = {
 # Tay với từ BÊN PHẢI (ngón trỏ chỉ −x, huong −90): đầu ngón chạm đỉnh kẹo / đỉnh công tắc, cẳng tay nằm sau công tắc nhìn từ máy — không che chủ thể.
 '1.1': [v(TANGO, NEP, ve=G0, an=True), v(GUMMY, G0), v(HAND, [40.3, 20.4, 2.0], [46, 24, 12], ve=-90)],
 '1.2': [v(TANGO, NEP, ve=G0, an=True), v(HAND, [57.5, 14.4, 1.5], ve=-70, nhay='tay nhấc khỏi khung rồi với sang bấm công tắc')],
 '2.1': [v(TANGO, NEP, [22.5, 23.8, 1.0], ve=G0, ve_den=G0, an=True), v(GUMMY, G0)],
 '2.2': [v(TANGO, [22.5, 23.8, 1.0], [30.3, 26.6, 0.6], ve=G0), v(GUMMY, G0, [35, 27, 1.5])],
 '2.3': [v(TANGO, [30.5, 26.8, 0], ve=[35, 27], ve_den=GAP, nam=True), v(GUMMY, [35, 27, 1.5], [26, 33, 0.5])],
 '2.4': [v(STICKY, [16.8, 13.0, 0.05], ve=[30.5, 26.8]), v(TANGO, [30.5, 26.8, 0], [21, 34, 0], ve=GAP, nam=True), v(GUMMY, [26, 33, 0.5], [14, 41, 0.5])],
 '3.1': [v(TANGO, [1.5, 44, 0], [1.5, 56, 0], ve=[1.5, 80], nam=True), v(GUMMY, [1.5, 52, 0.3], [1.5, 63, 0.3])],
 '4.1': [v(TANGO, [-4, 68, 0], [-1, 70, 0], ve=K4, nam=True), v(GUMMY, K4)],
 '4.2': [v(TANGO, [-1, 70, 0], T4, ve=K4), v(GUMMY, K4), v(LINT, [8.5, 72, 0], [8, 72, 0], ve=K4)],
 '4.3': [v(TANGO, T4, [2, 70, 0], ve=L4, nam=True), v(LINT, L4, ve=T4), v(CBALL, C4)],
 '4.5': [v(LINT, L4, ve=K4), v(CBALL, C4), v(GUMMY, K4)],
 '4.5a': [v(TANGO, T4, ve=L4), v(GUMMY, [4, 70.6, 0.8], cam=TANGO), v(LINT, L4, ve=T4)],
 '4.6': [v(GUMMY, [4, 70.8, 0.8], cam=TANGO), v(TANGO, T4, ve=L4, an=True), v(LINT, L4, ve=T4, an=True)],
 '4.7': [v(TANGO, T4, ve=75), v(LINT, L4, [7, 71.6, 0], ve=-45), v(CBALL, C4), v(GUMMY, [5, 71, 0.5], cam=TANGO)],
 '5.1': [v(WIPE, [24.5, 84, 11], [22, 82, 10.5], ve=[5, 71], an=True), v(TANGO, T4, ve=[7, 71.6]), v(LINT, [7, 71.6, 0], ve=T4)],
 '5.2': [v(WIPE, [22, 82, 10.5], [14, 78, 9], ve=[7, 71.6]), v(LINT, [7, 71.6, 0], ve=T4), v(SPRAY, [23.5, 80.5, 8.5], cam=WIPE)],
 '5.3': [v(TANGO, T4, ve=[7, 71.6], ve_den=[14, 78]), v(LINT, [7, 71.6, 0], ve=T4, ve_den=[14, 78]), v(SPRAY, [11, 77, 13], cam=WIPE, an=True)],
 '5.4': [v(TANGO, T4, [4, 69.5, 0], ve=[8, 74], ve_den=[8, 74]), v(LINT, [7, 71.6, 0], ve=[8, 74]), v(WIPE, [14, 78, 9], [8, 74, 4], ve=[4, 69.5]), v(SPRAY, [10, 74.5, 5], cam=WIPE)],
 '5.5': [v(LINT, [7, 71.6, 0], [7.5, 72.5, 4.5], ve=[8.5, 74.5]), v(TANGO, [4, 69.5, 0], [6.4, 71.2, 0], ve=[7, 72]), v(WIPE, [8, 74, 4], [8.5, 74.5, 6], ve=[7, 72]), v(CBALL, C4)],
 # 5.6 kết: Tango bẹp dí (nam_den), ngửa mặt về phía máy — chữ trạng thái kết đòi thấy đôi mắt trượt sang một bên.
 '5.6': [v(TANGO, [6.4, 71.2, 0], [6, 70.5, 0], ve=[9, 73], ve_den=[3.7, 68.4], nam_den=True), v(SPRAY, [9, 73, 4], cam=WIPE), v(WIPE, [8.5, 74.5, 6], ve=[6, 71], an=True)],
 '5.7': [v(TANGO, [6, 70.5, 0], ve=[7.5, 72.5], nam=True)],
 '6.1': [v(TANGO, [6, 70.5, 0], ve=[7.5, 72.5], ve_den=[6, 69], nam=True), v(LINT, [7.5, 72.5, 4.5], [8, 73, 5], ve=[8.5, 74.5]), v(WIPE, [8.5, 74.5, 6], ve=[8, 73])],
 '6.2': [v(TANGO, [6, 70.5, 0], [7, 68.6, 2.3], ve=[6, 69], ve_den=[20, 64]), v(LINT, [8, 73, 5], [7, 68.9, 3.3], ve=[8.5, 74.5], ve_den=[20, 64]),
         v(WIPE, [8.5, 74.5, 6], [10, 74, 7], ve=[8, 73], ve_den=[7, 68.9]), v(CBALL, [7.4, 69.2, 3.6], cam=LINT)],
 '6.3': [v(TANGO, [7, 68.6, 2.3], [55.4, 50.9, 0.3], ve=[20, 64], ve_den=[60, 50]), v(LINT, [7, 68.9, 3.3], [55.6, 51.6, 0.6], ve=[20, 64]),
         v(WIPE, [10, 74, 7], [20, 67, 3], ve=[7, 68.6], ve_den=[20, 64])],
 # 7.1 → 7.1a → 7.1b → 7.2: chuỗi chú ý NHÌN → THẤY → LÀM (bo-set-3d.ts › chuoiChuY). Tango đặt kẹo xong vẫn nhìn kẹo; tiếng rì rì làm cậu quay đầu
 # về phích (7.1a, mặt Tango là chủ thể); 7.1b là góc nhìn của Tango vào phích; 7.2 mới chạm.
 '7.1': [v(TANGO, [55.4, 50.9, 0.3], T7, ve=[60, 50], ve_den=KEO7), v(LINT, [55.6, 51.6, 0.6], L7, ve=KEO7, ve_den=T7), v(GUMMY, [56.6, 50.6, 1.0], KEO7, cam=TANGO),
         v(STICKY, ST7, an=True, nhay='lẻn theo hai bạn ngoài khung từ cảnh 2, nấp dưới mép thẻ cam')],
 '7.1a': [v(TANGO, T7, ve=KEO7, ve_den=PLUG), v(LINT, L7, ve=T7)],
 '7.1b': [],   # góc nhìn từ mắt Tango: máy đứng trong đầu Tango → không dựng Tango; Lint ngoài khung
 '7.2': [v(TANGO, T7, ve=PLUG, ve_den=MAY7, lam='Cable Plug'), v(LINT, L7, ve=T7)],   # bị giật → quay về máy vẩy tay (mặt thấy ở khung kết)   # Lint vẫn đứng cạnh (7.1a / 7.2a có Lint) — góc ngược thấy Lint sau phích
 # 7.2a: ngón tay → rừng cáp (Mr. Wipe sẽ tới) → KẾT trên mặt đế cắm chỗ sẽ in dấu tay; khung lấy đế cắm làm chủ thể (khán giả thấy cái Tango nhìn).
 '7.2a': [v(TANGO, T7, ve=MAY7, ve_den=DAU_TAY), v(LINT, L7, ve=T7)],   # mở: còn quay về máy nhìn ngón tay (phản ứng thấy mặt) → kết nhìn mặt đế cắm
 '7.3': [v(TANGO, T7, [55.8, 53.4, 0.3], ve=DAU_TAY, ve_den=CAM, lam='USB Hub', lam_o=DAU_TAY), v(LINT, L7, ve=T7, ve_den=[55.8, 53.4])],
 '7.4': [v(WIPE, [58, 61, 5], [57, 55.6, 2.6], ve=[55.8, 54.3], ve_den=DAU_TAY, nhay='gỡ khỏi rừng cáp, bay tới đế cắm ngoài khung'),
         v(TANGO, T7N, ve=[57, 55.6], nhay='chạy nấp sau mép thẻ khi thấy Mr. Wipe tới'), v(LINT, L7N, ve=[57, 55.6], nhay='chạy nấp sau mép thẻ khi thấy Mr. Wipe tới')],
 '7.4a': [],   # góc nhìn từ trên của Mr. Wipe (máy trong khối khăn) — không dựng Mr. Wipe; hai bạn nấp ngoài khung
 '7.5': [v(WIPE, [56.6, 55.2, 1.8], [55, 54.2, 1.2], ve=PLUG, lam='USB Hub', lam_o=DAU_TAY, trang_den=XU)],   # kết: tia điện → xù cứng (sổ trạng thái)
 '7.6': [v(TANGO, T7N, ve=[55.5, 55], ve_den=T_NHIN_L), v(LINT, L7N, ve=[55.5, 55], ve_den=L_NHIN_T), v(WIPE, [55.5, 55, 2], ve=T7N, an=True, trang=XU)],   # Mr. Wipe ngoài khung phải — máy phía trước mặt hai bạn (phản ứng thấy mặt)
 # 7.6a NÚT ĐÓNG chuyện bẫy: Mr. Wipe lủi về rừng cáp, hai bạn đập tay rồi ưỡn ngực về phía máy.
 '7.6a': [v(TANGO, T7N, ve=T_NHIN_L, ve_den=60), v(LINT, L7N, ve=L_NHIN_T, ve_den=60), v(WIPE, [55.5, 55, 2], [42, 62, 7], ve=CAM, ve_den=[30, 66], trang=XU, trang_den=XU + ', trailing a wisp of smoke')],
 # 7.6b mở lại chuyện kẹo: Tango nhìn thẳng về kẹo (máy đứng sau kẹo) rồi bị Lint kéo xoay, KẾT mặt đối mặt — quay đi khỏi kẹo.
 '7.6b': [v(TANGO, T7N, ve=KEO7, ve_den=T_NHIN_L), v(LINT, L7N, ve=60, ve_den=L_NHIN_T)],
 # 7.7: tờ note trùm hai nửa kẹo rồi lẩn ra khỏi khung — cả hai RỜI bộ set (het), không tự đặt lại ở 7.7a / 7.8.
 '7.7': [v(GUMMY, KEO7, [59, 45.5, 0], het=True), v(STICKY, ST7, [59, 45.5, 0.05], het=True), v(TANGO, T7N, ve=T_NHIN_L, an=True), v(LINT, L7N, ve=L_NHIN_T, an=True)],
 # #39 / #42 CHEAT TO CAMERA (15/10/2026, anh xem tờ toàn cảnh): hai bạn đứng bắc–nam nhìn thẳng vào nhau → máy nào cũng chỉ thấy gáy Tango ở shot
 # phản ứng. Như diễn viên thật: vẫn nhìn nhau nhưng xoay về phía máy đông nam (Tango 125°, Lint 45°) — thấy mặt cả hai.
 '7.7a': [v(TANGO, T7N, ve=T_NHIN_L, ve_den=KEO7), v(LINT, L7N, ve=L_NHIN_T, ve_den=KEO7)],
 # 7.7b GIỮ + manh mối: Tango nhón mẩu giấy vàng ở mép thẻ (khán giả vừa thấy thẻ trống ở 7.7a), giơ lên mắt; Lint ghé sát.
 '7.7b': [v(TANGO, T7N, ve=KEO7, ve_den=60, lam='Orange Card', lam_o=MAU_GIAY), v(LINT, L7N, [51.6, 51.8, 0], ve=KEO7, ve_den=[52.3, 50.6])],
 '7.8': [v(TANGO, T7N, ve=KEO7), v(LINT, [51.6, 51.8, 0], ve=KEO7), v(CORDY, [47, 57.6, 0.6], ve=T7N)],
 '8.1': [v(TANGO, [-2, 3, 0], ve=CAM), v(LINT, [2, 3, 0], ve=CAM)],
}
# ĐỒ ĐANG CẦM phải đi theo người cầm qua mọi shot người đó có mặt (cổng lienMachTap › đồ đang cầm; nối thử #22→#24: bình xịt biến mất ở 5.5):
# nửa kẹo trong tay Tango từ 4.7 tới khi đặt lên thẻ ở 7.1; bình xịt trong tay Mr. Wipe từ 5.2 tới hết cảnh 6; cục bông Lint ôm từ 6.2, đặt xuống ở 7.1.
def cam_theo(ma, mon, nguoi, lech, an=True):
    ds = VT[ma]; ng = next(x for x in ds if x['ten'] == nguoi)
    if any(x['ten'] == mon for x in ds): return
    p = [ng['tam'][0] + lech[0], ng['tam'][1] + lech[1], (ng['tam'][2] if len(ng['tam']) > 2 else 0) + lech[2]]
    o = v(mon, p, cam=nguoi)
    if an: o['an'] = True
    ds.append(o)
for ma in ('5.1', '5.3', '5.4', '5.5', '5.6', '5.7', '6.1', '6.2', '6.3'): cam_theo(ma, GUMMY, TANGO, [0.7, -0.5, 0.8])
for ma in ('5.5', '6.1', '6.2', '6.3'): cam_theo(ma, SPRAY, WIPE, [1.5, 0, -1], an=(ma != '5.5'))
cam_theo('6.3', CBALL, LINT, [0.4, 0.3, 0.4])
VT['7.1'].append(v(CBALL, [55.8, 51.8, 1.2], [58.9, 53.3, 0.3], cam=LINT))   # Lint đặt cục bông xuống thẻ cạnh mình
# KẸO ĐÃ BẺ ĐÔI ở 4.6 (kéo giãn tới đứt): từ 4.7 mọi lần kẹo xuất hiện là 2 mảnh — đang cầm thì Blender chỉ dựng mảnh của người cầm, đặt xuống
# (7.1 → thẻ cam) thì dựng hai mảnh cạnh nhau. Cổng lienMachTap chặn shot nào lỡ để kẹo nguyên lại.
def sau_46(ma):
    a, b = ma.split('.', 1); return int(a) > 4 or (int(a) == 4 and b not in ('1', '2', '3', '5', '5a', '6'))
for ma, ds in VT.items():
    if not sau_46(ma): continue
    for x in ds:
        if x['ten'] == GUMMY: x['chia'] = 2
# 5.7 mở đúng hướng 5.6 kết (ngửa về máy), rồi mới ngước nhìn Lint.
for x in VT['5.7']:
    if x['ten'] == TANGO: x['huong'] = nhin(x['tam'], [3.7, 68.4]); x['huong_den'] = nhin(x['tam'], [7.5, 72.5])

NHAY = {  # cú cắt cố ý cắt thời gian / dịch chuyển ngoài khung
 '3.1': 'cắt thời gian: lăn một quãng ngoài khung tới khe giữa hai màn hình',
 '4.1': 'cắt thời gian: hết khe màn hình, lăn vào rừng cáp',
 '8.1': 'phần kết: hai bạn ra mép bàn chào khán giả',
}
# 7.3 máy đặt tay (bộ giải tự động rơi vào góc sau gáy Tango khi cố đưa đế cắm vào khung).
S['may']['7.3'].pop('phia', None); S['may']['7.3'].update(dat=[70, 51, 7], nhin=[58, 53.7, 0.8], ong_kinh=35, khung=[TANGO, 'USB Hub'])   # #34: máy phía đông, xoay 55° quanh Tango so với #33 (luật 30°), nhìn 155°   # chủ thể: tay Tango trên mặt đế cắm (phích lúc mở bị Tango đi ngang che là đúng)   # #34 về hướng máy chủ (đông nam): trước đây trước-trái lệch 92°   # trước-trái: phích trái, Tango phải, đế cắm sau lưng Tango (bố cục viết theo địa lý 3D)
for ma in ('1.1', '1.2'): S['may'][ma]['den_ban'] = True
# Cú cắt chèn CÓ CHỦ Ý đổi hẳn hướng máy: 5.2 cắt lên Mr. Wipe trên cao, 7.5 cận cực sát góc khăn chạm phích — không đặt trục / hướng cho shot sau.
S['may']['5.2']['qua_truc'] = True
for ma in ('7.2', '7.5'): S['may'][ma].pop('qua_truc', None)   # tệp đọc–ghi chính nó: bỏ cờ phải xoá tường minh (#37 sau POV #36 — hai shot qua trục liền nhau)
# 5.4 cùng phía rừng cáp với 5.3 / 5.5 (bên trái, nhìn sang +x), toàn cảnh, cao hơn để thấy Mr. Wipe sà xuống — trước đây bộ giải đặt tận góc sau-trái 50 cm.
# 5.4 đặt tay: trước-trái, cao 12 cm nhìn xuống (qua trên loa + cáp trượt), cùng phía trục Tango–Lint với 5.3 — bộ giải tự động đẩy ra góc sau 60 cm.
S['may']['5.4'].pop('phia', None); S['may']['5.4'].update(dat=[-14, 66, 12], nhin=[6, 72, 3], ong_kinh=24)   # đèn bàn bật tới cú bấm công tắc ở 1.2
# Máy các shot thêm cho chuỗi chú ý / nút đóng / kết (15/10/2026). Góc nhìn chủ quan (POV) đặt tay ở mắt nhân vật + qua_truc.
MOI = {
 # 7.1a qua vai: máy trước-phải (cùng phía 7.1) — Tango mở nhìn kẹo về phía máy, quay đầu về phích đang chớp ở hậu cảnh trái (khán giả thấy cú nhìn + cái được nhìn).
 # 7.1a ĐẶT TAY ngang tầm trước-phải (bộ giải tự động đẩy máy lên cao 59° → keyframe bỏ khung 3D, mất cú quay đầu): mở thấy mặt Tango, kết thấy cậu
 # quay đi về phía phích đang chớp ở hậu cảnh trái.
 '7.1a': {'dat': [61, 47.5, 1.8], 'nhin': [55.8, 51.2, 1.3], 'ong_kinh': 60, 'khung': [TANGO]},   # đông nam ngang tầm: mặt Tango nhìn kẹo, kẹo tiền cảnh, Lint bên cạnh; kết Tango quay lưng về phía phích (phích do 7.1b cho thấy)
 '7.1b': {'dat': [56.4, 50.6, 2.2], 'nhin': [54.3, 52.6, 0.5], 'ong_kinh': 35, 'khung': ['Cable Plug'], 'qua_truc': True},
 '7.4a': {'dat': [56.4, 51.0, 7.0], 'nhin': [57.0, 55.0, 0.8], 'ong_kinh': 20, 'khung': ['USB Hub', 'Cable Plug'], 'qua_truc': True},   # #36: thấp + ống rộng — phích 6% (trước 3.9%), tâm đế cắm trong khung
  # 7.2a đặt tay: trên cao bên phải (cùng hướng 7.2), nhìn qua đầu Lint xuống mặt đế cắm — bộ giải tự động né Lint bằng cách vượt trục; máy phía trước thì iMac vàng chắn.
 # 7.2 ĐẶT TAY (#32): góc ngược (−10°) đúng riêng shot nhưng chen giữa hai shot hướng 136° / 129° — hai cú quay máy ~140° liền nhau, mất dẫn dắt
 # (anh 15/10/2026 so với #11–#15). Về hướng máy chủ cảnh: từ phía máy chủ phích nằm ngay sau Tango → máy QUA VAI TỪ TRÊN CAO (8 cm), phích hiện trên-trái vai Tango; kết Tango quay về máy vẩy tay.
 '7.2': {'dat': [57.4, 48.2, 9.5], 'nhin': [54.4, 52.5, 0.6], 'ong_kinh': 35, 'khung': [TANGO, 'Cable Plug']},
 # 7.6 (#38) phản ứng: máy đông, sau lưng Mr. Wipe (tiền cảnh phải) nhìn về mặt hai bạn — trước đây bộ giải đặt máy đông nam, thấy Tango nghiêng hẳn.
 '7.6': {'dat': [61.5, 52.5, 5.0], 'nhin': [51.0, 51.2, 1.3], 'ong_kinh': 35, 'khung': [TANGO, LINT]},
 '7.2a': {'dat': [63.5, 44, 6.5], 'nhin': [57.6, 54, 1.0], 'ong_kinh': 35},   # cảnh 7: bộ ống 35 / 40 / 60   # #33: hạ từ 14 cm (Tango 1%) xuống 6 cm
 # 7.6b máy sau-trên hai nửa kẹo: kẹo tiền cảnh dưới khung, hai bạn ở giữa nhìn về kẹo (về máy).
 '7.6b': {'dat': [64.5, 52.3, 3.5], 'nhin': [55, 51, 1.2], 'ong_kinh': 35, 'khung': [TANGO, LINT, GUMMY]},   # #40: máy phía đông, xoay ~30° quanh Tango so với #39 (luật 30°); kẹo tiền cảnh trái
 '7.7b': {'dat': [57.2, 48.9, 3.4], 'nhin': [51.6, 50.4, 1.1], 'ong_kinh': 60, 'khung': [TANGO]},   # máy cao hơn cáp trắng (cáp không chắn tiền cảnh)   # #43: CẬN Tango nhón mẩu giấy (two → cu = 2 bậc so với #42), máy hơi cao cho đầu sát mép trên   # #43: máy cũ (bộ giải, ống 85) cắt Lint ở mép → ống 70 cho hai bạn trọn khung
 # #37 khăn quệt vào phích: bộ giải đặt máy cách 29 cm (phích 1.9%) → trước-trái 7 cm như keyframe đã có: Mr. Wipe giữa khung, phích tiền cảnh phải.
 # Tờ toàn cảnh 15/10/2026 (đặt thử trên iMac, đo % thấy từng vật trước khi ghi):
 # #37 cận khăn chạm phích: giữ máy cũ — dí sát hơn thì ống 35 không ôm nổi tâm phích + tâm khăn (cổng chủ thể ngoài khung), ống 24 thành 4 tiêu cự.
 '7.5': {'dat': [60.5, 47.0, 4.5], 'nhin': [55.4, 54.0, 2.4], 'ong_kinh': 35},
 # #8 cú hai người: máy cũ 14 cm trước mặt — Tango / kẹo mỗi bên 1,9%, Tango khuất sau chuột → phía phải, cao 3,5 cm qua đầu chuột.
 '2.2': {'dat': [31, 14, 3.5], 'nhin': [26, 24.5, 1.0], 'ong_kinh': 24},
 # #10 rình (người thứ ba): Tango khuất sau chuột → máy sau lưng tờ note cao 5,5 cm (tia tới Tango lướt trên nóc chuột 2,2 cm, chúc ≤ 15° cho góc sát đất),
 # ống 24 để tờ note vào tiền cảnh dưới khung.
 '2.4': {'dat': [12, 9, 5.5], 'nhin': [28, 30, 0.5], 'ong_kinh': 24},
 # #39 phản ứng sau đập tay: máy đông nam ngang tầm, −28° quanh Tango (cách #38 / #40 trên 30°), hai bạn cheat về đây — trước đây thấy gáy Tango.
 '7.6a': {'dat': [57.8, 47.1, 2.0], 'nhin': [51.4, 51.3, 1.0], 'ong_kinh': 40, 'khung': [TANGO, LINT]},
 # #41 hai nửa kẹo + tờ note: máy cũ 6 cm thấp — kẹo < 1% → sát mép thẻ, ống 60, kẹo giữa khung, thẻ tiền cảnh.
 '7.7': {'dat': [62.5, 46.5, 1.2], 'nhin': [59.8, 48.8, 0.3], 'ong_kinh': 60},
 # #42 thẻ trống: máy cao 4 cm sau thẻ nhìn xuống hai bạn, thẻ trống chiếm tiền cảnh — máy thấp thì phích + đế cắm che Lint, máy trên thẻ thì thẻ ra khỏi khung.
 '7.7a': {'dat': [61, 47.5, 4.0], 'nhin': [54.5, 51.2, 0.5], 'ong_kinh': 35},

}
# Thẻ cam = VÍ DA cam có tấm thẻ xanh nhạt trong ô cửa sổ — đúng ảnh mẫu anchor (khối cam trơn làm keyframe vẽ lúc thẻ nhựa phẳng lúc ví da).
vat('Orange Card').update(chat='cao_su', en='orange leather card holder with a pale blue card showing in its window')
S['vat'] = [x for x in S['vat'] if x['ten'] != 'Card Window'] + [{'ten': 'Card Window', 'nen': True, 'hinh': 'hop', 'tam': [57.4, 50.8, 0.3], 'co': [6.4, 3.6, 0.04], 'mau': '#a9c8e6', 'en': 'pale blue card in the card holder window', 'anchor': 'Orange Card'}]   # anchor: là MỘT PHẦN của ví da (doc-db.ts › anchorCua)
for ma, m in MOI.items():
    if 'dat' in m: S['may'].setdefault(ma, {}).pop('phia', None)
    S['may'].setdefault(ma, {}).update(m)
S['may']['7.2a']['khung'] = [TANGO, 'USB Hub']          # Tango nhìn mặt đế cắm → khung cho thấy mặt đế cắm
S['may']['7.4']['khung'] = [WIPE]   # #35: hai bạn nấp không phải chủ thể — bộ giải không phải lùi máy 31 cm để gom cả Tango (ms thành toàn cảnh, thừa khoảng trên đầu)
S['may']['7.7a']['khung'] = [TANGO, LINT, 'Orange Card']  # thẻ trống là thứ hai bạn (và khán giả) nhìn
# ĐỘNG TÁC DIỄN (bước 2 phim Blender, 16/10/2026): theo đúng mô tả hành động từng shot — thư viện dung-set.py › DONG_TAC, 'ten@a-b' (phần thời lượng).
# Chớp mắt + chúi tới khi đi là tự động. Động tác chưa có trong thư viện (cuộn tròn lăn, kéo giãn kẹo, bẹp thành vũng, nặn xe trượt…) để bước 3.
DIEN = {
 '2.1': {TANGO: ['mat_to@0.2', 'toc_bat@0.3']},                                   # #7 ló lên, sợi tóc bật dựng
 '2.2': {TANGO: ['nhay@0.15-0.6']},                                               # #8 nhảy ôm chầm viên kẹo
 '2.3': {TANGO: ['mat_to@0.5']},                                                  # #9 úp mặt, ngẩng nhìn theo kẹo
 '4.2': {LINT: ['run@0.6-0.75']},                                                 # #13 cục bụi khẽ động đậy
 '4.3': {LINT: ['phong3@0.05-0.3', 'toc_dung@0.05-0.25', 'mat_to@0.05', 'run@0.55-1'], TANGO: ['mat_to@0.08']},   # #14 phồng gấp ba, run
 '4.5': {LINT: ['phong3@0-0.001', 'phong0.34@0.02-0.35', 'mat_to@0.55']},        # #15 xẹp lại từ ×3, mắt hé to nhìn kẹo
 '4.5a': {TANGO: ['toc_ru@0.3-0.55', 'toc_bat@0.75']},                            # #16 tóc rũ… rồi bật lên
 '4.7': {TANGO: ['cuoi_lan@0.75-1'], LINT: ['toc_dung@0.4-0.6', 'cuoi_lan@0.75-1']},   # #18 nhận kẹo, sợi chỉ sáng, hai đứa cười
 '5.2': {WIPE: ['run@0.2-0.45']},                                                 # #20 rùng mình
 '5.3': {TANGO: ['toc_dung@0.4-0.8'], LINT: ['mat_to@0.3']},                      # #21 tóc từ từ dựng lên
 '5.4': {LINT: ['run@0.3-1']},                                                    # #22 Lint sợ sau lưng Tango
 '5.5': {WIPE: ['xoay_tit@0-1'], LINT: ['toc_dung@0.1-0.4', 'run@0.2-1']},       # #23 xoay tít, lông Lint dựng
 '5.6': {TANGO: ['nhay@0-0.4']},                                                  # #24 nhảy lao vào Mr. Wipe
 '5.7': {TANGO: ['mat_to@0.2', 'toc_bat@0.6']},                                   # #25 sợi tóc bật BOING
 '6.3': {WIPE: ['run@0.6-1']},                                                    # #28 vướng vào đám dây
 '7.1a': {TANGO: ['mat_to@0.3']},                                                 # #30 khựng lại, mắt đảo theo tiếng
 '7.2': {TANGO: ['run@0.45-0.6', 'nhun_vai@0.6-0.9']},                            # #32 bị giật, vẩy tay
 '7.2a': {TANGO: ['nheo_mat@0.6-0.85', 'nhun_vai@0.75-1']},                       # #33 cười ranh mãnh, xoa tay
 '7.3': {LINT: ['cuoi_lan@0.6-1']},                                               # #34 Lint ôm bụng cười
 '7.4': {WIPE: ['run@0.6-0.9']},                                                  # #35 rùng mình ghê sợ
 '7.5': {WIPE: ['run@0.7-1']},                                                    # #37 BZZT
 '7.6': {TANGO: ['cuoi_lan@0.3-1'], LINT: ['cuoi_lan@0.3-1']},                    # #38 cười lăn
 '7.6a': {WIPE: ['run@0-1'], TANGO: ['nhay@0.7-0.9'], LINT: ['nhay@0.7-0.9']},    # #39 lảo đảo bay lủi · đập tay
 '7.6b': {TANGO: ['nhay@0.35-0.65'], LINT: ['nhay@0.3-0.6']},                     # #40 nhảy mừng
 '7.7a': {TANGO: ['mat_to@0.1', 'toc_ru@0.3-0.6'], LINT: ['mat_to@0.1']},         # #42 sững sờ, tóc rũ
 '7.7b': {TANGO: ['nheo_mat@0.5-0.8']},                                           # #43 nhíu mắt nhìn mẩu giấy
 '8.1': {TANGO: ['nhun_vai@0.1-0.5'], LINT: ['nhay@0.5-0.7']},                    # #45 nhún vai tiếc kẹo, vỗ vai
}
# DÁNG LIỀN MẠCH (anh 16/10/2026: "#8 đang đứng mà #9 đã nằm"): đứng / nằm đổi TRONG shot (nam_den), không qua cú cắt — cổng lienMachTap kiểm dáng.
def dang(ma, ten, **k):
    for x in VT[ma]:
        if x['ten'] == ten: x.update(k)
dang('2.2', TANGO, nam_den=True)                 # #8 kẹo phụt khỏi vòng tay → Tango ngã xuống gỗ cuối shot (#9 mở đang nằm)
dang('4.1', TANGO, nam_den=False)                # #12 quả bóng cam lăn tới rồi bung ra thành Tango đứng (#13 mở đứng)
dang('4.3', TANGO, nam=False, nam_den=True)      # #14 'Tango ngã ngồi' diễn trong shot: mở đứng, ngã khi Lint phồng
for ma in ('6.2', '6.3'): dang(ma, TANGO, nam=True)   # #27–#28 Tango đã nặn thành xe trượt: thân dẹt nằm
dang('7.1', TANGO, nam=True, nam_den=False)      # #29 xe trượt dừng trên thẻ cam → bung lại thành Tango đứng
DIEN.setdefault('2.2', {}).setdefault(TANGO, []).append('nga@0.6-0.85')
# NẰM KHÔNG TỰ ĐI (anh 16/10/2026: "#10 Tango đang nằm mà vẫn di chuyển được"): khai cách di chuyển — cuộn tròn lăn / trượt.
DIEN.setdefault('2.4', {}).setdefault(TANGO, []).append('lan_tron@0.2-1')   # #10 cuộn tròn thành quả bóng cam lăn theo viên kẹo
DIEN.setdefault('3.1', {}).setdefault(TANGO, []).append('lan_tron')         # #11 quả bóng lăn vèo qua khe màn hình
DIEN.setdefault('4.1', {}).setdefault(TANGO, []).append('lan_tron@0-0.75')  # #12 lăn tới rồi bung ra thành Tango (nam_den False)
for ma in ('6.2', '6.3'): DIEN.setdefault(ma, {}).setdefault(TANGO, []).append('truot')   # #27–#28 thân nặn thành xe trượt, trượt dọc cáp
DIEN.setdefault('4.3', {}).setdefault(TANGO, []).append('nga@0.12-0.3')
DIEN.setdefault('7.1', {}).setdefault(TANGO, []).append('day@0.05-0.3')
for ma, ds in VT.items():
    for x in ds:
        if ma in DIEN and x['ten'] in DIEN[ma]: x['dien'] = DIEN[ma][x['ten']]
        else: x.pop('dien', None)
for ma, ds in VT.items():
    m = S['may'][ma]; m['vi_tri'] = ds
    if ma in NHAY: m['nhay'] = NHAY[ma]
    else: m.pop('nhay', None)
# Máy giữ nguyên tay (dat): nhìn theo chỗ mới của chủ thể.
S['may']['2.3'].update(dat=[33.1, 23.1, 1.2], nhin=[30.8, 27.3, 0.9], ong_kinh=35)   # #9 CẬN mặt Tango đập xuống gỗ (two → cu = 2 bậc so với #8), 4,5 cm   # 8 cm, Tango ~1/3 khung (cỡ trung)
S['may']['4.3']['nham'] = LINT   # #14 crash zoom vào Lint đang phồng (không vào Tango — chủ thể đầu)
S['may']['4.2']['phia'] = 1   # #13: giải lại để nhận tiêu cự 35 của bộ ống mới (cảnh 4 = 24 / 35 / 60); máy đổi không đáng kể
S['may']['4.3'].pop('phia', None); S['may']['4.3'].update(dat=[-2.2, 63.1, 1.0], nhin=[5.5, 71.5, 1.0], ong_kinh=24, khung=[TANGO, LINT])   # #14 ĐẶT TAY: bộ giải cứ kéo máy về gần #13 (lệch 25°) — sau-trái 40° quanh Tango, cùng phía trục, Lint phải màn   # #14: xoay 35° so với #13 (luật 30°)   # #9: xoay 35° quanh Tango so với #8 (luật 30°), nhìn 125° (máy chủ cảnh 92°)
# 5.7 cận vũng đất sét: cáp trượt dốc qua ngay trước mặt Tango — máy tự động đứng từ trước-trái.
for k in ('dat', 'nhin', 'ong_kinh'): S['may']['5.7'].pop(k, None)
S['may']['5.7']['phia'] = -40   # máy tự động từ trước-trái; bộ giải né cáp trượt (xoay tới 180°)
S['may']['1.2']['khung'] = ['Lamp Switch', 'Magic Mouse']
# 5.3 máy TỰ ĐỘNG (bộ giải) như lúc sinh keyframe. Tệp này đọc–ghi chính tango-ban.json: bỏ một dòng ghim KHÔNG gỡ được máy đã ghi — phải xoá tường minh.
for k in ('dat', 'nhin', 'ong_kinh'): S['may']['5.3'].pop(k, None)
S['may']['5.3']['phia'] = 0

# SỬA 10 SHOT CẢNH 1–6 THEO CỔNG (15/10/2026: cỡ cận quá nhỏ, phản ứng thấy lưng, lật trục, lệch hướng máy chủ) — máy đặt tay, bỏ qua_truc #20.
# #18 (4.7): hai bạn 'cheat to camera' ~30° (ve=75 / -45) như diễn viên thật — quay thẳng vào nhau thì máy chỉ thấy nghiêng.
SUA = {"1.2": {"dat": [40, 4, 1.5], "nhin": [52, 18, 1.2], "ong_kinh": 28, "khung": ["Lamp Switch"]}, "4.5a": {"dat": [8.8, 63.6, 1.4], "nhin": [3, 70.5, 1.3], "ong_kinh": 60, "khung": ["Tango"]}, "4.7": {"dat": [5.5, 61.5, 1.8], "nhin": [5.5, 71.2, 1.0], "ong_kinh": 35, "khung": ["Tango", "Lint"]}, "5.2": {"dat": [12.4, 70.5, 14.5], "nhin": [20, 81, 10], "ong_kinh": 40, "khung": ["Mr. Wipe"]}, "5.4": {"dat": [-14.3, 60.5, 14], "nhin": [6, 72, 3], "ong_kinh": 24, "khung": ["Tango", "Mr. Wipe"]}, "5.5": {"dat": [3.7, 62.3, 3.3], "nhin": [6, 71, 2.5], "ong_kinh": 40, "khung": ["Lint", "Tango"]}, "5.6": {"dat": [5.5, 66.5, 0.5], "nhin": [6.3, 71, 1.3], "ong_kinh": 24, "khung": ["Tango"]}, "5.7": {"dat": [0.1, 65.2, 6], "nhin": [6, 70.5, 0.4], "ong_kinh": 60}, "6.3": {"dat": [22.1, 55.5, 0.5], "nhin": [12.5, 66.5, 2.5], "ong_kinh": 24, "khung": ["Tango", "Lint"]}}
for ma, m in SUA.items():
    S['may'][ma].pop('phia', None); S['may'][ma].pop('qua_truc', None); S['may'][ma].update(m)
# CỠ CẢNH KHỚP 3D (15/10/2026, tờ toàn cảnh): thẻ khai ms mà nhân vật chính chỉ cao 9–17% khung 3D (cổng coCanhLech) → kéo máy lại GIỮ HƯỚNG máy
# (không phá trục / nhịp dẫn), nhắm tâm cụm chủ thể cả chỗ mở lẫn kết, khoảng cách tính từ chiều cao nhân vật + ống kính, không gần hơn mức
# ôm đủ bề ngang cụm. #8 / #13 kéo hết mức vẫn ~15% (nhân vật chạy 8–11 cm trong shot) → hồ sơ khai lại ws cho khớp 3D.
KHOP_CO = {
 '4.2': {'dat': [3.0, 53.9, 1.9], 'nhin': [2.7, 70.8, 1.1], 'ong_kinh': 35},     # #13 (ws)
 '4.3': {'dat': [0.8, 67.0, 1.2], 'nhin': [4.3, 70.8, 0.4], 'ong_kinh': 24},     # #14 ms: Tango 9% → 25% (Blender đo)
 '5.3': {'dat': [0.0, 62.4, 1.7], 'nhin': [4.3, 71.4, 1.1], 'ong_kinh': 40},     # #21 ms: 17% → 25% (ống 40 — cảnh 5 giữ 24 / 40 / 60); nhìn lệch trái cho Tango sang gần chỗ mắt dừng cuối #20 (Mr. Wipe trên-phải)
 '7.4': {'dat': [65.5, 49, 1.2], 'nhin': [59.0, 59.6, 6.0], 'ong_kinh': 40},    # #35 ms góc THẤP: máy sát mặt bàn phía đông ngước lên Mr. Wipe (17% → 42%); máy cũ 26 cm phía nam đứng sau chân iMac (chắn 19% tiền cảnh)
 '7.6b': {'dat': [60.8, 51.7, 2.7], 'nhin': [54.1, 50.8, 1.1], 'ong_kinh': 35},  # #40 ms: Tango 15% → 21%
 # #42 eye trace: cuối #41 mắt ở kẹo (trên-phải) → nhìn lệch trái cho hai bạn sang phải khung, thẻ trống vẫn tiền cảnh
 '7.7a': {'dat': [61, 47.5, 4.0], 'nhin': [54.0, 50.3, 0.5], 'ong_kinh': 35},
}
for ma, m in KHOP_CO.items():
    S['may'][ma].pop('phia', None); S['may'][ma].update(m)
# #28 đặt LẦN CUỐI (16/10/2026, phim Blender — máy chạy tracking): trước-trái iMac, thấy xe trượt từ rừng cáp tới thẻ cam; máy cũ (SUA) đứng sau
# iMac → chân iMac che chủ thể suốt nửa sau clip (duong-may.ts gắn cờ 'che').
S['may']['6.3'].pop('phia', None); S['may']['6.3'].update(dat=[5, 40, 3], nhin=[12, 64, 2])
json.dump(S, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ghi', len(VT), 'shot')
