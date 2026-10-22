# SOÁT CẬN CẢNH: render 1080 sát một điểm của mẫu (để biết zoom sát có vỡ không), tuỳ chọn phủ vật liệu vi mô (vi_mo.py).
#   Blender -b --factory-startup -P can-canh.py -- <mau.glb> <ra.png> <tx ty tz: điểm nhìn theo tỉ lệ hộp bao> <dx dy dz: hướng camera × cỡ mẫu> [da|kim_loai]
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; VAO, RA, tx, ty, tz, dx, dy, dz = a[0], a[1], *map(float, a[2:8]); VI = a[8] if len(a) > 8 else ''
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=VAO); bpy.context.view_layer.update()
me = [o for o in bpy.data.objects if o.type == 'MESH']
bb = [o.matrix_world @ Vector(c) for o in me for c in o.bound_box]
lo = Vector([min(p[i] for p in bb) for i in range(3)]); hi = Vector([max(p[i] for p in bb) for i in range(3)]); sz = hi - lo
if VI:
    import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import vi_mo
    for o in me: vi_mo.phu(o, VI, sz.z)
dich = lo + Vector((tx * sz.x, ty * sz.y, tz * sz.z)); R = max(sz)
for loc, e in (((2, -2, 3), 900), ((-3, -1, 2), 300), ((0, 3, 2), 400)):
    bpy.ops.object.light_add(type='AREA', location=dich + Vector(loc) * R); l = bpy.context.object; l.data.energy = e * R * R; l.data.size = R
    l.rotation_euler = (dich - l.location).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.4
bpy.ops.object.camera_add(location=dich + Vector((dx, dy, dz)) * R); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 50
cam.rotation_euler = (dich - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True; sc.render.resolution_x = sc.render.resolution_y = 1080
sc.view_settings.view_transform = 'AgX'; sc.render.filepath = RA; bpy.ops.render.render(write_still=True)
