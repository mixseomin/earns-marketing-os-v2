# THỬ DÁNG (ROM test rút gọn) bằng ĐIỀU KHIỂN của rig Rigify — đúng tay cầm người diễn hoạt dùng, không xoay xương DEF trực tiếp.
# Mỗi loại một bộ dáng; điều khiển thiếu (Rigify đổi tên giữa phiên bản) thì in tên các điều khiển hiện có để sửa bảng.
import bpy, math, os
from mathutils import Vector, Euler

# (điều khiển, xoay độ (x, y, z) hệ của xương, dời (x, y, z) theo bội số H) — Rigify bon_chan, Blender 5.0
DANG = {'bon_chan': {
    'nghi': [],
    'cui_co': [('neck', (40, 0, 0), None), ('head', (25, 0, 0), None)],
    'quay_dau': [('neck', (0, 0, 30), None), ('head', (0, 0, 30), None)],
    # đuôi: xoay từng đốt FK (tail, tail.001…) — 'tail_master' của basic_tail chỉ chép xoay theo trục khai, ít tác dụng ngang
    'vay_duoi': [('tail', (0, 0, 10), None), ('tail.001', (0, 0, 12), None), ('tail.002', (0, 0, 14), None), ('tail.003', (0, 0, 16), None)],
    'buoc': [('front_foot_ik.L', (0, 0, 0), (0, -0.2, 0.1)), ('foot_ik.R', (0, 0, 0), (0, -0.16, 0.08))],
}, 'hai_chan': {
    'nghi': [],
    'cui_co': [('neck', (30, 0, 0), None), ('head', (20, 0, 0), None)],
    'quay_dau': [('neck', (0, 0, 30), None), ('head', (0, 0, 30), None)],
    'vay_duoi': [('tail', (0, 0, 10), None), ('tail.001', (0, 0, 12), None), ('tail.002', (0, 0, 14), None), ('tail.003', (0, 0, 16), None)],
    'buoc': [('foot_ik.L', (0, 0, 0), (0, -0.2, 0.1))],
}, 'do_vat': {
    'nghi': [],
    'nghieng': [('vat', (25, 0, 0), None)],
    'xoay': [('vat', (0, 45, 0), None)],
    'nhac_len': [('vat', (0, 0, 0), (0, 0, 0.3))],
}}


def _dung_trang():
    sc = bpy.context.scene
    for o in [o for o in bpy.data.objects if o.type in ('LIGHT', 'CAMERA') or o.name == 'Nen']: bpy.data.objects.remove(o, do_unlink=True)
    return sc


def san_khau(H, rong, ben=False):
    """Sàn xám + 3 đèn vùng + máy (ben = nhìn NGANG từ +x — thấy dáng đi / chạy; mặc định nghiêng 3/4). Dùng chung cho tờ dáng và tờ động tác."""
    sc = _dung_trang()
    bpy.ops.mesh.primitive_plane_add(size=H * 40, location=(0, 0, 0)); s = bpy.context.object; s.name = 'Nen'
    mt = bpy.data.materials.new('nen'); mt.use_nodes = True; mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1); s.data.materials.append(mt)
    for loc, e in (((H * 2, -H * 2, H * 2.5), 800), ((-H * 2.5, -H, H * 1.5), 300), ((0, H * 3, H * 2), 400)):
        bpy.ops.object.light_add(type='AREA', location=loc); l = bpy.context.object; l.data.energy = e * H * H; l.data.size = H * 1.5
        l.rotation_euler = (Vector((0, 0, H / 2)) - l.location).to_track_quat('-Z', 'Y').to_euler()
    if not sc.world: sc.world = bpy.data.worlds.new('w')
    sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.3
    bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 40
    d = rong * 1.25
    # máy nghiêng gần ngang: thấy cổ, đuôi, bốn chân (ben: ngang hẳn từ +x)
    cam.location = Vector((d * 1.05, 0, H * 0.6)) if ben else Vector((d * 0.92, -d * 0.4, H * 0.75))
    cam.rotation_euler = (Vector((0, 0, H * 0.45)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.render.resolution_x = sc.render.resolution_y = 512
    sc.view_settings.view_transform = 'AgX'
    return sc


def rong_cua(m):
    """Bề dài nhân vật để lùi máy — m là mốc (Vector) hoặc mốc đọc lại từ JSON (list)."""
    return (max(abs(x) for x in (*[c for p in m['duoi'] for c in list(p)[:2]], list(m['mui'])[1])) * 2 if 'duoi' in m else 0) + m['H']


def soat(rig, M, m, loai, ra):
    H = m['H']; sc = san_khau(H, rong_cua(m))
    pb = rig.pose.bones
    ten_dk = sorted(b.name for b in pb if not b.name.startswith(('DEF-', 'ORG-', 'MCH-')))
    thieu = sorted({c for ds in DANG[loai].values() for c, _, _ in ds if c not in pb})
    if thieu: print('THIEU dieu khien', thieu, '| co:', ten_dk)
    goc = {b.name: (b.location.copy(), b.rotation_mode) for b in pb}
    for i, (ten, ds) in enumerate(DANG[loai].items()):
        for b in pb:
            b.location = goc[b.name][0]
            if b.rotation_mode == 'QUATERNION': b.rotation_quaternion = (1, 0, 0, 0)
            else: b.rotation_euler = (0, 0, 0)
        for c, xo, doi in ds:
            if c not in pb: continue
            b = pb[c]; e = Euler([math.radians(x) for x in xo])
            if b.rotation_mode == 'QUATERNION': b.rotation_quaternion = e.to_quaternion()
            else: b.rotation_euler = e
            if doi:   # dời theo hệ THẾ GIỚI (H) → đổi sang hệ cục bộ của xương
                b.location = goc[c][0] + (rig.matrix_world @ b.bone.matrix_local).to_3x3().inverted() @ (Vector(doi) * H)
        bpy.context.view_layer.update()
        e_ = M.evaluated_get(bpy.context.evaluated_depsgraph_get())
        if i == 0: p0 = [v.co.copy() for v in e_.data.vertices]
        print('DANG', ten, 'dich toi da', round(max((a - b).length for a, b in zip(p0, [v.co for v in e_.data.vertices])) / H, 3), 'H')
        sc.render.filepath = os.path.join(ra, f'soat.{i}.{ten}.png'); bpy.ops.render.render(write_still=True)
