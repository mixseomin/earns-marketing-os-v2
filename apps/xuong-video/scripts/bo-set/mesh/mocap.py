# CHUYỂN ĐỘNG THẬT (mocap) cho ma-nơ-canh người — anh 17/10/2026 "các bộ khung, thư viện làm tốt hơn chất lượng phim thì làm".
# Nguồn: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu — CMU không đặt giới hạn sử dụng), bản BVH của cgspeed qua
# github.com/una-dinosauria/cmu-mocap; các đoạn đã chọn nằm ở scripts/bo-set/mocap/<mã>.bvh (120 khung/giây, khung xương CMU 31 khớp).
# RETARGET THEO HƯỚNG ĐOẠN XƯƠNG (khung nguồn và ma-nơ-canh khác tỉ lệ, khác tư thế nghỉ T/A): mỗi khung lấy hướng từng đoạn xương nguồn
# (vai→khuỷu, khuỷu→cổ tay, hông→gối…), xoay về KHUNG HƯỚNG MẶT của chính người diễn (trái = +x, trước = −y, lên = +z — quy ước nguoi.py),
# rồi đặt khớp ma-nơ-canh trỏ đúng hướng đó (chỉ xoay lệch, bỏ xoắn). Chỗ đứng / hướng / quãng đi vẫn do kịch bản (vi_tri) quyết.
# Mã diễn: 'mc_<ten>' hoặc 'mc_<ten>@a-b' (a, b = phần thời lượng shot) — xem MOCAP. Thuần Python + mathutils (Blender).
import math, os

THU_MUC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'mocap')
# ten: (mã đoạn CMU, giây bắt đầu trong đoạn, vùng thân áp: 'tren' = thân trên (đè lên dáng đứng / bước), 'tat_ca' = cả người kể cả hạ hông,
#       [giây DỪNG trong đoạn: tới đó giữ khung — không chạy sang động tác kế của đoạn gốc; None = lặp], [dáng ĐẦU, dáng CUỐI: 'dung' · 'quy' · 'ngoi'])
# DÁNG ĐẦU / CUỐI khác 'dung' (anh 19/10/2026, #5 → #6 tổng tài: Hạ quỳ cuối #5 mà đầu #6 đã đứng): ngoài cửa sổ [a, b] KHÔNG trả về dáng đứng —
# trước a giữ khung đầu, sau b giữ khung cuối. Bảng dáng phía TS (bo-set-3d.ts › DANG_DIEN) đọc cùng tên này để cổng liền mạch biết ai đang quỳ.
MOCAP = {
    'cai_nhau':   ('18_10', 2.0, 'tren'),     # quarrel — angry hand gestures
    'giai_thich': ('18_08', 2.0, 'tren'),     # conversation — explain with hand gestures
    'chong_ghe':  ('22_18', 1.0, 'tat_ca'),   # stares down, leans with hands on high stool (đo: cúi ở 0 s, chống hẳn từ 1 s)
    'quy_xuong':  ('23_03', 0.0, 'tat_ca', 3.9, 'dung', 'quy'),   # B kneels, comforts A (subject B — 22_03 là người NGỒI). Đo cao hông: quỳ hẳn 2,0 s, giữ tới 4,0 s
    'dang_quy':   ('23_03', 2.6, 'tat_ca', 2.6, 'quy', 'quy'),   # GIỮ quỳ một gối cả shot (khung 2,6 s của đoạn — hông 0,55): shot nối sau shot quỳ xuống
    'dung_len_quy': ('23_03', 3.9, 'tat_ca', 5.2, 'quy', 'dung'),   # cùng đoạn, khúc ĐỨNG LÊN từ quỳ: hông 0,56 (4,0 s) → 0,96 (4,7 s) → đứng hẳn 5,0 s
    'uong':       ('13_09', 1.0, 'tren'),     # drink
    'chi_tay':    ('13_27', 3.0, 'tren'),     # point / wave
    'dung_day':   ('13_01', 7.0, 'tat_ca', 9.5, 'ngoi', 'dung'),   # sit on high stool, stand up (đo: ngồi 4,7–7,5 s, đứng hẳn 8,5 s; 12 s ngồi lại → dừng 9,5)
    'di_bo':      ('08_01', 0.0, 'tat_ca'),   # walk
    'sai_buoc':   ('08_05', 0.0, 'tat_ca'),   # walk / stride
    # KHO MỞ RỘNG (anh 19/10/2026 "làm cả đi", nhịp 4): động tác phim tâm lý / văn phòng. Giây đo bằng do-mocap.py (cao hông, tay so đầu, tốc độ
    # tay; khung 0 chữ T đã bỏ ở doc_bvh). Nguồn: CMU 79 (actor everyday activities / cảm xúc),
    # 80, 141 (general), 142 (stylized walks), 143, 17 (walk with anger), 18/19/23 (hai người tương tác).
    'khoc':        ('79_72', 1.0, 'tren', 7.0),    # crying — hai tay co lên ngực / mặt, vai rung
    'buon':        ('79_71', 1.0, 'tren', 8.5),    # sad — tay đưa lên mặt rồi buông
    'so_hai':      ('79_73', 1.0, 'tren', 5.5),    # scared — co người, tay thu lên ngực
    'buc_doi':     ('79_74', 1.0, 'tren', 7.4),    # upset — vung hai tay lên rồi buông (bực tức)
    # (79_36 / 80_25 'answering the phone' KHÔNG dùng: kịch câm, tay cách đầu ~34 cm phía trước, không áp tai — nghe điện thoại là dáng chốt
    #  nguoi.py › TU_THE_NGUOI['nghe_dien_thoai'])
    'bam_dien_thoai':  ('79_37', 2.0, 'tren', 4.5),   # dialing phone — tay trái cầm máy trước ngực, tay phải bấm
    'go_phim':     ('79_85', 2.5, 'tren', 7.5),    # typing on a laptop — hai tay ngang bàn
    'nhap_ca_phe': ('79_41', 1.5, 'tren', 8.5),    # sipping coffee — tay phải đưa tách lên môi
    'bat_tay':     ('79_06', 1.2, 'tren', 3.8),    # hand shake — tay phải chìa ra ngang hông–ngực
    'nhun_vai':    ('141_21', 0.6, 'tren', 2.2),   # shrug
    'cho_doi':     ('141_20', 1.0, 'tren', 6.0),   # waiting — đổi chân, nhìn quanh
    'vay_chao':    ('141_16', 0.5, 'tren', 2.0),   # wave hello
    'u_ru':        ('141_27', 0.8, 'tren', 4.4),   # mope — cúi đầu, vai sụp
    'dat_tay_vai': ('23_04', 0.8, 'tren', 4.0),    # B comforts A, one hand on A's shoulder (subject B) — tay phải lên vai người kia
    'keo_tay':     ('18_05', 0.5, 'tat_ca', 3.6),  # A pulls B by the elbow (subject A) — người kéo CHỒM 30–40° về hướng đi: khai huong QUAY LƯNG về người bị kéo
    'bi_keo':      ('19_05', 0.5, 'tat_ca', 3.6),  # A pulls B by the elbow; B resists (subject B) — ghì lại
    'dap_ban_chi': ('23_21', 0.5, 'tren', 3.1),    # conversation — B pounds high stool, points at A (subject B)
    'ngoi_xuong':  ('143_18', 0.5, 'tat_ca', 2.2, 'dung', 'ngoi'),   # sit down (đo: hông 0,99 → 0,58 ở 1,5 s → 0,56 ở 2,0 s), ghế thường
    'dung_day_ghe': ('143_18', 2.4, 'tat_ca', 3.3, 'ngoi', 'dung'),  # get up (cùng đoạn: hông 0,59 ở 2,5 s → 0,99 ở 3,0 s)
    'nhat_do':     ('80_08', 0.6, 'tat_ca', 6.0),  # picking up something — gập người, tay xuống thấp (−1,55) rồi đứng nâng món lên (5,5 s)
    'di_buon':     ('142_15', 3.0, 'tat_ca'),      # stylized walk: sad
    'di_rau_ru':   ('142_05', 3.0, 'tat_ca'),      # stylized walk: depressed
    'di_voi':      ('142_14', 2.0, 'tat_ca'),      # stylized walk: rushed
    'di_tu_tin':   ('142_04', 2.0, 'tat_ca'),      # stylized walk: cool
    'di_di_lai':   ('143_29', 1.0, 'tat_ca'),      # pacing
    'di_gian':     ('17_01', 4.0, 'tat_ca', 13.5), # walk with anger, frustration — dừng trước 14,5 s (tay ôm đầu là mã riêng)
    'om_dau_buc':  ('17_01', 14.3, 'tat_ca', 16.3),   # cùng đoạn: hai tay ôm đầu bực bội khi đang đi (tay ngang đầu 14,5–16 s)
}
# ĐI (đổi chỗ): khung tĩnh của shot đặt giữa sải bước (dung-set.py › DI_MC)
DI = {'di_bo', 'sai_buoc', 'di_buon', 'di_rau_ru', 'di_voi', 'di_tu_tin', 'di_di_lai', 'di_gian'}
# khớp ma-nơ-canh ← (khớp nguồn đầu, khớp nguồn cuối, trục nghỉ của khối: −z tay chân treo xuống, +z thân / đầu dựng lên)
# Đoạn nguồn phải DÀI THẬT: khung CMU có khớp trùng chỗ (Spine1 ≡ Neck, LeftHand ≡ LeftFingerBase) → hướng (0,0,0) lật cả thân (đo 17/10/2026).
DOAN = [('lung', 'Hips', 'Spine1', 1), ('nguc', 'Spine1', 'Neck1', 1), ('co', 'Neck1', 'Head', 1), ('dau', 'Neck1', 'Head', 1),
        ('vai_t', 'LeftArm', 'LeftForeArm', -1), ('khuyu_t', 'LeftForeArm', 'LeftHand', -1), ('cotay_t', 'LeftHand', 'LeftHandIndex1', -1),
        ('vai_p', 'RightArm', 'RightForeArm', -1), ('khuyu_p', 'RightForeArm', 'RightHand', -1), ('cotay_p', 'RightHand', 'RightHandIndex1', -1),
        ('dui_t', 'LeftUpLeg', 'LeftLeg', -1), ('goi_t', 'LeftLeg', 'LeftFoot', -1), ('dui_p', 'RightUpLeg', 'RightLeg', -1), ('goi_p', 'RightLeg', 'RightFoot', -1),
        # BÀN CHÂN (19/10/2026): trục nghỉ = hướng khớp mũi chân của chính ma-nơ-canh (nguoi.py › mui_chan_*) — thiếu đoạn này thì quỳ / ngồi bàn chân lộn ngược
        ('cochan_t', 'LeftFoot', 'LeftToeBase', 'mui_chan_t'), ('cochan_p', 'RightFoot', 'RightToeBase', 'mui_chan_p')]
TREN = {'lung', 'nguc', 'co', 'dau', 'vai_t', 'khuyu_t', 'cotay_t', 'vai_p', 'khuyu_p', 'cotay_p'}

def _mat(rx, ry, rz):
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    return {'X': [[1, 0, 0], [0, cx, -sx], [0, sx, cx]], 'Y': [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], 'Z': [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]}
def _nhan(a, b): return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def _xoay(m, v): return [sum(m[i][k] * v[k] for k in range(3)) for i in range(3)]

_KHO = {}
def doc_bvh(ma):
    """Đọc một tệp BVH → (danh sách khớp [(tên, cha, offset, kênh)], các khung số, giây/khung). Nhớ trong tiến trình."""
    if ma in _KHO: return _KHO[ma]
    dong = open(os.path.join(THU_MUC, f'{ma}.bvh'), encoding='utf-8', errors='ignore').read().split('\n')
    khop, ngan, i = [], [], 0
    while not dong[i].strip().startswith('MOTION'):
        t = dong[i].split()
        if t and t[0] in ('ROOT', 'JOINT'): khop.append([t[1], ngan[-1] if ngan else -1, [0, 0, 0], []]); cur = len(khop) - 1
        elif t and t[0] == 'End': khop.append([None, ngan[-1], [0, 0, 0], []]); cur = len(khop) - 1
        elif t and t[0] == '{': ngan.append(cur)
        elif t and t[0] == '}': ngan.pop()
        elif t and t[0] == 'OFFSET': khop[cur][2] = [float(x) for x in t[1:4]]
        elif t and t[0] == 'CHANNELS': khop[cur][3] = t[2:]
        i += 1
    so = int(dong[i + 1].split()[1]); dt = float(dong[i + 2].split()[2])
    khung = [[float(x) for x in l.split()] for l in dong[i + 3:i + 3 + so] if l.strip()]
    # KHUNG 0 của mọi đoạn CMU (bản cgspeed) là TƯ THẾ CHỮ T hiệu chỉnh (đo 19/10/2026: khoảng hai bàn tay 3,1 × thân ở khung 0, 1,0–1,8 từ khung 1) —
    # bỏ ngay lúc đọc: mã bắt đầu ở 0 giây và đoạn đi lặp vòng (k % số khung) từng chạm đúng khung này → dang thẳng hai tay một nhịp.
    khung = khung[1:]
    _KHO[ma] = (khop, khung, dt); return _KHO[ma]

def vi_tri_khop(ma, k):
    """Toạ độ thế giới (đơn vị BVH, y lên) của mọi khớp có tên ở khung k."""
    khop, khung, _ = doc_bvh(ma); v = khung[max(0, min(len(khung) - 1, k))]
    R, P, out, c = [None] * len(khop), [None] * len(khop), {}, 0
    for j, (ten, cha, off, kenh) in enumerate(khop):
        t = [0.0, 0.0, 0.0]; m = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        for ch in kenh:
            x = v[c]; c += 1
            if ch.endswith('position'): t['XYZ'.index(ch[0])] = x
            else: m = _nhan(m, _mat(math.radians(x), math.radians(x), math.radians(x))[ch[0]])
        if cha < 0: P[j] = [off[i] + t[i] for i in range(3)]; R[j] = m
        else: P[j] = [P[cha][i] + _xoay(R[cha], off)[i] for i in range(3)]; R[j] = _nhan(R[cha], m)
        if ten: out[ten] = P[j]
    return out

def huong_doan(ma, k):
    """Hướng từng đoạn xương ở khung k, quy về khung hướng mặt của người diễn: (trái, trước, lên) → (+x, −y, +z) như nguoi.py.
    Kèm tỉ lệ cao hông so với lúc đứng (khung 0) để hạ hông khi quỳ / ngồi."""
    p = vi_tri_khop(ma, k)
    sub = lambda a, b: [p[a][i] - p[b][i] for i in range(3)]
    trai = sub('LeftUpLeg', 'RightUpLeg'); trai[1] = 0; n = math.hypot(trai[0], trai[2]) or 1; trai = [trai[0] / n, 0, trai[2] / n]
    len_ = [0, 1, 0]; truoc = [trai[1] * len_[2] - trai[2] * len_[1], trai[2] * len_[0] - trai[0] * len_[2], trai[0] * len_[1] - trai[1] * len_[0]]
    doi = lambda v: (sum(v[i] * trai[i] for i in range(3)), -sum(v[i] * truoc[i] for i in range(3)), v[1])
    out = {}
    for khop, a, b, _ in DOAN:
        v = sub(b, a); n = math.sqrt(sum(x * x for x in v))
        if n > 1e-3: out[khop] = doi([x / n for x in v])   # đoạn dài 0 → bỏ, khớp giữ dáng cũ
    san, dung = moc_hong(ma)
    return out, max(0.3, min(1.05, (p['Hips'][1] - san) / (dung or 1)))

_MOC = {}
def moc_hong(ma):
    """(mặt sàn, cao hông lúc đứng) của một đoạn: sàn = bàn chân thấp nhất cả đoạn, đứng = hông cao nhất trên sàn — không lấy khung 0
    (đoạn mở bằng ngồi thì khung 0 đã thấp, quỳ / ngồi thành 'đứng')."""
    if ma not in _MOC:
        _, khung, _ = doc_bvh(ma); ds = [vi_tri_khop(ma, k) for k in range(0, len(khung), 12)]
        san = min(min(p['LeftFoot'][1], p['RightFoot'][1]) for p in ds); _MOC[ma] = (san, max(p['Hips'][1] for p in ds) - san)
    return _MOC[ma]

def ap_mocap(n, ten, t, a=0.0, b=1.0, giay=4.0):
    """Áp đoạn mocap `ten` lên ma-nơ-canh n lúc t (0..1 của shot), trong cửa sổ [a, b] — phát đúng tốc độ thật từ giây bắt đầu của đoạn;
    vào / ra cửa sổ hoà dần 10% để không giật. Cần mathutils (Blender)."""
    from mathutils import Vector
    import bpy
    if ten not in MOCAP: return False
    ma, bd, vung, kt, dau, cuoi = (tuple(MOCAP[ten]) + (None, 'dung', 'dung'))[:6]; _, khung, dt = doc_bvh(ma)
    s = bd + (min(max(t, a), b) - a) * giay
    k = int((min(s, kt) if kt is not None else s) / dt) % len(khung)
    if t < a: w = 0.0 if dau == 'dung' else 1.0           # mở bằng dáng quỳ / ngồi: giữ khung đầu từ t = 0
    elif t > b: w = 0.0 if cuoi == 'dung' else 1.0        # kết bằng dáng quỳ / ngồi: giữ khung cuối, không bật về đứng
    elif b > a and dau == 'dung': w = min(1.0, (t - a) / max(1e-6, 0.1 * (b - a)))
    else: w = 1.0
    if w <= 0: return False
    huong, ti_hong = huong_doan(ma, k)
    # CẬP NHẬT TRƯỚC KHI ĐỌC hướng gốc (anh 19/10/2026: tập 122 #5 Hạ quỳ quay lưng về Vivian, chân sau lộn ngược): goc.rotation_euler vừa đặt theo
    # huong mà matrix_world chưa tính lại → mocap dựng theo hướng CŨ (0°) — mọi nhân vật không quay về −y đều quỳ / đi ngược. Đo: huong 0 và 180 cho
    # cùng toạ độ đầu (0,2; −0,39) trước khi sửa.
    bpy.context.view_layer.update()
    goc = n['goc'].matrix_world.to_3x3().normalized().to_quaternion()   # gốc có scale (dv) — bỏ scale trước khi lấy phép xoay
    if vung == 'tat_ca':
        z0 = n['L']['chan'] + n['L']['cang'] + n['L']['dui']; n['hong'].location.z += (z0 * ti_hong - n['hong'].location.z) * w
    for khop, _, _, truc in DOAN:
        if vung == 'tren' and khop not in TREN or khop not in huong: continue
        e = n[khop]; bpy.context.view_layer.update()
        cha = e.parent.matrix_world.to_3x3().normalized().to_quaternion() if e.parent else goc
        dich = cha.inverted() @ (goc @ Vector(huong[khop]))
        nghi = Vector(n[truc].location).normalized() if isinstance(truc, str) else Vector((0, 0, truc))   # trục nghỉ của khối: ±z, hoặc hướng tới khớp con (bàn chân)
        q = nghi.rotation_difference(dich)
        cu = e.rotation_euler.copy(); moi = q.to_euler('XYZ', cu)
        e.rotation_euler = tuple(cu[i] + (moi[i] - cu[i]) * w for i in range(3))
    bpy.context.view_layer.update()
    return True
