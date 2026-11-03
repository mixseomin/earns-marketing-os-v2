"""PLAN MỞ RỘNG CAMP THEO PHIM — "có cường độ" (anh 04/11/2026). dong-bo.py gọi chay(q) mỗi lượt (10 phút) → etp.mo_rong (0415) → Cây camp etp.on.tc dòng mờ.
Chỉ ĐỌC số + GHI plan ($0, không AI, không tạo camp). Một chỗ khai công thức:
  đích 30 camp/phim (trần "phim thắng ≤ 30") · lượt thêm k = ⌈6 × (1 − n/30)⌉ (phim mới 6 · 15 camp → 3 · ≥ 25 → 1 · 30 → 0)
  ROI 3 ngày đã khép ≥ +20% → k · 0–20% (hoà) → 1 · < 0 → 0 (camp thay thế lo) · chi 3 ngày < $1 → chưa đủ số
  PHIM MỚI (camp đầu < 4 ngày): chỉ cần 1 ngày khép, chi ≥ $0.8, ROI ≥ 20% → đợt đầu 6
  ĐO TỔNG THỂ: camp mới nhất của phim chưa qua trọn 1 ngày khép → cho_do · ROI tụt > 10 điểm so với 3 ngày khép trước → giu
  cần sản xuất = k − creative sạch chưa có camp"""
import json, math

DICH, DAU, HOA, LAI, TUT = 30, 6, 0, 20, 10

def k_cua(n): return 0 if n >= DICH else max(1, math.ceil(DAU * (1 - n / DICH)))

def chay(q):
    rows = json.loads(q("""select coalesce(json_agg(x), '[]') from (
      with a as (select content_id, count(*) n, min(tao) dau, max(tao) moi from etp.camp where trang_thai = 'ACTIVE' and not la_roas and content_id > 0 group by 1),
      s as (select c.content_id, sum(n.chi) filter (where n.ngay between current_date - 3 and current_date - 1) chi3,
                   sum(n.thu) filter (where n.ngay between current_date - 3 and current_date - 1) thu3,
                   sum(n.chi) filter (where n.ngay between current_date - 6 and current_date - 4) chi_t,
                   sum(n.thu) filter (where n.ngay between current_date - 6 and current_date - 4) thu_t
            from etp.so_ngay n join etp.camp c using (camp_id) where n.ngay >= current_date - 6 group by 1),
      san as (select r.content_id, count(*) k from etp.creative r join etp.cham_cong g using (creative_id)
              where g.duoc_len and r.tu_choi is null and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id) group by 1)
      select a.content_id, a.n, extract(epoch from now() - a.dau) / 86400 tuoi, (a.moi at time zone 'UTC')::date >= current_date - 1 moi_chua_khep,
             coalesce(s.chi3, 0) chi3, coalesce(s.thu3, 0) thu3, s.chi_t, s.thu_t, coalesce(san.k, 0) san
      from a left join s using (content_id) left join san using (content_id)) x""") or "[]")
    ghi = []
    for r in rows:
        n, chi, thu, san = int(r["n"]), float(r["chi3"]), float(r["thu3"]), int(r["san"])
        roi = round((thu - chi) / chi * 100) if chi >= 0.3 else None
        roi_t = round((float(r["thu_t"]) - float(r["chi_t"])) / float(r["chi_t"]) * 100) if r.get("chi_t") and float(r["chi_t"]) >= 1 else None
        moi = float(r["tuoi"]) < 4
        if n >= DICH: k, tt, ly = 0, "khong", f"đủ {DICH} camp"
        elif roi is None or (chi < 1 and not (moi and chi >= 0.8)): k, tt, ly = 0, "khong", f"chưa đủ số (chi 3 ngày khép ${chi:.2f})"
        elif roi < HOA: k, tt, ly = 0, "khong", f"lỗ ROI {roi}% — camp thay thế lo"
        elif roi >= LAI: k, tt, ly = (DAU if moi and n <= 2 else k_cua(n)), "them", f"lãi ROI {roi}% → ⌈{DAU}×(1−{n}/{DICH})⌉" + (" · phim mới: đợt đầu" if moi and n <= 2 else "")
        else: k, tt, ly = 1, "them", f"hoà ROI {roi}% → thêm 1, đo lại"
        if tt == "them" and r["moi_chua_khep"]: tt, ly = "cho_do", ly + " · lượt trước chưa đủ 1 ngày khép — chờ đo"
        elif tt == "them" and roi_t is not None and roi < roi_t - TUT: tt, ly = "giu", ly + f" · ROI tụt {roi_t}% → {roi}% sau lượt trước — giữ"
        ghi.append({"content_id": int(r["content_id"]), "n": n, "chi3": round(chi, 2), "lai3": round(thu - chi, 2), "roi3": roi, "roi_truoc": roi_t, "k": k,
                    "san": san, "can_sx": max(0, k - san) if tt == "them" else 0, "trang_thai": tt, "ly": ly})
    j = json.dumps(ghi, ensure_ascii=False).replace("$J$", "")
    q(f"""delete from etp.mo_rong where content_id not in (select (x->>'content_id')::int from jsonb_array_elements($J${j}$J$::jsonb) x);
          insert into etp.mo_rong (content_id, n, chi3, lai3, roi3, roi_truoc, k, san, can_sx, trang_thai, ly, luc)
          select content_id, n, chi3, lai3, roi3, roi_truoc, k, san, can_sx, trang_thai, ly, now() from jsonb_to_recordset($J${j}$J$::jsonb)
            as x(content_id int, n int, chi3 numeric, lai3 numeric, roi3 int, roi_truoc int, k int, san int, can_sx int, trang_thai text, ly text)
          on conflict (content_id) do update set n = excluded.n, chi3 = excluded.chi3, lai3 = excluded.lai3, roi3 = excluded.roi3, roi_truoc = excluded.roi_truoc,
            k = excluded.k, san = excluded.san, can_sx = excluded.can_sx, trang_thai = excluded.trang_thai, ly = excluded.ly, luc = now()""")
    them = [g for g in ghi if g["trang_thai"] == "them"]
    return {"mo_rong_phim": len(them), "mo_rong_camp": sum(g["k"] for g in them), "mo_rong_can_sx": sum(g["can_sx"] for g in them)}
