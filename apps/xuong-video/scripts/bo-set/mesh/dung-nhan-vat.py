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

def ong(ten, diem, r, m, r_cuoi=None):
    """Ống bo tròn theo đường cong (tay, tóc): diem cm, bán kính r cm (thon dần tới r_cuoi)."""
    cv = bpy.data.curves.new(ten, 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = r * CM; cv.bevel_resolution = 6; cv.use_fill_caps = True
    sp = cv.splines.new('NURBS'); sp.points.add(len(diem) - 1)
    for i, q in enumerate(diem): sp.points[i].co = (q[0] * CM, q[1] * CM, q[2] * CM, 1); sp.points[i].radius = 1 if r_cuoi is None else 1 + (r_cuoi / r - 1) * i / (len(diem) - 1)
    sp.use_endpoint_u = True; sp.order_u = min(4, len(diem))
    o = bpy.data.objects.new(ten, cv); bpy.context.collection.objects.link(o); cv.materials.append(m); return o

# ── TANGO, ĐO THEO BẢNG MẪU (anh 16/10/2026: "con mesh và con nano không khớp — tạo hình nano dễ thương"): thân HẠT ĐẬU đứng (hông rộng hơn vai,
# hai bên gần thẳng) trên HAI CHÂN NGẮN bàn chân dẹt; tay DÀI buông sát thân; mắt TO, CAO, GẦN nhau; tóc xoắn mảnh; da cam đậm MỊN (không gồ đá).
# Tỉ lệ (cao 3,6 cm gồm tóc): chân 0,4 · thân 2,35 (rộng 1,75, sâu 1,4) · tóc 0,8 · mắt Ø 0,62 ở 72% thân, cách nhau 0,66.
def dung_tango():
    m, nt, b, rgb = vat_lieu('dat set cam', '#d2541a', Roughness=0.5)
    b.inputs['Subsurface Weight'].default_value = 0.15; b.inputs['Subsurface Radius'].default_value = (0.004, 0.0015, 0.0008); b.inputs['Subsurface Scale'].default_value = 0.003
    gon(nt, b, 1400, 0.05, 3)   # vân tay rất mờ
    out = []
    z0, cao, rong, sau = 0.4, 2.35, 1.75, 1.4
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, radius=0.5, location=(0, 0, 0)); th = bpy.context.object; th.name = 'Tango'
    for v in th.data.vertices:   # hạt đậu: hông (dưới) rộng hơn vai; hai bên phẳng dần (siêu elip) — toạ độ cục bộ −0.5..0.5
        t = v.co.z + 0.5; k = 1.04 - 0.1 * t
        x, y = v.co.x, v.co.y; rr = math.hypot(x, y)
        if rr > 1e-6:
            a_ = math.atan2(y, x); sq = (abs(math.cos(a_)) ** 2.6 + abs(math.sin(a_)) ** 2.6) ** (-1 / 2.6)
            f = 1 + 0.12 * (sq - 1)
            v.co.x, v.co.y = x * k * f, y * k * f
    th.scale = (rong * CM, sau * CM, cao * CM); th.location = (0, 0, (z0 + cao / 2) * CM)
    bpy.ops.object.shade_smooth(); th.data.materials.append(m); sd = th.modifiers.new('sub', 'SUBSURF'); sd.levels = sd.render_levels = 1
    out.append(th)
    mw, *_ = vat_lieu('mat trang', '#fbfbfb', Roughness=0.15); mb_, *_ = vat_lieu('nguoi', '#0b0b0b', Roughness=0.1)
    for sx in (-1, 1):   # mắt lồi to, cao, gần nhau; con ngươi hơi lệch vào trong + lên (ngây thơ)
        ex, ez = sx * 0.37, z0 + cao * 0.66   # mắt vừa phải, có khoảng hở giữa (lần trước to + sát như mắt ếch)
        out.append(cau('mat', 0.24, (ex, -sau / 2 + 0.1, ez), mw, 40, 20))
        out.append(cau('nguoi', 0.115, (ex - sx * 0.03, -sau / 2 - 0.1, ez + 0.02), mb_, 24, 12))
    for sx in (-1, 1):   # tay dài buông sát thân, cong nhẹ ra ngoài ở cổ tay
        a_ = cau('tay', 0.5, (sx * 0.86, -0.02, z0 + cao * 0.42), m, 32, 16); a_.scale = (0.34, 0.36, 1.05); a_.rotation_euler = (0, math.radians(sx * 10), 0); out.append(a_)   # tay = khối đất nặn tròn dài ôm sát thân (ống cong ra tấm dẹt như mái chèo)
    for sx in (-1, 1):   # hai chân ngắn + bàn chân dẹt chìa ra trước
        c = cau('chan', 0.5, (sx * 0.36, 0, 0.32), m, 32, 16); c.scale = (0.48, 0.48, 0.6); out.append(c)   # chân ngắn tròn mềm
        f_ = cau('ban chan', 0.5, (sx * 0.37, -0.1, 0.11), m, 32, 16); f_.scale = (0.56, 0.66, 0.26); out.append(f_)
    pts = []   # tóc: lò xo mảnh, vòng nhỏ, đứng thẳng giữa đỉnh đầu
    for i in range(40):
        t = i / 39; g = t * math.pi * 2 * 2.6; r = 0.06 + 0.07 * t
        pts.append((math.cos(g) * r, math.sin(g) * r, z0 + cao - 0.08 + t * 0.78))
    out.append(ong('toc', pts, 0.055, m, 0.05))
    return out

# ── LINT, ĐO THEO BẢNG MẪU: cục nỉ XÁM ĐẬM lông ngắn dày, hai CHÂN nỉ xám đậm thò rõ dưới, mắt NHỎ đen bóng gần nhau, một sợi chỉ xanh trên đỉnh.
def dung_lint(r=1.0):
    z = 0.38 + r
    m, nt, b, _ = vat_lieu('ni xam', '#55555b', Roughness=1.0); b.inputs['Sheen Weight'].default_value = 0.2; gon(nt, b, 1500, 0.5, 6)
    th = cau('Lint', r, (0, 0, z), m, 64, 32)
    tx = bpy.data.textures.new('lint_xu', 'CLOUDS'); tx.noise_scale = 0.003; dp = th.modifiers.new('xu', 'DISPLACE'); dp.texture = tx; dp.texture_coords = 'GLOBAL'; dp.strength = 0.0008
    long_toi(th, '#4c4c52', 0.085, 6500, 0.009)   # xám chuột đậm, lông ngắn dày như nỉ (lần trước dài + bắt sáng trắng bạc)
    out = [th]
    md, *_ = vat_lieu('ni dam', '#47474d', Roughness=1.0)
    for sx in (-1, 1):
        out.append(ong('chan', [(sx * 0.3, -0.05, z - r * 0.7), (sx * 0.32, -0.08, 0.25), (sx * 0.33, -0.12, 0.1)], 0.15, md, 0.16))
        f_ = cau('ban chan', 0.5, (sx * 0.33, -0.16, 0.06), md, 24, 12); f_.scale = (0.34, 0.42, 0.18); out.append(f_)
    mden, *_ = vat_lieu('mat den bong', '#040404', Roughness=0.04)
    for sx in (-1, 1):
        out.append(cau('mat', 0.17, (sx * 0.27, -r * 1.06, z + 0.15), mden, 32, 16))   # mắt nằm NGOÀI lớp lông (lần trước bị lông lấp)
        out.append(cau('lap lanh', 0.045, (sx * 0.27 + 0.05, -r * 1.06 - 0.14, z + 0.21), vat_lieu('trang', '#ffffff', Roughness=0.1)[0], 12, 6))
    out.append(ong('chi xanh', [(0.02, 0.0, z + r - 0.1), (0.04, 0.0, z + r + 0.2), (0.1, -0.02, z + r + 0.45), (0.2, -0.04, z + r + 0.58)], 0.035, vat_lieu('chi', '#1f6fe0', Roughness=0.5)[0]))
    return out

def meta(ten, phan, m, res=0.05, nguong=0.6, he=1.0):
    """Khối metaball (các phần tự hoà vào nhau như đất nặn / da thật) → mesh. Dựng ở TỈ LỆ ×100 (1 đơn vị = 1 cm — metaball cỡ mm không tạo được
    mặt: Gummy / bàn tay ra rỗng) rồi thu 1/100. phan = [(loai, (x,y,z) cm, bán kính cm, (sx,sy,sz) cm, xoay_z°)]."""
    from mathutils import Euler, Matrix
    mb = bpy.data.metaballs.new(ten); mb.resolution = res; mb.render_resolution = res; mb.threshold = nguong
    o = bpy.data.objects.new(ten, mb); bpy.context.collection.objects.link(o)
    for loai, vt, r, sc, xz in phan:
        e = mb.elements.new(); e.type = loai; e.co = Vector(vt); e.radius = r * he; e.stiffness = 1.0
        if loai == 'ELLIPSOID': e.size_x, e.size_y, e.size_z = sc
        e.rotation = Euler((0, 0, math.radians(xz))).to_quaternion()
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); bpy.data.objects.remove(o, do_unlink=True)
    me.transform(Matrix.Scale(CM, 4)); me.update()
    om = bpy.data.objects.new(ten, me); bpy.context.collection.objects.link(om); me.materials.append(m)
    for p_ in me.polygons: p_.use_smooth = True
    sd = om.modifiers.new('min', 'SUBSURF'); sd.levels = 1; sd.render_levels = 2   # lưới metaball thô: chất keo trong / da bóng bắt sáng gãy thành ô khi ảnh nét (16/10/2026)
    print('meta', ten, len(me.vertices), 'đỉnh')
    return om

def long_toi(o, mau, dai, so, day=0.012):
    """Lông / sợi thật (hệ hair của Cycles) phủ mặt o: dai cm, so sợi."""
    ps = o.modifiers.new('long', 'PARTICLE_SYSTEM').particle_system; st = ps.settings
    # MỌI độ rối / xoăn tính bằng MÉT (vật 2 cm): lần đầu đặt 0,02–0,04 → mỗi sợi lệch 2–4 cm, lông thành đám sương phủ cả khung.
    st.type = 'HAIR'; st.count = so; st.hair_length = dai * CM; st.use_advanced_hair = True; st.brownian_factor = 0.0; st.factor_random = 0.3 * dai * CM
    st.radius_scale = day * CM; st.root_radius = 1.0; st.tip_radius = 0.3; st.child_type = 'INTERPOLATED'; st.rendered_child_count = 5; st.child_length = 0.85
    st.roughness_1 = 0.15 * dai * CM; st.roughness_endpoint = 0.25 * dai * CM; st.kink = 'NO'
    mh = bpy.data.materials.new('soi'); mh.use_nodes = True; nt = mh.node_tree; nt.nodes.clear()
    hb = nt.nodes.new('ShaderNodeBsdfHairPrincipled'); hx = mau.lstrip('#'); hb.parametrization = 'COLOR'
    hb.inputs['Color'].default_value = (*[(int(hx[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)], 1); hb.inputs['Roughness'].default_value = 0.7
    ra = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(hb.outputs[0], ra.inputs['Surface'])
    o.data.materials.append(mh); st.material = len(o.data.materials)

def mat_tron(vt, r, m_trang=None, m_den=None, huong=(0, -1, 0), nguoi=0.42):
    mw = m_trang or vat_lieu('mat trang', '#ffffff', Roughness=0.2)[0]; mb_ = m_den or vat_lieu('nguoi', '#0d0d0d', Roughness=0.15)[0]
    h = Vector(huong).normalized(); a = cau('mat', r, vt, mw, 32, 16); b = cau('nguoi', r * nguoi, Vector(vt) + h * r * 0.75, mb_, 24, 12)
    return [a, b]

# ── COTTON BALL: cục bông trắng ngà, nhiều cụm hoà nhau (metaball) + sợi bông mảnh, không mắt.
def dung_cotton_ball():
    m, nt, b, _ = vat_lieu('bong', '#f1ece0', Roughness=1.0); b.inputs['Subsurface Weight'].default_value = 0.5; b.inputs['Subsurface Scale'].default_value = 0.003
    gon(nt, b, 1500, 0.8, 8)
    ph = [('BALL', (x, y, z), r, None, 0) for x, y, z, r in ((0, 0, 1.0, 1.0), (-0.8, 0.2, 0.75, 0.75), (0.85, -0.3, 0.85, 0.75), (0.15, 0.55, 1.5, 0.7), (-0.2, -0.6, 1.35, 0.65), (0.5, 0.4, 0.6, 0.6))]
    o = meta('Cotton Ball', ph, m, 0.06)
    tx = bpy.data.textures.new('bong_xu', 'CLOUDS'); tx.noise_scale = 0.003; dp = o.modifiers.new('xu', 'DISPLACE'); dp.texture = tx; dp.texture_coords = 'GLOBAL'; dp.strength = 0.0025
    long_toi(o, '#f4efe4', 0.1, 1200, 0.006)
    return [o]

# ── GUMMY BEAR: kẹo dẻo gấu đỏ trong: thân + đầu + tai + tay + chân hoà nhau (metaball), vật liệu kẹo trong (truyền sáng + SSS + bóng).
def dung_gummy_bear():
    m, nt, b, _ = vat_lieu('keo do', '#c4121c', Roughness=0.12)
    b.inputs['Transmission Weight'].default_value = 0.55; b.inputs['Subsurface Weight'].default_value = 0.6; b.inputs['Subsurface Radius'].default_value = (0.006, 0.0008, 0.0006); b.inputs['Subsurface Scale'].default_value = 0.004
    b.inputs['Coat Weight'].default_value = 0.7; b.inputs['IOR'].default_value = 1.45
    ph = [('ELLIPSOID', (0, 0, 0.42), 0.42, (0.95, 0.75, 1.0), 0), ('BALL', (0, 0, 0.98), 0.34, None, 0),
          ('BALL', (-0.25, 0, 1.3), 0.12, None, 0), ('BALL', (0.25, 0, 1.3), 0.12, None, 0),
          ('ELLIPSOID', (-0.42, -0.05, 0.55), 0.14, (1, 1, 1.6), 0), ('ELLIPSOID', (0.42, -0.05, 0.55), 0.14, (1, 1, 1.6), 0),
          ('ELLIPSOID', (-0.22, -0.12, 0.1), 0.15, (1, 1.3, 0.9), 0), ('ELLIPSOID', (0.22, -0.12, 0.1), 0.15, (1, 1.3, 0.9), 0)]
    o = meta('Gummy Bear', ph, m, 0.03, nguong=0.3, he=1.6)   # ngưỡng thấp + bán kính ảnh hưởng lớn: các phần HOÀ thành một con gấu (lần đầu rời từng viên)
    lo = min((o.matrix_world @ v.co).z for v in o.data.vertices); o.data.transform(__import__('mathutils').Matrix.Translation((0, 0, -lo)))
    return [o]

# ── STICKY: tờ giấy note vàng 3 × 3 cm, giấy dày 0,02 cm, một góc cong vểnh lên (lưới chia mịn, uốn theo khoảng cách tới góc).
def dung_sticky(c=3.0):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=40, size=c * CM, location=(0, 0, 0.02 * CM)); o = bpy.context.object; o.name = 'Sticky'
    goc = Vector((c / 2 * CM, c / 2 * CM, 0))
    for v in o.data.vertices:
        t = max(0.0, 1 - (Vector((v.co.x, v.co.y, 0)) - goc).length / (1.3 * CM)); v.co.z += (t ** 2) * 0.7 * CM
    so = o.modifiers.new('day', 'SOLIDIFY'); so.thickness = 0.02 * CM
    m, nt, b, _ = vat_lieu('giay note', '#f7d34a', Roughness=0.75); b.inputs['Subsurface Weight'].default_value = 0.2; gon(nt, b, 2500, 0.08, 2)
    o.data.materials.append(m)
    for p_ in o.data.polygons: p_.use_smooth = True
    return [o]

# ── CORDY: đầu phích cáp trắng (nhựa bóng, bo góc) có mặt (hai chấm mắt + miệng cười), đầu kim loại có chân tiếp điểm, dây trắng cuộn bên dưới.
def dung_cordy():
    mn, *_ = vat_lieu('nhua trang', '#f4f4f2', Roughness=0.25); mk, *_ = vat_lieu('kim loai', '#cfcfcf', Metallic=1.0, Roughness=0.2)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, (0.45 + 0.55) * CM)); o = bpy.context.object; o.name = 'Cordy'; o.scale = (0.75 * CM, 0.45 * CM, 1.1 * CM)
    bv = o.modifiers.new('bo', 'BEVEL'); bv.width = 0.12 * CM; bv.segments = 5; o.data.materials.append(mn); bpy.ops.object.shade_smooth(); out = [o]
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.75 * CM)); k = bpy.context.object; k.scale = (0.42 * CM, 0.16 * CM, 0.42 * CM); k.data.materials.append(mk); out.append(k)
    mden, *_ = vat_lieu('chamden', '#151515', Roughness=0.3)
    for sx in (-1, 1): out.append(cau('mat', 0.07, (sx * 0.15, -0.23, 1.15), mden, 16, 8))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.12 * CM, minor_radius=0.02 * CM, location=(0, -0.235 * CM, 0.98 * CM), rotation=(math.radians(90), 0, 0)); mi = bpy.context.object; mi.data.materials.append(mden)
    out.append(mi)
    cv = bpy.data.curves.new('day', 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = 0.09 * CM; cv.bevel_resolution = 4
    sp = cv.splines.new('POLY'); n = 90; sp.points.add(n - 1)
    for i in range(n):
        t = i / (n - 1); g = t * math.pi * 2 * 3; r = 0.55
        sp.points[i].co = (math.cos(g) * r * CM, (0.15 + math.sin(g) * r) * CM, (0.1 + t * 0.3 if i < n - 8 else 0.4 + (i - n + 8) * 0.06) * CM, 1)
    od = bpy.data.objects.new('day cuon', cv); bpy.context.collection.objects.link(od); cv.materials.append(mn); out.append(od)
    return out

# ── BÀN TAY GÃ KHỔNG LỒ: tay người thật (metaball: lòng tay, ngón trỏ duỗi chỉ −y, ba ngón co, ngón cái), da có SSS; cẳng tay + tay áo len xanh.
def dung_ban_tay():
    md, ntd, bd, _ = vat_lieu('da', '#d6a07c', Roughness=0.5)
    bd.inputs['Subsurface Weight'].default_value = 0.5; bd.inputs['Subsurface Radius'].default_value = (0.012, 0.004, 0.002); bd.inputs['Subsurface Scale'].default_value = 0.01
    gon(ntd, bd, 600, 0.12, 4)
    from mathutils import Euler
    # Các khối CHỒNG lên nhau đủ sâu để metaball hoà thành một bàn tay liền (lần đầu đặt rời → ra mấy viên sỏi).
    ph = [('ELLIPSOID', (0, 0, 1.3), 1.6, (2.3, 2.7, 0.8), 0),            # lòng tay
          ('ELLIPSOID', (0.2, 5.5, 1.5), 1.6, (1.8, 3.6, 1.2), 0),        # cổ tay + cẳng tay
          ('ELLIPSOID', (0.3, 10.0, 1.8), 1.6, (2.0, 3.2, 1.4), 0),
          ('ELLIPSOID', (-2.3, -4.2, 1.35), 1.1, (0.75, 1.6, 0.7), 0),    # ngón trỏ duỗi: ba đốt nối
          ('ELLIPSOID', (-2.4, -6.3, 1.35), 1.0, (0.7, 1.5, 0.65), 0),
          ('ELLIPSOID', (-2.5, -8.2, 1.35), 0.9, (0.65, 1.2, 0.6), 0),
          ('ELLIPSOID', (-0.65, -3.6, 0.9), 1.1, (0.8, 1.3, 0.9), 0),    # ba ngón co dưới lòng tay
          ('ELLIPSOID', (0.95, -3.4, 0.9), 1.1, (0.78, 1.25, 0.88), 0),
          ('ELLIPSOID', (2.45, -2.9, 0.95), 1.0, (0.7, 1.1, 0.8), 0),
          ('ELLIPSOID', (3.3, -0.8, 1.45), 1.0, (0.8, 1.7, 0.75), 35),    # ngón cái
          ('ELLIPSOID', (3.9, -2.4, 1.5), 0.9, (0.7, 1.2, 0.7), 35)]
    o = meta('The Giant', ph, md, 0.12, nguong=0.3, he=1.5)
    # móng tay ngón trỏ: elip mỏng hồng nhạt ở đầu ngón
    mm, *_ = vat_lieu('mong', '#e8b5a3', Roughness=0.25); mg = cau('mong', 0.5, (-2.5, -9.0, 1.85), mm, 24, 12); mg.scale = (1.0, 1.3, 0.22)
    ml, ntl, bl, _ = vat_lieu('len xanh', '#2c4a85', Roughness=1.0); bl.inputs['Sheen Weight'].default_value = 0.8; gon(ntl, bl, 300, 0.9, 3)
    ao = cau('tay ao', 0.5, (0.3, 17.5, 2.0), ml, 48, 24); ao.scale = (6.2, 9, 4.6)
    tx = bpy.data.textures.new('len', 'WOOD'); tx.wood_type = 'RINGNOISE'; tx.noise_scale = 0.02; dp = ao.modifiers.new('len', 'DISPLACE'); dp.texture = tx; dp.strength = 0.0015
    return [o, mg, ao]

# ── BÌNH XỊT: chai nhựa xanh trong (truyền sáng), vai tròn, nắp vặn + đầu bóp trắng, vòi chĩa −y, cò bóp.
def dung_binh_xit():
    mx, ntx, bx, _ = vat_lieu('nhua xanh trong', '#2f6fd0', Roughness=0.08); bx.inputs['Transmission Weight'].default_value = 0.85; bx.inputs['IOR'].default_value = 1.49
    mt, *_ = vat_lieu('nhua trang', '#f2f2f0', Roughness=0.35)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.45 * CM, depth=4.2 * CM, location=(0, 0, 2.1 * CM)); c = bpy.context.object; c.name = 'Blue Spray Bottle'
    bv = c.modifiers.new('bo', 'BEVEL'); bv.width = 0.4 * CM; bv.segments = 6; c.data.materials.append(mx); bpy.ops.object.shade_smooth()
    out = [c, cau('vai', 1.4, (0, 0, 4.2), mx, 48, 24)]; out[-1].scale = (1, 1, 0.45)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.6 * CM, depth=0.8 * CM, location=(0, 0, 4.95 * CM)); n_ = bpy.context.object; n_.data.materials.append(mt); out.append(n_)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.5 * CM, 5.9 * CM)); h = bpy.context.object; h.scale = (1.2 * CM, 2.8 * CM, 1.1 * CM)
    bh = h.modifiers.new('bo', 'BEVEL'); bh.width = 0.25 * CM; bh.segments = 4; h.data.materials.append(mt); bpy.ops.object.shade_smooth(); out.append(h)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.25 * CM, depth=0.6 * CM, location=(0, -2.1 * CM, 6.0 * CM), rotation=(math.radians(90), 0, 0)); v = bpy.context.object; v.data.materials.append(mt); out.append(v)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1.5 * CM, 4.9 * CM)); t = bpy.context.object; t.scale = (0.45 * CM, 0.5 * CM, 1.6 * CM); t.rotation_euler = (math.radians(12), 0, 0)
    bt = t.modifiers.new('bo', 'BEVEL'); bt.width = 0.12 * CM; bt.segments = 3; t.data.materials.append(mt); out.append(t)
    return out

DUNG = {'Mr. Wipe': dung_mr_wipe, 'Tango': dung_tango, 'Lint': dung_lint, 'Cotton Ball': dung_cotton_ball, 'Gummy Bear': dung_gummy_bear,
        'Sticky': dung_sticky, 'Cordy': dung_cordy, 'The Giant': dung_ban_tay, 'Blue Spray Bottle': dung_binh_xit}

def nhan_vat_mesh(ten):
    """Dựng mesh thật của nhân vật tại gốc; không có → None (bộ dựng rơi về khối tạm)."""
    f = DUNG.get(ten); return f() if f else None

if __name__ == '__main__' and '--' in sys.argv:
    ten, ra = sys.argv[sys.argv.index('--') + 1:][:2]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene; w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.74, 0.72, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35
    objs = nhan_vat_mesh(ten); bpy.context.view_layer.update()   # ma trận mới trước khi đo chiều cao đặt máy (không thì máy nhìn vào khoảng trống)
    hi = max((o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box)
    for i, g in enumerate((0, 60, 120)):
        bpy.ops.object.light_add(type='AREA', location=(0.12 * math.cos(math.radians(g + 40)), 0.12 * math.sin(math.radians(g + 40)) - 0.1, 0.16)); L = bpy.context.object; L.data.energy = 2.0 if i == 0 else 0.8; L.data.size = 0.12
        L.rotation_euler = (Vector((0, 0, hi / 2)) - L.location).to_track_quat('-Z', 'Y').to_euler()
    cd = bpy.data.cameras.new('c'); cd.lens = 60; cd.clip_start = 0.002; cam = bpy.data.objects.new('c', cd); s.collection.objects.link(cam); s.camera = cam
    s.render.engine = 'CYCLES'; s.cycles.samples = 48; s.cycles.use_denoising = True; s.render.resolution_x, s.render.resolution_y = 560, 720
    try:
        p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'METAL'; p.get_devices()
        for d in p.devices: d.use = True
        s.cycles.device = 'GPU'
    except Exception as e: print('GPU?', e)
    print('render device', s.cycles.device)
    for i, g in enumerate((0, -50, 90)):
        a = math.radians(g); kc = max(0.07, hi * 2.6); cam.location = (math.sin(a) * kc, -math.cos(a) * kc, hi * 0.55 + kc * 0.15)
        cam.rotation_euler = (Vector((0, 0, hi * 0.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = ra.replace('.png', f'-{i}.png'); bpy.ops.render.render(write_still=True)
    print('XONG', ten)
