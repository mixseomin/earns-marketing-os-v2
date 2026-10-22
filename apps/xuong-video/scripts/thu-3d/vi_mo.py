# VẬT LIỆU CHI TIẾT VI MÔ (procedural) — anh 22/10/2026: "zoom sát con tàu / lưng khủng long có vỡ không" → có (màu 2K trải cả con,
# cận một vùng chỉ còn vài chục điểm ảnh). Chuẩn ngành: lớp chi tiết LẶP VÔ HẠN do máy sinh, phủ trên màu bake — zoom bao nhiêu cũng
# không vỡ. Gắn LÚC DỰNG CẢNH (glTF không chở được nút procedural), mọi tỉ lệ theo H (chiều cao mẫu) nên dùng cho mọi mẫu cùng loại:
#   'da'       — vảy / mảng giáp (Voronoi hai tầng) + lỗ chân lông, kẽ vảy tối hơn, độ nhám đổi theo vảy
#   'kim_loai' — tấm ghép (Voronoi Chebychev = ô vuông) + rãnh nối + đinh tán dọc rãnh + vết xước kéo dài + bẩn đọng ở hốc (AO)
#   import vi_mo; vi_mo.phu(obj, 'da', H)
import bpy


def _n(nt, loai, **kw):
    n = nt.nodes.new(loai)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n


def _voronoi(nt, tc, so, tinh='DISTANCE_TO_EDGE', do='EUCLIDEAN'):
    v = _n(nt, 'ShaderNodeTexVoronoi', feature=tinh, distance=do, Scale=so)
    nt.links.new(tc, v.inputs['Vector']); return v


def _dai(nt, x, a, b, c=0.0, d=1.0, kieu='SMOOTHSTEP'):
    m = _n(nt, 'ShaderNodeMapRange', interpolation_type=kieu)
    m.inputs['From Min'].default_value = a; m.inputs['From Max'].default_value = b
    m.inputs['To Min'].default_value = c; m.inputs['To Max'].default_value = d
    nt.links.new(x, m.inputs['Value']); return m.outputs['Result']


def _toan(nt, op, a, b):
    m = _n(nt, 'ShaderNodeMath', operation=op)
    for i, x in enumerate((a, b)):
        if isinstance(x, (int, float)): m.inputs[i].default_value = x
        else: nt.links.new(x, m.inputs[i])
    return m.outputs['Value']


def _nhan_mau(nt, mau, he_so):
    """mau (socket màu hoặc None→xám) × he_so (socket số)."""
    m = _n(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY'); m.inputs['Factor'].default_value = 1.0
    o = lambda ds, i: next(x for x in ds if x.identifier == i)
    if mau is not None: nt.links.new(mau, o(m.inputs, 'A_Color'))
    nt.links.new(he_so, o(m.inputs, 'B_Color')); return o(m.outputs, 'Result_Color')


def _cao_da(nt, tc, H):
    mo = _n(nt, 'ShaderNodeTexNoise', Scale=35 / H, Detail=3.0); nt.links.new(tc, mo.inputs['Vector'])
    xo = _n(nt, 'ShaderNodeVectorMath', operation='MULTIPLY_ADD'); xo.inputs[1].default_value = (0.012 * H,) * 3
    nt.links.new(mo.outputs['Color'], xo.inputs[0]); nt.links.new(tc, xo.inputs[2])
    nho = _voronoi(nt, xo.outputs['Vector'], 110 / H)                # vảy nhỏ ~1 % H, toạ độ bị bẻ → ô to nhỏ méo khác nhau
    lon = _voronoi(nt, tc, 22 / H)                                    # mảng giáp lớn
    ro = _n(nt, 'ShaderNodeTexNoise', Scale=600 / H, Detail=4.0); nt.links.new(tc, ro.inputs['Vector'])
    h1 = _toan(nt, 'POWER', _dai(nt, nho.outputs['Distance'], 0.0, 0.3, kieu='LINEAR'), 0.5)   # vòm vảy tròn: 0 ở kẽ, 1 đỉnh vảy
    h2 = _dai(nt, lon.outputs['Distance'], 0.0, 0.10)
    h = _toan(nt, 'ADD', _toan(nt, 'MULTIPLY', h1, 0.6), _toan(nt, 'MULTIPLY', h2, 0.3))
    h = _toan(nt, 'ADD', h, _toan(nt, 'MULTIPLY', ro.outputs['Fac'], 0.1))
    return h, h1


def _cao_kim(nt, tc, H):
    tam = _voronoi(nt, tc, 14 / H, do='CHEBYCHEV')                    # tấm thép ô vuông (Chebychev → cạnh thẳng)
    d = tam.outputs['Distance']
    ranh = _dai(nt, d, 0.0, 0.012)                                    # rãnh nối mảnh: 0 ở mép tấm
    cham = _voronoi(nt, tc, 14 * 10 / H, tinh='F1', do='CHEBYCHEV'); cham.inputs['Randomness'].default_value = 0.0
    dinh = _dai(nt, cham.outputs['Distance'], 0.15, 0.25, 1.0, 0.0)   # lưới núm đều …
    dai = _toan(nt, 'MULTIPLY', _dai(nt, d, 0.015, 0.03), _dai(nt, d, 0.06, 0.08, 1.0, 0.0))
    dinh = _toan(nt, 'MULTIPLY', dinh, dai)                           # … chỉ giữ một hàng sát rãnh = đinh tán
    mp = _n(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 1, 8); nt.links.new(tc, mp.inputs['Vector'])
    vet = _n(nt, 'ShaderNodeTexNoise', Scale=60 / H, Detail=6.0); nt.links.new(mp.outputs['Vector'], vet.inputs['Vector'])
    vet = _dai(nt, _toan(nt, 'ABSOLUTE', _toan(nt, 'SUBTRACT', vet.outputs['Fac'], 0.5), 0), 0.0, 0.006, 1.0, 0.0)   # đường đồng mức mảnh
    vung = _n(nt, 'ShaderNodeTexNoise', Scale=5 / H, Detail=2.0); nt.links.new(tc, vung.inputs['Vector'])
    xuoc = _toan(nt, 'MULTIPLY', vet, _dai(nt, vung.outputs['Fac'], 0.55, 0.65))   # chỉ vài vùng bị xước, không phủ đều
    h = _toan(nt, 'ADD', _toan(nt, 'MULTIPLY', ranh, 0.7), _toan(nt, 'MULTIPLY', dinh, 0.3))
    h = _toan(nt, 'SUBTRACT', h, _toan(nt, 'MULTIPLY', xuoc, 0.05))
    return h, ranh, xuoc


def phu(obj, loai, H):
    for vl in {s.material for s in obj.material_slots if s.material}:
        nt = vl.node_tree; bs = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bs: continue
        tc = _n(nt, 'ShaderNodeTexCoord').outputs['Object']
        mau = bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].links else None
        phap = bs.inputs['Normal'].links[0].from_socket if bs.inputs['Normal'].links else None
        ao = _n(nt, 'ShaderNodeAmbientOcclusion', samples=16, only_local=True, Distance=0.03 * H)
        ham = _dai(nt, ao.outputs['AO'], 0.2, 1.0, 0.45, 1.0)          # hốc tối (bẩn / bóng kẽ) — xoá vẻ "đất nặn"
        if loai == 'da':
            h, h1 = _cao_da(nt, tc, H)
            van = _n(nt, 'ShaderNodeTexNoise', Scale=8 / H, Detail=4.0); nt.links.new(tc, van.inputs['Vector'])   # vằn / đốm màu da
            sac = _toan(nt, 'MULTIPLY', _toan(nt, 'MULTIPLY', _dai(nt, h1, 0.0, 0.5, 0.72, 1.04), ham), _dai(nt, van.outputs['Fac'], 0.35, 0.65, 0.78, 1.1))
            nham = _dai(nt, h1, 0.0, 1.0, 0.88, 0.6)
            bs.inputs['Metallic'].default_value = 0.0   # da không phải kim loại (TRELLIS gán 1,0 → kẽ nhám lại loé sáng hơn mặt vảy)
            manh, xa = 1.0, 0.012 * H
        else:
            h, ranh, xuoc = _cao_kim(nt, tc, H)
            sac = _toan(nt, 'MULTIPLY', _toan(nt, 'ADD', _dai(nt, ranh, 0.0, 1.0, 0.35, 1.0), _toan(nt, 'MULTIPLY', xuoc, 0.25)), ham)
            nham = _toan(nt, 'SUBTRACT', _dai(nt, ranh, 0.0, 1.0, 0.9, 0.55), _toan(nt, 'MULTIPLY', xuoc, 0.3))
            manh, xa = 1.0, 0.003 * H
        nt.links.new(_nhan_mau(nt, mau, sac), bs.inputs['Base Color'])
        nt.links.new(nham, bs.inputs['Roughness'])
        bu = _n(nt, 'ShaderNodeBump', Strength=manh, Distance=xa); nt.links.new(h, bu.inputs['Height'])
        if phap: nt.links.new(phap, bu.inputs['Normal'])
        nt.links.new(bu.outputs['Normal'], bs.inputs['Normal'])
