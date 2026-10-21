# RIG TỰ ĐỘNG cho nhân vật BỐN CHÂN sinh từ ảnh (TRELLIS / Hunyuan3D) — anh 21/10/2026 "mẫu này vẫn phải gắn rig mới chuyển động được" → "làm đi".
# Mixamo / AccuRig chỉ làm người hai chân; MPFB (gan-rig.py của người) không có thân thú. Ở đây xương đặt từ HÌNH KHỐI của chính lưới:
#   - chân  = 4 cụm đỉnh thấp nhất (chia theo trái/phải × trước/sau quanh tâm thân)
#   - cổ    = đường tâm các lát cắt theo chiều CAO, từ vai lên tới đầu (đầu = vùng đỉnh cao nhất phía trước)
#   - đuôi  = đường tâm các lát cắt theo chiều DỌC, từ hông ra tới đỉnh xa nhất phía sau
#   - thân  = hông → ngực
# Da: lưới sinh từ ảnh thường hở / tự cắt → "Automatic Weights" (bone heat) hay hỏng. Cách chắc: tính trọng số trên một BẢN SAO KÍN (voxel remesh) rồi
# CHÉP trọng số sang lưới gốc (Data Transfer, đỉnh gần nhất nội suy theo mặt).
# Quy ước hướng: mặt nhìn −y, lưng +z (đúng đầu ra TRELLIS; xem-mo-hinh.py góc 0 = nhìn thẳng mặt).
#   Blender -b --factory-startup -P rig-4-chan.py -- <mo-hinh.glb> <thu-muc-ra>   → rig.blend + soat.N.png (các dáng thử)
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]; VAO, RA = a[0], a[1]; os.makedirs(RA, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=VAO)
me = [o for o in bpy.data.objects if o.type == 'MESH']
for o in bpy.data.objects: o.select_set(o in me)
bpy.context.view_layer.objects.active = me[0]
if len(me) > 1: bpy.ops.object.join()
M = bpy.context.object; M.name = 'Da'
mw = M.matrix_world.copy(); M.parent = None; M.matrix_world = mw
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in bpy.data.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
V = [v.co.copy() for v in M.data.vertices]
lo = Vector([min(p[i] for p in V) for i in range(3)]); hi = Vector([max(p[i] for p in V) for i in range(3)]); H = hi.z - lo.z
# đặt đáy chạm z=0, tâm xy về gốc
dich = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
for v in M.data.vertices: v.co -= dich
V = [p - dich for p in V]; lo -= dich; hi -= dich
tb = lambda ds: sum(ds, Vector()) / len(ds) if ds else Vector()

# ---------- giải phẫu từ hình khối ----------
than = [p for p in V if 0.3 * H < p.z < 0.6 * H]
# thân = khối dày nhất: lát giữa theo y có nhiều đỉnh nhất ở tầm cao thân
tam_than = tb(than)
y_than = sorted(p.y for p in than); y_truoc, y_sau = y_than[int(len(y_than) * 0.15)], y_than[int(len(y_than) * 0.85)]
# chân: đỉnh thấp (z < 0.18 H) chia 4 cụm
thap = [p for p in V if p.z < 0.18 * H]
y_chan = sorted(p.y for p in thap)[len(thap) // 2]
chan = {}
for ten, dk in (('chan_truoc.L', lambda p: p.x > 0 and p.y < y_chan), ('chan_truoc.R', lambda p: p.x <= 0 and p.y < y_chan),
                ('chan_sau.L', lambda p: p.x > 0 and p.y >= y_chan), ('chan_sau.R', lambda p: p.x <= 0 and p.y >= y_chan)):
    ds = [p for p in thap if dk(p)]; c = tb(ds); chan[ten] = (Vector((c.x, c.y, 0.0)), Vector((c.x, c.y, 0.36 * H)))
hong = Vector((0, (chan['chan_sau.L'][0].y + chan['chan_sau.R'][0].y) / 2, 0.45 * H))
nguc = Vector((0, (chan['chan_truoc.L'][0].y + chan['chan_truoc.R'][0].y) / 2, 0.5 * H))
# đầu: đỉnh cao nhất phía trước; cổ: tâm các lát theo z từ vai tới gốc đầu (chỉ đỉnh phía trước tâm thân)
dinh = max(V, key=lambda p: p.z)
dau_ds = [p for p in V if p.z > dinh.z - 0.22 * H and p.y < tam_than.y]
tam_dau = tb(dau_ds)
duoi_dau = Vector((tam_dau.x, tam_dau.y + 0.05 * H, dinh.z - 0.22 * H))
def duong_tam(tu, den, truc, dk, n):
    """Tâm các lát cắt vuông góc trục `truc` (1 = y, 2 = z) từ giá trị tu tới den — n+1 điểm."""
    ds = []
    for i in range(n + 1):
        t = tu + (den - tu) * i / n; w = abs(den - tu) / n * 0.6
        lat = [p for p in V if abs(p[truc] - t) < w and dk(p)]
        ds.append(tb(lat) if lat else None)
    return [d for d in ds if d is not None]
co = duong_tam(nguc.z + 0.05 * H, duoi_dau.z, 2, lambda p: p.y < tam_than.y - 0.05 * H, 4)
co = [nguc + Vector((0, -0.02 * H, 0.05 * H))] + co[1:-1] + [duoi_dau]
mui = min(dau_ds, key=lambda p: p.y)
# đuôi: đỉnh xa nhất phía sau
chop = max(V, key=lambda p: p.y)
duoi = duong_tam(hong.y, chop.y, 1, lambda p: p.z < 0.7 * H and abs(p.x) < 0.25 * (hi.x - lo.x) + 0.01, 5)
duoi = [hong] + duoi[1:-1] + [chop]

# ---------- xương ----------
bpy.ops.object.armature_add(location=(0, 0, 0)); R = bpy.context.object; R.name = 'Xuong'
bpy.ops.object.mode_set(mode='EDIT'); eb = R.data.edit_bones; eb.remove(eb[0])
def xuong(ten, dau, duoi_, cha=None, noi=True):
    b = eb.new(ten); b.head = dau; b.tail = duoi_ if (duoi_ - dau).length > 1e-4 else dau + Vector((0, 0, 0.01))
    if cha: b.parent = eb[cha]; b.use_connect = noi and (eb[cha].tail - b.head).length < 1e-4
    return ten
xuong('goc', Vector((0, hong.y, 0)), Vector((0, hong.y - 0.2 * H, 0)))
xuong('hong', hong, (hong + nguc) / 2, 'goc', False); xuong('nguc', (hong + nguc) / 2, nguc, 'hong')
cha = 'nguc'
for i in range(len(co) - 1): cha = xuong(f'co.{i}', co[i], co[i + 1], cha, i > 0)
xuong('dau', duoi_dau, Vector((mui.x, mui.y, duoi_dau.z + 0.05 * H)), cha)
cha = 'hong'
for i in range(len(duoi) - 1): cha = xuong(f'duoi.{i}', duoi[i], duoi[i + 1], cha, i > 0)
for ten, (day, dinh_) in chan.items():
    goi = (day + dinh_) / 2 + Vector((0, 0.02 * H if 'truoc' in ten else -0.02 * H, 0))
    xuong(f'{ten}.tren', dinh_, goi, 'nguc' if 'truoc' in ten else 'hong', False); xuong(f'{ten}.duoi', goi, day, f'{ten}.tren')
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- da: trọng số trên bản sao kín → chép sang lưới gốc ----------
bpy.ops.object.select_all(action='DESELECT'); M.select_set(True); bpy.context.view_layer.objects.active = M
bpy.ops.object.duplicate(); K = bpy.context.object; K.name = 'Kin'
rm = K.modifiers.new('kin', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = H / 120
bpy.ops.object.modifier_apply(modifier='kin')
bpy.ops.object.select_all(action='DESELECT'); K.select_set(True); R.select_set(True); bpy.context.view_layer.objects.active = R
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for b in R.data.bones: M.vertex_groups.new(name=b.name)
dt = M.modifiers.new('chep', 'DATA_TRANSFER'); dt.object = K; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.select_all(action='DESELECT'); M.select_set(True); bpy.context.view_layer.objects.active = M
bpy.ops.object.modifier_apply(modifier='chep')
bpy.data.objects.remove(K, do_unlink=True)
M.parent = R; am = M.modifiers.new('xuong', 'ARMATURE'); am.object = R
thieu = sum(1 for v in M.data.vertices if not v.groups or sum(g.weight for g in v.groups) < 1e-3)
print('DA dinh khong trong so:', thieu, '/', len(M.data.vertices))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RA, 'rig.blend'))

# ---------- thử dáng + ảnh soát ----------
bpy.ops.mesh.primitive_plane_add(size=H * 20, location=(0, 0, 0)); s = bpy.context.object
m = bpy.data.materials.new('nen'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1); s.data.materials.append(m)
for loc, e in (((H * 2, -H * 2, H * 2.5), 800), ((-H * 2.5, -H, H * 1.5), 300), ((0, H * 3, H * 2), 400)):
    bpy.ops.object.light_add(type='AREA', location=loc); l = bpy.context.object; l.data.energy = e * H * H; l.data.size = H * 1.5
    l.rotation_euler = (Vector((0, 0, H / 2)) - l.location).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.3
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 40
# máy nghiêng gần ngang: thấy cổ, đuôi, bốn chân
d = max(hi - lo) * 1.7; cam.location = Vector((d * 0.92, -d * 0.4, H * 0.75)); cam.rotation_euler = (Vector((0, 0, H * 0.45)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.render.resolution_x = sc.render.resolution_y = 512
sc.view_settings.view_transform = 'AgX'
pb = R.pose.bones
def dat_lai():
    for b in pb: b.rotation_mode = 'XYZ'; b.rotation_euler = (0, 0, 0)
def xoay(ten, x=0, y=0, z=0):
    if ten in pb: pb[ten].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
so_co = len([b for b in pb if b.name.startswith('co.')]); so_duoi = len([b for b in pb if b.name.startswith('duoi.')])
DANG = {
    'nghi': [],
    # góc mỗi đốt nhỏ — cộng dồn theo chuỗi (bản đầu 25°/đốt × 4 đốt cổ = đầu gập vào ngực, đuôi 14–30°/đốt quét ra sau thân)
    'cui_co': [(f'co.{i}', 10, 0, 0) for i in range(so_co)] + [('dau', 12, 0, 0)],
    'quay_dau': [(f'co.{i}', 0, 0, 9) for i in range(so_co)] + [('dau', 0, 0, 12)],
    'vay_duoi': [(f'duoi.{i}', 0, 0, 6 + 2 * i) for i in range(so_duoi)],
    'buoc': [('chan_truoc.L.tren', -28, 0, 0), ('chan_truoc.L.duoi', 22, 0, 0), ('chan_sau.R.tren', 25, 0, 0), ('chan_sau.R.duoi', -12, 0, 0),
             ('chan_truoc.R.tren', 12, 0, 0), ('chan_sau.L.tren', -12, 0, 0)],
}
for i, (ten, ds) in enumerate(DANG.items()):
    dat_lai()
    for x in ds: xoay(*x)
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(RA, f'soat.{i}.{ten}.png'); bpy.ops.render.render(write_still=True)
print('RA', RA, 'xuong', len(pb), 'co', so_co, 'duoi', so_duoi)
