# CẢNH 3D THUẦN THỬ — hang đá có bầy khủng long con (anh 21/10/2026: "dựng 1 cảnh thế này với 3D ko? Chưa cần dùng AI", mẫu = quảng cáo Tripo
# "baby dinosaurs": vách hang cam ấm, bụi lấp lánh, nền đất ẩm + vũng nước tiền cảnh, tổ cành khô, rêu; khung dọc 9:16, xoá phông sâu).
# Mục đích: đo xem riêng Blender (tài sản CC0 Poly Haven, 0đ) dựng được MÔI TRƯỜNG + ÁNH SÁNG tới đâu. Khủng long ở đây là hình nặn THÔ từ khối cơ
# bản (thân / đầu / mắt to / chân / đuôi) — chỉ giữ chỗ bố cục; mẫu thật sau này mua hoặc nặn thô rồi cho AI ảnh→3D làm chi tiết.
#   bash tai.sh   (một lần)
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P hang-khung-long.py -- [ra.png] [--mau=96] [--nhanh]
import bpy, math, os, random, sys, glob
from mathutils import Vector

DIR = os.path.dirname(os.path.abspath(__file__)); TS = os.path.join(DIR, 'tai-san')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RA = next((a for a in args if not a.startswith('--')), os.path.join(DIR, 'ra', 'hang.png'))
MAU = int(next((a.split('=')[1] for a in args if a.startswith('--mau=')), '96'))
NHANH = '--nhanh' in args
os.makedirs(os.path.dirname(RA), exist_ok=True)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ---------- vật liệu ----------
def vl_quet(ten, ma, ti_le=1.0, nhuom=None, dich_cao=0.0):
    """Vật liệu quét Poly Haven (màu / nhám / pháp tuyến [/ độ cao → displacement thật]), toạ độ hộp chiếu ba mặt (vách hang cong không cần UV)."""
    m = bpy.data.materials.new(ten); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (ti_le,) * 3
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    def anh(f, mau=True):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(TS, 'vl', ma, f + '.jpg'))
        t.projection = 'BOX'; t.projection_blend = 0.3
        if not mau: t.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector']); return t
    c = anh('mau')
    if nhuom:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        mx.inputs[7].default_value = (*nhuom, 1); nt.links.new(c.outputs['Color'], mx.inputs[6]); nt.links.new(mx.outputs[2], bs.inputs['Base Color'])
    else: nt.links.new(c.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(anh('nham', False).outputs['Color'], bs.inputs['Roughness'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(anh('phap', False).outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    if dich_cao and os.path.exists(os.path.join(TS, 'vl', ma, 'cao.jpg')):
        d = nt.nodes.new('ShaderNodeDisplacement'); d.inputs['Scale'].default_value = dich_cao; d.inputs['Midlevel'].default_value = 0.5
        nt.links.new(anh('cao', False).outputs['Color'], d.inputs['Height']); nt.links.new(d.outputs['Displacement'], nt.nodes['Material Output'].inputs['Displacement'])
        m.displacement_method = 'BOTH'
    return m

def vl_phang(ten, mau, nham=0.5, ss=0.0, phat=0.0, kim=0.0):
    m = bpy.data.materials.new(ten); m.use_nodes = True; bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*mau, 1); bs.inputs['Roughness'].default_value = nham; bs.inputs['Metallic'].default_value = kim
    if ss: bs.inputs['Subsurface Weight'].default_value = ss; bs.inputs['Subsurface Radius'].default_value = (0.6, 0.3, 0.2)
    if phat: bs.inputs['Emission Color'].default_value = (*mau, 1); bs.inputs['Emission Strength'].default_value = phat
    return m

def da_dat(o, m):
    o.data.materials.clear(); o.data.materials.append(m)

# ---------- nền đất + vũng nước ----------
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 6, 0)); dat = bpy.context.object; dat.name = 'Đất'
md = dat.modifiers.new('chia', 'SUBSURF'); md.subdivision_type = 'SIMPLE'; md.levels = md.render_levels = 6
tx = bpy.data.textures.new('gon', 'CLOUDS'); tx.noise_scale = 1.6
dp = dat.modifiers.new('gon', 'DISPLACE'); dp.texture = tx; dp.strength = 0.18; dp.mid_level = 0.6
da_dat(dat, vl_quet('Đất ẩm', 'brown_mud_rocks_01', 0.35, nhuom=(1.0, 0.72, 0.55), dich_cao=0.04))
# vũng nước tiền cảnh phải = VÙNG ĐẤT ƯỚT ngay trên vật liệu đất (mặt nạ nhiễu quanh một tâm: tối + nhám ~0 → phản chiếu vách sáng). Tấm phẳng
# đặt chồng lên đất cho mép cứng như miếng nhôm (bản thử 21/10/2026).
nt = dat.data.materials[0].node_tree; bs = nt.nodes['Principled BSDF']
tc = nt.nodes.new('ShaderNodeTexCoord'); ns = nt.nodes.new('ShaderNodeTexNoise'); ns.inputs['Scale'].default_value = 0.9; ns.inputs['Detail'].default_value = 6
nt.links.new(tc.outputs['Object'], ns.inputs['Vector'])
# khoảng cách tới tâm vũng (1,4; −3,4 → toạ độ object của đất có gốc ở y=6) + nhiễu → mặt nạ
kc = nt.nodes.new('ShaderNodeVectorMath'); kc.operation = 'DISTANCE'; kc.inputs[1].default_value = (1.4, -9.4, 0)
nt.links.new(tc.outputs['Object'], kc.inputs[0])
cong = nt.nodes.new('ShaderNodeMath'); cong.operation = 'MULTIPLY_ADD'; cong.inputs[1].default_value = 1.2
nt.links.new(ns.outputs['Fac'], cong.inputs[0]); nt.links.new(kc.outputs['Value'], cong.inputs[2])
nguong = nt.nodes.new('ShaderNodeMapRange'); nguong.inputs['From Min'].default_value = 1.9; nguong.inputs['From Max'].default_value = 2.05
nguong.inputs['To Min'].default_value = 1.0; nguong.inputs['To Max'].default_value = 0.0; nt.links.new(cong.outputs[0], nguong.inputs['Value'])
nham_cu = bs.inputs['Roughness'].links[0].from_socket
mxr = nt.nodes.new('ShaderNodeMix'); mxr.data_type = 'FLOAT'; nt.links.new(nguong.outputs[0], mxr.inputs['Factor'])
nt.links.new(nham_cu, mxr.inputs[2]); mxr.inputs[3].default_value = 0.02; nt.links.new(mxr.outputs[0], bs.inputs['Roughness'])
mau_cu = bs.inputs['Base Color'].links[0].from_socket
mxc = nt.nodes.new('ShaderNodeMix'); mxc.data_type = 'RGBA'; mxc.blend_type = 'MULTIPLY'; nt.links.new(nguong.outputs[0], mxc.inputs['Factor'])
nt.links.new(mau_cu, mxc.inputs[6]); mxc.inputs[7].default_value = (0.25, 0.22, 0.2, 1); nt.links.new(mxc.outputs[2], bs.inputs['Base Color'])

# ---------- vách hang: vỏ bầu dục lật pháp tuyến, gồ ghề bằng nhiễu + vật liệu đá ----------
bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=1, location=(0, 5, 0)); hang = bpy.context.object; hang.name = 'Vách hang'
hang.scale = (9, 13, 7)   # máy ở y −5,2 phải nằm TRONG vỏ (−8 … 18)
bpy.ops.object.transform_apply(scale=True)
for tn, cd, sl in (('vach_lon', 2.5, 1.4), ('vach_nho', 0.6, 0.35)):
    t = bpy.data.textures.new(tn, 'CLOUDS'); t.noise_scale = cd; t.noise_depth = 4
    m_ = hang.modifiers.new(tn, 'DISPLACE'); m_.texture = t; m_.strength = sl; m_.texture_coords = 'GLOBAL'
# miệng hang phía sau-trái: lỗ để nắng chiều lọt vào (khối khoét)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(-3.5, 18, 2.2)); khoet = bpy.context.object; khoet.scale = (3.2, 3, 2.6); khoet.hide_render = True; khoet.display_type = 'WIRE'
bo = hang.modifiers.new('mieng', 'BOOLEAN'); bo.object = khoet; bo.operation = 'DIFFERENCE'
hang.modifiers.new('muot', 'SUBSURF').levels = 1
da_dat(hang, vl_quet('Đá cát cam', 'cliff_side', 0.18, nhuom=(1.0, 0.55, 0.3), dich_cao=0.12))
# vòm đá giữa cảnh (giống khối đá lớn sau lưng bầy trong mẫu)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1, location=(1.2, 9.5, 1.0)); vom = bpy.context.object; vom.name = 'Khối đá giữa'
vom.scale = (4.5, 2.2, 3.4)
t = bpy.data.textures.new('vom', 'CLOUDS'); t.noise_scale = 1.2; m_ = vom.modifiers.new('gon', 'DISPLACE'); m_.texture = t; m_.strength = 0.9
da_dat(vom, vl_quet('Đá cát cam 2', 'cliff_side', 0.25, nhuom=(1.0, 0.6, 0.35), dich_cao=0.1))

# ---------- đồ CC0: đá tảng, rêu, tổ cành khô, dương xỉ ----------
def nap(ma, vt, cao=None, xoay=0.0, ti=1.0):
    f = glob.glob(os.path.join(TS, 'mo-hinh', ma, '*.gltf')) + glob.glob(os.path.join(TS, 'mo-hinh', ma, '*.glb'))
    if not f: print('THIEU', ma); return []
    truoc = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f[0]); moi = [o for o in bpy.data.objects if o not in truoc]
    goc = [o for o in moi if o.parent is None]
    bpy.context.view_layer.update()
    bb = [o.matrix_world @ Vector(c) for o in moi if o.type == 'MESH' for c in o.bound_box]
    h0 = max(p.z for p in bb) - min(p.z for p in bb) if bb else 1
    k = (cao / h0) if cao else ti   # cao = chiều cao thật (m) — mô hình Poly Haven mỗi món một cỡ gốc
    for o in goc:
        o.rotation_mode = 'XYZ'   # nút gốc glTF nhập ở chế độ QUATERNION → đổi rotation_euler không có tác dụng (bronto 21/10/2026)
        o.location = Vector(vt); o.rotation_euler[2] += math.radians(xoay); o.scale = (k,) * 3
    # ĐÁY chạm đất + tâm đúng chỗ khai: gốc toạ độ mỗi nguồn một kiểu (Poly Haven ở đáy, TRELLIS ở GIỮA khối → chìm nửa thân, 21/10/2026)
    bpy.context.view_layer.update()
    bb = [o.matrix_world @ Vector(c) for o in moi if o.type == 'MESH' for c in o.bound_box]
    if bb:
        lech = Vector(vt) - Vector(((min(p.x for p in bb) + max(p.x for p in bb)) / 2, (min(p.y for p in bb) + max(p.y for p in bb)) / 2, min(p.z for p in bb)))
        for o in goc: o.location += lech
    return moi
# (mã, chỗ, xoay, cao m)
for ma, vt, xo, ca in (('namaqualand_boulder_02', (-3.6, 3.5, 0), 20, 1.6), ('namaqualand_boulder_04', (4.2, 4.5, 0), 140, 2.0),
                       ('namaqualand_boulder_05', (-2.6, -1.4, 0), 70, 0.35), ('namaqualand_boulder_05', (3.0, 0.4, 0), 200, 0.6),
                       ('moss_01', (3.2, 3.6, 0.0), 0, 0.25), ('moss_01', (-1.6, 6.5, 0.0), 90, 0.3), ('moss_01', (-3.3, 2.6, 0.0), 30, 0.25),
                       ('dry_branches_medium_01', (2.6, 2.6, 0.0), 30, 0.3), ('dry_branches_medium_01', (2.9, 2.9, 0.0), 110, 0.25),
                       ('fern_02', (-3.6, 1.6, 0), 0, 0.7), ('fern_02', (3.8, 2.0, 0), 80, 0.6)):
    nap(ma, vt, cao=ca, xoay=xo)

# ---------- khủng long THÔ (giữ chỗ bố cục — không phải mẫu thật) ----------
def khoi(loai, vt, co, m, xoay=(0, 0, 0)):
    if loai == 'cau': bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=vt)
    else: bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=1, radius2=0.15, depth=1, location=vt)
    o = bpy.context.object; o.scale = co; o.rotation_euler = [math.radians(a) for a in xoay]; bpy.ops.object.shade_smooth(); da_dat(o, m); return o

TRANG = vl_phang('Lòng trắng mắt', (0.92, 0.9, 0.85), 0.15); DEN = vl_phang('Con ngươi', (0.01, 0.01, 0.01), 0.05)
CAM = vl_phang('Mống mắt cam', (0.75, 0.35, 0.05), 0.2)
def mat(tam, huong, r):
    """Mắt to kiểu hoạt hình: lòng trắng + mống cam + con ngươi, nhìn theo `huong` (vector đơn vị)."""
    h = Vector(huong).normalized(); khoi('cau', tam, (r, r, r), TRANG)
    khoi('cau', Vector(tam) + h * r * 0.78, (r * 0.55,) * 3, CAM); khoi('cau', Vector(tam) + h * r * 0.95, (r * 0.3,) * 3, DEN)

def khung_long(x, y, mau, cao=1.0, co_dai=False, nhin=(0, -1, 0.1), sung=False):
    da = vl_phang(f'Da {mau}', mau, 0.55, ss=0.15)
    s = cao
    khoi('cau', (x, y, 0.55 * s), (0.45 * s, 0.6 * s, 0.5 * s), da)                       # thân
    for dx in (-0.25, 0.25):
        for dy in (-0.3, 0.3): khoi('cau', (x + dx * s, y + dy * s, 0.15 * s), (0.13 * s, 0.13 * s, 0.18 * s), da)   # bốn chân mập
    khoi('non', (x, y + 0.75 * s, 0.4 * s), (0.25 * s, 0.25 * s, 0.9 * s), da, xoay=(-75, 0, 0))            # đuôi
    hz = (1.65 if co_dai else 1.05) * s; hy = y - (0.55 if co_dai else 0.45) * s
    if co_dai: khoi('non', (x, y - 0.35 * s, 1.05 * s), (0.16 * s, 0.16 * s, 1.2 * s), da, xoay=(25, 0, 0))   # cổ dài
    khoi('cau', (x, hy, hz), (0.36 * s, 0.4 * s, 0.32 * s), da)                               # đầu
    khoi('cau', (x, hy - 0.3 * s, hz - 0.08 * s), (0.24 * s, 0.22 * s, 0.17 * s), da)          # mõm
    for dx in (-0.17, 0.17): mat((x + dx * s, hy - 0.22 * s, hz + 0.12 * s), Vector(nhin) + Vector((dx, 0, 0)), 0.11 * s)
    if sung:
        for dx in (-0.12, 0.12): khoi('non', (x + dx * s, hy, hz + 0.32 * s), (0.06 * s, 0.06 * s, 0.25 * s), vl_phang('Sừng', (0.8, 0.75, 0.6), 0.4))

khung_long(-1.3, 1.2, (0.55, 0.18, 0.12), 1.0, sung=True, nhin=(0.4, -1, 0.1))      # đỏ nâu có sừng (trái)
khung_long(-0.3, 1.8, (0.75, 0.38, 0.12), 0.9, nhin=(0.2, -1, 0.2))                  # cam tròn (giữa sau)
khung_long(-1.0, -0.6, (0.3, 0.42, 0.16), 0.75, nhin=(0.6, -1, 0.1))                  # xanh nhỏ (trái trước)
khung_long(0.6, 0.2, (0.5, 0.2, 0.15), 0.85, nhin=(-0.3, -1, 0.1))                    # đỏ (giữa trước)
# NHÂN VẬT 3D THẬT (ảnh concept → TRELLIS fal, $0,02 / con): có tệp tai-san/mo-hinh/<mã>/*.glb thì thay khối nặn thô; --tho = giữ khối thô để so
XOAY_NV = float(next((a.split('=')[1] for a in args if a.startswith('--xoay-bronto=')), '0'))
if glob.glob(os.path.join(TS, 'mo-hinh', 'bronto', '*.glb')) and '--tho' not in args: nap('bronto', (1.85, 1.7, 0), cao=2.1, xoay=XOAY_NV)   # mặt gốc nhìn −y (về máy)
else: khung_long(1.8, 1.8, (0.48, 0.55, 0.4), 1.15, co_dai=True, nhin=(-1, -0.3, -0.2))      # cổ dài (phải)

# ---------- bụi lấp lánh trong không khí (đốm phát sáng nhỏ — xoá phông thành bokeh) ----------
BUI = vl_phang('Bụi sáng', (1.0, 0.55, 0.2), phat=8)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.012); hat = bpy.context.object; da_dat(hat, BUI)
for i in range(110):
    o = hat.copy(); o.data = hat.data; bpy.context.collection.objects.link(o)
    o.location = (random.uniform(-2.5, 2.5), random.uniform(-5, -2.5), random.uniform(0.8, 2.6)) if i % 2 else (random.uniform(-4, 4), random.uniform(4, 9), random.uniform(1.5, 5))   # nửa sát máy, nửa sau bầy → cả hai nhoè thành bokeh; s_ = random.uniform(0.5, 1.6); o.scale = (s_,) * 3

# ---------- ánh sáng: nắng chiều cam lọt qua miệng hang + đèn hắt vách + khói mỏng ----------
bpy.ops.object.light_add(type='AREA', location=(-3.5, 19, 3)); n = bpy.context.object; n.data.energy = 20000; n.data.size = 5
n.data.color = (1.0, 0.62, 0.3); n.rotation_euler = (math.radians(95), 0, math.radians(180))
bpy.ops.object.light_add(type='AREA', location=(5, 3, 6)); h = bpy.context.object; h.data.energy = 1500; h.data.size = 4
h.data.color = (1.0, 0.55, 0.28); h.rotation_euler = (math.radians(50), math.radians(30), math.radians(60))
bpy.ops.object.light_add(type='AREA', location=(-1, -6, 3)); f = bpy.context.object; f.data.energy = 700; f.data.size = 6   # đèn phụ phía máy: mặt + mắt
f.data.color = (1.0, 0.85, 0.7); f.rotation_euler = (math.radians(70), 0, 0)
bpy.ops.object.light_add(type='AREA', location=(3.8, -1.5, 3.2)); k_ = bpy.context.object; k_.data.energy = 500; k_.data.size = 2.5   # đèn chính phải-trước: nhân vật cao bên phải khỏi bị ngược sáng
k_.data.color = (1.0, 0.8, 0.6); k_.rotation_euler = (Vector((1.6, 1.7, 1.3)) - k_.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.light_add(type='POINT', location=(0.2, 3.5, 2.5)); g = bpy.context.object; g.data.energy = 400; g.data.color = (1.0, 0.5, 0.2); g.data.shadow_soft_size = 1.5
w = bpy.data.worlds.new('Hang'); sc.world = w; w.use_nodes = True; nt = w.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(TS, 'hang.hdr'))
nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color']); nt.nodes['Background'].inputs['Strength'].default_value = 0.15
if not NHANH:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 5, 3)); kh = bpy.context.object; kh.scale = (20, 22, 6); kh.name = 'Khói'
    mv = bpy.data.materials.new('Khói'); mv.use_nodes = True; nt2 = mv.node_tree; nt2.nodes.remove(nt2.nodes['Principled BSDF'])
    pv = nt2.nodes.new('ShaderNodeVolumePrincipled'); pv.inputs['Density'].default_value = 0.012; pv.inputs['Color'].default_value = (1.0, 0.8, 0.6, 1)
    nt2.links.new(pv.outputs[0], nt2.nodes['Material Output'].inputs['Volume']); da_dat(kh, mv)

# ---------- máy: dọc 9:16, ngang tầm bầy (thấp), 35 mm, xoá phông ----------
bpy.ops.object.camera_add(location=(0.3, -6.8, 1.25)); cam = bpy.context.object; sc.camera = cam
cam.data.lens = 40; cam.data.sensor_width = 36
tgt = Vector((0.1, 1.2, 1.3)); cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.dof.use_dof = True; cam.data.dof.focus_distance = (tgt - cam.location).length - 0.4; cam.data.dof.aperture_fstop = 1.4

# ---------- render ----------
sc.render.engine = 'CYCLES'; cy = sc.cycles
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = True
    cy.device = 'GPU'
except Exception as e: print('GPU?', e)
cy.samples = MAU; cy.use_denoising = True; cy.max_bounces = 6; cy.volume_bounces = 1
sc.render.resolution_x, sc.render.resolution_y = (540, 960) if NHANH else (1080, 1920)
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
if '--dat-set' in args:   # bản ĐẤT SÉT xám (như viewport Blender / khung xám studio): mọi mặt một vật liệu xám, giữ đèn + khói
    xam = vl_phang('Đất sét', (0.55, 0.55, 0.55), 0.7); sc.view_layers[0].material_override = xam
sc.render.filepath = RA; sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(RA)[0] + '.blend')
print('RA', RA)
