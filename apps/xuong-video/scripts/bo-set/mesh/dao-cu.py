# KHUÔN ĐẠO CỤ (anh 22/10/2026 "giờ làm đồ vật đi"): đạo cụ của phim (khoi_3d.dao_cu) dựng có HÌNH THẬT thay khối hộp / trụ trơn — ly có quai + đĩa,
# điện thoại bo góc + mặt kính, hồ sơ bìa da hai lớp + gáy, thẻ nhân viên + kẹp, thùng các-tông mở nắp có đồ bên trong, bút máy. Cách previs ngành:
# ghép đạo cụ từ khối có sẵn (kitbash) đúng KÍCH THƯỚC khai (co, cm) — không sinh ảnh → 3D (lệch cỡ, hình nhoè). Mặt in (chữ H vàng, mặt thẻ) lấy
# thẳng từ ẢNH MẪU của đạo cụ (khoi_3d.anh): cắt đúng vùng vật trên phông trơn rồi dán lên mặt đó.
#   dung(kieu, ten, co_cm, anh=None) → một object MESH (nhiều vật liệu), gốc ở TÂM hộp bao, đúng co (m); dung-set.py › khoi đặt + xoay như khối thường.
import bpy, bmesh, math
from mathutils import Vector

CM = 0.01

def _vl(ten, rgb, nham=0.5, kim=0.0, phat=0.0):
    m = bpy.data.materials.new(ten); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = nham; b.inputs['Metallic'].default_value = kim
    if phat: b.inputs['Emission Color'].default_value = (*rgb, 1); b.inputs['Emission Strength'].default_value = phat
    m.diffuse_color = (*rgb, 1)   # Workbench (khung xám) đọc màu ở đây
    return m

def _lin(hx):
    hx = hx.lstrip('#'); return tuple((int(hx[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))

def _hop(sx, sy, sz, vi=(0, 0, 0), vat=None, bo=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vi); o = bpy.context.object; o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bo:
        b = o.modifiers.new('bo', 'BEVEL'); b.width = bo; b.segments = 3; b.limit_method = 'ANGLE'
        bpy.ops.object.modifier_apply(modifier='bo')
    if vat: o.data.materials.append(vat)
    return o

def _tru(r, cao, vi=(0, 0, 0), vat=None, quay=(0, 0, 0), dinh=None, canh=32):
    bpy.ops.mesh.primitive_cone_add(vertices=canh, radius1=r, radius2=r if dinh is None else dinh, depth=cao, location=vi, rotation=quay)
    o = bpy.context.object
    for f in o.data.polygons: f.use_smooth = True
    if vat: o.data.materials.append(vat)
    return o

def _gop(ds, ten):
    bpy.ops.object.select_all(action='DESELECT')
    for o in ds: o.select_set(True)
    bpy.context.view_layer.objects.active = ds[0]; bpy.ops.object.join(); o = bpy.context.object; o.name = ten
    return o

def _cat_anh(duong, sang_hon=0.0):
    """Ảnh mẫu (phông trơn) → (ảnh Blender, khung vật u0, v0, u1, v1 theo UV 0..1). Nền = trung vị viền ảnh; vật = điểm lệch nền > 0,08
    (sang_hon > 0: chỉ điểm SÁNG hơn nền chừng đó — mặt thẻ trắng trên phông xám, bỏ dây đeo xanh)."""
    import numpy as np
    im = bpy.data.images.load(duong, check_existing=True); w, h = im.size
    px = np.array(im.pixels[:]).reshape(h, w, 4)[..., :3]
    vien = np.concatenate([px[:4].reshape(-1, 3), px[-4:].reshape(-1, 3), px[:, :4].reshape(-1, 3), px[:, -4:].reshape(-1, 3)])
    nen = np.median(vien, 0)
    mk = (px.mean(2) - nen.mean() > sang_hon) if sang_hon else (np.abs(px - nen).max(2) > 0.08)
    ys, xs = np.where(mk)
    if not len(xs): return im, (0, 0, 1, 1)
    return im, (xs.min() / w, ys.min() / h, (xs.max() + 1) / w, (ys.max() + 1) / h)   # pixels Blender: hàng 0 ở ĐÁY ảnh = v 0

def _mat_anh(ten, anh, nham=0.4):
    m = bpy.data.materials.new(ten); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = nham
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = anh; t.extension = 'EXTEND'; nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    m.diffuse_color = (0.6, 0.6, 0.6, 1); return m

def _dan_mat(o, vat, khung, truc='z', dau=1, anh_wh=None):
    """Dán vật liệu ảnh lên các mặt hướng truc·dau của o, UV chiếu thẳng theo hộp bao của các mặt đó → đúng khung vật trong ảnh."""
    u0, v0, u1, v1 = khung; me = o.data; me.materials.append(vat); ix = len(me.materials) - 1
    if not me.uv_layers: me.uv_layers.new(name='UV')
    uv = me.uv_layers.active.data; k = {'x': 0, 'y': 1, 'z': 2}[truc]
    mat = [f for f in me.polygons if f.normal[k] * dau > 0.9]
    if not mat: return
    ds = [me.vertices[i].co for f in mat for i in f.vertices]
    a_, b_ = ((0, 1) if truc == 'z' else (0, 2) if truc == 'y' else (1, 2))
    lo = [min(v[a_] for v in ds), min(v[b_] for v in ds)]; hi = [max(v[a_] for v in ds), max(v[b_] for v in ds)]
    # ảnh DỌC dán lên mặt NGANG (hồ sơ in bìa dọc mà đặt nằm ngang trên bàn) → xoay ảnh 90°: cạnh dài của ảnh theo cạnh dài của mặt
    xoay_ = ((hi[0] - lo[0]) > (hi[1] - lo[1])) != ((u1 - u0) * (anh_wh[0] if anh_wh else 1) > (v1 - v0) * (anh_wh[1] if anh_wh else 1))
    for f in mat:
        f.material_index = ix
        for li in f.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            fu = (c[a_] - lo[0]) / ((hi[0] - lo[0]) or 1); fv = (c[b_] - lo[1]) / ((hi[1] - lo[1]) or 1)
            if truc == 'y' and dau > 0: fu = 1 - fu
            if xoay_: fu, fv = fv, 1 - fu
            uv[li].uv = (u0 + fu * (u1 - u0), v0 + fv * (v1 - v0))

def ly(ten, w, d, c, anh=None):
    """Ly sứ trắng có quai + mặt cà phê đen bên trong (co = cả quai)."""
    su = _vl('su trang', _lin('#f2f0ea'), 0.18); cf = _vl('ca phe', _lin('#1a0f08'), 0.08)
    r = min(w * 0.78, d) / 2; dn = r * 0.82
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=dn, radius2=r, depth=c, location=(0, 0, 0)); than = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(than.data); bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context='FACES'); bm.to_mesh(than.data); bm.free()
    s = than.modifiers.new('thanh', 'SOLIDIFY'); s.thickness = 0.35 * CM; s.offset = -1; bpy.ops.object.modifier_apply(modifier='thanh')
    for f in than.data.polygons: f.use_smooth = True
    than.data.materials.append(su)
    mat_cf = _tru(r * 0.9, 0.05 * CM, (0, 0, c * 0.32), cf)
    bpy.ops.mesh.primitive_torus_add(major_radius=c * 0.25, minor_radius=0.45 * CM, location=(-(r + c * 0.16), 0, c * 0.05), rotation=(math.radians(90), 0, 0))
    quai = bpy.context.object; quai.data.materials.append(su)
    for f in quai.data.polygons: f.use_smooth = True
    return _gop([than, mat_cf, quai], ten)

def dien_thoai(ten, w, d, c, anh=None):
    """Điện thoại: thân bo góc vỏ nhám đen, mặt kính màn hình (−y), cụm camera sau (+y)."""
    vo = _vl('vo nham', _lin('#141414'), 0.75); kinh = _vl('man kinh', _lin('#05070a'), 0.05); cam = _vl('camera', _lin('#2a2a2e'), 0.2, 0.6)
    than = _hop(w, d * 0.85, c, vat=vo, bo=min(w, c) * 0.12)
    man = _hop(w * 0.9, 0.05 * CM, c * 0.93, (0, -d * 0.43, 0), kinh, bo=min(w, c) * 0.08)
    cm = _hop(w * 0.36, d * 0.25, w * 0.36, (-w * 0.22, d * 0.5, c * 0.33), cam, bo=w * 0.06)
    return _gop([than, man, cm], ten)

def ho_so(ten, w, d, c, anh=None):
    """Hồ sơ bìa da (nằm: co = rộng × sâu × dày): hai lớp bìa + ruột giấy + gáy; mặt trên = ảnh mẫu (chữ H vàng)."""
    da = _vl('bia da', _lin('#151515'), 0.55); giay = _vl('giay', _lin('#ece8de'), 0.9)
    duoi = _hop(w, d, c * 0.3, (0, 0, -c * 0.35), da, bo=c * 0.1)
    ruot = _hop(w * 0.96, d * 0.95, c * 0.4, (0.01 * w, 0, 0), giay)
    tren = _hop(w, d, c * 0.3, (0, 0, c * 0.35), da, bo=c * 0.1)
    gay = _hop(c * 0.5, d, c, (-w / 2, 0, 0), da, bo=c * 0.2)
    o = _gop([duoi, ruot, tren, gay], ten)
    if anh:
        im, k = _cat_anh(anh); _dan_mat(o, _mat_anh('mat ho so', im, 0.5), k, 'z', 1, tuple(im.size))
    return o

def the_deo(ten, w, d, c, anh=None):
    """Thẻ nhân viên đứng (co = rộng × dày × cao): tấm nhựa, mặt trước (−y) = ảnh mẫu (phần thẻ trắng), kẹp nhựa trên đỉnh + một đoạn dây xanh."""
    nhua = _vl('nhua the', _lin('#f5f5f5'), 0.3); kep = _vl('kep', _lin('#c8ccd0'), 0.3, 0.7); day = _vl('day deo', _lin('#1f3a6e'), 0.8)
    the = _hop(w, d, c * 0.82, (0, 0, -c * 0.09), nhua, bo=min(w, c) * 0.06)
    k = _hop(w * 0.25, d * 1.4, c * 0.08, (0, 0, c * 0.36), kep)
    dd = _hop(w * 0.18, d * 0.8, c * 0.12, (0, 0, c * 0.44), day)
    o = _gop([the, k, dd], ten)
    if anh:
        im, kh = _cat_anh(anh, sang_hon=0.06); _dan_mat(o, _mat_anh('mat the', im, 0.35), kh, 'y', -1, tuple(im.size))
    return o

def thung(ten, w, d, c, anh=None):
    """Thùng các-tông mở nắp (4 nắp vểnh ra) + đồ bên trong nhô lên: chậu sen đá, khung ảnh, cốc."""
    ct = _vl('cac tong', _lin('#b08a5a'), 0.85); ct2 = _vl('cac tong trong', _lin('#8f6c43'), 0.9)
    la = _vl('sen da', _lin('#5f8a4e'), 0.6); chau = _vl('chau', _lin('#e8e2d6'), 0.4); khung = _vl('khung anh', _lin('#9a7a4e'), 0.5)
    anh_vl = _vl('anh phong canh', _lin('#7fa0b8'), 0.3); coc = _vl('coc', _lin('#f2f0ea'), 0.25)
    h0 = c * 0.82
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -c / 2 + h0 / 2)); than = bpy.context.object; than.scale = (w, d, h0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bm = bmesh.new(); bm.from_mesh(than.data); bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context='FACES'); bm.to_mesh(than.data); bm.free()
    s = than.modifiers.new('thanh', 'SOLIDIFY'); s.thickness = 0.4 * CM; s.offset = -1; bpy.ops.object.modifier_apply(modifier='thanh')
    than.data.materials.append(ct); than.data.materials.append(ct2)
    for f in than.data.polygons:
        if f.normal.length and (abs(f.center.x) < w / 2 - 0.5 * CM and abs(f.center.y) < d / 2 - 0.5 * CM): f.material_index = 1
    ds = [than]; mieng = -c / 2 + h0
    for (sx, sy, dx, dy, ax, g) in ((w, d * 0.45, 0, d / 2, 'X', 55), (w, d * 0.45, 0, -d / 2, 'X', -55), (w * 0.45, d, w / 2, 0, 'Y', -55), (w * 0.45, d, -w / 2, 0, 'Y', 55)):
        n_ = _hop(sx, sy, 0.3 * CM, (0, 0, 0), ct)
        n_.location = (dx, dy, mieng)
        for v in n_.data.vertices: v.co += Vector((sx / 2 * (1 if dx > 0 else -1 if dx < 0 else 0), sy / 2 * (1 if dy > 0 else -1 if dy < 0 else 0), 0))
        n_.rotation_euler = ((math.radians(g), 0, 0) if ax == 'X' else (0, math.radians(g), 0)); ds.append(n_)
    ds.append(_tru(w * 0.09, c * 0.18, (-w * 0.25, -d * 0.12, mieng + c * 0.02), chau))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=w * 0.1, location=(-w * 0.25, -d * 0.12, mieng + c * 0.14)); sd = bpy.context.object; sd.scale = (1, 1, 0.6); sd.data.materials.append(la); ds.append(sd)
    fr = _hop(w * 0.32, 0.8 * CM, c * 0.38, (w * 0.08, d * 0.18, mieng + c * 0.06), khung); fr.rotation_euler = (math.radians(-12), 0, 0); ds.append(fr)
    ds.append(_hop(w * 0.26, 0.2 * CM, c * 0.3, (w * 0.08, d * 0.18 - 0.5 * CM, mieng + c * 0.07), anh_vl))
    ds.append(_tru(w * 0.07, c * 0.22, (w * 0.3, -d * 0.2, mieng + c * 0.02), coc))
    return _gop(ds, ten)

def but(ten, w, d, c, anh=None):
    """Bút máy (đứng: co = phi × phi × dài): thân sơn mài đen, nắp có kẹp + vành vàng, đầu ngòi thuôn."""
    son = _vl('son mai', _lin('#0c0c0c'), 0.12); vang = _vl('vang', _lin('#d4af37'), 0.25, 1.0)
    r = min(w, d) / 2
    than = _tru(r, c * 0.62, (0, 0, -c * 0.12), son)
    dau = _tru(r, c * 0.12, (0, 0, -c * 0.49), son, dinh=r * 0.35)
    nap = _tru(r * 1.04, c * 0.36, (0, 0, c * 0.32), son)
    vanh = _tru(r * 1.08, c * 0.03, (0, 0, c * 0.15), vang)
    kep = _hop(r * 0.35, r * 0.5, c * 0.28, (0, -r * 1.1, c * 0.33), vang)
    dinh = _tru(r * 0.9, c * 0.02, (0, 0, c * 0.5), vang)
    return _gop([than, dau, nap, vanh, kep, dinh], ten)

KHUON = {'ly': ly, 'dien_thoai': dien_thoai, 'ho_so': ho_so, 'the_deo': the_deo, 'thung': thung, 'but': but}

def dung(kieu, ten, co_cm, anh=None):
    """Dựng đạo cụ theo khuôn, ép đúng co (cm) — giữ tỉ lệ, gốc ở tâm hộp bao. None = không có khuôn này (khối thường)."""
    f = KHUON.get(kieu)
    if not f: return None
    w, d, c = [x * CM for x in co_cm]
    o = f(ten, w, d, c, anh)
    bpy.context.view_layer.update()
    bb = [Vector(v) for v in o.bound_box]; lo = Vector([min(v[i] for v in bb) for i in range(3)]); hi = Vector([max(v[i] for v in bb) for i in range(3)])
    sz = hi - lo; tam = (lo + hi) / 2
    for v in o.data.vertices: v.co -= tam
    k = min(w / (sz.x or 1), d / (sz.y or 1), c / (sz.z or 1))
    for v in o.data.vertices: v.co *= k
    o.location = (0, 0, 0); o.rotation_euler = (0, 0, 0)
    return o
