# DIỄN CẢM XÚC trên rig thú (anh 22/10/2026: "diễn cảnh cảm xúc, buồn, khóc, cười… thì sao"). 0đ.
# Mặt = bản diễn NGƯỜI THẬT (mat-tu-video.py → hệ số ARKit từng khung) đổ vào thanh trượt rig['…'], qua lớp CHUYỂN NHÂN VẬT (retarget) chuẩn ngành:
# hệ số người thật nhỏ (khóc lặng: mếu 0,04) → nhân hệ số từng kênh cho mặt hoạt hình + lớp diễn tay (khóc thì khoé miệng mếu theo mày trong).
# Thân = lớp diễn thủ tục trên tay cầm Rigify: khóc → cúi đầu, nấc (thân giật lên rồi chùng), đuôi rũ; cười → ngửa đầu, thân nảy, đuôi vẫy.
# Đoạn = (tệp json, giây từ, giây đến, kiểu). Hai đoạn nối nhau hoà 0,6 s.
#   Blender -b <rig-mat.blend> -P dien-cam-xuc.py -- <thu-muc-ra> khoc.json:0:4:khoc cuoi.json:4:7:cuoi [--mau=16] [--khung=40,110,160]
import bpy, sys, os, json, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig'))
import mat_hoat_hinh as mh, thu_dang, dong_tac as dt
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]; RA = a[0]; os.makedirs(RA, exist_ok=True)
DOAN = [x.split(':') for x in a[1:] if not x.startswith('--')]
opt = {x.lstrip('-').split('=')[0]: x.split('=')[1] for x in a[1:] if x.startswith('--')}
rig = bpy.data.objects['Rig']; m = json.loads(rig['giai_phau']); H = m['H']; FPS = 25
# lớp CHUYỂN NHÂN VẬT: kênh → hệ số (mặt hoạt hình diễn to hơn người thật)
NHAN = {'browInnerUp': 1.4, 'jawOpen': 3.0, 'eyeSquintLeft': 1.0, 'eyeSquintRight': 1.0, 'mouthSmileLeft': 1.0, 'mouthSmileRight': 1.0,
        'mouthFrownLeft': 3.0, 'mouthFrownRight': 3.0, 'cheekPuff': 1.5}
HOA = int(0.6 * FPS)

# ---- dựng chuỗi khung: mỗi khung = (hệ số mặt, kiểu, t trong đoạn) ----
chuoi = []
for tep, tu, den, kieu in DOAN:
    d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tai-san', 'dien', tep)))
    f0 = d['fps']; ks = d['khung'][int(float(tu) * f0):int(float(den) * f0)]
    n = int((float(den) - float(tu)) * FPS)
    gat0 = sum(k.get('_gat', 0) for k in ks) / max(1, len(ks)); ngh0 = sum(k.get('_nghieng', 0) for k in ks) / max(1, len(ks))
    for i in range(n):
        k = dict(ks[min(len(ks) - 1, int(i * f0 / FPS))])
        k['_gat'] -= gat0; k['_nghieng'] = k.get('_nghieng', 0) - ngh0   # chỉ giữ dao động quanh dáng trung bình của người diễn
        chuoi.append((k, kieu, i / FPS))


def he_so(k, kieu):
    v = {x: min(1.0, k.get(x, 0) * NHAN.get(x, 1.0)) for x in mh.ARKIT}
    if kieu == 'khoc':   # khóc: mếu theo mày trong, mắt ngấn nước, giọt chảy dần
        for s in ('Left', 'Right'): v[f'mouthFrown{s}'] = max(v[f'mouthFrown{s}'], 0.9 * v['browInnerUp']); v[f'mouthSmile{s}'] *= 0.2
        v['eyeLookDownLeft'] = v['eyeLookDownRight'] = 0.35
    return v


def lop_cuoi(v, t):
    """Cười to kiểu hoạt hình: hàm há theo nhịp "ha ha" (cùng nhịp thân nảy), mắt nheo nhưng HÉ — người thật chớp / nhắm khi cười, đổ thẳng
    vào mí thú mắt to thành mắt ngủ gật (soát khung 140, 165)."""
    nay = abs(math.sin(2 * math.pi * 2.2 * t))
    v['jawOpen'] = max(v['jawOpen'], 0.35 + 0.45 * nay)
    for s in ('Left', 'Right'):
        v[f'eyeBlink{s}'] = min(v[f'eyeBlink{s}'], 0.15); v[f'mouthSmile{s}'] = 1.0; v[f'eyeSquint{s}'] = max(v[f'eyeSquint{s}'], 0.8)
    v['cheekPuff'] = max(v['cheekPuff'], 0.4)
    return v


pb = rig.pose.bones
for b in pb: b.rotation_mode = 'XYZ' if b.rotation_mode == 'QUATERNION' else b.rotation_mode
sc = bpy.context.scene
for fr, (k, kieu, t) in enumerate(chuoi):
    # hoà hai đoạn: HOA khung cuối đoạn trước trộn sang khung đầu đoạn sau
    v = he_so(k, kieu); w_khoc = 1.0 if kieu == 'khoc' else 0.0
    if kieu == 'cuoi': v = lop_cuoi(v, t)
    dau_doan = next((j for j in range(fr, -1, -1) if j == 0 or chuoi[j - 1][1] != chuoi[j][1]), 0)
    if dau_doan > 0 and fr - dau_doan < HOA:
        u = (fr - dau_doan) / HOA; u = u * u * (3 - 2 * u); kt = chuoi[dau_doan - 1]
        v0 = he_so(kt[0], kt[1]); v0 = lop_cuoi(v0, kt[2]) if kt[1] == 'cuoi' else v0; v = {x: v0[x] * (1 - u) + v[x] * u for x in v}
        w_khoc = (1.0 if kt[1] == 'khoc' else 0.0) * (1 - u) + w_khoc * u
    for x, val in v.items(): rig[x] = val; rig.keyframe_insert(data_path=f'["{x}"]', frame=fr + 1)
    so_khoc = sum(1 for c in chuoi if c[1] == 'khoc')
    rig['khoc'] = max(w_khoc, 0.0) if so_khoc else 0.0
    rig['giot'] = min(1.0, fr / max(1, so_khoc)) if fr < so_khoc + HOA else 1.0
    for x in ('khoc', 'giot'): rig.keyframe_insert(data_path=f'["{x}"]', frame=fr + 1)
    # ---- thân ----
    dt._dat_lai(pb)
    gat, ngh = k.get('_gat', 0) * 0.6, k.get('_nghieng', 0) * 0.5
    if kieu == 'khoc':
        nhip = (t * 0.8) % 1.0; nac = math.exp(-12 * nhip) * (1 - math.exp(-60 * nhip))   # nấc: giật lên nhanh rồi chùng chậm, ~0,8 lần / giây
        dt._doi(pb['torso'], Vector((0, 0, 0.012 * H * nac - 0.01 * H)))
        dt._quay(pb['neck'], x=14 + 6 * nac); dt._quay(pb['head'], x=10 + gat, y=ngh)
        dt._duoi(pb, 4 * math.sin(2 * math.pi * 0.3 * t), goc_x=18)
    else:
        nay = abs(math.sin(2 * math.pi * 2.2 * t))   # bật cười: nảy ~4,4 nhịp / giây
        dt._doi(pb['torso'], Vector((0, 0, 0.012 * H * nay)))
        dt._quay(pb['neck'], x=-10 - 6 * nay); dt._quay(pb['head'], x=-8 + gat - 4 * nay, y=ngh)
        dt._duoi(pb, 22 * math.sin(2 * math.pi * 1.6 * t), goc_x=-10)
    if 'chest' in pb: dt._quay(pb['chest'], x=(6 if kieu == 'khoc' else -4))
    for b in ('torso', 'neck', 'head', 'chest', 'tail', 'tail.001', 'tail.002', 'tail.003', 'tail.004'):
        if b in pb:
            pb[b].keyframe_insert('location', frame=fr + 1)
            pb[b].keyframe_insert('rotation_quaternion' if pb[b].rotation_mode == 'QUATERNION' else 'rotation_euler', frame=fr + 1)

# ---- sân khấu + máy cận trung (đầu + cổ + ngực) ----
sc = thu_dang.san_khau(H, thu_dang.rong_cua(m)); sc.frame_start, sc.frame_end = 1, len(chuoi); sc.render.fps = FPS
mL = rig.matrix_world @ rig.data.bones['mat.L'].head_local; mR = rig.matrix_world @ rig.data.bones['mat.R'].head_local
tam = (mL + mR) / 2 + Vector((0, 0.02 * H, -0.09 * H)); be = (mL - mR).length + 0.2 * H
cam = sc.camera; cam.data.lens = 50; cam.location = tam + Vector((0.42, -0.85, 0.05)).normalized() * be * 2.6
cam.rotation_euler = (tam - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.cycles.samples = int(opt.get('mau', 16)); sc.render.resolution_x = sc.render.resolution_y = 720
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.join(RA, 'k')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RA, 'dien.blend'))
print('KHUNG', len(chuoi), 'ra', RA)
if opt.get('khung'):   # soát nhanh vài khung tĩnh trước khi render cả clip
    for fr in map(int, opt['khung'].split(',')):
        sc.frame_set(fr); sc.render.filepath = os.path.join(RA, f'soat.{fr:04d}.png'); bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
