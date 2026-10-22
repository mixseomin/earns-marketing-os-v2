# KHUNG RIGIFY từ mốc giải phẫu: dựng METARIG (xương mẫu + kiểu rig Rigify cho từng chuỗi) rồi SINH rig điều khiển chuẩn của Rigify —
# chân IK có khoá bàn chân + lăn gót, cổ/đầu tách hướng, đuôi điều khiển mềm, FK/IK chuyển qua lại, xương DEF- để gắn da.
# Cấu trúc bắt chước metarig "Basic Quadruped" của Rigify (Blender 5.0, mặt −y): chuỗi sống basic_spine → cổ + đầu super_head,
# đuôi basic_tail gắn vào đốt sống đầu tiên, chân trước front_paw / sau rear_paw 4 đốt (đùi, cẳng, bàn, ngón) gập nhẹ để IK biết chiều gập.
import bpy
from mathutils import Vector


def _bat_rigify():
    import addon_utils
    if not addon_utils.check('rigify')[1]: bpy.ops.preferences.addon_enable(module='rigify')


def _chuoi(eb, ten, diem, cha=None, noi_cha=False):
    """Chuỗi xương nối liền qua các điểm; trả danh sách tên. ten = tiền tố (tên đầu không số, sau .001…)."""
    ds = []
    for i in range(len(diem) - 1):
        n = ten if i == 0 else f'{ten}.{i:03d}'
        b = eb.new(n); b.head = diem[i]; b.tail = diem[i + 1]; b.roll = 0
        if i == 0 and cha: b.parent = eb[cha]; b.use_connect = noi_cha
        elif i > 0: b.parent = eb[ds[-1]]; b.use_connect = True
        ds.append(n)
    return ds


def metarig_bon_chan(m):
    """m = giai_phau.bon_chan(...) → đối tượng metarig."""
    _bat_rigify()
    H = m['H']; L = lambda *a: Vector(a)
    # VỎ = metarig mẫu của Rigify (giữ các nhóm xương + hàng nút giao diện mà rigify_generate đòi), xoá hết xương mẫu rồi đặt xương theo mốc
    bpy.ops.object.armature_basic_quadruped_metarig_add(); R = bpy.context.object; R.name = 'metarig'
    bpy.ops.object.mode_set(mode='EDIT'); eb = R.data.edit_bones
    for b in list(eb): eb.remove(b)
    nhom = R.data.collections_all
    hong, nguc = m['hong'], m['nguc']
    song = _chuoi(eb, 'spine', [hong.lerp(nguc, t / 4) for t in range(5)])
    co = _chuoi(eb, 'neck', list(m['co']) + [m['mui']], song[-1], False)          # đốt cuối (gốc đầu → mõm) = đầu
    duoi = _chuoi(eb, 'tail', m['duoi'], song[0], False)
    chan = {}
    for ten, (day, dinh) in m['chan'].items():
        truoc = 'truoc' in ten; s = ten[-1]
        gap = -1 if truoc else 1   # gối trước gập ra sau (+y), khoeo sau gập ra trước (−y) rồi cổ chân lùi — theo metarig mẫu
        diem = [dinh, L(dinh.x, dinh.y - gap * 0.03 * H, 0.22 * H), L(day.x, day.y + gap * 0.02 * H, 0.08 * H),
                L(day.x, day.y - 0.02 * H, 0.02 * H), L(day.x, day.y - 0.09 * H, 0.0)]
        chan[ten] = _chuoi(eb, f"{'front_thigh' if truoc else 'thigh'}.{s}", diem[:2], song[-1] if truoc else song[1], False)
        # tên Rigify chuẩn cho 4 đốt (đùi / cẳng / bàn / ngón) — đặt tay để DEF- dễ đọc
        for k, (tn, a, b_) in enumerate(((f"{'front_shin' if truoc else 'shin'}.{s}", diem[1], diem[2]), (f"{'front_foot' if truoc else 'foot'}.{s}", diem[2], diem[3]),
                                          (f"{'front_toe' if truoc else 'toe'}.{s}", diem[3], diem[4]))):
            b = eb.new(tn); b.head = a; b.tail = b_; b.parent = eb[chan[ten][-1]]; b.use_connect = True; chan[ten].append(tn)
    for n in song + co: nhom['Spine'].assign(eb[n])
    for n in duoi: nhom['Tail'].assign(eb[n])
    for ten, ds in chan.items():
        for n in ds: nhom[f"{'Arm' if 'truoc' in ten else 'Leg'}.{ten[-1]} (IK)"].assign(eb[n])
    bpy.ops.object.mode_set(mode='OBJECT')
    pb = R.pose.bones
    for b in pb: b.rigify_type = ''   # xương mới trùng TÊN xương mẫu đã xoá (spine.003…) thừa hưởng kiểu rig cũ của nó
    pb[song[0]].rigify_type = 'spines.basic_spine'
    pb[co[0]].rigify_type = 'spines.super_head'
    pb[duoi[0]].rigify_type = 'spines.basic_tail'
    for ten, ds in chan.items(): pb[ds[0]].rigify_type = 'limbs.front_paw' if 'truoc' in ten else 'limbs.rear_paw'
    return R


def sinh_rig(meta):
    """Rigify generate → đối tượng rig điều khiển (có xương DEF-)."""
    _bat_rigify()
    bpy.ops.object.select_all(action='DESELECT'); meta.select_set(True); bpy.context.view_layer.objects.active = meta
    truoc = set(bpy.data.objects)
    bpy.ops.pose.rigify_generate()
    rig = next(o for o in bpy.data.objects if o not in truoc and o.type == 'ARMATURE')
    meta.hide_render = True; meta.hide_set(True)
    return rig


def metarig_do_vat(m):
    """Một xương gốc dựng đứng từ đáy (basic.super_copy: điều khiển + xương DEF) — dời / xoay / đặt lên mặt khác quanh ĐÁY vật."""
    _bat_rigify()
    bpy.ops.object.armature_basic_quadruped_metarig_add(); R = bpy.context.object; R.name = 'metarig'
    bpy.ops.object.mode_set(mode='EDIT'); eb = R.data.edit_bones
    for b in list(eb): eb.remove(b)
    b = eb.new('vat'); b.head = m['day']; b.tail = m['dinh']; R.data.collections_all['Spine'].assign(b)
    bpy.ops.object.mode_set(mode='OBJECT')
    for p_ in R.pose.bones: p_.rigify_type = ''
    R.pose.bones['vat'].rigify_type = 'basic.super_copy'
    return R


METARIG = {'bon_chan': metarig_bon_chan, 'hai_chan': metarig_bon_chan, 'do_vat': metarig_do_vat}   # hai_chan: cùng khung, chỉ có chân sau
