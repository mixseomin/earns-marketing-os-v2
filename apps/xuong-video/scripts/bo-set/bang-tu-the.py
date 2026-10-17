# BẢNG TƯ THẾ người (rig previs — mesh/nguoi.py › TU_THE_NGUOI): render từng tư thế góc 3/4, khối vàng = điểm nắm tay phải (món cầm).
# Kiểm tư thế mới / sửa góc khớp: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/bo-set/bang-tu-the.py -- <thư mục ra>
import bpy, sys, math, importlib.util, os
from mathutils import Vector
sp = importlib.util.spec_from_file_location('nguoi', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mesh', 'nguoi.py'))
ng = importlib.util.module_from_spec(sp); sp.loader.exec_module(ng)
RA = sys.argv[-1]
for i, ten in enumerate(['dung'] + list(ng.TU_THE_NGUOI)):
    bpy.ops.wm.read_factory_settings(use_empty=True); s = bpy.context.scene
    n = ng.dung_nguoi('P', cao=170, mau=(0.8, 0.65, 0.55, 1), mau_ao=(0.75, 0.1, 0.15, 1), dv=0.01, ten_goc='goc')
    if ten != 'dung': ng.ap_dien(n, [ten], 1.0)
    bpy.context.view_layer.update()
    c = n['cotay_p'].matrix_world @ Vector((0, 0, -0.55 * n['L']['ban_tay']))
    bpy.ops.mesh.primitive_cube_add(size=0.07, location=c)
    m = bpy.data.materials.new('vang'); m.diffuse_color = (1, 0.8, 0, 1); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (1, 0.8, 0, 1); bpy.context.object.data.materials.append(m)
    bpy.ops.mesh.primitive_plane_add(size=6)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam
    cam.location = (2.6, -1.6, 1.3); cam.rotation_euler = (Vector((0, 0, 0.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 35
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 5)); bpy.context.object.data.energy = 3; bpy.context.object.rotation_euler = (0.6, 0.2, 0.5)
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
    s.render.engine = 'BLENDER_EEVEE'; s.render.resolution_x, s.render.resolution_y = 360, 480
    s.render.filepath = os.path.join(RA, f'{i:02d}-{ten}.png'); bpy.ops.render.render(write_still=True)
