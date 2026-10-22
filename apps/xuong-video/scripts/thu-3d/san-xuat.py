# KHÂU SẢN XUẤT (production-ready) cho lưới sinh từ ảnh — anh 22/10/2026 (mẫu Hyper3D: "2D Concept → High-Poly Sculpt → Production-Ready Model").
# TRELLIS / Hunyuan3D trả lưới TAM GIÁC thô (màu dán sẵn) — gập khớp xấu, mõm không có vòng cạnh để há. Chuẩn ngành: lưới dày = "high-poly",
# dựng lại lưới thưa TỨ GIÁC (retopology) → trải UV → BAKE chi tiết của lưới dày sang lưới thưa (màu + pháp tuyến). 0đ, toàn Blender:
#   1. kín hoá (voxel remesh — QuadriFlow đòi lưới kín, lưới AI hay hở)  2. QuadriFlow → tứ giác ~N mặt  3. Smart UV
#   4. bake DIFFUSE (chỉ màu) + NORMAL (tiếp tuyến) chọn-sang-hoạt-động từ lưới dày → ảnh 2K  5. vật liệu mới + xuất .glb
#   Blender -b --factory-startup -P san-xuat.py -- <vao.glb> <ra.glb> [--mat=8000] [--anh=2048]
import bpy, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig'))
import luoi

a = sys.argv[sys.argv.index('--') + 1:]; VAO, RA = a[0], a[1]
opt = {x.lstrip('-').split('=')[0]: x.split('=')[1] for x in a[2:] if '=' in x}
MAT = int(opt.get('mat', 8000)); ANH = int(opt.get('anh', 2048))
bpy.ops.wm.read_factory_settings(use_empty=True)
DAY, V, lo, hi = luoi.nap_chuan(VAO); DAY.name = 'Day'; H = hi.z - lo.z
so_dau = len(DAY.data.polygons)

# 1–2. lưới thưa tứ giác
bpy.ops.object.select_all(action='DESELECT'); DAY.select_set(True); bpy.context.view_layer.objects.active = DAY
bpy.ops.object.duplicate(); T = bpy.context.object; T.name = 'Thua'
for m in list(T.modifiers): T.modifiers.remove(m)
T.data.materials.clear()
r = T.modifiers.new('kin', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = H / 150; r.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='kin')
kq = bpy.ops.object.quadriflow_remesh(target_faces=MAT, use_preserve_sharp=False, use_preserve_boundary=False, use_mesh_symmetry=True, seed=0)
cach = 'quadriflow'
if 'FINISHED' not in kq:
    # QuadriFlow của Blender 5 từ chối cả lưới đã kín (0 cạnh / 0 đỉnh hở, một mảnh — đo 22/10/2026) → REMESH VOXEL ở đúng MẬT ĐỘ ĐÍCH: 100 % tứ
    # giác đều, kín; chi tiết bề mặt lấy lại bằng bake pháp tuyến. Số mặt ∝ 1/kích-thước-voxel² → co kích thước theo số mặt đo ở H/150.
    f0 = len(T.data.polygons); bpy.data.objects.remove(T, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT'); DAY.select_set(True); bpy.context.view_layer.objects.active = DAY
    bpy.ops.object.duplicate(); T = bpy.context.object; T.name = 'Thua'
    for m in list(T.modifiers): T.modifiers.remove(m)
    T.data.materials.clear()
    r = T.modifiers.new('voxel', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = H / 150 * (f0 / MAT) ** 0.5; r.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier='voxel'); cach = 'voxel'
    sm = T.modifiers.new('muot', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 3; bpy.ops.object.modifier_apply(modifier='muot')
tu_giac = sum(1 for p in T.data.polygons if len(p.vertices) == 4) / max(1, len(T.data.polygons))
bpy.ops.object.shade_smooth()

# 3. UV
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.003); bpy.ops.object.mode_set(mode='OBJECT')

# 4. bake màu + pháp tuyến từ lưới dày
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 8
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d_ in pr.devices: d_.use = True
    sc.cycles.device = 'GPU'
except Exception: pass
vl = bpy.data.materials.new('San xuat'); vl.use_nodes = True; nt = vl.node_tree; bs = nt.nodes['Principled BSDF']
T.data.materials.append(vl)
anh = {}
for ten, cs in (('mau', 'sRGB'), ('phap', 'Non-Color')):
    im = bpy.data.images.new(f'{os.path.basename(RA)}_{ten}', ANH, ANH); im.colorspace_settings.name = cs; anh[ten] = im
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = im; n.name = ten; anh[ten + '_nut'] = n
def bake(loai, ten):
    for n in nt.nodes: n.select = False
    nt.nodes.active = anh[ten + '_nut']; anh[ten + '_nut'].select = True
    bpy.ops.object.select_all(action='DESELECT'); DAY.select_set(True); T.select_set(True); bpy.context.view_layer.objects.active = T
    bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = 0.02 * H; bk.max_ray_distance = 0.06 * H; bk.margin = 8
    if loai == 'DIFFUSE': bk.use_pass_direct = False; bk.use_pass_indirect = False; bk.use_pass_color = True
    print('BAKE', loai, bpy.ops.object.bake(type=loai))
# MÀU: nối tạm ảnh màu của lưới dày vào EMISSION rồi bake EMIT — bake DIFFUSE ra ảnh ĐEN khi vật liệu glTF của TRELLIS mang metallic cao
# (màu khuếch tán của kim loại = 0; đo 22/10/2026 trên ankylo). Bản đồ pháp tuyến bake bình thường.
for m_ in DAY.data.materials:
    if not m_ or not m_.use_nodes: continue
    nt_ = m_.node_tree; b_ = next((n for n in nt_.nodes if n.type == 'BSDF_PRINCIPLED'), None); out = next((n for n in nt_.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if not b_ or not out: continue
    nguon = b_.inputs['Base Color'].links[0].from_socket if b_.inputs['Base Color'].links else None
    em = nt_.nodes.new('ShaderNodeEmission')
    if nguon: nt_.links.new(nguon, em.inputs['Color'])
    else: em.inputs['Color'].default_value = b_.inputs['Base Color'].default_value
    nt_.links.new(em.outputs['Emission'], out.inputs['Surface'])
bake('EMIT', 'mau'); bake('NORMAL', 'phap')
nt.links.new(anh['mau_nut'].outputs['Color'], bs.inputs['Base Color'])
nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(anh['phap_nut'].outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
bs.inputs['Roughness'].default_value = 0.6
for k in ('mau', 'phap'):   # ghi ảnh bake ra cạnh tệp .glb (soát bằng mắt) rồi đóng gói vào .glb
    im = anh[k]; im.filepath_raw = os.path.splitext(RA)[0] + f'_{k}.png'; im.file_format = 'PNG'; im.save(); im.pack()

# 5. xuất lưới thưa (bỏ lưới dày)
bpy.data.objects.remove(DAY, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT'); T.select_set(True)
bpy.ops.export_scene.gltf(filepath=RA, use_selection=True, export_format='GLB')
im_ = anh['mau']; px = im_.pixels[:]; sang = sum(px[i] for i in range(0, len(px), 4 * 97)) / max(1, len(px) // (4 * 97))
print(f'RA {RA} | {cach} | mat {so_dau} → {len(T.data.polygons)} | tu giac {tu_giac:.0%} | anh {ANH} | sang mau (dai 64 dong) {sang:.2f}')
