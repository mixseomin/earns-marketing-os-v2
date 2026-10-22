# MỔ RIG + ĐỘNG TÁC CỦA TRIPO (tripo-hoc.py tải về): cây xương (tên, cha, đầu/đuôi theo tỉ lệ thân H — gốc giữa đáy), số đỉnh mỗi xương chi
# phối, và động tác (khung, khung/giây, biên độ xoay / dời từng xương) → JSON để chép vào bộ chuẩn của mình. 0đ.
#   Blender -b --factory-startup -P mo-tripo.py -- <rig.glb> [<dong-tac.glb> …] <ra.json>
import bpy, sys, json, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]; RA = a[-1]; tep = a[:-1]
kq = {}
for t in tep:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=t)
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    me = [o for o in bpy.data.objects if o.type == 'MESH']
    bb = [o.matrix_world @ Vector(c) for o in me for c in o.bound_box]
    lo = Vector([min(p[i] for p in bb) for i in range(3)]); hi = Vector([max(p[i] for p in bb) for i in range(3)]); H = hi.z - lo.z
    chuan = lambda v: [round((v[i] - (lo[i] + hi[i]) / 2) / H, 3) if i < 2 else round((v[i] - lo.z) / H, 3) for i in range(3)]
    r = {'H': round(H, 4), 'so_dinh': sum(len(o.data.vertices) for o in me)}
    if arm:
        r['xuong'] = [{'ten': b.name, 'cha': b.parent.name if b.parent else None, 'dau': chuan(arm.matrix_world @ b.head_local),
                       'duoi': chuan(arm.matrix_world @ b.tail_local), 'deform': b.use_deform} for b in arm.data.bones]
        dem = {}
        for o in me:
            for v in o.data.vertices:
                for g in v.groups:
                    if g.weight > 0.1: n = o.vertex_groups[g.group].name; dem[n] = dem.get(n, 0) + 1
        r['dinh_moi_xuong'] = dem
        ac = arm.animation_data.action if arm.animation_data and arm.animation_data.action else (bpy.data.actions[0] if bpy.data.actions else None)
        if ac:
            fr = [int(x) for x in ac.frame_range]; sc = bpy.context.scene
            r['dong_tac'] = {'ten': ac.name, 'khung': fr, 'fps': sc.render.fps}
            if arm.animation_data is None: arm.animation_data_create()
            arm.animation_data.action = ac
            bien = {}
            for f in range(fr[0], fr[1] + 1):
                sc.frame_set(f)
                for pb in arm.pose.bones:
                    q = pb.matrix_basis.to_quaternion(); g = math.degrees(2 * math.acos(min(1, abs(q.w))))
                    l = pb.matrix_basis.translation.length / H
                    m = bien.setdefault(pb.name, [0, 0]); m[0] = max(m[0], round(g, 1)); m[1] = max(m[1], round(l, 3))
            r['dong_tac']['bien_do'] = {k: {'xoay_do': v[0], 'doi_H': v[1]} for k, v in bien.items() if v[0] > 0.5 or v[1] > 0.005}
    kq[t.split('/')[-1]] = r
json.dump(kq, open(RA, 'w'), ensure_ascii=False, indent=1)
for k, r in kq.items():
    print('==', k, 'H', r['H'], 'dinh', r['so_dinh'], 'xuong', len(r.get('xuong', [])), 'dong_tac', (r.get('dong_tac') or {}).get('khung'), (r.get('dong_tac') or {}).get('fps'))
