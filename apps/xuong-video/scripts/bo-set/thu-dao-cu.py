# THỬ KHUÔN ĐẠO CỤ (mesh/dao-cu.py): dựng mọi khuôn đúng co, xếp hàng, chụp hai góc — soát hình trước khi gắn vào phim. 0đ, iMac.
#   Blender -b --factory-startup -P thu-dao-cu.py -- <thu-muc-ra> [kieu:ten:w,d,c:anh …]
import bpy, sys, os, math, importlib.util
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; RA = a[0]; os.makedirs(RA, exist_ok=True)
_sp = importlib.util.spec_from_file_location('dao_cu', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mesh', 'dao-cu.py'))
dc = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(dc)
bpy.ops.wm.read_factory_settings(use_empty=True); s = bpy.context.scene
ds = [x.split(':') for x in a[1:]]
x0 = 0.0
for kieu, ten, co, anh in ds:
    co = [float(v) for v in co.split(',')]
    o = dc.dung(kieu, ten, co, anh or None)
    o.location = (x0 + co[0] * 0.01 / 2, 0, co[2] * 0.01 / 2); x0 += co[0] * 0.01 + 0.06
s.render.engine = 'BLENDER_EEVEE'; s.render.resolution_x, s.render.resolution_y = 1400, 500; s.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.56, 0.6, 1)
for i, (e, r) in enumerate(((3.0, (55, 0, -30)), (1.2, (60, 0, 150)))):
    l = bpy.data.objects.new(f'd{i}', bpy.data.lights.new(f'd{i}', 'SUN')); s.collection.objects.link(l); l.data.energy = e; l.rotation_euler = [math.radians(v) for v in r]
bpy.ops.mesh.primitive_plane_add(size=10, location=(x0 / 2, 0, 0))
cam = bpy.data.objects.new('may', bpy.data.cameras.new('may')); s.collection.objects.link(cam); s.camera = cam; cam.data.lens = 35
for ten_, goc, cao in (('truoc', 0, 0.25), ('cheo', 35, 0.45)):
    r = math.radians(goc); c = Vector((x0 / 2, 0, 0.08)); cam.location = c + Vector((math.sin(r) * 0.4, -x0 * 1.05, cao * x0 * 0.9))
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = os.path.join(RA, ten_ + '.png'); bpy.ops.render.render(write_still=True)
print('XONG')
