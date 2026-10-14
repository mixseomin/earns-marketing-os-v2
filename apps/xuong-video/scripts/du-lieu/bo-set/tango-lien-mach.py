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
 '4.7': [v(TANGO, T4, ve=L4), v(LINT, L4, [7, 71.6, 0], ve=T4), v(CBALL, C4), v(GUMMY, [5, 71, 0.5], cam=TANGO)],
 '5.1': [v(WIPE, [24.5, 84, 11], [22, 82, 10.5], ve=[5, 71], an=True), v(TANGO, T4, ve=[7, 71.6]), v(LINT, [7, 71.6, 0], ve=T4)],
 '5.2': [v(WIPE, [22, 82, 10.5], [14, 78, 9], ve=[7, 71.6]), v(LINT, [7, 71.6, 0], ve=T4), v(SPRAY, [23.5, 80.5, 8.5], cam=WIPE)],
 '5.3': [v(TANGO, T4, ve=[7, 71.6], ve_den=[14, 78]), v(LINT, [7, 71.6, 0], ve=T4, ve_den=[14, 78]), v(SPRAY, [11, 77, 13], cam=WIPE, an=True)],
 '5.4': [v(TANGO, T4, [4, 69.5, 0], ve=[8, 74], ve_den=[8, 74]), v(LINT, [7, 71.6, 0], ve=[8, 74]), v(WIPE, [14, 78, 9], [8, 74, 4], ve=[4, 69.5]), v(SPRAY, [10, 74.5, 5], cam=WIPE)],
 '5.5': [v(LINT, [7, 71.6, 0], [7.5, 72.5, 4.5], ve=[8.5, 74.5]), v(TANGO, [4, 69.5, 0], [6.4, 71.2, 0], ve=[7, 72]), v(WIPE, [8, 74, 4], [8.5, 74.5, 6], ve=[7, 72]), v(CBALL, C4)],
 '5.6': [v(TANGO, [6.4, 71.2, 0], [6, 70.5, 0], ve=[9, 73]), v(SPRAY, [9, 73, 4], cam=WIPE), v(WIPE, [8.5, 74.5, 6], ve=[6, 71], an=True)],
 '5.7': [v(TANGO, [6, 70.5, 0], ve=[7.5, 72.5], nam=True)],
 '6.1': [v(TANGO, [6, 70.5, 0], ve=[7.5, 72.5], ve_den=[6, 69], nam=True), v(LINT, [7.5, 72.5, 4.5], [8, 73, 5], ve=[8.5, 74.5]), v(WIPE, [8.5, 74.5, 6], ve=[8, 73])],
 '6.2': [v(TANGO, [6, 70.5, 0], [7, 68.6, 2.3], ve=[6, 69], ve_den=[20, 64]), v(LINT, [8, 73, 5], [7, 68.9, 3.3], ve=[8.5, 74.5], ve_den=[20, 64]),
         v(WIPE, [8.5, 74.5, 6], [10, 74, 7], ve=[8, 73], ve_den=[7, 68.9]), v(CBALL, [7.4, 69.2, 3.6], cam=LINT)],
 '6.3': [v(TANGO, [7, 68.6, 2.3], [55.4, 50.9, 0.3], ve=[20, 64], ve_den=[60, 50]), v(LINT, [7, 68.9, 3.3], [55.6, 51.6, 0.6], ve=[20, 64]),
         v(WIPE, [10, 74, 7], [20, 67, 3], ve=[7, 68.6], ve_den=[20, 64])],
 '7.1': [v(TANGO, [55.4, 50.9, 0.3], T7, ve=[60, 50], ve_den=PLUG), v(LINT, [55.6, 51.6, 0.6], L7, ve=KEO7, ve_den=T7), v(GUMMY, [56.6, 50.6, 1.0], KEO7, cam=TANGO),
         v(STICKY, ST7, an=True, nhay='lẻn theo hai bạn ngoài khung từ cảnh 2, nấp dưới mép thẻ cam')],
 '7.2': [v(TANGO, T7, ve=PLUG)],
 '7.2a': [v(TANGO, T7, ve=PLUG, ve_den=[36, 62]), v(LINT, L7, ve=T7)],
 '7.3': [v(TANGO, T7, [55.8, 53.4, 0.3], ve=[50, 60], ve_den=CAM), v(LINT, L7, ve=T7, ve_den=[55.8, 53.4])],
 '7.4': [v(WIPE, [58, 61, 5], [57, 55.6, 2.6], ve=[55.8, 54.3], nhay='gỡ khỏi rừng cáp, bay tới đế cắm ngoài khung'),
         v(TANGO, T7N, ve=[57, 55.6], nhay='chạy nấp sau mép thẻ khi thấy Mr. Wipe tới'), v(LINT, L7N, ve=[57, 55.6], nhay='chạy nấp sau mép thẻ khi thấy Mr. Wipe tới')],
 '7.5': [v(WIPE, [56.6, 55.2, 1.8], [55, 54.2, 1.2], ve=PLUG)],
 '7.6': [v(TANGO, T7N, ve=[55.5, 55], ve_den=L7N), v(LINT, L7N, ve=[55.5, 55], ve_den=T7N), v(WIPE, [55.5, 55, 2], ve=CAM, an=True)],
 '7.7': [v(GUMMY, KEO7, [59, 45.5, 0]), v(STICKY, ST7, [59, 45.5, 0.05]), v(TANGO, T7N, ve=L7N, an=True), v(LINT, L7N, ve=T7N, an=True)],
 '7.7a': [v(TANGO, T7N, ve=L7N, ve_den=KEO7), v(LINT, L7N, ve=T7N, ve_den=KEO7)],
 '7.8': [v(TANGO, T7N, ve=KEO7), v(LINT, L7N, ve=KEO7), v(CORDY, [47, 57.6, 0.6], ve=T7N)],
 '8.1': [v(TANGO, [-2, 3, 0], ve=CAM), v(LINT, [2, 3, 0], ve=CAM)],
}
NHAY = {  # cú cắt cố ý cắt thời gian / dịch chuyển ngoài khung
 '3.1': 'cắt thời gian: lăn một quãng ngoài khung tới khe giữa hai màn hình',
 '4.1': 'cắt thời gian: hết khe màn hình, lăn vào rừng cáp',
 '8.1': 'phần kết: hai bạn ra mép bàn chào khán giả',
}
for ma, ds in VT.items():
    m = S['may'][ma]; m['vi_tri'] = ds
    if ma in NHAY: m['nhay'] = NHAY[ma]
    else: m.pop('nhay', None)
# Máy giữ nguyên tay (dat): nhìn theo chỗ mới của chủ thể.
S['may']['2.3']['nhin'] = [32, 29, 1.2]
# 5.7 cận vũng đất sét: cáp trượt dốc qua ngay trước mặt Tango — máy tự động đứng từ trước-trái.
for k in ('dat', 'nhin', 'ong_kinh'): S['may']['5.7'].pop(k, None)
S['may']['5.7']['phia'] = -40   # máy tự động từ trước-trái; bộ giải né cáp trượt (xoay tới 180°)
S['may']['1.2']['khung'] = ['Lamp Switch', 'Magic Mouse']
json.dump(S, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ghi', len(VT), 'shot')
