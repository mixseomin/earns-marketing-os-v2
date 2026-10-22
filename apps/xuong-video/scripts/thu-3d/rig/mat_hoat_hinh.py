# KHUÔN MẶT CHUẨN cho thú hoạt hình MẮT TO (anh 21–22/10/2026: "các kiểu khuôn mặt phải có bộ rig riêng chuẩn hoá" → "tiếp đi").
# Giao diện CHUNG mọi nhân vật = thanh trượt mang TÊN ARKit 52 trên đối tượng rig (rig['jawOpen'] = 0…1) — biểu cảm / khớp môi viết một lần
# lái được người (MPFB, phiên bo-set) lẫn thú. Khuôn này dựng phần còn thiếu trên lưới sinh từ ảnh (mắt / miệng chỉ VẼ trên màu bề mặt):
#   - tìm mắt + khoé miệng bằng LẤY MẪU DÀY màu bề mặt (lưới thưa, chi tiết nằm giữa các đỉnh): mắt = cụm nâu hai bên đầu, khoé = điểm tối thấp dưới mắt
#   - NHÃN CẦU tách riêng (lòng trắng / mống / con ngươi theo toạ độ vật) gắn xương mat.L/R nhìn theo tay cầm 'nhin_mat'
#   - MÍ TRÊN = nửa vỏ cầu màu da gắn xương mi.L/R (chớp = xoay mi)
#   - HÌNH NẮN da (shape key) tên ARKit: jawOpen, mouthSmile*, mouthFrown*, browInnerUp, browDown*, browOuterUp*, cheekPuff
#   - khoang miệng tối trong mõm (hàm há không lộ mặt trong của vỏ)
# Mọi độ dài theo H; mặt nhìn −y, trái nhân vật = +x (.L).
import bpy, math
from mathutils import Vector, Matrix

ARKIT = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookInRight', 'eyeLookOutRight',
         'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight',
         'mouthFrownLeft', 'mouthFrownRight', 'browInnerUp', 'browDownLeft', 'browDownRight', 'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff',
         'eyeSquintLeft', 'eyeSquintRight']
# ngoài ARKit: 'khoc' (0…1 mắt ngấn nước + giọt hiện) và 'giot' (0…1 quãng giọt nước mắt đã chảy dọc má) — diễn khóc cần, ARKit không có
NGOAI = ['khoc', 'giot']

# biểu cảm mẫu = tổ hợp ARKit (dùng chung mọi nhân vật có giao diện này)
BIEU_CAM = {
    'binh_thuong': {},
    'chop_mat': {'eyeBlinkLeft': 1, 'eyeBlinkRight': 1},
    'ha_mieng': {'jawOpen': 1},
    'cuoi': {'mouthSmileLeft': 1, 'mouthSmileRight': 1, 'cheekPuff': 0.4, 'eyeBlinkLeft': 0.25, 'eyeBlinkRight': 0.25},
    'ngac_nhien': {'jawOpen': 0.6, 'browInnerUp': 1, 'browOuterUpLeft': 1, 'browOuterUpRight': 1, 'eyeWideLeft': 1, 'eyeWideRight': 1},
    'gian': {'browDownLeft': 1, 'browDownRight': 1, 'mouthFrownLeft': 1, 'mouthFrownRight': 1, 'eyeBlinkLeft': 0.3, 'eyeBlinkRight': 0.3},
    'buon': {'browInnerUp': 1, 'mouthFrownLeft': 0.8, 'mouthFrownRight': 0.8, 'eyeLookDownLeft': 0.6, 'eyeLookDownRight': 0.6, 'eyeBlinkLeft': 0.35, 'eyeBlinkRight': 0.35},
    'liec_trai': {'eyeLookOutLeft': 1, 'eyeLookInRight': 1, 'mouthSmileLeft': 0.5},
    # DIỄN CẢM XÚC (anh 22/10/2026 "diễn cảnh buồn, khóc, cười"): mày trong nhướn = buồn, mí dưới nheo = khóc / cười to
    'khoc': {'browInnerUp': 1, 'mouthFrownLeft': 1, 'mouthFrownRight': 1, 'jawOpen': 0.35, 'eyeSquintLeft': 0.45, 'eyeSquintRight': 0.45,
             'eyeLookDownLeft': 0.3, 'eyeLookDownRight': 0.3, 'khoc': 1, 'giot': 0.3},
    'cuoi_lon': {'mouthSmileLeft': 1, 'mouthSmileRight': 1, 'jawOpen': 0.7, 'eyeSquintLeft': 1, 'eyeSquintRight': 1, 'cheekPuff': 0.5,
                 'browOuterUpLeft': 0.4, 'browOuterUpRight': 0.4},
}


# ---------- tìm mắt / miệng trên màu bề mặt ----------
def _mau_day(M, dk, n=8):
    """Lấy mẫu dày (n×n mỗi tam giác) màu bề mặt các mặt thoả dk(tâm mặt) → [(vị trí, (r, g, b))]."""
    img = next(nd.image for nd in M.active_material.node_tree.nodes if nd.type == 'TEX_IMAGE')
    W, Hh = img.size; px = img.pixels[:]; me = M.data; uvl = me.uv_layers.active.data; ra = []
    for p in me.polygons:
        if not dk(p.center): continue
        li = list(p.loop_indices)[:3]; P = [me.vertices[me.loops[l].vertex_index].co for l in li]; U = [uvl[l].uv for l in li]
        for i in range(n + 1):
            for j in range(n + 1 - i):
                a, b = i / n, j / n; c = 1 - a - b; u = U[0] * a + U[1] * b + U[2] * c
                k = (min(Hh - 1, int(u.y * Hh)) * W + min(W - 1, int(u.x * W))) * 4
                ra.append((P[0] * a + P[1] * b + P[2] * c, px[k:k + 3]))
    return ra


def tim_mat(M, m):
    H = m['H']; dg = Vector(m['dau_goc'])
    S = _mau_day(M, lambda c: c.z > dg.z - 0.05 * H and c.y < dg.y + 0.05 * H)
    sang = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    # MẮT = cụm TƯƠNG PHẢN với da ở nửa trên đầu: lòng trắng (sáng hơn da, ít màu) hoặc con ngươi (tối hơn da nhiều). Bản đầu dò "màu nâu"
    # (mống nâu trên da xám) — da đỏ / cam thì cả mặt đều "nâu". Không đủ điểm thì rơi về cách dò nâu.
    # MẮT = CHỮ KÝ MẮT: chỗ TỐI dày đặc (con ngươi) có LÒNG TRẮNG sát bên. Lọc "nửa trên đầu" theo trung vị (bản trước) loại mất mắt thật khi
    # diềm / sừng đẩy trung vị lên (trice, ankylo); trọng tâm mọi điểm tối thì bị vệt tối trên diềm / gờ kéo lệch. Miệng hở, khe da, vệt diềm
    # không có lòng trắng đi kèm → tự loại. Không có điểm tối nào (bronto: màu bề mặt nhạt) → rơi về lòng trắng rồi mống nâu.
    da = sorted(sang(c) for _, c in S)[len(S) // 2]
    z_lo, z_hi = min(p.z for p, _ in S), max(p.z for p, _ in S); z_thap = z_lo + 0.35 * (z_hi - z_lo)
    sac = lambda c: max(c) - min(c)
    mat = {}
    for s, ten in ((1, 'L'), (-1, 'R')):
        ben = [(p, c) for p, c in S if p.x * s > 0.01 * H]
        toi = [p for p, c in ben if sang(c) < da - 0.3 and p.z > z_thap]   # mắt luôn TRÊN miệng (raptor: khe môi tối cạnh lưỡi sáng = giống mắt)
        trang = [p for p, c in ben if sang(c) > da + 0.15 and sac(c) < 0.2]
        ds = None
        if len(toi) >= 15 and trang:
            mau_ = toi[::max(1, len(toi) // 300)]; tr_ = trang[::max(1, len(trang) // 600)]
            def diem(q):
                """con ngươi thật nằm GIỮA lòng trắng: đếm lòng trắng quanh q theo 6 hướng trên mặt (nếp mí tối ngay trên mắt vẽ chỉ có trắng
                một phía — trice / ankylo từng dò trúng nếp mí). Điểm = số hướng có trắng × mật độ tối."""
                gan = [p - q for p in tr_ if 0.008 * H < (p - q).length < 0.06 * H]
                if not gan: return 0
                huong_co = {round(math.atan2(v.z, v.x if s > 0 else -v.x) / (math.pi / 3)) % 6 for v in gan}
                return len(huong_co) ** 2 * sum(1 for p in toi if (p - q).length < 0.025 * H)
            dinh = max(mau_, key=diem)
            if diem(dinh) > 0:
                con_nguoi = [p for p in toi if (p - dinh).length < 0.035 * H]
                tam = sum(con_nguoi, Vector()) / len(con_nguoi)            # tâm = CON NGƯƠI (lòng trắng lẫn nốt sần sáng trên trán — ankylo)
                kc = sorted((p - tam).length for p in toi + trang if (p - tam).length < 0.07 * H); r = kc[int(len(kc) * 0.8)]
                mat[ten] = (tam, min(max(r, 0.04 * H), 0.06 * H)); continue
        if not ds and len(trang) >= 30: ds = trang
        if not ds: ds = [p for p, c in ben if c[0] - c[2] > 0.08]
        tam = sum(ds, Vector()) / len(ds)
        kc = sorted((p - tam).length for p in ds); r = kc[int(len(kc) * 0.8)]
        mat[ten] = (tam, min(max(r, 0.04 * H), 0.06 * H))   # cỡ mắt kẹp 4–6 % thân
    # ĐỐI XỨNG: cụm nâu một bên hay lẫn má hồng / bóng đổ (bronto: R đo gấp đôi L) → tâm soi gương trung bình hai bên, bán kính lấy bên NHỎ
    cL, cR = mat['L'][0], mat['R'][0]; r = min(mat['L'][1], mat['R'][1])
    x, y, z = (cL.x - cR.x) / 2, (cL.y + cR.y) / 2, (cL.z + cR.z) / 2
    mat = {'L': (Vector((x, y, z)), r), 'R': (Vector((-x, y, z)), r)}
    z_mat = z
    khoe = {}
    for s, ten in ((1, 'L'), (-1, 'R')):
        thap = [(p, c) for p, c in S if p.z < z_mat - 0.06 * H and p.x * s > 0.02 * H]
        p, _ = min(thap, key=lambda q: sang(q[1]))
        khoe[ten] = p
    # khoé đối xứng như mắt (raptor / trice đo lệch hai bên)
    xk = (abs(khoe['L'].x) + abs(khoe['R'].x)) / 2; yk = (khoe['L'].y + khoe['R'].y) / 2; zk = (khoe['L'].z + khoe['R'].z) / 2
    khoe = {'L': Vector((xk, yk, zk)), 'R': Vector((-xk, yk, zk))}
    z_m = zk
    truoc = min((p for p, _ in S if abs(p.z - z_m) < 0.015 * H and abs(p.x) < 0.02 * H), key=lambda p: p.y)
    return {'mat': mat, 'khoe': khoe, 'mieng_truoc': truoc, 'z_mieng': z_m}


def tim_mat_2d(M, doan, H, ra=None):
    """DÒ MẮT TRÊN ẢNH: render đầu bằng Workbench (màu bề mặt phẳng, không bóng) từ góc 3/4 mỗi bên, máy trực giao nhắm chỗ đoán; trên ảnh tìm
    MẢNG TRẮNG có CHẤM TỐI bên trong (lòng trắng + con ngươi), rồi bắn tia ngược từ điểm ảnh về lưới → toạ độ 3D. Không phụ thuộc màu da
    (dò trên màu bề mặt hỏng ở ankylo: da cam sáng át lòng trắng, nếp mí / nốt sần giống con ngươi). Trả {L/R: (tâm, r)} hoặc None."""
    import numpy as np
    sc = bpy.context.scene; cu = (sc.render.engine, sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath)
    an = [o for o in bpy.data.objects if o is not M and not o.hide_render]
    for o in an: o.hide_render = True
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'TEXTURE'
    N = 320; sc.render.resolution_x = sc.render.resolution_y = N
    cd = bpy.data.cameras.new('do_mat'); cd.type = 'ORTHO'; cd.ortho_scale = 0.42 * H
    cam = bpy.data.objects.new('do_mat', cd); sc.collection.objects.link(cam); sc.camera = cam
    kq = {}
    for s, sx in (('L', 1), ('R', -1)):
        nham = doan[s][0]
        huong = Vector((sx * 0.85, -1, 0.12)).normalized()
        cam.location = nham + huong * H; cam.rotation_euler = (-huong).to_track_quat('-Z', 'Y').to_euler()
        tep = (ra or bpy.app.tempdir) + f'/do_mat_{s}.png'; sc.render.filepath = tep
        bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tep); a4 = np.array(im.pixels[:], dtype=np.float32).reshape(N, N, 4); bpy.data.images.remove(im)
        a = a4[:, :, :3]; co_vat = a4[:, :, 3] > 0.5   # nền trong suốt (alpha 0) không phải trắng / tối
        v = a.max(axis=2); sat = (v - a.min(axis=2)) / np.maximum(v, 1e-4)
        # lòng trắng = SÁNG + ÍT MÀU (ngưỡng tương đối với da hỏng ở da cam: kênh đỏ ~1 → ngưỡng > 1); nền trắng loại bằng điều kiện chạm mép
        trang = (v > 0.6) & (sat < 0.08) & co_vat     # lòng trắng đo được sat ≈ 0; da sáng chỗ bắt đèn ~0,15 → 0,16 nối lòng trắng vào da
        toi = (v < 0.3) & co_vat
        # nhãn mảng trắng (loang 4 hướng, thuần numpy + Python — Blender không có scipy)
        nhan = np.zeros((N, N), dtype=np.int32); so = 0; tot = None
        for y0, x0 in zip(*np.nonzero(trang)):
            if nhan[y0, x0]: continue
            so += 1; nhan[y0, x0] = so; ngan = [(y0, x0)]; o_ = []
            while ngan:
                y, x = ngan.pop(); o_.append((y, x))
                for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= yy < N and 0 <= xx < N and trang[yy, xx] and not nhan[yy, xx]: nhan[yy, xx] = so; ngan.append((yy, xx))
            if len(o_) < 25: continue
            ys = np.array([q[0] for q in o_]); xs = np.array([q[1] for q in o_])
            y1, y2, x1, x2 = ys.min(), ys.max(), xs.min(), xs.max()
            loi = toi[y1:y2 + 1, x1:x2 + 1]
            if loi.sum() < 3: continue          # lòng trắng phải ôm con ngươi tối
            ty, tx = np.nonzero(loi)
            cy, cx = y1 + ty.mean(), x1 + tx.mean()
            diem = len(o_) + 4 * loi.sum() - 0.5 * abs(cx - N / 2) - 0.5 * abs(cy - N / 2)   # ưu tiên mảng lớn, gần chỗ đoán
            if not tot or diem > tot[0]: tot = (diem, cx, cy, (len(o_) + loi.sum()) ** 0.5 / np.sqrt(np.pi))
        if not tot: continue
        _, cx, cy, rp = tot
        don = cd.ortho_scale / N
        mw = cam.matrix_world; phai = mw.to_3x3() @ Vector((1, 0, 0)); len_ = mw.to_3x3() @ Vector((0, 1, 0)); toi_tr = mw.to_3x3() @ Vector((0, 0, -1))
        goc = cam.location + phai * (cx - N / 2) * don + len_ * ((N - 1 - cy) - N / 2) * don   # hàng ảnh 0 = ĐÁY (pixels Blender)
        ok, hit, _, _ = M.ray_cast(M.matrix_world.inverted() @ goc, (M.matrix_world.inverted().to_3x3() @ toi_tr).normalized())
        if ok: kq[s] = (M.matrix_world @ hit, rp * don)
    sc.render.engine, sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath = cu
    bpy.data.objects.remove(cam, do_unlink=True)
    for o in an: o.hide_render = False
    if len(kq) < 2: return None
    cL, cR = kq['L'][0], kq['R'][0]; r = min(max(min(kq['L'][1], kq['R'][1]), 0.04 * H), 0.07 * H)
    x, y, z = (cL.x - cR.x) / 2, (cL.y + cR.y) / 2, (cL.z + cR.z) / 2
    return {'L': (Vector((x, y, z)), r), 'R': (Vector((-x, y, z)), r)}


# ---------- tiện ích ----------
def _vl(ten, mau, nham=0.4):
    m = bpy.data.materials.new(ten); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*mau, 1); b.inputs['Roughness'].default_value = nham; return m


def _vl_nhan_cau():
    """Lòng trắng / mống nâu / con ngươi đen theo toạ độ Y của vật (Y = hướng nhìn, cầu bán kính 1), bóng loáng."""
    m = bpy.data.materials.new('Nhãn cầu'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sx = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sx.inputs[0])
    cr = nt.nodes.new('ShaderNodeValToRGB'); nt.links.new(sx.outputs['Y'], cr.inputs[0])
    e = cr.color_ramp; e.interpolation = 'CONSTANT'
    e.elements[0].position = 0.0; e.elements[0].color = (0.92, 0.9, 0.86, 1)
    e.elements[1].position = 0.72; e.elements[1].color = (0.42, 0.2, 0.05, 1)
    x = e.elements.new(0.9); x.color = (0.01, 0.01, 0.01, 1)
    nt.links.new(cr.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.05
    return m


def _mau_da(M, quanh, r):
    """Màu da quanh mắt = TRUNG VỊ từng kênh vòng 2–4 r (trung bình lẫn lòng trắng vẽ + má hồng → mí trắng bệch, bản đầu)."""
    S = _mau_day(M, lambda c: r * 3.0 < (c - quanh).length < r * 5.0, 3)   # 2–4 r còn lẫn lòng trắng vẽ quanh mắt → mí xám bạc
    if not S: return (0.6, 0.65, 0.6)
    tuyen = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4   # điểm ảnh sRGB → màu tuyến tính của vật liệu (đưa thẳng = mí trắng bệch)
    return tuple(tuyen(sorted(c[i] for _, c in S)[len(S) // 2]) for i in range(3))


def _xe_mieng(M, f, H):
    """ĐƯỜNG XẺ MIỆNG: lưới sinh từ ảnh liền một mảnh — nắn hàm chỉ gập da, không há. Cắt mặt phẳng ngang qua vạch miệng, chỉ trong vùng mõm
    giữa hai khoé, rồi tách cạnh vừa cắt → môi trên / môi dưới rời nhau, hàm há lộ khoang miệng (rig hoạt hình nào cũng có đường này)."""
    import bmesh
    km = f['khoe']; zm = f['z_mieng']; xk = max(abs(km['L'].x), abs(km['R'].x)); yk = (km['L'].y + km['R'].y) / 2
    bm = bmesh.new(); bm.from_mesh(M.data)
    vung = [fa for fa in bm.faces if fa.calc_center_median().y < yk + 0.01 * H and abs(fa.calc_center_median().x) < xk * 0.95
            and abs(fa.calc_center_median().z - zm) < 0.04 * H]
    kq = bmesh.ops.bisect_plane(bm, geom=list({v for fa in vung for v in fa.verts} | {e for fa in vung for e in fa.edges} | set(vung)),
                                plane_co=(0, 0, zm), plane_no=(0, 0, 1))
    cat = [e for e in kq['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and all(abs(v.co.x) < xk * 0.9 and v.co.y < yk for v in e.verts)]
    bmesh.ops.split_edges(bm, edges=cat)
    bm.to_mesh(M.data); bm.free(); M.data.update()
    return len(cat)


def _xuong_dau(rig):
    """Xương ORG của ĐẦU (đốt cuối chuỗi cổ super_head) — mắt / mí / khoang miệng bám vào đây."""
    return sorted(b.name for b in rig.data.bones if b.name.startswith('ORG-neck'))[-1]


def _bam(o, rig, xuong):
    bpy.context.view_layer.update()   # scale / location vừa đặt chưa vào matrix_world nếu không cập nhật (khoang miệng phình thành cầu 2 m)
    mw = o.matrix_world.copy(); o.parent = rig; o.parent_type = 'BONE'; o.parent_bone = xuong
    bpy.context.view_layer.update(); o.matrix_world = mw


def _dk(owner, path, i, bieu_thuc, rig, bien):
    """Driver: owner.path[i] = bieu_thuc; bien = {tên biến trong biểu thức: tên thanh trượt ARKit trên rig}."""
    fc = owner.driver_add(path, i) if i is not None else owner.driver_add(path)
    d = fc.driver; d.type = 'SCRIPTED'; d.expression = bieu_thuc
    for v, prop in bien.items():
        x = d.variables.new(); x.name = v; x.type = 'SINGLE_PROP'; x.targets[0].id = rig; x.targets[0].data_path = f'["{prop}"]'


# ---------- dựng ----------
def gan_mat(rig, M, m):
    H = m['H']; f = tim_mat(M, m)
    m2 = tim_mat_2d(M, f['mat'], H)
    print('MAT 2D', {k: ([round(x, 3) for x in v[0]], round(v[1], 3)) for k, v in m2.items()} if m2 else None)
    if m2: f['mat'] = m2   # mắt trên ảnh thắng mắt dò trên màu bề mặt (tâm 2D = điểm trên MẶT DA; nhãn cầu đặt lại theo tia bên dưới)
    print('XE MIENG canh', _xe_mieng(M, f, H))
    for k in ARKIT + NGOAI: rig[k] = 0.0
    dau = _xuong_dau(rig)
    tam_dau = (f['mat']['L'][0] + f['mat']['R'][0]) / 2
    # ---- tâm nhãn cầu theo MẶT DA THẬT: bắn tia từ điểm mắt dò được ra ngoài theo hướng nhìn; lưới TRELLIS hay có khối mắt vẽ LỒI → đặt tâm
    # ở điểm dò được thì nhãn cầu + mí chìm dưới da (ankylo / trice / stego: chớp, liếc không thấy gì). Tâm = mặt da − 0,55 r → nhô 0,45 r.
    tam_nc, huong = {}, {}
    for s in 'LR':
        c, r = f['mat'][s]; n = (c - Vector((0, c.y + 0.05 * H, c.z - 0.02 * H))).normalized()
        n = (n + Vector((0, -0.6, 0))).normalized(); huong[s] = n
        ok, hit, _, _ = M.ray_cast(c - n * 0.5 * r, n, distance=0.3 * H)
        tam_nc[s] = (hit if ok else c) - n * 0.55 * r
    # ---- xương mắt / mí / đích nhìn ----
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT'); eb = rig.data.edit_bones
    dich_nhin = Vector((0, tam_dau.y - 0.6 * H, tam_dau.z))
    t = eb.new('nhin_mat'); t.head = dich_nhin; t.tail = dich_nhin + Vector((0, 0, 0.03 * H)); t.parent = eb['head'] if 'head' in eb else eb[dau]
    for s in 'LR':
        r = f['mat'][s][1]; n = huong[s]
        for ten in (f'mat.{s}', f'mi.{s}', f'mi_duoi.{s}'):
            b = eb.new(ten); b.head = tam_nc[s]; b.tail = b.head + n * r; b.align_roll(Vector((0, 0, 1))); b.parent = eb[dau]; b.use_deform = False
    bpy.ops.object.mode_set(mode='POSE')
    for s in 'LR':
        ct = rig.pose.bones[f'mat.{s}'].constraints.new('DAMPED_TRACK'); ct.target = rig; ct.subtarget = 'nhin_mat'
        rig.pose.bones[f'mi.{s}'].rotation_mode = 'XYZ'; rig.pose.bones[f'mi_duoi.{s}'].rotation_mode = 'XYZ'
    bpy.ops.object.mode_set(mode='OBJECT')
    # đích nhìn: ARKit look In/Out/Up/Down (trung bình hai mắt) → dời tay cầm (xương dựng đứng: x cục bộ = x thế giới, y cục bộ = lên)
    pbt = rig.pose.bones['nhin_mat']
    _dk(pbt, 'location', 0, f'(oL - iL + iR - oR) * 0.5 * {0.35 * H:.4f}', rig,
        {'oL': 'eyeLookOutLeft', 'iL': 'eyeLookInLeft', 'iR': 'eyeLookInRight', 'oR': 'eyeLookOutRight'})
    _dk(pbt, 'location', 1, f'(uL + uR - dL - dR) * 0.5 * {0.25 * H:.4f}', rig,
        {'uL': 'eyeLookUpLeft', 'uR': 'eyeLookUpRight', 'dL': 'eyeLookDownLeft', 'dR': 'eyeLookDownRight'})
    # ---- nhãn cầu + mí ----
    VL_NC = _vl_nhan_cau()
    for s, ten_t in (('L', 'Left'), ('R', 'Right')):
        c, r = f['mat'][s]; bm = rig.matrix_world @ rig.data.bones[f'mat.{s}'].matrix_local
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1); e = bpy.context.object; e.name = f'Nhãn cầu.{s}'
        bpy.ops.object.shade_smooth(); e.data.materials.append(VL_NC)
        e.matrix_world = Matrix.Translation(bm.translation) @ bm.to_3x3().to_4x4() @ Matrix.Scale(r * 1.05, 4)
        _bam(e, rig, f'mat.{s}')
        mau_mi = _vl(f'Da mí {s}', _mau_da(M, c, r), 0.6)
        for xg, tren in ((f'mi.{s}', True), (f'mi_duoi.{s}', False)):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1); l = bpy.context.object; l.name = f'Mí {"trên" if tren else "dưới"}.{s}'
            bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
            for v in l.data.vertices: v.select = ((v.co.z < -0.02) if tren else (v.co.z > 0.02)) or v.co.y < -0.35   # mí trên nửa TRÊN, mí dưới nửa DƯỚI; bỏ phần sau (lòi thành vòng quanh mắt)
            bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
            sl = l.modifiers.new('day', 'SOLIDIFY'); sl.thickness = 0.06; bpy.ops.object.shade_smooth()
            l.data.materials.append(mau_mi)
            bm2 = rig.matrix_world @ rig.data.bones[xg].matrix_local
            # khung mí: Y = hướng nhìn, Z = lên (cùng khung xương) — nửa cầu quay quanh X để mở / nhắm
            l.matrix_world = Matrix.Translation(bm2.translation) @ bm2.to_3x3().to_4x4() @ Matrix.Scale(r * (1.12 if tren else 1.1), 4)
            _bam(l, rig, xg)
        pm, pd = rig.pose.bones[f'mi.{s}'], rig.pose.bones[f'mi_duoi.{s}']
        # MÍ TRÊN: mở = mép cao hơn trục nhìn 35°; nhắm −90°; tròn mắt lùi 25°; nheo (cười / khóc) hạ 20°
        _dk(pm, 'rotation_euler', 0, 'radians(35 - min(1, b + q * 0.25) * 125 + w * 25)', rig, {'b': f'eyeBlink{ten_t}', 'w': f'eyeWide{ten_t}', 'q': f'eyeSquint{ten_t}'})
        # NGHIÊNG mí quanh trục nhìn — chỗ cảm xúc đọc ra rõ nhất ở thú không lông mày: buồn = đầu TRONG nhướn (mí xệ ra ngoài), giận = đầu trong cụp.
        # Trục X cục bộ của xương = −x thế giới (Y nhìn −y, Z lên) → dấu theo bên.
        sx = 1 if s == 'L' else -1
        _dk(pm, 'rotation_euler', 1, f'radians({-sx} * (u * 24 - d * 22 - o * 10))', rig, {'u': 'browInnerUp', 'd': f'browDown{ten_t}', 'o': f'browOuterUp{ten_t}'})
        # MÍ DƯỚI: mở = mép thấp hơn trục 40°; nheo đẩy lên tới −8° (má đội lên khi cười to / khóc), chớp nhích lên 10°
        _dk(pd, 'rotation_euler', 0, 'radians(-40 + q * 32 + min(1, b) * 10)', rig, {'q': f'eyeSquint{ten_t}', 'b': f'eyeBlink{ten_t}'})
    # ---- khoang miệng tối ----
    km = f['khoe']; zm = f['z_mieng']; tr = f['mieng_truoc']
    # nằm HẲN trong mõm (mép trước lùi sau mặt da 0,02 H) — bản đầu lòi ra trước mõm thành "cái môi" hồng
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=(0, tr.y + 0.06 * H, zm - 0.008 * H)); kh = bpy.context.object
    kh.name = 'Khoang miệng'; kh.scale = (abs(km['L'].x - km['R'].x) * 0.4, 0.04 * H, 0.016 * H); kh.data.materials.append(_vl('Trong miệng', (0.12, 0.02, 0.03), 0.5))
    _bam(kh, rig, dau)
    # ---- hình nắn da (shape key) ----
    if not M.data.shape_keys: M.shape_key_add(name='Basis')
    co0 = [v.co.copy() for v in M.data.vertices]
    tron = lambda u: 0 if u <= 0 else (1 if u >= 1 else u * u * (3 - 2 * u))
    def nan(ten, ham):
        sk = M.shape_key_add(name=ten, from_mix=False)
        for i, p in enumerate(co0):
            d = ham(p)
            if d is not None: sk.data[i].co = p + d
        fc = sk.driver_add('value'); fc.driver.type = 'AVERAGE'
        v = fc.driver.variables.new(); v.type = 'SINGLE_PROP'; v.targets[0].id = rig; v.targets[0].data_path = f'["{ten}"]'
    # hàm: xoay phần dưới vạch miệng quanh trục ngang qua bản lề (sau khoé), mờ dần về cằm / cổ
    y_bl = (km['L'].y + km['R'].y) / 2 + 0.035 * H
    def ham_ha(p):
        w = tron((zm - p.z) / (0.008 * H)) * tron((y_bl - p.y) / (0.02 * H)) * tron((p.z - (zm - 0.16 * H)) / (0.05 * H))
        if w <= 0: return None
        a = math.radians(32) * w; ry, rz = p.y - y_bl, p.z - zm
        return Vector((0, ry * math.cos(a) - rz * math.sin(a) - ry, ry * math.sin(a) + rz * math.cos(a) - rz))
    nan('jawOpen', ham_ha)
    for s, ten_t in (('L', 'Left'), ('R', 'Right')):
        k_ = km[s]; c, r = f['mat'][s]; sx = 1 if s == 'L' else -1
        vung = lambda p, tam, R: tron(1 - (p - tam).length / R) if (p - tam).length < R else 0
        nan(f'mouthSmile{ten_t}', lambda p, k_=k_: (Vector((sx * 0.01 * H, 0.016 * H, 0.03 * H)) * vung(p, k_, 0.09 * H)) if vung(p, k_, 0.09 * H) > 0 else None)
        nan(f'mouthFrown{ten_t}', lambda p, k_=k_: (Vector((0, 0.006 * H, -0.03 * H)) * vung(p, k_, 0.09 * H)) if vung(p, k_, 0.09 * H) > 0 else None)
        may = c + Vector((0, 0.2 * r, 1.25 * r))
        nan(f'browDown{ten_t}', lambda p, may=may, r=r, sx=sx: (Vector((0, -0.004 * H, -0.014 * H)) * vung(p, may + Vector((-sx * 0.5 * r, 0, 0)), 1.8 * r)) if vung(p, may, 2.0 * r) > 0 else None)
        nan(f'browOuterUp{ten_t}', lambda p, may=may, r=r, sx=sx: (Vector((0, 0, 0.016 * H)) * vung(p, may + Vector((sx * 0.6 * r, 0, 0)), 1.6 * r)) if vung(p, may, 2.2 * r) > 0 else None)
    giua_may = (f['mat']['L'][0] + f['mat']['R'][0]) / 2 + Vector((0, 0, 1.2 * f['mat']['L'][1]))
    nan('browInnerUp', lambda p: (Vector((0, 0, 0.018 * H)) * tron(1 - (p - giua_may).length / (0.09 * H))) if (p - giua_may).length < 0.09 * H else None)
    def ham_ma(p):
        w = 0
        for s in 'LR':
            tam = (f['mat'][s][0] + km[s]) / 2 + Vector(((1 if s == 'L' else -1) * 0.02 * H, 0, 0))
            w = max(w, tron(1 - (p - tam).length / (0.07 * H)) if (p - tam).length < 0.07 * H else 0)
        if w <= 0: return None
        n = Vector((p.x, 0, 0)).normalized() if abs(p.x) > 1e-4 else Vector((0, -1, 0))
        return n * 0.014 * H * w
    nan('cheekPuff', ham_ma)
    _nuoc_mat(rig, M, f, H, dau)
    # thanh trượt khớp vào giao diện: hiện trong bảng thuộc tính, giới hạn 0…1
    for k in ARKIT + NGOAI:
        ui = rig.id_properties_ui(k); ui.update(min=0.0, max=1.0, soft_min=0.0, soft_max=1.0)
    return f


def _nuoc_mat(rig, M, f, H, dau):
    """NƯỚC MẮT: mỗi bên (1) lớp NGẤN NƯỚC trong suốt phủ nửa dưới nhãn cầu (mắt long lanh khi buồn), (2) đường má = đường cong dò trên MẶT DA
    (bắn tia từ ngoài vào, bước xuống dưới mắt), (3) giọt nước bám đường đó (Follow Path) — rig['khoc'] hiện / ẩn, rig['giot'] = quãng đã chảy."""
    kinh = bpy.data.materials.new('Nước mắt'); kinh.use_nodes = True; b = kinh.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.9, 0.95, 1, 1); b.inputs['Roughness'].default_value = 0.02
    b.inputs['Transmission Weight'].default_value = 1.0; b.inputs['IOR'].default_value = 1.33
    for s in 'LR':
        c, r = f['mat'][s]; sx = 1 if s == 'L' else -1
        # (1) ngấn nước: chỏm cầu hơi lớn hơn nhãn cầu, chỉ nửa dưới — co về 0 khi không khóc
        bm = rig.matrix_world @ rig.data.bones[f'mat.{s}'].matrix_local
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1); g = bpy.context.object; g.name = f'Ngấn nước.{s}'
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
        for v in g.data.vertices: v.select = v.co.z > -0.15 or v.co.y < 0.2
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT'); bpy.ops.object.shade_smooth()
        g.data.materials.append(kinh)
        g.matrix_world = Matrix.Translation(bm.translation) @ bm.to_3x3().to_4x4() @ Matrix.Scale(r * 1.09, 4)
        _bam(g, rig, f'mat.{s}')
        for i in range(3): _dk(g, 'scale', i, f'{r * 1.09:.5f} * (0.001 + min(1, k))', rig, {'k': 'khoc'})
        # (2) đường má: từ dưới mí dưới, mỗi bước hạ 0,012 H và dạt ra ngoài nhẹ, bám mặt da bằng tia bắn vào tâm đầu
        tam_dau = Vector((0, c.y + 0.08 * H, c.z))
        diem = []
        for k in range(14):
            p = c + Vector((sx * (0.2 * r + k * 0.003 * H), -0.25 * r, -1.0 * r - k * 0.012 * H))
            n = (p - Vector((0, tam_dau.y, p.z))).normalized()
            ok, hit, nor, _ = M.ray_cast(p + n * 0.1 * H, -n, distance=0.3 * H)
            if ok: diem.append(hit + nor * 0.004 * H)
        if len(diem) < 4: continue
        cd = bpy.data.curves.new(f'Má.{s}', 'CURVE'); cd.dimensions = '3D'; sp = cd.splines.new('POLY'); sp.points.add(len(diem) - 1)
        for i, p in enumerate(diem): sp.points[i].co = (*p, 1)
        duong = bpy.data.objects.new(f'Đường má.{s}', cd); bpy.context.collection.objects.link(duong); duong.hide_render = True
        _bam(duong, rig, dau)
        # (3) giọt: cầu kéo dài theo chiều chảy, bám đường, quãng = rig['giot'], ẩn hẳn (co 0) khi khoc = 0
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1); gt = bpy.context.object; gt.name = f'Giọt.{s}'
        bpy.ops.object.shade_smooth(); gt.data.materials.append(kinh)
        ct = gt.constraints.new('FOLLOW_PATH'); ct.target = duong; ct.use_fixed_location = True; ct.forward_axis = 'FORWARD_Y'
        _dk(ct, 'offset_factor', None, 'min(0.999, max(0, v))', rig, {'v': 'giot'})
        q = 0.011 * H
        for i, h in enumerate((0.75, 0.75, 1.3)): _dk(gt, 'scale', i, f'{q * h:.5f} * min(1, k) + 1e-5', rig, {'k': 'khoc'})


def dat_bieu_cam(rig, ten):
    for k in ARKIT + NGOAI: rig[k] = 0.0
    for k, v in BIEU_CAM[ten].items(): rig[k] = float(v)
    rig.update_tag(); bpy.context.view_layer.update()
