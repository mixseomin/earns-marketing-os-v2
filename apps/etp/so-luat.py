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
DB = os.environ.get("DATABASE_URL")
def q(s):
    r = subprocess.run(["psql", DB, "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=180)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def qj(s): return json.loads(q(f"select coalesce(json_agg(t), '[]') from ({s}) t") or "[]")

# nhật ký máy luật → mã luật (cùng mã etp.xet_luat). Lệnh tay của anh / sửa CTA / dọn lỗi KHÔNG tính vào luật nào.
MA = [("tang", r"^lãi đầu phiên", "dau_phien"), ("tang", r"^t30|\$20 → \$30", "t30"), ("tang", r"(đủ điều kiện tăng bậc|ĐỦ ĐIỀU KIỆN TĂNG BẬC|^TB tăng bậc)", "tang"),
      ("giam", r"trong ngày", "giam_ngay"), ("giam", r"^giảm sớm", "giam_som"), ("giam", r"ROI T[ỤU]T", "roi_tut"), ("giam", r"^giảm bậc \(GB\)", "gb"),
      ("tat", r"^T2 ", "t2"), ("tat", r"^T7 \(", "t7"), ("tat", r"^OFF|lỗ lâu", "off"), ("tat", r"^D24|dừng > 24", "d24"), ("tat", r"dừng đêm", "dung_dem"),
      ("nhan_ban", r"^thang nhân bản", "thang_nb"), ("nhan_ban", r"^nhân bản camp thắng · ", "nb")]
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
    for m in sorted(set(luat) | set(ra)):
        L = luat.get(m, {}); x = ra.get(m, {"lan": 0, "camp": set(), "mau": []}); mau = x["mau"]; dx = []
        so_ = {"lan": x["lan"], "camp": len(x["camp"]), "ngay": NGAY}
        if m in ("tang", "dau_phien", "t30", "gb", "giam_ngay", "giam_som", "roi_tut"):
            do = [a for a in mau if a["sau"][2] and a["truoc"][2]]
            tc, tt, tn = (sum(a["truoc"][i] for a in do) for i in range(3)); sc, st, sn = (sum(a["sau"][i] for a in do) for i in range(3))
            tot = sum(1 for a in do if (a["sau"][1] - a["sau"][0]) / a["sau"][2] > (a["truoc"][1] - a["truoc"][0]) / a["truoc"][2])
            so_.update(do_duoc=len(do), lai_ngay_truoc=round((tt - tc) / tn, 2) if tn else None, lai_ngay_sau=round((st - sc) / sn, 2) if sn else None,
                       roi_truoc=roi(tc, tt), roi_sau=roi(sc, st), chi_ngay_truoc=round(tc / tn, 2) if tn else None, chi_ngay_sau=round(sc / sn, 2) if sn else None, ti_le_tot=round(tot / len(do) * 100) if do else None)
            if len(do) >= 10:
                if m in ("tang", "dau_phien", "t30"):
                    am = [a for a in mau if a["roi_dai"] is not None and a["roi_dai"] < 0]
                    if so_["lai_ngay_sau"] is not None and so_["lai_ngay_truoc"] is not None and so_["lai_ngay_sau"] < so_["lai_ngay_truoc"]:
                        dx.append(f"Sau khi tăng, lãi mỗi camp mỗi ngày giảm ${so_['lai_ngay_truoc']:.2f} → ${so_['lai_ngay_sau']:.2f} (ROI {so_['roi_truoc']}% → {so_['roi_sau']}%, {len(do)} lần đo) — tăng đang mua thêm chi mà không thêm lãi.")
                    else:
                        dx.append(f"Sau khi tăng, lãi mỗi camp mỗi ngày ${so_['lai_ngay_truoc']:.2f} → ${so_['lai_ngay_sau']:.2f} ({len(do)} lần đo, {so_['ti_le_tot']}% lần lãi tăng) — luật đang ra tiền, giữ.")
                    if len(am) >= 5:
                        ra_am = [a for a in am if a["sau"][2]]; ac, at = sum(a["sau"][0] for a in ra_am), sum(a["sau"][1] for a in ra_am)
                        dx.append(f"{len(am)}/{len(mau)} lần tăng khi ROI khung dài đang ÂM (chỉ nhờ ROI hôm nay) — sau đó ROI {roi(ac, at)}% trên ${ac:.0f} chi. Đề xuất: tăng trong ngày phải kèm ROI khung dài ≥ 0%.")
                else:
                    if so_["lai_ngay_sau"] is not None and so_["lai_ngay_truoc"] is not None:
                        lt, ls_ = so_["lai_ngay_truoc"], so_["lai_ngay_sau"]
                        ket = ("giảm cắt được lỗ, giữ." if lt < 0 and ls_ > lt else "giảm KHÔNG cứu được: vẫn lỗ như cũ → tắt thay vì giảm từng bậc." if lt < 0
                               else f"camp bị giảm đang LÃI trong 2 ngày trước → giảm làm mất ${lt - ls_:.2f}/camp/ngày (≈ ${(lt - ls_) * len(do) * 2:.0f} trên {len(do)} lần × 2 ngày đo; chưa có nhóm đối chứng): luật bắt camp quá sớm — nới (vd xét 2 ngày khép thay vì 1 ngày)." if ls_ < lt
                               else "giảm không làm mất lãi, giữ.")
                        dx.append(f"Sau khi giảm, lãi mỗi camp mỗi ngày ${lt:.2f} → ${ls_:.2f}, chi/ngày ${so_['chi_ngay_truoc']:.2f} → ${so_['chi_ngay_sau']:.2f} ({len(do)} lần đo) — " + ket)
        elif m in ("t2", "t7", "off", "d24", "dung_dem"):
            co = [a for a in mau if a["truoc"][2]]; lai = [a for a in co if a["truoc"][1] > a["truoc"][0]]
            tc, tt, tn = (sum(a["truoc"][i] for a in co) for i in range(3))
            so_.update(do_duoc=len(co), roi_3_ngay_truoc=roi(tc, tt), lo_ngay_truoc=round((tt - tc) / tn, 2) if tn else None, dang_lai=len(lai), lai_bi_tat=round(sum(a["truoc"][1] - a["truoc"][0] for a in lai), 2))
            if len(co) >= 5:
                dx.append(f"{len(lai)}/{len(co)} camp bị tắt đang LÃI trong 3 ngày trước đó (lãi ${so_['lai_bi_tat']:.2f})" + (" — tắt nhầm nhiều, nới điều kiện." if len(lai) / len(co) > 0.2 else " — tắt đúng phần lớn, giữ.")
                          + (f" Phần còn lại lỗ ${-so_['lo_ngay_truoc']:.2f}/camp/ngày trước khi tắt." if so_["lo_ngay_truoc"] is not None and so_["lo_ngay_truoc"] < 0 else ""))
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
                dx.append(f"Clone ra: {so_['tat_ca']['n']} bản, lãi ${so_['tat_ca']['lai']:.2f} (ROI {so_['tat_ca']['roi']}%), {so_['tat_ca']['lai_n']} bản có lãi.")
                if len(cung) >= 5 and len(khac) >= 5 and (so_["cung_cr"]["roi"] or 0) - (so_["khac_cr"]["roi"] or 0) >= 20:
                    dx.append(f"Clone CÙNG creative (giống hệt) ROI {so_['cung_cr']['roi']}% ({len(cung)} bản) so với creative KHÁC ROI {so_['khac_cr']['roi']}% ({len(khac)} bản) → đề xuất: nhân bản camp thắng giữ nguyên creative trước, đổi creative chỉ khi creative đã bão hoà.")
                for k, v in so_["theo_goc"].items():
                    if v["n"] >= 8: dx.append(f"{k}: {v['n']} clone, ROI {v['roi']}%, lãi ${v['lai']:.2f}.")
        if L:
            so_["dang"] = {k: L.get(k, 0) for k in ("dat", "gan", "xa", "khong_ap")}
            kt = L["ket_o"].most_common(2)
            if kt: so_["ket_o"] = kt
            if m == "tang_ngay": dx.append("Lần làm của luật này ghi chung trong nhật ký với Tăng bậc (cùng việc 'tang') — kết quả sau khi tăng xem ở luật Tăng bậc.")
            elif not x["lan"] and L.get("gan", 0) >= 5 and not L["dung"] and m in ("nb", "t30", "tang", "thang_nb"):
                dx.append(f"Luật không chạm lần nào trong {NGAY} ngày dù {L['gan']} camp đang gần đạt — kẹt nhiều nhất ở '{kt[0][0]}' ({kt[0][1]} camp). Xem lại ngưỡng điều kiện này.")
        out[m] = {"ten": L.get("ten") or {"dau_phien": "Lãi đầu phiên", "dung_dem": "Dừng đêm", "d24": "D24 · dừng > 24 giờ"}.get(m, m), "mo_ta": L.get("mo_ta"), "dk": L.get("dk", []),
                  "dung": L.get("dung", False), "so": so_, "de_xuat": dx}
    if "--in" in sys.argv: print(json.dumps(out, ensure_ascii=False, indent=1)); return
    j = json.dumps([{"ma": k, "so": v} for k, v in out.items()], ensure_ascii=False).replace("$J$", "")
    q(f"begin; delete from etp.so_luat; insert into etp.so_luat (ma, so) select ma, so from jsonb_to_recordset($J${j}$J$::jsonb) as x(ma text, so jsonb); commit;")
    print(f"so-luat: {len(out)} luật, {sum(v['so']['lan'] for v in out.values())} lần làm trong {NGAY} ngày")

if __name__ == "__main__":
    main()
