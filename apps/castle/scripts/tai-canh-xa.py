#!/usr/bin/env python3
"""CẢNH XA TỚI CHÂN TRỜI cho Neuschwanstein (anh 21/11/2026 "làm theo đề xuất 2-3-1", bước 2): ảnh trực giao thật phủ lên địa hình thật tới 10 km, không AI.

  ~/.venvs/castle-khop/bin/python apps/castle/scripts/tai-canh-xa.py [--tu-kiem]

Nguồn (miễn phí, giấy phép mở — ghi trong tệp ra):
  ảnh   Bavaria DOP20 qua WMS geoservices.bayern.de/od/wms/dop/v1/dop20 (CC BY 4.0) · phần đất Áo (WMS trả trắng) lấp bằng basemap.at orthofoto (CC BY 4.0)
  cao   Bavaria DGM1 ô 1 km (download1.bayernwolke.de, CC BY 4.0, mặt đất trần) trong vòng giữa · Copernicus GLO-30 (ESA, © DLR/Airbus, giấy phép mở) cho phần còn lại
Ba vòng, mỗi vòng một ảnh vuông thẳng trục cảnh (x đông, z nam), tâm = tâm lâu đài:
  noi   ±420 m (lưới đất EU-DEM đang có của ns.js) — chỉ ảnh, 2048 px ≈ 0,41 m/px
  giua  ±2100 m, lưới 20 m — ảnh 2048 px ≈ 2 m/px + cây: điểm rừng (ảnh xanh tối) trong ±1200 m, đứng trên DGM1
  xa    ±10000 m, lưới 50 m — ảnh 4096 px ≈ 4,9 m/px (bản 2048 cho máy yếu)
Ghi public/du-lieu/anh/xa/{noi,giua,xa,xa-2k}.jpg + public/du-lieu/neuschwanstein-xa-{giua,xa}.bin (Uint16 dm, hàng theo z) + neuschwanstein-xa-cay.bin (Int16 dm x, z)
+ neuschwanstein-xa.json. Tệp tải về nằm ở du-lieu-goc/xa/ và du-lieu-goc/bayern/ (không vào git), tải lại khi thiếu.
Phép đổi cảnh → UTM32 giống ban-do-lech.py / so-dom20.py; cảnh → kinh vĩ giống scripts/tai-lau-dai-that.mjs (phẳng cục bộ).
tra-repo-ok: three-geo / geo-three (MIT) cần khoá Mapbox/Bing và tải ô lúc chạy; ở đây dữ liệu mở dựng sẵn một lần thành ba tệp tĩnh, chỉ là keo nối.
"""
import io, json, math, sys, time, pathlib, urllib.request
import numpy as np, tifffile
from PIL import Image

GOC = pathlib.Path(__file__).resolve().parent.parent
DL, BY, XA = GOC / 'public/du-lieu', GOC / 'du-lieu-goc/bayern', GOC / 'du-lieu-goc/xa'
LAT, LNG = 47.5576, 10.7498
M_LAT, M_LNG = 111320.0, 111320.0 * math.cos(math.radians(LAT))
E0, N0, K = 631637.44, 5268614.78, 0.99981
_g = math.radians(1.7498 * math.sin(math.radians(LAT))); C, S = math.cos(_g), math.sin(_g)
UA = {'User-Agent': 'castle-canh-xa/1.0'}
VONG = {'noi': (420, 2048), 'giua': (2100, 2048), 'xa': (10000, 4096)}

def utm(x, z):  # cảnh → UTM32 (E, N)
    n = -z; return E0 + (C * x - S * n) * K, N0 + (S * x + C * n) * K

def tai(url, dich=None, lan=4):
    for k in range(lan):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r: b = r.read()
            if dich: dich.write_bytes(b)
            return b
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if k == lan - 1: raise
        except Exception:
            if k == lan - 1: raise
        time.sleep(2 * (k + 1))

def wms(e0, n0, e1, n1, w, h):  # ảnh DOP20 khung UTM, chia mảnh ≤ 2048 px
    ra = Image.new('RGB', (w, h)); M = 2048
    for oy in range(0, h, M):
        for ox in range(0, w, M):
            ww, hh = min(M, w - ox), min(M, h - oy)
            a0, a1 = e0 + (e1 - e0) * ox / w, e0 + (e1 - e0) * (ox + ww) / w
            b1, b0 = n1 - (n1 - n0) * oy / h, n1 - (n1 - n0) * (oy + hh) / h
            u = ('https://geoservices.bayern.de/od/wms/dop/v1/dop20?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=by_dop20c&STYLES=&CRS=EPSG:25832'
                 f'&BBOX={a0:.2f},{b0:.2f},{a1:.2f},{b1:.2f}&WIDTH={ww}&HEIGHT={hh}&FORMAT=image/jpeg')
            ra.paste(Image.open(io.BytesIO(tai(u))).convert('RGB'), (ox, oy))
    return ra

def anh_vong(ten):
    H, N = VONG[ten]; d = 2 * H / N
    # khung UTM bao hình vuông cảnh đã xoay (+ lề), độ phân giải gần đúng ô cảnh
    goc = [utm(x, z) for x in (-H, H) for z in (-H, H)]
    e0, e1 = min(p[0] for p in goc) - 4 * d, max(p[0] for p in goc) + 4 * d; n0, n1 = min(p[1] for p in goc) - 4 * d, max(p[1] for p in goc) + 4 * d
    w, h = int(round((e1 - e0) / d)), int(round((n1 - n0) / d)); rx, ry = (e1 - e0) / w, (n1 - n0) / h
    nguon = wms(e0, n0, e1, n1, w, h)
    # ảnh ra (u, v) → cảnh (x, z) → UTM → điểm ảnh nguồn: tuyến tính → PIL AFFINE
    def nguon_px(u, v):
        E, Nn = utm(-H + u * d, -H + v * d); return (E - e0) / rx, (n1 - Nn) / ry
    p0, pu, pv = nguon_px(0, 0), nguon_px(1, 0), nguon_px(0, 1)
    aff = (pu[0] - p0[0], pv[0] - p0[0], p0[0], pu[1] - p0[1], pv[1] - p0[1], p0[1])
    im = np.asarray(nguon.transform((N, N), Image.AFFINE, aff, resample=Image.BILINEAR)).copy()
    trang = im.min(axis=2) >= 250  # ngoài Bavaria: WMS trả trắng
    if trang.any(): lap_ao(im, trang, H, d, ten)
    return Image.fromarray(im)

def lap_ao(im, trang, H, d, ten):  # lấp phần đất Áo bằng basemap.at orthofoto (Web Mercator)
    Z = 17 if d < 1 else 16 if d < 3 else 14
    vs, us = np.nonzero(trang); x = -H + (us + 0.5) * d; z = -H + (vs + 0.5) * d
    la, ln = LAT - z / M_LAT, LNG + x / M_LNG; n2 = 256 * 2 ** Z
    px = (ln + 180) / 360 * n2; py = (1 - np.log(np.tan(np.radians(la)) + 1 / np.cos(np.radians(la))) / math.pi) / 2 * n2
    tx, ty = (px // 256).astype(int), (py // 256).astype(int); o = {}
    for a, b in set(zip(tx.tolist(), ty.tolist())):
        f = XA / f'at-{Z}-{a}-{b}.jpg'
        if not f.exists():
            if tai(f'https://maps.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{Z}/{b}/{a}.jpeg', f) is None: continue
            time.sleep(0.05)
        try: o[(a, b)] = np.asarray(Image.open(f).convert('RGB'))
        except Exception: pass
    def lay(px, py, tx, ty):  # màu basemap.at tại điểm (NaN khi ô không có)
        ra = np.full((len(px), 3), np.nan)
        for i in range(len(px)):
            t = o.get((tx[i], ty[i]))
            if t is not None: ra[i] = t[int(py[i]) % 256, int(px[i]) % 256]
        return ra
    mau = lay(px, py, tx, ty)
    # CHỈNH MÀU về DOP Bavaria: hai nguồn chụp khác mùa / khác máy → ranh giới lộ rõ (ảnh Áo ngả xanh lạnh). Lấy dải phía Bavaria giáp ranh (≤ 600 m) mà ô basemap.at
    # cũng phủ, khớp trung bình + độ lệch chuẩn từng kênh (basemap → DOP) rồi áp cho phần lấp
    tv, tu = np.nonzero(~trang); ga = np.zeros(trang.shape, bool); b = max(1, int(600 / d))
    for dy in range(-b, b + 1, max(1, b // 6)):
        for dx in range(-b, b + 1, max(1, b // 6)): ga |= np.roll(np.roll(trang, dy, 0), dx, 1)
    vb, ub = np.nonzero(ga & ~trang); k = np.linspace(0, len(vb) - 1, min(len(vb), 40000)).astype(int); vb, ub = vb[k], ub[k]
    x2, z2 = -H + (ub + 0.5) * d, -H + (vb + 0.5) * d; la2, ln2 = LAT - z2 / M_LAT, LNG + x2 / M_LNG
    px2 = (ln2 + 180) / 360 * n2; py2 = (1 - np.log(np.tan(np.radians(la2)) + 1 / np.cos(np.radians(la2))) / math.pi) / 2 * n2
    m2 = lay(px2, py2, (px2 // 256).astype(int), (py2 // 256).astype(int)); dop = im[vb, ub].astype(float); co = np.isfinite(m2).all(1) & (m2.min(1) > 5) & (m2.max(1) < 250)
    if co.sum() > 500:
        a_m, a_s, d_m, d_s = m2[co].mean(0), m2[co].std(0) + 1e-3, dop[co].mean(0), dop[co].std(0)
        mau = (mau - a_m) / a_s * d_s + d_m; print(f'   {ten}: chỉnh màu Áo theo {co.sum()} điểm giáp ranh — basemap {a_m.round()} → DOP {d_m.round()}')
    co = np.isfinite(mau).all(1); im[vs[co], us[co]] = np.clip(mau[co], 0, 255).astype(np.uint8)
    print(f'   {ten}: lấp {co.sum()}/{len(vs)} điểm ảnh đất Áo bằng basemap.at (z{Z}, {len(o)} ô)')

COP = None
def cop(x, z):  # Copernicus GLO-30, nội suy song tuyến (mảng numpy)
    global COP
    if COP is None:
        f = XA / 'cop30-N47E010.tif'
        if not f.exists(): tai('https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N47_00_E010_00_DEM/Copernicus_DSM_COG_10_N47_00_E010_00_DEM.tif', f)
        COP = tifffile.imread(f)
    la, ln = LAT - z / M_LAT, LNG + x / M_LNG; fi, fj = (48 - la) * 3600 - 0.5, (ln - 10) * 3600 - 0.5
    i, j = np.floor(fi).astype(int), np.floor(fj).astype(int); u, v = fj - j, fi - i
    A = lambda a, b: COP[np.clip(a, 0, 3599), np.clip(b, 0, 3599)]
    return (A(i, j) * (1 - u) + A(i, j + 1) * u) * (1 - v) + (A(i + 1, j) * (1 - u) + A(i + 1, j + 1) * u) * v

DGM = {}
def dgm(x, z):  # Bavaria DGM1 (mặt đất trần), NaN ngoài Bavaria / ô không có
    E, Nn = utm(x, z); ra = np.full(np.shape(x), np.nan)
    te, tn = (np.floor(E / 1000)).astype(int), (np.floor(Nn / 1000)).astype(int)
    for a, b in set(zip(te.ravel().tolist(), tn.ravel().tolist())):
        if (a, b) not in DGM:
            f = BY / f'dgm1-{a}_{b}.tif'
            if not f.exists() and tai(f'https://download1.bayernwolke.de/a/dgm/dgm1/{a}_{b}.tif', f) is None: DGM[(a, b)] = None; continue
            with tifffile.TiffFile(f) as tf:  # ô ở biên giới nhỏ hơn 1000×1000 và lệch gốc: đọc gốc + cỡ điểm ảnh từ thẻ GeoTIFF
                tg = tf.pages[0].tags; tp, sc = tg['ModelTiepointTag'].value, tg['ModelPixelScaleTag'].value
                DGM[(a, b)] = (tf.asarray(), tp[3], tp[4], sc[0], sc[1])
        if DGM[(a, b)] is None: continue
        t, ex, ny, sx, sy = DGM[(a, b)]
        m = (te == a) & (tn == b); j = np.floor((E[m] - ex) / sx).astype(int); i = np.floor((ny - Nn[m]) / sy).astype(int)
        ok = (i >= 0) & (i < t.shape[0]) & (j >= 0) & (j < t.shape[1]); v = np.full(i.shape, np.nan)
        v[ok] = t[i[ok], j[ok]]; v[v < -1000] = np.nan; ra[m] = v
    return ra

def luoi(H, buoc, dung_dgm):
    n = int(round(2 * H / buoc)) + 1; t = -H + np.arange(n) * buoc; x, z = np.meshgrid(t, t)
    h = cop(x, z)
    if dung_dgm:  # vòng giữa: mặt đất trần DGM1 ở phần Bavaria, hoà dần sang Copernicus ở mép ngoài (1700 → 2100 m) cho khớp vòng xa
        g = dgm(x, z); co = np.isfinite(g); r = np.maximum(np.abs(x), np.abs(z)); w = np.clip((r - 1700) / 400, 0, 1)
        h = np.where(co, g * (1 - w) + h * w, h); print(f'   giua: DGM1 phủ {100 * co.mean():.0f}% lưới ({sum(v is not None for v in DGM.values())} ô 1 km)')
    return n, h

def cay(im_giua, h_giua):  # điểm rừng trong ±1200 m (ngoài ±405 m — rừng gần do ns.js dựng): ảnh xanh tối, chỉ phần có DGM1 (đất trần, cây không lơ lửng)
    H, N = VONG['giua']; d = 2 * H / N; a = np.asarray(im_giua).astype(int); r0 = np.random.default_rng(7); ds = []
    for z in np.arange(-1200, 1200, 11.0):
        for x in np.arange(-1200, 1200, 11.0):
            x1, z1 = x + r0.uniform(-4, 4), z + r0.uniform(-4, 4)
            if max(abs(x1), abs(z1)) < 405: continue
            u, v = int((x1 + H) / d), int((z1 + H) / d); p = a[v - 1:v + 2, u - 1:u + 2].reshape(-1, 3).mean(0)
            if p[1] > p[0] + 4 and p[1] >= p[2] and p.sum() < 260: ds.append((x1, z1))
    ds = np.array(ds); co = np.isfinite(dgm(ds[:, 0], ds[:, 1])); return ds[co]

def tu_kiem():
    ok = True
    def kt(d, s): nonlocal ok; ok &= bool(d); print(('  ✓ ' if d else '  ✗ ') + s)
    E, Nn = utm(0, 0); kt(abs(E - E0) < 1e-6 and abs(Nn - N0) < 1e-6, 'tâm cảnh = UTM gốc')
    E, Nn = utm(0, -1000); kt(990 < Nn - N0 < 1001 and abs(E - E0) < 40, 'đi 1 km về bắc (−z) → N tăng ~1 km, E lệch ít (hội tụ kinh tuyến)')
    h = float(cop(np.array(0.0), np.array(0.0))); kt(940 < h < 1000, f'Copernicus tại tâm {h:.0f} m (sân lâu đài ~965–973 m)')
    g = float(dgm(np.array([0.0]), np.array([0.0]))[0]); kt(940 < g < 1000, f'DGM1 tại tâm {g:.0f} m')
    g = float(dgm(np.array([0.0]), np.array([4000.0]))[0]); kt(not np.isfinite(g), 'DGM1 4 km về nam (đất Áo) = không có (NaN), không phải số rác')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    XA.mkdir(parents=True, exist_ok=True)
    if '--tu-kiem' in sys.argv: tu_kiem()
    (DL / 'anh/xa').mkdir(parents=True, exist_ok=True); ra = {'ghi_chu': 'scripts/tai-canh-xa.py — cảnh xa: ảnh trực giao trên địa hình thật', 'vong': {}}
    for ten in ('noi', 'giua', 'xa'):
        t0 = time.time(); im = anh_vong(ten); H, N = VONG[ten]
        im.save(DL / f'anh/xa/{ten}.jpg', quality=82, optimize=True)
        if ten == 'xa': im.resize((2048, 2048), Image.LANCZOS).save(DL / 'anh/xa/xa-2k.jpg', quality=82, optimize=True)
        ra['vong'][ten] = {'nua': H, 'anh': f'anh/xa/{ten}.jpg'}; print(f'   {ten}: ảnh ±{H} m {N} px · {time.time() - t0:.0f} giây')
        if ten == 'giua': im_giua = im
    for ten, buoc in (('giua', 20), ('xa', 50)):
        n, h = luoi(VONG[ten][0], buoc, ten == 'giua'); (DL / f'neuschwanstein-xa-{ten}.bin').write_bytes(np.clip(np.round(h * 10), 0, 65535).astype('<u2').tobytes())
        ra['vong'][ten].update({'n': n, 'buoc': buoc, 'cao': f'neuschwanstein-xa-{ten}.bin'}); print(f'   {ten}: lưới {n}×{n} · {buoc} m · cao {h.min():.0f}–{h.max():.0f} m')
    ds = cay(im_giua, None); (DL / 'neuschwanstein-xa-cay.bin').write_bytes(np.round(ds * 10).astype('<i2').tobytes())
    ra['cay'] = {'tep': 'neuschwanstein-xa-cay.bin', 'so': len(ds)}; print(f'   cây vòng giữa: {len(ds)}')
    ra['xa_mac'] = 'xa-2k.jpg cho máy yếu'
    ra['nguon'] = 'Ảnh: Bayerische Vermessungsverwaltung DOP20 (CC BY 4.0), basemap.at (CC BY 4.0). Địa hình: Bayerische Vermessungsverwaltung DGM1 (CC BY 4.0), Copernicus GLO-30 (© DLR e.V. 2010-2014 và © Airbus Defence and Space GmbH 2014-2018, cung cấp theo chương trình COPERNICUS của Liên minh châu Âu và ESA).'
    (DL / 'neuschwanstein-xa.json').write_text(json.dumps(ra, ensure_ascii=False, indent=1) + '\n'); print('ghi', DL / 'neuschwanstein-xa.json')
