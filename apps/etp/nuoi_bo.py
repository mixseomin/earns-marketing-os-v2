#!/usr/bin/env python3
"""NUÔI BỘ TÀI KHOẢN ÍT CAMP (anh 11/11/2026: "Cần lên thêm camp ở 2 bộ chưa lên camp nào để nuôi tài khoản … bộ nào có hiệu suất tốt" · "Ok thì làm").
Worker ethopex.mjs gọi mỗi nhịp. Nhân bản ($1, GIỮ creative gốc — nhan-ban.py --bo) camp thắng của PHIM THẮNG sang bộ trong etp.cau_hinh.tran_len.nuoi
(apps/etp/tran_len.py chia phần trần camp mới / ngày: bộ 3 · 4 · 5), đi qua mọi cổng như nhân bản thường (cong.kiem: trần camp mới / ngày, bộ đang dừng — chốt 3, $1, phim cất…).
  phim thắng = 7 ngày đã khép chi ≥ PHIM_CHI, ROI 7 ngày ≥ PHIM_ROI% VÀ ROI 3 ngày ≥ PHIM_ROI% (camp nhà, mọi bộ, TÍNH CẢ ★ ROAS — anh 14/11/2026 "Mở bộ 3 scale":
               phim thắng lớn lãi chủ yếu ở ROAS, bản cũ chỉ đếm camp thường nên 14/11 chỉ 1 phim đủ chuẩn, Number One · Nobody (ROI 7 ngày 28%) bị bỏ)
  camp gốc   = camp thường đang bật của phim có ROI 7 ngày cao nhất (chi 7 ngày ≥ GOC_CHI)
  mỗi phim ≤ PHIM_BO camp nuôi / bộ / ngày VN; mỗi nhịp ≤ MOI_NHIP camp (dàn đều trong ngày); bộ đủ phần thì thôi.
Không chép camp KHÔNG tiêu / đang lỗ (bài học bộ 4, 08/11/2026: 43 bản chép camp bộ 2 không tiêu → ROI −60%).
Công tắc lên camp mới (etp.cau_hinh.dung_camp_moi) đang TẮT thì không nuôi.
  python3 apps/etp/nuoi_bo.py          → làm (in một dòng JSON)
  python3 apps/etp/nuoi_bo.py --xem    → chỉ in kế hoạch nhịp này, không tạo gì"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import cong as CG   # công tắc luật cũ (sổ luật luat_cu, anh 22/11/2026)

PHIM_CHI, PHIM_ROI, GOC_CHI, PHIM_BO, MOI_NHIP = 50, 25, 5, 3, 4
NB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "nhan-ban.py")
LUAT = "nuôi bộ"
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=60).stdout.strip()

def ke_hoach():
    tl = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'tran_len'), '{}')") or "{}")
    if q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'dung_camp_moi'), 'false')") == "true": return [], "công tắc lên camp mới đang TẮT"
    if CG.LUAT_CU_DUNG: return [], CG.LY_LUAT_CU   # nuôi bộ 11/11 là luật trước 20/11 (anh 22/11/2026)
    nuoi = {str(b): int(n) for b, n in (tl.get("nuoi") or {}).items() if int(n) > 0}
    if not nuoi: return [], "tran_len chưa chia phần nuôi (trần 0 hoặc chưa quyết hôm nay)"
    da = {}   # (bộ, phim) → số camp nuôi hôm nay
    # đếm từ nhật ký GỐC (xv_khoa_ngoai['ethopex_nhat_ky'] — nhan-ban.py ghi ngay lúc tạo, luc = 'HH:MM DD/MM/YYYY' giờ VN); etp.nhat_ky chỉ chép sang mỗi 10 phút
    # → đếm ở đó thì nhịp kế có thể nuôi trùng (11/11/2026: 4 camp vừa tạo chưa có trong etp.nhat_ky)
    for l in q(f"""select split_part(split_part(x->>'luat', ' · ', 1), ' ', 3), x->>'content' from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x
            where ten = 'ethopex_nhat_ky' and x->>'viec' = 'nhan_ban' and (x->>'ok')::boolean and x->>'luat' like '{LUAT} %'
              and split_part(x->>'luc', ' ', 2) = to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')""").splitlines():
        b, p = (l.split("|") + [""])[:2]
        if b: da[(b, p)] = da.get((b, p), 0) + 1
    phim = [l.split("|") for l in q(f"""with d as (select (now() at time zone 'utc')::date d0),
        s as (select c.content_id, sum(n.chi) c7, sum(n.thu) t7, sum(n.chi) filter (where n.ngay >= d0 - 3) c3, sum(n.thu) filter (where n.ngay >= d0 - 3) t3
              from etp.so_ngay n join etp.camp c using (camp_id) cross join d where n.ngay between d0 - 7 and d0 - 1 and c.content_id is not null group by 1),
        g as (select distinct on (c.content_id) c.content_id, c.camp_id, (sum(n.thu) - sum(n.chi)) / nullif(sum(n.chi), 0) * 100 r
              from etp.camp c join etp.so_ngay n using (camp_id) cross join d where c.trang_thai = 'ACTIVE' and not c.la_roas and n.ngay between d0 - 7 and d0 - 1
              group by c.content_id, c.camp_id having sum(n.chi) >= {GOC_CHI} order by c.content_id, r desc)
        select s.content_id, g.camp_id, round((s.t7 - s.c7) / s.c7 * 100), round((s.t3 - s.c3) / nullif(s.c3, 0) * 100) from s join g using (content_id)
        where s.c7 >= {PHIM_CHI} and (s.t7 - s.c7) / s.c7 * 100 >= {PHIM_ROI} and (s.t3 - s.c3) / nullif(s.c3, 0) * 100 >= {PHIM_ROI} order by (s.t7 - s.c7) / s.c7 desc""").splitlines() if l.count("|") == 3]
    viec = []
    for b in sorted(nuoi):
        con = nuoi[b] - sum(n for (bb, _), n in da.items() if bb == b)
        vong = 0
        while con > 0 and phim and vong < PHIM_BO:   # chia vòng tròn qua các phim thắng: mỗi vòng mỗi phim một camp
            for p, goc, r7, r3 in phim:
                if con <= 0: break
                if da.get((b, p), 0) + sum(1 for v in viec if v["bo"] == b and v["phim"] == p) > vong: continue
                viec.append({"bo": b, "phim": p, "goc": int(goc), "r7": r7, "r3": r3}); con -= 1
            vong += 1
    xen = []   # dàn đều các bộ trong nhịp: bộ 3, 4, 5, 3, 4, 5…
    while viec and len(xen) < MOI_NHIP:
        for b in sorted({v["bo"] for v in viec}):
            v = next((x for x in viec if x["bo"] == b), None)
            if v and len(xen) < MOI_NHIP: xen.append(v); viec.remove(v)
    return xen, None

def main():
    xem = "--xem" in sys.argv
    # ĐỢT LÊN HỒI CHỢ (anh 18/11/2026, apps/etp/hoi_cho.py — sổ luật hoi_cho): cùng nhịp worker với nuôi bộ (đường lên camp phụ mỗi nhịp), chạy TRƯỚC phần nuôi;
    # ngoài đợt chỉ đọc trạng thái phanh chợ rồi thôi. Kết quả nằm ở khoá hoi_cho (tin Telegram đi qua etp.canh_bao 'hoi_cho:<camp>'), không trộn vào "da" của nuôi bộ.
    try:
        import hoi_cho; hc = hoi_cho.chay(xem)
    except Exception as e: hc = {"loi": f"{type(e).__name__}: {str(e)[:200]}"}
    # HÀNG LỆNH CHỜ PHANH NHẢ (anh 20/11/2026, apps/etp/lenh_cho.py): lệnh anh ra lúc phanh đang bật — nhịp đầu tiên cổng nhả thì làm qua cổng; + camp dò đường
    try:
        import lenh_cho; lc = lenh_cho.chay(xem)
    except Exception as e: lc = {"loi": f"{type(e).__name__}: {str(e)[:200]}"}
    # NHÂN ĐÔI ★ ROAS LÃI QUA ĐÊM (anh 22/11/2026 "Làm luôn", apps/etp/roas_doi.py — sổ luật roas_doi): ngoài khung sáng chỉ trả lý do rồi thôi
    try:
        import roas_doi; rd = roas_doi.chay(xem)
    except Exception as e: rd = {"loi": f"{type(e).__name__}: {str(e)[:200]}"}
    ds, ly = ke_hoach()
    if ly or xem: print(json.dumps({"ok": True, "ke_hoach": ds, "ly": ly, "hoi_cho": hc, "lenh_cho": lc, "roas_doi": rd}, ensure_ascii=False, default=str)); return
    ra = []
    for v in ds:
        luat = f"{LUAT} {v['bo']} · phim #{v['phim']} 7 ngày {v['r7']}% · 3 ngày {v['r3']}% · gốc #{v['goc']}"
        try:
            r = subprocess.run(["python3", NB, str(v["goc"]), "--bo", v["bo"], "--that", "--luat", luat, "--ai", "anh (chat 11/11/2026: nuôi bộ 3 / 4 / 5 bằng phim thắng — Ok thì làm) — máy chạy"],
                               capture_output=True, text=True, timeout=600, cwd=os.path.dirname(NB))
            k = json.loads((r.stdout.strip().splitlines() or ["{}"])[-1])
        except Exception as e: k = {"ok": False, "loi": str(e)[:200]}
        ra.append({**v, "ok": bool(k.get("ok")), "moi": k.get("moi"), "loi": k.get("loi")})
    print(json.dumps({"ok": True, "da": ra, "hoi_cho": hc, "lenh_cho": lc, "roas_doi": rd}, ensure_ascii=False, default=str))

if __name__ == "__main__": main()
