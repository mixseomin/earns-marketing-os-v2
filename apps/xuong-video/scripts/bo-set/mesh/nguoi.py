# MA-NƠ-CANH NGƯỜI CÓ KHỚP cho bản dựng thử (previs) phim người thật — bước 5 chuẩn bị phim người thật (anh 16–17/10/2026).
# Không tải gì (Mixamo cần tài khoản Adobe, MPFB cần extensions.blender.org — Cloudflare chặn iMac), dùng thương mại thoải mái: khớp là EMPTY lồng
# nhau (FK) — hông → lưng → ngực → cổ → đầu; ngực → vai → cánh tay → cẳng tay → bàn tay; hông → đùi → cẳng chân → bàn chân. Thân là khối elip
# trơn kiểu ma-nơ-canh gỗ. Tỉ lệ theo chiều cao (cm, ~7,5 đầu). Gốc (empty 'goc') ở giữa hai bàn chân trên sàn, xoay z = hướng mặt.
#   n = dung_nguoi('Bố', cao=175, mau=(0.8, 0.7, 0.6, 1))   → dict khớp
#   tu_the(n, 'dung' | 'ngoi' | 'nam')  ·  buoc(n, pha)  (chu kỳ đi, pha 0..1)  ·  nhin(n, do)  (quay đầu, độ)
#   di(n, tu, den, f0, f1, toc=110)  — đi từ chỗ tu tới den (cm) trong khung f0..f1, chân tay đánh nhịp theo quãng đường
import bpy, bmesh, math, os
from mathutils import Vector

# Tỉ lệ (phần chiều cao) — số đo nhân trắc trung bình người lớn (Drillis & Contini).
TL = dict(chan=0.039, cang=0.246, dui=0.245, hong=0.10, bung=0.10, nguc=0.13, co=0.052, dau=0.13,
          vai=0.129, tay_tren=0.186, tay_duoi=0.146, ban_tay=0.108, hong_rong=0.095)

def _vl(ten, mau):
    m = bpy.data.materials.new(ten); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    if b: b.inputs['Base Color'].default_value = mau; b.inputs['Roughness'].default_value = 0.55
    return m

def _khop(ten, cha, vi):
    e = bpy.data.objects.new(ten, None); e.empty_display_size = 2; e.empty_display_type = 'PLAIN_AXES'
    bpy.context.scene.collection.objects.link(e)
    if cha: e.parent = cha
    e.location = vi; e.rotation_mode = 'XYZ'
    return e

def _khoi(ten, khop, dai, rx, ry, vl, xuong=True, lech=(0, 0)):
    """Khối elip dài `dai` treo dưới (xuong) hoặc trên khớp — gốc mesh ĐÚNG ở khớp nên xoay khớp là xoay khối."""
    me = bpy.data.meshes.new(ten); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.5)
    for v in bm.verts: v.co.x *= rx * 2; v.co.y *= ry * 2; v.co.z = (v.co.z + 0.5) * dai * (-1 if xuong else 1)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(ten, me); bpy.context.scene.collection.objects.link(o)
    o.parent = khop; o.location = (lech[0], lech[1], 0); o.data.materials.append(vl)
    return o

def dung_nguoi(ten, cao=175.0, mau=(0.78, 0.66, 0.52, 1), mau_ao=None, dv=1.0, ten_goc=None):
    """dv = cỡ 1 cm trong cảnh (dung-set: 0.01 — Blender tính mét); ten_goc = tên empty gốc (dung-set đặt 'NV <tên>' để gắn neo diễn)."""
    H = float(cao); L = {k: v * H for k, v in TL.items()}
    da = _vl(f'{ten}.da', mau); ao = _vl(f'{ten}.ao', mau_ao or mau)
    n = {'cao': H, 'ten': ten}
    goc = n['goc'] = _khop(ten_goc or f'{ten}.goc', None, (0, 0, 0)); goc.scale = (dv, dv, dv)
    z_hong = L['chan'] + L['cang'] + L['dui']
    hong = n['hong'] = _khop(f'{ten}.hong', goc, (0, 0, z_hong))
    _khoi(f'{ten}.khung_chau', hong, L['hong'], L['hong_rong'] * 1.05, 0.10 * H, ao, xuong=True)
    lung = n['lung'] = _khop(f'{ten}.lung', hong, (0, 0, 0))
    _khoi(f'{ten}.bung', lung, L['bung'], 0.085 * H, 0.06 * H, ao, xuong=False)
    nguc = n['nguc'] = _khop(f'{ten}.nguc', lung, (0, 0, L['bung']))
    _khoi(f'{ten}.nguc_k', nguc, L['nguc'], 0.11 * H, 0.068 * H, ao, xuong=False)
    co = n['co'] = _khop(f'{ten}.co', nguc, (0, 0, L['nguc']))
    _khoi(f'{ten}.co_k', co, L['co'], 0.03 * H, 0.03 * H, da, xuong=False)
    dau = n['dau'] = _khop(f'{ten}.dau', co, (0, 0, L['co']))
    _khoi(f'{ten}.dau_k', dau, L['dau'], 0.046 * H, 0.056 * H, da, xuong=False)
    _khoi(f'{ten}.mui', dau, 0.02 * H, 0.008 * H, 0.012 * H, da, xuong=False, lech=(0, -0.05 * H))   # mũi chỉ hướng mặt (−y)
    n['mui'] = bpy.data.objects[f'{ten}.mui']; n['mui'].location.z = L['dau'] * 0.38
    for p, s in (('t', 1), ('p', -1)):   # t = trái nhân vật (+x khi nhìn −y là phải màn), p = phải
        vai = n[f'vai_{p}'] = _khop(f'{ten}.vai_{p}', nguc, (s * L['vai'], 0, L['nguc'] * 0.88))
        _khoi(f'{ten}.tay_tren_{p}', vai, L['tay_tren'], 0.03 * H, 0.03 * H, ao)
        khuyu = n[f'khuyu_{p}'] = _khop(f'{ten}.khuyu_{p}', vai, (0, 0, -L['tay_tren']))
        _khoi(f'{ten}.tay_duoi_{p}', khuyu, L['tay_duoi'], 0.024 * H, 0.024 * H, da)
        cotay = n[f'cotay_{p}'] = _khop(f'{ten}.cotay_{p}', khuyu, (0, 0, -L['tay_duoi']))
        # BÀN TAY CÓ NGÓN: lòng bàn tay + 4 ngón + ngón cái. Khối dẹt một mảnh (mái chèo) thì keyframe AI vẽ thành cánh / lá trắng (tập 122 #11).
        _khoi(f'{ten}.ban_tay_{p}', cotay, 0.55 * L['ban_tay'], 0.018 * H, 0.008 * H, da)
        for i, (dx, k) in enumerate(((-0.75, 0.85), (-0.25, 1.0), (0.25, 0.95), (0.75, 0.8))):
            g_ = _khop(f'{ten}.ngon_goc_{p}{i}', cotay, (dx * 0.0135 * H, 0, -0.5 * L['ban_tay']))
            _khoi(f'{ten}.ngon_{p}{i}', g_, 0.5 * L['ban_tay'] * k, 0.0043 * H, 0.0043 * H, da)
        gc = _khop(f'{ten}.ngon_goc_{p}c', cotay, (-s * 0.016 * H, -0.004 * H, -0.12 * L['ban_tay']))
        gc.rotation_euler = (math.radians(-30), math.radians(s * 25), 0)
        _khoi(f'{ten}.ngon_{p}c', gc, 0.42 * L['ban_tay'], 0.005 * H, 0.005 * H, da)
        dui = n[f'dui_{p}'] = _khop(f'{ten}.dui_{p}', hong, (s * L['hong_rong'] * 0.55, 0, -L['hong'] * 0.5))
        _khoi(f'{ten}.dui_k_{p}', dui, L['dui'], 0.045 * H, 0.045 * H, ao)
        goi = n[f'goi_{p}'] = _khop(f'{ten}.goi_{p}', dui, (0, 0, -L['dui']))
        _khoi(f'{ten}.cang_k_{p}', goi, L['cang'], 0.034 * H, 0.034 * H, ao)
        cochan = n[f'cochan_{p}'] = _khop(f'{ten}.cochan_{p}', goi, (0, 0, -L['cang']))
        bc = _khoi(f'{ten}.ban_chan_{p}', cochan, 0.15 * H, 0.025 * H, 0.012 * H, ao, xuong=False)
        bc.rotation_euler.x = math.radians(90); bc.location = (0, 0.03 * H, -L["chan"] * 0.6)   # bàn chân hướng −y (mũi chân ra trước)
    n['L'] = L
    than_tron(n, ten, H, L, ao, dv)
    tu_the(n, 'dung')
    return n

def than_tron(n, ten, H, L, vl, dv):
    """THÂN LIỀN (ma-nơ-canh gỗ hoạ sĩ): một mesh Skin dựng trên các khớp, mỗi đỉnh HOOK vào khớp của nó nên tự uốn theo mọi tư thế / mocap.
    Chỉ hiện khi vẽ ĐỘ SÂU (dung-set.py › ve_sau): chuỗi khối elip rời bị cắt sát khung thì FLUX depth đọc thành bình / tượng (tập 122 #11, 3 lượt);
    thân liền thì ở cỡ cảnh nào cũng là hình người. Khung màu + kiểm hình học vẫn dùng khối elip (màu áo / da riêng)."""
    bpy.context.view_layer.update()
    dinh, chi = [], {}
    def v(k, ma, off, rx, ry): chi[ma] = len(dinh); dinh.append((k, off, rx, ry))
    v('hong', 'hong', (0, 0, -0.02 * H), 0.10 * H, 0.07 * H)
    v('nguc', 'eo', (0, 0, 0), 0.085 * H, 0.06 * H)
    v('nguc', 'nguc', (0, 0, 0.6 * L['nguc']), 0.11 * H, 0.068 * H)
    v('co', 'co', (0, 0, 0.3 * L['co']), 0.032 * H, 0.032 * H)
    v('dau', 'cam', (0, -0.01 * H, 0.2 * L['dau']), 0.036 * H, 0.04 * H)
    v('dau', 'dau', (0, 0, 0.55 * L['dau']), 0.048 * H, 0.056 * H)
    v('dau', 'dinh', (0, 0.005 * H, 0.92 * L['dau']), 0.03 * H, 0.035 * H)
    # HƯỚNG MẶT trong độ sâu: mũi + cằm nhô về trước (−y cục bộ của đầu) — đầu trơn thì FLUX không biết mặt quay đâu, vẽ người quay lưng (#12 lượt 2)
    v('dau', 'mui', (0, -0.062 * H, 0.45 * L['dau']), 0.012 * H, 0.012 * H)
    v('dau', 'cam_nho', (0, -0.04 * H, 0.18 * L['dau']), 0.022 * H, 0.016 * H)
    canh = [('hong', 'eo'), ('eo', 'nguc'), ('nguc', 'co'), ('co', 'cam'), ('cam', 'dau'), ('dau', 'dinh'), ('dau', 'mui'), ('cam', 'cam_nho')]
    for p in 'tp':
        v(f'vai_{p}', f'vai_{p}', (0, 0, 0), 0.034 * H, 0.034 * H)
        v(f'khuyu_{p}', f'khuyu_{p}', (0, 0, 0), 0.026 * H, 0.026 * H)
        v(f'cotay_{p}', f'cotay_{p}', (0, 0, 0), 0.02 * H, 0.015 * H)
        v(f'cotay_{p}', f'tay_{p}', (0, 0, -0.75 * L['ban_tay']), 0.016 * H, 0.008 * H)
        v(f'dui_{p}', f'dui_{p}', (0, 0, 0), 0.05 * H, 0.05 * H)
        v(f'goi_{p}', f'goi_{p}', (0, 0, 0), 0.036 * H, 0.036 * H)
        v(f'cochan_{p}', f'cochan_{p}', (0, 0, 0), 0.026 * H, 0.026 * H)
        v(f'cochan_{p}', f'mui_chan_{p}', (0, -0.11 * H, -0.03 * H), 0.022 * H, 0.014 * H)
        canh += [('nguc', f'vai_{p}'), (f'vai_{p}', f'khuyu_{p}'), (f'khuyu_{p}', f'cotay_{p}'), (f'cotay_{p}', f'tay_{p}'),
                 ('hong', f'dui_{p}'), (f'dui_{p}', f'goi_{p}'), (f'goi_{p}', f'cochan_{p}'), (f'cochan_{p}', f'mui_chan_{p}')]
    pts = [n[k].matrix_world @ Vector(off) for k, off, _, _ in dinh]
    # TÊN NGOÀI tiền tố '<ten>.' của ma-nơ-canh: mọi bộ đo gom bộ phận người theo tiền tố 'NG <tên>.' — hộp bao chưa biến dạng (ở gốc toạ độ) của
    # thân liền làm khung người phình to → cổng báo 'chồng hình 100%' oan (#15, #16, #20).
    cu = bpy.data.objects.get(f'THAN {ten}')
    if cu: bpy.data.objects.remove(cu, do_unlink=True)   # thân của shot trước (khớp đã xoá) — không xoá thì tên mới thành '.001', tra theo tên lấy nhầm bản cũ
    me = bpy.data.meshes.new(f'THAN {ten}'); me.from_pydata([tuple(q) for q in pts], [(chi[a], chi[b]) for a, b in canh], []); me.update()
    o = bpy.data.objects.new(f'THAN {ten}', me); bpy.context.scene.collection.objects.link(o); o.data.materials.append(vl)
    for i, (k, _, _, _) in enumerate(dinh):
        h = o.modifiers.new(f'moc{i}', 'HOOK'); h.object = n[k]; h.vertex_indices_set([i]); h.matrix_inverse = n[k].matrix_world.inverted(); h.center = pts[i]
    sk = o.modifiers.new('da', 'SKIN')
    for i, (_, _, rx, ry) in enumerate(dinh): me.skin_vertices[0].data[i].radius = (rx * dv, ry * dv)
    me.skin_vertices[0].data[0].use_root = True
    sd = o.modifiers.new('min', 'SUBSURF'); sd.levels = sd.render_levels = 1
    o.hide_render = o.hide_viewport = True   # chỉ bật trong ve_sau — hiện ở viewport thì tia đo (che / cỡ khung) đụng thân liền, người 'to' ra (#3, #12)
    n['than_tron'] = o

def _dat(n, ten, x=0.0, y=0.0, z=0.0):
    n[ten].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))

def tu_the(n, kieu):
    """Tư thế chốt. Quy ước góc (đo 17/10/2026): khớp hướng XUỐNG (đùi, tay) x âm = đưa ra trước (−y); khớp hướng LÊN (lưng, ngực, cổ, đầu) x dương = cúi ra trước."""
    L = n['L']; z_hong = L['chan'] + L['cang'] + L['dui']
    for k in list(n):
        if isinstance(n[k], bpy.types.Object) and n[k].type == 'EMPTY' and k != 'goc': n[k].rotation_euler = (0, 0, 0)
    n['hong'].location = (0, 0, z_hong); n['goc'].rotation_euler.x = 0
    _dat(n, 'vai_t', 0, -8); _dat(n, 'vai_p', 0, 8)   # tay buông tự nhiên, hơi xa thân
    if kieu == 'ngoi':
        # ngồi ghế cao ~ cẳng chân + bàn chân: đùi ngang ra trước, gối gập 90°, hông hạ đúng chiều dài đùi
        for p in 'tp': _dat(n, f'dui_{p}', -90); _dat(n, f'goi_{p}', 90)
        n['hong'].location = (0, 0, L['chan'] + L['cang'])
        _dat(n, 'khuyu_t', -60); _dat(n, 'khuyu_p', -60)   # tay đặt lên đùi
    elif kieu == 'nam':
        n['goc'].rotation_euler.x = math.radians(-90); n['hong'].location = (0, 0, z_hong)
        n['goc'].location.z = 0.06 * n['cao']
    n['kieu'] = kieu

def buoc(n, pha):
    """Chu kỳ đi (pha 0..1): đùi ±24°, gối gập khi chân bước lên, tay đánh ngược chân, thân nhún nhẹ."""
    L = n['L']; a = math.sin(2 * math.pi * pha)
    _dat(n, 'dui_t', -24 * a); _dat(n, 'dui_p', 24 * a)
    _dat(n, 'goi_t', max(0, 40 * math.sin(2 * math.pi * pha + 1.2))); _dat(n, 'goi_p', max(0, 40 * math.sin(2 * math.pi * pha + 1.2 + math.pi)))
    _dat(n, 'vai_t', 20 * a, -8); _dat(n, 'vai_p', -20 * a, 8)
    _dat(n, 'khuyu_t', -15); _dat(n, 'khuyu_p', -15)
    n['hong'].location.z = L['chan'] + L['cang'] + L['dui'] - abs(math.cos(2 * math.pi * pha)) * 0.012 * n['cao']

def nhin(n, do):
    """Quay đầu (độ, + = sang trái nhân vật), cổ gánh một phần như người thật."""
    n['co'].rotation_euler.z = math.radians(do * 0.35); n['dau'].rotation_euler.z = math.radians(do * 0.65)

KHOP_KEY = ['hong', 'lung', 'nguc', 'co', 'dau'] + [f'{k}_{p}' for k in ('vai', 'khuyu', 'cotay', 'dui', 'goi', 'cochan') for p in 'tp']

def khoa_khung(n, f):
    """Ghi khoá (keyframe) mọi khớp + gốc tại khung f."""
    for k in KHOP_KEY: n[k].keyframe_insert('rotation_euler', frame=f)
    n['hong'].keyframe_insert('location', frame=f)
    n['goc'].keyframe_insert('location', frame=f); n['goc'].keyframe_insert('rotation_euler', frame=f)

def di(n, tu, den, f0, f1, sai_buoc=None):
    """Đi từ tu → den (cm, mặt sàn) trong khung f0..f1: gốc trượt + quay về hướng đi, mỗi bước dài ~0,41 chiều cao (sải người lớn)."""
    dx, dy = den[0] - tu[0], den[1] - tu[1]; dai = math.hypot(dx, dy)
    huong = math.degrees(math.atan2(dx, -dy))   # 0° = nhìn −y (về phía máy mặc định)
    sai = sai_buoc or 0.41 * n['cao']; chu_ky = max(1.0, dai / (2 * sai))
    for f in range(f0, f1 + 1):
        t = (f - f0) / max(1, f1 - f0)
        n['goc'].location = (tu[0] + dx * t, tu[1] + dy * t, 0); n['goc'].rotation_euler.z = math.radians(huong)
        buoc(n, t * chu_ky); khoa_khung(n, f)

# ── THƯ VIỆN TƯ THẾ NGƯỜI (rig previs — anh 17/10/2026 "có rig thì thông tin gửi AI rõ ràng, đỡ sai"): mỗi tư thế = góc khớp (độ, cùng quy ước
# tu_the: x dương = ngả ra sau / về +y; tay x âm = vung ra trước; y = dạng tay ra ngoài, bên trái 't' âm / phải 'p' dương) + 'hong_cao' (phần chiều
# cao, hông hạ khi quỳ / ngồi). Chỉ ĐÈ các khớp tư thế khai — đi (buoc) + cầm đồ (cam_truoc) chồng được. Mã trong vi_tri.dien: 'ten' = giữ cả shot,
# 'ten@a-b' = chuyển dần từ dáng trước sang dáng này trong khoảng a..b (phần thời lượng shot), giữ tới hết. Đồ đang cầm gắn vào bàn tay
# (dung-set.py › gan_tay): món cầm thứ nhất tay phải, thứ hai tay trái; 'om_thung' đặt món giữa hai tay.
TU_THE_NGUOI = {
    # QUY ƯỚC (đo bằng số 17/10/2026): khớp hướng LÊN (lung, nguc, co, dau) x DƯƠNG = cúi / ngả ra TRƯỚC (−y); khớp hướng XUỐNG (tay, chân)
    # x ÂM = vung ra trước. Thân cúi θ thì tay đang buông bị kéo ra sau θ — muốn tay đổ xuống trước góc φ thì đặt vai = −φ − θ.
    'quy_mot_goi': {'hong_cao': 0.27, 'lung': (18, 0, 0), 'dui_t': (-90, 0, 0), 'goi_t': (90, 0, 0), 'dui_p': (8, 0, 0), 'goi_p': (95, 0, 0),
                    'vai_p': (-40, 8, 0), 'khuyu_p': (-15, 0, 0), 'dau': (15, 0, 0)},                          # quỳ gối phải, cúi, tay phải với xuống sàn
    'cam_truoc': {'vai_p': (-15, 8, 0), 'khuyu_p': (-85, 0, 0)},                                                # cầm món trước ngực
    'cam_dien_thoai': {'vai_p': (-12, 10, 0), 'khuyu_p': (-110, 0, 0), 'dau': (22, 0, 0)},                     # nhìn xuống điện thoại trong tay
    'gio_cao': {'vai_p': (-150, 12, 0), 'khuyu_p': (-15, 0, 0), 'lung': (-5, 0, 0)},                            # giơ cao cho cả phòng thấy, ngả nhẹ ra sau
    'dua_truoc_mat': {'vai_p': (-70, 12, 0), 'khuyu_p': (-55, 0, 0)},
    'lac_treo': {'vai_p': (-105, 10, 0), 'khuyu_p': (-15, 0, 0)},                                             # chìa tay ngang vai, món TREO lủng lẳng ngang mặt người đối diện (#11 thẻ đeo)                                           # đưa món lên trước mặt người đối diện
    'hat': {'vai_p': (-90, 5, 0), 'khuyu_p': (-8, 0, 0), 'lung': (10, 0, 0), 'nguc': (0, 0, 12)},               # hất / ném mạnh ra trước
    'giat': {'vai_p': (-97, 4, 0), 'khuyu_p': (-12, 0, 0), 'lung': (12, 0, 0), 'nguc': (0, 0, 15)},             # vươn tay giật
    'chong_ban': {'lung': (28, 0, 0), 'nguc': (10, 0, 0), 'vai_t': (-85, -10, 0), 'vai_p': (-85, 10, 0),
                  'khuyu_t': (0, 0, 0), 'khuyu_p': (0, 0, 0), 'dau': (-35, 0, 0)},                              # cúi 38°, hai tay đổ xuống chống mặt bàn, ngẩng nhìn
    'cui_nguoi': {'lung': (20, 0, 0), 'nguc': (8, 0, 0), 'dau': (-15, 0, 0)},                                   # cúi sát về phía trước, mắt giữ ngang
    'om_thung': {'vai_t': (-22, -6, 0), 'vai_p': (-22, 6, 0), 'khuyu_t': (-88, 0, 0), 'khuyu_p': (-88, 0, 0)},  # ôm thùng trước bụng
    'khoanh_tay': {'vai_t': (-25, -4, 0), 'vai_p': (-25, 4, 0), 'khuyu_t': (-115, 0, -35), 'khuyu_p': (-115, 0, 35)},
    'gioi_thieu': {'vai_p': (-40, 35, 0), 'khuyu_p': (-15, 0, 0)},                                              # đưa tay giới thiệu người bên cạnh
    'thuyet_trinh': {'vai_p': (-50, 28, 0), 'khuyu_p': (-30, 0, 0), 'dau': (0, 0, -10)},                        # tay mở về phía màn chiếu
    # DÁNG ĐỨNG TỰ NHIÊN (anh 17/10/2026: "ai đứng cũng thẳng đuỗn, nhìn chán") — dáng NGHỈ của nhân vật (khoi_3d.dang), máy tự chồng khi nhân vật
    # đứng yên không có mocap (dung-set.py › dien_hl); động tác tay khai ở dien vẫn đè lên sau.
    'dung_doi_chan': {'dui_t': (-6, 0, 0), 'goi_t': (14, 0, 0), 'nguc': (0, 0, 7), 'dau': (0, 5, 0)},          # dồn trọng tâm chân phải, gối trái chùng, vai xoay, đầu nghiêng
    'dung_doi_chan_p': {'dui_p': (-6, 0, 0), 'goi_p': (14, 0, 0), 'nguc': (0, 0, -7), 'dau': (0, -5, 0)},      # dồn trọng tâm chân trái (đối xứng)
    'tay_tui': {'vai_p': (8, 12, 0), 'khuyu_p': (-30, 0, 0)},                                                  # tay phải đút túi quần
    'mot_tay_hong': {'vai_p': (12, 42, 0), 'khuyu_p': (-85, 0, 50)},                                            # chống hông tay phải
    'dung_vung': {'vai_t': (-12, -6, 0), 'vai_p': (-12, 6, 0), 'khuyu_t': (-70, 0, -40), 'khuyu_p': (-70, 0, 40)},  # hai tay đan trước bụng
}

_MC = None
def _mocap():
    global _MC
    if _MC is None:
        import importlib.util as _iu
        _s = _iu.spec_from_file_location('mocap', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mocap.py')); _MC = _iu.module_from_spec(_s); _s.loader.exec_module(_MC)
    return _MC

def ap_dien(n, ds, t, giay=4.0):
    """Đặt tư thế theo mã diễn (vi_tri.dien) lúc t (0..1) — chồng lên dáng hiện tại (đứng / ngồi / đang bước). Trả tên các tư thế đang có hiệu lực.
    Mã 'mc_<ten>[@a-b]' = chuyển động thật từ kho mocap CMU (mocap.py › MOCAP), phát đúng tốc độ thật theo `giay` của shot."""
    dang = []
    for x in ds or []:
        ten, _, mt = str(x).partition('@')
        if ten.startswith('mc_'):
            a, b = (0.0, 1.0)
            if mt: a_, _, b_ = mt.partition('-'); a, b = float(a_), (float(b_) if b_ else 1.0)
            if _mocap().ap_mocap(n, ten[3:], t, a, b, giay): dang.append(ten)
            continue
        if ten not in TU_THE_NGUOI: continue
        if mt:
            a, _, b = mt.partition('-'); a = float(a); b = float(b) if b else min(1.0, a + 0.2)
            k = 1.0 if t >= b else 0.0 if t <= a else (t - a) / max(1e-6, b - a)
        else: k = 1.0
        k = k * k * (3 - 2 * k)
        if k <= 0: continue
        dang.append(ten)
        for khop, g in TU_THE_NGUOI[ten].items():
            if khop == 'hong_cao':
                z0 = n['hong'].location.z; n['hong'].location.z = z0 + (g * n['cao'] - z0) * k; continue
            e = n[khop].rotation_euler; mo = (math.degrees(e.x), math.degrees(e.y), math.degrees(e.z))
            n[khop].rotation_euler = tuple(math.radians(mo[i] + (g[i] - mo[i]) * k) for i in range(3))
    return dang
