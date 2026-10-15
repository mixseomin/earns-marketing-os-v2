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
    elif h == 'khan':   # tấm khăn rủ (Mr. Wipe): mặt vải quanh trục, đỉnh tròn ôm đầu, loe dần, đáy gợn + 4 góc thõng — xem khan_diem()
        me = bpy.data.meshes.new(f'khan {ten}'); ds, mat = khan_diem(w / d if d else 1)
        me.from_pydata(ds, [], mat); me.update()
        o = bpy.data.objects.new(ten, me); bpy.context.collection.objects.link(o)
        o.location = (gx * CM, gy * CM, z * CM); o.scale = (w * CM, d * CM, c * CM)
        o.rotation_euler = Euler((math.radians(p.get('nghieng', 0)), 0, math.radians(xoay + p.get('xoay', 0))))
        for f in me.polygons: f.use_smooth = True
        return dat(o, m, ten)
    elif h == 'non':   # nón cụt (thân khăn rủ Mr. Wipe): đáy rộng co[0]×co[1], đỉnh = đáy × dinh, cao co[2]
        bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=0.5, radius2=0.5 * p.get('dinh', 0.4), depth=1, location=(gx * CM, gy * CM, (z + c / 2) * CM))
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
    TRANG.clear()
    for nv in sh.get('nhan_vat', []):
        mau_nv = DL['nhan_vat_mau'][nv['ten']]
        cam_luc_nay = nv.get('cam') and not (ket and nv.get('den'))   # cam + den = đặt xuống trong shot: khung kết không còn cầm
        if ket: nv = {**nv, 'tam': nv.get('den') or nv['tam'], 'huong': nv.get('huong_den', nv.get('huong', 0)), 'nam': nv.get('nam_den', nv.get('nam'))}   # khung KẾT: chỗ + hướng + dáng (bẹp) lúc kết
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
        o = khoi({'hinh': mau_nv['hinh'], 'co': [w, d, h], 'mau': mau_nv['mau'], 'sang': mau_nv.get('sang', 0), 'tam': [0, 0, Z], 'dinh': mau_nv.get('dinh', 0.4)}, f"NV {nv['ten']}", (X, Y), hg)
        if mau_nv.get('mo_hinh'): chat_lieu(o, mau_nv['mo_hinh'], mau_nv['mau']); hoan_thien(o, mau_nv['mo_hinh'], w, d, h)
        than.append(o); tat_ca.append(o)
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
    return than, tat_ca

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
    s.camera = o; return o

def do_sau(s, gan, xa):
    """Vật liệu đè: độ sâu theo máy (gần trắng → xa đen) — bản đồ độ sâu cho ControlNet."""
    m = bpy.data.materials.new('do_sau'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    cam = nt.nodes.new('ShaderNodeCameraData'); mr = nt.nodes.new('ShaderNodeMapRange'); em = nt.nodes.new('ShaderNodeEmission'); ra = nt.nodes.new('ShaderNodeOutputMaterial')
    mr.inputs['From Min'].default_value = gan; mr.inputs['From Max'].default_value = xa; mr.inputs['To Min'].default_value = 1; mr.inputs['To Max'].default_value = 0
    nt.links.new(cam.outputs['View Distance'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], ra.inputs['Surface'])
    return m

def ve_sau(s, sh, cam, ra):
    """Bản đồ ĐỘ SÂU của khung MỞ (gần trắng → xa đen), cùng máy + ống kính: bước 1 của keyframe hai bước — model sinh ảnh điều khiển bằng độ
    sâu (FLUX depth) bị khoá theo hình học 3D (anh 15/10/2026: ba model ảnh dựa trên ảnh tham chiếu đều tự dựng lại góc máy #35)."""
    d = (Vector(sh['may']['nhin']) - Vector(sh['may']['dat'])).length * CM
    eng, smp, dn = s.render.engine, s.cycles.samples, s.cycles.use_denoising
    s.view_layers[0].material_override = do_sau(s, d * 0.4, d * 3.0)
    s.render.engine = 'CYCLES'; s.cycles.samples = 1; s.cycles.use_denoising = False; s.view_settings.view_transform = 'Standard'
    fm = s.render.image_settings; fm.file_format = 'PNG'; fm.color_mode = 'BW'
    s.render.filepath = ra; bpy.ops.render.render(write_still=True)
    s.view_layers[0].material_override = None; fm.color_mode = 'RGBA'
    s.render.engine, s.cycles.samples, s.cycles.use_denoising = eng, smp, dn

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
TRANG = {}   # tên → trạng thái đang dựng của shot hiện tại (đã chia mảnh…) — nhin_thay ghi vào 'trang' cho nhãn keyframe
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
        out.append({'ten': t, 'en': EN.get(t, t), **({'trang': TRANG[t]} if t in TRANG else {}), 'pt': pt, 'hop': [round(x['u0'] - 0.5 / C, 3), round(x['v0'] - 0.5 / R, 3), round(x['u1'] + 0.5 / C, 3), round(x['v1'] + 0.5 / R, 3)],
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
if os.environ.get('XV_BANG_TI_LE'):   # đường riêng: chỉ render bảng tỉ lệ nhân vật
    bang_ti_le(s, RA); sys.exit(0)
if os.environ.get('XV_TOAN_CANH'):   # đường riêng: chỉ render toàn cảnh từng cảnh (đầu vào = tệp json danh sách cảnh)
    toan_canh(s, json.load(open(os.environ['XV_TOAN_CANH'], encoding='utf-8')), RA); sys.exit(0)
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
    if ve_mau(s, sh, f"{RA}/{sh['ma']}-mau.jpg"): ve_sau(s, sh, cam, f"{RA}/{sh['ma']}-sau.png")   # độ sâu cho keyframe hai bước (FLUX depth)
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
