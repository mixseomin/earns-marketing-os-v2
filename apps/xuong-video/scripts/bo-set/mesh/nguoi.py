# MA-NƠ-CANH NGƯỜI CÓ KHỚP cho bản dựng thử (previs) phim người thật — bước 5 chuẩn bị phim người thật (anh 16–17/10/2026).
# Không tải gì (Mixamo cần tài khoản Adobe, MPFB cần extensions.blender.org — Cloudflare chặn iMac), dùng thương mại thoải mái: khớp là EMPTY lồng
# nhau (FK) — hông → lưng → ngực → cổ → đầu; ngực → vai → cánh tay → cẳng tay → bàn tay; hông → đùi → cẳng chân → bàn chân. Thân là khối elip
# trơn kiểu ma-nơ-canh gỗ. Tỉ lệ theo chiều cao (cm, ~7,5 đầu). Gốc (empty 'goc') ở giữa hai bàn chân trên sàn, xoay z = hướng mặt.
#   n = dung_nguoi('Bố', cao=175, mau=(0.8, 0.7, 0.6, 1))   → dict khớp
#   tu_the(n, 'dung' | 'ngoi' | 'nam')  ·  buoc(n, pha)  (chu kỳ đi, pha 0..1)  ·  nhin(n, do)  (quay đầu, độ)
#   di(n, tu, den, f0, f1, toc=110)  — đi từ chỗ tu tới den (cm) trong khung f0..f1, chân tay đánh nhịp theo quãng đường
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

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

_TL_MPFB = {}
# DÁNG NGƯỜI (anh 19/10/2026: "nữ nhìn thon thả tí, nam trẻ gọn lại; phim có người béo, người gầy thì AI phân biệt sao"): macro MakeHuman
# weight / muscle / proportions (0..1, 0,5 = trung bình — trước đây để cả ba ở 0,5 nên nữ đẫy, nam bè). Khai ở khoi_3d.than; không khai thì theo
# giới + tuổi (than_mac_dinh). CÙNG khoá với bo-set-3d.ts › THAN_EN (chữ đưa vào prompt) — một ô dáng cho cả hình khối 3D lẫn chữ.
THAN_HINH = {'thon': {'weight': 0.3, 'muscle': 0.42, 'proportions': 0.9}, 'gon': {'weight': 0.36, 'muscle': 0.62, 'proportions': 0.9},
             'vua': {'weight': 0.5, 'muscle': 0.5, 'proportions': 0.6}, 'beo': {'weight': 0.92, 'muscle': 0.35, 'proportions': 0.3},
             'gay': {'weight': 0.12, 'muscle': 0.3, 'proportions': 0.5}, 'vam': {'weight': 0.6, 'muscle': 0.95, 'proportions': 0.85}}
def than_mac_dinh(gioi, tuoi):
    t = tuoi or 30
    return 'thon' if gioi == 'nu' and t < 45 else 'gon' if gioi == 'nam' and t < 40 else 'vua'
def _dat_than(m, h, gioi, tuoi, than=None):
    """Đặt giới / chủng / tuổi / dáng cho thân MPFB h — MỘT chỗ cho tl_mpfb (đo tỉ lệ) và nguoi_mpfb (thân hiển thị), khỏi lệch nhau."""
    # gender MakeHuman: 0 = NỮ, 1 = NAM (MPFB createhuman.py: female = 0,5 − ảnh hưởng·0,5). Trước 22/10/2026 đặt ngược → nữ thân nam cơ bắp, nam
    # thân nữ (anh: "người của Hạ như thằng đàn ông thể hình")
    for kk, v in (('gender', 0.0 if gioi == 'nu' else 1.0 if gioi == 'nam' else 0.5), ('asian', 1.0), ('african', 0.0), ('caucasian', 0.0)):
        m['op'].set_value(kk, v, entity_reference=h)
    if tuoi: m['op'].set_value('age', 0.1875 + (tuoi - 11) / 14 * 0.3125 if tuoi < 25 else min(1.0, 0.5 + (tuoi - 25) / 65 * 0.5), entity_reference=h)
    for kk, v in THAN_HINH.get(than or than_mac_dinh(gioi, tuoi), THAN_HINH['vua']).items(): m['op'].set_value(kk, v, entity_reference=h)
    m['ts'].reapply_macro_details(h)

def tl_mpfb(gioi, tuoi, than=None):
    """TỈ LỆ THÂN của người MPFB cùng giới / tuổi (phần chiều cao), đo trên rig ở tư thế gốc — ma-nơ-canh dựng theo đúng số này để khớp xương trùng
    người thật: IK với tới đúng cổ tay (đồ cầm không lơ lửng), đầu đúng chỗ (máy cận ngắm trúng mặt). Anh 18/10/2026 thấy #3 cặp hồ sơ lơ lửng trên tay,
    #24 cận chỉ thấy vai: tỉ lệ ma-nơ-canh cũ (TL) lệch người MPFB vài cm–chục cm. Không có MPFB → None (giữ TL)."""
    k = (gioi, tuoi, than)
    if k in _TL_MPFB: return _TL_MPFB[k]
    m = _mpfb()
    if not m: return None
    try:
        h = m['hs'].create_human(); _dat_than(m, h, gioi, tuoi, than)
        rig = m['hs'].add_builtin_rig(h, 'default'); bpy.context.view_layer.update()
        bb = [h.matrix_world @ Vector(c) for c in h.bound_box]; z0 = min(v.z for v in bb); C = max(v.z for v in bb) - z0
        P = lambda b, dau=True: rig.matrix_world @ (rig.data.bones[b].head_local if dau else rig.data.bones[b].tail_local)
        z = lambda v: (v.z - z0) / C
        co_chan, goi, hang = P('foot.L'), P('lowerleg01.L'), P('upperleg02.L')
        vai, khuyu, cotay = P('upperarm02.L'), P('lowerarm01.L'), P('lowerarm02.L', False)
        co, dau = P('neck01'), P('head')
        t = dict(TL)
        t['chan'] = z(co_chan); t['cang'] = (goi - co_chan).length / C; t['dui'] = (hang - goi).length / C
        z_hong = t['chan'] + t['cang'] + t['dui'] + t['hong'] * 0.5    # khớp đùi nằm dưới khớp hông nửa đoạn hông (dung_nguoi)
        S = z(co) - z_hong
        t['nguc'] = min(0.85 * S, max(0.5 * S, (z(co) - z(vai)) / 0.12)); t['bung'] = S - t['nguc']
        t['co'] = z(dau) - z(co); t['dau'] = 1.0 - z(dau)
        t['vai'] = abs(vai.x - co.x) / C; t['tay_tren'] = (khuyu - vai).length / C; t['tay_duoi'] = (cotay - khuyu).length / C
        t['hong_rong'] = abs(hang.x - co.x) / C / 0.55
        mui = P('foot.L', False); t['mui_y'] = (mui.y - co_chan.y) / C; t['mui_z'] = (mui.z - co_chan.z) / C   # mũi bàn chân so với cổ chân (MPFB nhìn −y)
        for o in [h, rig]: bpy.data.objects.remove(o, do_unlink=True)
        _TL_MPFB[k] = t; return t
    except Exception as e:
        print('đo tỉ lệ MPFB lỗi — giữ TL:', e); _TL_MPFB[k] = None; return None

def dung_nguoi(ten, cao=175.0, mau=(0.78, 0.66, 0.52, 1), mau_ao=None, dv=1.0, ten_goc=None, gioi=None, tuoi=None, trang=None):
    """dv = cỡ 1 cm trong cảnh (dung-set: 0.01 — Blender tính mét); ten_goc = tên empty gốc (dung-set đặt 'NV <tên>' để gắn neo diễn)."""
    trang = {**(trang or {}), 'da': (trang or {}).get('da') or mau}   # màu da của nhân vật → đất sét màu da (mac_do)
    H = float(cao); L = {k: v * H for k, v in (tl_mpfb(gioi, tuoi, trang.get('than')) or TL).items()}
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
        # MŨI CHÂN (anh 19/10/2026 "khớp chân lộn ngược"): khớp đích cho đoạn bàn chân của mocap + xương foot MPFB — trước đây không có, bàn chân giữ góc
        # vuông với cẳng chân ở mọi dáng → quỳ thì mũi giày chổng lên trời. Hướng = bàn chân MPFB đo ở tl_mpfb (mui_y / mui_z).
        n[f'mui_chan_{p}'] = _khop(f'{ten}.mui_chan_{p}', cochan, (0, L.get('mui_y', -0.06 * H), L.get('mui_z', -0.03 * H)))
        bc = _khoi(f'{ten}.ban_chan_{p}', cochan, 0.15 * H, 0.025 * H, 0.012 * H, ao, xuong=False)
        bc.rotation_euler.x = math.radians(90); bc.location = (0, 0.03 * H, -L["chan"] * 0.6)   # bàn chân hướng −y (mũi chân ra trước)
    n['L'] = L
    than_tron(n, ten, H, L, ao, dv)
    nguoi_mpfb(n, ten, H, gioi, tuoi, ao, trang)   # có MPFB thì thay thân liền bằng người thật (cùng tên 'THAN <ten>')
    tu_the(n, 'dung')
    return n

_MPFB = {}
def _mpfb():
    """Bật add-on MPFB (cài bằng scripts/bo-set/cai-mpfb.sh) một lần; không có (máy thuê chưa cài) → None, rơi về thân liền."""
    if 'hs' not in _MPFB:
        try:
            import addon_utils, importlib, sys
            addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
            lay = lambda p, k: next(getattr(importlib.import_module(m), k) for m in list(sys.modules) if m.endswith(p))
            _MPFB.update(hs=lay('mpfb.services.humanservice', 'HumanService'), op=lay('mpfb.entities.objectproperties', 'HumanObjectProperties'), ts=lay('mpfb.services.targetservice', 'TargetService'))
        except Exception as e:
            # KHÔNG lặng lẽ rơi về thân liền (19/10/2026: máy thuê không có MPFB → cả tập 135 dựng ra thân khối kiểu cũ, không ai báo): dừng hẳn,
            # render-khung báo ✗, không nạp. Muốn cố ý dùng thân liền: XV_CHO_THAN_LIEN=1.
            if os.environ.get('XV_CHO_THAN_LIEN') != '1': raise SystemExit(f'THIẾU MPFB trên máy dựng ({e}) — cài bằng scripts/bo-set/cai-mpfb.sh (image xv-render đã đóng sẵn)')
            print('MPFB không có — dùng thân liền (XV_CHO_THAN_LIEN=1):', e); _MPFB['hs'] = None
    return _MPFB if _MPFB.get('hs') else None

# xương MPFB (rig 'default', .L = trái nhân vật = 't' của ma-nơ-canh) → khớp đích để NHẮM (Damped Track trục Y của xương)
# cột sống + cổ nhắm ĐIỂM TRÊN ĐỈNH ĐẦU ('dinh_nham', con của khớp đầu): khớp đầu / cổ của ma-nơ-canh nằm THẤP hơn gốc cổ MPFB (~136 so với ~142 cm)
# → Damped Track lật chúi xuống, đầu gập vào thân (thử 18/10 hai lần)
# cổ nhắm 'co_nham' lệch RA TRƯỚC một chiều dài đầu: xương cổ MPFB ở tư thế gốc nghiêng tới ~15°, kéo thẳng đứng thì đầu ngửa trời (18/10: mọi
# ảnh độ sâu / khung màu hất cằm, FLUX vẽ người ngước lên)
_NHAM = [('spine05', 'dinh_nham'), ('spine04', 'dinh_nham'), ('spine03', 'dinh_nham'), ('spine02', 'dinh_nham'), ('spine01', 'dinh_nham'), ('neck01', 'co_nham'),
         ('upperarm01.L', 'khuyu_t'), ('lowerarm01.L', 'cotay_t'), ('upperarm01.R', 'khuyu_p'), ('lowerarm01.R', 'cotay_p'),
         ('upperleg01.L', 'goi_t'), ('lowerleg01.L', 'cochan_t'), ('upperleg01.R', 'goi_p'), ('lowerleg01.R', 'cochan_p'), ('foot.L', 'mui_chan_t'), ('foot.R', 'mui_chan_p')]
# BẢNG CẢM XÚC CỦA PHIM → 52 đơn vị cơ mặt ARKit (gói MakeHuman faceunits01, CC0) — anh 18/10/2026 "làm biểu cảm 3D": mặt MPFB diễn đúng nét của shot,
# vào bản đồ độ sâu + khung màu nên ở shot cận FLUX nhận hình khối mặt đã biến dạng (há miệng gào, mắt nhắm siết) thay vì chỉ đọc chữ.
# Mã = qc-cam-xuc.ts › BIEU_CAM. '*' = cả hai bên (Left + Right).
BIEU_CAM_ARKIT = {
    'binh_thuong': {},
    'hao_huc': {'mouthSmile*': 0.6, 'eyeWide*': 0.4, 'browOuterUp*': 0.3},
    'vui': {'mouthSmile*': 0.55, 'cheekSquint*': 0.3},
    'cuoi_lon': {'mouthSmile*': 1.0, 'jawOpen': 0.35, 'cheekSquint*': 0.6, 'eyeSquint*': 0.45},
    'am_ap': {'mouthSmile*': 0.4, 'eyeSquint*': 0.2},
    'nhe_nhom': {'mouthSmile*': 0.25, 'browInnerUp': 0.15, 'eyeBlink*': 0.15},
    'bat_ngo': {'eyeWide*': 0.8, 'browInnerUp': 0.6, 'browOuterUp*': 0.7, 'jawOpen': 0.3},
    'ngo_vuc': {'browDownLeft': 0.5, 'browOuterUpRight': 0.5, 'eyeSquint*': 0.3, 'mouthPress*': 0.3},
    'tu_tin': {'mouthSmileLeft': 0.25, 'mouthPress*': 0.2, 'browDown*': 0.1},
    'lo_lang': {'browInnerUp': 0.65, 'mouthStretch*': 0.3, 'mouthPress*': 0.3, 'eyeWide*': 0.2},
    'dau': {'browInnerUp': 0.7, 'browDown*': 0.3, 'eyeSquint*': 0.6, 'mouthStretch*': 0.5, 'jawOpen': 0.12},
    'met': {'eyeBlink*': 0.35, 'mouthFrown*': 0.2, 'browInnerUp': 0.2},
    'buon': {'browInnerUp': 0.8, 'mouthFrown*': 0.6, 'mouthShrugLower': 0.4, 'eyeLookDown*': 0.3},
    'that_vong': {'browInnerUp': 0.5, 'mouthFrown*': 0.5, 'eyeLookDown*': 0.4, 'eyeBlink*': 0.2},
    'lanh_lung': {'browDown*': 0.3, 'eyeSquint*': 0.2, 'mouthPress*': 0.4},
    'khinh_bi': {'noseSneerLeft': 0.5, 'mouthUpperUpLeft': 0.3, 'mouthSmileLeft': 0.25, 'eyeSquint*': 0.3, 'browDownRight': 0.3},
    'dac_y': {'mouthSmileLeft': 0.6, 'mouthSmileRight': 0.2, 'eyeSquint*': 0.3, 'browOuterUpLeft': 0.3},
    'nhuc_nha': {'browInnerUp': 0.6, 'mouthFrown*': 0.4, 'eyeLookDown*': 0.6, 'mouthPress*': 0.4},
    'nhan_nhin': {'mouthPress*': 0.5, 'browInnerUp': 0.3, 'browDown*': 0.2, 'eyeSquint*': 0.2},
    'gian': {'browDown*': 1.0, 'eyeSquint*': 0.5, 'noseSneer*': 0.6, 'mouthFrown*': 0.4, 'mouthUpperUp*': 0.3, 'jawForward': 0.2},
    'soc': {'eyeWide*': 1.0, 'browInnerUp': 0.8, 'browOuterUp*': 0.8, 'jawOpen': 0.55, 'mouthStretch*': 0.3},
    'quyet_tam': {'browDown*': 0.5, 'mouthPress*': 0.6, 'eyeSquint*': 0.3},
    'nhech_moi': {'mouthSmileLeft': 0.5, 'eyeSquint*': 0.2},
    'khoc_tham': {'browInnerUp': 1.0, 'eyeBlink*': 0.65, 'eyeSquint*': 0.8, 'jawOpen': 0.6, 'mouthFrown*': 1.0, 'mouthStretch*': 0.7,
                  'mouthLowerDown*': 0.6, 'mouthUpperUp*': 0.4, 'noseSneer*': 0.5, 'cheekSquint*': 0.4},
    'cuoi_dau': {'mouthSmile*': 0.8, 'jawOpen': 0.4, 'browInnerUp': 0.9, 'eyeSquint*': 0.8, 'eyeBlink*': 0.45, 'cheekSquint*': 0.5, 'mouthStretch*': 0.3},
}
def bieu_mat(n, ma, cuong_do=1.0, mat=None):
    """Áp nét mặt `ma` (BIEU_CAM_ARKIT) lên thân MPFB của ma-nơ-canh n; `mat` = khoá eyeLook* (mat_nhin) đè lên phần mắt của nét mặt.
    Nhớ nét đang áp vào n để mat_nhin áp lại cả hai một lượt (FaceService.set_expression thay TOÀN BỘ biểu cảm). Không có MPFB → bỏ qua."""
    m = _mpfb(); h = n.get('than_tron')
    if not m or not h or h.name not in bpy.data.objects or not h.name.startswith('THAN '): return False
    if ma is not None: n['net_ma'] = (ma, cuong_do)
    ma, cuong_do = n.get('net_ma') or ('', 1.0)
    bang = BIEU_CAM_ARKIT.get(ma, {}) if ma else {}
    if ma and ma not in BIEU_CAM_ARKIT: print('nét mặt chưa có trong bảng:', ma)
    da = bpy.data.objects.get(h.name + '.da')
    if da and da.data.shape_keys:   # da 3D (gan_da_3d): biểu cảm đã nướng thành shape key cùng tên đơn vị ARKit (nguoi-3d/gan-rig.py › nuong_mat)
        dd = {}
        for k, v in bang.items():
            for kk in ([k[:-1] + 'Left', k[:-1] + 'Right'] if k.endswith('*') else [k]): dd[kk] = max(0.0, min(1.0, v * cuong_do))
        for kb in da.data.shape_keys.key_blocks[1:]: kb.value = dd.get(kb.name, 0.0)
    if not bang and not mat: return False
    try:
        import importlib, sys
        FS = next(getattr(importlib.import_module(x), 'FaceService') for x in list(sys.modules) if x.endswith('mpfb.services.faceservice'))
        d = {}
        for k, v in bang.items():
            for kk in ([k[:-1] + 'Left', k[:-1] + 'Right'] if k.endswith('*') else [k]): d[kk] = max(0.0, min(1.0, v * cuong_do))
        if mat:
            for k in [x for x in d if x.startswith('eyeLook')]: del d[k]
            d.update(mat)
        FS.clear_expression(h); FS.set_expression(h, d); return True
    except Exception as e:
        print('nét mặt MPFB lỗi:', e); return False

# MẮT NHÌN ĐÍCH (anh 19/10/2026: "ánh nhìn, hướng nhìn rồi chuyển cảnh … làm mấy lần vẫn chưa ổn"): trước đây chỉ QUAY ĐẦU (nhin / huong) — mắt
# ma-nơ-canh luôn nhìn thẳng theo mặt, ảnh 3D không mang hướng mắt, model tự vẽ (thường nhìn ống kính). Nay mắt xoay về đích bằng khoá ARKit
# eyeLook{In,Out,Up,Down}{Left,Right}: 1,0 ≈ 30° ngang / 25° dọc (biên độ mắt người thật ~30–35°; quá biên thì đầu phải quay — việc của huong).
MAT_NGANG, MAT_DOC = 30.0, 25.0
def mat_khoa(yaw, pitch):
    """Góc (độ) của đích so với mặt — yaw + = sang TRÁI nhân vật, pitch + = lên — thành khoá eyeLook*. Thuần (không cần Blender)."""
    k = min(1.0, abs(yaw) / MAT_NGANG); d = {}
    if yaw > 0: d.update({'eyeLookOutLeft': k, 'eyeLookInRight': k})
    elif yaw < 0: d.update({'eyeLookInLeft': k, 'eyeLookOutRight': k})
    kd = min(1.0, abs(pitch) / MAT_DOC)
    if pitch > 0: d.update({'eyeLookUpLeft': kd, 'eyeLookUpRight': kd})
    elif pitch < 0: d.update({'eyeLookDownLeft': kd, 'eyeLookDownRight': kd})
    return {k_: round(v, 3) for k_, v in d.items() if v > 0.02}

def con_nguoi(n, h, rig):
    """CHẤM CON NGƯƠI (anh 19/10/2026 chọn "chấm con ngươi tối"): thân đất sét KHÔNG mắt (anh 18/10 — mắt MakeHuman ở cận trông như quái thai), nên ảnh
    3D không cho AI biết nhân vật nhìn đâu. Hai chấm tròn tối ở mặt trước nhãn cầu, theo xương eye.L / eye.R của rig MPFB. KHÔNG gắn cha-con vào
    xương (thử 19/10: rig bị dời / co theo ma-nơ-canh sau khi gắn → chấm nổi trên đỉnh đầu) — dat_con_nguoi đặt lại SAU khi đã đặt dáng."""
    vl = bpy.data.materials.get('con_nguoi') or bpy.data.materials.new('con_nguoi'); vl.use_nodes = True
    b_ = vl.node_tree.nodes.get('Principled BSDF')
    if b_: b_.inputs['Base Color'].default_value = (0.025, 0.022, 0.02, 1); b_.inputs['Roughness'].default_value = 0.35
    import bmesh
    ten = []
    for x in ('eye.L', 'eye.R'):
        if x not in rig.data.bones: continue
        me = bpy.data.meshes.new(f'{h.name}.con_nguoi_{x[-1]}'); o = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(o)
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.0042); bm.to_mesh(me); bm.free()
        me.materials.append(vl); [setattr(pl, 'use_smooth', True) for pl in me.polygons]; ten.append((x, o.name))
    n['rig_ten'] = rig.name; n['con_nguoi'] = ten

def dat_con_nguoi(n):
    """Đặt chấm con ngươi theo xương mắt ĐÃ ĐẶT DÁNG (sau tư thế / mocap / xoay mắt): tâm nhãn cầu + 11,8 mm theo hướng xương, co theo khoảng cách
    hai mắt (người thật ~5,8 cm)."""
    from mathutils import Vector
    rig = bpy.data.objects.get(n.get('rig_ten') or '')
    if not rig or not n.get('con_nguoi'): return False
    bpy.context.view_layer.update()
    M = {x: rig.matrix_world @ rig.pose.bones[x].matrix for x, _ in n['con_nguoi'] if x in rig.pose.bones}
    if len(M) < 2: return False
    k = (M['eye.L'].translation - M['eye.R'].translation).length / 0.058
    md = n.get('mat_da')
    if md:   # da 3D: chấm nằm trên CON NGƯƠI VẼ của da, xoay quanh tâm nhãn cầu của da theo xương mắt (mắt da không trùng mắt MPFB)
        pb = rig.pose.bones; hd = pb.get('head'); s_ = rig.scale[0]
        for x, ten in n['con_nguoi']:
            o = bpy.data.objects.get(ten)
            if not o or x not in md or x not in pb or not hd: continue
            p = Vector(md[x]) / s_; tam = p + Vector((0, 0.011, 0)) / s_
            tam_p = hd.matrix @ hd.bone.matrix_local.inverted() @ tam
            R = (pb[x].matrix @ pb[x].bone.matrix_local.inverted()).to_3x3()
            o.location = rig.matrix_world @ (tam_p + R @ (p - tam + Vector((0, -0.0015, 0)) / s_)); o.scale = (k, k, k)
        return True
    for x, ten in n['con_nguoi']:
        o = bpy.data.objects.get(ten)
        if not o or x not in M: continue
        truc = (M[x].to_3x3() @ Vector((0, 1, 0))).normalized()
        o.location = M[x].translation + truc * 0.0118 * k; o.scale = (k, k, k)
    return True

# NGÓN TAY NGƯỜI THẬT (19/10/2026, nhịp 3 "tay cầm đồ"): xương bám ma-nơ-canh (_NHAM) không có ngón → bàn tay MPFB luôn DUỖI PHẲNG, kể cả khi cầm
# ly / giấy / điện thoại (keyframe AI chép tay xoè đỡ đồ). Khép 15 xương ngón finger{1..5}-{1..3}.{L,R} quanh trục X (+ = khép vào lòng — dựng thử
# hai tay 19/10). muc 1,0 = nắm đồ; 0,3 = tay rảnh cong nhẹ như người thật (tay duỗi thẳng là dấu hiệu ma-nơ-canh). Ngón cái khép ít hơn.
NGON_DO = {1: 25.0, 2: 50.0, 3: 52.0, 4: 54.0, 5: 56.0}
def nam_ngon(n, ben, muc):
    """Khép ngón bàn tay `ben` ('t' = trái nhân vật = .L, 'p' = .R) mức muc 0..1 trên rig MPFB của n."""
    rig = bpy.data.objects.get(n.get('rig_ten') or '')
    if not rig: return False
    hau = '.L' if ben == 't' else '.R'
    for b in rig.pose.bones:
        if b.name.startswith('finger') and b.name.endswith(hau) and b.name[6:7].isdigit():
            b.rotation_mode = 'XYZ'; b.rotation_euler.x = math.radians(NGON_DO.get(int(b.name[6]), 50.0) * muc)
    return True

def mat_nhin(n, dich):
    """Xoay mắt ma-nơ-canh n về điểm `dich` (toạ độ thế giới, m) — gọi SAU khi đã đặt dáng / mocap (hướng đầu cuối cùng)."""
    from mathutils import Vector
    if not dich or 'dau' not in n: return False
    bpy.context.view_layer.update()
    M = n['dau'].matrix_world; R = M.to_3x3().normalized()
    truoc, trai, len_ = R @ Vector((0, -1, 0)), R @ Vector((1, 0, 0)), R @ Vector((0, 0, 1))
    mat = M.translation + len_ * (0.065 * n.get('cao', 175.0) / 175.0)   # mắt ~6,5 cm trên khớp đầu (cao tính bằng cm, thế giới bằng m)
    d = Vector(dich) - mat
    f = d.dot(truoc)
    if f <= 0.05: return False   # đích sau lưng / ngang tai — đầu phải quay (huong), mắt không với tới
    yaw = math.degrees(math.atan2(d.dot(trai), f)); pitch = math.degrees(math.atan2(d.dot(len_), f))
    # XOAY XƯƠNG MẮT (chấm con ngươi đi theo) về đích, kẹp trong biên độ mắt người — quá biên thì đầu phải quay (huong), mắt dừng ở mép
    rig = bpy.data.objects.get(n.get('rig_ten') or '')
    if rig:
        from mathutils import Matrix
        y_, p_ = math.radians(max(-MAT_NGANG, min(MAT_NGANG, yaw))), math.radians(max(-MAT_DOC, min(MAT_DOC, pitch)))
        huong = (Matrix.Rotation(y_, 3, len_) @ Matrix.Rotation(-p_, 3, trai) @ truoc).normalized()
        e = bpy.data.objects.get(f"{n['ten']}.dich_mat") or bpy.data.objects.new(f"{n['ten']}.dich_mat", None)
        if e.name not in bpy.context.scene.collection.objects: bpy.context.scene.collection.objects.link(e)
        e.location = mat + huong * 2.0
        for x in ('eye.L', 'eye.R'):
            pb = rig.pose.bones.get(x)
            if not pb: continue
            for c_ in [c_ for c_ in pb.constraints if c_.name == 'nhin_dich']: pb.constraints.remove(c_)
            c_ = pb.constraints.new('DAMPED_TRACK'); c_.name = 'nhin_dich'; c_.target = e; c_.track_axis = 'TRACK_Y'
        bpy.context.view_layer.update()
    dat_con_nguoi(n)
    return bieu_mat(n, None, mat=mat_khoa(yaw, pitch))   # mí mắt theo hướng nhìn (khoá eyeLook*)

def nguoi_mpfb(n, ten, H, gioi, tuoi, vl, trang=None):
    """NGƯỜI THẬT MPFB thay thân liền (anh 18/10/2026 chọn "D"): thân người MakeHuman (CC0) đúng giới / tuổi / chiều cao, rig mặc định; mỗi xương
    NHẮM theo khớp tương ứng của ma-nơ-canh (Damped Track) + hông bám khớp hông — thư viện dáng / mocap / đo đạc giữ nguyên, chỉ hình hiển thị là
    người thật. Gắn vào gốc ma-nơ-canh nên đi / quay theo. Chỉ hiện khi vẽ độ sâu (như thân liền). Không có MPFB → giữ thân liền."""
    m = _mpfb()
    if not m: return None
    o = bpy.data.objects.get(f'THAN_RIG {ten}')
    if o: bpy.data.objects.remove(o, do_unlink=True)   # rig của shot trước (thân cũ đã bị than_tron dọn)
    if 'dinh_nham' not in n: n['dinh_nham'] = _khop(f'{ten}.dinh_nham', n['dau'], (0, 0, 2.5 * n['L']['dau']))   # trên đỉnh đầu, theo độ nghiêng đầu
    if 'co_nham' not in n: n['co_nham'] = _khop(f'{ten}.co_nham', n['dau'], (0, -1.0 * n['L']['dau'], 2.5 * n['L']['dau']))
    h = m['hs'].create_human(); _dat_than(m, h, gioi, tuoi, (trang or {}).get('than'))
    rig = m['hs'].add_builtin_rig(h, 'default')
    bpy.context.view_layer.update()
    bb = [h.matrix_world @ Vector(c) for c in h.bound_box]; cao_m = max(v.z for v in bb) - min(v.z for v in bb)
    rig.scale = (H * 0.01 / cao_m,) * 3; bpy.context.view_layer.update()
    goc = n['goc']; rig.parent = goc; rig.matrix_parent_inverse = goc.matrix_world.inverted()   # theo gốc (đi / quay), giữ cỡ mét thật
    for xuong, khop in _NHAM:
        pb = rig.pose.bones.get(xuong)
        if not pb or khop not in n: continue
        c = pb.constraints.new('DAMPED_TRACK'); c.target = n[khop]; c.track_axis = 'TRACK_Y'
    pr = rig.pose.bones.get('root')
    if pr: c = pr.constraints.new('COPY_LOCATION'); c.target = n['hong']
    # GỐI / KHUỶU bằng IK có ĐIỂM HƯỚNG (pole) — chuẩn rig ngành: Damped Track từng xương không quy định gối quay về đâu, gập mạnh (quỳ, ngồi) là gối lật
    # ngược ra sau (anh 18/10/2026: "chân ngược hết cả", #5 quỳ). Pole = điểm 40 cm trước gối / sau khuỷu, con của khớp gối / khuỷu ma-nơ-canh nên
    # xoay theo dáng; đích IK = cổ chân / cổ tay ma-nơ-canh.
    import os as _os
    goc_pole = math.radians(float(_os.environ.get('XV_POLE_GOC', POLE_GOC)))
    for p, bx, k1, k2, lech in (('t', 'L', 'goi', 'cochan', -40), ('p', 'R', 'goi', 'cochan', -40), ('t', 'L', 'khuyu', 'cotay', 40), ('p', 'R', 'khuyu', 'cotay', 40)):
        # rig MakeHuman chia mỗi đoạn chi làm HAI xương: *01 (đoạn hông / vai ngắn) + *02 (đùi / cánh tay thật), lower*01 + lower*02 (ống chân / cẳng tay
        # chia đôi để xoắn). Chuỗi IK = lower*02 → lower*01 → upper*02; lower*02 khoá IK (thẳng hàng lower*01) để chỉ GẬP ở gối / khuỷu.
        g = 'leg' if k1 == 'goi' else 'arm'
        bs = [rig.pose.bones.get(f'{x}{g}0{i}.{bx}') for x, i in (('upper', 1), ('upper', 2), ('lower', 1), ('lower', 2))]
        if None in bs or f'{k1}_{p}' not in n or f'{k2}_{p}' not in n: continue
        for b in bs:
            for c in list(b.constraints): b.constraints.remove(c)
        bs[3].lock_ik_x = bs[3].lock_ik_y = bs[3].lock_ik_z = True
        pole = _khop(f'{ten}.pole_{k1}_{p}', n[f'{k1}_{p}'], (0, lech, 0))
        ik = bs[3].constraints.new('IK'); ik.target = n[f'{k2}_{p}']; ik.pole_target = pole; ik.pole_angle = goc_pole; ik.chain_count = 3
    # CỘT SỐNG bằng IK: đỉnh cổ MPFB (neck01) bám ĐÚNG khớp đầu ma-nơ-canh (vị trí, không chỉ hướng) — Damped Track cũ để đầu lệch 6–17 cm khi cúi / quỳ
    # → máy cận ngắm trượt mặt (#24). Đầu MPFB xoay theo điểm 'co_nham' như cổ trước đây (hết ngửa trời).
    hb = rig.pose.bones.get('head')
    if hb and hb.parent:
        chuoi = []; b = hb.parent   # xương ngay dưới đầu (neck0x) → lên tới spine05: chuỗi IK để GỐC ĐẦU trùng khớp đầu ma-nơ-canh
        while b and b.name != 'root' and not b.name.startswith('pelvis'): chuoi.append(b); b = b.parent
        for b in chuoi + [hb]:
            for c in list(b.constraints): b.constraints.remove(c)
        ik = hb.parent.constraints.new('IK'); ik.target = n['dau']; ik.chain_count = len(chuoi)
        c = hb.constraints.new('DAMPED_TRACK'); c.target = n['dinh_nham']; c.track_axis = 'TRACK_Y'
    cu = n.get('than_tron')
    if cu and cu.name in bpy.data.objects: bpy.data.objects.remove(cu, do_unlink=True)   # thân liền dự phòng: xoá TRƯỚC khi đặt tên, kẻo tên mới thành '.001'
    for o in [o for o in bpy.data.objects if o.name.startswith(f'THAN {ten}.')]: bpy.data.objects.remove(o, do_unlink=True)   # tóc / đồ của người shot trước
    h.name = f'THAN {ten}'; rig.name = f'THAN_RIG {ten}'
    if not mac_do(m, h, gioi, tuoi, trang or {}):   # da + mắt + lông mày + tóc + đồ + giày; thiếu gói tài sản thì thân trơn một màu như cũ
        h.data.materials.clear(); h.data.materials.append(vl)
    con_nguoi(n, h, rig)   # chấm con ngươi tối gắn xương mắt — hướng nhìn đọc được trên ảnh 3D (mat_nhin xoay xương)
    gan_da_3d(n, ten, h, rig, (trang or {}).get('da_3d'), (trang or {}).get('da_che_do') or 'ca')
    for o in [h, *phu_kien(h)]: o.hide_render = o.hide_viewport = True   # chỉ bật khi vẽ độ sâu / khung màu (dung-set.py › nguoi_that)
    n['than_tron'] = h
    return h

def gan_da_3d(n, ten, h, rig, url, che_do='ca'):
    """DA 3D SINH TỪ ẢNH (khoi_3d.da_3d — anh 21/10/2026 "người đủ chi tiết và rig", kiểu Tripo): mesh ảnh→3D đã chép trọng số da từ thân MPFB cùng giới /
    tuổi / cao (scripts/bo-set/nguoi-3d/gan-rig.py → da.blend trên R2). Gắn vào ĐÚNG rig MPFB của người này → mocap / IK / dáng lái như thân MPFB; thân
    MPFB + tóc / đồ / chấm mắt của nó đánh dấu an_han (nguoi_that không bật). Tải một lần vào tai-san/da-3d/. Không khai / tải hỏng → giữ thân MPFB."""
    if not url: return None
    import os, urllib.request
    kho = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tai-san', 'da-3d'); os.makedirs(kho, exist_ok=True)
    tep = url if os.path.isfile(url) else os.path.join(kho, url.rstrip('/').split('/')[-1])   # đường dẫn tệp cục bộ: thử da trước khi đưa lên kho (thu-da.py)
    try:
        if not os.path.exists(tep):
            tam = f'{tep}.{os.getpid()}.tai'   # tên tạm RIÊNG từng tiến trình: dien-tap chạy 3 shot song song cùng tải một da (21/10: hai shot rơi về MPFB)
            urllib.request.urlretrieve(url, tam); os.replace(tam, tep)
        with bpy.data.libraries.load(tep, link=False) as (src, dst): dst.objects = [x for x in src.objects if x == 'DA']
        da = dst.objects[0]
    except Exception as e:
        print(f'CANH BAO da_3d {ten} không tải được ({e}) — giữ thân MPFB'); return None
    bpy.context.scene.collection.objects.link(da)
    cn = {t_ for _, t_ in n.get('con_nguoi', [])}
    if che_do == 'dau' and 'giu_dau' in da.vertex_groups and 'dau_ve_mpfb' in da:
        # CHỈ ĐẦU: da còn đầu + tóc (nhóm giu_dau), dời / co về đúng đầu MPFB; thân + đồ MPFB theo trang phục của shot giữ nguyên. Đầu MPFB giấu bằng
        # Mask (nhóm 'dau_an'), tóc MPFB an_han — tóc là của da.
        import bmesh
        dv = da['dau_ve_mpfb']; tda, tmp, k_ = Vector(dv['tam_da']), Vector(dv['tam_mpfb']), dv['ti_le']
        gi = da.vertex_groups['giu_dau'].index
        bm = bmesh.new(); bm.from_mesh(da.data); dl = bm.verts.layers.deform.active
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not (dl and v[dl].get(gi, 0) >= 0.5)], context='VERTS')
        cac = [bm.verts.layers.shape[x] for x in bm.verts.layers.shape.keys()]
        ti = da.vertex_groups['toc_duoi'].index if 'toc_duoi' in da.vertex_groups else None
        bm.normal_update()
        for v in bm.verts:
            # tóc rủ dưới gáy nằm trên lưng của DA, mà lưng thân MPFB + áo dày hơn → tóc chìm trong áo; đẩy ra 2 cm theo pháp tuyến (thử 21/10)
            day = v.normal * 0.02 if ti is not None and dl and v[dl].get(ti, 0) > 0.5 else Vector()
            v.co = tmp + (v.co - tda) / k_ + day
            for L_ in cac: v[L_] = tmp + (v[L_] - tda) / k_ + day
        bm.to_mesh(da.data); bm.free(); da.data.update()
        if 'mat_da' in da: da['mat_da'] = {x: list(tmp + (Vector(p_) - tda) / k_) for x, p_ in da['mat_da'].items()}
        dau_ = {b.name for b in rig.data.bones if b.name == 'head' or any(x.name == 'head' for x in b.parent_recursive)}
        ga = h.vertex_groups.new(name='dau_an'); gid = {g.index for g in h.vertex_groups if g.name in dau_}
        for v in h.data.vertices:
            if sum(gg.weight for gg in v.groups if gg.group in gid) > 0.5: ga.add([v.index], 1.0, 'REPLACE')
        mk = h.modifiers.new('an_dau', 'MASK'); mk.vertex_group = 'dau_an'; mk.invert_vertex_group = True
        try: toc = set(os.listdir(os.path.join(bpy.utils.extension_path_user('bl_ext.user_default.mpfb'), 'data', 'hair')))
        except Exception: toc = set(TOC_MAC.values())
        for o in phu_kien(h):
            if o.name.split('.', 1)[-1].split('.')[0] in toc: o['an_han'] = True
    else:
        for o in [h, *phu_kien(h)]:
            if o.name not in cn: o['an_han'] = True
    if 'mat_da' in da:   # con ngươi vẽ trên da (gan-rig.py đo bằng điểm mốc YuNet) → chấm mắt đặt theo đó (dat_con_nguoi)
        n['mat_da'] = {k_: list(v_) for k_, v_ in da['mat_da'].items()}
    else:   # da cũ chưa đo mắt: chấm theo mắt MPFB nổi trên má (21/10/2026 tập 135 #2) → bỏ
        for t_ in cn:
            if t_ in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[t_], do_unlink=True)
        n['con_nguoi'] = []
    da.name = f'{h.name}.da'; da.parent = rig; da.matrix_parent_inverse = Matrix.Identity(4)
    da.location = (0, 0, 0); da.rotation_euler = (0, 0, 0); da.scale = tuple(1 / x for x in rig.scale)   # da tính bằng mét, rig mang scale MPFB → mét
    for md in [md for md in da.modifiers if md.type == 'ARMATURE']: da.modifiers.remove(md)
    md = da.modifiers.new('xuong', 'ARMATURE'); md.object = rig
    return da

# TRANG PHỤC NGƯỜI THẬT (anh 18/10/2026: "3D đã có người thật mẫu sao không thấy trên bản chụp đầu cuối"): gói makehuman_system_assets (CC0, cai-mpfb.sh)
# — da châu Á theo tuổi / giới, mắt, lông mày, tóc, bộ đồ, giày. Màu đồ = màu áo của shot (ao), màu tóc = khoi_3d.mau_toc; vân vải của gói bỏ đi (vest
# kẻ sọc của gói làm AI vẽ sai đồ). Khai riêng từng nhân vật ở khoi_3d: toc (long01 · ponytail01 · bob01 · short02 …), do (female_elegantsuit01 …).
POLE_GOC = -90   # độ: trục xoay của xương MPFB so với hướng pole (đo bằng ảnh thử 18/10)
TOC_MAC = {'nu': 'long01', 'nam': 'short02'}
DO_MAC = {'nu': 'female_elegantsuit01', 'nam': 'male_elegantsuit01'}
def phu_kien(h):
    return [o for o in bpy.data.objects if o.name.startswith(h.name + '.')]
def _to_mau(o, rgba):
    for ms in o.material_slots:
        mt = ms.material
        if not mt or not mt.use_nodes: continue
        for nd in mt.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                for l in list(nd.inputs['Base Color'].links): mt.node_tree.links.remove(l)
                nd.inputs['Base Color'].default_value = rgba
def mac_do(m, h, gioi, tuoi, trang):
    import os
    # thư mục dữ liệu MPFB theo Blender (macOS / Linux đều đúng) — trước 19/10/2026 viết cứng đường Mac: máy thuê Linux không thấy tóc / đồ
    try: dd = os.path.join(bpy.utils.extension_path_user('bl_ext.user_default.mpfb'), 'data')
    except Exception: dd = os.path.expanduser('~/Library/Application Support/Blender/5.0/extensions/.user/user_default/mpfb/data')
    if not os.path.isdir(os.path.join(dd, 'hair')): return False
    # ĐẤT SÉT PREVIS (anh 18/10/2026 chọn, sau khi da / mắt MakeHuman ở cận trông như quái thai — thung lũng kỳ dị): thân một màu đất sét mờ, KHÔNG
    # mắt / lông mày / vân da; tóc giữ hình, tô một màu; đồ tô màu áo của shot. Chuẩn previs ngành: đọc bố cục + diễn, mặt thật là việc của keyframe AI.
    sk = bpy.data.materials.new('dat_set_da'); sk.use_nodes = True   # mỗi người một vật liệu (màu da riêng)
    bs_ = sk.node_tree.nodes.get('Principled BSDF')
    # ĐẤT SÉT MÀU DA (anh 19/10/2026 "làm sao con mẫu nhìn đỡ ghê"): trước là một màu đất sét chung → dưới đèn ngày thành mặt trắng bệch. Nay tông
    # da CỦA nhân vật (khoi_3d.mau), mờ, không vân — AI đọc đúng tông da + ánh sáng trên da, mặt vẫn không chi tiết để tranh danh tính với ảnh mẫu.
    da = trang.get('da') or (0.62, 0.55, 0.49, 1); sk.name = f'dat_set_da_{"%.2f_%.2f_%.2f" % tuple(da[:3])}'
    if bs_: bs_.inputs['Base Color'].default_value = (*da[:3], 1); bs_.inputs['Roughness'].default_value = 0.7
    h.data.materials.clear(); h.data.materials.append(sk)
    gk = gioi if gioi in TOC_MAC else 'nu'
    for thu, ma, kieu in (('hair', trang.get('toc') or TOC_MAC[gk], 'Hair'),
                          *[('clothes', x, 'Clothes') for x in (trang.get('do') or DO_MAC[gk]).split('+')],   # món 'tên:#màu' = giữ màu riêng (áo trắng + quần đen)
                          *([] if any(t_ in (trang.get('do') or '') for t_ in ('shoe', 'boot', 't-bar', 'heel')) else [('clothes', 'shoes01', 'Clothes')])):   # do: 'áo+quần[+giày]' (gói cộng đồng — cai-mpfb.sh)
        ma, _, mau_rieng = ma.partition(':')
        try:
            o = m['hs'].add_mhclo_asset(os.path.join(dd, thu, ma, f'{ma}.mhclo'), h, asset_type=kieu)
            if mau_rieng:
                hx = mau_rieng.lstrip('#'); _to_mau(o, (*[(int(hx[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)], 1)); mau_rieng = 'xong'
            if kieu == 'Hair' and trang.get('mau_toc'): _to_mau(o, trang['mau_toc'])
            if kieu == 'Clothes' and ma != 'shoes01' and trang.get('ao') and not mau_rieng: _to_mau(o, trang['ao'])
            if kieu == 'Clothes' and ma != 'shoes01':   # vải nổi ra 4 mm: đùi / hông xuyên váy thành lỗ thủng (thử 18/10)
                dp = o.modifiers.new('noi_vai', 'DISPLACE'); dp.strength = 0.004; dp.mid_level = 0
            if ma == 'shoes01': _to_mau(o, (0.02, 0.02, 0.02, 1))
        except Exception as e: print('trang phục MPFB lỗi:', ma, e)
    return True

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
    'lac_treo': {'vai_p': (-108, 10, 0), 'khuyu_p': (-5, 0, 0)},                                               # duỗi thẳng tay lên ngang mặt người đối diện (−108°, khuỷu −5°: khuỷu gập −15° thành dáng vẫy chào; ngang vai −88° / −97° thì thẻ rơi vào thùng Hạ ôm ngực, #13), món TREO lủng lẳng ngang mặt người đối diện (#11 thẻ đeo)
    # DÁNG CẢM XÚC (anh 18/10/2026 "hỉ nộ ái ố đầy đủ — tư thế khi diễn biểu cảm"): LoRA chỉ học MẶT, dáng thân do khung 3D quyết; đi kèm nét mặt
    # (bieu_mat) của cùng shot. Tay hướng vào thân: khuỷu z dương phía phải 'p' / âm phía trái 't' (như khoanh_tay).
    'om_mat_khoc': {'lung': (14, 0, 0), 'dau': (22, 0, 0), 'vai_t': (-50, 10, 0), 'vai_p': (-50, -10, 0), 'khuyu_t': (-135, 0, -50), 'khuyu_p': (-135, 0, 50)},  # hai tay ôm mặt khóc, cúi
    'om_nguc_khoc': {'lung': (24, 0, 0), 'nguc': (8, 0, 0), 'dau': (12, 0, 0), 'vai_p': (-28, 4, 0), 'khuyu_p': (-118, 0, 28), 'vai_t': (-30, -4, 0)},        # gập người, tay ấn ngực
    'quy_khoc': {'hong_cao': 0.27, 'dui_t': (8, 0, 0), 'goi_t': (95, 0, 0), 'dui_p': (8, 0, 0), 'goi_p': (95, 0, 0), 'lung': (30, 0, 0), 'dau': (20, 0, 0),
                 'vai_t': (-45, -5, 0), 'vai_p': (-45, 5, 0)},                                                  # quỵ hai gối, gục, tay buông trước
    'ngua_mat_gao': {'lung': (-8, 0, 0), 'dau': (-35, 0, 0), 'vai_t': (4, -14, 0), 'vai_p': (4, 14, 0)},      # ngửa mặt gào khóc, tay buông thõng
    'chi_tay_gian': {'lung': (8, 0, 0), 'vai_p': (-85, 4, 0), 'khuyu_p': (-6, 0, 0)},                          # chồm tới chỉ thẳng tay
    'lui_so': {'lung': (-10, 0, 0), 'dau': (-8, 0, 0), 'vai_t': (-50, -12, 0), 'vai_p': (-50, 12, 0), 'khuyu_t': (-60, 0, 0), 'khuyu_p': (-60, 0, 0)},  # lùi lại, hai tay đưa lên che
    'om_nguoi': {'lung': (10, 0, 0), 'vai_t': (-30, -4, 0), 'vai_p': (-30, 4, 0), 'khuyu_t': (-110, 0, -45), 'khuyu_p': (-110, 0, 45)},  # tự ôm lấy mình
    'tay_che_mieng': {'vai_t': (-45, 10, 0), 'vai_p': (-45, -10, 0), 'khuyu_t': (-140, 0, -50), 'khuyu_p': (-140, 0, 50)},  # hai tay che miệng (sốc / mừng)
    'nghe_dien_thoai': {'vai_p': (-35, 25, 0), 'khuyu_p': (-145, 0, 40), 'dau': (0, 6, 0)},   # áp điện thoại vào tai phải (mocap CMU 79_36 là kịch câm, tay không tới tai)
    'tay_tran_cui': {'lung': (20, 0, 0), 'dau': (15, 0, 0), 'vai_p': (-62, -6, 0), 'khuyu_p': (-150, 0, 18)},  # cúi gập, tay áp trán (cười trong đau)
    'hat': {'vai_p': (-90, 5, 0), 'khuyu_p': (-8, 0, 0), 'lung': (10, 0, 0), 'nguc': (0, 0, 12)},               # hất / ném mạnh ra trước
    'giat': {'vai_p': (-97, 4, 0), 'khuyu_p': (-12, 0, 0), 'lung': (12, 0, 0), 'nguc': (0, 0, 15)},             # vươn tay giật
    'chong_ban': {'lung': (28, 0, 0), 'nguc': (10, 0, 0), 'vai_t': (-85, -10, 0), 'vai_p': (-85, 10, 0),
                  'khuyu_t': (0, 0, 0), 'khuyu_p': (0, 0, 0), 'dau': (-35, 0, 0)},                              # cúi 38°, hai tay đổ xuống chống mặt bàn, ngẩng nhìn
    'cui_nguoi': {'lung': (20, 0, 0), 'nguc': (8, 0, 0), 'dau': (-15, 0, 0)},                                   # cúi sát về phía trước, mắt giữ ngang
    'om_thung': {'vai_t': (-22, -6, 0), 'vai_p': (-22, 6, 0), 'khuyu_t': (-88, 0, 0), 'khuyu_p': (-88, 0, 0)},  # ôm thùng trước bụng
    'khoanh_tay': {'vai_t': (-10, -4, 0), 'vai_p': (-10, 4, 0), 'khuyu_t': (-95, 0, -60), 'khuyu_p': (-95, 0, 60)},   # khoanh tay trước ngực — (−25, −115, ±35) trên người MPFB thành hai tay giơ lên mặt (#15 AI vẽ Vivian cầm ly); đo 6 biến thể 18/10/2026
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

def ap_dien(n, ds, t, giay=4.0, quang=None):
    """Đặt tư thế theo mã diễn (vi_tri.dien) lúc t (0..1) — chồng lên dáng hiện tại (đứng / ngồi / đang bước). Trả tên các tư thế đang có hiệu lực.
    Mã 'mc_<ten>[@a-b]' = chuyển động thật từ kho mocap CMU (mocap.py › MOCAP), phát đúng tốc độ thật theo `giay` của shot."""
    dang = []
    for x in ds or []:
        ten, _, mt = str(x).partition('@')
        if ten.startswith('mc_'):
            a, b = (0.0, 1.0)
            if mt: a_, _, b_ = mt.partition('-'); a, b = float(a_), (float(b_) if b_ else 1.0)
            if _mocap().ap_mocap(n, ten[3:], t, a, b, giay, quang, n['L']['chan'] + n['L']['cang'] + n['L']['dui']): dang.append(ten)   # quang: cm, cùng đơn vị L
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
    tay_ap(n, any(d in TAY_AP for d in dang))
    return dang

# BÀN TAY ÁP MẶT PHẲNG (dáng chống bàn): xương cổ tay người MPFB không ràng buộc thì nối thẳng cẳng tay — bàn tay buông đứng lơ lửng trên mặt bàn
# (tập 122 #25 "hand pressed flat on the table" thành tay dựng đứng). Cổ tay nhắm một điểm 15 cm trước cổ tay theo hướng mặt người, nằm ngang;
# trục X xương cổ tay MPFB hướng lên → lòng bàn tay úp xuống (thử 18/10/2026: UP_Z ngửa lòng, UP_X úp phẳng).
TAY_AP = {'chong_ban'}
def ban_tay(n, p):
    """Hướng bàn tay THẬT (ma trận 3×3 chuẩn hoá, thế giới): cột Y = dọc ngón, X = mu bàn tay, Z = ngang bàn tay. Người MPFB: xương cổ tay; không có
    thì khớp cổ tay ma-nơ-canh (−z dọc bàn tay)."""
    from mathutils import Matrix
    rig = bpy.data.objects.get(f"THAN_RIG {n['ten']}"); w = rig.pose.bones.get(f"wrist.{'L' if p == 't' else 'R'}") if rig else None
    if w:
        m = (rig.matrix_world @ w.matrix).to_3x3()
        # xương cổ tay MPFB ĐỐI XỨNG GƯƠNG: ngón tay phải gập về −X (mu = +X), tay trái gập về +X (đo 22/10/2026, tập 135 #29: hướng ngón khi gập ·
        # trục X = −0,88 / +0,88) → tay trái quay 180° quanh dọc ngón để X luôn là mu bàn tay
        if p == 't': m = m @ Matrix(((-1, 0, 0), (0, 1, 0), (0, 0, -1)))
    else: q = n[f'cotay_{p}'].matrix_world.to_3x3(); m = Matrix((q.col[0], -q.col[2], q.col[1])).transposed()
    m = m.copy()
    for i in range(3): m.col[i] = m.col[i].normalized()
    return m

def tay_ap(n, bat):
    rig = bpy.data.objects.get(f"THAN_RIG {n['ten']}")
    if not rig: return
    if bat: bpy.context.view_layer.update()
    for p, bx in (('t', 'L'), ('p', 'R')):
        w = rig.pose.bones.get(f'wrist.{bx}')
        if not w or f'cotay_{p}' not in n: continue
        for c in [c for c in w.constraints if c.name == 'tay_ap']: w.constraints.remove(c)
        if not bat: continue
        e = n.get(f'ap_{p}') or _khop(f"{n['ten']}.ap_{p}", n[f'cotay_{p}'], (0, 0, 0)); n[f'ap_{p}'] = e
        f = n['goc'].matrix_world.to_quaternion() @ Vector((0, -1, 0)); f.z = 0; f.normalize()
        m_ = e.matrix_world.copy(); m_.translation = (rig.matrix_world @ w.head) + f * 0.15 * n['cao'] / 175 * (n['goc'].matrix_world.to_scale()[0] * 100)
        e.matrix_world = m_   # gán cả ma trận: gán .translation của matrix_world không ghi ngược vào empty có cha (đích nằm lại ở cổ tay → bàn tay ngửa)
        c = w.constraints.new('TRACK_TO'); c.name = 'tay_ap'; c.target = e; c.track_axis = 'TRACK_Y'; c.up_axis = 'UP_X'
        if bx == 'L':   # mu bàn tay trái là −X (ban_tay): UP_X ngửa lòng tay trái (tập 135 #29 vòng tay nằm trên lòng bàn tay ngửa) → lật X xuống dưới
            d_ = n.get(f'ap_duoi_{p}') or _khop(f"{n['ten']}.ap_duoi_{p}", n[f'cotay_{p}'], (0, 0, 0)); n[f'ap_duoi_{p}'] = d_
            md = d_.matrix_world.copy(); md.translation = (rig.matrix_world @ w.head) - Vector((0, 0, 0.3 * n['cao'] / 175 * (n['goc'].matrix_world.to_scale()[0] * 100))); d_.matrix_world = md
            c2 = w.constraints.new('LOCKED_TRACK'); c2.name = 'tay_ap'; c2.target = d_; c2.lock_axis = 'LOCK_Y'; c2.track_axis = 'TRACK_X'
