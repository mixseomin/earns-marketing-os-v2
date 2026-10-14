# BỘ SET 3D (previs) — 14/10/2026, anh: "cần giải pháp kỹ thuật tuyệt đối về bối cảnh và bố trí đồ đạc".
# Mỗi keyframe trước đây do mô hình ảnh TỰ VẼ LẠI cả căn phòng từ chữ → màn hình lúc song song lúc quay lưng, nhân vật nhảy trước/sau bàn phím.
# Ở đây bộ set là DỮ LIỆU (toạ độ cm trong scripts/du-lieu/bo-set/<set>.json): dựng bằng khối hình học, đặt máy ảo theo từng shot,
# render ra (1) khung xám — bố trí đúng tuyệt đối, (2) bản đồ độ sâu — khung xương cho mô hình ảnh, (3) mặt bằng nhìn từ trên có vị trí máy.
# Chạy trên box (Blender không giao diện):
#   blender -b --factory-startup -P apps/xuong-video/scripts/bo-set/dung-set.py -- <set.json> <thư mục ra> [ma shot,...]
import bpy, json, math, sys, os
from mathutils import Vector, Euler

arg = sys.argv[sys.argv.index('--') + 1:]
DL = json.load(open(arg[0], encoding='utf-8'))
RA = arg[1]
CHI = set(arg[2].split(',')) if len(arg) > 2 and arg[2] else None
os.makedirs(RA, exist_ok=True)
CM = 0.01  # Blender tính mét
CHI_MB = os.environ.get('XV_CHI_MAT_BANG') == '1'   # chỉ vẽ mặt bằng (lượt song song riêng), bỏ render từng shot
BO_MB = os.environ.get('XV_BO_MAT_BANG') == '1'     # phần song song: mặt bằng vẽ tí hon cho nhanh (lượt mb vẽ bản đủ)
NHANH = os.environ.get('XV_NHANH') == '1'   # có OpenGL (Xvfb trên box) → khung xám + mặt bằng bằng Workbench; độ sâu vẫn Cycles 1 mẫu

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

def khoi(p, ten, goc=(0, 0), xoay=0):
    """Một khối: tam = (x, y, z ĐÁY) tương đối với gốc nhóm; co = (rộng x, sâu y, cao z)."""
    h = p['hinh']; m = mau(p['mau'], p.get('sang', 0))
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
    o = bpy.context.object
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
    if chat == 'go':
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
    cam = s.camera
    if cam:
        p = cam.matrix_world.translation / CM
        den('L~phu', 'AREA', [p.x, p.y, p.z + 12], (0.75, 0.82, 1.0), 4, tuple(cam.rotation_euler), 40)

def ve_mau(s, sh, ra):
    """Render khung màu bằng EEVEE (chỉ khi có OpenGL — Xvfb trên box). Trả True nếu có ảnh."""
    if not NHANH: return False
    nen = tuple(s.world.node_tree.nodes['Background'].inputs['Color'].default_value); sm = s.world.node_tree.nodes['Background'].inputs['Strength'].default_value
    anh_sang_mau(s, sh, True)
    s.render.engine = 'BLENDER_EEVEE'; s.eevee.taa_render_samples = 12; s.view_settings.view_transform = 'AgX'
    # JPEG 88: nhẹ 5–8 lần PNG, đủ nét cho mô hình ảnh (anh 15/10/2026: "đẩy nhiều ảnh thì phải nén")
    fm = s.render.image_settings; fm.file_format = 'JPEG'; fm.quality = 88; fm.color_mode = 'RGB'
    s.render.filepath = ra; bpy.ops.render.render(write_still=True)
    fm.file_format = 'PNG'; fm.color_mode = 'RGBA'
    anh_sang_mau(s, sh, False); s.view_settings.view_transform = 'Standard'
    s.world.node_tree.nodes['Background'].inputs['Color'].default_value = nen; s.world.node_tree.nodes['Background'].inputs['Strength'].default_value = sm
    return True

def dung_set():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for v in DL['vat']:
        if 'phan' in v:
            for i, p in enumerate(v['phan']): khoi(p, f"{v['ten']} {i}", v['goc'], v.get('xoay', 0))
        else: khoi(v, v['ten'])
    for v in DL['vat']:   # vật liệu thật cho khung màu (Workbench vẫn đọc màu phẳng diffuse_color)
        if not v.get('chat'): continue
        for o in [x for x in bpy.data.objects if x.name == v['ten'] or x.name.startswith(v['ten'] + ' ')]: chat_lieu(o, v['chat'], v.get('mau') or (v.get('phan') or [{}])[0].get('mau', '#888888'))
    s = bpy.context.scene
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.25, 0.26, 0.3, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 2)); bpy.context.object.data.energy = 3
    bpy.context.object.rotation_euler = Euler((math.radians(50), math.radians(-20), math.radians(20)))
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 10; s.cycles.use_denoising = True   # khung xám là khối phẳng màu: 10 mẫu + khử nhiễu ≈ 24 mẫu thô, nhanh ~2,5×
    s.render.resolution_x, s.render.resolution_y = 540, 960
    s.view_settings.view_transform = 'Standard'
    return s

TUY_CHON = {v['ten'] for v in DL['vat'] if v.get('tuy_chon')}
def dat_tuy_chon(co):
    """Đồ TUỲ CHỌN (laptop lúc có lúc không): chỉ hiện ở shot khai may_3d.them; ẩn cả render lẫn tia kiểm (hide_viewport → ra khỏi depsgraph)."""
    for o in bpy.data.objects:
        t = o.name.rsplit(' ', 1)[0] if o.name.rsplit(' ', 1)[0] in TUY_CHON else o.name
        if t in TUY_CHON: o.hide_viewport = o.hide_render = t not in co
    bpy.context.view_layer.update()

def nhan_vat(sh, ket=False):
    """Khối nhân vật / đạo cụ của shot ở chỗ MỞ shot (tam), quay theo huong (độ, 0 = mặt nhìn về phía người ngồi −y, 90 = nhìn sang phải +x).
    Khối có `mat` → gắn hai mắt (lòng trắng + con ngươi) ở mặt trước: khung xám cho thấy nhân vật NHÌN ĐI ĐÂU, không chỉ đứng ở đâu.
    `phan` = các phần thêm (chân, tay, nắp…) toạ độ tương đối đáy giữa khối, cùng quay theo huong. Trả (thân để kiểm, mọi khối để dọn)."""
    than, tat_ca = [], []
    for nv in sh.get('nhan_vat', []):
        mau_nv = DL['nhan_vat_mau'][nv['ten']]
        if ket: nv = {**nv, 'tam': nv.get('den') or nv['tam'], 'huong': nv.get('huong_den', nv.get('huong', 0)), 'nam': nv.get('nam_den', nv.get('nam'))}   # khung KẾT: chỗ + hướng + dáng (bẹp) lúc kết
        X, Y, Z = nv['tam'][0], nv['tam'][1], (nv['tam'][2] if len(nv['tam']) > 2 else 0)
        w, d, h = mau_nv['co']
        if nv.get('nam'): d, h = h, d   # nằm sấp / bẹp: cao thành sâu
        hg = nv.get('huong', 0)
        o = khoi({'hinh': mau_nv['hinh'], 'co': [w, d, h], 'mau': mau_nv['mau'], 'sang': mau_nv.get('sang', 0), 'tam': [0, 0, Z]}, f"NV {nv['ten']}", (X, Y), hg)
        if mau_nv.get('mo_hinh'): chat_lieu(o, mau_nv['mo_hinh'], mau_nv['mau']); hoan_thien(o, mau_nv['mo_hinh'], w, d, h)
        than.append(o); tat_ca.append(o)
        phan = [dict(p) for p in mau_nv.get('phan', [])] if not nv.get('nam') else []
        if mau_nv.get('mat'):
            e = max(0.3, 0.26 * min(w, h)); ex = 0.22 * w
            if nv.get('nam'): ey, ez = -d * 0.25, h - e * 0.3
            else: ey, ez = -d / 2 + e * 0.15, h * 0.62 - e / 2
            for sx in (-1, 1):
                phan.append({'hinh': 'cau', 'co': [e, e, e], 'mau': '#ffffff', 'tam': [sx * ex, ey, ez]})
                phan.append({'hinh': 'cau', 'co': [e * 0.5, e * 0.5, e * 0.5], 'mau': '#111111', 'tam': [sx * ex, ey - e * 0.38, ez + e * 0.25] if not nv.get('nam') else [sx * ex, ey - e * 0.2, ez + e * 0.45]})
        for i, p in enumerate(phan):
            p = {**p, 'tam': [p['tam'][0], p['tam'][1], p['tam'][2] + Z]}
            pk = khoi(p, f"NV {nv['ten']}·{i}", (X, Y), hg); tat_ca.append(pk)
            if p.get('chat'): chat_lieu(pk, p['chat'], p['mau'])
    return than, tat_ca

def may(s, m, ten='cam'):
    cd = bpy.data.cameras.new(ten); cd.lens = m['ong_kinh']; cd.sensor_fit = 'AUTO'; cd.clip_start = 0.002
    o = bpy.data.objects.new(ten, cd); s.collection.objects.link(o)
    o.location = Vector(m['dat']) * CM
    o.rotation_euler = (Vector(m['nhin']) * CM - o.location).to_track_quat('-Z', 'Y').to_euler()
    s.camera = o; return o

def do_sau(s, gan, xa):
    """Vật liệu đè: độ sâu theo máy (gần trắng → xa đen) — bản đồ độ sâu cho ControlNet."""
    m = bpy.data.materials.new('do_sau'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    cam = nt.nodes.new('ShaderNodeCameraData'); mr = nt.nodes.new('ShaderNodeMapRange'); em = nt.nodes.new('ShaderNodeEmission'); ra = nt.nodes.new('ShaderNodeOutputMaterial')
    mr.inputs['From Min'].default_value = gan; mr.inputs['From Max'].default_value = xa; mr.inputs['To Min'].default_value = 1; mr.inputs['To Max'].default_value = 0
    nt.links.new(cam.outputs['View Distance'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], ra.inputs['Surface'])
    return m

def kiem_hinh_hoc(s, cam, sh, nv_obj):
    """Kiểm BẰNG SỐ (không bằng mắt): mỗi nhân vật — TÂM có trong khung không, chiếm bao nhiêu % chiều cao khung, bị vật nào che (bắn tia
    từ máy tới 9 điểm trên thân — che > nửa số điểm = bị che). bat_buoc = chủ thể của khung (shot khai) — chỉ chúng mới là lỗi khi hỏng."""
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); out = []
    bb_ten = set(sh.get('bat_buoc') or [])
    for o in nv_obj:
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        tam = sum(bb, Vector()) / 8
        diem = [tam] + [tam.lerp(c, 0.7) for c in bb]
        che = {}; ys = []
        for p in diem:
            v = world_to_camera_view(s, cam, p); ys.append(v.y)
            d = p - cam.location; kc = d.length
            hit, loc, _, _, ob, _ = s.ray_cast(dg, cam.location, d.normalized(), distance=kc - 0.0005)
            nhom = o.name.rsplit(' ', 1)[0] if o.name[-1:].isdigit() else o.name   # phần cùng nhóm (đế–cột–chao đèn) không tính là che
            if hit and ob and ob.name != o.name and not ob.name.startswith(nhom + ' ') and not ob.name.startswith(o.name + '·'): che[ob.name.split('·')[0]] = che.get(ob.name.split('·')[0], 0) + 1
        vt = world_to_camera_view(s, cam, tam)
        bi_che = sorted(k[3:] if k.startswith('NV ') else k for k, v in che.items() if v > len(diem) / 2)
        ten = o.name[3:] if o.name.startswith('NV ') else next((t for t in bb_ten if o.name == t or o.name.startswith(t + ' ')), o.name)
        out.append({'nhan_vat': ten, 'bat_buoc': ten in bb_ten, 'trong_khung': 0 <= vt.x <= 1 and 0 <= vt.y <= 1 and vt.z > 0,
                    'cao_khung_pt': round((max(ys) - min(ys)) * 100, 1), 'bi_che_boi': bi_che})
    return out

NHOM = {v['ten'] for v in DL['vat'] if 'phan' in v}
NEN = {v['ten'] for v in DL['vat'] if v.get('nen')}
EN = {v['ten']: v['en'] for v in DL['vat'] if v.get('en')}   # tên tiếng Anh cho prompt keyframe   # mặt bàn, tường, kệ: không phải vật chắn
def ten_vat(o):
    """Tên người đọc của một khối trong cảnh: 'NV Tango' → Tango, 'Desk Lamp 2' → Desk Lamp (phần của nhóm)."""
    n = o.name.split('·')[0]
    if n.startswith('NV '): return n[3:]
    g = n.rsplit(' ', 1)[0]
    return g if g in NHOM else o.name

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
        out.append({'ten': t, 'en': EN.get(t, t), 'pt': pt, 'hop': [round(x['u0'] - 0.5 / C, 3), round(x['v0'] - 0.5 / R, 3), round(x['u1'] + 0.5 / C, 3), round(x['v1'] + 0.5 / R, 3)],
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

def giai_may(s, cam, sh, nv):
    """BỘ GIẢI MÁY: máy tự động mà chủ thể bị che / ra ngoài, nằm sai phía trục, hoặc có vật chắn tiền cảnh chữ không nhắc, → thử xoay quanh chủ thể (±15…60°), nâng máy, lùi xa — lấy phương án đầu tiên
    mọi chủ thể đều thấy rõ (ít đổi nhất trước). Không có phương án sạch → giữ phương án ít lỗi nhất, kiểm vẫn báo."""
    g = Vector(sh['may']['nhin']); d0 = Vector(sh['may']['dat']) - g
    tot = None
    for xa in (1.0, 1.3, 1.7):
        for dz in (0, 1.5, 4, 8):
            for dp in (0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 150, -150, 180):   # tới 180° để máy đang sai phía trục quay về được
                a = math.radians(dp); v = Vector((d0.x * math.cos(a) - d0.y * math.sin(a), d0.x * math.sin(a) + d0.y * math.cos(a), d0.z)) * xa
                vt_may = g + v + Vector((0, 0, dz)); dat_may(cam, vt_may, g)
                k = kiem_hinh_hoc(s, cam, sh, nv); h = hong(k) * 100 + sai_truc(sh, vt_may) * 100
                if h == 0: h = chan_la(s, cam, sh, nv) + thieu_nhac(s, cam, sh, nv) * 10   # chủ thể sạch rồi mới tính vật chắn lạ + vật được nhắc mà không thấy (đắt hơn)
                if tot is None or h < tot[0]: tot = (h, [round(x, 1) for x in vt_may], k)
                if h == 0: return tot
    dat_may(cam, tot[1], g); return tot

def vat_chu_the(sh):
    """Đồ vật CỦA BỘ SET được khai là chủ thể khung (vd công tắc đèn ở shot bấm đèn) — kiểm như nhân vật: phải thấy rõ, không bị che.
    Nhóm nhiều phần ('Desk Lamp 0..3') lấy phần đầu tiên làm đại diện."""
    ten_nv = {nv['ten'] for nv in sh.get('nhan_vat', [])}
    out = []
    for t in sh.get('bat_buoc') or []:
        if t in ten_nv: continue
        o = bpy.data.objects.get(t) or next((x for x in bpy.data.objects if x.name.startswith(t + ' ')), None)
        if o: out.append(o)
    return out

s = dung_set()
shots = [sh for sh in DL['shot'] if not CHI or sh['ma'] in CHI]
kiem = {}; giai = {}; thay = {}; di = {}
for sh in ([] if CHI_MB else shots):
    dat_tuy_chon(set(sh.get('them') or []))
    nv, nv_het = nhan_vat(sh)
    cam = may(s, sh['may'], f"cam {sh['ma']}")
    nv_kiem = nv + vat_chu_the(sh)
    k = kiem_hinh_hoc(s, cam, sh, nv_kiem)
    if sh.get('giai') and (hong(k) or sai_truc(sh, sh['may']['dat']) or chan_la(s, cam, sh, nv_kiem) or thieu_nhac(s, cam, sh, nv_kiem)):
        _, may_moi, k = giai_may(s, cam, sh, nv_kiem)   # KHÔNG đặt tên `dat` — trùng hàm dat() ở trên, đè mất hàm (lỗi 14/10/2026)
        giai[sh['ma']] = {'dat': may_moi, 'nhin': sh['may']['nhin']}; sh['may']['dat'] = may_moi
    kiem[sh['ma']] = k; DA_GIAI[sh['ma']] = list(sh['may']['dat'])
    thay[sh['ma']] = nhin_thay(s, cam, sh, nv_kiem)
    # ẢNH RA (anh 15/10/2026: "render 30+ shot sao ra 140 ảnh?"): chỉ KHUNG MÀU (JPEG) — ảnh số 1 của keyframe. Khung xám chỉ render khi máy không
    # có OpenGL (không làm được khung màu); bản đồ độ sâu bỏ hẳn (thử Flux depth đã loại). Cổng 3D kiểm bằng số đo tia, không cần ảnh.
    if not ve_mau(s, sh, f"{RA}/{sh['ma']}-mau.jpg"):
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
    if any(x.get('den') or x.get('huong_den') is not None for x in sh.get('nhan_vat', [])):
        nk, nk_het = nhan_vat(sh, ket=True)
        den_ = chieu(nk)
        di[sh['ma']] = [{'ten': t, 'tu': tu[t], 'den': den_.get(t, tu[t])} for t in tu]
        ve_mau(s, sh, f"{RA}/{sh['ma']}-mau-ket.jpg")
        for o in nk_het: bpy.data.objects.remove(o, do_unlink=True)
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
# Khung mặt bằng tự ôm cả mặt bàn (vật tên 'Mặt bàn'), không gõ tay cỡ.
ban = next(v for v in DL['vat'] if v['ten'] == 'Mặt bàn')
cd = bpy.data.cameras.new('tren'); cd.type = 'ORTHO'; cd.ortho_scale = max(ban['co'][0], ban['co'][1] * 1200 / 800) * CM * 1.08
o = bpy.data.objects.new('tren', cd); s.collection.objects.link(o); o.location = (ban['tam'][0] * CM, ban['tam'][1] * CM, 3); s.camera = o
s.render.resolution_x, s.render.resolution_y = 1200, 800; s.cycles.samples = 8; s.cycles.use_denoising = True; may_ve(s, True)
if BO_MB: s.render.resolution_x, s.render.resolution_y = 32, 24
for v in [x for x in bpy.data.objects if x.name.startswith('Tường')]: v.hide_render = True
s.render.filepath = f"{RA}/mat-bang.png"; bpy.ops.render.render(write_still=True)
json.dump(kiem, open(f'{RA}/kiem.json', 'w'), ensure_ascii=False, indent=1)
json.dump(giai, open(f'{RA}/giai.json', 'w'), ensure_ascii=False, indent=1)
json.dump(thay, open(f'{RA}/thay.json', 'w'), ensure_ascii=False, indent=1)
json.dump(di, open(f'{RA}/di.json', 'w'), ensure_ascii=False, indent=1)
print('KIEM', json.dumps(kiem, ensure_ascii=False))
print('XONG', [sh['ma'] for sh in shots])
