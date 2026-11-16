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
  3. PHANH CHỢ (anh 16/11/2026 "Làm theo đề xuất", sổ luật chung phanh_cho): report theo GIỜ → Impression RPM cả chợ khung 07–13h VN mỗi ngày (etp.cau_hinh 'rpm_13h')
     → xet_phanh: tỉ lệ so trung bình cùng khung 7 ngày trước < ngưỡng thì 13h–20h VN là CẢNH BÁO SỚM, 20h VN chốt PHANH (một lần / ngày) → etp.cau_hinh 'phanh_cho'
     {hom_nay: {ngay, irpm, nen, ti, imp}, som, quyet, phanh: {ngay, nguon so | lich, ti, den_tang, den_len, ly_do}}. cong.kiem chặn tăng tới den_tang, tạo camp / nhân bản
     tới den_len. KHÁC luật hoãn đã bỏ 13/11: đo cả chợ theo khung giờ cố định, chốt một lần mỗi ngày, có hạn tự hết — không phải cờ bật / tắt theo từng lượt.
Tự kiểm: python3 apps/etp/gia_adsense.py"""
import json, os, datetime as dt
PC = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "src", "lib", "etp-bang-luat.json")))["phanh_cho"]   # sổ luật chung
PC_GIO = ((PC["khung_do"][0] - 7) % 24, (PC["khung_do"][1] - 7) % 24); PC_CHOT = (PC["gio_chot"] - 7) % 24   # giờ VN → giờ UTC (ngày Ethopex = ngày UTC)
assert 0 <= PC_GIO[0] < PC_GIO[1] <= PC_CHOT < 24, "khung đo phanh chợ phải nằm trọn trong một ngày Ethopex và trước giờ chốt"

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

def luy_gio(rows, gio=PC_GIO):
    """hàm thuần: dòng report theo giờ → số của khung giờ UTC [từ, tới) {irpm, imp, thu}"""
    v = sum(float(x.get("revenue") or 0) for x in rows if gio[0] <= int(x["hour"]) < gio[1]); im = sum(float(x.get("impressions") or 0) for x in rows if gio[0] <= int(x["hour"]) < gio[1])
    return {"irpm": round(v / im * 1000, 2) if im else None, "imp": round(im), "thu": round(v, 2)}

def xet_phanh(luc, so13, cu, pc=PC):
    """hàm thuần: giờ UTC + sổ rpm_13h + trạng thái cũ → trạng thái phanh_cho mới (xem đầu tệp). Phanh cũ còn hạn thì giữ; mỗi ngày chốt MỘT lần; thiếu số → không phanh (trừ ngày lịch)."""
    hn = luc.date(); k = hn.isoformat(); cu = cu or {}; mot = dt.timedelta(days=1)
    dem0 = lambda d: dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc).isoformat()
    ph = dict(cu["phanh"]) if ((cu.get("phanh") or {}).get("den_len") or "") > luc.isoformat() else None
    # TĂNG CHỈ MỞ KHI GIÁ ĐÃ HỒI (anh 17/11/2026 "làm đi" — đề xuất: sụt xong hệ âm sâu, mở tăng 07:00 là tăng khi chưa biết chợ hồi chưa): phanh tăng giữ tới HẾT
    # khung đo hôm sau (13h VN); tới đó giá 07–13h hôm nay ≥ ngưỡng thì mở, chưa hồi / thiếu số thì giữ tới giờ chốt (20h) — chốt 20h phanh tiếp hoặc nhả.
    # (sửa luôn bản phanh cũ còn den_tang 07:00)
    if ph:
        mo = dt.datetime.fromisoformat(ph["ngay"]).replace(tzinfo=dt.timezone.utc) + mot + dt.timedelta(hours=PC_GIO[1])
        ph["den_tang"] = max(ph["den_tang"], mo.isoformat())
    nen = [so13[x]["irpm"] for x in ((hn - mot * i).isoformat() for i in range(1, pc["nen_ngay"] + 1)) if (so13.get(x) or {}).get("irpm") and (so13[x].get("imp") or 0) >= pc["imp_min"]]
    v = so13.get(k) or {}; tb = sum(nen) / len(nen) if len(nen) >= pc["nen_min"] else None
    ti = round(v["irpm"] / tb, 3) if tb and v.get("irpm") and (v.get("imp") or 0) >= pc["imp_min"] else None
    ra = {"hom_nay": {"ngay": k, "irpm": v.get("irpm"), "imp": v.get("imp"), "nen": round(tb, 1) if tb else None, "ti": ti}, "som": False, "quyet": cu.get("quyet"), "phanh": ph}
    tut = ti is not None and ti < pc["nguong"]
    if ph and ph["ngay"] < k and luc.hour >= PC_GIO[1] and not (ti is not None and ti >= pc["nguong"]):   # hết khung đo hôm sau mà giá chưa hồi → giữ phanh tăng tới giờ chốt
        ph["den_tang"] = max(ph["den_tang"], (dt.datetime(hn.year, hn.month, hn.day, tzinfo=dt.timezone.utc) + dt.timedelta(hours=PC_CHOT)).isoformat())
    if luc.hour < PC_GIO[1]: return ra   # chưa hết khung đo
    if cu.get("quyet") == k: return ra   # hôm nay đã chốt — không lật lại
    if luc.hour < PC_CHOT: ra["som"] = tut; return ra
    ra["quyet"] = k; lich = (hn + mot).isoformat() in pc["lich"]
    if tut or lich:
        ly = (f"Impression RPM cả chợ 07–13h ngày {hn:%d/%m} = {v['irpm']:.0f}, bằng {ti * 100:.0f}% trung bình {len(nen)} ngày trước ({tb:.0f}) — dưới ngưỡng {pc['nguong'] * 100:.0f}%" if tut
              else f"ngày {hn + mot:%d/%m} nằm trong lịch phanh sẵn (sau dịp chi lớn của nhà quảng cáo)")
        ra["phanh"] = {"ngay": k, "nguon": "so" if tut else "lich", "ti": ti, "den_tang": (dt.datetime(hn.year, hn.month, hn.day, tzinfo=dt.timezone.utc) + mot + dt.timedelta(hours=PC_GIO[1])).isoformat(), "den_len": dem0(hn + mot * 2), "ly_do": ly}
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
    kq = {"he_so": he_so(so).get(hn.isoformat()), "irpm": (so.get(hn.isoformat()) or {}).get("irpm")}
    # ── PHANH CHỢ: số khung 07–13h VN — ngày cũ thiếu thì nạp một lần (đã khép, không đổi nữa); hôm nay đọc lại mỗi lượt từ hết khung tới lúc chốt (doanh thu còn về trễ)
    so13, cu = ch("rpm_13h", "{}"), ch("phanh_cho", "{}")
    gio = lambda d: EA.doc_het("/api/v1/report", {"columns": ["hour", "revenue", "impressions"], "group_by": ["hour"], "filters": {}, "metric_conditions": [], "limit": 10000, "page": 1,
                                                 "page_size": 10000, "date_from": d, "date_to": d}, 120)["rows"]
    for i in range(PC["nen_ngay"], 0, -1):
        d = (hn - dt.timedelta(days=i)).isoformat()
        if d not in so13: so13[d] = luy_gio(gio(d))
    if luc.hour >= PC_GIO[1] and cu.get("quyet") != hn.isoformat(): so13[hn.isoformat()] = luy_gio(gio(hn.isoformat()))
    so13 = {k: so13[k] for k in sorted(so13)[-30:]}
    moi = xet_phanh(luc, so13, cu)
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('rpm_13h', $J${json.dumps(so13)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('phanh_cho', $J${json.dumps(moi, ensure_ascii=False)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    bao = None
    if (moi.get("phanh") or {}).get("ngay") == hn.isoformat() and (cu.get("phanh") or {}).get("ngay") != hn.isoformat():
        vn = lambda s: f"{dt.datetime.fromisoformat(s) + dt.timedelta(hours=7):%H:%M %d/%m}"
        bao = ("phanh", f"⛔ PHANH CHỢ — {moi['phanh']['ly_do']}. Máy không tăng bậc tới {vn(moi['phanh']['den_tang'])}, không tạo camp mới / nhân bản tới {vn(moi['phanh']['den_len'])} (giờ VN). "
                        "Giảm / tắt vẫn chạy; camp ★ ROAS, camp thay bài bị từ chối, lệnh anh không bị chặn (sổ luật phanh_cho, apps/etp/gia_adsense.py).")
    elif moi["som"] and not cu.get("som"):
        h = moi["hom_nay"]; bao = ("som", f"⚠ CẢNH BÁO SỚM giá chợ — Impression RPM cả chợ 07–13h hôm nay {h['irpm']:.0f} = {h['ti'] * 100:.0f}% nền 7 ngày ({h['nen']:.0f}); "
                                          f"tới {PC['gio_chot']}:00 vẫn dưới {PC['nguong'] * 100:.0f}% thì máy phanh: đêm nay không tăng bậc, ngày mai không lên camp mới / nhân bản.")
    if bao: q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) select 'phanh_cho', 'phanh_cho:{bao[0]}:{hn.isoformat()}', 'info', $N${bao[1]}$N$
                  where not exists (select 1 from etp.canh_bao where khoa = 'phanh_cho:{bao[0]}:{hn.isoformat()}')""")
    return {**kq, "phanh_cho": {"ti": moi["hom_nay"]["ti"], "som": moi["som"], "phanh": (moi.get("phanh") or {}).get("ngay")}}

def _tu_kiem():
    t = tong_ngay([{"geo": "(US) United States", "cost": 100, "revenue": 90, "supply_impressions": 4000, "impressions": 600, "ad_requests": 900, "page_views": 700},
                   {"geo": "(CA) Canada", "cost": 10, "revenue": 5, "supply_impressions": 800, "impressions": 100, "ad_requests": 150, "page_views": 90}])
    assert t["nuoc"]["US"]["irpm"] == 150 and t["nuoc"]["US"]["hoa_von"] == 166.67 and t["chi"] == 110 and list(t["nuoc"]) == ["US", "CA"], t
    hs = he_so({**{f"2026-11-0{i}": {"irpm": 120, "imp": 9000} for i in range(3, 10)}, "2026-11-10": {"irpm": 96, "imp": 9000}, "2026-11-11": {"irpm": 150, "imp": 9000},
                "2026-11-12": {"irpm": 30, "imp": 9000}, "2026-11-13": {"irpm": 60, "imp": 100}})
    assert hs == {"2026-11-10": 0.8, "2026-11-12": HS_SAN}, hs   # giá cao không bù ngược · kẹp sàn · ít lượt hiển thị không ghi
    assert "gia_tri ->> (s.ngay)::text" in hs_sql("s.ngay")
    # phanh chợ
    assert luy_gio([{"hour": 0, "revenue": 5, "impressions": 50}, {"hour": 5, "revenue": 5, "impressions": 50}, {"hour": 6, "revenue": 99, "impressions": 1}], (0, 6)) == {"irpm": 100.0, "imp": 100, "thu": 10.0}
    u = lambda s: dt.datetime.fromisoformat(s + "+00:00"); nen = {f"2026-11-{d:02d}": {"irpm": 120, "imp": 9000} for d in range(9, 16)}
    tut, deu = {**nen, "2026-11-16": {"irpm": 84, "imp": 9000}}, {**nen, "2026-11-16": {"irpm": 110, "imp": 9000}}
    r = xet_phanh(u("2026-11-16T03:00:00"), tut, {}); assert not r["som"] and not r["phanh"] and r["hom_nay"]["ti"] == 0.7, r   # chưa hết khung đo: chưa báo
    r = xet_phanh(u("2026-11-16T07:00:00"), tut, {}); assert r["som"] and not r["phanh"] and r["quyet"] is None, r   # 14h VN: cảnh báo sớm, chưa chặn
    r = xet_phanh(u("2026-11-16T13:05:00"), tut, r); assert r["phanh"]["nguon"] == "so" and r["phanh"]["den_tang"] == "2026-11-17T06:00:00+00:00" and r["phanh"]["den_len"] == "2026-11-18T00:00:00+00:00" and not r["som"] and r["quyet"] == "2026-11-16", r
    r2 = xet_phanh(u("2026-11-16T15:00:00"), deu, r); assert r2["phanh"] == r["phanh"], "đã chốt hôm nay: số về trễ làm tỉ lệ lên cũng không lật lại"
    r3 = xet_phanh(u("2026-11-17T13:05:00"), {**tut, "2026-11-17": {"irpm": 118, "imp": 9000}}, r2); assert r3["phanh"]["ngay"] == "2026-11-16" and r3["quyet"] == "2026-11-17", r3   # hôm sau giá hồi: phanh cũ giữ tới hết hạn
    h1 = xet_phanh(u("2026-11-17T06:10:00"), {**tut, "2026-11-17": {"irpm": 118, "imp": 9000}}, r2); assert h1["phanh"]["den_tang"] == "2026-11-17T06:00:00+00:00", h1   # 13h hôm sau giá hồi (≥ 85%) → tăng mở 13:00
    h2 = xet_phanh(u("2026-11-17T06:10:00"), {**tut, "2026-11-17": {"irpm": 90, "imp": 9000}}, r2); assert h2["phanh"]["den_tang"] == "2026-11-17T13:00:00+00:00" and h2["som"] is True, h2   # chưa hồi → giữ tới chốt 20h + cảnh báo sớm
    h3 = xet_phanh(u("2026-11-17T06:10:00"), tut, r2); assert h3["phanh"]["den_tang"] == "2026-11-17T13:00:00+00:00", "thiếu số hôm nay → giữ tới chốt"
    cu7 = {"phanh": {**r2["phanh"], "den_tang": "2026-11-17T00:00:00+00:00"}, "quyet": "2026-11-16"}; assert xet_phanh(u("2026-11-16T20:00:00"), tut, cu7)["phanh"]["den_tang"] == "2026-11-17T06:00:00+00:00", "bản phanh cũ 07:00 được kéo tới 13:00"
    r4 = xet_phanh(u("2026-11-18T00:10:00"), tut, r3); assert r4["phanh"] is None, "hết hạn den_len thì tự nhả"
    r = xet_phanh(u("2026-11-16T13:05:00"), deu, {}); assert r["phanh"] is None and r["quyet"] == "2026-11-16", r   # 92% nền: không phanh
    r = xet_phanh(u("2026-11-16T13:05:00"), {"2026-11-16": {"irpm": 10, "imp": 9000}}, {}); assert r["phanh"] is None and r["hom_nay"]["ti"] is None, "thiếu nền → không đoán"
    r = xet_phanh(u("2026-11-16T13:05:00"), {**nen, "2026-11-16": {"irpm": 10, "imp": 100}}, {}); assert r["phanh"] is None, "ít lượt hiển thị → không phanh"
    r = xet_phanh(u("2026-11-30T13:05:00"), {}, {}); assert r["phanh"]["nguon"] == "lich" and r["phanh"]["den_len"] == "2026-12-02T00:00:00+00:00", r   # 01/12 trong lịch: phanh sẵn từ 20h VN hôm trước, không cần số
    assert xet_phanh(u("2026-11-30T12:00:00"), {}, {})["phanh"] is None, "ngày lịch cũng chờ tới giờ chốt"
    print("✓ gia_adsense.py tự kiểm (tính RPM / hoà vốn, hệ số giá: chỉ ngày tụt, kẹp sàn, ít lượt hiển thị không ghi, đoạn SQL · phanh chợ: cảnh báo sớm, chốt một lần, giữ tới hết hạn, thiếu số không đoán, ngày lịch)")

if __name__ == "__main__": _tu_kiem()
