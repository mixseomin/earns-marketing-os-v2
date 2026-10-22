# THƯ VIỆN ĐỘNG TÁC cho rig chuẩn (anh 22/10/2026: "các chuyển động đã có thư viện chuẩn như chạy, nhảy, ngã… chụp lại cho xem").
# Người: đã có mocap CMU thật (bo-set/mesh/mocap.py). Thú bốn chân: không có kho mocap miễn phí → động tác THỦ TỤC theo chu kỳ dáng đi chuẩn
# (Muybridge / Hildebrand: đi = trình tự bên LH→LF→RH→RF, mỗi chân chạm đất ~70 % chu kỳ; phi = hai chân sau rồi hai chân trước, chạm ~40 %).
# Viết trên TAY CẦM chuẩn của Rigify (root, torso, chest, neck, head, tail.*, foot_ik.*, front_foot_ik.*) và mọi độ dài theo H → một bộ
# dùng cho mọi rig bon_chan sinh từ gan-rig.py. Động tác = hàm dang(rig, H, t∈[0,1)) đặt tay cầm cho khoảnh khắc t (đi / chạy lặp vòng).
import math
from mathutils import Vector, Euler, Matrix

TRUOC = Vector((0, -1, 0))   # mặt nhìn −y


def _dat_lai(pb):
    for b in pb:
        b.location = (0, 0, 0); b.scale = (1, 1, 1)
        if b.rotation_mode == 'QUATERNION': b.rotation_quaternion = (1, 0, 0, 0)
        else: b.rotation_euler = (0, 0, 0)


def _doi(b, w):
    """Dời tay cầm theo hệ THẾ GIỚI (Vector, đơn vị lưới)."""
    b.location = b.bone.matrix_local.to_3x3().inverted() @ w


def _quay(b, x=0, y=0, z=0):
    """Xoay tay cầm quanh trục THẾ GIỚI (độ) — đổi về hệ cục bộ của xương."""
    r = b.bone.matrix_local.to_3x3(); q = (r.inverted() @ Euler((math.radians(x), math.radians(y), math.radians(z))).to_matrix() @ r).to_quaternion()
    if b.rotation_mode == 'QUATERNION': b.rotation_quaternion = q
    else: b.rotation_euler = q.to_euler(b.rotation_mode)


def _chan(pb, H, t, pha, cham, buoc, nhac):
    """Bốn bàn chân IK theo chu kỳ: pha = {tay cầm: lệch pha}, cham = phần chu kỳ chân trên đất."""
    for ten, p in pha.items():
        if ten not in pb: continue
        u = (t + p) % 1.0
        if u < cham:   # chạm đất: trượt lùi đều so với thân (thân đi tới)
            y = -buoc / 2 + buoc * (u / cham); z = 0
        else:          # vung: nhấc lên, đưa tới trước
            v = (u - cham) / (1 - cham); y = buoc / 2 - buoc * v; z = nhac * math.sin(math.pi * v)
        _doi(pb[ten], Vector((0, y, z)) * 1)


def _duoi(pb, goc_z, goc_x=0):
    for i in range(5):
        n = 'tail' if i == 0 else f'tail.{i:03d}'
        if n in pb: _quay(pb[n], x=goc_x / 5, z=goc_z * (0.6 + 0.2 * i) / 5)


def di(pb, H, t):
    _chan(pb, H, t, {'foot_ik.L': 0.0, 'front_foot_ik.L': 0.25, 'foot_ik.R': 0.5, 'front_foot_ik.R': 0.75}, 0.7, 0.18 * H, 0.08 * H)
    _doi(pb['torso'], Vector((0, 0, 0.012 * H * math.cos(4 * math.pi * t))))
    _quay(pb['neck'], x=4 * math.sin(4 * math.pi * t)); _quay(pb['head'], x=-3 * math.sin(4 * math.pi * t))
    _duoi(pb, 18 * math.sin(2 * math.pi * t))


def chay(pb, H, t):
    _chan(pb, H, t, {'foot_ik.L': 0.0, 'foot_ik.R': 0.1, 'front_foot_ik.L': 0.5, 'front_foot_ik.R': 0.6}, 0.4, 0.34 * H, 0.14 * H)
    _doi(pb['torso'], Vector((0, 0, 0.04 * H * math.sin(2 * math.pi * t))))
    _quay(pb['torso'], x=7 * math.sin(2 * math.pi * t + 1.2))
    _quay(pb['neck'], x=-12 + 8 * math.sin(2 * math.pi * t)); _quay(pb['head'], x=10)
    _duoi(pb, 6 * math.sin(2 * math.pi * t), goc_x=-25)


def nhay(pb, H, t):
    """Thu người → bật → bay (chân co) → tiếp đất → đứng lại. Bay = dời root (cả rig), chân IK theo root nên co bằng cách nhấc tương đối."""
    tron = lambda a, b, u: a + (b - a) * (0.5 - 0.5 * math.cos(math.pi * max(0, min(1, u))))
    if t < 0.25: ha = tron(0, -0.14 * H, t / 0.25); cao = 0; co = 0
    elif t < 0.4: ha = tron(-0.14 * H, 0.04 * H, (t - 0.25) / 0.15); cao = 0; co = 0
    elif t < 0.75: u = (t - 0.4) / 0.35; ha = 0.04 * H; cao = 0.55 * H * 4 * u * (1 - u); co = 0.12 * H * math.sin(math.pi * u)
    else: u = (t - 0.75) / 0.25; ha = tron(-0.12 * H, 0, u) if u > 0.3 else tron(0, -0.12 * H, u / 0.3); cao = 0; co = 0
    _doi(pb['root'], Vector((0, -0.6 * H * max(0, min(1, (t - 0.3) / 0.5)), cao)))
    _doi(pb['torso'], Vector((0, 0, ha)))
    _quay(pb['torso'], x=-14 * math.sin(math.pi * max(0, min(1, (t - 0.3) / 0.5))))
    for n in ('foot_ik.L', 'foot_ik.R', 'front_foot_ik.L', 'front_foot_ik.R'):
        if n in pb: _doi(pb[n], Vector((0, 0, co)))
    _quay(pb['neck'], x=-15 if 0.3 < t < 0.75 else 10 * (t < 0.3))
    _duoi(pb, 0, goc_x=-30 * math.sin(math.pi * max(0, min(1, (t - 0.3) / 0.5))))


def nga(pb, H, t):
    """Mất đà, đổ nghiêng sang phải (quanh mép chân phải), nằm, đầu nảy nhẹ. Cả rig quay quanh trục y tại x = mép chân."""
    u = min(1, t / 0.6); g = 82 * u * u                       # nhanh dần như rơi
    tru = Vector((-0.12 * H, 0, 0)); R = Euler((0, math.radians(-g), 0)).to_matrix()
    _quay(pb['root'], y=-g); _doi(pb['root'], tru - R @ tru)
    nay = 0 if t < 0.6 else 10 * math.exp(-8 * (t - 0.6)) * math.cos(30 * (t - 0.6))
    _quay(pb['neck'], z=-10 * u, x=nay); _quay(pb['head'], x=nay)
    for n, x in (('front_foot_ik.L', 0.05), ('foot_ik.L', 0.05)):
        if n in pb: _doi(pb[n], Vector((x * H * u, 0, 0.06 * H * u)))
    _duoi(pb, -20 * u)


DONG_TAC = {'bon_chan': {'di': di, 'chay': chay, 'nhay': nhay, 'nga': nga}}


def dat(rig, loai, ten, H, t):
    pb = rig.pose.bones; _dat_lai(pb); DONG_TAC[loai][ten](pb, H, t)
