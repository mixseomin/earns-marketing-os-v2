# GẮN MẶT CHUẨN (thanh trượt ARKit) lên rig đã có từ gan-rig.py, rồi chụp tờ biểu cảm cận mặt. 0đ.
#   Blender -b <rig.blend> -P gan-mat.py -- <thu-muc-ra>   → rig-mat.blend + bc.<biểu cảm>.png
import bpy, sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig'))
import mat_hoat_hinh as mh, thu_dang
from mathutils import Vector

RA = sys.argv[sys.argv.index('--') + 1:][0]; os.makedirs(RA, exist_ok=True)
rig = bpy.data.objects['Rig']; M = bpy.data.objects['Da']; m = json.loads(rig['giai_phau'])
f = mh.gan_mat(rig, M, m)
print('MAT', {k: ([round(x, 3) for x in v[0]], round(v[1], 3)) for k, v in f['mat'].items()}, 'KHOE', {k: [round(x, 3) for x in v] for k, v in f['khoe'].items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RA, 'rig-mat.blend'))
H = m['H']; sc = thu_dang.san_khau(H, thu_dang.rong_cua(m)); sc.cycles.samples = 24
tam = (f['mat']['L'][0] + f['mat']['R'][0]) / 2 + Vector((0, -0.03 * H, -0.03 * H))
cam = sc.camera; cam.data.lens = 50
cam.location = tam + Vector((0.32, -0.62, 0.08)).normalized() * 0.42 * H * 1.2
cam.rotation_euler = (tam - cam.location).to_track_quat('-Z', 'Y').to_euler()
for ten in mh.BIEU_CAM:
    mh.dat_bieu_cam(rig, ten)
    sc.render.filepath = os.path.join(RA, f'bc.{ten}.png'); bpy.ops.render.render(write_still=True)
print('RA', RA)
