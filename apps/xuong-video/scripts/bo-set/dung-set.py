# BỘ SET 3D (previs) — 14/10/2026, anh: "cần giải pháp kỹ thuật tuyệt đối về bối cảnh và bố trí đồ đạc".
# Mỗi keyframe trước đây do mô hình ảnh TỰ VẼ LẠI cả căn phòng từ chữ → màn hình lúc song song lúc quay lưng, nhân vật nhảy trước/sau bàn phím.
# Ở đây bộ set là DỮ LIỆU (toạ độ cm trong scripts/du-lieu/bo-set/<set>.json): dựng bằng khối hình học, đặt máy ảo theo từng shot,
# render ra (1) khung xám — bố trí đúng tuyệt đối, (2) bản đồ độ sâu — khung xương cho mô hình ảnh, (3) mặt bằng nhìn từ trên có vị trí máy.
# Chạy trên box (Blender không giao diện):
#   blender -b --factory-startup -P apps/xuong-video/scripts/bo-set/dung-set.py -- <set.json> <thư mục ra> [ma shot,...]
import bpy, json, math, re, sys, os
from mathutils import Matrix, Quaternion, Vector, Euler

arg = sys.argv[sys.argv.index('--') + 1:]
DL = json.load(open(arg[0], encoding='utf-8'))
RA = arg[1]
CHI = set(arg[2].split(',')) if len(arg) > 2 and arg[2] else None
os.makedirs(RA, exist_ok=True)
CM = 0.01  # Blender tính mét
CHI_MB = os.environ.get('XV_CHI_MAT_BANG') == '1'   # chỉ vẽ mặt bằng (lượt song song riêng), bỏ render từng shot
BO_MB = os.environ.get('XV_BO_MAT_BANG') == '1'     # phần song song: mặt bằng vẽ tí hon cho nhanh (lượt mb vẽ bản đủ)
NHANH = os.environ.get('XV_NHANH') == '1'
# BẢN NHÁP THÔ (anh 17/10/2026 "lâu thế à? sinh bản nháp thô thôi, sau dùng RunPod"): khung 540×960, ít mẫu — xem bố cục / máy / liền mạch
# trên iMac trong vài phút. KHÔNG dùng làm keyframe (khung 540 bị phóng thành mềm): bản đẹp dựng lại --tat-ca trên máy thuê.
THO = os.environ.get('XV_THO') == '1'
TAI_SAN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tai-san')   # tài sản CC0 (tai-tai-san.sh) — thiếu thì rơi về vật liệu dựng tay
MESH_THAT = os.environ.get('XV_MESH_THAT') == '1'   # nhân vật = mesh thật (mesh/dung-nhan-vat.py) + khung màu render Cycles → chính ảnh render là keyframe
if MESH_THAT:
    import importlib.util as _iu
    _sp = _iu.spec_from_file_location('dung_nhan_vat', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mesh', 'dung-nhan-vat.py'))
    dnv = _iu.module_from_spec(_sp); _sp.loader.exec_module(dnv)
KHO_MESH = {}
# NGƯỜI (khoi_3d.hinh = 'nguoi', phim người thật — bước 5): ma-nơ-canh có khớp mesh/nguoi.py; NGUOI[tên] = các khớp để vòng diễn đặt bước chân.
NGUOI = {}
_NG = None
def ng():
    global _NG
    if _NG is None:
        import importlib.util as _iu2
        _s2 = _iu2.spec_from_file_location('nguoi', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mesh', 'nguoi.py'))
        _NG = _iu2.module_from_spec(_s2); _s2.loader.exec_module(_NG)
    return _NG
def bat_gpu(s):
    """Cycles chạy GPU của MÁY ĐANG CHẠY: OPTIX / CUDA (NVIDIA — máy thuê cloud, scripts/bo-set/may-thue.sh), HIP (AMD), METAL (iMac / Mac).
    Không có GPU nào thì để CPU. Trước đây ghi cứng METAL 3 chỗ → lên máy NVIDIA âm thầm chạy CPU. Chỉ đổi THIẾT BỊ, không đổi hình ra."""
    try: p_ = bpy.context.preferences.addons['cycles'].preferences
    except Exception as e: print('GPU?', e); return
    for kieu in ('OPTIX', 'CUDA', 'HIP', 'METAL'):
        try: p_.compute_device_type = kieu; p_.get_devices()
        except Exception: continue
        gpu = [d_ for d_ in p_.devices if d_.type == kieu]
        if not gpu: continue
        for d_ in p_.devices: d_.use = d_.type == kieu
        s.cycles.device = 'GPU'
        # KHỬ NHIỄU TRÊN GPU (đo trên RTX 4090 17/10/2026: path tracing 0,2 s/khung, OpenImageDenoise trên CPU 5,1 s — 96 % thời gian). Cùng
        # thuật toán OIDN, chỉ đổi nơi chạy (CUDA / OptiX / Metal).
        if hasattr(s.cycles, 'denoising_use_gpu'): s.cycles.denoising_use_gpu = True
        print('GPU', kieu, ', '.join(d_.name for d_ in gpu)); return
    print('GPU? không có — chạy CPU')

def mesh_that(ten):
    """Mesh thật của nhân vật, dựng MỘT lần (mô phỏng vải ~15 s) rồi nhân bản cho từng shot; không có hàm dựng → None (rơi về khối tạm)."""
    if not MESH_THAT: return None
    if ten not in KHO_MESH:
        objs = dnv.nhan_vat_mesh(ten)
        bpy.context.view_layer.update()   # chi tiết đặt cỡ bằng .scale chưa có ma trận mới → nhân bản + dời theo ma trận cũ = khối 1 m (đầu bóp bình xịt 55 cm)
        if objs:
            for o in objs: o.hide_render = o.hide_viewport = True
        KHO_MESH[ten] = objs
    goc = KHO_MESH[ten]
    if not goc: return None
    out = []
    for i, g in enumerate(goc):
        o = g.copy(); o.data = g.data.copy() if g.data else None; bpy.context.collection.objects.link(o); o.hide_render = o.hide_viewport = False
        o.name = f'NV {ten}' if i == 0 else f'NV {ten}·{i}'; o['vai'] = g.name.split('.')[0]; out.append(o)   # vai = tên phần lúc dựng (chan / ban chan / tay…) — bản diễn cử động theo vai
    return out
   # có OpenGL (Xvfb trên box) → khung xám + mặt bằng bằng Workbench; độ sâu vẫn Cycles 1 mẫu

def may_ve(s, dep):
    """Engine cho một lần render: dep = khung xám / mặt bằng (Workbench nếu có OpenGL), không dep = độ sâu (Cycles phát sáng thuần)."""
    if dep and NHANH:
        s.render.engine = 'BLENDER_WORKBENCH'; d = s.display.shading
        d.light = 'STUDIO'; d.color_type = 'MATERIAL'; d.show_shadows = True; d.show_cavity = True; d.cavity_type = 'WORLD'
        s.display.shading.studio_light = 'Default'; s.view_settings.view_transform = 'Standard'
    else:
        s.render.engine = 'CYCLES'


def mau(h, sang=0):
    h = h.lstrip('#'); rgb = tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    k = f'm_{h}_{sang}'
    if k in bpy.data.materials: return bpy.data.materials[k]
    m = bpy.data.materials.new(k); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[c ** 2.2 for c in rgb], 1)
    m.diffuse_color = (*[c ** 2.2 for c in rgb], 1)   # màu Workbench đọc ở đây (không đọc nút)
    b.inputs['Roughness'].default_value = 0.6
    if sang:
        b.inputs['Emission Color'].default_value = (*[c ** 2.2 for c in rgb], 1)
        b.inputs['Emission Strength'].default_value = sang
    return m

def dat(o, m, ten):
    o.name = ten; o.data.materials.clear(); o.data.materials.append(m); return o

def khan_diem(wd, NT=56, NV=26):
    """Lưới tấm khăn rủ, toạ độ ĐƠN VỊ (x, y ∈ ±0.5, z 0..1 từ đáy): t = 0 đỉnh → 1 mép. Bán kính: vòm đầu tới t = 0,32 rồi loe dần ra mép.
    Mặt cắt tròn ở đầu (theo bề ngang) và dẹt dần về đáy (tỉ lệ sâu/ngang thật); mép gợn sóng nhỏ + 4 góc khăn vuông thõng thấp hơn.
    CÙNG công thức với bo-set-three.ts › khanHinh."""
    ds, mat = [], []
    for j in range(NV + 1):
        t = j / NV
        f = math.sqrt(max(0.0, 1 - (1 - t / 0.32) ** 2)) * 0.56 if t < 0.32 else 0.56 + 0.44 * ((t - 0.32) / 0.68) ** 1.5
        k = wd + (1 - wd) * t   # sâu = ngang ở đầu (tròn) → đúng tỉ lệ ở đáy
        for i in range(NT):
            g = 2 * math.pi * i / NT
            z = 1 - t
            if t > 0.62:
                q = ((t - 0.62) / 0.38) ** 2
                z -= q * (0.13 * abs(math.cos(2 * g)) ** 4 + 0.025 * math.sin(11 * g))
            ds.append((0.5 * f * math.cos(g), 0.5 * f * k * math.sin(g), max(0.0, z)))
    for j in range(NV):
        for i in range(NT):
            a, b = j * NT + i, j * NT + (i + 1) % NT
            mat.append((a, b, b + NT, a + NT))
    return ds, mat

def khoi(p, ten, goc=(0, 0), xoay=0):
    """Một khối: tam = (x, y, z ĐÁY) tương đối với gốc nhóm; co = (rộng x, sâu y, cao z)."""
    h = p['hinh']
    if h == 'nguoi':   # NGƯỜI PHỤ / quần chúng của bộ set (đồng nghiệp ngồi bàn, thành viên HĐQT): ma-nơ-canh mesh/nguoi.py cao co[2], tư thế tu_the,
        # mau = da, ao = áo. Các phần tên '<ten> ng.<khớp>' → ten_vat gom về <ten> (NHOM) để khung xám gọi đúng tên + en. CÙNG bo-set-three.ts › nguoiThree.
        x, y, z = p['tam']; a = math.radians(xoay); gx = goc[0] + x * math.cos(a) - y * math.sin(a); gy = goc[1] + x * math.sin(a) + y * math.cos(a)
        lin = lambda hx: (*[(int(hx.lstrip('#')[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)], 1)
        n_ = ng().dung_nguoi(f'{ten} ng', cao=p['co'][2], mau=lin(p['mau']), mau_ao=lin(p.get('ao') or p['mau']), dv=CM, ten_goc=ten)
        ng().tu_the(n_, p.get('tu_the') or 'dung')
        n_['goc'].location = (gx * CM, gy * CM, z * CM); n_['goc'].rotation_euler.z = math.radians(xoay + p.get('xoay', 0))
        return n_['goc']
    m = mau(p['mau'], p.get('sang', 0))
    if h == 'day':
        cv = bpy.data.curves.new(ten, 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = p['ban_kinh'] * CM; cv.bevel_resolution = 2
        sp = cv.splines.new('NURBS'); sp.points.add(len(p['diem']) - 1)
        for i, d in enumerate(p['diem']): sp.points[i].co = (d[0] * CM, d[1] * CM, d[2] * CM, 1)
        sp.use_endpoint_u = True; sp.order_u = p.get('bac', 3) + 1 if p.get('bac') else 3
        o = bpy.data.objects.new(ten, cv); bpy.context.collection.objects.link(o); cv.materials.append(m); return o
    if h == 'xoan':   # sợi tóc xoắn lò xo (Tango): đường xoắn ốc rộng co[0], cao co[2], ống dày ban_kinh
        x, y, z = p['tam']; w, d, c = p['co']
        a = math.radians(xoay); gx = goc[0] + x * math.cos(a) - y * math.sin(a); gy = goc[1] + x * math.sin(a) + y * math.cos(a)
        cv = bpy.data.curves.new(ten, 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = p.get('ban_kinh', 0.08) * CM; cv.bevel_resolution = 3
        sp = cv.splines.new('POLY'); n = 48; sp.points.add(n - 1)
        for i in range(n):
            t = i / (n - 1); g = t * math.pi * 2 * p.get('vong', 2.5)
            sp.points[i].co = ((gx + math.cos(g) * w / 2 * (0.4 + 0.6 * t)) * CM, (gy + math.sin(g) * w / 2 * (0.4 + 0.6 * t)) * CM, (z + t * c) * CM, 1)
        o = bpy.data.objects.new(ten, cv); bpy.context.collection.objects.link(o); cv.materials.append(m); return o
    x, y, z = p['tam']; w, d, c = p['co']
    a = math.radians(xoay); gx = goc[0] + x * math.cos(a) - y * math.sin(a); gy = goc[1] + x * math.sin(a) + y * math.cos(a)
    if h == 'hop':
        bpy.ops.mesh.primitive_cube_add(size=1, location=(gx * CM, gy * CM, (z + c / 2) * CM))
    elif h in ('cau', 'trung'):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.5, location=(gx * CM, gy * CM, (z + c / 2) * CM))
    elif h == 'vom':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.5, location=(gx * CM, gy * CM, z * CM))
        c = c * 2
    elif h == 'khan':   # tấm khăn rủ (Mr. Wipe): mặt vải quanh trục, đỉnh tròn ôm đầu, loe dần, đáy gợn + 4 góc thõng — xem khan_diem()
        me = bpy.data.meshes.new(f'khan {ten}'); ds, mat = khan_diem(w / d if d else 1)
        me.from_pydata(ds, [], mat); me.update()
        o = bpy.data.objects.new(ten, me); bpy.context.collection.objects.link(o)
        o.location = (gx * CM, gy * CM, z * CM); o.scale = (w * CM, d * CM, c * CM)
        o.rotation_euler = Euler((math.radians(p.get('nghieng', 0)), 0, math.radians(xoay + p.get('xoay', 0))))
        for f in me.polygons: f.use_smooth = True
        return dat(o, m, ten)
    elif h == 'vong':   # VÒNG ĐEO (vòng tay, chuỗi hạt, nhẫn): xuyến trục z, ngoài co[0] × co[1], dày co[2]; hat = số hạt (chuỗi hạt) thay cho ống liền.
        # Trước 17/10/2026 đồ đeo khai 'hop' → tấm dẹt; ảnh độ sâu đưa FLUX một miếng ván xanh trên cổ tay (tập 122 #22).
        r = c / w / 2 if w else 0.1; R = 0.5 - r
        if p.get('hat'):
            n = int(p['hat']); hat = []
            for i in range(n):
                g = 2 * math.pi * i / n
                bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=r * 1.15, location=(R * math.cos(g), R * math.sin(g), 0)); hat.append(bpy.context.object)
            for o_ in hat: o_.select_set(True)
            bpy.context.view_layer.objects.active = hat[0]; bpy.ops.object.join()
        else:
            bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=48, minor_segments=12)
        o = bpy.context.object; o.location = (gx * CM, gy * CM, (z + c / 2) * CM)
        for f in o.data.polygons: f.use_smooth = True
        o.scale = (w * CM, d * CM, w * CM)   # tiết diện tròn: z theo co[0] (dày thật = 2r·co[0] = co[2])
        o.rotation_euler = Euler((math.radians(p.get('nghieng', 0)), 0, math.radians(xoay + p.get('xoay', 0))))
        return dat(o, m, ten)
    elif h == 'non':   # nón cụt (thân khăn rủ Mr. Wipe): đáy rộng co[0]×co[1], đỉnh = đáy × dinh, cao co[2]
        bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=0.5, radius2=0.5 * p.get('dinh', 0.4), depth=1, location=(gx * CM, gy * CM, (z + c / 2) * CM))
    elif h == 'coc':   # CỐC / LY: nón cụt RỖNG (bỏ mặt miệng, thành dày) + QUAI bên −x (p.quai_x = 1 → +x) — khối đặc trơn thì AI vẽ khúc ống hở hai đầu (tập 122 #17)
        import bmesh
        dn = p.get('dinh', 1.0); goc_ = Vector((gx * CM, gy * CM, (z + c / 2) * CM))
        bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=0.5, radius2=0.5 * dn, depth=1, location=goc_); o = bpy.context.object
        bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context='FACES'); bm.to_mesh(o.data); bm.free()
        sm = o.modifiers.new('thanh', 'SOLIDIFY'); sm.thickness = 0.06; sm.offset = -1
        with bpy.context.temp_override(object=o, active_object=o): bpy.ops.object.modifier_apply(modifier=sm.name)
        if p.get('quai', True):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.05, location=goc_ + Vector(((1 if p.get('quai_x') == 1 else -1) * (0.25 * (1 + dn) + 0.17), 0, 0.05)), rotation=(math.radians(90), 0, 0))
            q = bpy.context.object
            with bpy.context.temp_override(active_object=o, selected_editable_objects=[o, q]): bpy.ops.object.join()
        bpy.context.view_layer.objects.active = o
    o = bpy.context.object
    if h != 'hop':   # khối cong mặt mịn: ảnh nét (lay_net) lộ từng ô đa giác thành vệt sáng ô vuông (16/10/2026)
        for f in o.data.polygons: f.use_smooth = True
    o.scale = (w * CM, d * CM, c * CM)
    o.rotation_euler = Euler((math.radians(p.get('nghieng', 0)), 0, math.radians(xoay + p.get('xoay', 0))))   # nghiêng quanh trục x của khối (nắp laptop) rồi mới xoay
    return dat(o, m, ten)

# ── KHUNG MÀU (previs có màu — anh 14/10/2026: "dùng luôn Blender tạo khung và màu sắc"): vật liệu theo `chat`, nhân vật theo `mo_hinh`,
# ánh sáng theo kịch bản (đèn bàn bật / chỉ ánh xanh màn hình). Render EEVEE qua Xvfb → ảnh <ma>-mau.png làm ảnh tham chiếu số 1 cho keyframe.
def chat_lieu(o, chat, hex_):
    """Gắn vật liệu thật cho một khối: go (gỗ), dat_set (đất sét), long (lông), vai (vải), keo (kẹo dẻo), bong (bông), kim_loai, nhua, cao_su."""
    if not chat or not hasattr(o.data, 'materials'): return
    hx = hex_.lstrip('#'); rgb = [(int(hx[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)]
    m = bpy.data.materials.new(f'cl_{chat}_{hx}_{o.name}'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); m.diffuse_color = (*rgb, 1)
    def gon(scale, manh):
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = manh
        nt.links.new(nz.outputs['Fac'], bm.inputs['Height']); nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])
    anh = lambda ten: os.path.join(TAI_SAN, ten)
    if chat == 'go' and os.path.exists(anh('go_mau.jpg')):   # gỗ quét từ bàn thật (Poly Haven wood_table_001), tô theo màu khai, vân ~30 cm một ô
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (3.3, 3.3, 3.3)
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        def tex(ten, mau=True):
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(anh(ten), check_existing=True); t.projection = 'BOX'; t.projection_blend = 0.2
            if not mau: t.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(mp.outputs['Vector'], t.inputs['Vector']); return t
        tm, tn, tp = tex('go_mau.jpg'), tex('go_nham.jpg', False), tex('go_phap.jpg', False)
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 0.85
        nt.links.new(tm.outputs['Color'], mx.inputs['A']); mx.inputs['B'].default_value = (*[min(1, c * 2.2) for c in rgb], 1)
        nt.links.new(mx.outputs['Result'], b.inputs['Base Color']); nt.links.new(tn.outputs['Color'], b.inputs['Roughness'])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.6; nt.links.new(tp.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    elif chat == 'go':
        nz = nt.nodes.new('ShaderNodeTexWave'); nz.inputs['Scale'].default_value = 3; nz.inputs['Distortion'].default_value = 6
        cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].color = (*[c * 0.55 for c in rgb], 1); cr.color_ramp.elements[1].color = (*[min(1, c * 1.35) for c in rgb], 1)
        nt.links.new(nz.outputs['Fac'], cr.inputs['Fac']); nt.links.new(cr.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.42
    elif chat == 'dat_set': b.inputs['Roughness'].default_value = 0.55; gon(900, 0.25)
    elif chat == 'long': b.inputs['Roughness'].default_value = 0.95; b.inputs['Sheen Weight'].default_value = 1.0; gon(4000, 0.9)
    elif chat == 'vai': b.inputs['Roughness'].default_value = 0.85; b.inputs['Sheen Weight'].default_value = 0.5; gon(2500, 0.35)
    elif chat == 'keo': b.inputs['Roughness'].default_value = 0.12; b.inputs['Subsurface Weight'].default_value = 0.6; b.inputs['Coat Weight'].default_value = 0.6
    elif chat == 'bong': b.inputs['Roughness'].default_value = 1.0; b.inputs['Subsurface Weight'].default_value = 0.4; gon(1500, 0.6)
    elif chat == 'kim_loai': b.inputs['Metallic'].default_value = 0.9; b.inputs['Roughness'].default_value = 0.32
    elif chat == 'nhua': b.inputs['Roughness'].default_value = 0.35
    elif chat == 'cao_su': b.inputs['Roughness'].default_value = 0.7
    if MESH_THAT and chat != 'go': dnv.khuyet_diem(nt, b)   # vết tay / chỗ bóng chỗ mờ (dnv.khuyet_diem)
    o.data.materials.clear(); o.data.materials.append(m)

def hoan_thien(o, kieu, w, d, h):
    """Khối thân nhân vật → hình thật: đất sét gồ nhẹ, cục bông xù, lông (sợi tóc Blender), vải gợn nếp."""
    # Áp tỉ lệ vào lưới TRƯỚC (khối được thu nhỏ bằng scale 0.02 → độ gồ và độ dài lông tính theo đơn vị cục bộ bị sai cả trăm lần: lần thử đầu
    # lông Lint thành sợi dài cắt ngang khung).
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if kieu in ('dat_set', 'bong', 'vai', 'long'):
        sd = o.modifiers.new('min', 'SUBSURF'); sd.levels = sd.render_levels = 3 if kieu == 'long' else 2
    if kieu in ('dat_set', 'bong', 'vai', 'long'):
        tx = bpy.data.textures.new(f'tx_{o.name}', 'CLOUDS'); tx.noise_scale = {'dat_set': 0.006, 'bong': 0.003, 'vai': 0.01, 'long': 0.0012}[kieu]
        dp = o.modifiers.new('go', 'DISPLACE'); dp.texture = tx; dp.texture_coords = 'GLOBAL'; dp.strength = {'dat_set': 0.0008, 'bong': 0.004, 'vai': 0.004, 'long': 0.0025}[kieu]
    # Lông (Lint): mặt xù dày + sheen thay cho hệ sợi lông — sợi lông Blender chạy không giao diện ra sợi dài cả khung (thử #23), khó kiểm.

def anh_sang_mau(s, sh, bat):
    """Ánh sáng khung màu: đèn bàn vàng ấm khi shot khai den_ban, luôn có ánh xanh từ các màn hình; trời tối. bat=False → dọn đèn."""
    for o in [x for x in bpy.data.objects if x.name.startswith('L~')]: bpy.data.objects.remove(o, do_unlink=True)
    for o in bpy.data.objects:
        if o.type == 'LIGHT': o.hide_render = bat
    if not bat: return
    def den(ten, loai, vt, mau_, nl, xoay=(0, 0, 0), co=10):   # vt, co: cm
        ld = bpy.data.lights.new(ten, loai); ld.color = mau_; ld.energy = nl
        if loai == 'AREA': ld.size = co * CM
        o = bpy.data.objects.new(ten, ld); s.collection.objects.link(o); o.location = Vector(vt) * CM; o.rotation_euler = Euler(xoay)
    if sh.get('den_ban'):
        dd = [o for o in bpy.data.objects if o.name.startswith('Desk Lamp ')]
        if dd:
            top = max(dd, key=lambda o: o.matrix_world.translation.z)
            den('L~den', 'POINT', [top.matrix_world.translation.x / CM, top.matrix_world.translation.y / CM, top.matrix_world.translation.z / CM - 2], (1.0, 0.72, 0.45), 60)
    for o in bpy.data.objects:   # màn hình = khối phát sáng to → một đèn vuông xanh ngay trước mặt nó
        mt = o.active_material if hasattr(o, 'active_material') else None
        if o.type != 'MESH' or not mt or not mt.use_nodes or o.hide_render: continue
        b = mt.node_tree.nodes.get('Principled BSDF')
        if not b or b.inputs['Emission Strength'].default_value <= 0 or max(o.dimensions) < 0.1: continue
        p = o.matrix_world.translation / CM
        den(f'L~mh{o.name}', 'AREA', [p.x, p.y - 6, p.z], (0.55, 0.7, 1.0), 25 if sh.get('den_ban') else 40, (math.radians(-90), 0, 0), max(o.dimensions) * 0.8 / CM)
    # Ánh xanh đêm dịu phủ cả phòng + đèn phụ mềm từ phía máy (đủ đọc hình khối cho model — không phải ánh sáng cuối cùng của phim).
    s.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.07, 0.12, 1)
    s.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.5
    if MESH_THAT and os.path.exists(os.path.join(TAI_SAN, 'phong.hdr')):   # ánh hắt + phản chiếu từ một căn phòng THẬT (HDRI), nhuộm xanh đêm, rất dịu
        wn = s.world.node_tree; bg = wn.nodes['Background']
        ev = wn.nodes.get('hdri') or wn.nodes.new('ShaderNodeTexEnvironment'); ev.name = 'hdri'; ev.image = bpy.data.images.load(os.path.join(TAI_SAN, 'phong.hdr'), check_existing=True)
        mx = wn.nodes.get('hdri_nhuom') or wn.nodes.new('ShaderNodeMix'); mx.name = 'hdri_nhuom'; mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        mx.inputs['B'].default_value = (0.35, 0.45, 0.8, 1); wn.links.new(ev.outputs['Color'], mx.inputs['A'])
        # MÁY NHÌN THẤY NỀN = XÁM TRƠN (HDRI chỉ để hắt sáng + phản chiếu): chỗ trống lộ ảnh HDRI căn phòng thật → AI chép thành một căn phòng (#14)
        lp = wn.nodes.get('duong_tia') or wn.nodes.new('ShaderNodeLightPath'); lp.name = 'duong_tia'
        mc = wn.nodes.get('nen_may') or wn.nodes.new('ShaderNodeMix'); mc.name = 'nen_may'; mc.data_type = 'RGBA'; mc.inputs['B'].default_value = (0.18, 0.18, 0.18, 1)
        wn.links.new(mx.outputs['Result'], mc.inputs['A']); wn.links.new(lp.outputs['Is Camera Ray'], mc.inputs['Factor']); wn.links.new(mc.outputs['Result'], bg.inputs['Color'])
        bg.inputs['Strength'].default_value = 0.25
    cam = s.camera
    if cam:
        p = cam.matrix_world.translation / CM
        den('L~phu', 'AREA', [p.x, p.y, p.z + 12], (0.75, 0.82, 1.0), 4, tuple(cam.rotation_euler), 40)
        if MESH_THAT: den('L~phu2', 'AREA', [p.x, p.y, p.z + 4], (0.85, 0.88, 1.0), 2.5, tuple(cam.rotation_euler), 30)   # Cycles tối hơn EEVEE: thêm fill từ phía máy (như đèn phụ trên set thật) cho mặt nhân vật không chìm

def lay_net(cam, sh, goc=None):
    """NÉT như ảnh chụp mô hình thật (anh 16/10/2026: "sao ảnh nó cứ mờ mờ không nét như Veo"). Trước: nét đặt vào ĐIỂM NHÌN của máy (thường sau
    chủ thể) ở f/8 — ở tỉ lệ mô hình (máy cách ~7 cm) vùng nét chỉ vài mm nên chủ thể nhoè. Giờ: nét đặt giữa các CHỦ THỂ (bat_buoc, cả chỗ mở lẫn
    chỗ kết), khẩu tính theo độ sâu giữa chủ thể gần nhất và xa nhất (+1 cm) để tất cả cùng nét, nền vẫn mềm: N = f²·Δ / (2·c·s²), c = 0,03 mm,
    trong khoảng f/11–f/64 (XV_FSTOP ép một số cố định)."""
    d = cam.data.dof; d.use_dof = True; goc = cam.matrix_world.translation if goc is None else goc   # goc = chỗ máy (m) khi máy đang chạy
    chu = set(sh.get('bat_buoc') or [])
    diem = [Vector(p + ([0] if len(p) < 3 else [])) + Vector((0, 0, 1.2)) for v in sh.get('nhan_vat', []) if v['ten'] in chu for p in [v['tam']] + ([v['den']] if v.get('den') else [])]
    kc = [(p * CM - goc).length * 1000 for p in diem] or [(Vector(sh['may']['nhin']) * CM - goc).length * 1000]   # mm
    s_ = (min(kc) + max(kc)) / 2; de = max(kc) - min(kc) + 10
    d.focus_distance = s_ / 1000
    f = cam.data.lens; N = f * f * de / (2 * 0.03 * s_ * s_)
    d.aperture_fstop = float(os.environ['XV_FSTOP']) if os.environ.get('XV_FSTOP') else min(64.0, max(11.0, N))

def ve_mat_na(s, sh, cam, goc_ra):
    """MẶT NẠ 3D cho GHÉP ĐÈ đồ nhận dạng và SỬA VÙNG (anh 17/10/2026, học từ topview.ai: ghép đồ thật vào keyframe thay vì để model vẽ; sửa một vùng thay vì
    sinh lại cả khung). Render Workbench màu phẳng: vật đích trắng, mọi thứ khác đen (vật đứng trước tự che phần sau). Mỗi mặt nạ '<goc_ra>-mn-<i>.png'.
      · 'nd:<vật>' — tấm ảnh chuẩn '<vật>·anh' + 4 góc trên khung (x, y 0..1 gốc trên-trái) kèm toạ độ ảnh (u, v) — ghép đúng phối cảnh
      · 'ng:<tên>' — THÂN người (bỏ đầu, cổ, mũi, tóc) — sửa áo không đụng mặt · 'ngd:<tên>' — cả người (ghép đè tránh)"""
    from bpy_extras.object_utils import world_to_camera_view
    tg = []
    for v in DL['vat']:   # tấm ảnh chuẩn có HAI mặt ('·anh', '·anh sau') — mặt quay vào phòng tuỳ vật (màn chiếu tường sau: '·anh sau'); lấy cả hai
        ps = [o for o in (bpy.data.objects.get(f"{v['ten']}·anh"), bpy.data.objects.get(f"{v['ten']}·anh sau")) if v.get('anh') and o and not o.hide_render]
        if ps: tg.append((f"nd:{v['ten']}", ps))
    for nv in sh.get('nhan_vat', []):
        if nv.get('an') or (DL['nhan_vat_mau'].get(nv['ten']) or {}).get('hinh') != 'nguoi': continue
        ca = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render and o.name.startswith(f"NG {nv['ten']}.")]
        than = [o for o in ca if not any(k in o.name for k in ('.dau_k', '.mui', '.co_k', 'toc'))]
        if than: tg.append((f"ng:{nv['ten']}", than))
        if ca: tg.append((f"ngd:{nv['ten']}", ca))   # CẢ NGƯỜI (có đầu) — ghép đè không dán lên chỗ có người
    if not tg: return {}
    bpy.context.view_layer.update()
    mesh = [o for o in bpy.data.objects if o.type == 'MESH']; mau_cu = {o.name: tuple(o.color) for o in mesh}
    eng = s.render.engine; sd = s.display.shading; cu = (sd.light, sd.color_type); wc = tuple(s.world.color); vt_ = s.view_settings.view_transform
    s.render.engine = 'BLENDER_WORKBENCH'; sd.light = 'FLAT'; sd.color_type = 'OBJECT'; s.world.color = (0, 0, 0); s.view_settings.view_transform = 'Standard'
    fm = s.render.image_settings; fm.file_format = 'PNG'; fm.color_mode = 'BW'
    out = {}
    for i, (ma, objs) in enumerate(tg):
        for o in mesh: o.color = (0, 0, 0, 1)
        for o in objs: o.color = (1, 1, 1, 1)
        s.render.filepath = f"{goc_ra}-mn-{i}.png"; bpy.ops.render.render(write_still=True)
        rec = {'tep': f'mn-{i}'}
        if ma.startswith('nd:'):   # 4 góc của tấm QUAY VỀ PHÍA MÁY (pháp tuyến hướng máy)
            o = next((x for x in objs if (x.matrix_world.to_3x3() @ Vector((0, 0, 1))).dot(cam.location - x.matrix_world.translation) > 0), objs[0]); uv = o.data.uv_layers.active.data if o.data.uv_layers.active else None; goc = {}
            for lp in o.data.loops:
                if lp.vertex_index in goc: continue
                p = world_to_camera_view(s, cam, o.matrix_world @ o.data.vertices[lp.vertex_index].co)
                goc[lp.vertex_index] = {'p': [round(p.x, 4), round(1 - p.y, 4)], 'uv': [round(uv[lp.index].uv[0], 4), round(1 - uv[lp.index].uv[1], 4)] if uv else None}
            rec['goc'] = list(goc.values())
        out[ma] = rec
    for o in mesh: o.color = mau_cu[o.name]
    s.render.engine = eng; sd.light, sd.color_type = cu; s.world.color = wc; s.view_settings.view_transform = vt_; fm.color_mode = 'RGBA'
    return out

def ve_mau(s, sh, ra):
    """Render khung màu bằng EEVEE (chỉ khi có OpenGL — Xvfb trên box). Trả True nếu có ảnh."""
    if not NHANH: return False
    nen = tuple(s.world.node_tree.nodes['Background'].inputs['Color'].default_value); sm = s.world.node_tree.nodes['Background'].inputs['Strength'].default_value
    anh_sang_mau(s, sh, True)
    if MESH_THAT:   # render = keyframe: Cycles GPU, khử nhiễu, DOF macro
        s.render.engine = 'CYCLES'; s.cycles.samples = 12 if THO else 64; s.cycles.use_denoising = True
        bat_gpu(s)
        lay_net(s.camera, sh)
    else: s.render.engine = 'BLENDER_EEVEE'; s.eevee.taa_render_samples = 12
    s.view_settings.view_transform = 'AgX'
    an_, hien_ = nguoi_that(True)   # khung màu vẽ NGƯỜI THẬT (da, tóc, đồ) thay ma-nơ-canh khối
    # JPEG 88: nhẹ 5–8 lần PNG, đủ nét cho mô hình ảnh (anh 15/10/2026: "đẩy nhiều ảnh thì phải nén")
    fm = s.render.image_settings; fm.file_format = 'JPEG'; fm.quality = 88; fm.color_mode = 'RGB'
    s.render.filepath = ra; bpy.ops.render.render(write_still=True)
    nguoi_that(False, an_, hien_)
    fm.file_format = 'PNG'; fm.color_mode = 'RGBA'
    anh_sang_mau(s, sh, False); s.view_settings.view_transform = 'Standard'
    s.world.node_tree.nodes['Background'].inputs['Color'].default_value = nen; s.world.node_tree.nodes['Background'].inputs['Strength'].default_value = sm
    return True

# MÔ HÌNH ĐỒ ĐẠC THẬT (anh 17/10/2026 "bộ khung, thư viện làm tốt hơn chất lượng phim thì làm"): món khai mau_3d = mã mô hình CC0 Poly Haven
# (tải bằng tai-tai-san.sh vào tai-san/mo-hinh/<mã>/) — nhập glTF thay khối hộp, co GIỮ tỉ lệ cho vừa khối khai (cao ≥ 30 cm: theo chiều cao;
# món dẹt: vừa cạnh dài nhất), đáy giữa đặt đúng chỗ, xoay theo xoay khai + độ lệch mặt trước của mô hình (MH_XOAY). Các phần đặt tên
# '<tên món> m<i>' → ten_vat gom về tên món (NHOM), cổng "thấy gì" + prompt vẫn gọi đúng tên + en. Thiếu tệp → dựng khối như cũ.
MH_XOAY = {}   # mã → độ lệch mặt trước của mô hình so với quy ước bộ set (mặt nhìn −y); đo bằng bang-mo-hinh khi thêm mã mới
def hop_vat(v):
    """(gốc x, y, đáy z, rộng, sâu, cao, xoay) của một món — khối đơn hoặc nhóm phần (hộp bao các phần, toạ độ tương đối gốc)."""
    if 'phan' not in v: return v['tam'][0], v['tam'][1], v['tam'][2], v['co'][0], v['co'][1], v['co'][2], v.get('xoay', 0)
    xs, ys, zs = [], [], []
    for p in v['phan']:
        if not p.get('tam') or not p.get('co'): continue
        xs += [p['tam'][0] - p['co'][0] / 2, p['tam'][0] + p['co'][0] / 2]; ys += [p['tam'][1] - p['co'][1] / 2, p['tam'][1] + p['co'][1] / 2]; zs += [p['tam'][2], p['tam'][2] + p['co'][2]]
    return v['goc'][0], v['goc'][1], min(zs), max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs), v.get('xoay', 0)

def mo_hinh_that(v):
    import glob
    from mathutils import Matrix
    f = glob.glob(os.path.join(TAI_SAN, 'mo-hinh', v['mau_3d'], '*.gltf'))
    if not f: print('CANH BAO thieu mo hinh', v['mau_3d'], '(chay tai-tai-san.sh)'); return False
    truoc = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f[0]); bpy.context.view_layer.update()
    moi = [o for o in bpy.data.objects if o not in truoc]
    for o in moi: mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    for o in [o for o in moi if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
    luoi = [o for o in moi if o.name in bpy.data.objects and o.type == 'MESH']
    if not luoi: return False
    bb = [o.matrix_world @ Vector(c) for o in luoi for c in o.bound_box]
    lo = Vector([min(p[i] for p in bb) for i in range(3)]); hi = Vector([max(p[i] for p in bb) for i in range(3)]); sz = hi - lo
    x, y, z, w, d, h, xoay = hop_vat(v)
    s = h * CM / sz.z if h >= 30 else max(w, d, h) * CM / max(sz)
    T = Matrix.Translation(Vector((x, y, z)) * CM) @ Matrix.Rotation(math.radians(xoay + MH_XOAY.get(v['mau_3d'], 0)), 4, 'Z') @ Matrix.Scale(s, 4) @ Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)))
    for i, o in enumerate(luoi): o.matrix_world = T @ o.matrix_world; o.name = f"{v['ten']} m{i}"
    return True

def anh_cache(url):
    """Tải ảnh chuẩn về tai-san/anh/<băm>.<đuôi> (một lần) — Blender đọc tệp cục bộ."""
    import hashlib, urllib.request
    d = os.path.join(TAI_SAN, 'anh'); os.makedirs(d, exist_ok=True)
    f = os.path.join(d, hashlib.sha1(url.encode()).hexdigest()[:16] + os.path.splitext(url.split('?')[0])[1].lower())
    if not os.path.exists(f):
        try: urllib.request.urlretrieve(url, f)
        except Exception as e: print('CANH BAO khong tai duoc anh chuan', url, e); return None
    return f

def dan_anh(v):
    """ẢNH CHUẨN của đồ nhận dạng (anh 17/10/2026: "tranh trên tường lúc hình A lúc tranh B ở các góc khác nhau"): tấm ảnh phẳng phủ mặt vật (cả
    hai mặt mỏng nhất của hộp bao — mặt áp tường bị che), chừa viền 8% cho khung. Tên '<vật>·anh' → cùng nhóm vật khi kiểm."""
    f = anh_cache(v['anh']); ds = [o for o in bpy.data.objects if o.type == 'MESH' and thuoc(v['ten'], o.name)]
    if not f or not ds: return
    bpy.context.view_layer.update()
    bb = [o.matrix_world @ Vector(c) for o in ds for c in o.bound_box]
    lo = Vector([min(p[i] for p in bb) for i in range(3)]); hi = Vector([max(p[i] for p in bb) for i in range(3)]); sz = hi - lo; tam = (lo + hi) / 2
    mong = min(range(3), key=lambda i: sz[i]); a, b = [i for i in range(3) if i != mong]
    m = bpy.data.materials.new(f"anh {v['ten']}"); m.use_nodes = True; nt = m.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(f); bsdf = nt.nodes['Principled BSDF']
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 0.25
    for dau in (-1, 1):
        bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.object; o.name = f"{v['ten']}·anh{'' if dau > 0 else ' sau'}"   # '·' → ten_vat gom về vật (tên 'Màn trình chiếu anh sau' từng lọt vào prompt)
        p = tam.copy(); p[mong] = (hi if dau > 0 else lo)[mong] + dau * 0.002; o.location = p
        # mặt phẳng gốc nằm trong XY, pháp tuyến +Z → xoay cho pháp tuyến dọc trục mỏng, cạnh u theo trục a (ngang), v theo trục b (thường là cao)
        # pháp tuyến hướng RA NGOÀI vật (người xem đứng ngoài → chữ / hình không bị lật gương)
        if mong == 0: o.rotation_euler = (math.radians(90), 0, math.radians(90 * dau))          # X90: pháp tuyến −Y → Z±90: ±X
        elif mong == 1: o.rotation_euler = (math.radians(90), 0, math.radians(0 if dau < 0 else 180))   # −Y / +Y
        elif dau < 0: o.rotation_euler = (math.radians(180), 0, 0)                                 # mặt dưới: −Z
        o.scale = (sz[a] * 0.84, sz[b] * 0.84, 1) if mong == 2 else ((sz[1] if mong == 0 else sz[0]) * 0.84, sz[2] * 0.84, 1)
        o.data.materials.append(m)

def thuoc(ten, ten_khoi):
    """Khối ten_khoi là CHÍNH vật ten hay một phần của nhóm ten ('<ten> <số>'). Không khớp tiền tố trơn: 'Cửa đôi mở 2' KHÔNG thuộc 'Cửa đôi'
    (tập 122 #15: vân gỗ cửa đóng tô lên cả tấm sáng ô cửa mở)."""
    return ten_khoi == ten or (ten_khoi.startswith(ten + ' ') and ten_khoi[len(ten) + 1:].isdigit())

def dung_set():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for v in DL['vat']:
        if v.get('mau_3d') and mo_hinh_that(v): continue
        if 'phan' in v:
            for i, p in enumerate(v['phan']): khoi(p, f"{v['ten']} {i}", v['goc'], v.get('xoay', 0))
        else: khoi(v, v['ten'])
    for v in DL['vat']:   # vật liệu thật cho khung màu (Workbench vẫn đọc màu phẳng diffuse_color)
        if not v.get('chat'): continue
        for o in [x for x in bpy.data.objects if thuoc(v['ten'], x.name)]: chat_lieu(o, v['chat'], v.get('mau') or (v.get('phan') or [{}])[0].get('mau', '#888888'))
    for v in DL['vat']:   # ẢNH CHUẨN (anh: URL — tranh, màn chiếu, bảng chỉ dẫn): dán lên mặt vật → khung 3D gửi AI đã có ĐÚNG bức tranh, mọi góc như nhau
        if v.get('anh'): dan_anh(v)
    for v in DL['vat']:   # KÍNH (kinh: True — cửa / vách kính): trong suốt ở khung màu, tia đo nhìn xuyên (tia_qua_kinh) — người sau cửa kính là THẤY
        if not LA_KINH(v): continue
        for o in [x for x in bpy.data.objects if thuoc(v['ten'], x.name)]:
            m = mau(v.get('mau', '#a9c4d6')).copy(); m.name = f"kinh {v['ten']}"; b = m.node_tree.nodes['Principled BSDF']
            b.inputs['Transmission Weight'].default_value = 1.0; b.inputs['Roughness'].default_value = 0.04; b.inputs['IOR'].default_value = 1.45
            m.diffuse_color = (*m.diffuse_color[:3], 0.25); dat(o, m, o.name)
    s = bpy.context.scene
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.25, 0.26, 0.3, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 2)); bpy.context.object.data.energy = 3
    bpy.context.object.rotation_euler = Euler((math.radians(50), math.radians(-20), math.radians(20)))
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 10; s.cycles.use_denoising = True   # khung xám là khối phẳng màu: 10 mẫu + khử nhiễu ≈ 24 mẫu thô, nhanh ~2,5×
    s.render.resolution_x, s.render.resolution_y = (540, 960) if THO else (1080, 1920)   # khung màu = keyframe: đủ lớn cho model video (540 bị phóng lên thành mềm) — nháp thô thì 540
    s.view_settings.view_transform = 'Standard'
    return s

TUY_CHON = {v['ten'] for v in DL['vat'] if v.get('tuy_chon')}
THAY_CHO = {v['ten']: (v['thay_cho'] if isinstance(v['thay_cho'], list) else [v['thay_cho']]) for v in DL['vat'] if v.get('tuy_chon') and v.get('thay_cho')}   # một món thay được vài đồ (cửa mở + mảng tường)
AN_TUY = set()   # khối đang ẩn vì đồ tuỳ chọn của shot — cat_lop (tường rời) chỉ được ẩn thêm, không bật lại
def dat_tuy_chon(co):
    """Đồ TUỲ CHỌN (laptop lúc có lúc không): chỉ hiện ở shot khai may_3d.them; ẩn cả render lẫn tia kiểm (hide_viewport → ra khỏi depsgraph).
    Món tuỳ chọn là TRẠNG THÁI KHÁC của đồ set (thay_cho: cửa đôi MỞ thay cửa đóng) → đồ kia ẩn — CÙNG kieu.ts › vatHien."""
    bo = {x for t in co if t in THAY_CHO for x in THAY_CHO[t]}; xet = TUY_CHON | {x for ds in THAY_CHO.values() for x in ds}; AN_TUY.clear()
    for o in bpy.data.objects:
        t = o.name.rsplit(' ', 1)[0] if o.name.rsplit(' ', 1)[0] in xet else o.name
        if t in xet:
            o.hide_viewport = o.hide_render = (t in TUY_CHON and t not in co) or t in bo
            if o.hide_render: AN_TUY.add(o.name)
    bpy.context.view_layer.update()

def nhan_vat(sh, ket=False):
    """Khối nhân vật / đạo cụ của shot ở chỗ MỞ shot (tam), quay theo huong (độ, 0 = mặt nhìn về phía người ngồi −y, 90 = nhìn sang phải +x).
    Khối có `mat` → gắn hai mắt (lòng trắng + con ngươi) ở mặt trước: khung xám cho thấy nhân vật NHÌN ĐI ĐÂU, không chỉ đứng ở đâu.
    `phan` = các phần thêm (chân, tay, nắp…) toạ độ tương đối đáy giữa khối, cùng quay theo huong. Trả (thân để kiểm, mọi khối để dọn)."""
    than, tat_ca = [], []
    TRANG.clear()
    for nv in sh.get('nhan_vat', []):
        mau_nv = DL['nhan_vat_mau'][nv['ten']]
        cam_luc_nay = nv.get('cam') and not (ket and nv.get('den'))   # cam + den = đặt xuống trong shot: khung kết không còn cầm
        if ket is True: nv = {**nv, 'tam': nv.get('den') or nv['tam'], 'huong': nv.get('huong_den', nv.get('huong', 0)), 'nam': nv.get('nam_den', nv.get('nam')), 'nghieng': nv.get('nghieng_den', nv.get('nghieng'))}   # khung KẾT: chỗ + hướng + dáng (bẹp) lúc kết
        elif ket:   # khung GIỮA (ket = t, 0 < t < 1): nội suy chỗ + hướng giữa mở và kết — khung khoá giữa cho video nhiều khung (Pikaframes)
            t_ = float(ket); a_ = nv['tam']; b_ = nv.get('den') or a_
            h0 = nv.get('huong', 0); h1 = nv.get('huong_den', h0); dh = ((h1 - h0 + 180) % 360) - 180
            nv = {**nv, 'tam': [a_[k] + (b_[k] - a_[k]) * t_ for k in range(len(a_))] + ([] if len(a_) == len(b_) else []), 'huong': h0 + dh * t_, 'nam': nv.get('nam_den', nv.get('nam')) if t_ >= 0.5 else nv.get('nam')}
        X, Y, Z = nv['tam'][0], nv['tam'][1], (nv['tam'][2] if len(nv['tam']) > 2 else 0)
        w, d, h = mau_nv['co']
        hg = nv.get('huong', 0)
        # ĐÃ CHIA (vi_tri.chia = số mảnh, kẹo bẻ đôi ở cảnh 4): dựng TỪNG MẢNH cạnh nhau (đang cầm thì chỉ mảnh của người cầm) + ghi trạng thái
        # cho nhãn keyframe — trước đây 3D dựng con gấu nguyên nên keyframe vẽ kẹo nguyên dù chữ ghi "half" (7.1a / 7.4a tập 19, 15/10/2026).
        n = int(nv.get('chia') or 1)
        if n > 1:
            so = 1 if cam_luc_nay else n
            TRANG[nv['ten']] = f"split into {n} pieces; only ONE piece here (the holder's share)" if so == 1 else f"split into {n} separate pieces lying side by side, NOT a whole one"
            for i in range(so):
                off = (i - (so - 1) / 2) * w * 0.75
                dm, hm = (h, d) if nv.get('nam') else (d, h)   # mảnh nằm: cao thành sâu
                o = khoi({'hinh': mau_nv['hinh'], 'co': [w * 0.55, dm, hm * 0.85], 'mau': mau_nv['mau'], 'tam': [off, 0, Z]}, f"NV {nv['ten']}·manh{i}", (X, Y), hg)
                if mau_nv.get('mo_hinh'): chat_lieu(o, mau_nv['mo_hinh'], mau_nv['mau'])
                than.append(o); tat_ca.append(o)
            continue
        if mau_nv.get('hinh') == 'nguoi':   # NGƯỜI: ma-nơ-canh có khớp, cao = co[2] cm; gốc tên 'NV <tên>' (vòng diễn gắn neo vào gốc, các khớp đi theo)
            hx = mau_nv['mau'].lstrip('#'); rgb = tuple((int(hx[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))
            ha = (mau_nv.get('ao') or mau_nv['mau']).lstrip('#'); rgb_ao = tuple((int(ha[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))
            ht = (mau_nv.get('mau_toc') or '').lstrip('#'); rgb_toc = tuple((int(ht[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)) if len(ht) == 6 else None
            trang_ = {'ao': (*rgb_ao, 1), 'toc': mau_nv.get('toc'), 'do': mau_nv.get('do'), **({'mau_toc': (*rgb_toc, 1)} if rgb_toc else {})}   # người thật MPFB: tóc / đồ / màu áo
            n_ = ng().dung_nguoi(f"NG {nv['ten']}", cao=h, mau=(*rgb, 1), mau_ao=(*rgb_ao, 1), dv=CM, ten_goc=f"NV {nv['ten']}", gioi=mau_nv.get('gioi'), tuoi=mau_nv.get('tuoi'), trang=trang_)
            n_['goc'].location = Vector((X, Y, Z)) * CM; n_['goc'].rotation_euler.z = math.radians(hg)
            kieu = 'nam' if nv.get('nam') else 'ngoi' if any(str(x).startswith('ngoi') for x in (nv.get('dien') or [])) else 'dung'
            ng().tu_the(n_, kieu); NGUOI[nv['ten']] = n_; n_['kieu'] = kieu; n_['dang'] = mau_nv.get('dang') or []
            _net = (sh.get('net') or {}).get(nv['ten'])   # nét mặt khung mở / kết (bieu_cam) → mặt MPFB diễn theo
            if _net: ng().bieu_mat(n_, _net[1] if ket is True else _net[0])
            # ĐANG ĐI ở khung mở / giữa (có 'den' xa ≥ 40 cm): đặt GIỮA SẢI BƯỚC rồi mới chồng tư thế tay (ôm thùng, cầm…) — mocap đi ở t = 0 là dáng
            # đứng chụm chân, keyframe AI vẽ người đứng nghiêm giữa cửa (tập 122 #15 "Hạ sải bước vào" thành hai người đứng yên).
            di_mo = ket is not True and kieu == 'dung' and bool(nv.get('den')) and math.hypot(nv['den'][0] - X, nv['den'][1] - Y) >= 40
            if di_mo: ng().buoc(n_, 0.25)
            ng().ap_dien(n_, [x for x in dien_hl(n_, nv) if not (di_mo and str(x).split('@')[0] in DI_MC)], 1.0 if ket is True else float(ket) if ket else 0.0)   # rig: tư thế theo mã diễn lúc mở / giữa / kết
            vet_(n_, nv['ten'], dan_cua(nv, mau_nv, ket is True or bool(ket and float(ket) >= 0.5)))
            bpy.context.view_layer.update()
            phan_ng = [o for o in bpy.data.objects if o.name.startswith(f"NG {nv['ten']}.")]
            than.append(bpy.data.objects[f"NG {nv['ten']}.nguc_k"]); tat_ca.extend([n_['goc'], *phan_ng]); continue
        mt = mesh_that(nv['ten'])
        if mt:   # MESH THẬT: đặt vào chỗ (X, Y, Z) quay theo hướng; nằm thì xoay cả người như khối tạm
            from mathutils import Matrix
            M = Matrix.Translation(Vector((X, Y, Z)) * CM) @ Matrix.Rotation(math.radians(hg), 4, 'Z')
            for o in mt: o.matrix_world = M @ o.matrix_world
            bpy.context.view_layer.update()
            if nv.get('nam'): nam_xuong(mt, X, Y, Z, hg, d, h)
            than.append(mt[0]); tat_ca.extend(mt); continue
        o = khoi({'hinh': mau_nv['hinh'], 'co': [w, d, h], 'mau': mau_nv['mau'], 'sang': mau_nv.get('sang', 0), 'tam': [0, 0, Z], 'dinh': mau_nv.get('dinh', 0.4), 'hat': mau_nv.get('hat'), 'nghieng': nv.get('nghieng') or mau_nv.get('nghieng') or 0}, f"NV {nv['ten']}", (X, Y), hg)   # nghieng: đồ nghiêng / lật theo shot (vi_tri)
        if mau_nv.get('mo_hinh'): chat_lieu(o, mau_nv['mo_hinh'], mau_nv['mau']); hoan_thien(o, mau_nv['mo_hinh'], w, d, h)
        than.append(o); tat_ca.append(o)
        if nv.get('tran') and ket is not True: tat_ca.extend(tran_(o, nv, w, h, mau_nv.get('dinh', 1.0)))
        # NẰM (bẹp / ngã): dựng người ĐỨNG đủ tay, chân, tóc, mắt rồi xoay cả người ngửa ra sau quanh trục ngang của nó (mặt hướng lên).
        # Trước 15/10/2026 nằm = đổi cao thành sâu + BỎ mọi phần → còn quả trứng trơn có hai mắt, model ảnh không nhận ra là Tango nằm (#14 tập 19).
        dau = len(tat_ca) - 1
        phan = [dict(p) for p in mau_nv.get('phan', [])]
        if mau_nv.get('mat'):
            e = max(0.3, 0.26 * min(w, h)); ex = 0.22 * w
            ey, ez = -d / 2 + e * 0.15, h * 0.62 - e / 2
            for sx in (-1, 1):
                phan.append({'hinh': 'cau', 'co': [e, e, e], 'mau': '#ffffff', 'tam': [sx * ex, ey, ez]})
                phan.append({'hinh': 'cau', 'co': [e * 0.5, e * 0.5, e * 0.5], 'mau': '#111111', 'tam': [sx * ex, ey - e * 0.38, ez + e * 0.25]})
        for i, p in enumerate(phan):
            p = {**p, 'tam': [p['tam'][0], p['tam'][1], p['tam'][2] + Z]}
            pk = khoi(p, f"NV {nv['ten']}·{i}", (X, Y), hg); tat_ca.append(pk)
            if p.get('chat'): chat_lieu(pk, p['chat'], p['mau'])
        if nv.get('nam'): nam_xuong(tat_ca[dau:], X, Y, Z, hg, d, h)
    gan_tay(sh, tat_ca, ket)
    return than, tat_ca

DI_MC = ('mc_di_bo', 'mc_sai_buoc')   # mocap ĐI: khung tĩnh thay bằng giữa sải bước (nhan_vat › di_mo)

def tran_(o, nv, w, h, dinh=1.0):
    """CHẤT LỎNG ĐỔ RA từ vật đựng đang nghiêng (vi_tri.tran = tên chất lỏng tiếng Anh, tran_mau = màu): MẶT CHẤT LỎNG trong lòng miệng vật + MỘT
    ống liền thon dần tràn qua MÉP THẤP NHẤT (phía trọng lực) rồi cong xuống. Chữ "coffee spilling out" mà 3D chỉ có ly trơn thì AI vẽ ly sạch (tập
    122 #17); chuỗi hạt cầu thì AI vẽ chuỗi hạt; ống mọc từ tâm miệng của khối đặc thì AI vẽ dòng lơ lửng ngoài mép, lòng cốc trống (lượt 3).
    Hình học thay mô phỏng chất lỏng: model ảnh chỉ đọc dáng + độ sâu. Tên 'NV <vật>·tran*' → kiểm hình học / mặt nạ coi là một phần vật đó."""
    bpy.context.view_layer.update()   # khoi() vừa gán scale / xoay — chưa update thì matrix_world còn là phép dời, dòng mọc thẳng lên ngoài khung
    M = o.matrix_world.copy(); truc = (M.to_3x3() @ Vector((0, 0, 1))).normalized(); mieng = M @ Vector((0, 0, 0.5))
    rR = 0.5 * dinh * w   # bán kính miệng (cm): nón cụt đỉnh = đáy × dinh
    g = Vector((0, 0, -1)) - truc * Vector((0, 0, -1)).dot(truc)
    g = g.normalized() if g.length > 1e-4 else Vector((0, -1, 0))   # hướng mép thấp nhất trên mặt miệng
    mau_ = mau(nv.get('tran_mau', '#2a1a10')); ds = []
    # mặt chất lỏng: đĩa phẳng sẫm hơi lùi vào trong miệng
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.92 * rR * CM, depth=0.25 * CM, location=mieng - truc * (0.35 * CM), rotation=truc.to_track_quat('Z', 'Y').to_euler())
    ds.append(dat(bpy.context.object, mau_, f"NV {nv['ten']}·tran_mat"))
    # dòng: từ trong lòng miệng → qua mép thấp → theo trục ra ngoài rồi rơi
    r0 = 0.16 * w; dai = 1.5 * h; n = 26; mep = mieng + g * (0.95 * rR * CM)
    ra = (truc + g * 0.35).normalized()
    cv = bpy.data.curves.new(f"tran {nv['ten']}", 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = r0 * CM; cv.bevel_resolution = 4; cv.use_fill_caps = True
    sp = cv.splines.new('POLY'); sp.points.add(n)   # bắt đầu ĐÚNG mép (mặt chất lỏng nối liền) — thêm điểm trong lòng miệng thì dòng gấp khúc như khuỷu ống
    sp.points[0].co = (*(mep - truc * (0.1 * CM)), 1); sp.points[0].radius = 1.15
    for i in range(n):
        t = (i + 1) / n; p = mep + ra * (t * dai * CM) - Vector((0, 0, 1.6 * t * t * dai * CM))
        sp.points[i + 1].co = (*p, 1); sp.points[i + 1].radius = 1.0 - 0.8 * t   # mép rộng → đầu dòng mảnh
    cv.materials.append(mau_)
    gd = bpy.data.objects.new(f"NV {nv['ten']}·tran", cv); bpy.context.collection.objects.link(gd); ds.append(gd)
    for x in ds: x.parent = o; x.matrix_parent_inverse = M.inverted()   # đi theo vật khi bị dời / gắn tay
    TRANG[nv['ten']] = f"full of {nv['tran']}, which pours over the lowest point of the rim in one smooth continuous stream"
    return ds

def diem_cam(n_, ben):
    """Điểm nắm của một bàn tay ma-nơ-canh (toạ độ thế giới, m): cổ tay + 0,55 chiều dài bàn tay dọc trục bàn tay."""
    return n_[f'cotay_{ben}'].matrix_world @ Vector((0, 0, -0.55 * n_['L']['ban_tay']))

def tay_cam(sh):
    """Đồ đang cầm của người (ma-nơ-canh) trong shot → (người cầm, tay): món thứ nhất tay phải 'p', thứ hai tay trái 't'; người đang 'om_thung'
    thì món đầu ôm giữa hai tay 'om'. Đồ ĐEO (vi_tri.deo = khớp rig: 'cotay_t', 'cotay_p', 'co'…) → (người đeo, khớp đó)."""
    co = {v['ten']: v for v in sh.get('nhan_vat', [])}; out, dem = {}, {}
    for v in sh.get('nhan_vat', []):
        c = v.get('cam')
        if not c or c not in co or c not in NGUOI: continue
        if v.get('deo') in NGUOI[c]: out[v['ten']] = (c, v['deo']); continue   # đồ ĐEO: nằm ở khớp đó (cổ tay, cổ), không chiếm tay cầm
        om = any(str(x).split('@')[0] == 'om_thung' for x in (co[c].get('dien') or []))
        k = dem.get(c, 0); dem[c] = k + 1
        out[v['ten']] = (c, 'om' if om and k == 0 else 'p' if k == 0 else 't')
    return out

# XUYÊN NHAU (anh 18/10/2026: "hình nộm, thùng đồ là đối tượng vật lý thì thẻ rơi lên sẽ bị chặn lại chứ không đi vào trong"): đo hình học như
# game / previs đặt đồ tĩnh — không mô phỏng vật lý (mô phỏng là cho chuyển động theo thời gian). Độ lún = khoảng cách sâu nhất từ một đỉnh của món
# vào TRONG mesh kín của vật kia (BVH find_nearest + pháp tuyến). Tập 122 #11: thẻ treo chìm vào thùng đồ Hạ ôm.
from mathutils.bvhtree import BVHTree
def _bvh(o, dg):
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    try: return BVHTree.FromPolygons([oe.matrix_world @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons]) if me.polygons else None
    finally: oe.to_mesh_clear()
def _hop(objs):
    bb = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector([min(p[i] for p in bb) for i in range(3)]), Vector([max(p[i] for p in bb) for i in range(3)])
_TIA = Vector((0.5773, 0.5774, 0.5773))
def _trong(bv, q):
    """Điểm q nằm TRONG mesh kín bv: bắn tia một hướng cố định, đếm số lần cắt mặt — lẻ là trong."""
    n, o = 0, q.copy()
    for _ in range(32):
        loc, _, _, _ = bv.ray_cast(o, _TIA)
        if loc is None: break
        n += 1; o = loc + _TIA * 1e-5
    return n % 2 == 1
def do_lun(objs, khac):
    """(độ lún sâu nhất cm, tên vật bị xuyên) của các mesh objs vào các mesh kín khac; bỏ vật không chạm hộp bao. TRONG / NGOÀI đo bằng TIA (đếm số
    lần cắt mặt, lẻ = trong) — không tin chiều pháp tuyến: khối elip rủ xuống của ma-nơ-canh dựng bằng lật trục z nên mặt quay vào trong (lần đo
    đầu báo "thùng xuyên vào Hạ 52 cm")."""
    objs = [o for o in objs if o.type == 'MESH']; khac = [k for k in khac if k.type == 'MESH']
    if not objs or not khac: return 0.0, ''
    dg = bpy.context.evaluated_depsgraph_get(); lo, hi = _hop(objs); best, ten = 0.0, ''
    for k in khac:
        klo, khi = _hop([k])
        if any(klo[i] > hi[i] or khi[i] < lo[i] for i in range(3)): continue
        bv = _bvh(k, dg)
        if not bv: continue
        for o in objs:
            oe = o.evaluated_get(dg); me = oe.to_mesh()
            try:
                for v in me.vertices:
                    q = oe.matrix_world @ v.co; loc, _, _, d = bv.find_nearest(q)
                    if loc is not None and d / CM > best and _trong(bv, q): best, ten = d / CM, k.name
            finally: oe.to_mesh_clear()
    return best, ten
def vat_can(sh, ten, cam_boi=None):
    """Vật có thể bị món `ten` xuyên: người KHÁC (đồ đang cầm thì bỏ hẳn người cầm — ôm thùng thì thùng sát bụng là đúng), đạo cụ khác, đồ set không
    phải mặt nền. Chỉ thứ đang hiện."""
    out = []
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.hide_render or o.name.startswith('THAN '): continue
        if o.name.startswith(f"NV {ten}") and (o.name == f"NV {ten}" or o.name.startswith(f"NV {ten}·")): continue
        if o.name.startswith('NG '):
            if cam_boi and o.name.startswith(f"NG {cam_boi}."): continue
            out.append(o)
        elif o.name.startswith('NV '):
            if '·day' in o.name or '·tran' in o.name: continue
            out.append(o)
        elif o.name in bpy.data.objects and not any(thuoc(t, o.name.split('·')[0]) for t in NEN) and not o.name.startswith(('cam ', 'sau ', 'Đèn', 'den ')):
            out.append(o)
    return out

def gan_tay(sh, tat_ca, ket=False):
    """RIG — đồ đang cầm nằm ĐÚNG trong bàn tay người cầm (anh 17/10/2026: ly, thẻ lơ lửng cạnh tay → AI vẽ sai tay cầm): dời món sao cho tâm món
    trùng điểm nắm (ôm thùng: giữa hai tay). Khung kết của món cầm + đặt xuống (cam + den) thì không gắn."""
    bpy.context.view_layer.update()
    for ten, (c, ben) in tay_cam(sh).items():
        v = next(x for x in sh['nhan_vat'] if x['ten'] == ten)
        if ket and v.get('den'): continue
        n_ = NGUOI[c]; khop = n_.get(ben) if ben not in ('om', 'p', 't') else None
        objs = [o for o in tat_ca if o.name == f"NV {ten}" or o.name.startswith(f"NV {ten}·")]
        if not objs: continue
        if khop is not None:   # ĐEO: trục vòng theo trục xương (cẳng tay). Người thật MPFB mặc áo dài tay: vòng nằm chỗ thật (lùi 2 cm về khuỷu) thì
            # chui trong cổ tay áo, khung kết #9 #25 mất chuỗi hạt — đúng câu kịch bản "tay áo xô lên lộ chuỗi hạt": vòng ngay mép cổ tay áo
            # (nhích 1,2 cm về phía bàn tay) và nở 45 % ra ngoài lớp vải (ống tay vest dày như #9).
            q = khop.matrix_world.to_quaternion()
            for o in objs: o.rotation_euler = q.to_euler(); o.scale = (o.scale[0] * 1.45, o.scale[1] * 1.45, o.scale[2])
            bpy.context.view_layer.update(); dich = khop.matrix_world @ Vector((0, 0, -1.2))
        else: dich = (diem_cam(n_, 't') + diem_cam(n_, 'p')) / 2 if ben == 'om' else diem_cam(n_, ben)
        bb = [o.matrix_world @ Vector(cc) for o in objs for cc in o.bound_box]
        tam = Vector([(min(p[i] for p in bb) + max(p[i] for p in bb)) / 2 for i in range(3)])
        treo = float(v.get('treo') or 0)
        if treo and khop is None:   # ĐỒ TREO (thẻ đeo, chìa khoá…): mép trên món thấp hơn điểm nắm `treo` cm + dây chữ V từ tay xuống — món nắm trong tay thì bàn tay che mất (#11)
            dinh_ = Vector((tam.x, tam.y, max(p[2] for p in bb)))
            for o in objs: o.location += dich - Vector((0, 0, treo * CM)) - dinh_
            bpy.context.view_layer.update()
            # NẰM LÊN MẶT VẬT BÊN DƯỚI: món treo lún vào thùng / bàn → nhấc lên đỉnh hộp bao của vật bị xuyên (dây chùng), chỉ khi vẫn thấp hơn tay
            lun, ten_b = do_lun(objs, vat_can(sh, ten, c))
            if lun > 0.5 and ten_b in bpy.data.objects:
                dz = _hop([bpy.data.objects[ten_b]])[1].z - _hop(objs)[0].z + 0.3 * CM
                if _hop(objs)[1].z + dz <= dich.z:
                    for o in objs: o.location.z += dz
                    bpy.context.view_layer.update()
            bb = [o.matrix_world @ Vector(cc) for o in objs for cc in o.bound_box]; z0 = max(p[2] for p in bb)
            ngang = Vector((max(p[0] for p in bb) - min(p[0] for p in bb), max(p[1] for p in bb) - min(p[1] for p in bb), 0)) * 0.25
            moc = Vector(((min(p[0] for p in bb) + max(p[0] for p in bb)) / 2, (min(p[1] for p in bb) + max(p[1] for p in bb)) / 2, z0))
            cv = bpy.data.curves.new(f"day {ten}", 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = 0.35 * CM
            sp = cv.splines.new('POLY'); sp.points.add(2)
            for i, q in enumerate((moc - ngang, dich, moc + ngang)): sp.points[i].co = (*q, 1)
            cv.materials.append(mau(v.get('treo_mau', '#1f2a5a')))
            d_ = bpy.data.objects.new(f"NV {ten}·day", cv); bpy.context.collection.objects.link(d_); tat_ca.append(d_)
        else:
            for o in objs: o.location += dich - tam
    bpy.context.view_layer.update()

def nam_xuong(objs, X, Y, Z, hg, d, h):
    """Xoay một người đang đứng (đáy giữa ở X, Y, Z; quay theo hg) ngửa ra sau 90° quanh trục ngang của chính nó: mặt trước lên trời, đỉnh đầu
    về phía sau; thân nằm giữa đúng chỗ X, Y, đáy nằm trên mặt Z (dày bằng chiều sâu d)."""
    from mathutils import Matrix
    bpy.context.view_layer.update()
    a = math.radians(hg); u = Vector((math.cos(a), math.sin(a), 0)); truoc = Vector((math.sin(a), -math.cos(a), 0))
    P = Vector((X, Y, Z)) * CM
    M = Matrix.Translation(P + Vector((0, 0, d / 2 * CM)) + truoc * (h / 2 * CM)) @ Matrix.Rotation(math.radians(-90), 4, u) @ Matrix.Translation(-P)
    for o in objs: o.matrix_world = M @ o.matrix_world
    bpy.context.view_layer.update()

def may(s, m, ten='cam'):
    cd = bpy.data.cameras.new(ten); cd.lens = m['ong_kinh']; cd.sensor_fit = 'AUTO'; cd.clip_start = 0.002
    o = bpy.data.objects.new(ten, cd); s.collection.objects.link(o)
    o.location = Vector(m['dat']) * CM
    o.rotation_euler = (Vector(m['nhin']) * CM - o.location).to_track_quat('-Z', 'Y').to_euler()
    s.camera = o; cat_lop(o); return o

_LOP = {}
def cat_lop(cam):
    """TƯỜNG RỜI (wild walls — trường quay tháo mảng tường / trần nằm giữa máy và diễn viên; anh 17/10/2026, bộ set tổng tài có đủ 4 tường + trần,
    máy tự đặt lùi ra sau tường / lên trên trần → khung chỉ thấy tường): mặt nền (nen) nằm giữa máy và lòng phòng thì ẩn cả render lẫn tia kiểm,
    theo trục mỏng nhất của nó. CÙNG luật với trình xem bo-set-three.ts › catLop. Máy đứng trong phòng → không ẩn gì."""
    if not _LOP:
        ds = [o for o in bpy.data.objects if o.type == 'MESH' and o.name in NEN]
        if not ds: _LOP['tam'] = None; return
        hop = {}
        for o in ds:
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            hop[o.name] = ([min(v[i] for v in bb) for i in range(3)], [max(v[i] for v in bb) for i in range(3)])
        lo = [min(h[0][i] for h in hop.values()) for i in range(3)]; hi = [max(h[1][i] for h in hop.values()) for i in range(3)]
        _LOP['tam'] = [(lo[i] + hi[i]) / 2 for i in range(3)]; _LOP['hop'] = hop
    if not _LOP.get('tam'): return
    if 'gan' not in _LOP:   # đồ GẮN TƯỜNG (cửa, tranh, mảng ốp, bảng): mỏng theo trục của mặt nền + nằm sát mặt đó → tháo cùng mảng tường (#16 kín gỗ cửa đôi)
        _LOP['gan'] = {}
        for o in bpy.data.objects:
            if o.type != 'MESH' or o.name in NEN or o.name.startswith(('NG ', 'NV ', 'cam ', 'may ', 'duong ', 'dd ', 'tia ', 'nen ', 'vach ')): continue
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; lo, hi = [min(v[i] for v in bb) for i in range(3)], [max(v[i] for v in bb) for i in range(3)]
            for ten, (wl, wh) in _LOP['hop'].items():
                ax = min(range(3), key=lambda i: wh[i] - wl[i])
                if hi[ax] - lo[ax] < 0.2 and lo[ax] > wl[ax] - 0.15 and hi[ax] < wh[ax] + 0.15 and all(lo[i] < wh[i] and hi[i] > wl[i] for i in range(3) if i != ax):
                    _LOP['gan'].setdefault(ten, []).append(o.name); break
    p = cam.location
    for ten, (lo, hi) in _LOP['hop'].items():
        o = bpy.data.objects.get(ten)
        if not o: continue
        ax = min(range(3), key=lambda i: hi[i] - lo[i])
        an = p[ax] > lo[ax] if (lo[ax] + hi[ax]) / 2 >= _LOP['tam'][ax] else p[ax] < hi[ax]
        for x in [o] + [bpy.data.objects.get(g) for g in _LOP['gan'].get(ten, [])]:
            if x: x.hide_viewport = x.hide_render = an or x.name in AN_TUY   # đồ tuỳ chọn shot không khai / bị thay (cửa đóng khi cửa mở) giữ ẩn
    bpy.context.view_layer.update()

def do_sau(s, gan, xa):
    """Vật liệu đè: độ sâu theo máy (gần trắng → xa đen) — bản đồ độ sâu cho ControlNet."""
    m = bpy.data.materials.new('do_sau'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    cam = nt.nodes.new('ShaderNodeCameraData'); mr = nt.nodes.new('ShaderNodeMapRange'); em = nt.nodes.new('ShaderNodeEmission'); ra = nt.nodes.new('ShaderNodeOutputMaterial')
    mr.inputs['From Min'].default_value = gan; mr.inputs['From Max'].default_value = xa; mr.inputs['To Min'].default_value = 1; mr.inputs['To Max'].default_value = 0
    nt.links.new(cam.outputs['View Distance'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], ra.inputs['Surface'])
    return m

# KHUNG XƯƠNG OpenPose (COCO-18) của mọi người trong khung MỞ — ảnh điều khiển thứ hai cho bước 1 (ControlNet Union: độ sâu + dáng). 18/10/2026
# tập 122 #11: ma-nơ-canh khối elip bị cắt sát khung → FLUX depth đọc thành bình đồng cắm cây, không vẽ người nào; bước 2 tự đặt người bừa.
# Khung xương nói thẳng "người, dáng này, mặt nhìn hướng này" (mặt quay đi thì không có mũi / mắt — đúng cách OpenPose mã hoá quay lưng).
_MAU_XUONG = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255),
              (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]
_CHI_XUONG = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
def diem_xuong(n_, cam):
    """18 điểm OpenPose (thế giới) của một ma-nơ-canh; None = điểm không vẽ (mặt quay đi thì bỏ mũi + mắt, tai phía khuất)."""
    w = lambda k: n_[k].matrix_world.translation.copy()
    D = n_['dau'].matrix_world.to_3x3(); len_ = lambda v: v.normalized() if v.length else v
    len_dau = n_['L']['dau'] * CM; r = 0.05 * n_['cao'] * CM
    tam = w('dau') + len_(D @ Vector((0, 0, 1))) * (0.5 * len_dau)
    truoc, trai = len_(D @ Vector((0, -1, 0))), len_(D @ Vector((1, 0, 0)))
    nhin_may = truoc.dot(len_(cam.location - tam)) > 0.15
    mat_t, mat_p = tam + truoc * (0.8 * r) + trai * (0.35 * r), tam + truoc * (0.8 * r) - trai * (0.35 * r)
    tai_t, tai_p = tam + trai * r, tam - trai * r
    thay_tai = lambda ben: (ben * trai).dot(len_(cam.location - tam)) > -0.3
    ds = [tam + truoc * r if nhin_may else None, w('co'), w('vai_p'), w('khuyu_p'), w('cotay_p'), w('vai_t'), w('khuyu_t'), w('cotay_t'),
          w('dui_p'), w('goi_p'), w('cochan_p'), w('dui_t'), w('goi_t'), w('cochan_t'), mat_p if nhin_may else None, mat_t if nhin_may else None,
          tai_p if thay_tai(-1) else None, tai_t if thay_tai(1) else None]
    return ds

def ve_xuong(s, sh, cam, tep):
    """Ảnh khung xương OpenPose 720×1280 (ngang 1280×720) nền đen, đúng máy của shot. Không người nào trong khung → không ghi tệp."""
    import numpy as np
    from bpy_extras.object_utils import world_to_camera_view
    doc = s.render.resolution_x < s.render.resolution_y; W, H = (720, 1280) if doc else (1280, 720)
    anh = np.zeros((H, W, 3), dtype=np.float32); day = max(4.0, H / 220); co_nguoi = False
    yy, xx = np.mgrid[0:H, 0:W]
    for nv in sh.get('nhan_vat', []):
        n_ = NGUOI.get(nv['ten'])
        if nv.get('an') or not n_ or (DL['nhan_vat_mau'].get(nv['ten']) or {}).get('hinh') != 'nguoi': continue
        bpy.context.view_layer.update()
        pts = []
        for p in diem_xuong(n_, cam):
            if p is None: pts.append(None); continue
            q = world_to_camera_view(s, cam, p); pts.append((q.x * W, q.y * H) if q.z > 0 else None)   # gốc dưới-trái = thứ tự điểm ảnh Blender
        if sum(1 for p in pts if p and 0 <= p[0] < W and 0 <= p[1] < H) < 3: continue
        co_nguoi = True
        for i, (a, b) in enumerate(_CHI_XUONG):
            if not pts[a] or not pts[b]: continue
            (x0, y0), (x1, y1) = pts[a], pts[b]; dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy or 1e-6
            t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / L2, 0, 1); d2 = (xx - (x0 + t * dx)) ** 2 + (yy - (y0 + t * dy)) ** 2
            anh[d2 <= day * day] = np.array(_MAU_XUONG[i]) * 0.6
        for i, p in enumerate(pts):
            if p: anh[(xx - p[0]) ** 2 + (yy - p[1]) ** 2 <= day * day] = _MAU_XUONG[i]
    if not co_nguoi: return False
    im = bpy.data.images.new('xuong', W, H, alpha=True); px = np.ones((H, W, 4), dtype=np.float32); px[..., :3] = anh / 255.0
    im.pixels.foreach_set(px.ravel()); im.filepath_raw = tep; im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)
    return True

# LỚP GHÉP cho shot NHIỀU NGƯỜI (anh 18/10/2026 chọn "A — ghép từng người theo mặt nạ 3D"): một lượt FLUX cho cả khung không gắn được đúng mô tả vào
# đúng khối người (#12: Hạ + Vivian trộn thành một, Thần quay lưng), nên tách: bản đồ độ sâu NỀN không người + bản đồ độ sâu RIÊNG từng người (kèm
# đồ người đó cầm / đeo), cùng máy, cùng thang độ sâu với bản đầy đủ → sinh từng lớp rồi ghép theo thứ tự xa → gần (sinh-anh.ts › ghepTungNguoi).
def ve_lop(s, sh, cam, ra):
    """Ghi <ma>-sau-nen.png + <ma>-sau-n<i>.png; trả [{ten, tep, xa}] (xa = cm tới máy, ghép xa trước) hoặc None khi shot dưới hai người trong khung."""
    nguoi = [v for v in sh.get('nhan_vat', []) if not v.get('an') and (DL['nhan_vat_mau'].get(v['ten']) or {}).get('hinh') == 'nguoi' and v['ten'] in NGUOI]
    if len(nguoi) < 2: return None
    cua = lambda t: [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE') and (o.name.startswith(f"NG {t}.") or o.name == f"THAN NG {t}"
              or any(o.name == f"NV {m}" or o.name.startswith(f"NV {m}·") for m, (c, _) in tay_cam(sh).items() if c == t))]
    cu = {o.name: o.hide_render for o in bpy.data.objects}
    moi_nguoi = {v['ten']: cua(v['ten']) for v in nguoi}
    tat_ca_nguoi = {o for ds in moi_nguoi.values() for o in ds}
    try:
        for o in tat_ca_nguoi: o.hide_render = True
        ve_sau(s, sh, cam, f"{ra}-sau-nen.png")   # NỀN: bối cảnh + đồ không ai cầm
        out = []; tf = s.render.film_transparent; s.render.film_transparent = True   # ngoài người = trong suốt → đen (xa nhất)
        for i, v in enumerate(nguoi):
            giu = set(moi_nguoi[v['ten']])
            for o in bpy.data.objects:
                if o.type in ('MESH', 'CURVE'): o.hide_render = cu.get(o.name, o.hide_render) if o in giu else True
            ve_sau(s, sh, cam, f"{ra}-sau-n{i}.png")
            p = Vector(v['tam'][:2] + [0]) * CM; xa = (Vector((cam.location.x, cam.location.y, 0)) - p).length / CM
            out.append({'ten': v['ten'], 'tep': f"sau-n{i}", 'xa': round(xa, 1)})
        s.render.film_transparent = tf
        return out
    finally:
        for o in bpy.data.objects:
            if o.name in cu: o.hide_render = cu[o.name]

def nguoi_that(bat, an=None, hien=None):
    """Đổi ma-nơ-canh khối ↔ NGƯỜI THẬT MPFB (thân 'THAN NG <t>' + tóc / đồ / mắt 'THAN NG <t>.*') của mọi người đang có trong shot. bat=True → trả
    (an, hien) để gọi lại với bat=False trả về. Dùng cho độ sâu VÀ khung màu đầu / kết (anh 18/10/2026: "3D đã có người thật mẫu sao bản chụp đầu
    cuối không thấy") — kiểm hình học / mặt nạ vẫn chạy trên khối như cũ."""
    if not bat:
        for o in an: o.hide_render = False
        for x in hien: x.hide_render = x.hide_viewport = True
        return
    an, hien = [], []
    for t in list(NGUOI):
        x = bpy.data.objects.get(f"THAN NG {t}")   # tra theo TÊN: NGUOI giữ cả người của shot trước, object đã xoá → ReferenceError (phòng họp sập)
        if not x: continue
        phan = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(f"NG {t}.") and not o.hide_render]
        if not phan: continue   # người không có trong shot này / đang ẩn
        an += phan; hien += [x, *[o for o in bpy.data.objects if o.name.startswith(f"THAN NG {t}.")]]
    for o in an: o.hide_render = True
    for x in hien: x.hide_render = x.hide_viewport = False
    return an, hien

def ve_sau(s, sh, cam, ra):
    """Bản đồ ĐỘ SÂU của khung MỞ (gần trắng → xa đen), cùng máy + ống kính: bước 1 của keyframe hai bước — model sinh ảnh điều khiển bằng độ
    sâu (FLUX depth) bị khoá theo hình học 3D (anh 15/10/2026: ba model ảnh dựa trên ảnh tham chiếu đều tự dựng lại góc máy #35).
    NGƯỜI trong độ sâu = THÂN LIỀN (mesh/nguoi.py › than_tron), không phải chuỗi khối elip: elip rời cắt sát khung thì FLUX vẽ thành bình / tượng
    (tập 122 #11, 3 lượt); bỏ hẳn người khỏi độ sâu + khung xương (FLUX dev Union) thì ảnh nhoè không dùng được (lượt 4)."""
    an, hien = nguoi_that(True)
    d = (Vector(sh['may']['nhin']) - Vector(sh['may']['dat'])).length * CM
    eng, smp, dn = s.render.engine, s.cycles.samples, s.cycles.use_denoising
    s.view_layers[0].material_override = do_sau(s, d * 0.4, d * 3.0)
    s.render.engine = 'CYCLES'; s.cycles.samples = 1; s.cycles.use_denoising = False; s.view_settings.view_transform = 'Standard'
    fm = s.render.image_settings; fm.file_format = 'PNG'; fm.color_mode = 'BW'
    s.render.filepath = ra; bpy.ops.render.render(write_still=True)
    s.view_layers[0].material_override = None; fm.color_mode = 'RGBA'
    s.render.engine, s.cycles.samples, s.cycles.use_denoising = eng, smp, dn
    nguoi_that(False, an, hien)

import re as _re
# kính: khai kinh=True HOẶC en tả là kính (glass wall / door / partition / panel) — 17/10/2026 'Vách kính phòng TGĐ' chưa khai, che người phía sau
LA_KINH = lambda v: bool(v.get('kinh')) or bool(_re.search(r'\bglass (wall|door|partition|panel)s?\b', v.get('en') or '', _re.I))
KINH = {v['ten'] for v in DL['vat'] if LA_KINH(v)}
def tia_qua_kinh(s, dg, goc, huong, kc):
    """ray_cast bỏ qua vật kính (KINH): trúng kính thì bắn tiếp từ sau mặt kính, tối đa 4 lớp."""
    for _ in range(4):
        hit, loc, nor, i, ob, mx = s.ray_cast(dg, goc, huong, distance=kc)
        g = ob.name.split('·')[0] if hit and ob else ''
        if not (g in KINH or g.rsplit(' ', 1)[0] in KINH): return hit, loc, nor, i, ob, mx
        buoc = (loc - goc).length + 0.001; goc = loc + huong * 0.001; kc -= buoc
        if kc <= 0: return False, None, None, None, None, None
    return False, None, None, None, None, None

def dien_hl(n_, nv, di=False):
    """Mã diễn CÓ HIỆU LỰC của một người: dáng nghỉ của nhân vật (khoi_3d.dang) + động tác khai ở vi_tri.dien chồng sau. Dáng nghỉ chỉ áp khi
    đứng yên (không đi, không 'den', không mocap cả người, không ngồi / nằm) — đi / mocap tự có dáng."""
    d = list(nv.get('dien') or []); dg = n_.get('dang') or []
    if dg and not di and not nv.get('den') and n_.get('kieu', 'dung') == 'dung' and not any(str(x).startswith('mc_') for x in d): return list(dg) + d
    return d

KHOA_LOOK = ('trang_phuc', 'trang', 'vet')   # CÙNG bo-set-3d.ts › KHOA_LOOK
def dan_cua(nv, mau_nv, ket):
    """Dấu 3D của một người trong shot = dấu của các BIẾN THỂ mà sổ người đang trỏ tới (ô trang_phuc / trang / vet = tên biến thể; khối nhân vật
    mang bảng 'dan' tên → dấu — bo-set-3d.ts › khoiCua). Khung kết đọc ô _den. Không có chỗ nào khai dấu riêng: đổi biến thể là đổi mọi shot."""
    bang = mau_nv.get('dan') or {}; out = []
    for k in KHOA_LOOK:
        t = (nv.get(f'{k}_den') if ket and nv.get(f'{k}_den') is not None else nv.get(k)) or ''
        out += bang.get(t.strip().lower(), [])
    return out

BO_PHAN = {'nguc': 'nguc_k', 'dau': 'dau_k'}
def vet_(n_, ten, ds):
    """Dán DẤU của biến thể lên ma-nơ-canh (Dan3d: cho · mau · rong · cao · lech): khối dẹt bám mặt trước bộ phận, đi theo người khi cúi / quay —
    mọi góc máy thấy CÙNG một vết. Tên 'NG <ten>.dan_<i>' → kiểm hình học coi là một phần người đó."""
    for i, d in enumerate(ds):
        bp = bpy.data.objects.get(f"NG {ten}.{BO_PHAN.get(d.get('cho', 'nguc'), 'nguc_k')}")
        if not bp: continue
        bb = [Vector(c) for c in bp.bound_box]
        lo = Vector([min(q[k] for q in bb) for k in range(3)]); hi = Vector([max(q[k] for q in bb) for k in range(3)])
        lx, lz = (d.get('lech') or [0.5, 0.55])
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1); o = bpy.context.object
        dat(o, mau(d.get('mau', '#6b3f1d')), f"NG {ten}.dan_{i}")
        o.parent = bp; o.matrix_parent_inverse.identity()
        o.location = (lo.x + (hi.x - lo.x) * lx, lo.y, lo.z + (hi.z - lo.z) * lz)
        o.scale = ((hi.x - lo.x) * float(d.get('rong', 0.4)) / 2, (hi.y - lo.y) * 0.06, (hi.z - lo.z) * float(d.get('cao', 0.4)) / 2)

# DÁNG CẦN MẶT TỰA ở khung MỞ: động tác → điểm chạm (bàn tay). Không có mặt đỡ dưới điểm chạm thì AI tự bịa chỗ tựa — tập 122 #20 Thần "chống bàn"
# ở chỗ không có bàn → keyframe chống tay lên lưng ghế; #22 cận cổ tay thành bàn tay lơ lửng. Phim thường diễn viên tự tìm mặt bàn; phim AI phải đo.
DANG_TUA = {'chong_ban': ('t', 'p')}
def tua_hong(s, dg, sh, ten):
    """Khoảng hở lớn nhất (cm) từ điểm chạm của dáng tựa đang diễn ở khung mở tới mặt đỡ ngay dưới nó (bỏ qua thân chính người đó). None = không có
    dáng tựa hoặc chạm đủ (≤ 6 cm)."""
    nv = next((x for x in sh.get('nhan_vat', []) if x.get('ten') == ten), None); n_ = NGUOI.get(ten)
    if not nv or not n_: return None
    mo = [str(d).split('@')[0] for d in (nv.get('dien') or []) if '@' not in str(d) or float(str(d).split('@')[1].split('-')[0]) <= 0.01]
    hong = 0.0
    for ma in mo:
        for ben in DANG_TUA.get(ma, ()):
            p = diem_cam(n_, ben); goc = p.copy()
            for _ in range(6):
                hit, loc, _, _, ob, _ = s.ray_cast(dg, goc, Vector((0, 0, -1)), distance=3.0)
                if not hit or not ob: hong = max(hong, 300.0); break
                if ob.name.startswith(f"NG {ten}.") or ob.name == f"NV {ten}" or ob.name.startswith(f"NV {ten}·"): goc = loc - Vector((0, 0, 0.002)); continue
                hong = max(hong, (p.z - loc.z) / CM); break
    return round(hong, 1) if hong > 6 else None

def kiem_hinh_hoc(s, cam, sh, nv_obj):
    """Kiểm BẰNG SỐ (không bằng mắt): mỗi nhân vật — TÂM có trong khung không, chiếm bao nhiêu % chiều cao khung, bị vật nào che (bắn tia
    từ máy tới 9 điểm trên thân — che > nửa số điểm = bị che). bat_buoc = chủ thể của khung (shot khai) — chỉ chúng mới là lỗi khi hỏng."""
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); out = []
    bb_ten = set(sh.get('bat_buoc') or [])
    # MA-NƠ-CANH NGƯỜI (khối 'NG <tên>.<khớp>'): đo CẢ NGƯỜI — hộp bao gộp mọi khớp, tên = tên nhân vật, tay chân của chính họ không tính là che.
    # Trước 17/10/2026 chỉ đo khối ngực dưới tên 'NG Lâm Hạ.nguc_k' → cổng tổng thể / chủ thể không nhận ra ai (tập 122: 3 cảnh báo thiếu người).
    nguoi_cua = lambda n: n[3:].rsplit('.', 1)[0] if n.startswith('NG ') and '.' in n else None
    for o in nv_obj:
        ng_ = nguoi_cua(o.name)
        cam_ = next((x.get('cam') for x in sh.get('nhan_vat', []) if x.get('ten') and (thuoc(x['ten'], o.name) or o.name == f"NV {x['ten']}")), None)
        phan = [x for x in bpy.data.objects if x.name.startswith(f"NG {ng_}.")] if ng_ else [o]
        pts = [x.matrix_world @ Vector(c) for x in phan for c in x.bound_box]
        lo = Vector([min(q[i] for q in pts) for i in range(3)]); hi = Vector([max(q[i] for q in pts) for i in range(3)])
        bb = [Vector((hi.x if i & 1 else lo.x, hi.y if i & 2 else lo.y, hi.z if i & 4 else lo.z)) for i in range(8)] if ng_ else pts
        tam = sum(bb, Vector()) / 8
        diem = [tam] + [tam.lerp(c, 0.7) for c in bb]
        che = {}; ys = []
        for p in diem:
            v = world_to_camera_view(s, cam, p); ys.append(v.y)
            d = p - cam.location; kc = d.length
            hit, loc, _, _, ob, _ = tia_qua_kinh(s, dg, cam.location, d.normalized(), kc - 0.0005)
            nhom = o.name.rsplit(' ', 1)[0] if o.name[-1:].isdigit() else o.name   # phần cùng nhóm (đế–cột–chao đèn) không tính là che
            if not (hit and ob) or ob.name == o.name or thuoc(nhom, ob.name) or ob.name.startswith(o.name + '·'): continue
            if ng_ and (ob.name.startswith(f"NG {ng_}.") or ob.name == f"NV {ng_}"): continue
            # món đang CẦM / ĐEO: bàn tay, cổ tay của chính người cầm che một phần là tự nhiên, không tính là bị che
            if cam_ and (ob.name.startswith(f"NG {cam_}.") or ob.name == f"NV {cam_}"): continue
            k_ = ob.name.split('·')[0]; k_ = f"NV {nguoi_cua(k_)}" if nguoi_cua(k_) else k_
            che[k_] = che.get(k_, 0) + 1
        vt = world_to_camera_view(s, cam, tam)
        trong = 0 <= vt.x <= 1 and 0 <= vt.y <= 1 and vt.z > 0
        if ng_:   # người: TRONG KHUNG = một bộ phận lọt khung (cận mặt: đầu / ngực; cận đồ đang cầm: bàn tay) — tâm hông dưới khung là đúng ý; CAO = phần thấy, cắt theo mép
            moc = phan
            trong = any(0 <= q.x <= 1 and 0 <= q.y <= 1 and q.z > 0 for q in (world_to_camera_view(s, cam, m.matrix_world @ (sum((Vector(c) for c in m.bound_box), Vector()) / 8)) for m in moc if m))
            ys = [min(1.0, max(0.0, y)) for y in ys]
        bi_che = sorted(k[3:] if k.startswith('NV ') else k for k, v in che.items() if v > len(diem) / 2)
        ten = ng_ or (o.name[3:] if o.name.startswith('NV ') else next((t for t in bb_ten if thuoc(t, o.name)), o.name))
        # 'tam': toạ độ THẾ GIỚI (cm) của chủ thể lúc dựng — món đang cầm / đeo nằm ở bàn tay thật của rig, không ở toạ độ khai → đặt máy tay nhắm theo số này
        # 'khung': hộp bao trên màn (0..1, gốc trên-trái, kẹp vào khung) gồm cả phần bị che — hai người hộp trùng nhau thì AI vẽ thành một (#15)
        cv = [world_to_camera_view(s, cam, q) for q in bb]; kx = [min(1.0, max(0.0, q.x)) for q in cv]; ky = [min(1.0, max(0.0, 1 - q.y)) for q in cv]
        d_ = {'nhan_vat': ten, 'tam': [round(x / CM, 1) for x in tam], 'bat_buoc': ten in bb_ten, 'trong_khung': trong,
              'cao_khung_pt': round((max(ys) - min(ys)) * 100, 1), 'bi_che_boi': bi_che, 'khung': [round(min(kx), 3), round(min(ky), 3), round(max(kx), 3), round(max(ky), 3)]}
        if ng_ and (h_ := tua_hong(s, dg, sh, ng_)): d_['tua_hong'] = h_
        out.append(d_)
    return out

NHOM = {v['ten'] for v in DL['vat'] if 'phan' in v or v.get('hinh') == 'nguoi' or v.get('mau_3d')}
NGUOI_SET = {v['ten'] for v in DL['vat'] if v.get('hinh') == 'nguoi'}   # người phụ / quần chúng của bộ set — 'thay' đánh dấu nguoi để prompt đếm đúng số người   # nhóm khối + người phụ (phần '<ten> ng.<khớp>')
NEN = {v['ten'] for v in DL['vat'] if v.get('nen')}
EN = {v['ten']: v['en'] for v in DL['vat'] if v.get('en')}   # tên tiếng Anh cho prompt keyframe   # mặt bàn, tường, kệ: không phải vật chắn
TRANG = {}   # tên → trạng thái đang dựng của shot hiện tại (đã chia mảnh…) — nhin_thay ghi vào 'trang' cho nhãn keyframe
def ten_vat(o):
    """Tên người đọc của một khối trong cảnh: 'NV Tango' → Tango, 'Desk Lamp 2' → Desk Lamp (phần của nhóm)."""
    n = o.name.split('·')[0]
    if n.startswith('NV '): return n[3:]
    # Ma-nơ-canh nhân vật (phim người thật): các khối 'NG <tên>.<khớp>' — trước 17/10/2026 trả nguyên tên khối nên khung xám báo
    # "NG Lâm Hạ.dau_k" thay vì "Lâm Hạ": cổng chủ thể / chữ lệch / prompt keyframe tưởng nhân vật vắng mặt.
    if n.startswith('NG ') and '.' in n: return n[3:].rsplit('.', 1)[0]
    g = n.rsplit(' ', 1)[0]
    return g if g in NHOM else n   # '<vật>·anh sau' (tấm ảnh chuẩn), '<vật>·manh0' → tên vật — trả o.name từng làm tên khối lọt vào prompt

def nhin_thay(s, cam, sh, nv_obj, C=27, R=48):
    """THẤY GÌ TRONG KHUNG — bằng số, không bằng mắt (anh 14/10/2026: khối vàng ở cảnh 6–7 trông như tay Gã khổng lồ mà không ai biết là gì).
    Bắn lưới 27×48 tia qua khung máy: mỗi vật chiếm bao nhiêu % khung, hộp bao (0..1, gốc trên-trái), và có nằm TRƯỚC chủ thể không
    (tien = gần máy hơn chủ thể gần nhất — vật chắn tiền cảnh). Ghi vào khung xám để lưới gắn nhãn, cổng bắt vật chắn, prompt keyframe gọi tên từng khối."""
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    fr = [cam.matrix_world @ v for v in cam.data.view_frame(scene=s)]   # trên-phải, dưới-phải, dưới-trái, trên-trái
    tr, br, bl, tl = fr
    bb_ten = set(sh.get('bat_buoc') or [])
    chu = [o for o in nv_obj if ten_vat(o) in bb_ten] or nv_obj
    kc_chu = min(((sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8) - cam.location).length for o in chu) if chu else 1e9
    dem = {}
    for j in range(R):
        for i in range(C):
            u, v = (i + 0.5) / C, (j + 0.5) / R
            p = tl + (tr - tl) * u + (bl - tl) * v
            d = (p - cam.location).normalized()
            hit, loc, nor, _, ob, _ = s.ray_cast(dg, cam.location, d)
            if not hit or not ob: continue
            t = ten_vat(ob); x = dem.setdefault(t, {'n': 0, 'u0': 1, 'v0': 1, 'u1': 0, 'v1': 0, 'gan': 1e9, 'mat': 0})
            x['n'] += 1; x['mat'] += nor.z > 0.75; x['u0'] = min(x['u0'], u); x['v0'] = min(x['v0'], v); x['u1'] = max(x['u1'], u); x['v1'] = max(x['v1'], v)
            x['gan'] = min(x['gan'], (loc - cam.location).length)
    out = []
    for t, x in dem.items():
        pt = round(x['n'] * 100 / (C * R), 1)
        if pt < 0.5: continue
        out.append({'ten': t, 'en': EN.get(t, t), **({'trang': TRANG[t]} if t in TRANG else {}), **({'nguoi': True} if t in NGUOI_SET or t in NGUOI else {}), 'pt': pt, 'hop': [round(x['u0'] - 0.5 / C, 3), round(x['v0'] - 0.5 / R, 3), round(x['u1'] + 0.5 / C, 3), round(x['v1'] + 0.5 / R, 3)],
                    # mặt nhìn từ trên xuống (≥ 80% tia trúng mặt ngửa: thẻ cam hai bạn đứng lên, sổ mở) là MẶT NỀN, không phải vật chắn
                    'tien': t not in bb_ten and t not in NEN and x['gan'] < kc_chu * 0.8 and x['mat'] < 0.8 * x['n']})
    return sorted(out, key=lambda x: -x['pt'])

def hong(k): return sum(1 for x in k if x['bat_buoc'] and (not x['trong_khung'] or x['bi_che_boi']))

DA_GIAI = {}   # ma shot → máy đã chốt trong lượt này (shot đi theo thứ tự phát)
def _phia(a, b, p):
    c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    return 0 if abs(c) < 1e-6 else (1 if c > 0 else -1)

def sai_truc(sh, p):
    """1 = máy ở phía bên kia trục hành động so với shot so trục — phía của shot đó tính bằng máy ĐÃ GIẢI trong lượt (DA_GIAI), không phải máy cũ."""
    t = sh.get('truc')
    if not t: return 0
    dau = _phia(t['ta'], t['tb'], DA_GIAI.get(t['truoc'], t['dat_truoc']))
    c = _phia(t['a'], t['b'], p)
    return 1 if dau and c and c != dau else 0

def thieu_nhac(s, cam, sh, nv):
    """Số vật chữ tả khung nhắc (sh['nhac']) mà khung không thấy (< 1%) — cùng luật cổng nhacMaKhongThay; bộ giải xoay máy cho chúng vào khung."""
    nhac = [t for t in (sh.get('nhac') or []) if t not in NEN and (t not in TUY_CHON or t in (sh.get('them') or []))]
    if not nhac: return 0
    co = {t['ten'] for t in nhin_thay(s, cam, sh, nv, 14, 24) if t['pt'] >= 1}
    return sum(1 for t in nhac if t not in co)

def chan_la(s, cam, sh, nv):
    """Số vật chắn tiền cảnh ≥ 12% khung mà chữ tả khung không nhắc (sh['nhac'], bo-set-3d.ts › vatDuocNhac) — cùng luật cổng vatChanTienCanh."""
    nhac = set(sh.get('nhac') or [])
    return sum(1 for t in nhin_thay(s, cam, sh, nv, 14, 24) if t['tien'] and t['pt'] >= 12 and t['ten'] not in nhac)

def dat_may(cam, dat, nhin):
    cam.location = Vector(dat) * CM
    cam.rotation_euler = (Vector(nhin) * CM - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cat_lop(cam)

SAN_CO = {'ms': 20, 'two': 15, 'mcu': 30}   # CÙNG bo-set-3d.ts › SAN_CO (+ toàn cảnh người thật 10 — SAN_WS_NGUOI)
def qua_nho(sh, k):
    """Số chủ thể QUÁ NHỎ so với cỡ cảnh (cùng luật cổng coCanhLech / chuTheQuaNho): người chính dưới sàn cỡ cảnh; đồ vật ở cú cận cao < 15% khung.
    Trước đây bộ giải chỉ tránh che khuất → chọn chỗ xa tít, người thành chấm (tập 122 #15)."""
    co = sh.get('co_canh') or ''; mau = DL.get('nhan_vat_mau', {}); n = 0
    nguoi = [x for x in k if x['bat_buoc'] and x['trong_khung'] and (mau.get(x['nhan_vat']) or {}).get('hinh') == 'nguoi']
    san = SAN_CO.get(co) or (10 if co == 'ws' and nguoi else 0)
    if san and nguoi and max(x['cao_khung_pt'] for x in nguoi) < san: n += 1
    if co in ('cu', 'ecu', 'insert', 'mcu'):
        n += sum(1 for x in k if x['bat_buoc'] and x['trong_khung'] and (mau.get(x['nhan_vat']) or {}).get('hinh') != 'nguoi' and x['cao_khung_pt'] < 15)
    return n

def mat_sai(sh, p):
    """Số NGƯỜI ĐANG NÓI (sh['mat'] — bo-set-3d.ts › nguoiNoiTrongKhung) mà từ chỗ máy p không thấy mặt ở khung mở: góc giữa hướng mặt (huong: 0 = nhìn −y,
    90 = +x) và hướng tới máy > ngưỡng (sh['mat_nguong'] — cùng luật kiem-ai-3d.ts › matNguoiNoi). Bộ giải coi nặng như chủ thể bị che."""
    n = 0; ng = sh.get('mat_nguong', 80)
    for ten in sh.get('mat') or []:
        v = next((x for x in sh['nhan_vat'] if x['ten'] == ten), None)
        if not v: continue
        h = math.radians(v.get('huong', 0)); f = Vector((math.sin(h), -math.cos(h))); d = Vector((p[0] - v['tam'][0], p[1] - v['tam'][1]))
        if d.length < 1e-6: continue
        if math.degrees(f.angle(d.normalized())) > ng: n += 1
    return n

def giai_may(s, cam, sh, nv):
    """BỘ GIẢI MÁY: máy tự động mà chủ thể bị che / ra ngoài, nằm sai phía trục, hoặc có vật chắn tiền cảnh chữ không nhắc, → thử xoay quanh chủ thể (±15…60°), nâng máy, lùi xa — lấy phương án đầu tiên
    mọi chủ thể đều thấy rõ (ít đổi nhất trước). Không có phương án sạch → giữ phương án ít lỗi nhất, kiểm vẫn báo."""
    g = Vector(sh['may']['nhin']); d0 = Vector(sh['may']['dat']) - g
    tot = None
    # CỠ CHỦ THỂ (17/10/2026 tập 122): bước nâng máy cũ 1,5–8 cm là cỡ đồ chơi — người thật 170 cm thì nâng theo phần thân; thêm thử LẠI GẦN (0,8)
    H = max([float((DL.get('nhan_vat_mau', {}).get(t) or {}).get('co', [0, 0, 0])[2]) for t in (sh.get('bat_buoc') or [])] + [0])
    buoc_z = (0, 1.5, 4, 8) if H < 30 else (0, 0.1 * H, 0.2 * H, 0.35 * H)
    for xa in (1.0, 0.8, 1.3, 1.7):
        for dz in buoc_z:
            for dp in (0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 150, -150, 180):   # tới 180° để máy đang sai phía trục quay về được
                a = math.radians(dp); v = Vector((d0.x * math.cos(a) - d0.y * math.sin(a), d0.x * math.sin(a) + d0.y * math.cos(a), d0.z)) * xa
                vt_may = Vector(trong_phong(g + v + Vector((0, 0, dz))))   # TRONG phòng: không lên quá trần (#14 485 cm), không ra ngoài sàn (#10)
                dat_may(cam, vt_may, g)
                k = kiem_hinh_hoc(s, cam, sh, nv); h = hong(k) * 100 + sai_truc(sh, vt_may) * 100 + mat_sai(sh, vt_may) * 100 + qua_nho(sh, k) * 50
                if h == 0: h = chan_la(s, cam, sh, nv) + thieu_nhac(s, cam, sh, nv) * 10   # chủ thể sạch rồi mới tính vật chắn lạ + vật được nhắc mà không thấy (đắt hơn)
                if tot is None or h < tot[0]: tot = (h, [round(x, 1) for x in vt_may], k)
                if h == 0: return tot
    dat_may(cam, tot[1], g); return tot

# TRẦN của bộ set (vật khai 'ceiling'): máy không được cao hơn — trên trần thì tường rời dỡ trần, máy nhìn ra khoảng trống ngoài set, AI vẽ thêm một căn phòng
# (tập 122 #14, #5). None = set không có trần (bàn làm việc đồ chơi).
_tran = [float(v['tam'][2]) for v in DL['vat'] if v.get('tam') and len(v['tam']) > 2 and re.search(r'\bceiling\b', v.get('en', ''), re.I) and float(v['tam'][2]) > 150]
TRAN_Z = min(_tran) if _tran else None
# SÀN của bộ set (vật nền khai floor / carpet): máy phải đứng TRONG phòng, cách mép 20 cm — bộ giải lùi xa từng đưa máy ra ngoài sàn (#10 y −270, sàn
# từ −50) → khung lộ khoảng trống ngoài set. None = set không có sàn (bàn làm việc đồ chơi).
_san = [v for v in DL['vat'] if v.get('nen') and v.get('tam') and v.get('co') and re.search(r'\b(floor|carpet)\b', v.get('en', ''), re.I)]
SAN_XY = (min(v['tam'][0] - v['co'][0] / 2 for v in _san) + 20, max(v['tam'][0] + v['co'][0] / 2 for v in _san) - 20,
          min(v['tam'][1] - v['co'][1] / 2 for v in _san) + 20, max(v['tam'][1] + v['co'][1] / 2 for v in _san) - 20) if _san else None
def trong_phong(p):
    """Kẹp vị trí máy (cm, list hoặc Vector) vào trong sàn + dưới trần của bộ set."""
    x, y, z = p[0], p[1], p[2]
    if SAN_XY: x = min(max(x, SAN_XY[0]), SAN_XY[1]); y = min(max(y, SAN_XY[2]), SAN_XY[3])
    if TRAN_Z is not None: z = min(z, TRAN_Z - 15)
    return [x, y, z]

def vat_chu_the(sh):
    """Đồ vật CỦA BỘ SET được khai là chủ thể khung (vd công tắc đèn ở shot bấm đèn) — kiểm như nhân vật: phải thấy rõ, không bị che.
    Nhóm nhiều phần ('Desk Lamp 0..3') lấy phần đầu tiên làm đại diện."""
    ten_nv = {nv['ten'] for nv in sh.get('nhan_vat', [])}
    out = []
    for t in sh.get('bat_buoc') or []:
        if t in ten_nv: continue
        o = bpy.data.objects.get(t) or next((x for x in bpy.data.objects if thuoc(t, x.name)), None)
        if o: out.append(o)
    return out

DA_DAT = []   # ô chữ đã đặt trên sơ đồ (cm): nhãn mới chồng lên thì dời xuống tới chỗ trống
def nhan_chu(s, chu, vt, mau_hex, co=1.6, nen=None):
    """Chữ nằm phẳng (sơ đồ nhìn từ trên), căn giữa tại vt (cm), tự né nhãn đã đặt; nen = màu tấm nền sau chữ cho dễ đọc."""
    t = bpy.data.curves.new('nh', 'FONT'); t.body = chu; t.size = co * CM; t.align_x = 'CENTER'; t.align_y = 'CENTER'
    o = bpy.data.objects.new(f'nh {chu}', t); s.collection.objects.link(o); o.location = Vector(vt) * CM
    t.materials.append(mau(mau_hex, 4))
    bpy.context.view_layer.update(); w = o.dimensions.x / CM + co * 0.5; h = co * 1.25
    trung = lambda x, y: any(abs(x - a) < (w + b) / 2 + 0.1 and abs(y - c) < (h + d) / 2 + 0.1 for a, c, b, d in DA_DAT)
    x, y = vt[0], vt[1]
    if trung(x, y):   # thử dời dần ra bốn phía, lấy chỗ trống gần nhất
        thu = [(vt[0] + dx * w * r * 0.55, vt[1] + dy * h * r * 0.95) for r in range(1, 9) for dx, dy in ((0, -1), (0, 1), (1, 0), (-1, 0), (1, -1), (-1, -1), (1, 1), (-1, 1))]
        x, y = next((q for q in thu if not trung(*q)), (x, y))
    DA_DAT.append((x, y, w, h)); vt = (x, y, vt[2]); o.location = Vector(vt) * CM
    if nen:
        khoi({'hinh': 'hop', 'co': [w, h, 0.05], 'mau': nen, 'tam': [vt[0], vt[1], vt[2] - 0.1]}, f'nen {chu}')
    return o

def toan_canh(s, canh_ds, ra):
    """SƠ ĐỒ MÁY từng cảnh (anh 15/10/2026: "chụp toàn cảnh 3D các cảnh xem đã chuẩn và dễ hiểu chưa") — dạng overhead camera plot của ngành:
    nhìn thẳng từ trên, phóng vào vùng diễn của cảnh; nhân vật đặc ở chỗ xuất hiện đầu tiên + tên; đường đi trong cảnh (chấm + #N khi đổi chỗ);
    máy từng shot = nón vàng chỉ hướng + tia tới điểm nhìn + nhãn #N đặt SAU lưng máy. Cỡ nón / chữ theo cỡ vùng (cảnh nhỏ vẫn đọc được).
    canh_ds = [{'ten': …, 'so': [số shot…]}]. Ra <ra>/toan-canh-<k>.png."""
    for v in [x for x in bpy.data.objects if x.name.startswith('Tường')]: v.hide_render = True
    s.display.shading.show_shadows = False
    goc_obj = set(bpy.data.objects)
    for k, cn in enumerate(canh_ds):
        ds = sorted([sh for sh in DL['shot'] if sh.get('so') in cn['so']], key=lambda x: x['so'])
        if not ds: continue
        dat_tuy_chon({t for sh in ds for t in (sh.get('them') or [])})
        DA_DAT.clear()
        # Khung ôm VÙNG DIỄN (chỗ đứng nhân vật + điểm máy nhìn) rộng gấp đôi; máy đặt xa hơn thì vẽ ở mép khung kèm "xa N cm".
        diem = [Vector(sh['may']['nhin']) for sh in ds]
        diem += [Vector((p[0], p[1], p[2] if len(p) > 2 else 0)) for sh in ds for nv in sh.get('nhan_vat', []) for p in (nv['tam'], nv.get('den')) if p]
        lo = Vector((min(p.x for p in diem), min(p.y for p in diem), 0)); hi = Vector((max(p.x for p in diem), max(p.y for p in diem), max([p.z for p in diem] + [sh['may']['dat'][2] for sh in ds])))
        tam = (lo + hi) / 2; rong = max(18.0, (hi.x - lo.x), (hi.y - lo.y) * 1.6) * 2.0; u = rong / 60   # đơn vị cỡ nón / chữ
        nx, ny = rong / 2 * 0.86, rong / 1.6 / 2 * 0.78   # nửa khung dùng được (chừa mép cho nhãn)
        cd = bpy.data.cameras.new('tc'); cd.type = 'ORTHO'; cd.ortho_scale = rong * CM; cd.clip_start = 0.01; cd.clip_end = 20
        oc = bpy.data.objects.new('tc', cd); s.collection.objects.link(oc); oc.location = (tam.x * CM, tam.y * CM, 5); s.camera = oc
        # Đồ treo cao hơn mọi máy của cảnh (chao đèn…) che sơ đồ → ẩn.
        an = [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE') and o.visible_get() and min((o.matrix_world @ Vector(b)).z for b in o.bound_box) / CM > hi.z + 2]
        for o in an: o.hide_render = True
        cao = hi.z + 3   # chữ / nón nằm trên mọi thứ
        dau = {}
        for sh in ds:
            for nv in sh.get('nhan_vat', []): dau.setdefault(nv['ten'], nv)
        nhan_vat({'nhan_vat': list(dau.values())})
        duong = {}; truoc = {}
        for sh in ds:
            for nv in sh.get('nhan_vat', []):
                dd = duong.setdefault(nv['ten'], [[]])
                if (sh.get('nhay') or nv.get('nhay') or nv.get('cam')) and dd[-1]: dd.append([])
                for p in (nv['tam'], nv.get('den')):
                    if p: dd[-1].append((p[0], p[1], cao - 1))
                q = tuple(round(x, 1) for x in nv['tam'][:2])
                if truoc.get(nv['ten']) != q and len(truoc.get(nv['ten'], ())) :
                    nhan_chu(s, f"{sh['so']}", (nv['tam'][0] + 1.6 * u, nv['tam'][1] - 1.2 * u, cao), DL['nhan_vat_mau'][nv['ten']]['mau'], 1.6 * u)
                truoc[nv['ten']] = tuple(round(x, 1) for x in (nv.get('den') or nv['tam'])[:2])
        for ten, doan in duong.items():
            m = DL['nhan_vat_mau'][ten]['mau']
            for j, dd in enumerate(x for x in doan if x):
                gon = [dd[0]] + [p for i, p in enumerate(dd[1:]) if (Vector(p) - Vector(dd[i])).length > 0.05]
                for p in gon[1:]:
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.35 * u * CM, location=Vector(p) * CM); dat(bpy.context.object, mau(m, 3), f"dd {ten}")
                if len(gon) > 1: khoi({'hinh': 'day', 'diem': [list(p) for p in gon], 'ban_kinh': 0.15 * u, 'mau': m, 'sang': 3, 'bac': 1}, f"duong {ten} {j}")
        for t, nv in dau.items():
            nhan_chu(s, t, (nv['tam'][0], nv['tam'][1] + DL['nhan_vat_mau'][t]['co'][1] / 2 + 1.6 * u, cao + 0.2), '#ffffff', 1.5 * u, nen='#111111')
        for sh in ds:
            m = sh['may']; d = Vector(m['nhin']) - Vector(m['dat']); d.z = 0; d.normalize()
            p0 = Vector((m['dat'][0], m['dat'][1], cao)); p1 = Vector((m['nhin'][0], m['nhin'][1], cao - 0.5))
            v = p0 - Vector((tam.x, tam.y, cao)); k0 = max(abs(v.x) / nx, abs(v.y) / ny); xa = ''
            if k0 > 1: xa = f" xa {round((Vector(m['dat'][:2]) - Vector(m['nhin'][:2])).length)} cm"; p0 = Vector((tam.x, tam.y, cao)) + v / k0
            khoi({'hinh': 'day', 'diem': [list(p0), list(p1)], 'ban_kinh': 0.08 * u, 'mau': '#facc15', 'sang': 2, 'bac': 1}, f"tia {sh['ma']}")
            bpy.ops.mesh.primitive_cone_add(radius1=0.9 * u * CM, depth=2.0 * u * CM, location=p0 * CM)
            dat(bpy.context.object, mau('#facc15', 3), f"non {sh['ma']}").rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
            sau = p0 - d * 2.6 * u if not xa else p0 + (Vector((tam.x, tam.y, cao)) - p0).normalized() * 3.2 * u   # máy ở mép: nhãn vào phía trong
            nhan_chu(s, f"#{sh['so']}{xa}", (sau.x, sau.y, cao + 0.4), '#facc15', 1.7 * u, nen='#000000')
        for o in bpy.data.objects:   # lớp chú thích (nón, tia, đường đi, chữ) vẽ đè lên đồ đạc: tấm thẻ nghiêng không che được số máy
            if o not in goc_obj and not o.name.startswith('NV '): o.show_in_front = True
        s.render.resolution_x, s.render.resolution_y = 1600, 1000; may_ve(s, True); s.display.shading.show_shadows = False
        s.render.filepath = f"{ra}/toan-canh-{k}.png"; bpy.ops.render.render(write_still=True)
        for o in [x for x in bpy.data.objects if x not in goc_obj]: bpy.data.objects.remove(o, do_unlink=True)
        for o in an: o.hide_render = False
    print('XONG toan canh', len(canh_ds))

s = dung_set()
shots = [sh for sh in DL['shot'] if not CHI or sh['ma'] in CHI]
def bang_ti_le(s, ra):
    """BẢNG TỈ LỆ (character lineup — anh 15/10/2026: "chưa thấy bảng vẽ tỷ lệ giữa các đối tượng"): mọi nhân vật / đạo cụ của tập đứng cạnh nhau,
    đúng cỡ cm, nhìn thẳng từ trước bằng máy TRỰC GIAO (không méo phối cảnh), thước vạch từng cm phía sau + tên dưới chân. Ảnh này đi kèm
    keyframe làm ảnh tham chiếu cỡ — trước đây tỉ lệ chỉ là một câu chữ trong prompt. Ra <ra>/bang-ti-le.png."""
    for o in list(bpy.data.objects):
        if o.type in ('MESH', 'CURVE', 'FONT'): bpy.data.objects.remove(o, do_unlink=True)
    ten = sorted(DL['nhan_vat_mau'], key=lambda t: -DL['nhan_vat_mau'][t]['co'][2])
    # Dựng từng món ở gốc, đo hộp THẬT (tay khổng lồ, tóc, tai vượt cỡ khai) rồi mới xếp hàng — xếp theo cỡ khai thì món này đè món kia.
    from mathutils import Matrix
    x = 0.0; vt = []; cao = 0.0
    for t in ten:
        # Món có hướng chỉ (bàn tay, ngón trỏ chĩa −y) quay ngang 90° cho thấy dáng; nhân vật vẫn nhìn thẳng máy (thấy mặt).
        hg = 90 if not DL['nhan_vat_mau'][t].get('mat') and t in ('The Giant',) else 0
        _, os_ = nhan_vat({'nhan_vat': [{'ten': t, 'tam': [0, 0, 0], 'huong': hg}]}); bpy.context.view_layer.update()
        ds = [o.matrix_world @ Vector(b) for o in os_ for b in o.bound_box]
        x0, x1 = min(p.x for p in ds) / CM, max(p.x for p in ds) / CM; zmax = max(p.z for p in ds) / CM
        dx = x - x0
        for o in os_: o.matrix_world = Matrix.Translation(Vector((dx * CM, 0, 0))) @ o.matrix_world
        vt.append((t, x + (x1 - x0) / 2, zmax)); x += (x1 - x0) + 1.4; cao = max(cao, zmax)
    rong = x - 1.4; cao += 1.5
    for t, cx, zmax in vt:   # tên + chiều cao THẬT (gồm tóc, tai, đầu khăn)
        tx = bpy.data.curves.new('t', 'FONT'); tx.body = f'{t}\n{zmax:.1f} cm'; tx.size = 0.55 * CM; tx.align_x = 'CENTER'
        to = bpy.data.objects.new(f'ten {t}', tx); s.collection.objects.link(to); to.location = Vector((cx, -2, -1.2)) * CM; to.rotation_euler = (math.radians(90), 0, 0)
        tx.materials.append(mau('#111111'))
    for k in range(0, int(cao) + 1):   # thước: vạch ngang mỗi cm sau lưng hàng nhân vật, số cm ở mép trái
        khoi({'hinh': 'hop', 'co': [rong + 3, 0.02, 0.03 if k % 5 else 0.06], 'mau': '#9aa3ad' if k % 5 else '#4b5563', 'tam': [rong / 2, 3, k]}, f'vach {k}')
        tx = bpy.data.curves.new('so', 'FONT'); tx.body = f'{k}'; tx.size = 0.4 * CM; tx.align_x = 'RIGHT'
        to = bpy.data.objects.new(f'so {k}', tx); s.collection.objects.link(to); to.location = Vector((-1.8, 2.9, k - 0.15)) * CM; to.rotation_euler = (math.radians(90), 0, 0)
        tx.materials.append(mau('#4b5563'))
    khoi({'hinh': 'hop', 'co': [rong + 6, 0.1, cao + 4], 'mau': '#ece8df', 'tam': [rong / 2, 3.2, -2.5]}, 'nen sau')
    khoi({'hinh': 'hop', 'co': [rong + 6, 8, 0.1], 'mau': '#d8d2c4', 'tam': [rong / 2, 0, -0.1]}, 'nen duoi')
    bw, bh = rong + 5, cao + 3.2   # khung ôm vừa hàng + thước + tên (không chừa mảng trống)
    cd = bpy.data.cameras.new('lt'); cd.type = 'ORTHO'; cd.ortho_scale = max(bw, bh) * CM
    oc = bpy.data.objects.new('lt', cd); s.collection.objects.link(oc); oc.location = Vector((rong / 2 - 0.6, -40, cao / 2 - 1.0)) * CM; oc.rotation_euler = (math.radians(90), 0, 0); s.camera = oc
    s.render.resolution_x, s.render.resolution_y = 1800, max(400, int(1800 * bh / bw))
    s.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.9, 0.88, 0.84, 1)
    may_ve(s, True); s.display.shading.show_shadows = False
    if MESH_THAT:   # mesh thật: Cycles + hai đèn vuông trước mặt hàng (soát ngoại hình đúng như sẽ vào keyframe)
        s.render.engine = 'CYCLES'; s.cycles.samples = 48; s.cycles.use_denoising = True
        bat_gpu(s)
        s.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25
        for k_, (dx, e_) in enumerate(((-0.3, 1.6), (0.6, 0.7))):
            ld = bpy.data.lights.new(f'lt{k_}', 'AREA'); ld.energy = e_; ld.size = 0.3
            lo = bpy.data.objects.new(f'lt{k_}', ld); s.collection.objects.link(lo); lo.location = Vector((rong / 2 + dx * rong, -30, cao + 10)) * CM
            lo.rotation_euler = (Vector((rong / 2, 0, cao / 2)) * CM - lo.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = f'{ra}/bang-ti-le.png'; bpy.ops.render.render(write_still=True)
    print('XONG bang ti le', [(t, round(z, 1)) for t, _, z in vt])

def ve_do_sau(s, ra):
    """BẢN ĐỒ ĐỘ SÂU từng shot (anh 15/10/2026: keyframe phải tuân thủ tuyệt đối góc máy 3D — model ảnh dựa trên ảnh tham chiếu tự dựng lại cảnh):
    gần trắng → xa đen, đúng máy + ống kính của shot, cho model sinh ảnh điều khiển bằng độ sâu (FLUX depth) — hình học bị khoá theo 3D.
    Khoảng sâu theo chính shot: gần = 40% khoảng cách tới điểm nhìn, xa = 3 lần. Ra <ra>/<ma>-sau.png."""
    for v in [x for x in bpy.data.objects if x.name.startswith('Tường')]: v.hide_render = False
    for sh in DL['shot']:
        dat_tuy_chon(set(sh.get('them') or []))
        _, het = nhan_vat(sh)
        cam = may(s, sh['may'], f"sau {sh['ma']}")
        d = (Vector(sh['may']['nhin']) - Vector(sh['may']['dat'])).length * CM
        s.view_layers[0].material_override = do_sau(s, d * 0.4, d * 3.0)
        s.render.engine = 'CYCLES'; s.cycles.samples = 1; s.cycles.use_denoising = False
        s.render.resolution_x, s.render.resolution_y = 768, 1365
        s.view_settings.view_transform = 'Standard'
        fm = s.render.image_settings; fm.file_format = 'PNG'; fm.color_mode = 'BW'
        s.render.filepath = f"{ra}/{sh['ma']}-sau.png"; bpy.ops.render.render(write_still=True)
        s.view_layers[0].material_override = None; fm.color_mode = 'RGBA'
        for o in het: bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.objects.remove(cam, do_unlink=True)
    print('XONG do sau', len(DL['shot']))

if os.environ.get('XV_DO_SAU'):   # đường riêng: chỉ render bản đồ độ sâu từng shot
    ve_do_sau(s, RA); sys.exit(0)
# THƯ VIỆN ĐỘNG TÁC (bước 2, anh 16/10/2026 "làm phim hoàn toàn bằng Blender"): mỗi nhân vật trong shot khai vi_tri[].dien = ['ten@a-b', …]
# (a, b = phần thời lượng shot 0..1; '@a' = bắt đầu ở a, kéo ~15 %; không '@' = cả shot). Giá trị giữ nguyên sau khi động tác xong (tóc đã rũ
# thì rũ tới hết shot). Chớp mắt + chúi tới khi đi là TỰ ĐỘNG, không cần khai.
DONG_TAC = {
    # NGƯỜI (rig ma-nơ-canh — mesh/nguoi.py › TU_THE_NGUOI): tư thế chồng lên đứng / bước; 'ten' = cả shot, 'ten@a-b' = chuyển dần trong a..b
    'quy_mot_goi': 'quỳ một gối, tay với xuống sàn', 'cam_truoc': 'cầm món trước ngực', 'cam_dien_thoai': 'nhìn điện thoại trong tay',
    'gio_cao': 'giơ cao món cho cả phòng thấy', 'dua_truoc_mat': 'đưa món lên trước mặt người đối diện', 'lac_treo': 'chìa tay ngang vai, món treo lủng lẳng ngang mặt người đối diện', 'hat': 'hất / ném mạnh ra trước',
    'giat': 'vươn tay giật', 'chong_ban': 'hai tay chống mặt bàn, ngẩng nhìn', 'cui_nguoi': 'cúi sát về phía trước', 'om_thung': 'ôm thùng trước bụng',
    'khoanh_tay': 'khoanh tay', 'gioi_thieu': 'đưa tay giới thiệu người bên cạnh', 'thuyet_trinh': 'tay mở về phía màn chiếu',
    # DÁNG CẢM XÚC (mesh/nguoi.py › TU_THE_NGUOI, đi cùng nét mặt bieu_cam của shot)
    'om_mat_khoc': 'hai tay ôm mặt khóc, cúi đầu', 'om_nguc_khoc': 'gập người, tay ấn ngực khóc', 'quy_khoc': 'quỵ hai gối gục xuống khóc', 'ngua_mat_gao': 'ngửa mặt gào khóc, tay buông thõng',
    'chi_tay_gian': 'chồm tới chỉ thẳng tay giận', 'lui_so': 'lùi lại, hai tay đưa lên che', 'om_nguoi': 'tự ôm lấy mình', 'tay_che_mieng': 'hai tay che miệng', 'tay_tran_cui': 'cúi gập, tay áp trán',
    # MOCAP THẬT (kho CMU, mesh/mocap.py › MOCAP): 'mc_<ten>[@a-b]'
    'mc_cai_nhau': 'mocap: cãi nhau, vung tay giận', 'mc_giai_thich': 'mocap: nói chuyện, giải thích bằng tay', 'mc_chong_ghe': 'mocap: chống tay, nhìn trừng',
    'mc_quy_xuong': 'mocap: quỳ xuống', 'mc_uong': 'mocap: uống', 'mc_chi_tay': 'mocap: chỉ tay / vẫy', 'mc_dung_day': 'mocap: đứng dậy khỏi ghế',
    'mc_di_bo': 'mocap: đi bộ', 'mc_sai_buoc': 'mocap: sải bước',
    'mat_to': 'mắt mở to (×1,3, bật nảy)', 'nheo_mat': 'nheo mắt', 'toc_ru': 'tóc / sợi chỉ rũ xuống', 'toc_bat': 'tóc bật lò xo BOING',
    'toc_dung': 'tóc / sợi chỉ dựng đứng', 'run': 'run bần bật', 'phong': 'phồng to (phong3 = ×3)', 'xep': 'xẹp lại', 'nhay': 'nhảy bật lên',
    'lan_tron': 'cuộn tròn thành quả bóng lăn (chân tay / mắt / tóc thu vào)', 'truot': 'trượt nằm (xe trượt / băng / dây) — thân nằm di chuyển', 'nga_ngoi': 'ngã ngồi ra sau', 'nga': 'mốc cú ngã đứng → nằm (cần nam_den)', 'day': 'mốc đứng dậy nằm → đứng (cần nam_den: false)', 'cuoi_lan': 'cười lăn lắc lư', 'nhun_vai': 'nhún vai', 'xoay_tit': 'xoay tít tại chỗ (xoay_tit3 = 3 vòng)',
}
# TƯ THẾ CHỐT (pose-to-pose — Thomas & Johnston "The Illusion of Life", Williams "The Animator's Survival Kit"; anh 16/10/2026: "đang nằm mà đứng
# dậy phải có động tác đầy đủ, nhảy luôn thế là bật lên"): mỗi dòng (u = phần thời lượng động tác, nam = mức nằm 0 đứng … 1 nằm hẳn (âm = chúi tới
# quá đứng), bep = bẹp theo phương đứng (+ bẹp, − vươn), tay = góc hai tay (độ, − chống xuống, + vung lên)). Giữa hai tư thế chốt nhanh dần – chậm dần.
TU_THE = {
    'day': [(0, 1.0, 0, 0), (0.15, 1.05, 0.04, 10), (0.45, 0.5, 0.02, -40), (0.66, -0.08, 0.16, -45), (0.85, -0.02, -0.06, -5), (1.0, 0, 0, 0)],   # lấy đà · ngồi dậy chống tay · chúi tới ngồi xổm · đẩy lên vươn · lắng
    'nga': [(0, 0, 0, 0), (0.2, -0.06, 0, 35), (0.55, 0.6, -0.03, 50), (0.75, 1.0, 0.16, 20), (0.88, 0.96, -0.04, 5), (1.0, 1.0, 0, 0)],          # mất thăng bằng vung tay · đổ · chạm bàn bẹp · nảy · nằm yên
}
GIAY_TU_THE = {'day': 1.25, 'nga': 0.9}   # thời lượng mặc định (giây) — nhịp động tác không co giãn theo độ dài shot
def tu_the(ten, c):
    k = TU_THE[ten]; c = min(1.0, max(0.0, c))
    for (u0, *a0), (u1, *a1) in zip(k, k[1:]):
        if c <= u1:
            x = (c - u0) / (u1 - u0) if u1 > u0 else 1; x = x * x * (3 - 2 * x)
            return [a0[i] + (a1[i] - a0[i]) * x for i in range(3)]
    return list(k[-1][1:])

def doc_dong_tac(ds):
    out = []
    for x in ds:
        import re
        ten, _, mt = x.partition('@'); kq = re.match(r'^([a-z_]+?)(\d+(?:\.\d+)?)?$', ten); ten, so = (kq.group(1), kq.group(2) or '') if kq else (ten, '')
        if ten not in DONG_TAC: print('CANH BAO dong tac la', x); continue
        if mt: a_, _, b_ = mt.partition('-'); a_ = float(a_); b_ = float(b_) if b_ else min(1.0, a_ + 0.15)
        else: a_, b_ = 0.0, 1.0
        out.append((ten, a_, max(b_, a_ + 0.01), float(so) if so else None))
    return out

def dong_tac_luc(hd, t, r):
    """Giá trị các kênh diễn lúc t (0..1) từ danh sách động tác đã đọc."""
    em_ = lambda u: u * u * (3 - 2 * u)
    nay = lambda u: em_(u) + 0.12 * math.sin(math.pi * u) * (1 - u)   # tới đích có nảy nhẹ
    v = {'phong': 1.0, 'nhay': 0.0, 'lun': 0.0, 'nga': 0.0, 'lan': 0.0, 'run': 0.0, 'bep': 0.0, 'mat': 1.0, 'nheo': 1.0, 'toc_goc': 0.0, 'toc_lac': 0.0, 'toc_dai': 1.0, 'vai': 0.0, 'xoay': 0.0, 'bong': 0.0}
    for ten, a, b, so in hd:
        c = min(1.0, max(0.0, (t - a) / (b - a))); dang = a <= t <= b
        if ten == 'phong': v['phong'] *= 1 + ((so or 3) - 1) * nay(c)
        elif ten == 'xep': v['phong'] *= 1 - 0.18 * em_(c)
        elif ten == 'run' and dang: v['run'] = max(v['run'], 0.035)
        elif ten == 'nhay': v['nhay'] += 1.1 * 4 * c * (1 - c); v['bep'] += 0.08 * (1 - min(1, c / 0.12)) * (c > 0) + 0.08 * max(0, (c - 0.88) / 0.12)
        elif ten == 'nga_ngoi': v['nga'] += 22 * nay(c); v['lun'] += 0.25 * em_(c); v['bep'] += 0.06 * math.sin(math.pi * c)
        elif ten == 'cuoi_lan' and dang: v['lan'] += 18 * math.sin(2 * math.pi * 3 * c); v['nhay'] += 0.15 * abs(math.sin(2 * math.pi * 3 * c))
        elif ten == 'nhun_vai': v['vai'] += 0.18 * abs(math.sin(2 * math.pi * c)) * (c < 1)
        elif ten == 'mat_to': v['mat'] *= 1 + 0.3 * nay(c)
        elif ten == 'nheo_mat': v['nheo'] *= 1 - 0.45 * em_(c)
        elif ten == 'toc_ru': v['toc_goc'] += 75 * nay(c); v['toc_dai'] *= 1 - 0.15 * em_(c)
        elif ten == 'toc_bat': g = math.exp(-4 * c) * (c > 0); v['toc_lac'] += 22 * g * math.sin(6 * math.pi * c); v['toc_dai'] *= 1 + 0.45 * g * abs(math.sin(6 * math.pi * c))
        elif ten == 'lan_tron':   # 0..1 = mức thành bóng: cuộn vào trong 15 % đầu cửa sổ (hoặc đã là bóng nếu mở từ 0), bung ra 15 % cuối nếu kết trước 1
            l_ = max(0.04, (b - a) * 0.15)
            vao = 1.0 if a <= 0.001 else em_(min(1.0, max(0.0, (t - a) / l_)))
            ra_ = 1.0 if b >= 0.999 else 1 - em_(min(1.0, max(0.0, (t - (b - l_)) / l_)))
            if t >= a and (b >= 0.999 or t <= b): v['bong'] = max(v['bong'], vao * ra_)
        elif ten == 'xoay_tit': v['xoay'] += 360 * (so or 2) * em_(c)
        elif ten == 'toc_dung': v['toc_dai'] *= 1 + 0.25 * em_(c); v['toc_goc'] -= 10 * em_(c)
    return v

def dien_shot(s, sh, ra, giay=4.0, fps=12):
    """DIỄN CẢ SHOT trong Blender (anh 16/10/2026: "thêm khung chuyển động vật lý cho chúng để đồng bộ"): mỗi nhân vật gắn một KHUNG NEO (empty)
    chạy từ chỗ mở → chỗ kết trên MỘT trục thời gian (fps khung/giây, đúng nhịp stop-motion 12): đi trên bàn có nhịp nhún theo bước, bay lên
    thì nhanh dần chậm dần + lắc nhẹ, hướng mặt xoay dần; đồ đang CẦM gắn theo khung neo người cầm; đồ đứng yên giữ nguyên chỗ. Render cả clip
    (<ra>/f####.png) + in số khung của 5 khung khoá 0 · ¼ · ½ · ¾ · cuối (dòng 'KHOA i f') cho video nhiều khung. Máy đứng yên như máy shot."""
    dat_tuy_chon(set(sh.get('them') or []))
    than, objs = nhan_vat(sh); bpy.context.view_layer.update()
    cam = may(s, sh['may'], f"dien {sh['ma']}")
    N = max(2, int(round(giay * fps)))
    s.render.fps = fps; s.frame_start = 1; s.frame_end = N
    neo = {}
    for nv in sh.get('nhan_vat', []):
        ten = nv['ten']; X, Y, Z = nv['tam'][0], nv['tam'][1], (nv['tam'][2] if len(nv['tam']) > 2 else 0)
        e = bpy.data.objects.new(f'neo {ten}', None); s.collection.objects.link(e); e.location = Vector((X, Y, Z)) * CM
        bpy.context.view_layer.update()   # ma trận neo mới còn là đơn vị → nghịch đảo cha sai, nhân vật bị dời gấp đôi toạ độ (lỗi 16/10/2026)
        neo[ten] = (e, nv)
        for o in objs:
            if o.name == f'NV {ten}' or o.name.startswith(f'NV {ten}·'):
                mw = o.matrix_world.copy(); o.parent = e; o.matrix_parent_inverse = e.matrix_world.inverted(); o.matrix_world = mw
    bpy.context.view_layer.update()
    # CHÂN TAY: mỗi bên một KHỚP (empty) ở đỉnh chân / vai, trục x của khớp = trục ngang của nhân vật → quay quanh nó là đưa tới / lui. Phần mesh
    # mang vai 'chan' / 'ban chan' / 'tay' (mesh_that ghi) gắn vào khớp cùng bên; khối tạm không có vai thì đứng nguyên như trước.
    khop = {}
    for ten, (e, nv) in neo.items():
        h = math.radians(nv.get('huong', 0) or 0); ngang = Vector((math.cos(h), math.sin(h), 0)); nhom = {}
        for o in objs:
            if o.parent is not e or o.get('vai') not in ('chan', 'ban chan', 'tay'): continue
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; tam = sum(bb, Vector()) / 8
            ben = 1 if (tam - e.matrix_world.translation).dot(ngang) > 0 else -1
            nhom.setdefault(('tay' if o['vai'] == 'tay' else 'chan', ben), []).append((o, bb, tam))
        ds = []
        for (loai, ben), ps in nhom.items():
            truc = [x for x in ps if x[0]['vai'] != 'ban chan'] or ps   # khớp đặt theo ống chân / tay, bàn chân đi theo
            tam = sum((x[2] for x in truc), Vector()) / len(truc)
            P = bpy.data.objects.new(f'khop {ten} {loai} {ben}', None); s.collection.objects.link(P)
            P.location = Vector((tam.x, tam.y, max(v.z for x in truc for v in x[1]))); P.rotation_euler = (0, 0, h)
            bpy.context.view_layer.update(); P.parent = e; P.matrix_parent_inverse = e.matrix_world.inverted(); bpy.context.view_layer.update()
            for o, _, _ in ps:
                mw = o.matrix_world.copy(); o.parent = P; o.matrix_parent_inverse = P.matrix_world.inverted(); o.matrix_world = mw
            ds.append((P, loai, ben, h))
        khop[ten] = ds
    bpy.context.view_layer.update()
    # BỘ PHẬN DIỄN CẢM (thư viện động tác — xem DONG_TAC): mắt (vai mat / nguoi / lap lanh) co giãn tại chỗ; tóc / sợi chỉ (vai toc / chi xanh) gắn
    # một khớp ở GỐC (đáy hộp bao) để rũ / bật / dựng; trục x của khớp = trục ngang thân.
    mat_cua, toc_cua = {}, {}
    for ten, (e, nv) in neo.items():
        h = math.radians(nv.get('huong', 0) or 0)
        mat_cua[ten] = [(o, o.scale.copy()) for o in objs if o.get('vai') in ('mat', 'nguoi', 'lap lanh') and (o.parent is e)]
        ds = []
        for o in objs:
            if o.parent is not e or o.get('vai') not in ('toc', 'chi xanh'): continue
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; goc_ = Vector((sum(v.x for v in bb) / 8, sum(v.y for v in bb) / 8, min(v.z for v in bb)))
            P = bpy.data.objects.new(f'khop toc {ten}', None); s.collection.objects.link(P); P.location = goc_; P.rotation_euler = (0, 0, h)
            bpy.context.view_layer.update(); P.parent = e; P.matrix_parent_inverse = e.matrix_world.inverted(); bpy.context.view_layer.update()
            mw = o.matrix_world.copy(); o.parent = P; o.matrix_parent_inverse = P.matrix_world.inverted(); o.matrix_world = mw
            ds.append((P, h))
        toc_cua[ten] = ds
    bpy.context.view_layer.update()
    tc = tay_cam(sh)
    for ten, (e, nv) in neo.items():   # đồ đang cầm: neo gắn vào BÀN TAY người cầm (ma-nơ-canh — rig), không thì vào neo người cầm
        cam_ = nv.get('cam')
        if cam_ and cam_ in neo:
            cha = neo[cam_][0]
            if ten in tc and tc[ten][1] in ('p', 't'): cha = NGUOI[cam_][f"cotay_{tc[ten][1]}"]
            elif ten in tc and tc[ten][1] in NGUOI[cam_]: cha = NGUOI[cam_][tc[ten][1]]   # đồ đeo: theo khớp đeo
            elif ten in tc: cha = NGUOI[cam_]['nguc']
            mw = e.matrix_world.copy(); e.parent = cha; e.matrix_parent_inverse = cha.matrix_world.inverted(); e.matrix_world = mw
    # NGÔN NGỮ STOP-MOTION (anh 16/10/2026: "blender tạo chuyển động dạng stopmotion đã đúng chưa"), theo nghề Laika / Aardman:
    #   lấy đà + vượt rồi khựng (dien_k) · BOIL: mỗi khung nhân vật xê dịch li ti như tay người chỉnh, lông nhảy nhẹ (ngẫu nhiên CỐ ĐỊNH theo
    #   tên + số khung — render lại ra y hệt) · đất nặn bẹp nhẹ mỗi lần chân chạm đất. Biên độ: XV_BOIL (1 = mặc định, 0 = tắt boil).
    em = lambda t: t * t * (3 - 2 * t)   # nhanh dần – chậm dần
    def dien_k(t):
        if t < 0.1: return -0.025 * math.sin(math.pi * t / 0.1)   # lấy đà: lùi nhẹ trước khi đi
        u = (t - 0.1) / 0.9
        return em(u) + 0.04 * math.sin(math.pi * min(1, max(0, (u - 0.7) / 0.3)))   # vượt quá ~4 % rồi khựng về đúng chỗ kết
    boil = float(os.environ.get('XV_BOIL', '1'))
    import random
    for ten, (e, nv) in neo.items():
        if nv.get('cam') and nv['cam'] in neo: continue
        a = Vector(nv['tam'] + ([0] if len(nv['tam']) < 3 else [])); b = Vector((nv.get('den') or nv['tam']) + ([0] if len(nv.get('den') or nv['tam']) < 3 else []))
        h0 = nv.get('huong', 0) or 0; h1 = nv.get('huong_den', h0) or h0; dh = ((h1 - h0 + 180) % 360) - 180
        dai = (b.xy - a.xy).length; bay = b.z - a.z > 0.8; buoc = max(1, round(dai / 0.9)); di = dai > 0.4 and not bay and abs(b.z - a.z) < 0.3
        hat = sum(ord(c) * (i + 1) for i, c in enumerate(ten))
        hd = doc_dong_tac(nv.get('dien') or [])
        lan = any(x[0] == 'lan_tron' for x in hd)
        than = next((o for o in objs if o.parent is e and o.get('vai') == ten), None) if lan else None
        if than is not None: than['goc_sc'] = list(than.scale)
        bo_phan = [o for o in objs if lan and o.parent is e and o is not than] + [P for P, *_ in khop.get(ten, []) + toc_cua.get(ten, []) if lan]
        for o in bo_phan: o['goc_sc'] = list(o.scale)
        quang = 0.0; p_truoc = None
        doi_dang = None   # đứng ↔ nằm trong shot (nam → nam_den): trục ngang + độ dời giống nam_xuong, cỡ theo khối nhân vật mẫu
        if nv.get('nam_den') is not None and bool(nv.get('nam_den')) != bool(nv.get('nam')):
            km = (DL.get('nhan_vat_mau') or {}).get(ten) or {}; cw, cd_, ch = (km.get('co') or [1, 1, 2])[:3]
            ag = math.radians(h0); u_ = Vector((math.cos(ag), math.sin(ag), 0)); truoc_ = Vector((math.sin(ag), -math.cos(ag), 0))
            mac = [x for x in hd if x[0] == ('nga' if nv.get('nam_den') else 'day')]
            doi_dang = {'nga': bool(nv.get('nam_den')), 'u': u_, 'lech': (Vector((0, 0, cd_ / 2)) + truoc_ * (ch / 2)) * CM,
                        'cua': (mac[0][1], mac[0][2]) if mac else ((max(0.0, 0.85 - GIAY_TU_THE['nga'] / giay), 0.85) if nv.get('nam_den') else (0.1, min(1.0, 0.1 + GIAY_TU_THE['day'] / giay)))}
            lt = [x for x in hd if x[0] == 'lan_tron']
            if lt and not mac and lt[0][2] < 0.999: doi_dang['cua'] = (lt[0][2], min(1.0, lt[0][2] + GIAY_TU_THE['day'] / giay))   # bóng bung ra xong mới đứng dậy (#12)
        rb = random.Random(hat); chop = [rb.uniform(0.2, 0.45), rb.uniform(0.65, 0.9)]   # hai lần chớp mắt tự nhiên, lệch nhịp mỗi nhân vật
        for f in range(1, N + 1):
            t = (f - 1) / (N - 1); k = dien_k(t) if (dai > 0.4 or bay) else em(t); p = a.lerp(b, k)
            if di: p.z += 0.14 * abs(math.sin(math.pi * buoc * k))   # nhún theo bước
            lac = 0.0
            if bay: lac = 5 * math.sin(2 * math.pi * 2 * t); p.z += 0.08 * math.sin(2 * math.pi * 3 * t)   # bay: lắc + bồng bềnh nhẹ
            r = random.Random(hat * 1000 + f)
            p += Vector([r.uniform(-0.012, 0.012) * boil for _ in range(3)])   # boil: xê dịch ~0,1 mm mỗi khung
            q = [math.radians(r.uniform(-0.4, 0.4) * boil) for _ in range(3)]
            dt = dong_tac_luc(hd, t, r)   # {phong, nhay, lui, lan, run, nghieng...} theo thư viện
            p += Vector((0, 0, dt['nhay'] - dt['lun'])) + Vector([r.uniform(-1, 1) * dt['run'] for _ in range(3)])
            hh = math.radians(h0 + dh * k); ngang = Vector((math.cos(hh), math.sin(hh), 0)); toi = Vector((math.sin(hh), -math.cos(hh), 0))
            nghieng = (math.radians(8) * min(1.0, 4 * min(t, 1 - t)) if di else 0.0) - math.radians(dt['nga'])   # đi: chúi tới · ngã ngồi: ngả ra sau
            R = (Quaternion(ngang, nghieng) @ Quaternion(toi, math.radians(lac + dt['lan']) + q[1]) @ Quaternion((0, 0, 1), math.radians(dh * k + dt['xoay']) + q[2]) @ Quaternion((1, 0, 0), q[0]))
            e.rotation_mode = 'QUATERNION'
            cham = 1 - abs(math.sin(math.pi * buoc * k)) if di and 0 < t < 1 and ten not in NGUOI else 0.0   # 1 = chân vừa chạm đất (người thật không bẹp như đất nặn)
            bep = 0.035 * cham + dt['bep']; ph = dt['phong']
            Mt = Matrix.Translation(p * CM) @ R.to_matrix().to_4x4(); Pm = Matrix.Identity(4)
            if doi_dang:   # NGÃ / ĐỨNG DẬY trong shot = nội suy đúng phép nam_xuong (xoay 90° quanh trục ngang tại chân + dời thân lên mặt bàn)
                a_, b_ = doi_dang['cua']; nam_, bep_tt, tay_tt = tu_the('nga' if doi_dang['nga'] else 'day', (t - a_) / (b_ - a_))
                # dáng ở mức nằm L so với DÁNG ĐỨNG: T(lech·L) · R(−90°·L) (cùng phép nam_xuong khi L = 1); nhân vật dựng sẵn ở dáng mở (đứng hoặc nằm)
                dung_ve = Matrix.Identity(4) if doi_dang['nga'] else Matrix.Rotation(math.radians(90), 4, doi_dang['u']) @ Matrix.Translation(-doi_dang['lech'])
                Pm = Matrix.Translation(doi_dang['lech'] * nam_) @ Matrix.Rotation(math.radians(-90 * nam_), 4, doi_dang['u']) @ dung_ve
                Mt = Mt @ Pm; bep += bep_tt; dt['tay_tt'] = tay_tt
            if lan:   # QUẢ BÓNG LĂN: thân co về cầu (cùng thể tích) hạ xuống mặt bàn, chân tay / mắt / tóc thu vào, lăn đúng số vòng theo quãng
                kb = dt['bong']; km = (DL.get('nhan_vat_mau') or {}).get(ten) or {}; w_, d_, h_ = (km.get('co') or [1.7, 1.4, 2.6])[:3]
                rb = (w_ * d_ * h_) ** (1 / 3) / 2; tam_than = d_ / 2 if nv.get('nam') else h_ / 2 + 0.2   # tâm thân theo dáng lúc lăn (đang nằm thì thấp: nam_xuong đặt thân dày d trên mặt bàn)
                if p_truoc is not None: quang += (p - p_truoc).xy.length * kb
                p_truoc = p.copy(); huong_di = (b - a).xy.normalized() if (b - a).xy.length > 1e-6 else Vector((1, 0))
                truc_lan = Vector((-huong_di.y, huong_di.x, 0))
                C = Vector((0, 0, rb * CM))
                Mt = (Matrix.Translation(p * CM + C) @ Matrix.Rotation(quang / rb * kb, 4, truc_lan) @ Matrix.Translation(-C)
                      @ Matrix.Translation(Vector((0, 0, -(tam_than - rb) * kb * CM))) @ R.to_matrix().to_4x4() @ Pm)
                if than is not None:
                    g_ = Vector(than['goc_sc']); f_ = Vector((2 * rb / w_, 2 * rb / d_, 2 * rb / h_))
                    than.scale = Vector([g_[i] * (f_[i] ** kb) for i in range(3)]); than.keyframe_insert('scale', frame=f)
                for o in bo_phan: o.scale = Vector(o['goc_sc']) * max(0.001, 1 - kb); o.keyframe_insert('scale', frame=f)
            # bẹp / vươn theo phương ĐỨNG của thế giới tại chỗ chạm bàn (đúng cả khi đang nằm / đang đứng dậy) · phồng to theo thân
            Mt = Matrix.Translation(p * CM) @ Matrix.Diagonal((1 + bep / 2, 1 + bep / 2, 1 - bep, 1)) @ Matrix.Translation(-p * CM) @ Mt @ Matrix.Diagonal((ph, ph, ph, 1))
            lo, ro, sc_ = Mt.decompose(); e.location = lo; e.rotation_quaternion = ro; e.scale = sc_
            e.keyframe_insert('location', frame=f); e.keyframe_insert('rotation_quaternion', frame=f); e.keyframe_insert('scale', frame=f)
            if ten in NGUOI:   # NGƯỜI: pha bước theo QUÃNG ĐÃ ĐI (sải ~0,41 chiều cao) → chân không trượt; đứng yên thì giữ tư thế chốt
                n_ = NGUOI[ten]
                if di: ng().buoc(n_, (p - a).xy.length / (2 * 0.41 * n_['cao']))
                else: ng().tu_the(n_, n_.get('kieu', 'dung'))
                ng().ap_dien(n_, dien_hl(n_, nv, di), t, giay)   # rig: tư thế theo mã diễn (+ mocap thật), chồng lên dáng đứng / bước
                for kk in ng().KHOP_KEY: n_[kk].keyframe_insert('rotation_euler', frame=f)
                n_['hong'].keyframe_insert('location', frame=f)
            for o, sc in mat_cua.get(ten, []):   # mắt: chớp (2 khung) · mở to · nheo
                nham_ = 0.12 if any(abs(f - (1 + c * (N - 1))) < 1.01 for c in chop) else 1.0
                thu = max(0.001, 1 - dt['bong'])   # thành bóng: mắt thu vào
                o.scale = Vector((sc.x * dt['mat'] * thu, sc.y * dt['mat'] * thu, sc.z * dt['mat'] * dt['nheo'] * nham_ * thu)); o.keyframe_insert('scale', frame=f)
            for P, h in toc_cua.get(ten, []):   # tóc / sợi chỉ: rũ · bật lò xo · dựng
                thu = max(0.001, 1 - dt['bong']); P.rotation_euler = (math.radians(dt['toc_goc']), math.radians(dt['toc_lac']), h); P.scale = (thu, thu, dt['toc_dai'] * thu)
                P.keyframe_insert('rotation_euler', frame=f); P.keyframe_insert('scale', frame=f)
            for P, loai, ben, h in khop.get(ten, []):
                if bay: g_ = math.radians(10 if loai == 'chan' else 6) * math.sin(2 * math.pi * 1.5 * t + ben * 0.6)   # bay: chân tay lủng lẳng
                elif dai > 0.4: g_ = math.radians(24 if loai == 'chan' else 14) * math.sin(math.pi * buoc * k) * ben * (1 if loai == 'chan' else -1)   # bước luân phiên, tay ngược chân
                else: g_ = 0.0
                if loai == 'tay' and dt.get('tay_tt'): g_ += math.radians(dt['tay_tt'])   # tư thế chốt: tay chống bàn khi đứng dậy · vung khi ngã
                P.rotation_euler = (g_, 0, h); P.keyframe_insert('rotation_euler', frame=f)
                if loai == 'tay':   # nhún vai: hai tay nhấc lên
                    if 'goc_tay' not in P: P['goc_tay'] = list(P.location)
                    P.location = Vector(P['goc_tay']) + Vector((0, 0, dt['vai'] * CM)); P.keyframe_insert('location', frame=f)
    # MÁY CHẠY (duong-may.ts › duongMay, số nghề may_di): mở → kết theo tốc độ (nhanh = xong trong 30 % đầu như crash zoom), ống kính đổi theo
    # (zoom), nét tính lại từng khung theo chỗ máy. Cầm tay: lắc chậm + run từng khung (người cầm máy thở), biên độ theo khoảng cách máy.
    chay = sh['may'].get('chay')
    if chay and chay.get('che'): print('CANH BAO duong nhin bi che boi', chay['che'], '— dat lai may shot', sh.get('so'))
    if chay:
        d0, n0, l0 = Vector(sh['may']['dat']), Vector(sh['may']['nhin']), sh['may']['ong_kinh']
        d1, n1, l1 = Vector(chay['dat']), Vector(chay['nhin']), chay['ong_kinh']
        bpy.context.view_layer.update()   # ma trận đồ vật mới trước khi đo hộp bao (không thì hộp nằm ở gốc, lưới không bắt được gì)
        vat_dung = []   # hộp bao (cm) của đồ vật nhô lên khỏi mặt bàn (bỏ nhân vật / mặt phẳng)
        for o in bpy.data.objects:
            if o.type != 'MESH' or o.hide_render or o.name.startswith(('NV ', 'L~')): continue
            bb = [o.matrix_world @ Vector(c) / CM for c in o.bound_box]
            mn = Vector([min(v[i] for v in bb) for i in range(3)]); mx_ = Vector([max(v[i] for v in bb) for i in range(3)])
            if mx_.z > 0.6 and (mx_ - mn).length < 200: vat_dung.append((o.name, mn, mx_))
        kc = (d0 - n0).length; rr = random.Random(4242); pha = [rr.uniform(0, 6.283) for _ in range(6)]
        for f in range(1, N + 1):
            t = (f - 1) / (N - 1); k = em(min(1.0, t / 0.3) if chay.get('toc') == 'nhanh' else t)
            dp = d0.lerp(d1, k); npt = n0.lerp(n1, k)
            if chay.get('rung'):
                gi = t * giay; r_ = random.Random(9000 + f)
                dp = dp + Vector([0.012 * kc * math.sin(2 * math.pi * (0.5 + 0.2 * i) * gi + pha[i]) + r_.uniform(-0.002, 0.002) * kc for i in range(3)])
                npt = npt + Vector([0.02 * kc * math.sin(2 * math.pi * (0.4 + 0.15 * i) * gi + pha[3 + i]) for i in range(3)])
            cam.location = dp * CM; cam.rotation_euler = (npt * CM - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = l0 + (l1 - l0) * k
            cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f); cam.data.keyframe_insert('lens', frame=f)
            for o in vat_dung:   # lưới an toàn: máy chui vào đồ vật trên set → báo (dữ liệu / đường máy phải sửa, không render lặng im)
                mn, mx_ = o[1], o[2]
                if all(mn[i] < dp[i] < mx_[i] for i in range(3)): print('CANH BAO may xuyen', o[0], 'khung', f); break
            lay_net(cam, sh, dp * CM); cam.data.dof.keyframe_insert('focus_distance', frame=f); cam.data.dof.keyframe_insert('aperture_fstop', frame=f)
    if boil:   # lông boil: độ rối sợi đổi nhẹ mỗi khung (như lông thật bị tay chạm giữa hai lần chụp)
        for st in {ps.settings for o in objs for ps in getattr(o, 'particle_systems', [])}:
            r1, re_ = st.roughness_1, st.roughness_endpoint; r = random.Random(len(st.name) * 97)
            for f in range(1, N + 1):
                st.roughness_1 = r1 * (1 + r.uniform(-0.3, 0.3) * boil); st.roughness_endpoint = re_ * (1 + r.uniform(-0.3, 0.3) * boil)
                st.keyframe_insert('roughness_1', frame=f); st.keyframe_insert('roughness_endpoint', frame=f)
    s.frame_set(1); anh_sang_mau(s, sh, True)
    # BỘ DỰNG (anh 16/10/2026: "mỗi shot 11 phút — tối ưu kiểu gì"): iMac M4 GPU 8 nhân, Cycles ~12,5 s/khung 720p. XV_MAY=eevee → EEVEE (dựng thời
    # gian thực, nhanh hơn hàng chục lần, đủ cho bản xem); mặc định Cycles nhưng giữ dữ liệu cảnh giữa các khung (không dựng lại lông / BVH mỗi
    # khung), lấy mẫu thích ứng, bớt nảy sáng — cảnh tối nhỏ không cần 12 lần nảy.
    if os.environ.get('XV_MAY') == 'eevee':
        s.render.engine = 'BLENDER_EEVEE'; ev = s.eevee; ev.taa_render_samples = int(os.environ.get('XV_MAU', '32'))
        for k_, v_ in (('use_raytracing', True), ('use_shadows', True), ('use_volumetric_shadows', False)):
            if hasattr(ev, k_): setattr(ev, k_, v_)
    else:
        s.render.engine = 'CYCLES'; s.cycles.samples = int(os.environ.get('XV_MAU', '32')); s.cycles.use_denoising = True
        s.cycles.use_adaptive_sampling = True; s.cycles.adaptive_threshold = 0.03; s.render.use_persistent_data = True
        s.cycles.max_bounces = 6; s.cycles.diffuse_bounces = 2; s.cycles.glossy_bounces = 2; s.cycles.transmission_bounces = 6
        bat_gpu(s)
    if not chay: lay_net(cam, sh)
    s.view_settings.view_transform = 'AgX'
    # 1080×1920 (XV_RONG): model video nhận khung ≥ 720p — khung 540 bị phóng lên thành mềm.
    rong = int(os.environ.get('XV_RONG', '1080')); s.render.resolution_x, s.render.resolution_y = rong, rong * 16 // 9
    if os.environ.get('XV_THU_KHUNG'): s.frame_start = s.frame_end = int(os.environ['XV_THU_KHUNG'])   # thử nét: một khung
    fm = s.render.image_settings; fm.file_format = 'PNG'; fm.color_mode = 'RGB'
    s.render.filepath = f"{ra}/f"; bpy.ops.render.render(animation=True)
    for i, t in enumerate((0, 0.25, 0.5, 0.75, 1)):
        f = 1 + round(t * (N - 1)); print('KHOA', i, f)
    print('XONG dien', sh['ma'], N, 'khung')

if os.environ.get('XV_DIEN'):   # đường riêng: diễn + render cả shot (shot đầu tiên trong tệp đầu vào)
    dien_shot(s, DL['shot'][0], RA, float(os.environ.get('XV_GIAY', '4'))); sys.exit(0)
if os.environ.get('XV_BANG_TI_LE'):   # đường riêng: chỉ render bảng tỉ lệ nhân vật
    bang_ti_le(s, RA); sys.exit(0)
if os.environ.get('XV_TOAN_CANH'):   # đường riêng: chỉ render toàn cảnh từng cảnh (đầu vào = tệp json danh sách cảnh)
    toan_canh(s, json.load(open(os.environ['XV_TOAN_CANH'], encoding='utf-8')), RA); sys.exit(0)
def ngam_lai(s, cam, sh, khoi, ket=False):
    """Điểm nhìn mới (cm) khi máy đặt tay trượt chủ thể đầu tiên (sh['bat_buoc'][0]), None nếu chủ thể còn trong khung. Món = tâm hộp; người = MẶT
    (đầu nhích về phía mặt quay — `huong`/`huong_den` lúc kết) khi ống ≥ 60 mm, ngực khi rộng hơn. Khung KẾT kiểm chặt hơn (mặt trong 0,2–0,8 bề
    ngang): máy đẩy vào gần thì khung dọc 9:16 hẹp, mặt quay nghiêng trôi ra mép (#24 kết chỉ còn tai + gáy Thần)."""
    from bpy_extras.object_utils import world_to_camera_view
    cn = sh['bat_buoc'][0]; dich = None; bpy.context.view_layer.update()
    if cn in NGUOI:
        n_ = NGUOI[cn]
        if cam.data.lens >= 60:
            v_nv = next((v for v in sh.get('nhan_vat', []) if v.get('ten') == cn), {})
            h = math.radians((v_nv.get('huong_den', v_nv.get('huong', 0)) if ket else v_nv.get('huong', 0)) or 0)
            dich = n_['dau'].matrix_world.translation + Vector((0.5 * n_['L']['dau'] * CM * math.sin(h), -0.5 * n_['L']['dau'] * CM * math.cos(h), 0.6 * n_['L']['dau'] * CM))
        else: dich = n_['nguc'].matrix_world.translation
    else:
        mo = [o for o in khoi if getattr(o, 'type', '') == 'MESH' and (o.name == f'NV {cn}' or o.name.startswith(f'NV {cn}·'))]
        if mo: dich = sum((o.matrix_world @ Vector(c) for o in mo for c in o.bound_box), Vector()) / (8 * len(mo))
    if dich is None: return None
    v_ = world_to_camera_view(s, cam, dich); bien = 0.2 if ket else 0.12
    if bien < v_.x < 1 - bien and 0.12 < v_.y < 0.88 and v_.z > 0: return None
    return [round(x / CM, 1) for x in dich]

kiem = {}; giai = {}; thay = {}; di = {}; mat_na = {}; xuyen = {}; lop = {}; ket_dong = {}; LECH_NHIN = {}
for sh in ([] if CHI_MB else shots):
    dat_tuy_chon(set(sh.get('them') or []))
    dat_khai = list(sh['may']['dat'])   # máy KHAI (trước kẹp / bộ giải) — đường máy chay tính từ chỗ này, máy dời bao nhiêu thì chỗ kết dời theo bấy nhiêu
    nv, nv_het = nhan_vat(sh)
    _k = trong_phong(sh['may']['dat'])   # máy khai / tự đặt ra ngoài phòng (trên trần, ngoài sàn) → kẹp vào trong, ghi lại như máy đã giải
    if [round(a, 1) for a in _k] != [round(a, 1) for a in sh['may']['dat']]: sh['may']['dat'] = _k; giai[sh['ma']] = {'dat': _k, 'nhin': sh['may']['nhin']}
    cam = may(s, sh['may'], f"cam {sh['ma']}")
    nv_kiem = nv + vat_chu_the(sh)
    k = kiem_hinh_hoc(s, cam, sh, nv_kiem)
    if sh.get('giai') and (hong(k) or sai_truc(sh, sh['may']['dat']) or chan_la(s, cam, sh, nv_kiem) or thieu_nhac(s, cam, sh, nv_kiem)):
        _, may_moi, k = giai_may(s, cam, sh, nv_kiem)   # KHÔNG đặt tên `dat` — trùng hàm dat() ở trên, đè mất hàm (lỗi 14/10/2026)
        giai[sh['ma']] = {'dat': may_moi, 'nhin': sh['may']['nhin']}; sh['may']['dat'] = may_moi
    # NGẮM LẠI máy đặt tay khi trượt chủ thể (18/10/2026: khung xương đổi theo người thật MPFB → máy toạ độ cũ của #9 #24 #25 ngắm vào chỗ cổ tay / đầu
    # CŨ): giữ chỗ đặt máy, chỉ xoay đầu máy về chủ thể đầu tiên — món (tâm hộp) hoặc người (ĐẦU khi ống ≥ 60 mm, ngực khi rộng hơn).
    if not sh.get('giai') and (sh.get('bat_buoc') or []):
        nhin_moi = ngam_lai(s, cam, sh, nv_het + nv)
        if nhin_moi:
            LECH_NHIN[sh['ma']] = [a_ - b_ for a_, b_ in zip(nhin_moi, sh['may']['nhin'])]; dat_may(cam, sh['may']['dat'], nhin_moi)
            sh['may']['nhin'] = nhin_moi; giai[sh['ma']] = {'dat': sh['may']['dat'], 'nhin': nhin_moi}; k = kiem_hinh_hoc(s, cam, sh, nv_kiem)
    # ĐẦU CHẮN GIỮA MÁY VÀ CHỦ THỂ (POV từ mắt nhân vật, #2 nhìn xuống vết cà phê trên ngực): đầu / tóc người thật nằm gần máy hơn điểm nhìn và gần tia
    # nhìn (< 25°) → cắt gần (clip_start) qua khỏi đầu, không cắt tới chủ thể.
    co_mat = {v_['ten'] for v_ in sh.get('nhan_vat', [])}; nh_ = Vector(sh['may']['nhin']) * CM - cam.location; d_dich = nh_.length
    cat = [ (h_ - cam.location).length for t in co_mat if t in NGUOI and NGUOI[t].get('dau') and NGUOI[t]['dau'].name in bpy.data.objects
            for h_ in [NGUOI[t]['dau'].matrix_world.translation + Vector((0, 0, 0.5 * NGUOI[t]['L']['dau'] * CM))]
            if (h_ - cam.location).length < 0.8 * d_dich and (h_ - cam.location).angle(nh_, 0) < math.radians(25) ]
    if cat: cam.data.clip_start = min(max(cat) + 0.14, d_dich - 0.05)
    kiem[sh['ma']] = k; DA_GIAI[sh['ma']] = list(sh['may']['dat'])
    # XUYÊN NHAU ở khung mở: mỗi đạo cụ đang hiện với người / đạo cụ / đồ set — lún > 1 cm thì ghi cho cổng (cầm thì người cầm bỏ bàn tay)
    xy_ = []
    for v_ in sh.get('nhan_vat', []):
        if v_.get('an') or (DL['nhan_vat_mau'].get(v_['ten']) or {}).get('hinh') == 'nguoi': continue
        mon = [o for o in nv_het if o.type == 'MESH' and (o.name == f"NV {v_['ten']}" or o.name.startswith(f"NV {v_['ten']}·")) and '·tran' not in o.name and not o.hide_render]
        lun, ten_b = do_lun(mon, vat_can(sh, v_['ten'], v_.get('cam')))
        if lun > 1.0: xy_.append(f"{v_['ten']} xuyên vào {ten_b.replace('NG ', '').split('.')[0].replace('NV ', '').split('·')[0]} {round(lun, 1)} cm")
    if xy_: xuyen[sh['ma']] = xy_
    thay[sh['ma']] = nhin_thay(s, cam, sh, nv_kiem)
    # ẢNH RA (anh 15/10/2026: "render 30+ shot sao ra 140 ảnh?"): chỉ KHUNG MÀU (JPEG) — ảnh số 1 của keyframe. Khung xám chỉ render khi máy không
    # có OpenGL (không làm được khung màu); bản đồ độ sâu bỏ hẳn (thử Flux depth đã loại). Cổng 3D kiểm bằng số đo tia, không cần ảnh.
    co_mau = ve_mau(s, sh, f"{RA}/{sh['ma']}-mau.jpg")
    if co_mau:
        ve_xuong(s, sh, cam, f"{RA}/{sh['ma']}-xuong.png")   # khung xương OpenPose (ControlNet dáng) — chỉ khi có người trong khung
        ve_sau(s, sh, cam, f"{RA}/{sh['ma']}-sau.png")   # độ sâu: người = thân liền
        _lop = ve_lop(s, sh, cam, f"{RA}/{sh['ma']}")   # shot ≥ 2 người: nền + từng người (ghép từng người)
        if _lop: lop[sh['ma']] = _lop
        mn = ve_mat_na(s, sh, cam, f"{RA}/{sh['ma']}")   # mặt nạ ghép đè / sửa vùng
        if mn: mat_na[sh['ma']] = mn
    else:
        s.view_layers[0].material_override = None; s.cycles.samples = 10; s.cycles.use_denoising = True; may_ve(s, True)
        s.render.filepath = f"{RA}/{sh['ma']}-xam.png"; bpy.ops.render.render(write_still=True)
    # CHUYỂN ĐỘNG: chiếu chỗ mở / chỗ kết của từng món lên khung (0..1, gốc trên-trái) → studio viết câu chuyển động cho video từ số này;
    # shot có món di chuyển / quay thì render thêm khung màu ở chỗ KẾT → keyframe kết → video nhận ảnh đầu + ảnh cuối.
    from bpy_extras.object_utils import world_to_camera_view
    def chieu(objs):
        bpy.context.view_layer.update(); out = {}
        for o in objs:
            c = sum((o.matrix_world @ Vector(b) for b in o.bound_box), Vector()) / 8; v = world_to_camera_view(s, cam, c)
            out[ten_vat(o)] = [round(v.x, 3), round(1 - v.y, 3)]
        return out
    tu = chieu(nv)
    for o in nv_het: bpy.data.objects.remove(o, do_unlink=True)
    # CÚ MÁY LIỀN MẠCH cần khung kết (duong-may.ts › chay.ket — chuyển chủ thể / cung): khung cuối khác hẳn khung mở dù không ai đi → máy đặt ở chỗ KẾT
    # của đường máy rồi render khung màu kết (keyframe kết), khung giữa đặt máy ở nửa đường. Xong trả máy về chỗ mở.
    # STORYBOARD ĐẦU → KẾT (anh 18/10/2026: "sinh bản 3D có đầu và kết thì nhìn rõ từng shot"): MỌI shot có khung màu đều dựng khung KẾT — người ở
    # chỗ / dáng / nét mặt cuối shot, máy ở cuối MỌI đường máy (đẩy vào, zoom, cung…). ket_dong = shot thật sự đổi khung (có người đi / quay, hoặc cú
    # máy liền mạch) → chỉ những shot này mới cần keyframe KẾT (tốn tiền) + khung giữa; shot khác khung kết chỉ để xem.
    chay_ = sh['may'].get('chay') if (sh['may'].get('chay') or {}).get('dat') else None
    dong = bool((sh['may'].get('chay') or {}).get('ket')) or any(x.get('den') or x.get('huong_den') is not None for x in sh.get('nhan_vat', []))
    ket_dong[sh['ma']] = dong
    def may_tai(t):
        if not chay_: return
        d0, n0 = Vector(sh['may']['dat']), Vector(sh['may']['nhin']); d1, n1 = Vector(chay_['dat']) + (d0 - Vector(dat_khai)), Vector(chay_['nhin']) + Vector(LECH_NHIN.get(sh['ma'], (0, 0, 0)))   # máy đã ngắm lại ở khung mở → khung kết lệch theo
        dat_may(cam, list(d0.lerp(d1, t)), list(n0.lerp(n1, t))); cam.data.lens = sh['may']['ong_kinh'] + (chay_['ong_kinh'] - sh['may']['ong_kinh']) * t
    if co_mau or dong:
        nk, nk_het = nhan_vat(sh, ket=True)
        may_tai(1.0)
        if not sh.get('giai') and (sh.get('bat_buoc') or []) and not (chay_ and chay_.get('ket')):   # khung KẾT: người ở dáng / hướng cuối, máy cuối đường máy → ngắm lại; cú CHUYỂN chủ thể (chay.ket, #9 cổ tay → Hạ) thì chủ thể kết là người khác, giữ nguyên
            nk_moi = ngam_lai(s, cam, sh, nk_het + nk, ket=True)
            if nk_moi: dat_may(cam, [x / CM for x in cam.location], nk_moi)
        den_ = chieu(nk)
        di[sh['ma']] = [{'ten': t, 'tu': tu[t], 'den': den_.get(t, tu[t])} for t in tu]
        ve_mau(s, sh, f"{RA}/{sh['ma']}-mau-ket.jpg")
        for o in nk_het: bpy.data.objects.remove(o, do_unlink=True)
        if MESH_THAT and dong:   # khung GIỮA (t = 0,5): khung khoá thứ ba cho video nhiều khung — giữ dây cáp / mặt nhân vật khỏi trôi giữa clip (#23)
            may_tai(0.5); ng_, ng_het = nhan_vat(sh, ket=0.5); ve_mau(s, sh, f"{RA}/{sh['ma']}-mau-giua.jpg")
            for o in ng_het: bpy.data.objects.remove(o, do_unlink=True)
        may_tai(0.0)
    else: di[sh['ma']] = [{'ten': t, 'tu': tu[t], 'den': tu[t]} for t in tu]

dat_tuy_chon({t for sh in shots for t in (sh.get('them') or [])})   # mặt bằng: đồ tuỳ chọn hiện khi có shot dùng nó
# MẶT BẰNG nhìn thẳng từ trên: bộ set + máy của từng shot (nón đỏ chỉ hướng nhìn) + ĐƯỜNG ĐI của từng nhân vật qua cả tập
# (anh 14/10/2026: "bản 3D phải thể hiện được sự liền mạch về chuyển động, vị trí của mọi nhân vật"): nối chỗ mở → chỗ kết của từng shot
# theo thứ tự, mỗi nhân vật một màu, số shot ở chỗ mở. Đường gãy vọt xa = đứt mạch (cổng lienMachTap bắt bằng số; ở đây để mắt người duyệt).
duong = {}
for sh in sorted([x for x in shots if x.get('so')], key=lambda x: x['so']):
    d = Vector(sh['may']['nhin']) - Vector(sh['may']['dat']); d.z = 0; d.normalize()
    bpy.ops.mesh.primitive_cone_add(radius1=1.0 * CM, depth=2.5 * CM, location=(Vector(sh['may']['dat']) * CM) + Vector((0, 0, 0.06)))
    c = bpy.context.object; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); dat(c, mau('#ff2d55', 3), f"may {sh['ma']}")
    for nv in sh.get('nhan_vat', []):
        dd = duong.setdefault(nv['ten'], [[]])
        # Khai nhảy (cắt thời gian / đi ngoài khung) hoặc đang được cầm → NGẮT nét: không vẽ một đường giả xuyên bàn giữa hai chỗ.
        if (sh.get('nhay') or nv.get('nhay') or nv.get('cam')) and dd[-1]: dd.append([])
        ds = dd[-1]
        for p, nhan in ((nv['tam'], f"{sh['so']}"), (nv.get('den'), None)):
            if p is None: continue
            ds.append((p[0], p[1], 0.6 + 0.02 * len(duong)))
            if nhan:
                t = bpy.data.curves.new(f"t{sh['ma']}{nv['ten']}", 'FONT'); t.body = nhan; t.size = 1.8 * CM
                to = bpy.data.objects.new(f"t{sh['ma']}{nv['ten']}", t); s.collection.objects.link(to); to.location = (Vector((p[0], p[1], 1)) + Vector((0.6, 0.6, 0))) * CM
                t.materials.append(mau(DL['nhan_vat_mau'][nv['ten']]['mau'], 4))
for ten, doan in duong.items():
    m = DL['nhan_vat_mau'][ten]['mau']
    for k, ds in enumerate(x for x in doan if x):
        gon = [ds[0]] + [p for i, p in enumerate(ds[1:]) if (Vector(p) - Vector(ds[i])).length > 0.05]
        for p in gon:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5 * CM, location=Vector(p) * CM); dat(bpy.context.object, mau(m, 3), f"dd {ten}")
        if len(gon) > 1: khoi({'hinh': 'day', 'diem': [list(p) for p in gon], 'ban_kinh': 0.25, 'mau': m, 'sang': 3, 'bac': 1}, f"duong {ten} {k}")
# Khung mặt bằng tự ôm cả bộ set theo số khai (tam/co, nhóm thì gốc + phần) — trước đây tìm vật tên 'Mặt bàn' (bộ bàn Tango) nên bộ set
# phòng thật (tổng tài 17/10/2026: văn phòng, sảnh, phòng họp) chết StopIteration ở mọi lượt render. Có 'Mặt bàn' thì vẫn ôm đúng nó như cũ.
def hop_set():
    ban = next((v for v in DL['vat'] if v['ten'] == 'Mặt bàn'), None)
    if ban: return ban['tam'][0], ban['tam'][1], ban['co'][0], ban['co'][1]
    xs, ys = [], []
    for v in DL['vat']:
        for p in (v['phan'] if 'phan' in v else [v]):
            if not p.get('tam') or not p.get('co'): continue
            gx, gy = (v['goc'][0] + p['tam'][0], v['goc'][1] + p['tam'][1]) if 'phan' in v else (p['tam'][0], p['tam'][1])
            xs += [gx - p['co'][0] / 2, gx + p['co'][0] / 2]; ys += [gy - p['co'][1] / 2, gy + p['co'][1] / 2]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(xs) - min(xs), max(ys) - min(ys)
bx, by, bw, bd = hop_set()
cd = bpy.data.cameras.new('tren'); cd.type = 'ORTHO'; cd.ortho_scale = max(bw, bd * 1200 / 800) * CM * 1.08
o = bpy.data.objects.new('tren', cd); s.collection.objects.link(o); o.location = (bx * CM, by * CM, max(3, 4 * CM * 100)); s.camera = o
cd.clip_end = 1000
for v in [x for x in bpy.data.objects if x.name == 'Trần' or x.name.startswith('Trần ') or x.name.startswith('Đèn trần')]: v.hide_render = True   # mặt bằng nhìn xuống: trần che hết
s.render.resolution_x, s.render.resolution_y = 1200, 800; s.cycles.samples = 8; s.cycles.use_denoising = True; may_ve(s, True)
if BO_MB: s.render.resolution_x, s.render.resolution_y = 32, 24
for v in [x for x in bpy.data.objects if x.name.startswith('Tường')]: v.hide_render = True
s.render.filepath = f"{RA}/mat-bang.png"; bpy.ops.render.render(write_still=True)
json.dump(kiem, open(f'{RA}/kiem.json', 'w'), ensure_ascii=False, indent=1)
json.dump(giai, open(f'{RA}/giai.json', 'w'), ensure_ascii=False, indent=1)
json.dump(thay, open(f'{RA}/thay.json', 'w'), ensure_ascii=False, indent=1)
json.dump(di, open(f'{RA}/di.json', 'w'), ensure_ascii=False, indent=1)
json.dump(xuyen, open(f'{RA}/xuyen.json', 'w'), ensure_ascii=False, indent=1)
json.dump(lop, open(f'{RA}/lop.json', 'w'), ensure_ascii=False, indent=1)
json.dump(ket_dong, open(f'{RA}/ket_dong.json', 'w'), ensure_ascii=False, indent=1)
json.dump(mat_na, open(f'{RA}/mat_na.json', 'w'), ensure_ascii=False, indent=1)
print('KIEM', json.dumps(kiem, ensure_ascii=False))
print('XONG', [sh['ma'] for sh in shots])
