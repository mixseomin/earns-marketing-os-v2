"""GIÁ ADSENSE + HOÃN TĂNG (anh 12/11/2026: "5. Đo giá adsense · 1. Làm phần hoãn").
Doanh thu Ethopex = AdSense trên trang đích (cột REVENUE: "Revenue on the demand side (AdSense)"). Ngày 12/11 ROI cả hệ từ +16% xuống −8%
mà CPM Facebook không tăng: Impression RPM AdSense Mỹ tụt 185 → 140 (−24%), Fill rate 72,6% → 66,8% — bên mua quảng cáo AdSense rút sau đợt bán hàng 11/11.
Trước đây máy chỉ đo CPM (phía chi) nên không thấy.

dong-bo.py gọi chay(q) mỗi lượt (10 phút):
  1. ĐO — report Ethopex theo nước (cả nhà + đội: đây là giá thị trường) hôm qua + hôm nay (sổ trống → nạp 14 ngày) → etp.cau_hinh 'rpm_ngay'
     {ngày UTC: {chi, thu, roi, irpm, fill, prpm, nuoc: {US: {chi, thu, roi, cpm, irpm, fill, hoa_von}, … 8 nước chi nhiều nhất}}}
     irpm = revenue / impressions AdSense × 1000 · fill = impressions / ad_requests × 100 · prpm = revenue / page_views × 1000 ·
     hoa_von = cost / impressions AdSense × 1000 (irpm dưới số này là lỗ).
  2. HOÃN — Impression RPM Mỹ hôm nay < 85% trung bình 7 ngày trước → etp.cau_hinh 'hoan_rpm'.bat = true; về lại ≥ 90% → tắt (vùng đệm 85–90% chống lật).
     Hôm nay chưa đủ IMP_MIN lượt hiển thị AdSense Mỹ (sáng sớm) → giữ trạng thái cũ. cong.kiem đọc cờ: chặn TĂNG ngân sách + NHÂN BẢN (kể cả thang);
     vẫn chạy: giảm / tắt / camp mới $1 từ creative / camp thay camp bị phốt (--thay) / camp ★ ROAS / lệnh đích danh của anh.
  2b. HỆ SỐ GIÁ — etp.cau_hinh 'he_so_rpm' {ngày UTC: Impression RPM cả hệ ngày đó / trung bình 7 ngày trước}, CHỈ ngày giá tụt (< 1), kẹp ≥ HS_SAN.
     Mọi chỗ đọc dùng CHUNG đoạn SQL hs_sql(cột ngày) ở tệp này (ngày không có = 1). Luật cắt camp mới (T8 · T1 · T1 24 giờ · T2, luat-ethopex.py) và đếm
     camp lãi của phim (cat_phim.py) chia thu ngày đó cho hệ số trước khi so ngưỡng: camp dò đường $1 không bị cắt / phim không bị cất chỉ vì giá AdSense cả chợ tụt.
     Anh 13/11/2026: "nếu mai thị trường hồi lại, cú sụt giảm này khiến các camp dò đường $1 có được đánh giá đúng ko?" — đo: ngày 12/11 (hệ số 0,80) 12 / 106
     camp mới chạm T8 / T1 24 giờ chỉ vì giá tụt. Ngày giá cao (> 1) KHÔNG bù ngược: ngưỡng luật đã đo trên số thô các ngày thường.
  3. BÁO — Telegram (etp.canh_bao 'rpm') khi cờ bật / tắt, và cảnh báo vàng một lần mỗi ngày khi RPM Mỹ < 85% nền.
Tự kiểm: python3 apps/etp/gia_adsense.py"""
import json, datetime as dt

NGUONG_BAT, NGUONG_TAT, IMP_MIN, NUOC = 0.85, 0.90, 3000, "US"
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

def quyet(so, hn, cu):
    """hàm thuần: sổ rpm_ngay + ngày UTC + trạng thái cũ → trạng thái hoãn mới {bat, irpm, nen, ti, ly_do}"""
    cu = cu or {}; bat = bool(cu.get("bat"))
    nen_ds = [v["nuoc"][NUOC]["irpm"] for k, v in sorted(so.items()) if k < hn and (v.get("nuoc") or {}).get(NUOC, {}).get("irpm")][-7:]
    h = ((so.get(hn) or {}).get("nuoc") or {}).get(NUOC) or {}
    if len(nen_ds) < 5: return {**cu, "bat": bat, "ly_do": "chưa đủ 5 ngày nền — giữ trạng thái cũ"}
    nen = sum(nen_ds) / len(nen_ds)
    if not h.get("irpm") or (h.get("imp") or 0) < IMP_MIN:
        return {**cu, "bat": bat, "nen": round(nen, 1), "ly_do": f"hôm nay mới {h.get('imp') or 0} lượt hiển thị AdSense Mỹ (< {IMP_MIN}) — giữ trạng thái cũ"}
    ti = h["irpm"] / nen
    moi = (ti < NGUONG_BAT) if not bat else (ti < NGUONG_TAT)
    ly = (f"Impression RPM Mỹ {h['irpm']:.0f} = {ti * 100:.0f}% trung bình 7 ngày ({nen:.0f})"
          + (f" · hoà vốn {h['hoa_von']:.0f}" if h.get("hoa_von") else "") + (f" · Fill {h['fill']:.1f}%" if h.get("fill") else ""))
    return {"bat": moi, "irpm": h["irpm"], "nen": round(nen, 1), "ti": round(ti, 3), "ngay": hn, "ly_do": ly}

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
    so, cu = ch("rpm_ngay", "{}"), ch("hoan_rpm", "{}")
    luc = luc or dt.datetime.now(dt.timezone.utc); hn = luc.date()
    ngay = [hn - dt.timedelta(days=i) for i in (range(14, -1, -1) if len(so) < 8 else (1, 0))]
    for d in ngay:
        rows = EA.doc_het("/api/v1/report", {"columns": COT, "group_by": ["geo"], "filters": {}, "metric_conditions": [], "limit": 10000, "page": 1,
                                             "page_size": 10000, "date_from": d.isoformat(), "date_to": d.isoformat()}, 120)["rows"]
        if rows: so[d.isoformat()] = tong_ngay(rows)
    so = {k: so[k] for k in sorted(so)[-60:]}
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('rpm_ngay', $J${json.dumps(so)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('he_so_rpm', $J${json.dumps(he_so(so))}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    moi = quyet(so, hn.isoformat(), cu)
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('hoan_rpm', $J${json.dumps(moi, ensure_ascii=False)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    if bool(moi.get("bat")) != bool(cu.get("bat")):
        chu = (f"HOÃN TĂNG BẬT — {moi['ly_do']}. Máy không tăng ngân sách / không nhân bản camp (giảm, tắt, camp mới $1, camp thay camp bị phốt, ROAS vẫn chạy); tự mở khi RPM Mỹ về ≥ {NGUONG_TAT * 100:.0f}% nền"
               if moi.get("bat") else f"HOÃN TĂNG TẮT — {moi['ly_do']}. Máy tăng / nhân bản lại theo luật thường")
        q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) select 'rpm', 'rpm:' || md5($N${chu}$N$), '{"vang" if moi.get("bat") else "info"}', $N${chu}$N$
              where not exists (select 1 from etp.canh_bao where khoa = 'rpm:' || md5($N${chu}$N$))""")
    return {k: moi.get(k) for k in ("bat", "irpm", "nen", "ti")}

def _tu_kiem():
    nen = {f"2026-11-0{i}": {"nuoc": {"US": {"irpm": 180, "imp": 20000}}} for i in range(3, 10)}
    d = lambda irpm, imp=10000: {**nen, "2026-11-12": {"nuoc": {"US": {"irpm": irpm, "imp": imp, "hoa_von": 148, "fill": 66.8}}}}
    assert quyet(d(140), "2026-11-12", {})["bat"] is True, "RPM 78% nền phải bật"
    assert quyet(d(160), "2026-11-12", {})["bat"] is False, "RPM 89% nền chưa bật"
    assert quyet(d(160), "2026-11-12", {"bat": True})["bat"] is True, "đang hoãn, 89% (vùng đệm) phải giữ"
    assert quyet(d(163), "2026-11-12", {"bat": True})["bat"] is False, "về 90% phải tắt"
    assert quyet(d(100, imp=500), "2026-11-12", {"bat": False})["bat"] is False, "ít lượt hiển thị → giữ trạng thái cũ"
    assert quyet(d(200, imp=500), "2026-11-12", {"bat": True})["bat"] is True, "ít lượt hiển thị → giữ hoãn qua đêm"
    assert quyet({"2026-11-12": {"nuoc": {"US": {"irpm": 50, "imp": 9999}}}}, "2026-11-12", {})["bat"] is False, "thiếu nền → không bật"
    t = tong_ngay([{"geo": "(US) United States", "cost": 100, "revenue": 90, "supply_impressions": 4000, "impressions": 600, "ad_requests": 900, "page_views": 700},
                   {"geo": "(CA) Canada", "cost": 10, "revenue": 5, "supply_impressions": 800, "impressions": 100, "ad_requests": 150, "page_views": 90}])
    assert t["nuoc"]["US"]["irpm"] == 150 and t["nuoc"]["US"]["hoa_von"] == 166.67 and t["chi"] == 110 and list(t["nuoc"]) == ["US", "CA"], t
    hs = he_so({**{f"2026-11-0{i}": {"irpm": 120, "imp": 9000} for i in range(3, 10)}, "2026-11-10": {"irpm": 96, "imp": 9000}, "2026-11-11": {"irpm": 150, "imp": 9000},
                "2026-11-12": {"irpm": 30, "imp": 9000}, "2026-11-13": {"irpm": 60, "imp": 100}})
    assert hs == {"2026-11-10": 0.8, "2026-11-12": HS_SAN}, hs   # giá cao không bù ngược · kẹp sàn · ít lượt hiển thị không ghi
    assert "gia_tri ->> (s.ngay)::text" in hs_sql("s.ngay")
    print("✓ gia_adsense.py tự kiểm (bật < 85%, vùng đệm 85–90%, ít số giữ trạng thái, thiếu nền không bật, tính RPM / hoà vốn, hệ số giá: 10 ca)")

if __name__ == "__main__": _tu_kiem()
