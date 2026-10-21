# GẮN RIG cho NGƯỜI SINH TỪ ẢNH (anh 21/10/2026: "thử làm người trước — đủ chi tiết và rig", mẫu kiểu Tripo AI). Mesh ảnh→3D (Hunyuan3D / TRELLIS)
# chi tiết áo / tóc / giày nhưng là MỘT khối không xương. Cách ngành làm (Mixamo, AccuRig): đặt mesh trùng một thân mẫu đã có rig rồi CHÉP TRỌNG SỐ
# da từ thân mẫu sang. Ở đây thân mẫu = chính người MPFB của máy dựng (cùng giới / tuổi / chiều cao, rig 'default') → mesh mới nhận đúng bộ xương
# mà mocap / IK / dáng của dung-set.py đang lái, không phải viết lại phần diễn.
#   1. chuẩn hoá mesh: chân chạm đất, giữa gốc, cao đúng cm nhân vật
#   2. dáng tay của thân MPFB (chữ A) xoay theo dáng tay của ảnh (buông) → chép trọng số (gần mặt nhất, nội suy)
#   3. đưa mesh về dáng nghỉ chữ A của rig gốc → lưu da.blend: thả vào bất kỳ rig MPFB 'default' cùng giới / tuổi / cao là chạy (khoi_3d.da_3d)
#   4. màu: chiếu ảnh TRƯỚC lên mặt hướng trước, ảnh SAU lên mặt hướng sau (trộn theo pháp tuyến)
#   6. MẶT: căn mặt MPFB trùng mặt da theo 5 điểm mốc YuNet (moc-mat.py) rồi NƯỚNG từng đơn vị cơ mặt ARKit của MPFB thành shape key của da
#      (Surface Deform → shape key) — bieu_mat lái cả da; vị trí con ngươi trên da (da['mat_da']) cho chấm mắt (dat_con_nguoi)
#   5. thử: vài dáng (đứng, chỉ tay, bước, ngồi, quay đầu) → ảnh soát
#   Blender -b --factory-startup -P gan-rig.py -- <mesh.glb> <truoc.png> <sau.png|-> <gioi nu|nam> <tuoi> <cao_cm> <thu-muc-ra> [moc.json]
import bpy, sys, os, math, importlib.util
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
GLB, TRUOC, SAU, GIOI, TUOI, CAO, RA = a[0], a[1], (a[2] if a[2] != '-' else None), a[3], int(a[4]), float(a[5]), a[6]
import json
MOC = json.load(open(a[7])) if len(a) > 7 and os.path.exists(a[7]) else None
os.makedirs(RA, exist_ok=True)
_sp = importlib.util.spec_from_file_location('nguoi', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mesh', 'nguoi.py'))
ng = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(ng)
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene

def bb(objs):
    v = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector((min(p.x for p in v), min(p.y for p in v), min(p.z for p in v))), Vector((max(p.x for p in v), max(p.y for p in v), max(p.z for p in v)))
def chon(*objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

# 1. mesh sinh: gộp, bỏ vật liệu cũ, chuẩn hoá
bpy.ops.import_scene.gltf(filepath=GLB)
ms = [o for o in bpy.data.objects if o.type == 'MESH']
chon(*ms)
if len(ms) > 1: bpy.ops.object.join()
D = bpy.context.view_layer.objects.active; D.name = 'DA'
for o in [o for o in bpy.data.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
D.parent = None; chon(D); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
lo, hi = bb([D]); k = CAO / 100 / (hi.z - lo.z)
D.scale = (k,) * 3; D.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, -lo.z * k)
chon(D); bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
D.data.materials.clear()
# mesh ảnh→3D dày (~90 nghìn đỉnh): giảm còn ≤ 50 nghìn — đủ nét ở cận, da.blend nhẹ (mỗi shape key biểu cảm chép đủ toạ độ mọi đỉnh)
if len(D.data.vertices) > 50000:
    dm = D.modifiers.new('giam', 'DECIMATE'); dm.ratio = 50000 / len(D.data.vertices); chon(D); bpy.ops.object.modifier_apply(modifier='giam')

# 2. thân MPFB cùng giới / tuổi / cao + rig 'default'
m = ng._mpfb()
h = m['hs'].create_human(); ng._dat_than(m, h, GIOI, TUOI)
rig = m['hs'].add_builtin_rig(h, 'default'); bpy.context.view_layer.update()
lo_h, hi_h = bb([h]); rig.scale = (CAO / 100 / (hi_h.z - lo_h.z),) * 3; bpy.context.view_layer.update()
chon(rig); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)   # rig cỡ mét thật, scale 1 → khớp mesh không lệch
bpy.context.view_layer.update()

# dáng tay: đo cổ tay của MESH (điểm thấp nhất của khối tay mỗi bên ở độ cao hông) — tay buông sát người, MPFB nghỉ chữ A
P = rig.pose.bones
def dau(b): return rig.matrix_world @ P[b].head
def xoay_toi(b, tu, toi):
    """Xoay xương b quanh đầu xương để vectơ (tu → đầu xương con) chỉ về hướng toi (toạ độ thế giới)."""
    v = (dau(tu) - dau(b)).normalized(); q = v.rotation_difference(toi.normalized())
    hd = P[b].head.copy(); P[b].matrix = Matrix.Translation(hd) @ q.to_matrix().to_4x4() @ Matrix.Translation(-hd) @ P[b].matrix
    bpy.context.view_layer.update()
dv = [D.matrix_world @ v.co for v in D.data.vertices]
for b, ben in (('L', 1), ('R', -1)):
    vai = dau(f'upperarm01.{b}'); z_hong = dau('spine05').z if 'spine05' in P else vai.z * 0.6
    # tay của mesh = các đỉnh ngoài cùng phía bên đó ở dải cao hông ± 12 cm → cổ tay ≈ điểm ngoài cùng thấp nhất của dải
    dai = [p for p in dv if abs(p.z - (vai.z - 0.33 * CAO / 100)) < 0.06 and p.x * ben > 0]
    if not dai: continue
    ngoai = max(dai, key=lambda p: p.x * ben)
    toi = Vector((ngoai.x, (ngoai.y + vai.y) / 2, ngoai.z)) - vai
    xoay_toi(f'upperarm01.{b}', f'lowerarm01.{b}', toi)
    xoay_toi(f'lowerarm01.{b}', f'wrist.{b}', toi)
dang_tay = {b: P[b].matrix_basis.copy() for b in ('upperarm01.L', 'lowerarm01.L', 'upperarm01.R', 'lowerarm01.R')}

# chép trọng số: thân MPFB (đã theo dáng tay) → mesh sinh, nội suy trên mặt gần nhất
chon(D)
for g in h.vertex_groups:
    if g.name in P or g.name.startswith('DEF'): D.vertex_groups.new(name=g.name)
dt = D.modifiers.new('chep', 'DATA_TRANSFER'); dt.object = h; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier='chep')
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
# làm mượt trọng số: chép gần-nhất để lại bậc thang ở chỗ thân mẫu và mesh lệch nhau (nách / vạt áo căng khi giơ tay) — chuẩn rig: smooth rồi giới hạn 4 xương / đỉnh
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')   # hai lệnh này chỉ chạy ở chế độ tô trọng số
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=3)
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
for g in list(D.vertex_groups):   # nhóm rỗng (xương mặt không chạm mesh…) bỏ
    if not any(gg.group == g.index and gg.weight > 1e-3 for v in D.data.vertices for gg in v.groups): D.vertex_groups.remove(g)

# 4. màu chiếu từ ảnh (tính ở dáng ảnh, trước khi đưa về chữ A)
def hop_anh(p):
    im = bpy.data.images.load(p); w, hh = im.size; import numpy as np
    px = np.array(im.pixels[:]).reshape(hh, w, 4)[::-1]; al = px[..., 3] > 0.5
    ys, xs = np.where(al); return im, (xs.min() / w, ys.min() / hh, (xs.max() + 1) / w, (ys.max() + 1) / hh)
lo, hi = bb([D])
me = D.data
for ten, p, guong in (('UVtruoc', TRUOC, False), ('UVsau', SAU, True)):
    if not p: continue
    im, (bx0, by0, bx1, by1) = hop_anh(p)
    uv = me.uv_layers.new(name=ten)
    for poly in me.polygons:
        for li in poly.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            fx = (c.x - lo.x) / (hi.x - lo.x); fx = 1 - fx if guong else fx
            fz = (hi.z - c.z) / (hi.z - lo.z)
            uv.data[li].uv = (bx0 + fx * (bx1 - bx0), 1 - (by0 + fz * (by1 - by0)))
# ĐIỂM MỐC MẶT trên da (dáng ảnh = dáng nghỉ ở vùng đầu): toạ độ ảnh → x, z theo đúng phép chiếu màu ở trên, y = tia từ phía trước chạm da
MOC3 = {}
if MOC and 'loi' not in MOC:
    _, (bx0, by0, bx1, by1) = hop_anh(TRUOC)
    for kh, (u, v) in MOC.items():
        x = lo.x + (u - bx0) / (bx1 - bx0) * (hi.x - lo.x); z = hi.z - (v - by0) / (by1 - by0) * (hi.z - lo.z)
        ok, p, *_ = D.ray_cast(Vector((x, lo.y - 1, z)), Vector((0, 1, 0)))
        if ok: MOC3[kh] = p.copy()
    print('MOC3', {k: tuple(round(c, 3) for c in v) for k, v in MOC3.items()})
# trọng số trước / sau theo pháp tuyến (mặt hướng −y = trước), lưu thành thuộc tính đỉnh → đi theo da khi diễn
at = me.color_attributes.new('truoc', 'FLOAT_COLOR', 'POINT')
for v in me.vertices:
    t = max(0.0, min(1.0, 0.5 - v.normal.y * 2.5)); at.data[v.index].color = (t, t, t, 1)
mat = bpy.data.materials.new('da'); mat.use_nodes = True; nt = mat.node_tree
# CHỈ TÁN XẠ, không bóng: ảnh chiếu đã mang sẵn ánh sáng studio; Principled (kể cả nhám 0,8 / bóng 0,2) dưới đèn tương phản của cảnh hắt tóc đen
# thành vỏ xám trùm đầu (tập 135 #24, 21/10/2026 — soi bằng tự phát sáng thì màu đúng, bằng Diffuse thì tóc đen lại)
nt.nodes.remove(nt.nodes['Principled BSDF']); bsdf = nt.nodes.new('ShaderNodeBsdfDiffuse')
nt.links.new(bsdf.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
def tex(uvten, p):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(p); t.extension = 'EXTEND'
    u = nt.nodes.new('ShaderNodeUVMap'); u.uv_map = uvten; nt.links.new(u.outputs[0], t.inputs[0]); return t
tt = tex('UVtruoc', TRUOC)
if SAU:
    ts = tex('UVsau', SAU); mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    atn = nt.nodes.new('ShaderNodeAttribute'); atn.attribute_name = 'truoc'
    nt.links.new(atn.outputs['Fac'], mix.inputs['Factor']); nt.links.new(ts.outputs['Color'], mix.inputs[6]); nt.links.new(tt.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Color'])
else: nt.links.new(tt.outputs['Color'], bsdf.inputs['Color'])
D.data.materials.append(mat)

# 3. đưa mesh về dáng nghỉ chữ A của rig gốc: nghỉ = dáng ảnh → buộc da → trả xương về chữ A → nướng da → nghỉ lại chữ A
chon(rig); bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
am = D.modifiers.new('xuong', 'ARMATURE'); am.object = rig
for b, M in dang_tay.items(): P[b].matrix_basis = M.inverted()
bpy.context.view_layer.update()
chon(D); bpy.ops.object.modifier_apply(modifier='xuong')
chon(rig); bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
# 6. MẶT: nướng biểu cảm. Căn thân MPFB (cả khối) cho tâm + khoảng hai mắt trùng mắt da, buộc Surface Deform vùng mặt của da vào thân MPFB, rồi
# mỗi đơn vị cơ mặt ARKit (bảng nét mặt của máy dựng) đặt = 1 trên thân MPFB → kết quả thành một shape key của da.
def nuong_mat():
    if not {'mat_t', 'mat_p'} <= MOC3.keys(): print('CANH BAO không có điểm mốc mắt — bỏ nướng biểu cảm'); return 0
    bL, bR = rig.data.bones.get('eye.L'), rig.data.bones.get('eye.R')
    if not bL or not bR: return 0
    eL, eR = rig.matrix_world @ bL.head_local, rig.matrix_world @ bR.head_local
    dL, dR = MOC3['mat_t'], MOC3['mat_p']   # mat_t = mắt TRÁI của người = bên phải ảnh = +x (cùng phía eye.L)
    D['mat_da'] = {'eye.L': list(dL), 'eye.R': list(dR)}
    cDA = (dL + dR) / 2 + Vector((0, 0.011, 0)); cMP = (eL + eR) / 2; k = (dL - dR).length / (eL - eR).length
    print('CAN MAT', 'lech cm', tuple(round(c * 100, 1) for c in (cDA - cMP)), 'ti le', round(k, 3))
    D['dau_ve_mpfb'] = {'tam_da': list(cDA), 'tam_mpfb': list(cMP), 'ti_le': k}   # chế độ CHỈ ĐẦU: v' = tam_mpfb + (v − tam_da) / ti_le
    mw0 = h.matrix_world.copy()
    h.matrix_world = Matrix.Translation(cDA) @ Matrix.Scale(k, 4) @ Matrix.Translation(-cMP) @ mw0
    h.hide_viewport = h.hide_render = False; bpy.context.view_layer.update()
    dau_ = {b.name for b in rig.data.bones if b.name == 'head' or any(x.name == 'head' for x in b.parent_recursive)}
    gid = {g.index for g in D.vertex_groups if g.name in dau_}
    vm = D.vertex_groups.new(name='mat')
    for v in D.data.vertices:
        w = min(1.0, sum(gg.weight for gg in v.groups if gg.group in gid)) * max(0.0, min(1.0, (-v.normal.y + 0.2) / 0.5))
        if w > 0.01: vm.add([v.index], w, 'REPLACE')
    sd = D.modifiers.new('sd', 'SURFACE_DEFORM'); sd.target = h; sd.vertex_group = 'mat'; sd.falloff = 4
    chon(D); bpy.ops.object.surfacedeform_bind(modifier='sd')
    import importlib as _il
    FS = next(getattr(_il.import_module(x), 'FaceService') for x in list(sys.modules) if x.endswith('mpfb.services.faceservice'))
    dv = sorted({kk for bang in ng.BIEU_CAM_ARKIT.values() for k_ in bang for kk in ([k_[:-1] + 'Left', k_[:-1] + 'Right'] if k_.endswith('*') else [k_]) if not kk.startswith('eyeLook')})
    so = 0
    for u in dv:
        FS.clear_expression(h); FS.set_expression(h, {u: 1.0}); bpy.context.view_layer.update()
        bpy.ops.object.modifier_apply_as_shapekey(keep_modifier=True, modifier='sd')
        kb = D.data.shape_keys.key_blocks[-1]; kb.name = u
        nen = D.data.shape_keys.key_blocks[0]
        if max((kb.data[i].co - nen.data[i].co).length for i in range(0, len(kb.data), 7)) < 0.0005: D.shape_key_remove(kb)   # đơn vị không đụng da
        else: so += 1
    FS.clear_expression(h); D.modifiers.remove(sd); D.vertex_groups.remove(vm)
    h.matrix_world = mw0; bpy.context.view_layer.update()
    return so
print('BIEU CAM', nuong_mat(), 'shape key')

# 7. VÙNG ĐẦU cho chế độ CHỈ ĐẦU (mesh/nguoi.py › gan_da_3d che_do='dau': đầu + tóc từ da, thân + đồ MPFB theo trang phục từng shot — anh 21/10/2026
# "trang phục cần linh hoạt"). Nhóm 'giu_dau' = đỉnh nghiêng về xương đầu / cổ ≥ 0,5, cộng TÓC dài rủ xuống vai / lưng: màu tóc (tối, không ngả xanh như
# vải navy) ở mặt bên / sau, không ở giữa ngực (áo hai dây đen trong vest sẽ bị nhận nhầm là tóc).
def vung_dau():
    import numpy as np
    dau_ = {b.name for b in rig.data.bones if b.name in ('head', 'neck01', 'neck02', 'neck03') or any(x.name == 'head' for x in b.parent_recursive)}
    gid = {g.index for g in D.vertex_groups if g.name in dau_}
    anh = {}
    for ten, p in (('UVtruoc', TRUOC), ('UVsau', SAU)):
        if p: im = bpy.data.images.load(p, check_existing=True); w, hh = im.size; anh[ten] = (np.array(im.pixels[:]).reshape(hh, w, 4), w, hh)
    uv_dinh = {}
    for ten in anh:
        uvl = me.uv_layers[ten].data; d = {}
        for l in me.loops: d.setdefault(l.vertex_index, uvl[l.index].uv)
        uv_dinh[ten] = d
    at_ = me.color_attributes['truoc'].data
    z_co = (rig.matrix_world @ rig.data.bones['neck01'].head_local).z if 'neck01' in rig.data.bones else CAO / 100 * 0.82
    g = D.vertex_groups.new(name='giu_dau'); so_toc = 0; chon_ = set(); toc_ = set()
    for v in me.vertices:
        w = sum(gg.weight for gg in v.groups if gg.group in gid)
        toc = False
        if w < 0.5 and v.co.z > z_co - 0.35 and abs(v.co.x) < 0.24 and (v.normal.y > -0.3 or abs(v.co.x) > 0.09) and anh:
            ten = 'UVtruoc' if at_[v.index].color[0] > 0.5 or 'UVsau' not in anh else 'UVsau'
            px, iw, ih = anh[ten]; u, vv = uv_dinh[ten][v.index]
            r, g_, b, a_ = px[min(ih - 1, max(0, int(vv * ih))), min(iw - 1, max(0, int(u * iw)))]
            # tóc đen dưới đèn studio ngả xanh nhẹ (đo 21/10 trên Hạ: lưng xanh − đỏ ≈ 0,045) — vải navy ≥ 0,09 → ngưỡng 0,065 ở giữa
            toc = max(r, g_, b) < 0.24 and max(r, g_, b) - min(r, g_, b) < 0.08 and (b - r) < 0.065
        if w >= 0.5 or toc: chon_.add(v.index); so_toc += toc
        if toc: toc_.add(v.index)
    # chỉ giữ mảng NỐI LIỀN với đầu: điểm rời lọt ngưỡng màu (cổ áo, nếp tối của vải) thành vụn đen lơ lửng quanh vai (thử 21/10)
    ke = {i: [] for i in chon_}
    for e in me.edges:
        a_, b_ = e.vertices
        if a_ in chon_ and b_ in chon_: ke[a_].append(b_); ke[b_].append(a_)
    goc = max(chon_, key=lambda i: me.vertices[i].co.z); giu, hang = {goc}, [goc]
    while hang:
        i = hang.pop()
        for j in ke[i]:
            if j not in giu: giu.add(j); hang.append(j)
    g.add(list(giu), 1.0, 'REPLACE')
    D.vertex_groups.new(name='toc_duoi').add(list(giu & toc_), 1.0, 'REPLACE')   # tóc rủ dưới gáy: chế độ chỉ đầu đẩy ra khỏi áo MPFB
    print('VUNG DAU', sum(1 for v in me.vertices if any(gg.group == g.index for gg in v.groups)), 'dinh, tóc dưới cổ', so_toc)
vung_dau()
D.parent = rig; am = D.modifiers.new('xuong', 'ARMATURE'); am.object = rig
h.hide_render = h.hide_viewport = True
for o in [o for o in bpy.data.objects if o.parent == h]: o.hide_render = o.hide_viewport = True
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RA, 'nguoi.blend'))
# da.blend = CHỈ mesh DA (trọng số + vật liệu, ảnh đóng gói) — máy dựng (mesh/nguoi.py › gan_da_3d) nạp rồi gắn vào rig MPFB của shot. Bỏ cha + bộ
# biến dạng trước khi ghi, kẻo kéo cả rig / thân mẫu theo vào tệp.
D.parent = None; D.modifiers.remove(D.modifiers['xuong'])
for im in bpy.data.images:
    if im.source == 'FILE' and not im.packed_file: im.pack()
bpy.data.libraries.write(os.path.join(RA, 'da.blend'), {D}, compress=True)
D.parent = rig; am = D.modifiers.new('xuong', 'ARMATURE'); am.object = rig
print('NHOM', len(D.vertex_groups), 'DINH', len(D.data.vertices))

# 5. thử dáng
s.render.engine = 'BLENDER_EEVEE'; s.render.resolution_x, s.render.resolution_y = 480, 720
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.56, 0.6, 1)
for i, (e, r) in enumerate(((3.5, (55, 0, -35)), (1.5, (60, 0, 140)))):
    l = bpy.data.objects.new(f'den{i}', bpy.data.lights.new(f'den{i}', 'SUN')); s.collection.objects.link(l); l.data.energy = e; l.rotation_euler = [math.radians(x) for x in r]
cam = bpy.data.objects.new('may', bpy.data.cameras.new('may')); s.collection.objects.link(cam); s.camera = cam; cam.data.lens = 50
s.view_settings.view_transform = 'AgX'
def dat_may(goc):
    r = math.radians(goc); c = Vector((0, 0, CAO / 200)); cam.location = c + Vector((math.sin(r), -math.cos(r), 0.08)) * 4.2
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
def xoay(b, truc, do):
    hd = P[b].head.copy(); P[b].matrix = Matrix.Translation(hd) @ Matrix.Rotation(math.radians(do), 4, truc) @ Matrix.Translation(-hd) @ P[b].matrix
    bpy.context.view_layer.update()
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
# xoay quanh trục thế giới (người nhìn −y): tay trái (+x) xuống = +Y, tay phải xuống = −Y; đùi ra trước = −X, gối gập = +X
XUOI = [('upperarm01.L', Y, 38), ('upperarm01.R', Y, -38)]
DANG = {
    'dung': XUOI,
    'chi_tay': [('upperarm01.L', Y, 38), ('upperarm01.R', X, -80), ('neck01', Z, -15)],
    'buoc': [('upperleg01.L', X, -28), ('lowerleg01.L', X, 15), ('upperleg01.R', X, 18), ('lowerleg01.R', X, 30), *XUOI,
             ('upperarm01.L', X, 20), ('upperarm01.R', X, -22)],
    'ngoi': [('upperleg01.L', X, -85), ('upperleg01.R', X, -85), ('lowerleg01.L', X, 90), ('lowerleg01.R', X, 90), *XUOI,
             ('lowerarm01.L', X, -60), ('lowerarm01.R', X, -60)],
    'quay_dau': [*XUOI, ('neck01', Z, 35)],
}
for ten, ds in DANG.items():
    for pb in P: pb.matrix_basis = Matrix()
    bpy.context.view_layer.update()
    for b, t, d in ds:
        if b in P: xoay(b, t, d)
    for goc in (0, 35):
        dat_may(goc); s.render.filepath = os.path.join(RA, f'{ten}_{goc}.png'); bpy.ops.render.render(write_still=True)
print('XONG', RA)
