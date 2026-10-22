# LƯỚI VÀO CHUẨN: nạp .glb sinh từ ảnh (TRELLIS / Hunyuan3D / Tripo…), gộp một khối, áp biến đổi, đáy chạm z=0, tâm xy về gốc.
# Quy ước chung của mọi loại (anh 22/10/2026 "chuẩn hoá để áp dụng cho mọi nhân vật, đồ vật"): mặt nhìn −y, lưng/đỉnh +z, đơn vị = đơn vị của tệp.
import bpy
from mathutils import Vector


def nap_chuan(tep):
    """→ (đối tượng lưới 'Da', danh sách toạ độ đỉnh, lo, hi). Xoá mọi nút rỗng của glTF (gốc 'world'…)."""
    truoc = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=tep)
    moi = [o for o in bpy.data.objects if o not in truoc]
    me = [o for o in moi if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in me: o.select_set(True)
    bpy.context.view_layer.objects.active = me[0]
    if len(me) > 1: bpy.ops.object.join()
    M = bpy.context.object; M.name = 'Da'
    mw = M.matrix_world.copy(); M.parent = None; M.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in [o for o in moi if o.name in bpy.data.objects and o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
    V = [v.co.copy() for v in M.data.vertices]
    lo = Vector([min(p[i] for p in V) for i in range(3)]); hi = Vector([max(p[i] for p in V) for i in range(3)])
    dich = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for v in M.data.vertices: v.co -= dich
    V = [p - dich for p in V]
    return M, V, lo - dich, hi - dich
