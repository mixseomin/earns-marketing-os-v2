# GẮN DA dùng chung mọi loại: lưới sinh từ ảnh thường hở / tự cắt → "Automatic Weights" (bone heat) hay hỏng trên lưới gốc. Tính trọng số trên
# một BẢN SAO KÍN (voxel remesh) với các xương deform (Rigify: DEF-*), rồi CHÉP sang lưới gốc (Data Transfer, nội suy theo mặt gần nhất).
import bpy


def gan(M, rig, H):
    """→ số đỉnh không có trọng số (0 = đạt)."""
    bpy.ops.object.select_all(action='DESELECT'); M.select_set(True); bpy.context.view_layer.objects.active = M
    bpy.ops.object.duplicate(); K = bpy.context.object; K.name = 'Kin'
    for md in list(K.modifiers): K.modifiers.remove(md)
    rm = K.modifiers.new('kin', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = H / 120
    bpy.ops.object.modifier_apply(modifier='kin')
    bpy.ops.object.select_all(action='DESELECT'); K.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for g in K.vertex_groups:
        if g.name not in M.vertex_groups: M.vertex_groups.new(name=g.name)
    dt = M.modifiers.new('chep', 'DATA_TRANSFER'); dt.object = K; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.select_all(action='DESELECT'); M.select_set(True); bpy.context.view_layer.objects.active = M
    bpy.ops.object.modifier_apply(modifier='chep')
    bpy.data.objects.remove(K, do_unlink=True)
    M.parent = rig; am = M.modifiers.new('xuong', 'ARMATURE'); am.object = rig
    return sum(1 for v in M.data.vertices if not v.groups or sum(g.weight for g in v.groups) < 1e-3)
