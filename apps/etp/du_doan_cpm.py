"""NHẬT KÝ DỰ ĐOÁN CPM ↔ THỰC TẾ (anh 11/11/2026: "có log cụ thể xem dự đoán so với thực tế").
dong-bo.py gọi chay(q) mỗi lượt (sau khi ghi cpm_ngay). Mỗi ngày Ethopex (UTC) MỘT lần, sau GIO_CHUP giờ UTC (13:00 VN — số hôm qua đã khép):
chụp dự đoán CPM cho hôm nay + 14 ngày tới vào etp.cau_hinh.cpm_du_doan {ngày làm: {ngày đích: {cpm, h}}}. Widget Thị trường etp2 (lib/etp-thi-truong.ts doiChieu)
đặt CPM thật cạnh dự đoán làm trước 1 / 3 / 7 ngày.
CÙNG CÁCH TÍNH với widget (lib/etp-thi-truong.ts: nen · hieuChinh · ngayThiTruong) — hệ số mùa đọc CHUNG apps/etp2/src/lib/etp-mua.json; bài tự kiểm dưới dùng đúng số
của etp-thi-truong.test.mts (22 × 1,8 cho Black Friday) để hai bên không lệch.
Ngày làm TRƯỚC khi máy bắt đầu chụp (11/11/2026) → DỰNG LẠI một lần bằng đúng cách này trên số cũ, đánh dấu dl = true (bảng ghi "dựng lại", không giả làm bản chụp thật).
Tự kiểm: python3 apps/etp/du_doan_cpm.py"""
import json, os, datetime as dt

MUA = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "etp2", "src", "lib", "etp-mua.json")))["mua"]
GIO_CHUP, XA, GIU_NGAY, DUNG_LAI = 6, 14, 60, 21

def he_so(d):
    m = next((x for x in MUA if x[0] <= d <= x[1]), None)
    return m[2] if m else 1.0

cong = lambda d, n: (dt.date.fromisoformat(d) + dt.timedelta(days=n)).isoformat()
da_khep = lambda so, nay: sorted((d, v) for d, v in so.items() if d < nay and (v.get("cpm") or 0) > 0)

def du_doan(so, nay, dich):
    """CPM đoán cho ngày `dich` khi đang ở ngày `nay` — = ngayThiTruong (TS): nền = ngày đã khép gần nhất bỏ hệ số × hệ số đích (đã hiệu chỉnh nếu đủ ngày mùa)"""
    ds = da_khep(so, nay)
    if not ds: return None, None
    dn, vn = ds[-1]; nen = vn["cpm"] / he_so(dn)
    r = [(v["cpm"] / (ds[i - 1][1]["cpm"] / he_so(ds[i - 1][0])) - 1) / (he_so(d) - 1) for i, (d, v) in enumerate(ds) if i and he_so(d) > 1.0001]
    h = he_so(dich)
    if len(r) >= 2 and h > 1: h = 1 + (h - 1) * max(0.3, min(2.0, sum(r) / len(r)))
    return nen * h, round(h, 2)

def chup(so, nay, dl=False):
    ra = {}
    for i in range(0, XA + 1):
        d = cong(nay, i); c, h = du_doan(so, nay, d)
        if c: ra[d] = {"cpm": round(c, 2), "h": h, **({"dl": True} if dl else {})}
    return ra

def chay(q, luc=None):
    luc = luc or dt.datetime.now(dt.timezone.utc); nay = luc.date().isoformat()
    ch = lambda k: json.loads(q(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{k}'), '{{}}')") or "{}")
    so, nk = ch("cpm_ngay"), ch("cpm_du_doan")
    doi = False
    if not nk:   # lần đầu: dựng lại DUNG_LAI ngày trước bằng đúng cách này trên số cũ (đánh dấu dl)
        for i in range(DUNG_LAI, 0, -1):
            L = cong(nay, -i); x = chup({d: v for d, v in so.items() if d < L}, L, dl=True)
            if x: nk[L] = x; doi = True
    if nay not in nk and luc.hour >= GIO_CHUP:
        x = chup(so, nay)
        if x: nk[nay] = x; doi = True
    if doi:
        nk = {k: v for k, v in nk.items() if k >= cong(nay, -GIU_NGAY)}
        q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('cpm_du_doan', $J${json.dumps(nk)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    return {"ngay_lam": len(nk), "hom_nay": nay in nk}

if __name__ == "__main__":
    so = {f"2026-11-{i:02d}": {"chi": 1000, "cpm": 20, "cpc": 0.6, "roi": 20} for i in range(1, 11)}
    so["2026-11-10"] = {"chi": 1000, "cpm": 22, "cpc": 0.66, "roi": 25}; so["2026-11-11"] = {"chi": 400, "cpm": 23, "cpc": 0.8, "roi": 27}
    c, h = du_doan(so, "2026-11-11", "2026-11-27"); assert abs(c - 22 * 1.8) < 1e-9 and h == 1.8, (c, h)   # = etp-thi-truong.test.mts (bf)
    assert du_doan({}, "2026-11-11", "2026-11-12") == (None, None)
    x = chup(so, "2026-11-11"); assert "2026-11-11" in x and "2026-11-25" in x and "2026-11-26" not in x, sorted(x)
    assert he_so("2026-10-25") == 1.0 and he_so("2026-11-30") == 1.6
    class Q:
        def __init__(s, kho): s.kho = kho; s.ghi = []
        def __call__(s, cau):
            if cau.startswith("select"): return json.dumps(s.kho.get(cau.split("khoa = '")[1].split("'")[0], {}))
            s.ghi.append(cau); return ""
    q_ = Q({"cpm_ngay": so}); r = chay(q_, dt.datetime(2026, 11, 11, 3, tzinfo=dt.timezone.utc))
    assert not r["hom_nay"] and q_.ghi and '"dl": true' in q_.ghi[0], r            # 03 UTC: chỉ dựng lại, chưa chụp hôm nay
    q_ = Q({"cpm_ngay": so, "cpm_du_doan": {"2026-11-10": {}}}); r = chay(q_, dt.datetime(2026, 11, 11, 7, tzinfo=dt.timezone.utc))
    assert r["hom_nay"] and '"2026-11-11"' in q_.ghi[0], r                          # 07 UTC: chụp hôm nay
    q_ = Q({"cpm_ngay": so, "cpm_du_doan": {"2026-11-11": {"x": 1}}}); chay(q_, dt.datetime(2026, 11, 11, 9, tzinfo=dt.timezone.utc)); assert not q_.ghi   # đã chụp: không ghi lại
    print("✓ du_doan_cpm tự kiểm: khớp số TS (BF 22 × 1,8) · thiếu số · 15 ngày đích · giờ chụp · dựng lại đánh dấu · mỗi ngày một lần")
