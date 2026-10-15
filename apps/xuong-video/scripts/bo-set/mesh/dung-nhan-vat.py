# MESH NHÂN VẬT THẬT (anh 16/10/2026: "Mày không tạo mesh được à?") — thay khối tạm bằng mesh + vật liệu Cycles để CHÍNH ẢNH RENDER là keyframe:
# mọi cách bắt model ảnh vừa giữ hình học 3D vừa nghĩ ra ngoại hình đều rớt một bên (ngày 15–16/10 thử 6 đường, ~15k₫). Chạy trên iMac, 0đ.
# Mỗi nhân vật một hàm dung_<ten>() trả về danh sách object gốc ở (0,0,0), mặt nhìn −y, đáy giữa ở z=0, đơn vị m (cm × CM). dung-set.py gọi qua
# nhan_vat_mesh(ten) khi XV_MESH_THAT=1; không có hàm cho tên đó → rơi về khối tạm.
#   Thử một nhân vật: blender -b --factory-startup -P dung-nhan-vat.py -- <ten> <ra.png>   (render xoay quanh, 3 góc)
import bpy, math, sys
from mathutils import Vector
CM = 0.01

def vat_lieu(ten, mau, **k):
    m = bpy.data.materials.new(ten); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    hx = mau.lstrip('#'); rgb = [(int(hx[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)]
    b.inputs['Base Color'].default_value = (*rgb, 1); m.diffuse_color = (*rgb, 1)
    for kk, v in k.items():
        if kk in b.inputs: b.inputs[kk].default_value = v
    return m, nt, b, rgb

def gon(nt, b, scale, manh, detail=2.0):
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
    bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = manh; bm.inputs['Distance'].default_value = 0.0005
    nt.links.new(nz.outputs['Fac'], bm.inputs['Height']); nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])

def cau(ten, r, vt, m, seg=48, ring=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=r * CM, location=Vector(vt) * CM)
    o = bpy.context.object; o.name = ten; o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o

def mat_nut(vt, huong_ra, r=0.46, day=0.12, mau='#5a3a22'):
    """Mắt nút áo (Mr. Wipe): đĩa gỗ nâu có 4 lỗ, mặt hướng theo huong_ra."""
    m, nt, b, _ = vat_lieu('nut', mau, Roughness=0.55)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r * CM, depth=day * CM, location=Vector(vt) * CM)
    o = bpy.context.object; o.name = 'nut'; o.data.materials.append(m)
    o.rotation_euler = Vector(huong_ra).to_track_quat('Z', 'Y').to_euler()
    bev = o.modifiers.new('bev', 'BEVEL'); bev.width = 0.03 * CM; bev.segments = 3
    lo = []
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):   # 4 lỗ: đĩa đen mỏng dán sát mặt nút
        q = o.matrix_world @ Vector((sx * r * 0.3 * CM, sz * r * 0.3 * CM, day * 0.5 * CM + 0.004 * CM))
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r * 0.11 * CM, depth=0.01 * CM, location=q)
        h = bpy.context.object; h.rotation_euler = o.rotation_euler; mh, *_ = vat_lieu('lo', '#140c06'); h.data.materials.append(mh); lo.append(h)
    return [o] + lo

# ── MR. WIPE: khăn microfiber RỦ THẬT bằng mô phỏng vải. Mô phỏng ở TỈ LỆ ×100 (1 đơn vị = 1 cm — bộ vải Blender tính cho vật cỡ người,
# vật 7 cm thì va chạm không bắt kịp: lần đầu khăn xuyên đầu rơi xuống đất), xong mới thu về 1/100. Tấm vải vuông thả lên đầu tròn + thân mảnh.
def dung_mr_wipe(co_khan=10.5, dau_r=1.6, dau_z=6.0):
    s = bpy.context.scene; K = 1.0   # đơn vị mô phỏng = cm
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=dau_r * K, location=(0, 0, dau_z * K)); dau = bpy.context.object; dau.name = 'wipe dau'
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.9 * K, location=(0, 0, (dau_z - 2.2) * K)); than = bpy.context.object; than.name = 'wipe than'; than.scale = (1.6, 0.9, 1.4)
    for o in (dau, than):
        c = o.modifiers.new('col', 'COLLISION'); c.settings.thickness_outer = 0.06 * K
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=64, y_subdivisions=64, size=co_khan * K, location=(0, 0, (dau_z + dau_r + 0.4) * K), rotation=(0, 0, math.radians(45)))
    khan = bpy.context.object; khan.name = 'khan sim'
    cl = khan.modifiers.new('cloth', 'CLOTH'); st = cl.settings; cs = cl.collision_settings
    st.quality = 8; st.mass = 0.15; st.tension_stiffness = 40; st.compression_stiffness = 40; st.shear_stiffness = 20; st.bending_stiffness = 0.25   # microfiber: nhẹ, ít giãn
    st.air_damping = 1.0; cs.distance_min = 0.05 * K; cs.use_self_collision = True; cs.self_distance_min = 0.05 * K; cs.collision_quality = 3
    vg = khan.vertex_groups.new(name='ghim'); vg.add([v.index for v in khan.data.vertices if Vector((v.co.x, v.co.y)).length < 0.5 * K], 1.0, 'REPLACE')
    st.vertex_group_mass = 'ghim'; st.pin_stiffness = 50
    s.frame_start = 1; s.frame_end = 90
    for f in range(1, 91): s.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(khan.evaluated_get(dg))
    from mathutils import Matrix
    me.transform(Matrix.Scale(CM, 4) @ khan.matrix_world); me.update()   # mesh đọc ra ở toạ độ CỤC BỘ của tấm (gốc ở z = 6,85) → áp transform rồi về 1/100
    khan_t = bpy.data.objects.new('Mr. Wipe', me); bpy.context.collection.objects.link(khan_t)
    for o in (khan, dau, than): bpy.data.objects.remove(o, do_unlink=True)
    lo = min(v.co.z for v in me.vertices); me.transform(Matrix.Translation((0, 0, -lo))); me.update(); dau_z -= lo / CM   # đáy mesh về z = 0 (quy ước: tam = đáy giữa)
    zs = [v.co.z / CM for v in me.vertices]; print('khan: đỉnh', round(max(zs), 2), 'cm · đáy', round(min(zs), 2), 'cm · đầu ở', round(dau_z, 2))
    so = khan_t.modifiers.new('solid', 'SOLIDIFY'); so.thickness = 0.06 * CM; so.offset = 0
    sd = khan_t.modifiers.new('sub', 'SUBSURF'); sd.levels = sd.render_levels = 1
    m, nt, b, rgb = vat_lieu('microfiber', '#3e4f63', Roughness=0.95)
    b.inputs['Sheen Weight'].default_value = 0.35; b.inputs['Sheen Roughness'].default_value = 0.7
    gon(nt, b, 900, 0.3, 3)
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Location'].default_value = (0.022, -0.022, 0); mp.inputs['Scale'].default_value = (60, 60, 60)
    gr = nt.nodes.new('ShaderNodeTexGradient'); gr.gradient_type = 'SPHERICAL'
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.55; cr.color_ramp.elements[0].color = (0, 0, 0, 1); cr.color_ramp.elements[1].position = 0.75; cr.color_ramp.elements[1].color = (0.8, 0.8, 0.8, 1)
    e2 = cr.color_ramp.elements.new(0.9); e2.color = (0, 0, 0, 1)
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*rgb, 1); mx.inputs['B'].default_value = (0.3, 0.19, 0.08, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], gr.inputs['Vector']); nt.links.new(gr.outputs['Fac'], cr.inputs['Fac'])
    nt.links.new(cr.outputs['Color'], mx.inputs['Factor']); nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])
    khan_t.data.materials.append(m)
    for p in khan_t.data.polygons: p.use_smooth = True
    out = [khan_t]
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    for sx in (-1, 1):
        goc = Vector((sx * 0.62 * CM, -6 * CM, (dau_z + 0.25) * CM)); huong = (Vector((sx * 0.62 * CM, 0, (dau_z + 0.25) * CM)) - goc).normalized()
        hit, loc, nor, _ = khan_t.evaluated_get(dg).ray_cast(goc, huong)
        vt = (loc + nor * 0.07 * CM) / CM if hit else Vector((sx * 0.62, -(dau_r + 0.35), dau_z + 0.25))
        out += mat_nut(vt, nor if hit else Vector((0, -1, 0)))
    return out

# ── TANGO: quả trứng đất nặn cam, vân tay, mắt lồi trắng + con ngươi, tóc xoắn lò xo, hai tay ngắn, hai bàn chân tròn. Đáy giữa ở z=0, mặt −y.
def dung_tango(w=2.0, d=1.6, h=2.6):
    m, nt, b, rgb = vat_lieu('dat set cam', '#e8803a', Roughness=0.62)
    b.inputs['Subsurface Weight'].default_value = 0.25; b.inputs['Subsurface Radius'].default_value = (0.004, 0.002, 0.001); b.inputs['Subsurface Scale'].default_value = 0.004
    gon(nt, b, 700, 0.18, 4)   # vân tay mờ
    md, ntd, bd, _ = vat_lieu('dat set dam', '#d06a26', Roughness=0.62); gon(ntd, bd, 700, 0.18, 4)
    out = []
    # thân: trứng = cầu kéo dài, hơi thon đỉnh, làm mịn + gồ nhẹ (dent ngón cái sau lưng = một chỗ lõm bằng texture lớn)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.5 * CM, location=(0, 0, h / 2 * CM)); th = bpy.context.object; th.name = 'Tango'
    th.scale = (w, d, h)
    for v in th.data.vertices: v.co.x *= 1 - 0.12 * max(0.0, v.co.z); v.co.y *= 1 - 0.12 * max(0.0, v.co.z)   # thon về đỉnh
    bpy.ops.object.shade_smooth(); th.data.materials.append(m); sd = th.modifiers.new('sub', 'SUBSURF'); sd.levels = sd.render_levels = 2
    tx = bpy.data.textures.new('tango_go', 'CLOUDS'); tx.noise_scale = 0.006; dp = th.modifiers.new('go', 'DISPLACE'); dp.texture = tx; dp.texture_coords = 'GLOBAL'; dp.strength = 0.0006
    out.append(th)
    # mắt lồi: cầu trắng chìm 1/3 vào thân, con ngươi đen ở trước
    for sx in (-1, 1):
        e = 0.62; ex, ez = sx * 0.42, h * 0.6
        mw, *_ = vat_lieu('mat trang', '#ffffff', Roughness=0.25); mb_, *_ = vat_lieu('nguoi', '#111111', Roughness=0.3)
        o = cau('mat', e / 2, (ex, -d / 2 + e * 0.2, ez), mw); out.append(o)
        o = cau('nguoi', e * 0.22, (ex, -d / 2 - e * 0.22, ez + 0.04), mb_, 24, 12); out.append(o)
    # tóc xoắn lò xo: đường xoắn ốc rộng 0.7, cao 1.1, ống 0.09 — màu cam đậm
    cv = bpy.data.curves.new('toc', 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = 0.09 * CM; cv.bevel_resolution = 4
    sp = cv.splines.new('NURBS'); n = 60; sp.points.add(n - 1)
    for i in range(n):
        t = i / (n - 1); g = t * math.pi * 2 * 2.5; r = 0.35 * (0.3 + 0.7 * t)
        sp.points[i].co = ((0.1 + math.cos(g) * r) * CM, (math.sin(g) * r) * CM, (h - 0.15 + t * 1.1) * CM, 1)
    sp.use_endpoint_u = True; sp.order_u = 4
    o = bpy.data.objects.new('toc', cv); bpy.context.collection.objects.link(o); cv.materials.append(md); out.append(o)
    # tay: hai khối trứng nhỏ buông hai bên; chân: hai bàn chân tròn chìa ra trước
    for sx in (-1, 1):
        o = cau('tay', 0.5, (sx * 1.0, -0.05, 0.95), md, 32, 16); o.scale = (0.45, 0.45, 0.95); out.append(o)
        o = cau('chan', 0.5, (sx * 0.42, -0.3, 0.17), md, 32, 16); o.scale = (0.62, 0.85, 0.34); out.append(o)
    return out

DUNG = {'Mr. Wipe': dung_mr_wipe, 'Tango': dung_tango}

def nhan_vat_mesh(ten):
    """Dựng mesh thật của nhân vật tại gốc; không có → None (bộ dựng rơi về khối tạm)."""
    f = DUNG.get(ten); return f() if f else None

if __name__ == '__main__' and '--' in sys.argv:
    ten, ra = sys.argv[sys.argv.index('--') + 1:][:2]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene; w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.74, 0.72, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35
    objs = nhan_vat_mesh(ten)
    hi = max((o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box)
    for i, g in enumerate((0, 60, 120)):
        bpy.ops.object.light_add(type='AREA', location=(0.12 * math.cos(math.radians(g + 40)), 0.12 * math.sin(math.radians(g + 40)) - 0.1, 0.16)); L = bpy.context.object; L.data.energy = 2.0 if i == 0 else 0.8; L.data.size = 0.12
        L.rotation_euler = (Vector((0, 0, hi / 2)) - L.location).to_track_quat('-Z', 'Y').to_euler()
    cd = bpy.data.cameras.new('c'); cd.lens = 60; cam = bpy.data.objects.new('c', cd); s.collection.objects.link(cam); s.camera = cam
    s.render.engine = 'CYCLES'; s.cycles.samples = 64; s.cycles.use_denoising = True; s.render.resolution_x, s.render.resolution_y = 700, 900
    try:
        p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'METAL'; p.get_devices()
        for d in p.devices: d.use = True
        s.cycles.device = 'GPU'
    except Exception as e: print('GPU?', e)
    print('render device', s.cycles.device)
    for i, g in enumerate((0, -50, 90)):
        a = math.radians(g); cam.location = (math.sin(a) * 0.17, -math.cos(a) * 0.17, hi * 0.55 + 0.03)
        cam.rotation_euler = (Vector((0, 0, hi * 0.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = ra.replace('.png', f'-{i}.png'); bpy.ops.render.render(write_still=True)
    print('XONG', ten)
