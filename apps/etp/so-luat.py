#!/usr/bin/env python3
"""SỐ THẬT TỪNG LUẬT → etp.so_luat (anh 29/10/2026: "để sửa mày phải xem số liệu thực tế đã. Bản thân các luật cũng cần định kỳ review lại dựa vào số liệu
thực tế"; trang etp ?t=luat = MỘT bản luật: điều kiện hiện tại + số thật + đề xuất tối ưu lợi nhuận).
Nguồn: etp.nhat_ky (máy luật đã làm gì, lúc nào, camp nào) + etp.so_ngay (chi / thu từng camp từng ngày UTC = ngày Ethopex) + etp.xet_luat (điều kiện
đang chạy + camp đang chạm, do luat-ethopex.py ghi mỗi lượt — bản luật đọc thẳng từ đó, không chép tay ngưỡng).
  tăng / giảm bậc: lãi/ngày 2 ngày trước so với 2 ngày sau (chỉ ngày đã khép) · tắt: camp bị tắt có đang lãi 3 ngày trước không ·
  nhân bản: bản clone lãi hay lỗ (cùng creative / creative khác) · luật ít chạm: camp gần đạt kẹt ở điều kiện nào.
  ĐO CÓ ĐỐI CHỨNG (anh 02/11/2026 duyệt review luật): luật tăng chọn đúng camp vừa có ngày đẹp nên "sau" luôn thấp hơn "trước" kể cả khi không tăng
  (hồi quy về trung bình) → so với NHÓM ĐỐI CHỨNG: camp Nhà cùng ngày, cùng ngân sách hôm trước, 2 ngày trước cùng lãi, không bị tăng / giảm quanh đó.
  hieu_qua = (sau − trước của camp được tăng) − (sau − trước của đối chứng) = lãi/ngày thật sự do lần tăng. Mỗi luật thêm k7 = cùng số đo cho 7 ngày gần nhất.
  Số camp team (so_ngay_ngoai) cũng đọc — việc máy làm cho tài khoản team giờ có trong etp.nhat_ky (sua-ngoai.py / nhan-ban.py).
  so-luat.py            → tính + ghi (dong-bo.py gọi, mỗi giờ một lần)
  so-luat.py --in       → in ra, không ghi"""
import json, os, re, subprocess, sys, collections

NGAY = 14   # cửa sổ đo
DA_BO = {"gb", "giam_ngay", "giam_som", "roi_tut", "dung_dem"}   # dừng đêm bỏ 29/10/2026
DA_AP_CUNG_CR = True
DA_AP_CHI_GOC = True   # luat-ethopex.py: bản thang bộ 2 chỉ mở khi camp gốc tiêu TB ≥ $6/ngày 3 ngày đã khép (anh 29/10/2026)
DA_AP_ROI_DAI = True   # luat-ethopex.py tăng trong ngày đòi ROI khung dài ≥ 0% từ 29/10/2026   # nhan-ban.py giữ nguyên creative gốc khi clone từ 28/10/2026 (commit 3cf79748) — số 14 ngày còn lẫn clone đổi creative trước đó   # luật đã bỏ khỏi máy (anh 29/10/2026 "làm 1+2") — dòng xét cũ còn trong etp.xet_luat tới 3 giờ, không đưa lên bản luật
DB = os.environ.get("DATABASE_URL")
def q(s):
    r = subprocess.run(["psql", DB, "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=180)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def qj(s): return json.loads(q(f"select coalesce(json_agg(t), '[]') from ({s}) t") or "[]")

# nhật ký máy luật → mã luật (cùng mã etp.xet_luat). Lệnh tay của anh / sửa CTA / dọn lỗi KHÔNG tính vào luật nào.
# Đọc SỔ LUẬT CHUNG (apps/web/src/lib/etp-bang-luat.json, trường nhat_ky của từng khoá) — không chép danh sách luật ở đây (anh 01/11/2026)
BANG = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "src", "lib", "etp-bang-luat.json")))
MA = [(v["nhat_ky"][0], v["nhat_ky"][1], v["ma"]) for v in BANG["khoa"].values() if v.get("nhat_ky") and v.get("ma")]
MA.append(("tat", r"^L7 ", "l7"))   # L7 đã dừng 29/10 (không còn trong máy luật / sổ) — nhật ký cũ vẫn đo
LUAT_TAT_MA = {m for v_, _, m in MA if v_ == "tat"} - {m for v_, _, m in MA if v_ != "tat"}   # G10 vừa hạ vừa tắt → đo theo nhánh hạ
def DX(lam, vi, cach):
    """một đề xuất = LÀM GÌ (vài chữ, hiện trong ô) · VÌ SAO (một câu) · CÁCH (một câu) — số chi tiết đã có ở cột, không chép lại (anh 29/10/2026 \"khó đọc quá\")"""
    return {"lam": lam, "vi": vi, "cach": cach}

def ma_cua(viec, luat):
    for v, re_, m in MA:
        if v == viec and re.search(re_, luat or ""): return m
    return None

def main():
    hd = qj(f"""select n.viec, n.luat, n.camp_id, n.goc, n.truoc, n.sau, (n.luc at time zone 'utc')::date d from etp.nhat_ky n
      where n.ok and n.camp_id is not null and n.luc > now() - interval '{NGAY} days' and n.viec in ('tang','giam','tat','nhan_ban')""")
    so, ns_ngay = collections.defaultdict(dict), collections.defaultdict(dict)
    for r in qj("""select camp_id c, ngay::text d, chi::float chi, thu::float thu, ngan_sach::float ns from etp.so_ngay where ngay > current_date - 40
                   union all select camp_id, ngay::text, chi::float, thu::float, null from etp.so_ngay_ngoai where ngay > current_date - 40"""):
        so[r["c"]][r["d"]] = (r["chi"], r["thu"])
        if r["ns"]: ns_ngay[r["d"]].setdefault(round(r["ns"]), []).append(r["c"])   # chỉ camp Nhà có ngân sách từng ngày → kho đối chứng
    cr = {r["c"]: r["cr"] for r in qj("select camp_id c, creative_id cr from etp.camp")}
    bai = {r["c"] for r in qj("select camp_id c from etp.camp where ten like '% bai-cu %'")}   # nhân bản BÀI CŨ (nhan-ban.py, anh 11/11/2026): tên mang ' bai-cu '
    # T30 TÁCH HAI NHÁNH (anh 02/11/2026 "dừng T30 cho camp thường, theo dõi kỹ cho ROAS vì chưa có đủ data"): lần T30 trên camp ★ ROAS đo riêng ở t30_roas
    la_roas = {r["c"] for r in qj("select camp_id c from etp.camp where la_roas")}
    T30_ROAS_DU = 10   # đủ bao nhiêu lần đo có đối chứng thì sổ luật mới phán Giữ / Siết cho nhánh ROAS
    import datetime as dt
    homqua = dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)
    def cong(c, d0, d1):
        """chi, thu, số ngày có chi của camp c từ ngày d0 tới d1 (chỉ ngày đã khép)"""
        chi = thu = n = 0
        d = d0
        while d <= min(d1, homqua):
            x = so.get(c, {}).get(d.isoformat())
            if x and x[0] > 0: chi += x[0]; thu += x[1]; n += 1
            d += dt.timedelta(days=1)
        return chi, thu, n
    roi = lambda chi, thu: round((thu - chi) / chi * 100) if chi > 0 else None
    def nhom(ds):
        c, t = sum(a["sau"][0] for a in ds), sum(a["sau"][1] for a in ds)
        return {"n": len(ds), "chi": round(c, 2), "lai": round(t - c, 2), "roi": roi(c, t), "lai_n": sum(1 for a in ds if a["sau"][1] > a["sau"][0])}
    def tinh(m, mau):
        """số đo của một luật trên một tập lần làm (14 ngày hoặc 7 ngày) — một hàm cho cả hai cửa sổ"""
        o = {}
        if m in ("tang", "dau_phien", "t30", "t30_roas"):
            do = [a for a in mau if a["sau"][2] and a["truoc"][2]]
            tc, tt, tn = (sum(a["truoc"][i] for a in do) for i in range(3)); sc, st, sn = (sum(a["sau"][i] for a in do) for i in range(3))
            tot = sum(1 for a in do if (a["sau"][1] - a["sau"][0]) / a["sau"][2] > (a["truoc"][1] - a["truoc"][0]) / a["truoc"][2])
            o.update(do_duoc=len(do), lai_ngay_truoc=round((tt - tc) / tn, 2) if tn else None, lai_ngay_sau=round((st - sc) / sn, 2) if sn else None,
                     roi_truoc=roi(tc, tt), roi_sau=roi(sc, st), chi_ngay_truoc=round(tc / tn, 2) if tn else None, chi_ngay_sau=round(sc / sn, 2) if sn else None, ti_le_tot=round(tot / len(do) * 100) if do else None)
            # đối chứng: mỗi lần tăng lấy TB chênh lãi/ngày của nhóm đối chứng cùng ngày, cùng ngân sách; cộng các lần có ≥ 3 camp đối chứng
            cap = [(a, [((s_[1] - s_[0]) / s_[2]) - ((t_[1] - t_[0]) / t_[2]) for t_, s_ in a["dc"]]) for a in do if len(a.get("dc") or []) >= 3]
            if len(cap) >= (1 if m == "t30_roas" else 5):   # nhánh ROAS hiện số ngay từ lần đầu (đang theo dõi), phán chỉ khi đủ T30_ROAS_DU
                dc = sum(sum(v) / len(v) for _, v in cap) / len(cap)
                dl = sum((a["sau"][1] - a["sau"][0]) / a["sau"][2] - (a["truoc"][1] - a["truoc"][0]) / a["truoc"][2] for a, _ in cap) / len(cap)
                o.update(dc_n=len(cap), dc_chenh=round(dc, 2), chenh_tang=round(dl, 2), hieu_qua=round(dl - dc, 2))
        elif m in LUAT_TAT_MA:
            co = [a for a in mau if a["truoc"][2]]; lai = [a for a in co if a["truoc"][1] > a["truoc"][0]]
            tc, tt, tn = (sum(a["truoc"][i] for a in co) for i in range(3))
            o.update(do_duoc=len(co), roi_3_ngay_truoc=roi(tc, tt), lo_ngay_truoc=round((tt - tc) / tn, 2) if tn else None, dang_lai=len(lai), lai_bi_tat=round(sum(a["truoc"][1] - a["truoc"][0] for a in lai), 2))
        elif m in ("nb", "thang_nb"):
            co = [a for a in mau if a["sau"][2]]
            o.update(tat_ca=nhom(co), cung_cr=nhom([a for a in co if a["cung_cr"]]), khac_cr=nhom([a for a in co if not a["cung_cr"]]),
                     bai_cu=nhom([a for a in co if a["bai_cu"]]), bai_moi=nhom([a for a in co if not a["bai_cu"]]))   # bài đăng cũ (giữ tương tác, $2) ↔ đăng bài mới
            g = collections.defaultdict(list)
            for a in co:
                gc = a["goc3"][0] / a["goc3"][2] if a["goc3"][2] else 0
                g["gốc tiêu ≥ $14/ngày" if gc >= 14 else "gốc tiêu $6–14/ngày" if gc >= 6 else "gốc tiêu < $6/ngày"].append(a)
            o["theo_goc"] = {k: nhom(v) for k, v in sorted(g.items())}
        return o
    ra = collections.defaultdict(lambda: {"lan": 0, "camp": set(), "mau": []})
    dong = collections.defaultdict(set)   # camp → các ngày bị tăng / giảm (đối chứng phải sạch ±2 ngày)
    for h in hd:
        if h["viec"] in ("tang", "giam"): dong[h["camp_id"]].add(dt.date.fromisoformat(h["d"]))
    def doi_chung(c0, D, ns):
        """camp Nhà cùng ngày D, ngân sách hôm trước = ns, 2 ngày trước đều có chi và cộng lại lãi, không bị tăng / giảm trong D−2..D+2 → [(trước, sau)]"""
        ra_ = []
        for c in ns_ngay.get((D - dt.timedelta(days=1)).isoformat(), {}).get(round(ns), []):
            if c == c0 or any(abs((x - D).days) <= 2 for x in dong.get(c, ())): continue
            t = cong(c, D - dt.timedelta(days=2), D - dt.timedelta(days=1))
            if t[2] < 2 or t[1] <= t[0]: continue
            sau = cong(c, D + dt.timedelta(days=1), D + dt.timedelta(days=2))
            if sau[2]: ra_.append((t, sau))
        return ra_
    for h in hd:
        m = ma_cua(h["viec"], h["luat"])
        if not m: continue
        if m == "t30" and h["camp_id"] in la_roas: m = "t30_roas"
        x = ra[m]; x["lan"] += 1; x["camp"].add(h["camp_id"]); D = dt.date.fromisoformat(h["d"]); x.setdefault("ngay", []).append(D)
        t = cong(h["camp_id"], D - dt.timedelta(days=2), D - dt.timedelta(days=1))
        if h["viec"] == "nhan_ban":
            s = cong(h["camp_id"], D, homqua); x["mau"].append({"D": D, "camp": h["camp_id"], "goc": h["goc"], "cung_cr": cr.get(h["camp_id"]) == cr.get(h["goc"]) and cr.get(h["camp_id"]) is not None, "bai_cu": h["camp_id"] in bai,
                                                                 "goc3": cong(h["goc"], D - dt.timedelta(days=3), D - dt.timedelta(days=1)), "sau": s})
        elif h["viec"] == "tat":
            x["mau"].append({"D": D, "camp": h["camp_id"], "truoc": cong(h["camp_id"], D - dt.timedelta(days=3), D - dt.timedelta(days=1))})
        else:
            s = cong(h["camp_id"], D + dt.timedelta(days=1), D + dt.timedelta(days=2))
            m_ = re.search(r"ROI (\d+) ngày ([+-]?\d+)%", h["luat"] or "")
            try: ns0 = float(h["truoc"])
            except (TypeError, ValueError): ns0 = None
            x["mau"].append({"D": D, "camp": h["camp_id"], "truoc": t, "sau": s, "roi_dai": int(m_.group(2)) if m_ else None, "ns": [h["truoc"], h["sau"]],
                             "dc": doi_chung(h["camp_id"], D, ns0) if ns0 and m in ("tang", "dau_phien", "t30", "t30_roas") and s[2] and t[2] else []})
    # camp đang chạm / gần chạm từng luật + điều kiện hay kẹt nhất (từ lượt xét mới nhất của máy luật)
    xet = qj("""select x->>'ma' ma, x->>'ten' ten, x->>'mo_ta' mo_ta, x->>'ket' ket, x->>'ghi' ghi, x->'dk' dk from etp.xet_luat t, jsonb_array_elements(t.xet) x
      where t.luc > now() - interval '3 hours'""")
    luat = collections.OrderedDict()
    for r in xet:
        L = luat.setdefault(r["ma"], {"ten": r["ten"], "mo_ta": r["mo_ta"], "dk": [[d[0], d[2]] for d in r["dk"]], "dat": 0, "gan": 0, "xa": 0, "khong_ap": 0, "ket_o": collections.Counter(), "dung": bool(re.search("TẠM DỪNG|ĐANG DỪNG", f"{r['ten']} {r['ghi'] or ''}"))})
        L[r["ket"]] = L.get(r["ket"], 0) + 1
        if r["ket"] == "gan":
            for d in r["dk"]:
                if not d[3]: L["ket_o"][d[0]] += 1
    out = {}
    for m in sorted((set(luat) | set(ra)) - DA_BO):
        L = luat.get(m, {}); x = ra.get(m, {"lan": 0, "camp": set(), "mau": []}); mau = x["mau"]; dx = []
        so_ = {"lan": x["lan"], "camp": len(x["camp"]), "ngay": NGAY}
        so_.update(tinh(m, mau)); k7 = tinh(m, [a for a in mau if a["D"] > homqua - dt.timedelta(days=7)])
        so_["k7"] = {"lan": sum(1 for d_ in x.get("ngay", []) if d_ > homqua - dt.timedelta(days=7)), **k7}
        if m in ("tang", "dau_phien", "t30", "t30_roas"):
            do = [a for a in mau if a["sau"][2] and a["truoc"][2]]
            if len(do) >= 10:
                lt, ls_, hq = so_["lai_ngay_truoc"], so_["lai_ngay_sau"], so_.get("hieu_qua")
                if m in ("tang", "dau_phien", "t30", "t30_roas"):
                    am = [a for a in mau if a["roi_dai"] is not None and a["roi_dai"] < 0]
                    if m == "t30_roas" and (so_.get("dc_n") or 0) < T30_ROAS_DU:
                        pass   # nhánh ROAS chưa đủ lần — dòng "Đang theo dõi" ở dưới
                    elif hq is not None:   # có đối chứng → phán theo hiệu quả thật, không theo sau − trước (luôn âm vì chọn đúng ngày đẹp)
                        dx.append(DX("Siết điều kiện tăng", f"so với camp cùng mức không tăng, mỗi lần tăng làm mất ${-hq:.2f}/ngày.", "đo nhóm nào kéo xuống (giờ tăng, ROI hôm qua) rồi chặn nhóm đó.") if hq < 0
                                  else DX("Giữ", f"so với camp cùng mức không tăng, mỗi lần tăng thêm ${hq:.2f}/ngày (sau − trước thô {ls_ - lt:+.2f}).", None))
                    elif lt is not None and ls_ is not None:
                        dx.append(DX("Chưa đủ đối chứng", f"sau − trước thô {ls_ - lt:+.2f}$/ngày — số này luôn âm vì luật chọn đúng ngày đẹp, chưa kết luận được.", None))
                    if len(am) >= 5:
                        ra_am = [a for a in am if a["sau"][2]]; ac, at = sum(a["sau"][0] for a in ra_am), sum(a["sau"][1] for a in ra_am)
                        dx.append(DX("Giữ — đã áp 29/10", f"đã thêm ROI khung dài ≥ 0% cho tăng trong ngày ({len(am)} lần tăng cũ khi khung dài âm, sau đó ROI {roi(ac, at)}%).", None) if DA_AP_ROI_DAI else DX("Thêm điều kiện ROI khung dài ≥ 0%", f"{len(am)} lần tăng khi ROI khung dài đang âm; sau đó ROI {roi(ac, at)}%.", "tăng trong ngày chỉ khi ROI khung dài ≥ 0%."))
                elif lt is not None and ls_ is not None:
                    mat = (lt - ls_) * len(do) * 2
                    dx.append(DX("Giữ", "giảm cắt được lỗ.", None) if lt < 0 and ls_ > lt
                              else DX("Tắt thay vì giảm", "camp bị giảm vẫn lỗ như cũ.", "camp lỗ thì tắt luôn, không giảm từng bậc.") if lt < 0
                              else DX("Nới điều kiện giảm", f"camp bị giảm đang lãi; giảm làm mất ≈ ${mat:.0f} trong {NGAY} ngày.", "chỉ giảm khi 2 ngày đã khép cùng lỗ (thay vì 1 ngày).") if ls_ < lt
                              else DX("Giữ", "giảm không làm mất lãi.", None))
        elif m in LUAT_TAT_MA:
            co = [a for a in mau if a["truoc"][2]]; lai = [a for a in co if a["truoc"][1] > a["truoc"][0]]
            if len(co) >= 5:
                dx.append(DX("Nới điều kiện tắt", f"{len(lai)}/{len(co)} camp bị tắt đang lãi.", "bỏ điều kiện bắt camp đang lãi.") if len(lai) / len(co) > 0.2
                          else DX("Giữ", f"tắt đúng: {len(co) - len(lai)}/{len(co)} camp đang lỗ khi bị tắt.", None))
        elif m in ("nb", "thang_nb"):
            co = [a for a in mau if a["sau"][2]]
            cung, khac = [a for a in co if a["cung_cr"]], [a for a in co if not a["cung_cr"]]
            if len(co) >= 10:
                if m == "nb" and len(cung) >= 5 and len(khac) >= 5 and (so_["cung_cr"]["roi"] or 0) - (so_["khac_cr"]["roi"] or 0) >= 20 and DA_AP_CUNG_CR:
                    dx.append(DX("Giữ — đã áp từ 28/10", f"clone giống hệt ROI {so_['cung_cr']['roi']}%, đổi creative chỉ {so_['khac_cr']['roi']}% — đúng hướng máy nhân bản đang chạy.", None))
                elif len(cung) >= 5 and len(khac) >= 5 and (so_["cung_cr"]["roi"] or 0) - (so_["khac_cr"]["roi"] or 0) >= 20:
                    dx.append(DX("Clone giữ nguyên creative", f"clone giống hệt ROI {so_['cung_cr']['roi']}%, clone đổi creative chỉ {so_['khac_cr']['roi']}%.", "nhân bản camp thắng bằng chính creative đó; đổi creative khi đã bão hoà."))
                elif m == "thang_nb" and DA_AP_CHI_GOC:
                    _n = so_["theo_goc"].get("gốc tiêu < $6/ngày")
                    dx.append(DX("Giữ — đã áp 29/10", "bản thang chỉ mở khi camp gốc tiêu TB ≥ $6/ngày 3 ngày đã khép" + (f" (trước đó {_n['n']} bản từ gốc < $6 → ROI {_n['roi']}%)." if _n else "."), None))
                elif (so_["tat_ca"]["roi"] or 0) < 0:
                    dx.append(DX("Siết điều kiện nhân bản", f"clone đang lỗ (ROI {so_['tat_ca']['roi']}%).", "chỉ nhân bản camp gốc lãi đều hơn."))
                else:
                    dx.append(DX("Giữ", f"clone lãi (ROI {so_['tat_ca']['roi']}%).", None))
        if m == "t30_roas" and (so_.get("dc_n") or 0) < T30_ROAS_DU:
            hq_ = so_.get("hieu_qua")
            dx.append(DX("Đang theo dõi", f"mới {so_.get('dc_n') or 0}/{T30_ROAS_DU} lần đo có đối chứng" + (f", hiệu quả tới giờ {hq_:+.2f}$/ngày mỗi lần" if hq_ is not None else "") + " — chưa đủ để kết luận.", None))
        if L:
            so_["dang"] = {k: L.get(k, 0) for k in ("dat", "gan", "xa", "khong_ap")}
            kt = L["ket_o"].most_common(2)
            if kt: so_["ket_o"] = kt
            if m == "tang_ngay": dx.append(DX("Xem ở Tăng bậc", "nhật ký ghi chung với Tăng bậc.", None))
            elif not x["lan"] and L.get("gan", 0) >= 5 and not L["dung"] and m in ("nb", "t30", "tang", "thang_nb"):
                dx.append(DX("Xem lại ngưỡng", f"không chạm lần nào; {L['gan']} camp gần đạt.", f"xét lại ngưỡng '{kt[0][0]}' ({kt[0][1]} camp kẹt ở đó)."))
        out[m] = {"ten": L.get("ten") or (BANG["the"].get(m, [None] * 4) + [None])[3] or m, "mo_ta": L.get("mo_ta"), "dk": L.get("dk", []),
                  "dung": L.get("dung", False), "so": so_, "de_xuat": dx}
    if "--in" in sys.argv: print(json.dumps(out, ensure_ascii=False, indent=1)); return
    j = json.dumps([{"ma": k, "so": v} for k, v in out.items()], ensure_ascii=False).replace("$J$", "")
    q(f"begin; delete from etp.so_luat; insert into etp.so_luat (ma, so) select ma, so from jsonb_to_recordset($J${j}$J$::jsonb) as x(ma text, so jsonb); commit;")
    print(f"so-luat: {len(out)} luật, {sum(v['so']['lan'] for v in out.values())} lần làm trong {NGAY} ngày")

if __name__ == "__main__":
    main()
