"""MÙA LỄ MỸ 2026 — TỰ CHẠY (anh 08/11/2026: "Cảnh báo tele để tao biết còn plan vẫn phải chạy tự động"; tiến độ ethopex E05).
dong-bo.py gọi chay(q) mỗi lượt (10 phút), sau khi đã ghi etp.cau_hinh.cpm_ngay. Máy tự đổi, Telegram (etp.canh_bao 'mua_le') chỉ để anh biết.
  25/11–30/11  KHOÁ TĂNG BẬC (bước 2): cong.kiem chặn viec 'tang' khi etp.cau_hinh.mua_le.khoa_tang — giảm / tắt / camp mới vẫn chạy.
  26/11–30/11  NHÁNH theo NGÀY ĐÃ KHÉP hôm qua so với NỀN (TB 7 ngày 18–24/11) (bước 5):
               A — CPM ≥ 130% nền VÀ ROI < ROI nền − 10 điểm → trần camp mới / ngày = 50% trần gốc, giữ khoá tăng (giá đắt mà không bán được: dồn tiền vào camp đã thắng)
               B — ROI ≥ ROI nền + 10 điểm → trần gốc, MỞ khoá tăng (người xem lễ nhiều hơn giá tăng: cho camp thắng lên bậc)
               còn lại — trung tính: trần gốc, giữ khoá tăng
  26/12–05/01  SAU GIÁNG SINH (bước 6): CPM hôm qua ≤ 85% nền (TB 14–20/12) VÀ ROI hôm qua ≥ ROI nền → trần camp mới = 130% trần gốc (test rẻ); không thì trần gốc.
  Ngoài các khung → trả nguyên trần gốc, bỏ khoá. Trần gốc cất ở mua_le.tran_goc lúc máy đổi lần đầu.
  BA LƯỚI (review 08/11/2026): (1) chỉ quyết sau GIO_QUYET giờ UTC — số hôm qua về trễ tới ~6 giờ (như T1_CHO), quyết lúc 00:10 UTC là ROI giả thấp → nhánh A oan rồi lật
  lại trong ngày; mỗi ngày quyết MỘT lần (mua_le.ngay_quyet). (2) nhánh A / B cần HAI ngày đã khép liên tiếp cùng đạt điều kiện — ROI ngày nhà dao động hơn ±10 điểm
  (01/11 0% · 05/11 22% · 07/11 43%), một ngày so với trung bình 7 ngày là so nhiễu. (3) anh đổi tay tran_camp_moi_ngay giữa mùa thì máy nhận số đó làm trần gốc mới,
  không ghi đè lại.
Tự kiểm: python3 apps/etp/mua_le.py"""
import json, datetime as dt

KHOA_TANG = ("2026-11-25", "2026-11-30")
NHANH = ("2026-11-26", "2026-11-30"); NEN_LE = ("2026-11-18", "2026-11-24")
SAU_GS = ("2026-12-26", "2027-01-05"); NEN_GS = ("2026-12-14", "2026-12-20")
GIO_QUYET = 6   # giờ UTC sớm nhất trong ngày được quyết nhánh (số hôm qua đã khép đủ — cùng mốc T1_CHO của luat-ethopex)

def _nen(so, khoang):
    ds = [v for k, v in so.items() if khoang[0] <= k <= khoang[1] and v.get("cpm") and v.get("roi") is not None]
    return (sum(v["cpm"] for v in ds) / len(ds), sum(v["roi"] for v in ds) / len(ds)) if len(ds) >= 5 else None

def quyet(hom_nay, so, tran_goc):
    """hàm thuần: ngày (ISO, UTC = ngày Ethopex) + sổ cpm_ngay + trần gốc → {tran, khoa_tang, nhanh, ly_do}"""
    d = dt.date.fromisoformat(hom_nay); hq = (d - dt.timedelta(days=1)).isoformat(); hk = (d - dt.timedelta(days=2)).isoformat()
    h, h2 = so.get(hq) or {}, so.get(hk) or {}
    kq = {"tran": tran_goc, "khoa_tang": KHOA_TANG[0] <= hom_nay <= KHOA_TANG[1], "nhanh": None, "ly_do": ""}
    if NHANH[0] <= hom_nay <= NHANH[1]:
        n = _nen(so, NEN_LE)
        la_A = lambda x: bool(x.get("cpm")) and x["cpm"] >= 1.3 * n[0] and x["roi"] < n[1] - 10
        la_B = lambda x: bool(x.get("cpm")) and x["roi"] >= n[1] + 10
        if not n or not h.get("cpm"): kq.update(nhanh="trung_tinh", ly_do="thiếu số nền / hôm qua — giữ trần gốc, khoá tăng")
        elif la_A(h) and la_A(h2):   # HAI ngày khép liên tiếp (lưới 2)
            kq.update(nhanh="A", tran=max(1, round(tran_goc * 0.5)), ly_do=f"2 ngày liền CPM ≥ 130% nền ({h2['cpm']:.1f} · {h['cpm']:.1f}, nền {n[0]:.1f}) và ROI < nền − 10 ({h2['roi']}% · {h['roi']}%, nền {n[1]:.0f}%)")
        elif la_B(h) and la_B(h2):
            kq.update(nhanh="B", khoa_tang=False, ly_do=f"2 ngày liền ROI ≥ nền + 10 ({h2['roi']}% · {h['roi']}%, nền {n[1]:.0f}%; CPM {h['cpm']:.1f})")
        else: kq.update(nhanh="trung_tinh", ly_do=f"CPM {h['cpm']:.1f} ({h['cpm'] / n[0] * 100:.0f}% nền), ROI {h['roi']}% (nền {n[1]:.0f}%)" + (" — mới 1 ngày đạt, chờ ngày 2" if la_A(h) or la_B(h) else ""))
    elif SAU_GS[0] <= hom_nay <= SAU_GS[1]:
        n = _nen(so, NEN_GS)
        if n and h.get("cpm") and h["cpm"] <= 0.85 * n[0] and h["roi"] >= n[1]:
            kq.update(nhanh="sau_gs", tran=round(tran_goc * 1.3), ly_do=f"CPM {h['cpm']:.1f} = {h['cpm'] / n[0] * 100:.0f}% nền, ROI {h['roi']}% ≥ nền {n[1]:.0f}%")
        else: kq.update(nhanh="sau_gs_giu", ly_do="CPM chưa rẻ / ROI chưa đạt nền — giữ trần gốc")
    return kq

def chay(q, luc=None):
    """đọc sổ, quyết, ghi etp.cau_hinh (mua_le + tran_camp_moi_ngay), báo Telegram khi trạng thái đổi. Trả trạng thái."""
    ch = lambda k, md: json.loads(q(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{k}'), '{md}')") or md)
    so, tt, tran = ch("cpm_ngay", "{}"), ch("mua_le", "{}"), ch("tran_camp_moi_ngay", "null")
    luc = luc or dt.datetime.now(dt.timezone.utc); hn = luc.date().isoformat()
    if tran is None: return {"loi": "chưa có tran_camp_moi_ngay"}
    if tt and tt.get("tran") is not None and int(tran) != int(tt["tran"]):   # lưới 3: ai đó đổi tay trần giữa mùa → đó là trần gốc mới
        tt["tran_goc"] = int(tran); tt["tran"] = int(tran)
    goc = tt.get("tran_goc") or tran
    if tt.get("ngay_quyet") == hn: return {**tt, "da_quyet": True}   # lưới 1: mỗi ngày quyết một lần
    if luc.hour < GIO_QUYET and tt: return {**tt, "cho_gio": GIO_QUYET}   # số hôm qua chưa khép — giữ trạng thái hôm qua
    kq = quyet(hn, so, int(goc)); trong_mua = kq["khoa_tang"] or kq["nhanh"] is not None
    moi = {"tran_goc": int(goc) if trong_mua else None, "khoa_tang": kq["khoa_tang"], "nhanh": kq["nhanh"], "ngay": hn, "ngay_quyet": hn, "ly_do": kq["ly_do"], "tran": kq["tran"]}
    cu = {k: tt.get(k) for k in ("khoa_tang", "nhanh", "tran")}
    if not trong_mua and not tt: return {"ngoai_mua": True}
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('mua_le', $J${json.dumps(moi, ensure_ascii=False)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    if tran != kq["tran"]: q(f"update etp.cau_hinh set gia_tri = to_jsonb({int(kq['tran'])}), luc = now() where khoa = 'tran_camp_moi_ngay'")
    if cu != {k: moi[k] for k in cu}:
        chu = (f"Mùa lễ ({hn}): " + ("khoá tăng bậc · " if kq["khoa_tang"] else "tăng bậc mở · ") + f"trần camp mới {kq['tran']}/ngày"
               + (f" · nhánh {kq['nhanh']}" if kq["nhanh"] else "") + (f" — {kq['ly_do']}" if kq["ly_do"] else "") + " · máy đã tự áp (tiến độ ethopex E05)")
        q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) select 'mua_le', 'mua_le:' || md5($N${chu}$N$), 'info', $N${chu}$N$
              where not exists (select 1 from etp.canh_bao where khoa = 'mua_le:' || md5($N${chu}$N$))""")
    if not trong_mua: q("delete from etp.cau_hinh where khoa = 'mua_le'")   # hết mùa: trần gốc đã trả, bỏ trạng thái
    return moi

if __name__ == "__main__":
    so = {f"2026-11-{d:02d}": {"cpm": 15.0, "roi": 20} for d in range(18, 25)}
    assert quyet("2026-11-10", so, 100) == {"tran": 100, "khoa_tang": False, "nhanh": None, "ly_do": ""}
    assert quyet("2026-11-25", so, 100)["khoa_tang"] and quyet("2026-11-25", so, 100)["tran"] == 100
    so["2026-11-25"] = {"cpm": 21.0, "roi": 5}; k = quyet("2026-11-26", so, 100); assert k["nhanh"] == "trung_tinh" and "chờ ngày 2" in k["ly_do"], k   # 1 ngày chưa đủ
    so["2026-11-26"] = {"cpm": 22.0, "roi": 3}; k = quyet("2026-11-27", so, 100); assert (k["nhanh"], k["tran"], k["khoa_tang"]) == ("A", 50, True), k
    so["2026-11-27"] = {"cpm": 22.0, "roi": 35}; k = quyet("2026-11-28", so, 100); assert k["nhanh"] == "trung_tinh", k   # A rồi B xen kẽ = nhiễu, không đổi
    so["2026-11-28"] = {"cpm": 20.0, "roi": 33}; k = quyet("2026-11-29", so, 100); assert (k["nhanh"], k["tran"], k["khoa_tang"]) == ("B", 100, False), k
    so["2026-11-29"] = {"cpm": 16.0, "roi": 22}; k = quyet("2026-11-30", so, 100); assert (k["nhanh"], k["tran"], k["khoa_tang"]) == ("trung_tinh", 100, True), k
    assert quyet("2026-12-01", so, 100) == {"tran": 100, "khoa_tang": False, "nhanh": None, "ly_do": ""}
    so.update({f"2026-12-{d:02d}": {"cpm": 20.0, "roi": 10} for d in range(14, 21)}); so["2026-12-26"] = {"cpm": 15.0, "roi": 15}
    assert quyet("2026-12-27", so, 100)["tran"] == 130
    so["2026-12-27"] = {"cpm": 19.0, "roi": 15}; assert quyet("2026-12-28", so, 100)["tran"] == 100
    assert quyet("2026-11-26", {}, 100)["nhanh"] == "trung_tinh"   # thiếu nền → không đoán
    # lưới chay(): giờ quyết · một lần / ngày · tôn trọng trần anh đổi tay
    class Q:
        def __init__(s, tran, tt): s.kho = {"cpm_ngay": json.dumps(so), "mua_le": json.dumps(tt) if tt else None, "tran_camp_moi_ngay": json.dumps(tran)}; s.ghi = []
        def __call__(s, cau):
            import re
            if cau.startswith("select"):
                k = re.search(r"khoa = '(\w+)'", cau).group(1); md = re.search(r"'([^']*)'\)\s*$", cau).group(1); return s.kho.get(k) or md
            s.ghi.append(cau); return ""
    t3, t7 = dt.datetime(2026, 11, 27, 3, 0, tzinfo=dt.timezone.utc), dt.datetime(2026, 11, 27, 7, 0, tzinfo=dt.timezone.utc)
    r = chay(Q(100, {"tran": 100, "tran_goc": 100, "ngay_quyet": "2026-11-26", "khoa_tang": True}), t3); assert r.get("cho_gio") == 6, r   # 03:00 UTC: chưa quyết
    q_ = Q(100, {"tran": 100, "tran_goc": 100, "ngay_quyet": "2026-11-26", "khoa_tang": True}); r = chay(q_, t7); assert r.get("ngay_quyet") == "2026-11-27" and r["nhanh"] == "A" and r["tran"] == 50, r
    q_ = Q(100, {"tran": 100, "tran_goc": 100, "ngay_quyet": "2026-11-27", "khoa_tang": True}); r = chay(q_, t7); assert r.get("da_quyet") and not q_.ghi, r   # đã quyết hôm nay: không ghi gì
    q_ = Q(80, {"tran": 100, "tran_goc": 100, "ngay_quyet": "2026-11-26", "khoa_tang": True}); r = chay(q_, t7); assert r["tran_goc"] == 80 and r["tran"] == 40, r   # anh đổi tay 100 → 80: gốc mới 80, A = 40
    print("✓ mua_le tự kiểm: ngoài mùa · khoá tăng · nhánh A / B / trung tính · sau Giáng sinh rẻ / chưa rẻ · thiếu số · 2 ngày liền · giờ quyết · 1 lần/ngày · trần đổi tay")
