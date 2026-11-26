#!/usr/bin/env python3
"""BÁO PLAN LÊN CAMP ETHOPEX — một lệnh in đủ bảng cho câu hỏi "plan lên camp là gì" (anh 26/11/2026).
Luật báo cáo NẰM TRONG MÃ, không nằm trong trí nhớ của chat (anh: "Các yêu cầu về report này mày phải lưu vào code … để vào chat khác tao cũng ko phải nhắc lại"):
  · mọi bảng có cột K/D — cách lên camp: K = Kiên (link chu-kieu.json kien._link_url), D = Dol (link form-chu.json link_url); cùng nguồn huy hiệu etp2 (kieuCr, etp-doc.ts)
    ("Từ giờ mỗi lần hỏi về plan, mày phải thêm cả cột về cách lên camp của K hay D")
  · mọi bảng có cột Bộ tk — camp lên vào bộ tài khoản nào ("còn 1 cái nữa là lên vào bộ tk nào")
      camp đã xếp: etp.camp.bo · đề xuất creative mới: cong.SQL_BO_PHIM (etp.cau_hinh.bo_phim_moi / bộ đổi của phim) · lượt 2: sổ luot2.bo (đổi bộ gốc)
  · bảng chi / lãi luôn có cột ROI % (feedback_phan_tich_kem_roi)
Bốn bảng: (1) hiệu suất ★ ROAS theo phim × K/D (kèm chi theo bộ) · (2) camp đã xếp chờ chạy theo bộ × K/D · (3) creative chờ lên · (4) đề xuất (phim · K/D · bộ · số camp · lý do).
CHỈ ĐỌC — không tạo / bật camp. Lên camp vẫn chờ lệnh đích danh của anh (nút etp2 / lenh_cho.py).
  python3 apps/etp/bao-plan.py [--ngay 3]   → in bảng markdown (box3, cần DATABASE_URL)
  python3 apps/etp/bao-plan.py --tu-kiem    → bài tự kiểm hàm thuần (không cần DB)
tra-repo-ok: mã dán keo nội bộ etp (đọc sổ etp.* + cong.py của nhà), không có thư viện ngoài nào làm việc này"""
import json, os, re, sys
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import cong as CG   # CG.la_k — tỷ lệ K : D một nguồn với dong_phim

COT_HIEU_SUAT = ("Phim", "K/D", "Camp", "Chi $", "Thu $", "ROI %", "Chi theo bộ tk")
COT_DA_XEP = ("Bộ tk", "K/D", "Camp", "Ngân sách $", "Trong đó lượt 2", "Giờ chạy (VN)")
COT_CHO = ("Phim", "Creative chờ", "Chưa có camp", "K/D của creative chưa camp", "Có chữ K", "Bộ tk nếu lên mới")
COT_DONG = ("Dòng", "Dạng", "Phim", "Bước", "Camp", "K/D dự kiến", "Bộ tk")
COT_DE_XUAT = ("Phim", "K/D đề xuất", "Bộ tk", "Số camp", "Căn cứ", "Ghi chú")
NGUONG_ROI, TRAN_CAMP, CHI_MONG, CHI_TOI_THIEU = -10, 5, 10, 2   # đề xuất: kiểu tốt nhất ROI ≥ −10% · tối đa 5 camp / phim · chi < $10 = số mỏng · kiểu chi < $2 không đem so

def mien(u):
    """hàm thuần: link → tên miền trơn (bỏ giao thức, www, đường dẫn)"""
    return re.sub(r"/.*$", "", re.sub(r"^https?://(www\.)?", "", str(u or "").strip().lower()))

def kieu_link(form, chu_kieu):
    """hàm thuần: sổ chữ → {miền: chữ K/D}. dol = form-chu.json link_url; kiểu khác = chu-kieu.json <kiểu>._link_url (chữ cái đầu: kien → K)."""
    m = {}
    if (form or {}).get("link_url"): m[mien(form["link_url"])] = "D"
    for k, v in (chu_kieu or {}).items():
        if not k.startswith("_") and isinstance(v, dict) and v.get("_link_url"): m[mien(v["_link_url"])] = k[:1].upper()
    return m

def roi(chi, thu):
    return round(100 * (thu - chi) / chi) if chi > 0 else None

def de_xuat(so, cho, co_k):
    """hàm thuần: so {K|D: (chi, thu)} của phim · cho = số creative chưa có camp · co_k = phim có chữ kiểu K trong chu-kieu.json
    → (kiểu, số camp, căn cứ, ghi chú). Không đủ điều kiện thì số camp 0 kèm lý do — không im lặng bỏ phim."""
    co = {k: (c, t) for k, (c, t) in so.items() if c > 0}
    du = {k: v for k, v in co.items() if v[0] >= CHI_TOI_THIEU} or co
    if not du: return "?", 0, "chưa có chi ★ ROAS trong kỳ", ""
    k = max(du, key=lambda x: (roi(*du[x]), du[x][0]))
    r = roi(*du[k]); can = " · ".join(f"{x} {roi(*co[x]):+d}% (${co[x][0]:.2f})" for x in sorted(co))
    ghi = "số mỏng (chi < $%d) — chưa đủ để kết luận" % CHI_MONG if du[k][0] < CHI_MONG else ""
    if r < NGUONG_ROI: return k, 0, can, f"kiểu tốt nhất {k} {r:+d}% < {NGUONG_ROI}% — không lên thêm"
    if k == "K" and not co_k: return k, 0, can, "phim chưa có chữ kiểu K trong chu-kieu.json — không tự viết chữ"
    if cho <= 0: return k, 0, can, "hết creative chưa có camp — cần xưởng cắt thêm (báo giá trước)"
    return k, min(cho, TRAN_CAMP), can, ghi

def kd_dong(loai, so_camp, co_k):
    """hàm thuần: K/D dự kiến của một dòng phim, khớp dong_phim.b_creative_khoi (CG.la_k: mặc định toàn K khi phim có chữ Kiên, D chỉ khi anh chọn ở Chờ lên) — CC2 luôn K"""
    n = int(so_camp or 0)
    if loai == "CC2": return f"K:{n}"
    k = sum(CG.la_k(i, n) for i in range(n)) if co_k else 0
    return " ".join(x for x in (f"K:{k}" if k else "", f"D:{n - k}" if n - k else "") if x) or "—"

def bang(cot, dong):
    return "\n".join(["| " + " | ".join(cot) + " |", "|" + "---|" * len(cot)] + ["| " + " | ".join(str(x) for x in d) + " |" for d in dong]) if dong else "_(không có)_"

def tu_kiem():
    assert mien("https://www.Info.com/abc?x=1") == "info.com" and mien("search.com") == "search.com" and mien(None) == ""
    kl = kieu_link({"link_url": "https://info.com/"}, {"_": "ghi chú", "kien": {"_link_url": "http://search.com/x"}, "_bo": {"_link_url": "x.com"}})
    assert kl == {"info.com": "D", "search.com": "K"}, kl
    assert de_xuat({}, 5, True)[1] == 0
    assert de_xuat({"K": (58.5, 49.2), "D": (63.3, 63.9)}, 5, True)[:2] == ("D", 5)          # Bugatti EN 26/11: D +1% hơn K −16%
    assert de_xuat({"K": (2.38, 3.12), "D": (20.0, 6.4)}, 4, True)[:2] == ("K", 4)           # Sal de mi Bugatti: K +31%
    assert de_xuat({"K": (2.38, 3.12), "D": (20.0, 6.4)}, 4, False)[1] == 0                  # K tốt nhưng chưa có chữ K → không lên, có lý do
    assert de_xuat({"K": (10, 4.2), "D": (10, 5.6)}, 9, True)[1] == 0                        # cả hai lỗ sâu → 0
    assert de_xuat({"D": (9.0, 10.9)}, 0, True)[1] == 0                                      # hết creative → 0, ghi cần cắt thêm
    assert de_xuat({"K": (1.0, 3.0), "D": (9.0, 10.0)}, 9, True)[0] == "D"                   # kiểu chi < $2 không đem so khi kiểu kia đủ chi
    assert "số mỏng" in de_xuat({"D": (5.0, 6.0)}, 3, True)[3]
    assert all(any("K/D" in x for x in c) for c in (COT_HIEU_SUAT, COT_DA_XEP, COT_DE_XUAT, COT_DONG)) and all(any("bộ tk" in x.lower() for x in c) for c in (COT_HIEU_SUAT, COT_DA_XEP, COT_CHO, COT_DE_XUAT, COT_DONG))
    assert kd_dong("AD", 4, True) == "K:4" and kd_dong("AD", 2, True) == "K:2" and kd_dong("AD", 4, False) == "D:4" and kd_dong("CC2", 2, True) == "K:2" and kd_dong("AD", 0, True) == "—"
    print("bao-plan tự kiểm: đạt")

def chay(n):
    q = CG._q
    doc = lambda f: json.load(open(os.path.join(D, f)))
    ck = doc("chu-kieu.json"); kl = kieu_link(doc("form-chu.json"), ck)
    if not kl: raise SystemExit("KHÔNG đọc được form-chu.json / chu-kieu.json — cột K/D sẽ sai, dừng")
    co_k = {x for x in (ck.get("kien") or {}) if x.isdigit()}
    KIEU = "case " + " ".join(f"when lower(regexp_replace(regexp_replace(coalesce(b.link,''),'^https?://(www\\.)?',''),'/.*$','')) = '{m}' then '{k}'" for m, k in kl.items()) + " else '?' end"
    BO = json.loads(q("select gia_tri::text from xv_khoa_ngoai where ten = 'ethopex_bo_tk'") or "{}")
    ten_bo = lambda b: f"bộ {b} · {BO[b]['ten'].split(' · ')[0]}" if b in BO else f"bộ {b or '?'}"
    rows = lambda s: [l.split("|") for l in q(s).splitlines() if l]

    # (1) hiệu suất ★ ROAS theo phim × K/D × bộ, từ (hôm nay − n) ngày Ethopex (ngày UTC = 07:00 VN)
    hs = {}
    for cid, k, bo, cp, chi, thu in rows(f"""with c as (select c.camp_id, c.content_id, coalesce(c.bo, '') bo, {KIEU} k from etp.camp c
          left join etp.bai_cr b on b.creative_id = etp.creative_cua(c.creative_id, c.ten) where c.la_roas),
        s as (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_gio_camp where ngay >= (now() at time zone 'utc')::date - {int(n)} group by 1 having sum(chi) > 0)
        select c.content_id, c.k, c.bo, count(*), round(sum(s.chi), 2), round(sum(s.thu), 2) from c join s using (camp_id) group by 1, 2, 3"""):
        h = hs.setdefault(int(cid), {}).setdefault(k, {"camp": 0, "chi": 0.0, "thu": 0.0, "bo": {}})
        h["camp"] += int(cp); h["chi"] += float(chi); h["thu"] += float(thu); h["bo"][bo] = h["bo"].get(bo, 0) + float(chi)
    # (2) camp đã xếp chờ chạy (lich > bây giờ)
    xep = rows(f"""select coalesce(c.bo, ''), {KIEU}, count(*), coalesce(sum(c.ngan_sach), 0)::int, count(l.camp_moi),
          string_agg(distinct to_char(c.lich at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), ', ')
        from etp.camp c left join etp.bai_cr b on b.creative_id = etp.creative_cua(c.creative_id, c.ten) left join etp.luot2 l on l.camp_moi = c.camp_id
        where c.lich > now() and c.trang_thai = 'ACTIVE' group by 1, 2 order by 1, 2""")
    # (3) creative chờ lên (etp.cho_len_v) — phim có số trong kỳ hoặc có camp đã xếp
    cho = {int(r[0]): r[1:] for r in rows(f"""select v.content_id, count(*), count(*) filter (where not coalesce(v.co_dang, false)),
          coalesce(string_agg(k, '') filter (where not coalesce(v.co_dang, false)), '')
        from etp.cho_len_v v left join lateral (select {KIEU} k from etp.bai_cr b where b.creative_id = v.creative_id) x on true group by 1""")}
    phim = sorted(hs, key=lambda c: -sum(x["chi"] for x in hs[c].values()))
    ten = dict(rows("select content_id, replace(coalesce(ten, ''), '|', '/') from etp.thu_vien_phim where content_id in (%s)" % ",".join(map(str, phim)))) if phim else {}
    tp = lambda c: f"{(ten.get(str(c)) or '?')[:32]} ({c})"
    bo_moi = {c: q(CG.SQL_BO_PHIM.format(cid=int(c))) or "?" for c in phim}

    out = [f"## Plan lên camp Ethopex — số ★ ROAS từ {n} ngày Ethopex trước tới giờ (ngày bắt đầu 07:00 VN)", "", "### 1. Hiệu suất ★ ROAS theo phim × K/D"]
    out.append(bang(COT_HIEU_SUAT, [(tp(c), k, h["camp"], f"{h['chi']:.2f}", f"{h['thu']:.2f}", f"{roi(h['chi'], h['thu']):+d}",
                                     ", ".join(f"{ten_bo(b)} ${v:.2f}" for b, v in sorted(h["bo"].items())))
                                    for c in phim for k, h in sorted(hs[c].items())]))
    out += ["", "### 2. Camp đã xếp chờ chạy (theo bộ tk × K/D)", bang(COT_DA_XEP, [(ten_bo(b), k, cp, ns, l2, g) for b, k, cp, ns, l2, g in xep])]
    out += ["", f"### 3. Creative chờ lên (etp.cho_len_v) — bộ tk lên mới: cong.SQL_BO_PHIM (bo_phim_moi = {q(chr(32).join(['select gia_tri#>>', chr(39) + '{}' + chr(39), 'from etp.cau_hinh where khoa =', chr(39) + 'bo_phim_moi' + chr(39)])) or '?'})"]
    out.append(bang(COT_CHO, [(tp(c), cho[c][0], cho[c][1], " ".join(f"{x}:{cho[c][2].count(x)}" for x in sorted(set(cho[c][2]))) or "—",
                               "có" if str(c) in co_k else "chưa", ten_bo(bo_moi[c])) for c in phim if c in cho]))
    dx = [(c,) + de_xuat({k: (h["chi"], h["thu"]) for k, h in hs[c].items()}, int(cho.get(c, (0, 0, ""))[1]), str(c) in co_k) for c in phim]
    out += ["", f"### 4. Đề xuất (★ ROAS 1 · $5 · luật: kiểu ROI tốt nhất ≥ {NGUONG_ROI}%, tối đa {TRAN_CAMP} camp / phim, chỉ creative chưa có camp)",
            bang(COT_DE_XUAT, [(tp(c), k, ten_bo(bo_moi[c]) if so else "—", so, can, ghi) for c, k, so, can, ghi in dx])]
    # (5) dòng phim đang dựng (xưởng) — camp sẽ lên ở giờ lên kế, K/D + bộ tk biết TRƯỚC khi lên (anh 26/11/2026: "sao tao cứ phải nhắc đi nhắc lại tỷ lệ này")
    dong = rows("""select d.id, d.loai, d.content_id, replace(coalesce(d.ten, ''), '|', '/'), coalesce(d.so_camp, 0),
          coalesce((select string_agg(b.buoc || ':' || b.trang_thai, ' ' order by b.thu_tu) from etp.dong_buoc b where b.dong_id = d.id and b.trang_thai in ('dang', 'loi', 'dung')), 'chờ'), coalesce(d.bo, '')
        from etp.dong_phim d where d.trang_thai = 'chay' order by d.loai, d.id""")
    dd = [(f"#{i}", l, f"{t[:30]} ({c})", bu[:40], n, kd_dong(l, n, c in co_k), ten_bo(bo or (q(CG.SQL_BO_PHIM.format(cid=int(c))) or "?"))) for i, l, c, t, n, bu, bo in dong]
    tk = {"K": 0, "D": 0}
    for x in dd:
        for p in x[5].split():
            if ":" in p: tk[p[0]] += int(p.split(":")[1])
    out += ["", f"### 5. Dòng phim đang dựng — K/D dự kiến khi lên (tổng K {tk['K']} / D {tk['D']})", bang(COT_DONG, dd)]
    tong = sum(x[2] for x in dx)
    out += ["", f"**Tổng đề xuất: {tong} camp** · " + ", ".join(f"{ten_bo(b)}: {sum(x[2] for x in dx if x[2] and bo_moi[x[0]] == b)}" for b in sorted({bo_moi[x[0]] for x in dx if x[2]})) if tong else "**Tổng đề xuất: 0 camp**",
            "Chỉ đọc — chưa lên camp nào. Lên = lệnh đích danh của anh (nút ▶ Lên etp2 / lenh_cho.py)."]
    print("\n".join(out))

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--tu-kiem" in a: tu_kiem(); sys.exit(0)
    chay(int(a[a.index("--ngay") + 1]) if "--ngay" in a else 3)
