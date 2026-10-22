# XEM MỘT MÔ HÌNH .glb: 4 góc (trước / 3-4 / nghiêng / sau) trên nền xám, đèn studio — soát chất lượng lưới + màu trước khi đưa vào cảnh. 0đ.
#   Blender -b --factory-startup -P xem-mo-hinh.py -- <mo-hinh.glb> <ra.png>   → <ra.png>.0..3.png (Python của Blender không có PIL — ghép ngoài)
import bpy, sys, math, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; VAO, RA = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=VAO); bpy.context.view_layer.update()
me = [o for o in bpy.data.objects if o.type == 'MESH']
if '--luoi' in a:   # phủ KHUNG LƯỚI đen lên bề mặt (so tam giác thô của AI với tứ giác của khâu sản xuất)
    den = bpy.data.materials.new('khung'); den.use_nodes = True; den.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.02, 0.02, 1)
    for o in me:
        k = o.copy(); k.data = o.data.copy(); bpy.context.collection.objects.link(k); k.data.materials.clear(); k.data.materials.append(den)
        w = k.modifiers.new('khung', 'WIREFRAME'); w.thickness = 0.0025 * max(o.dimensions); w.use_replace = True
bb = [o.matrix_world @ Vector(c) for o in me for c in o.bound_box]
lo = Vector([min(p[i] for p in bb) for i in range(3)]); hi = Vector([max(p[i] for p in bb) for i in range(3)]); tam = (lo + hi) / 2; R = max(hi - lo)
bpy.ops.mesh.primitive_plane_add(size=R * 20, location=(0, 0, lo.z)); s = bpy.context.object
m = bpy.data.materials.new('nen'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1); s.data.materials.append(m)
for loc, e in (((R * 2, -R * 2, R * 2.5), 800), ((-R * 2.5, -R, R * 1.5), 300), ((0, R * 3, R * 2), 400)):
    bpy.ops.object.light_add(type='AREA', location=loc); l = bpy.context.object; l.data.energy = e * R * R; l.data.size = R * 1.5
    l.rotation_euler = (tam - l.location).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.3
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 50
sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.use_denoising = True; sc.render.resolution_x = sc.render.resolution_y = 512
sc.view_settings.view_transform = 'AgX'
anh = []
for i, g in enumerate((0, 45, 90, 180)):
    a_ = math.radians(g); d = R * 2.6
    cam.location = tam + Vector((d * math.sin(a_), -d * math.cos(a_), R * 0.4)); cam.rotation_euler = (tam - cam.location).to_track_quat('-Z', 'Y').to_euler()
    f = f'{RA}.{i}.png'; sc.render.filepath = f; bpy.ops.render.render(write_still=True); anh.append(f)
print('RA', RA, 'dinh', sum(len(x.data.vertices) for x in me))
