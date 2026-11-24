"""ĐỔI TOẠ ĐỘ CẢNH ↔ UTM 32N (ô Bavaria 631_5268) — MỘT chỗ cho mọi máy đọc DOM20 / DGM1 / DOP20 (24/11/2026).
Trước đây 7 máy (be-mat-dop20, cay-tu-dom, khoi-thieu-dom20, keo-mep-san, san-cong-dop, so-dat-dgm1, dat-theo-dgm1) chép tay công thức và viết cứng
độ dời mặt bằng OSM → dữ liệu chính thức là (+7 đông, +1 nam) — số lấy theo ảnh Google ngày 15/11. so-dom20.py đo lại trên 4015 điểm ra (+6, +1):
lệch 1 m đủ để khoi-thieu-dom20 đo một mảnh LoD2 4,5 m ở mép tây trúng mái khối kế bên, dựng khối cao 21 m chỗ thật chỉ có tường 5 m.
Nay độ dời đọc thẳng từ du-lieu-goc/bayern/so-dom20.json (so-dom20.py ghi); thiếu tệp thì dừng hẳn, không đoán.
  import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from toa_do_bayern import EN, canh, DX, DZ
  dsKhoi()  mặt bằng khối đúng như trang dựng (áp "ngoai" ghi đè trong sua.json) — máy nào cần mặt bằng thì gọi hàm này, không đọc thẳng <lâu>.json
  EN(x, z)   cảnh (đã dời) → (E, N) mét UTM · canh(E, N) → (x, z) cảnh · o20(E, N) / o1(E, N) → (hàng, cột) lưới 20 cm / 1 m
tra-repo-ok: hằng số phép chiếu riêng của cảnh (gốc, góc lệch kinh tuyến, hệ số tỉ lệ UTM), không có thư viện nào chứa."""
import json, math, pathlib
BY = pathlib.Path(__file__).resolve().parent.parent / 'du-lieu-goc/bayern'
E0, N0, K = 631637.44, 5268614.78, 0.99981
G = math.radians(1.7498 * math.sin(math.radians(47.5576))); C, S = math.cos(G), math.sin(G)
_f = BY / 'so-dom20.json'
if not _f.exists(): raise SystemExit(f'thiếu {_f} — chạy trước: ~/.venvs/castle-khop/bin/python apps/castle/scripts/so-dom20.py (đo độ dời OSM ↔ DOM20)')
_s = json.loads(_f.read_text()); DX, DZ = float(_s['dx']), float(_s['dz'])
def EN(x, z):
    x, n = x + DX, -(z + DZ); return E0 + (C * x - S * n) * K, N0 + (S * x + C * n) * K
def canh(E, N):  # nhận cả mảng numpy
    dE, dN = (E - E0) / K, (N - N0) / K; return dE * C + dN * S - DX, -(-dE * S + dN * C) - DZ
def o20(E, N): return int((5269000 - N) / 0.2), int((E - 631000) / 0.2)
def o1(E, N): return int(5269000 - N), int(E - 631000)
PUB = BY.parent.parent / 'public/du-lieu'
def dsKhoi(lau='neuschwanstein'):
    """Mặt bằng khối ĐÚNG như trang dựng (ns.js): khối OSM thô + ghi đè "ngoai" trong <lâu>-sua.json (keo-mep-dom20.py ghi) + khối them/ chỉ có trong sua.
    Trước đây mỗi máy Python đọc thẳng <lâu>.json['khoi'] → sửa mặt bằng ở sua.json thì trang đổi mà máy đo vẫn nhìn mặt bằng cũ.
    Trả [{'id', 'v': [[x, z], …] (vòng kín), 'tags' (thẻ OSM + thẻ sua, như trang), 'them': bool}]."""
    D = json.loads((PUB / f'{lau}.json').read_text()); SUA = json.loads((PUB / f'{lau}-sua.json').read_text()); ra = []
    for k in D['khoi']:
        e = SUA.get(k['id']) or {}; v = e['ngoai'] if isinstance(e.get('ngoai'), list) and len(e['ngoai']) >= 3 else k['ngoai'][0]
        ra.append({'id': k['id'], 'v': v, 'tags': {**(k.get('tags') or {}), **{a: str(b) for a, b in e.items() if not a.startswith('ly_do') and a != 'ngoai'}}, 'them': False})
    co = {k['id'] for k in D['khoi']}
    for id_, e in SUA.items():
        if id_ not in co and isinstance(e, dict) and isinstance(e.get('ngoai'), list) and len(e['ngoai']) >= 3:
            ra.append({'id': id_, 'v': e['ngoai'], 'tags': {a: str(b) for a, b in e.items() if not a.startswith('ly_do') and a != 'ngoai'}, 'them': True})
    return ra
if __name__ == '__main__':  # tự kiểm: đi rồi về phải trùng; độ dời phải là số so-dom20 đo
    import numpy as np
    for x, z in ((0, 0), (-40, 0), (55.5, -30.25)):
        E, N = EN(x, z); a, b = canh(np.array(E), np.array(N)); assert abs(a - x) < 1e-6 and abs(b - z) < 1e-6, (x, z, a, b)
    E1, _ = EN(1, 0); E0_, _ = EN(0, 0); assert 0.99 < E1 - E0_ < 1.0, E1 - E0_
    K = dsKhoi(); assert K and all(len(k['v']) >= 3 for k in K)
    print(f'✓ {len(K)} khối (đã áp ghi đè sua.json) · đi–về trùng · dời OSM → DOM20 = ({DX:+g}, {DZ:+g}) m theo {_f.name}')
