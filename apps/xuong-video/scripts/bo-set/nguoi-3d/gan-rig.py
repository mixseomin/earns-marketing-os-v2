# GẮN RIG cho NGƯỜI SINH TỪ ẢNH (anh 21/10/2026: "thử làm người trước — đủ chi tiết và rig", mẫu kiểu Tripo AI). Mesh ảnh→3D (Hunyuan3D / TRELLIS)
# chi tiết áo / tóc / giày nhưng là MỘT khối không xương. Cách ngành làm (Mixamo, AccuRig): đặt mesh trùng một thân mẫu đã có rig rồi CHÉP TRỌNG SỐ
# da từ thân mẫu sang. Ở đây thân mẫu = chính người MPFB của máy dựng (cùng giới / tuổi / chiều cao, rig 'default') → mesh mới nhận đúng bộ xương
# mà mocap / IK / dáng của dung-set.py đang lái, không phải viết lại phần diễn.
#   1. chuẩn hoá mesh: chân chạm đất, giữa gốc, cao đúng cm nhân vật
#   2. dáng tay của thân MPFB (chữ A) xoay theo dáng tay của ảnh (buông) → chép trọng số (gần mặt nhất, nội suy)
#   3. đưa mesh về dáng nghỉ chữ A của rig gốc → lưu .blend: thả vào bất kỳ rig MPFB 'default' cùng cỡ là chạy
#   4. màu: chiếu ảnh TRƯỚC lên mặt hướng trước, ảnh SAU lên mặt hướng sau (trộn theo pháp tuyến)
#   5. thử: vài dáng (đứng, chỉ tay, bước, ngồi, quay đầu) → ảnh soát
#   Blender -b --factory-startup -P gan-rig.py -- <mesh.glb> <truoc.png> <sau.png|-> <gioi nu|nam> <tuoi> <cao_cm> <thu-muc-ra>
import bpy, sys, os, math, importlib.util
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
GLB, TRUOC, SAU, GIOI, TUOI, CAO, RA = a[0], a[1], (a[2] if a[2] != '-' else None), a[3], int(a[4]), float(a[5]), a[6]
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
# trọng số trước / sau theo pháp tuyến (mặt hướng −y = trước), lưu thành thuộc tính đỉnh → đi theo da khi diễn
at = me.color_attributes.new('truoc', 'FLOAT_COLOR', 'POINT')
for v in me.vertices:
    t = max(0.0, min(1.0, 0.5 - v.normal.y * 2.5)); at.data[v.index].color = (t, t, t, 1)
mat = bpy.data.materials.new('da'); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.55
def tex(uvten, p):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(p); t.extension = 'EXTEND'
    u = nt.nodes.new('ShaderNodeUVMap'); u.uv_map = uvten; nt.links.new(u.outputs[0], t.inputs[0]); return t
tt = tex('UVtruoc', TRUOC)
if SAU:
    ts = tex('UVsau', SAU); mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    atn = nt.nodes.new('ShaderNodeAttribute'); atn.attribute_name = 'truoc'
    nt.links.new(atn.outputs['Fac'], mix.inputs['Factor']); nt.links.new(ts.outputs['Color'], mix.inputs[6]); nt.links.new(tt.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
else: nt.links.new(tt.outputs['Color'], bsdf.inputs['Base Color'])
D.data.materials.append(mat)

# 3. đưa mesh về dáng nghỉ chữ A của rig gốc: nghỉ = dáng ảnh → buộc da → trả xương về chữ A → nướng da → nghỉ lại chữ A
chon(rig); bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
am = D.modifiers.new('xuong', 'ARMATURE'); am.object = rig
for b, M in dang_tay.items(): P[b].matrix_basis = M.inverted()
bpy.context.view_layer.update()
chon(D); bpy.ops.object.modifier_apply(modifier='xuong')
chon(rig); bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
D.parent = rig; am = D.modifiers.new('xuong', 'ARMATURE'); am.object = rig
h.hide_render = h.hide_viewport = True
for o in [o for o in bpy.data.objects if o.parent == h]: o.hide_render = o.hide_viewport = True
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RA, 'nguoi.blend'))
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
