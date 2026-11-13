"""GIÁ ADSENSE (anh 12/11/2026: "5. Đo giá adsense"; phần hoãn tăng đã bỏ 13/11/2026).
Doanh thu Ethopex = AdSense trên trang đích (cột REVENUE: "Revenue on the demand side (AdSense)"). Ngày 12/11 ROI cả hệ từ +16% xuống −8%
mà CPM Facebook không tăng: Impression RPM AdSense Mỹ tụt 185 → 140 (−24%), Fill rate 72,6% → 66,8% — bên mua quảng cáo AdSense rút sau đợt bán hàng 11/11.
Trước đây máy chỉ đo CPM (phía chi) nên không thấy.

dong-bo.py gọi chay(q) mỗi lượt (10 phút):
  1. ĐO — report Ethopex theo nước (cả nhà + đội: đây là giá thị trường) hôm qua + hôm nay (sổ trống → nạp 14 ngày) → etp.cau_hinh 'rpm_ngay'
     {ngày UTC: {chi, thu, roi, irpm, fill, prpm, nuoc: {US: {chi, thu, roi, cpm, irpm, fill, hoa_von}, … 8 nước chi nhiều nhất}}}
     irpm = revenue / impressions AdSense × 1000 · fill = impressions / ad_requests × 100 · prpm = revenue / page_views × 1000 ·
     hoa_von = cost / impressions AdSense × 1000 (irpm dưới số này là lỗ).
  2. HOÃN TĂNG — ĐÃ BỎ (anh 13/11/2026 "bỏ rule Hoãn đang áp dụng"): giá tụt không còn chặn tăng / nhân bản (cong.kiem đã gỡ cổng).
  2b. HỆ SỐ GIÁ — etp.cau_hinh 'he_so_rpm' {ngày UTC: Impression RPM cả hệ ngày đó / trung bình 7 ngày trước}, CHỈ ngày giá tụt (< 1), kẹp ≥ HS_SAN.
     Mọi chỗ đọc dùng CHUNG đoạn SQL hs_sql(cột ngày) ở tệp này (ngày không có = 1). Luật cắt camp mới (T8 · T1 · T1 24 giờ · T2, luat-ethopex.py) và đếm
     camp lãi của phim (cat_phim.py) chia thu ngày đó cho hệ số trước khi so ngưỡng: camp dò đường $1 không bị cắt / phim không bị cất chỉ vì giá AdSense cả chợ tụt.
     Anh 13/11/2026: "nếu mai thị trường hồi lại, cú sụt giảm này khiến các camp dò đường $1 có được đánh giá đúng ko?" — đo: ngày 12/11 (hệ số 0,80) 12 / 106
     camp mới chạm T8 / T1 24 giờ chỉ vì giá tụt. Ngày giá cao (> 1) KHÔNG bù ngược: ngưỡng luật đã đo trên số thô các ngày thường.
Tự kiểm: python3 apps/etp/gia_adsense.py"""
import json, datetime as dt

IMP_MIN = 3000   # ngày chưa đủ số lượt hiển thị AdSense này thì chưa ghi hệ số giá
HS_SAN = 0.6   # hệ số giá thấp nhất được bù (giá tụt sâu hơn 40% vẫn chỉ bù tới 0,6 — không để một ngày lạ thổi thu lên quá tay)
COT = ["geo", "cost", "revenue", "supply_impressions", "impressions", "ad_requests", "page_views"]

def _ma(geo):   # "(US) United States" → "US"
    s = str(geo or ""); return s[1:s.index(")")] if s.startswith("(") and ")" in s else s[:2].upper()

def tong_ngay(rows):
    """hàm thuần: dòng report theo nước → số ngày {chi, thu, roi, irpm, fill, prpm, nuoc}"""
    def chi_so(c, v, si, im, ar, pv):
        r = lambda a, b, k=1: round(a / b * k, 2) if b else None
        return {"chi": round(c, 2), "thu": round(v, 2), "roi": round((v - c) / c * 100) if c else None, "cpm": r(c, si, 1000),
                "irpm": r(v, im, 1000), "fill": r(im, ar, 100), "prpm": r(v, pv, 1000), "hoa_von": r(c, im, 1000), "imp": round(im)}
    g = {}
    for x in rows:
        e = g.setdefault(_ma(x.get("geo")), [0.0] * 6)
        for i, k in enumerate(COT[1:]): e[i] += float(x.get(k) or 0)
    t = [sum(e[i] for e in g.values()) for i in range(6)]
    kq = chi_so(*t)
    kq["nuoc"] = {k: chi_so(*e) for k, e in sorted(g.items(), key=lambda kv: -kv[1][0])[:8] if e[0] > 0}
    return kq

def he_so(so):
    """hàm thuần: sổ rpm_ngay → {ngày: hệ số giá} — Impression RPM cả hệ / trung bình 7 ngày trước, chỉ ngày < 1, kẹp ≥ HS_SAN; thiếu nền / ít lượt hiển thị → không ghi (= 1)"""
    ks, ra = sorted(so), {}
    for i, k in enumerate(ks):
        nen = [so[x]["irpm"] for x in ks[max(0, i - 7):i] if so[x].get("irpm")]
        v = so[k]
        if len(nen) < 5 or not v.get("irpm") or (v.get("imp") or 0) < IMP_MIN: continue
        t = v["irpm"] / (sum(nen) / len(nen))
        if t < 1: ra[k] = round(max(HS_SAN, t), 3)
    return ra

def hs_sql(cot):
    """biểu thức SQL hệ số giá của ngày ở cột `cot` — chia thu cho nó: f"s.thu / {GA.hs_sql('s.ngay')}" """
    return f"coalesce((select nullif(gia_tri ->> ({cot})::text, '')::numeric from etp.cau_hinh where khoa = 'he_so_rpm'), 1)"

def chay(q, luc=None):
    import ethopex_api as EA
    ch = lambda k, md: json.loads(q(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{k}'), '{md}')") or md)
    so = ch("rpm_ngay", "{}")
    luc = luc or dt.datetime.now(dt.timezone.utc); hn = luc.date()
    ngay = [hn - dt.timedelta(days=i) for i in (range(14, -1, -1) if len(so) < 8 else (1, 0))]
    for d in ngay:
        rows = EA.doc_het("/api/v1/report", {"columns": COT, "group_by": ["geo"], "filters": {}, "metric_conditions": [], "limit": 10000, "page": 1,
                                             "page_size": 10000, "date_from": d.isoformat(), "date_to": d.isoformat()}, 120)["rows"]
        if rows: so[d.isoformat()] = tong_ngay(rows)
    so = {k: so[k] for k in sorted(so)[-60:]}
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('rpm_ngay', $J${json.dumps(so)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('he_so_rpm', $J${json.dumps(he_so(so))}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    return {"he_so": he_so(so).get(hn.isoformat()), "irpm": (so.get(hn.isoformat()) or {}).get("irpm")}

def _tu_kiem():
    t = tong_ngay([{"geo": "(US) United States", "cost": 100, "revenue": 90, "supply_impressions": 4000, "impressions": 600, "ad_requests": 900, "page_views": 700},
                   {"geo": "(CA) Canada", "cost": 10, "revenue": 5, "supply_impressions": 800, "impressions": 100, "ad_requests": 150, "page_views": 90}])
    assert t["nuoc"]["US"]["irpm"] == 150 and t["nuoc"]["US"]["hoa_von"] == 166.67 and t["chi"] == 110 and list(t["nuoc"]) == ["US", "CA"], t
    hs = he_so({**{f"2026-11-0{i}": {"irpm": 120, "imp": 9000} for i in range(3, 10)}, "2026-11-10": {"irpm": 96, "imp": 9000}, "2026-11-11": {"irpm": 150, "imp": 9000},
                "2026-11-12": {"irpm": 30, "imp": 9000}, "2026-11-13": {"irpm": 60, "imp": 100}})
    assert hs == {"2026-11-10": 0.8, "2026-11-12": HS_SAN}, hs   # giá cao không bù ngược · kẹp sàn · ít lượt hiển thị không ghi
    assert "gia_tri ->> (s.ngay)::text" in hs_sql("s.ngay")
    print("✓ gia_adsense.py tự kiểm (tính RPM / hoà vốn, hệ số giá: chỉ ngày tụt, kẹp sàn, ít lượt hiển thị không ghi, đoạn SQL)")

if __name__ == "__main__": _tu_kiem()
