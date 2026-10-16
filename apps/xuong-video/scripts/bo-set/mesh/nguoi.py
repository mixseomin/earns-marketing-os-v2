# MA-NƠ-CANH NGƯỜI CÓ KHỚP cho bản dựng thử (previs) phim người thật — bước 5 chuẩn bị phim người thật (anh 16–17/10/2026).
# Không tải gì (Mixamo cần tài khoản Adobe, MPFB cần extensions.blender.org — Cloudflare chặn iMac), dùng thương mại thoải mái: khớp là EMPTY lồng
# nhau (FK) — hông → lưng → ngực → cổ → đầu; ngực → vai → cánh tay → cẳng tay → bàn tay; hông → đùi → cẳng chân → bàn chân. Thân là khối elip
# trơn kiểu ma-nơ-canh gỗ. Tỉ lệ theo chiều cao (cm, ~7,5 đầu). Gốc (empty 'goc') ở giữa hai bàn chân trên sàn, xoay z = hướng mặt.
#   n = dung_nguoi('Bố', cao=175, mau=(0.8, 0.7, 0.6, 1))   → dict khớp
#   tu_the(n, 'dung' | 'ngoi' | 'nam')  ·  buoc(n, pha)  (chu kỳ đi, pha 0..1)  ·  nhin(n, do)  (quay đầu, độ)
#   di(n, tu, den, f0, f1, toc=110)  — đi từ chỗ tu tới den (cm) trong khung f0..f1, chân tay đánh nhịp theo quãng đường
import bpy, bmesh, math

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
        _khoi(f'{ten}.ban_tay_{p}', cotay, L['ban_tay'], 0.018 * H, 0.008 * H, da)
        dui = n[f'dui_{p}'] = _khop(f'{ten}.dui_{p}', hong, (s * L['hong_rong'] * 0.55, 0, -L['hong'] * 0.5))
        _khoi(f'{ten}.dui_k_{p}', dui, L['dui'], 0.045 * H, 0.045 * H, ao)
        goi = n[f'goi_{p}'] = _khop(f'{ten}.goi_{p}', dui, (0, 0, -L['dui']))
        _khoi(f'{ten}.cang_k_{p}', goi, L['cang'], 0.034 * H, 0.034 * H, ao)
        cochan = n[f'cochan_{p}'] = _khop(f'{ten}.cochan_{p}', goi, (0, 0, -L['cang']))
        bc = _khoi(f'{ten}.ban_chan_{p}', cochan, 0.15 * H, 0.025 * H, 0.012 * H, ao, xuong=False)
        bc.rotation_euler.x = math.radians(90); bc.location = (0, 0.03 * H, -L["chan"] * 0.6)   # bàn chân hướng −y (mũi chân ra trước)
    n['L'] = L
    tu_the(n, 'dung')
    return n

def _dat(n, ten, x=0.0, y=0.0, z=0.0):
    n[ten].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))

def tu_the(n, kieu):
    """Tư thế chốt. Quy ước góc: x dương = ngả RA SAU (về +y); đùi x âm = co lên phía trước (−y)."""
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
