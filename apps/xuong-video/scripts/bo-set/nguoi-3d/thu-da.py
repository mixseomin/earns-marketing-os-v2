# THỬ DA 3D trên đúng đường máy dựng (mesh/nguoi.py › dung_nguoi + gan_da_3d): dựng người có khoi_3d.da_3d, áp nét mặt (bieu_mat) + hướng nhìn
# (mat_nhin) + vài dáng, chụp cận mặt / toàn thân — soát da trước khi dựng cả tập. 0đ, iMac.
#   Blender -b --factory-startup -P thu-da.py -- <url da.blend> <gioi> <tuoi> <cao_cm> <thu-muc-ra> [net1,net2,…]
import bpy, sys, os, math, importlib.util
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
URL, GIOI, TUOI, CAO, RA = a[0], a[1], int(a[2]), float(a[3]), a[4]
NET = (a[5] if len(a) > 5 else 'binh_thuong,cuoi_lon,buon,gian_du,ngac_nhien').split(',')
os.makedirs(RA, exist_ok=True)
_sp = importlib.util.spec_from_file_location('nguoi', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mesh', 'nguoi.py'))
ng = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(ng)
bpy.ops.wm.read_factory_settings(use_empty=True); s = bpy.context.scene
n = ng.dung_nguoi('NG Ha', cao=CAO, dv=0.01, gioi=GIOI, tuoi=TUOI, trang={'da_3d': URL, 'ao': (0.9, 0.9, 0.9, 1)})
h = n['than_tron']; da = bpy.data.objects.get(f'{h.name}.da')
print('DA', bool(da), 'CON_NGUOI', n.get('con_nguoi'))
for o in bpy.data.objects:   # khung màu: như nguoi_that(True) — ma-nơ-canh ẩn, người thật (không an_han) hiện
    if o.type == 'MESH': o.hide_render = not (o.name.startswith('THAN ') and not o.get('an_han'))
s.render.engine = 'BLENDER_EEVEE'; s.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.5, 0.53, 1)
for i, (e, r) in enumerate(((3.0, (60, 0, -30)), (1.2, (60, 0, 150)))):
    l = bpy.data.objects.new(f'd{i}', bpy.data.lights.new(f'd{i}', 'SUN')); s.collection.objects.link(l); l.data.energy = e; l.rotation_euler = [math.radians(x) for x in r]
cam = bpy.data.objects.new('may', bpy.data.cameras.new('may')); s.collection.objects.link(cam); s.camera = cam
def chup(ten, dich, xa, goc=0, lens=85, rx=400, ry=400):
    s.render.resolution_x, s.render.resolution_y = rx, ry; cam.data.lens = lens
    r = math.radians(goc); cam.location = dich + Vector((math.sin(r), -math.cos(r), 0.02)) * xa
    cam.rotation_euler = (dich - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update(); s.render.filepath = os.path.join(RA, ten + '.png'); bpy.ops.render.render(write_still=True)
rig = bpy.data.objects[n['rig_ten']]
mat = lambda: rig.matrix_world @ rig.pose.bones['head'].head + Vector((0, 0, 0.08))
for ma in NET:
    ng.bieu_mat(n, ma); ng.dat_con_nguoi(n); chup(f'mat_{ma}', mat(), 0.9)
ng.bieu_mat(n, 'binh_thuong')
for ten, d in (('nhin_trai', Vector((-2, -3, 1.55))), ('nhin_phai', Vector((2, -3, 1.55)))):
    ng.mat_nhin(n, d); chup(ten, mat(), 0.9)
print('XONG')
