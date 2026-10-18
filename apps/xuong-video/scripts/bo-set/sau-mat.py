# ĐỘ SÂU MẶT 3D theo biểu cảm: MPFB nữ + 52 cơ mặt ARKit (ng.bieu_mat) → bản độ sâu cận mặt cho flux-lora-depth.
#   blender -b -P scripts/bo-set/sau-mat.py -- <thư mục ra> <key BIEU_CAM> …   (vd khoc_tham cuoi_dau)
#   rồi: thu-lora.mts <nhan_vat_id> --mat=<thư mục ra>/sau-khoc_tham.png,…
import bpy, sys, os
from mathutils import Vector
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(D, 'mesh'))
import nguoi as ng
src = open(os.path.join(D, 'dung-set.py')).read()
exec(src[src.index('def do_sau(s, gan, xa):'):src.index('# KHUNG XƯƠNG OpenPose')], globals())
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
s = bpy.context.scene; CM = 0.01
n = ng.dung_nguoi('NG Ha', cao=165, dv=CM, ten_goc='NV Ha', gioi='nu', tuoi=24)
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('NG '): o.hide_render = True
h = bpy.data.objects.get('THAN NG Ha'); h.hide_render = h.hide_viewport = False
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam; cam.data.lens = 50
bpy.context.view_layer.update()
dau = n['dau'].matrix_world.translation + Vector((0, 0, 0.12))
cam.location = dau + Vector((0.12, -0.75, 0.02)); cam.rotation_euler = (Vector(dau) - cam.location).to_track_quat('-Z', 'Y').to_euler()
s.render.engine = 'CYCLES'; s.cycles.samples = 1; s.cycles.use_denoising = False; s.view_settings.view_transform = 'Standard'
s.render.resolution_x, s.render.resolution_y = 720, 1280; s.render.film_transparent = True
s.view_layers[0].material_override = do_sau(s, 0.5, 0.85)
fm = s.render.image_settings; fm.file_format = 'PNG'; fm.color_mode = 'BW'
ra, *mas = sys.argv[sys.argv.index('--') + 1:]
os.makedirs(ra, exist_ok=True)
for ma in mas:
    ng.bieu_mat(n, ma); bpy.context.view_layer.update()
    s.render.filepath = os.path.join(ra, f'sau-{ma}.png'); bpy.ops.render.render(write_still=True); print('XONG', ma)
