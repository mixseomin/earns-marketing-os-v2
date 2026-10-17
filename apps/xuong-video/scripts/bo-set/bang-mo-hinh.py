# BẢNG MÔ HÌNH THẬT (Poly Haven, tai-san/mo-hinh/<mã>/): render từng mô hình cao 100 cm + mũi tên đỏ chỉ −y (mặt trước theo quy ước bộ set) —
# xem mô hình là gì, cao thấp ra sao, mặt trước quay về đâu → ghi độ lệch vào dung-set.py › MH_XOAY khi thêm mã mới.
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/bo-set/bang-mo-hinh.py -- <thư mục ra>
import bpy, sys, os, glob, math
from mathutils import Vector, Matrix
RA = sys.argv[-1]; TS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tai-san', 'mo-hinh')
for d in sorted(glob.glob(os.path.join(TS, '*'))):
    f = glob.glob(os.path.join(d, '*.gltf'))
    if not f: continue
    bpy.ops.wm.read_factory_settings(use_empty=True); s = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=f[0]); bpy.context.view_layer.update()
    ms = [o for o in bpy.data.objects if o.type == 'MESH']
    bb = [o.matrix_world @ Vector(c) for o in ms for c in o.bound_box]
    lo = Vector([min(p[i] for p in bb) for i in range(3)]); hi = Vector([max(p[i] for p in bb) for i in range(3)]); sz = hi - lo
    k = 1.0 / sz.z
    for o in [o for o in bpy.data.objects if o.parent is None]: o.matrix_world = Matrix.Scale(k, 4) @ Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))) @ o.matrix_world
    bpy.ops.mesh.primitive_cone_add(radius1=0.06, depth=0.3, location=(0, -0.6, 0.05)); c = bpy.context.object; c.rotation_euler = (math.radians(90), 0, 0)
    m = bpy.data.materials.new('do'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (1, 0, 0, 1); c.data.materials.append(m)
    bpy.ops.mesh.primitive_plane_add(size=5)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam
    cam.location = (1.6, -2.0, 1.2); cam.rotation_euler = (Vector((0, 0, 0.45)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 35
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 5)); bpy.context.object.data.energy = 3; bpy.context.object.rotation_euler = (0.6, 0.2, 0.5)
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    s.render.engine = 'BLENDER_EEVEE'; s.render.resolution_x, s.render.resolution_y = 300, 360
    s.render.filepath = os.path.join(RA, f'{os.path.basename(d)}.png'); bpy.ops.render.render(write_still=True)
    print('KICH', os.path.basename(d), [round(x * 100) for x in sz])
