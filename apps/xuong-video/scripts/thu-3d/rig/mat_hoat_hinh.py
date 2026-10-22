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
         'mouthFrownLeft', 'mouthFrownRight', 'browInnerUp', 'browDownLeft', 'browDownRight', 'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff']

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
    S = _mau_day(M, lambda c: r * 2.0 < (c - quanh).length < r * 4.0, 3)
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
    print('XE MIENG canh', _xe_mieng(M, f, H))
    for k in ARKIT: rig[k] = 0.0
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
        for ten in (f'mat.{s}', f'mi.{s}'):
            b = eb.new(ten); b.head = tam_nc[s]; b.tail = b.head + n * r; b.align_roll(Vector((0, 0, 1))); b.parent = eb[dau]; b.use_deform = False
    bpy.ops.object.mode_set(mode='POSE')
    for s in 'LR':
        ct = rig.pose.bones[f'mat.{s}'].constraints.new('DAMPED_TRACK'); ct.target = rig; ct.subtarget = 'nhin_mat'
        rig.pose.bones[f'mi.{s}'].rotation_mode = 'XYZ'
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
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1); l = bpy.context.object; l.name = f'Mí.{s}'
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
        for v in l.data.vertices: v.select = v.co.z < -0.02     # giữ nửa TRÊN (z cục bộ = lên)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
        sl = l.modifiers.new('day', 'SOLIDIFY'); sl.thickness = 0.06; bpy.ops.object.shade_smooth()
        l.data.materials.append(_vl(f'Da mí {s}', _mau_da(M, c, r), 0.6))
        bm2 = rig.matrix_world @ rig.data.bones[f'mi.{s}'].matrix_local
        # khung mí: Y = hướng nhìn, Z = lên (cùng khung xương) — nửa cầu "trên" (z > 0) quay quanh X để mở / nhắm
        l.matrix_world = Matrix.Translation(bm2.translation) @ bm2.to_3x3().to_4x4() @ Matrix.Scale(r * 1.12, 4)
        _bam(l, rig, f'mi.{s}')
        # mở: mép mí trên cao hơn trục nhìn 35°; nhắm: xuống −90° (phủ hết mặt trước); tròn mắt: lùi thêm 25°
        _dk(rig.pose.bones[f'mi.{s}'], 'rotation_euler', 0, 'radians(35 - min(1, b) * 125 + w * 25)', rig, {'b': f'eyeBlink{ten_t}', 'w': f'eyeWide{ten_t}'})
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
        nan(f'mouthSmile{ten_t}', lambda p, k_=k_: (Vector((0, 0.012 * H, 0.016 * H)) * vung(p, k_, 0.06 * H)) if vung(p, k_, 0.06 * H) > 0 else None)
        nan(f'mouthFrown{ten_t}', lambda p, k_=k_: (Vector((0, 0.004 * H, -0.016 * H)) * vung(p, k_, 0.06 * H)) if vung(p, k_, 0.06 * H) > 0 else None)
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
    # thanh trượt khớp vào giao diện: hiện trong bảng thuộc tính, giới hạn 0…1
    for k in ARKIT:
        ui = rig.id_properties_ui(k); ui.update(min=0.0, max=1.0, soft_min=0.0, soft_max=1.0)
    return f


def dat_bieu_cam(rig, ten):
    for k in ARKIT: rig[k] = 0.0
    for k, v in BIEU_CAM[ten].items(): rig[k] = float(v)
    rig.update_tag(); bpy.context.view_layer.update()
