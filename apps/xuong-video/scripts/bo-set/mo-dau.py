# MỞ ĐẦU tập 19 bằng Blender (anh 16/10/2026: "làm bản 1-4 xem" — phim làm hoàn toàn bằng Blender): ba cảnh không thuộc bộ set cái bàn.
#   #1 Trái Đất về đêm từ vũ trụ (NASA Black Marble 2016) → máy lao xuống dải chữ S Việt Nam.
#   #2 Hà Nội đêm kiểu mô hình tí hon: Hồ Gươm, Tháp Rùa, cầu Thê Húc đỏ, dòng đèn xe máy chảy quanh hồ (lấy nét nông như chụp mô hình).
#   #3 Phố cổ đêm: nhà ống, ban công cây, búi dây điện; máy FPV luồn qua dây tới ô cửa sổ tầng ba sáng đèn.
# (#4 xuyên cửa sổ vào phòng dựng bằng dung-set.py — cùng bộ set cái bàn.) Đơn vị mét. Render khung f####.png (12 khung/giây) như dien_shot.
#   Blender -b --factory-startup -P mo-dau.py -- <vao.json {"so": 1, "giay": 4}> <thu-muc-ra>     XV_MAY=eevee|cycles · XV_RONG · XV_MAU · XV_THU_KHUNG
import bpy, json, math, os, random, sys
from mathutils import Vector

VAO, RA = sys.argv[sys.argv.index('--') + 1:][:2]
CFG = json.load(open(VAO)); SO = int(CFG['so']); GIAY = float(CFG.get('giay', 4)); FPS = 12
TAI_SAN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tai-san')
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene; N = max(2, int(round(GIAY * FPS))); S.render.fps = FPS; S.frame_start, S.frame_end = 1, N
R_ = random.Random(19)

def vl(ten, mau=(0.5, 0.5, 0.5), sang=0.0, nham=0.5, kim=0.0, mau_sang=None):
    m = bpy.data.materials.new(ten); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*mau, 1); b.inputs['Roughness'].default_value = nham; b.inputs['Metallic'].default_value = kim
    if sang: b.inputs['Emission Color'].default_value = (*(mau_sang or mau), 1); b.inputs['Emission Strength'].default_value = sang
    return m

def hop(ten, vt, co, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vt); o = bpy.context.object; o.name = ten; o.scale = co; o.data.materials.append(m); return o

def cau(ten, vt, r, m, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=vt); o = bpy.context.object; o.name = ten
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o

def day(ten, diem, r, m):
    cv = bpy.data.curves.new(ten, 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = r; cv.bevel_resolution = 2
    sp = cv.splines.new('NURBS'); sp.points.add(len(diem) - 1); sp.use_endpoint_u = True; sp.order_u = min(4, len(diem))
    for i, p in enumerate(diem): sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new(ten, cv); S.collection.objects.link(o); cv.materials.append(m); return o

def troi(mau=(0.01, 0.015, 0.04), manh=1.0, sao=False):
    w = bpy.data.worlds.new('w'); S.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes['Background']
    bg.inputs['Color'].default_value = (*mau, 1); bg.inputs['Strength'].default_value = manh
    if sao:   # sao: nhiễu Voronoi rất nhỏ, chỉ giữ đỉnh sáng
        vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 900; vo.feature = 'F1'
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.0; mr.inputs['From Max'].default_value = 0.035; mr.inputs['To Min'].default_value = 8; mr.inputs['To Max'].default_value = 0
        mr.clamp = True; nt.links.new(vo.outputs['Distance'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], bg.inputs['Strength'])

def may(len_mm=35):
    cd = bpy.data.cameras.new('may'); cd.lens = len_mm; cd.clip_start = 0.01; cd.clip_end = 10000
    o = bpy.data.objects.new('may', cd); S.collection.objects.link(o); S.camera = o; return o

em = lambda t: t * t * (3 - 2 * t)
def chay_may(cam, dat0, nhin0, dat1, nhin1, kieu=em, lens=None, net=None, giua=None):
    """Máy mở → kết theo đường cong (giua = điểm đi qua giữa đường), mỗi khung một khoá; net(t) = khoảng lấy nét."""
    for f in range(1, N + 1):
        t = (f - 1) / (N - 1); k = kieu(t)
        if giua: a = Vector(dat0).lerp(Vector(giua), k); b = Vector(giua).lerp(Vector(dat1), k); d = a.lerp(b, k)   # Bézier bậc hai
        else: d = Vector(dat0).lerp(Vector(dat1), k)
        n = Vector(nhin0).lerp(Vector(nhin1), k)
        cam.location = d; cam.rotation_euler = (n - d).to_track_quat('-Z', 'Y').to_euler(); cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
        if lens: cam.data.lens = lens(t); cam.data.keyframe_insert('lens', frame=f)
        if net: cam.data.dof.use_dof = True; cam.data.dof.focus_distance = net(t, d, n); cam.data.dof.keyframe_insert('focus_distance', frame=f)

# ── #1 TRÁI ĐẤT VỀ ĐÊM ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
def canh_1():
    troi((0, 0, 0), 1.0, sao=True)
    R = 10.0
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=R); td = bpy.context.object; td.name = 'Trai Dat'; bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new('dem'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(os.path.join(TAI_SAN, 'trai_dat_dem.jpg')); im.interpolation = 'Cubic'; im.extension = 'REPEAT'
    # Tự trải ảnh equirect (không dùng chiếu cầu dựng sẵn — hướng kinh độ 0 của nó lệch, VN quay ra sau): u = kinh độ / 2π + 0,5 (kinh độ 0 ở +x),
    # v = vĩ độ / π + 0,5 — đúng khuôn ảnh NASA (mép trái −180°, giữa 0°).
    tc = nt.nodes.new('ShaderNodeTexCoord'); sx = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sx.inputs[0])
    nv = nt.nodes.new('ShaderNodeVectorMath'); nv.operation = 'NORMALIZE'; nt.links.new(tc.outputs['Object'], nv.inputs[0]); sn = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(nv.outputs[0], sn.inputs[0])
    def toan(op, a_, b_=None, k=None):
        m_ = nt.nodes.new('ShaderNodeMath'); m_.operation = op
        nt.links.new(a_, m_.inputs[0]) if not isinstance(a_, (int, float)) else m_.inputs[0].__setattr__('default_value', a_)
        if b_ is not None: nt.links.new(b_, m_.inputs[1]) if not isinstance(b_, (int, float)) else m_.inputs[1].__setattr__('default_value', b_)
        return m_.outputs[0]
    u = toan('ADD', toan('DIVIDE', toan('ARCTAN2', sn.outputs['Y'], sn.outputs['X']), 2 * math.pi), 0.5)
    vv = toan('ADD', toan('DIVIDE', toan('ARCSINE', sn.outputs['Z']), math.pi), 0.5)
    cb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(u, cb.inputs['X']); nt.links.new(vv, cb.inputs['Y']); nt.links.new(cb.outputs[0], im.inputs['Vector'])
    # Ảnh Black Marble: đèn thành phố vàng cam trên lục địa xanh đen → vừa làm màu nền tối vừa làm ánh phát sáng (lấy phần sáng)
    nt.links.new(im.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.6
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.25; cr.color_ramp.elements[0].color = (0, 0, 0, 1); cr.color_ramp.elements[1].color = (1, 1, 1, 1)
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
    nt.links.new(im.outputs['Color'], cr.inputs['Fac']); nt.links.new(im.outputs['Color'], mx.inputs['A']); nt.links.new(cr.outputs['Color'], mx.inputs['B'])
    nt.links.new(mx.outputs['Result'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 12
    td.data.materials.append(m)
    # Khí quyển: vỏ mỏng phát sáng xanh ở mép (fresnel)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=R * 1.015); kq = bpy.context.object; kq.name = 'Khi quyen'; bpy.ops.object.shade_smooth()
    mk = bpy.data.materials.new('khi'); mk.use_nodes = True; nk = mk.node_tree; nk.nodes.clear()
    fr = nk.nodes.new('ShaderNodeLayerWeight'); fr.inputs['Blend'].default_value = 0.25
    es = nk.nodes.new('ShaderNodeEmission'); es.inputs['Color'].default_value = (0.25, 0.5, 1.0, 1); tr = nk.nodes.new('ShaderNodeBsdfTransparent'); mxs = nk.nodes.new('ShaderNodeMixShader')
    cr2 = nk.nodes.new('ShaderNodeMath'); cr2.operation = 'POWER'; cr2.inputs[1].default_value = 3
    nk.links.new(fr.outputs['Facing'], cr2.inputs[0]); nk.links.new(cr2.outputs[0], mxs.inputs['Fac']); nk.links.new(tr.outputs[0], mxs.inputs[1]); nk.links.new(es.outputs[0], mxs.inputs[2])
    ra = nk.nodes.new('ShaderNodeOutputMaterial'); nk.links.new(mxs.outputs[0], ra.inputs['Surface']); mk.blend_method = 'BLEND' if hasattr(mk, 'blend_method') else None
    kq.data.materials.append(mk)
    # Việt Nam (~16° B, 106° Đ)
    lon, lat = math.radians(float(os.environ.get('XV_KINH', '106'))), math.radians(16)
    p = Vector((math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)))   # cùng khuôn trải ảnh ở trên
    cam = may(35)
    # máy từ xa (thấy cả bán cầu, VN lệch trên) lao thẳng xuống VN, kết sát bầu khí quyển
    chay_may(cam, p * R * 3.2 + Vector((0, 0, -R * 0.6)), p * R * 0.3, p * R * 1.18, p * R, kieu=lambda t: t ** 2.2)

# ── #2 HÀ NỘI ĐÊM — HỒ GƯƠM MÔ HÌNH TÍ HON ───────────────────────────────────────────────────────────────────────────────────────────────
def canh_2():
    troi((0.02, 0.03, 0.07), 1.2)
    sd = bpy.data.lights.new('trang', 'SUN'); sd.energy = 0.25; sd.color = (0.6, 0.7, 1.0); so = bpy.data.objects.new('trang', sd); S.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(30))
    for i in range(40):   # đèn đường ven hồ (vòng vàng)
        g = 2 * math.pi * i / 40; ld = bpy.data.lights.new(f'dd{i}', 'POINT'); ld.energy = 60000; ld.color = (1, 0.72, 0.4)
        o = bpy.data.objects.new(f'dd{i}', ld); S.collection.objects.link(o); o.location = (122 * math.cos(g), 342 * math.sin(g), 8)
    dat_ = vl('dat', (0.04, 0.04, 0.05), nham=0.8); hop('nen', (0, 0, -0.5), (1400, 1400, 1), dat_)
    # mặt hồ: elip 700 × 220 m, nước tối phản chiếu
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1, depth=1, location=(0, 0, 0.05)); ho = bpy.context.object; ho.name = 'Ho Guom'; ho.scale = (110, 330, 0.1)
    ho.data.materials.append(vl('nuoc', (0.01, 0.02, 0.04), nham=0.05))
    # Tháp Rùa giữa hồ (đảo nhỏ, tháp 3 tầng, đèn vàng)
    cau('dao', (8, -40, 0), 9, vl('co', (0.02, 0.05, 0.02), nham=0.9)).scale = (1, 1, 0.25)
    vang = vl('thap', (0.9, 0.8, 0.6), sang=3, mau_sang=(1.0, 0.75, 0.4))
    for i, (r, h) in enumerate(((4, 3.5), (3, 3), (2, 2.5))): hop(f'thap{i}', (8, -40, 2 + sum(x[1] for x in ((4, 3.5), (3, 3), (2, 2.5))[:i]) + h / 2), (r, r, h), vang)
    # đền Ngọc Sơn + cầu Thê Húc đỏ cong (bờ bắc)
    hop('den', (40, 280, 3), (28, 18, 6), vl('den', (0.7, 0.55, 0.3), sang=2, mau_sang=(1, 0.7, 0.35)))
    do = vl('the huc', (0.8, 0.05, 0.02), sang=4, mau_sang=(1, 0.1, 0.05))
    day('cau The Huc', [(-30, 250, 1), (-10, 262, 7), (10, 268, 9), (25, 272, 6), (38, 275, 1)], 1.6, do)
    # phố quanh hồ: khối nhà đủ cao thấp, cửa sổ sáng ngẫu nhiên (vàng ấm / trắng xanh), cây xanh ven hồ
    toi_ = vl('nha', (0.18, 0.17, 0.16), nham=0.7); ds_sang = [vl(f'cua{i}', (0, 0, 0), sang=s_, mau_sang=c) for i, (s_, c) in enumerate(((5, (1, 0.7, 0.35)), (4, (0.75, 0.85, 1)), (7, (1, 0.55, 0.2))))]
    cay = vl('cay', (0.02, 0.07, 0.03), nham=0.9)
    for vong in range(3):
        for i in range(70):
            g = 2 * math.pi * i / 70 + vong * 0.04; rx, ry = 150 + vong * 45, 370 + vong * 45
            x, y = rx * math.cos(g), ry * math.sin(g); h = R_.uniform(12, 30) * (1 + 0.4 * vong)
            o = hop(f'nha{vong}_{i}', (x, y, h / 2), (R_.uniform(10, 18), R_.uniform(10, 18), h), toi_); o.rotation_euler.z = g
            ve_ho = -Vector((x / rx ** 2, y / ry ** 2, 0)).normalized()   # pháp tuyến elip quay vào hồ — mặt tiền
            for k_ in range(int(h // 4)):
                for c_ in (-1, 1):
                    if R_.random() < 0.5:
                        p_ = Vector((x, y, 3 + k_ * 4)) + ve_ho * 8.6 + Vector((-ve_ho.y, ve_ho.x, 0)) * c_ * 3.5
                        hop(f'cs{vong}_{i}_{k_}_{c_}', p_, (2.2, 0.3, 1.6), R_.choice(ds_sang)).rotation_euler.z = math.atan2(ve_ho.y, ve_ho.x) + math.pi / 2
            if vong == 0 and i % 2 == 0: cau(f'cay{i}', (128 * math.cos(g), 345 * math.sin(g), 6), 6, cay, 10)
    # dòng đèn xe máy quanh hồ: chấm sáng chạy theo vòng elip (đèn trước trắng vàng, đèn hậu đỏ) — mỗi chấm một khoá mỗi khung
    xe = [vl('den truoc', (0, 0, 0), sang=40, mau_sang=(1, 0.85, 0.6)), vl('den hau', (0, 0, 0), sang=30, mau_sang=(1, 0.08, 0.04))]
    for j in range(260):
        pha = R_.random(); toc = R_.uniform(0.012, 0.02) * (1 if j % 2 else -1); lan = R_.uniform(-3, 3)
        o = cau(f'xe{j}', (0, 0, 0), 0.6, xe[j % 2], 6)
        for f in range(1, N + 1):
            g = 2 * math.pi * (pha + toc * f); o.location = ((132 + lan) * math.cos(g), (352 + lan) * math.sin(g), 0.8); o.keyframe_insert('location', frame=f)
    cam = may(50)
    # cẩu chậm từ cao xuống chéo qua hồ, lấy nét nông vào Tháp Rùa (mô hình tí hon = vùng nét mỏng)
    chay_may(cam, (-420, -620, 520), (8, -40, 0), (-300, -480, 330), (8, -20, 0), net=lambda t, d, n: (d - n).length)
    cam.data.dof.aperture_fstop = 0.6

# ── #3 PHỐ CỔ ĐÊM — FPV QUA BÚI DÂY ĐIỆN ────────────────────────────────────────────────────────────────────────────────────────────────
def canh_3():
    troi((0.015, 0.02, 0.045), 0.5)
    hop('duong', (0, 60, -0.05), (9, 200, 0.1), vl('nhua duong', (0.03, 0.03, 0.035), nham=0.35))
    tuong = [vl(f't{i}', c, nham=0.85) for i, c in enumerate(((0.5, 0.42, 0.25), (0.45, 0.4, 0.38), (0.35, 0.4, 0.3), (0.55, 0.5, 0.42)))]
    vang = vl('den nha', (0.3, 0.2, 0.1), sang=2.5, mau_sang=(1, 0.65, 0.3)); xanh = vl('den tv', (0, 0, 0), sang=1.5, mau_sang=(0.5, 0.65, 1))
    cay = vl('cay ban cong', (0.04, 0.12, 0.04), nham=0.9); lan_can = vl('lan can', (0.05, 0.05, 0.05), nham=0.5, kim=0.6)
    dich = None
    for ben in (-1, 1):   # hai dãy nhà ống: mặt tiền 4 m, cao 3–5 tầng, ban công mỗi tầng
        y = -10
        while y < 150:
            w = R_.uniform(3.5, 4.5); tang = R_.randint(3, 5); h = tang * 3.3; x = ben * 4.5
            hop(f'nha{ben}_{y:.0f}', (x + ben * 6, y + w / 2, h / 2), (12, w - 0.15, h), R_.choice(tuong))
            for t_ in range(1, tang):
                z = t_ * 3.3; la_dich = ben == 1 and t_ == 2 and 60 < y < 66 and dich is None
                if not la_dich: hop(f'bc{ben}_{y:.0f}_{t_}', (x - ben * 0.6, y + w / 2, z), (1.2, w * 0.8, 0.12), lan_can)   # ô đích: trống trước cửa cho máy bay vào
                if not la_dich and R_.random() < 0.6: cau(f'cay{ben}_{y:.0f}_{t_}', (x - ben * 0.9, y + w / 2 + R_.uniform(-1, 1), z + 0.5), 0.45, cay, 8)
                sang_ = R_.random() < 0.55; cua = hop(f'cua{ben}_{y:.0f}_{t_}', (x + ben * 0.02, y + w / 2, z + 1.5), (0.05, w * 0.45, 1.6), vang if sang_ else vl('toi', (0.02, 0.02, 0.025)))
                if ben == 1 and t_ == 2 and 60 < y < 66 and dich is None: dich = cua; cua.data.materials[0] = vang   # ô cửa tầng ba còn sáng = đích máy bay tới
                elif R_.random() < 0.08: cua.data.materials[0] = xanh
            y += w
    if dich is None: dich = bpy.data.objects[[o.name for o in bpy.data.objects if o.name.startswith('cua1_')][10]]
    # búi dây điện đen chằng chịt: dây võng giữa các cột, nhiều lớp, một búi to quấn quanh cột
    den = vl('day dien', (0.01, 0.01, 0.01), nham=0.6)
    for k in range(110):
        y0 = R_.uniform(-5, 70) if k < 60 else R_.uniform(-5, 140); y1 = y0 + R_.uniform(-12, 12); z0, z1 = R_.uniform(5, 9), R_.uniform(5, 9)
        x0, x1 = R_.choice((-4.3, 4.3)), R_.choice((-4.3, 4.3)); vong_ = R_.uniform(0.4, 1.4)
        day(f'day{k}', [(x0, y0, z0), ((x0 + x1) / 2 + R_.uniform(-1, 1), (y0 + y1) / 2, (z0 + z1) / 2 - vong_), (x1, y1, z1)], R_.uniform(0.025, 0.05), den)
    for c in range(0, 140, 25):   # cột điện + búi dây quấn
        hop(f'cot{c}', (-4.2, c, 4.5), (0.25, 0.25, 9), vl('cot', (0.2, 0.2, 0.2)))
        for q in range(12): day(f'bui{c}_{q}', [(-4.2 + math.cos(q) * 0.4, c + math.sin(q) * 0.4, 6.5 + q * 0.08), (-3.5, c + R_.uniform(-2, 2), 7 + R_.uniform(-0.5, 0.5)), (-4.2 + math.cos(q * 2) * 0.5, c + math.sin(q * 2) * 0.5, 7.2)], 0.02, den)
    # đèn đường vàng
    for c in range(5, 140, 25):
        ld = bpy.data.lights.new(f'dd{c}', 'POINT'); ld.energy = 900; ld.color = (1, 0.7, 0.4); o = bpy.data.objects.new(f'dd{c}', ld); S.collection.objects.link(o); o.location = (-3.8, c, 6)
    cam = may(20)
    t0 = dich.location.copy()
    # FPV: bay thấp vào phố, luồn qua tầng dây (nhấp nhô), rẽ tới ô cửa tầng ba
    chay_may(cam, (0, -12, 3.5), (0, 30, 6.5), t0 + Vector((-3.2, 0, 0.3)), t0, giua=(0.5, 40, 7.2), kieu=lambda t: t)

canh = {1: canh_1, 2: canh_2, 3: canh_3}[SO]; canh()
# ── render (như dien_shot: EEVEE bản nháp / Cycles; 9:16) ────────────────────────────────────────────────────────────────────────────────
rong = int(os.environ.get('XV_RONG', '720')); S.render.resolution_x, S.render.resolution_y = rong, rong * 16 // 9
if os.environ.get('XV_MAY') == 'eevee':
    S.render.engine = 'BLENDER_EEVEE'; S.eevee.taa_render_samples = int(os.environ.get('XV_MAU', '16'))
    if hasattr(S.eevee, 'use_raytracing'): S.eevee.use_raytracing = True
else:
    S.render.engine = 'CYCLES'; S.cycles.samples = int(os.environ.get('XV_MAU', '32')); S.cycles.use_denoising = True; S.render.use_persistent_data = True
    try:
        p_ = bpy.context.preferences.addons['cycles'].preferences; p_.compute_device_type = 'METAL'; p_.get_devices()
        for d_ in p_.devices: d_.use = True
        S.cycles.device = 'GPU'
    except Exception as ex: print('GPU?', ex)
S.view_settings.view_transform = 'AgX'
if os.environ.get('XV_THU_KHUNG'): S.frame_start = S.frame_end = int(os.environ['XV_THU_KHUNG'])
fm = S.render.image_settings; fm.file_format = 'PNG'; fm.color_mode = 'RGB'
S.render.filepath = os.path.join(RA, 'f'); bpy.ops.render.render(animation=True)
print('XONG mo dau', SO, N, 'khung')
