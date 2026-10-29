#!/usr/bin/env python3
"""SỐ THẬT TỪNG LUẬT → etp.so_luat (anh 29/10/2026: "để sửa mày phải xem số liệu thực tế đã. Bản thân các luật cũng cần định kỳ review lại dựa vào số liệu
thực tế"; trang etp ?t=luat = MỘT bản luật: điều kiện hiện tại + số thật + đề xuất tối ưu lợi nhuận).
Nguồn: etp.nhat_ky (máy luật đã làm gì, lúc nào, camp nào) + etp.so_ngay (chi / thu từng camp từng ngày UTC = ngày Ethopex) + etp.xet_luat (điều kiện
đang chạy + camp đang chạm, do luat-ethopex.py ghi mỗi lượt — bản luật đọc thẳng từ đó, không chép tay ngưỡng).
  tăng / giảm bậc: lãi/ngày 2 ngày trước so với 2 ngày sau (chỉ ngày đã khép) · tắt: camp bị tắt có đang lãi 3 ngày trước không ·
  nhân bản: bản clone lãi hay lỗ (cùng creative / creative khác) · luật ít chạm: camp gần đạt kẹt ở điều kiện nào.
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
MA = [("tang", r"^lãi đầu phiên", "dau_phien"), ("tang", r"^t30|\$20 → \$30", "t30"), ("tang", r"(đủ điều kiện tăng bậc|ĐỦ ĐIỀU KIỆN TĂNG BẬC|^TB tăng bậc)", "tang"),
      ("tat", r"^L3 ", "l3"), ("tat", r"^L4 ", "l4"), ("tat", r"^L7 ", "l7"), ("tat", r"^T2 ", "t2"), ("tat", r"^T7 \(", "t7"), ("tat", r"^OFF|lỗ lâu", "off"), ("tat", r"^D24|dừng > 24", "d24"), ("tat", r"dừng đêm", "dung_dem"),
      ("nhan_ban", r"^thang nhân bản", "thang_nb"), ("nhan_ban", r"^nhân bản camp thắng · ", "nb")]
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
    so = collections.defaultdict(dict)
    for r in qj("select camp_id c, ngay::text d, chi::float chi, thu::float thu from etp.so_ngay where ngay > current_date - 40"): so[r["c"]][r["d"]] = (r["chi"], r["thu"])
    cr = {r["c"]: r["cr"] for r in qj("select camp_id c, creative_id cr from etp.camp")}
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
    ra = collections.defaultdict(lambda: {"lan": 0, "camp": set(), "mau": []})
    for h in hd:
        m = ma_cua(h["viec"], h["luat"])
        if not m: continue
        x = ra[m]; x["lan"] += 1; x["camp"].add(h["camp_id"]); D = dt.date.fromisoformat(h["d"])
        t = cong(h["camp_id"], D - dt.timedelta(days=2), D - dt.timedelta(days=1))
        if h["viec"] == "nhan_ban":
            s = cong(h["camp_id"], D, homqua); x["mau"].append({"camp": h["camp_id"], "goc": h["goc"], "cung_cr": cr.get(h["camp_id"]) == cr.get(h["goc"]) and cr.get(h["camp_id"]) is not None,
                                                                 "goc3": cong(h["goc"], D - dt.timedelta(days=3), D - dt.timedelta(days=1)), "sau": s})
        elif h["viec"] == "tat":
            x["mau"].append({"camp": h["camp_id"], "truoc": cong(h["camp_id"], D - dt.timedelta(days=3), D - dt.timedelta(days=1))})
        else:
            s = cong(h["camp_id"], D + dt.timedelta(days=1), D + dt.timedelta(days=2))
            m_ = re.search(r"ROI (\d+) ngày ([+-]?\d+)%", h["luat"] or "")
            x["mau"].append({"camp": h["camp_id"], "truoc": t, "sau": s, "roi_dai": int(m_.group(2)) if m_ else None, "ns": [h["truoc"], h["sau"]]})
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
        if m in ("tang", "dau_phien", "t30"):
            do = [a for a in mau if a["sau"][2] and a["truoc"][2]]
            tc, tt, tn = (sum(a["truoc"][i] for a in do) for i in range(3)); sc, st, sn = (sum(a["sau"][i] for a in do) for i in range(3))
            tot = sum(1 for a in do if (a["sau"][1] - a["sau"][0]) / a["sau"][2] > (a["truoc"][1] - a["truoc"][0]) / a["truoc"][2])
            so_.update(do_duoc=len(do), lai_ngay_truoc=round((tt - tc) / tn, 2) if tn else None, lai_ngay_sau=round((st - sc) / sn, 2) if sn else None,
                       roi_truoc=roi(tc, tt), roi_sau=roi(sc, st), chi_ngay_truoc=round(tc / tn, 2) if tn else None, chi_ngay_sau=round(sc / sn, 2) if sn else None, ti_le_tot=round(tot / len(do) * 100) if do else None)
            if len(do) >= 10:
                lt, ls_ = so_["lai_ngay_truoc"], so_["lai_ngay_sau"]
                if m in ("tang", "dau_phien", "t30"):
                    am = [a for a in mau if a["roi_dai"] is not None and a["roi_dai"] < 0]
                    if lt is not None and ls_ is not None:
                        dx.append(DX("Siết điều kiện tăng", f"tăng xong lãi mỗi camp giảm ${lt - ls_:.2f}/ngày.", "thêm điều kiện ROI khung dài cao hơn trước khi tăng.") if ls_ < lt
                                  else DX("Giữ", f"tăng xong lãi mỗi camp tăng thêm ${ls_ - lt:.2f}/ngày.", None))
                    if len(am) >= 5:
                        ra_am = [a for a in am if a["sau"][2]]; ac, at = sum(a["sau"][0] for a in ra_am), sum(a["sau"][1] for a in ra_am)
                        dx.append(DX("Giữ — đã áp 29/10", f"đã thêm ROI khung dài ≥ 0% cho tăng trong ngày ({len(am)} lần tăng cũ khi khung dài âm, sau đó ROI {roi(ac, at)}%).", None) if DA_AP_ROI_DAI else DX("Thêm điều kiện ROI khung dài ≥ 0%", f"{len(am)} lần tăng khi ROI khung dài đang âm; sau đó ROI {roi(ac, at)}%.", "tăng trong ngày chỉ khi ROI khung dài ≥ 0%."))
                elif lt is not None and ls_ is not None:
                    mat = (lt - ls_) * len(do) * 2
                    dx.append(DX("Giữ", "giảm cắt được lỗ.", None) if lt < 0 and ls_ > lt
                              else DX("Tắt thay vì giảm", "camp bị giảm vẫn lỗ như cũ.", "camp lỗ thì tắt luôn, không giảm từng bậc.") if lt < 0
                              else DX("Nới điều kiện giảm", f"camp bị giảm đang lãi; giảm làm mất ≈ ${mat:.0f} trong {NGAY} ngày.", "chỉ giảm khi 2 ngày đã khép cùng lỗ (thay vì 1 ngày).") if ls_ < lt
                              else DX("Giữ", "giảm không làm mất lãi.", None))
        elif m in ("t2", "t7", "off", "d24", "dung_dem", "l3", "l4", "l7"):
            co = [a for a in mau if a["truoc"][2]]; lai = [a for a in co if a["truoc"][1] > a["truoc"][0]]
            tc, tt, tn = (sum(a["truoc"][i] for a in co) for i in range(3))
            so_.update(do_duoc=len(co), roi_3_ngay_truoc=roi(tc, tt), lo_ngay_truoc=round((tt - tc) / tn, 2) if tn else None, dang_lai=len(lai), lai_bi_tat=round(sum(a["truoc"][1] - a["truoc"][0] for a in lai), 2))
            if len(co) >= 5:
                dx.append(DX("Nới điều kiện tắt", f"{len(lai)}/{len(co)} camp bị tắt đang lãi.", "bỏ điều kiện bắt camp đang lãi.") if len(lai) / len(co) > 0.2
                          else DX("Giữ", f"tắt đúng: {len(co) - len(lai)}/{len(co)} camp đang lỗ khi bị tắt.", None))
        elif m in ("nb", "thang_nb"):
            def nhom(ds):
                c, t = sum(a["sau"][0] for a in ds), sum(a["sau"][1] for a in ds)
                return {"n": len(ds), "chi": round(c, 2), "lai": round(t - c, 2), "roi": roi(c, t), "lai_n": sum(1 for a in ds if a["sau"][1] > a["sau"][0])}
            co = [a for a in mau if a["sau"][2]]
            cung, khac = [a for a in co if a["cung_cr"]], [a for a in co if not a["cung_cr"]]
            so_.update(tat_ca=nhom(co), cung_cr=nhom(cung), khac_cr=nhom(khac))
            g = collections.defaultdict(list)
            for a in co:
                gc = a["goc3"][0] / a["goc3"][2] if a["goc3"][2] else 0
                g["gốc tiêu ≥ $14/ngày" if gc >= 14 else "gốc tiêu $6–14/ngày" if gc >= 6 else "gốc tiêu < $6/ngày"].append(a)
            so_["theo_goc"] = {k: nhom(v) for k, v in sorted(g.items())}
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
        if L:
            so_["dang"] = {k: L.get(k, 0) for k in ("dat", "gan", "xa", "khong_ap")}
            kt = L["ket_o"].most_common(2)
            if kt: so_["ket_o"] = kt
            if m == "tang_ngay": dx.append(DX("Xem ở Tăng bậc", "nhật ký ghi chung với Tăng bậc.", None))
            elif not x["lan"] and L.get("gan", 0) >= 5 and not L["dung"] and m in ("nb", "t30", "tang", "thang_nb"):
                dx.append(DX("Xem lại ngưỡng", f"không chạm lần nào; {L['gan']} camp gần đạt.", f"xét lại ngưỡng '{kt[0][0]}' ({kt[0][1]} camp kẹt ở đó)."))
        out[m] = {"ten": L.get("ten") or {"dau_phien": "Lãi đầu phiên", "dung_dem": "Dừng đêm", "d24": "D24 · dừng > 24 giờ"}.get(m, m), "mo_ta": L.get("mo_ta"), "dk": L.get("dk", []),
                  "dung": L.get("dung", False), "so": so_, "de_xuat": dx}
    if "--in" in sys.argv: print(json.dumps(out, ensure_ascii=False, indent=1)); return
    j = json.dumps([{"ma": k, "so": v} for k, v in out.items()], ensure_ascii=False).replace("$J$", "")
    q(f"begin; delete from etp.so_luat; insert into etp.so_luat (ma, so) select ma, so from jsonb_to_recordset($J${j}$J$::jsonb) as x(ma text, so jsonb); commit;")
    print(f"so-luat: {len(out)} luật, {sum(v['so']['lan'] for v in out.values())} lần làm trong {NGAY} ngày")

if __name__ == "__main__":
    main()
