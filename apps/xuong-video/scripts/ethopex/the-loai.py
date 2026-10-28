#!/usr/bin/env python3
"""THỂ LOẠI PHIM × THỨ TRONG TUẦN (anh 24/10/2026: "loại phim và hiệu suất theo ngày trong tuần… phim viễn tưởng trẻ em cuối tuần cao hơn… làm sao theo dõi
và có báo cáo"). Chạy trên box3.
  1. Thể loại mỗi phim: studio xv_khoa_ngoai['ethopex_the_loai'] {content_id: {tl, nguon: claude|tu, ten}} — Claude gắn (đọc tên / poster, 0đ);
     phim chưa gắn → máy đoán theo từ khoá trong tên (nguon "tu", Claude sửa ở bước soát poster: the-loai.py --gan <id>=<tl> …).
  2. Số: Report Ethopex theo phim × ngày (ngày Ethopex = ngày UTC, 07:00 VN) từ 20/10 → gộp thể loại × thứ, kèm cỡ mẫu (chi, số ngày, số phim).
     Ô chi < CHI_DU hoặc < 2 ngày đo = chưa đủ mẫu (đánh dấu, không kết luận). Chỉ số lệch = ROI thứ đó − ROI cả tuần của chính thể loại đó.
  3. Ghi studio ['ethopex_the_loai_thu'] (tab Ethopex mos2 › Thể loại đọc) · --tg in tóm tắt HTML cho Telegram (phòng Ethopex gửi sáng thứ Hai).
Dùng: the-loai.py [--tg] · the-loai.py --gan 94344=vo_danh 92980=vo_danh"""
import datetime as dt, json, os, re, subprocess, sys, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp")); import ethopex_api as EA   # cổng chung: chỉ tài khoản nhà (anh 28/10/2026)
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
TL = {"ty_phu": "Tỷ phú / CEO / thừa kế", "vo_danh": "Kẻ vô danh lật ngược", "hoi_han": "Gia đình hối hận / phản bội", "me_con": "Mẹ – con / em bé / bảo mẫu",
      "soi": "Alpha / sói / Luna", "fantasy": "Rồng / phép thuật / thần", "vien_tuong": "Viễn tưởng / siêu anh hùng", "he_thong": "Hệ thống / trùng sinh / dị năng",
      "mafia": "Mafia", "hoc_duong": "Học đường / thể thao", "co_trang": "Cổ trang / hoàng gia / lịch sử", "tinh_cam": "Tình cảm", "doi_thuong": "Đời thường / ẩm thực / công sở"}
DOAN = [("soi", r"alpha|luna|lycan|wolf|\bpack\b|\bmate\b|lobo|alfa|fenrir"), ("mafia", r"mafia|godfather|\bdon\b|capo"),
        ("me_con", r"baby|twins|triplet|nanny|mommy|daddy|mamá|papá|gemelos|beb[eé]|niñera|single mom|madre soltera"),
        ("vien_tuong", r"galactic|mecha|super-?powered|alien|dino|robot|space"), ("he_thong", r"system|cashback|reborn|x-?ray|rango|sss|rebirth|renac|level"),
        ("fantasy", r"dragon|drag[oó]n|\bgod\b|goddess|witch|mage|magic|vampire|demon|devil|dios|celestial|herrero|potion|sea god|genio|satan"),
        ("co_trang", r"princess|empire|emperor|reina|cleopatra|time travel|majesty|prince\b|duke|imperial"),
        ("vo_danh", r"homeless|nobody|loser|vagabund|beggar|janitor|don nadie|limpiador|oculto|hidden|outcast|trash"),
        ("ty_phu", r"billionaire|\bceo\b|heir|heiress|millonari|multimillon|tycoon|jefa|rich|fortune|luxury|gold"),
        ("hoi_han", r"regret|betray|ex-?wife|ex-?husband|divorc|revenge|traici|arrepent|too late|cheating|tit for tat"),
        ("hoc_duong", r"school|academy|college|bully|basketball|escuela|campus|prep"), ("doi_thuong", r"chef|culinary|cocin|restaurant|office")]
THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
CHI_DU = 15   # $ chi tối thiểu của một ô (thể loại × thứ) mới đọc được

def doan(ten):
    t = (ten or "").lower()
    return next((k for k, m in DOAN if re.search(m, t)), "tinh_cam")

def main():
    a = sys.argv[1:]
    so = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_the_loai'") or "{}")
    if "--gan" in a:
        for x in a[a.index("--gan") + 1:]:
            i, _, t = x.partition("=")
            if t not in TL: sys.exit(f"thể loại '{t}' không có — chọn: {', '.join(TL)}")
            so[i] = {**so.get(i, {}), "tl": t, "nguon": "claude"}
        v = json.dumps(so, ensure_ascii=False).replace("'", "''")
        q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_the_loai', '{v}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
        return print("đã gắn", len(a) - a.index("--gan") - 1, "phim")
    T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
    nay = dt.datetime.now(dt.timezone.utc).date()
    b = json.dumps({"columns": ["campaign_name", "content_name", "date", "cost", "revenue"], "group_by": ["campaign_name", "content_name", "date"], "filters": {}, "metric_conditions": [], "limit": 20000, "page": 1, "page_size": 20000,
                    "date_from": "2026-10-20", "date_to": (nay - dt.timedelta(days=1)).isoformat()}).encode()   # bỏ hôm nay (chưa khép, doanh thu còn về)
    rows = EA.loc_report(json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=b, method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-the-loai"}), timeout=180))["rows"])
    moi = 0
    for x in rows:
        i = str(x.get("content_group_id"))
        if i not in so: so[i] = {"tl": doan(x["content_group_name"]), "nguon": "tu", "ten": x["content_group_name"]}; moi += 1
        elif "ten" not in so[i]: so[i]["ten"] = x["content_group_name"]
    o = {}   # (tl, thu) → [chi, thu_tien, set ngày, set phim]
    tong = {}
    for x in rows:
        c, r = float(x.get("cost") or 0), float(x.get("revenue") or 0)
        if c == 0 and r == 0: continue
        i = str(x.get("content_group_id")); tl = so[i]["tl"]; d = dt.date.fromisoformat(str(x["report_date"])[:10]); th = THU[d.weekday()]
        for k in ((tl, th), (tl, "*"), ("*", th), ("*", "*")):
            e = o.setdefault(k, [0.0, 0.0, set(), set()]); e[0] += c; e[1] += r; e[2].add(d.isoformat()); e[3].add(i)
    roi = lambda e: round((e[1] - e[0]) / e[0] * 100) if e and e[0] >= 1 else None
    bang = {}
    for (tl, th), e in o.items():
        bang.setdefault(tl, {})[th] = {"chi": round(e[0], 2), "thu": round(e[1], 2), "roi": roi(e), "ngay": len(e[2]), "phim": len(e[3]), "du": e[0] >= CHI_DU and len(e[2]) >= 2}
    for tl, ds in bang.items():   # lệch so với ROI cả tuần của chính thể loại
        rt = ds.get("*", {}).get("roi")
        for th, x in ds.items(): x["lech"] = (x["roi"] - rt) if (x["roi"] is not None and rt is not None and th != "*") else None
    # ── 3 BẢNG THÊM (anh 24/10/2026 "làm luôn"): GIỜ × thể loại · VÒNG ĐỜI (ROI theo ngày tuổi camp) × thể loại · DẠNG creative × thể loại
    def rp(cols, gb):
        if "campaign_name" not in gb: cols, gb = ["campaign_name"] + cols, ["campaign_name"] + gb   # nhóm theo camp để lọc tài khoản nhà (28/10/2026)
        bb = json.dumps({"columns": cols, "group_by": gb, "filters": {}, "metric_conditions": [], "limit": 50000, "page": 1, "page_size": 50000, "date_from": "2026-10-20", "date_to": (nay - dt.timedelta(days=1)).isoformat()}).encode()
        return EA.loc_report(json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=bb, method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-the-loai"}), timeout=240))["rows"])
    def gop(dst, tl, cot, c, r, mau_ngay, mau_phim):
        for k in ((tl, cot), (tl, "*"), ("*", cot), ("*", "*")):
            e = dst.setdefault(k, [0.0, 0.0, set(), set()]); e[0] += c; e[1] += r; e[2].add(mau_ngay); e[3].add(mau_phim)
    def thanh_bang(src, so_mau=2):
        out = {}
        for (tl, cot), e in src.items(): out.setdefault(tl, {})[cot] = {"chi": round(e[0], 2), "thu": round(e[1], 2), "roi": roi(e), "ngay": len(e[2]), "phim": len(e[3]), "du": e[0] >= CHI_DU and len(e[3]) >= so_mau}
        for tl, ds in out.items():
            rt = ds.get("*", {}).get("roi")
            for cot, x in ds.items(): x["lech"] = (x["roi"] - rt) if (x["roi"] is not None and rt is not None and cot != "*") else None
        return out
    g = {}
    for x in rp(["content_name", "hour", "cost", "revenue"], ["content_name", "hour"]):   # giờ báo cáo = giờ UTC → đổi giờ VN
        c, r = float(x.get("cost") or 0), float(x.get("revenue") or 0)
        if c == 0 and r == 0: continue
        i = str(x.get("content_group_id")); tl = so.get(i, {}).get("tl") or doan(x.get("content_group_name")); h = f"{(int(x['hour']) + 7) % 24:02d}"
        gop(g, tl, h, c, r, h, i)
    camps = EA.camp_nha()
    vd, dg = {}, {}
    DANG = [("ke chuyen", "Kể chuyện"), ("canh that", "Cảnh thật"), ("canh cuoi", "Cảnh cuối"), ("phim dai", "Phim dài"), ("lam moi", "Làm mới")]
    for x in rp(["campaign_name", "content_name", "date", "cost", "revenue"], ["campaign_name", "content_name", "date"]):
        c, r = float(x.get("cost") or 0), float(x.get("revenue") or 0)
        if c == 0 and r == 0: continue
        i = str(x.get("content_group_id")); tl = so.get(i, {}).get("tl") or doan(x.get("content_group_name")); cid = x.get("campaign_id")
        tao = (camps.get(cid) or {}).get("created_at")
        if tao:
            tuoi = (dt.date.fromisoformat(str(x["report_date"])[:10]) - dt.date.fromisoformat(tao[:10])).days
            gop(vd, tl, ("N" + str(tuoi)) if tuoi < 7 else "N7+", c, r, str(cid), str(cid))   # mẫu = số camp
        ten = (x.get("campaign_name") or "").lower(); dang = next((v for k, v in DANG if k in ten), "Khác")
        gop(dg, tl, dang, c, r, str(cid), i)
    them = {"gio": thanh_bang(g), "vong_doi": thanh_bang(vd, 3), "dang": thanh_bang(dg)}
    ngay = sorted({d for e in o.values() for d in e[2]})
    kq = {"luc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "tu": ngay[0] if ngay else None, "den": ngay[-1] if ngay else None, "so_ngay": len(ngay),
          "the_loai": TL, "bang": bang, "chi_du": CHI_DU, "phim": {i: v["tl"] for i, v in so.items()}, **them}
    v = json.dumps(so, ensure_ascii=False).replace("'", "''")
    q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_the_loai', '{v}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
    v = json.dumps(kq, ensure_ascii=False).replace("'", "''")
    q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_the_loai_thu', '{v}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
    hang = sorted([t for t in bang if t != "*"], key=lambda t: -bang[t]["*"]["chi"])
    if "--tg" in a:
        tuan = kq["so_ngay"] / 7
        dong = [f"📅 <b>THỂ LOẠI × THỨ TRONG TUẦN</b> · {kq['tu']} → {kq['den']} ({kq['so_ngay']} ngày Ethopex)"]
        if tuan < 4: dong.append(f"<i>Mới {kq['so_ngay']} ngày — cần ≥ 4 tuần mới kết luận được; dưới đây chỉ là số đang tích luỹ.</i>")
        for t in hang[:8]:
            ds = bang[t]; tot = ds["*"]
            cao = max((x for th, x in ds.items() if th != "*" and x["du"] and x["lech"] is not None), key=lambda x: x["lech"], default=None)
            th_cao = next((th for th, x in ds.items() if x is cao), None)
            dong.append(f"• <b>{TL[t]}</b>: ROI {tot['roi']:+d}% · chi ${tot['chi']:.0f} · {tot['phim']} phim" + (f" · tốt nhất {th_cao} ({cao['lech']:+d} điểm)" if cao and tuan >= 4 else ""))
        print("\n".join(dong)); return
    print(f"{kq['so_ngay']} ngày ({kq['tu']} → {kq['den']}) · phim mới tự đoán thể loại: {moi}")
    print(f"{'thể loại':28s}" + "".join(f"{th:>9s}" for th in THU) + f"{'cả tuần':>12s}")
    for t in ["*"] + hang:
        ds = bang[t]; ten = "TẤT CẢ" if t == "*" else TL[t]
        o_ = lambda x: (f"{x['roi']:+d}%" + ("" if x["du"] else "·") if x and x["roi"] is not None else "—")
        print(f"{ten[:28]:28s}" + "".join(f"{o_(ds.get(th)):>9s}" for th in THU) + f"{o_(ds.get('*')):>8s} ${ds['*']['chi']:.0f}")
    print("(· = chưa đủ mẫu: chi < $%d hoặc < 2 ngày)" % CHI_DU)
    o_ = lambda x: (f"{x['roi']:+d}%" + ("" if x["du"] else "·") if x and x["roi"] is not None else "—")
    for ten_b, cots in (("vong_doi", ["N0", "N1", "N2", "N3", "N4", "N5", "N6", "N7+"]), ("dang", ["Kể chuyện", "Cảnh thật", "Cảnh cuối", "Phim dài", "Làm mới"])):
        print(f"\n{ten_b.upper()}"); print(f"{'':28s}" + "".join(f"{c[:9]:>10s}" for c in cots))
        for t in ["*"] + hang:
            ds = kq[ten_b].get(t, {}); print(f"{('TẤT CẢ' if t == '*' else TL[t])[:28]:28s}" + "".join(f"{o_(ds.get(c)):>10s}" for c in cots))
    gi = kq["gio"].get("*", {}); print("\nGIỜ VN (tất cả):", " ".join(f"{h}h {o_(gi.get(h))}" for h in sorted(k for k in gi if k != "*")))

if __name__ == "__main__": main()
