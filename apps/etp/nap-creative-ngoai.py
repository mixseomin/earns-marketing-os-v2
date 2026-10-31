#!/usr/bin/env python3
"""NẠP CREATIVE CỦA TEAM VÀO KHO NHÀ ĐỂ CHẤM (anh 31/10/2026: "plan lên camp tương đương để ăn cùng" phim Kiên đang lãi → "vào theo thang").
Cổng chấm (Worker etp-cham, /api/ext/etp-cham) chỉ nhận creative có trong etp.creative kèm video; dong-bo.py chỉ nạp creative studio nhà → creative
camp ngoài không bao giờ được chấm, nên nhan-ban.py (chỉ lên creative chấm SẠCH) không lên được. Script này đọc creative ngoài từ Ethopex
(GET /api/v1/creatives/<id>: video_url, content_id) → upsert etp.creative (dang 'team', doan 'cr:<id>'); --cham thì xếp hàng chấm (etp.cham_hang, nguồn 'ngoai').
Chấm là lượt AI trả tiền (Claude hai lượt / creative) — chỉ thêm --cham khi anh đã duyệt lượt đó.
CHẤM CHO MỌI THÀNH VIÊN (anh 31/10/2026: "hãy bổ sung bước chấm điểm Creative cho mọi thành viên"): --tu-dong — dong-bo.py gọi mỗi lượt 10 phút —
  mọi creative camp ĐANG CHẠY của mọi người ngoài Nhà, chưa chấm, camp đã chi ≥ cau_hinh.cham_doi.chi ($) → nạp kho + xếp chấm, tối đa .moi_luot / lượt.
  Chỉ chạy khi etp.cau_hinh.cham_doi.bat = true (chấm là tiền AI — bật khi anh duyệt khoản chi).
Dùng (box3 hoặc iMac): python3 nap-creative-ngoai.py <creative_id …> [--cham]
                       python3 nap-creative-ngoai.py --tu-dong [--kho]   → --kho: chỉ in sẽ nạp gì
                       python3 nap-creative-ngoai.py --nguoi 116 --phim 167292,168168 [--cham]   → mọi creative camp ĐANG CHẠY của người đó trên các phim đó"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ethopex_api as EA

def tham(ten):
    return sys.argv[sys.argv.index(ten) + 1] if ten in sys.argv else None

def main():
    cham = "--cham" in sys.argv
    ng, phim = tham("--nguoi"), tham("--phim")
    ids = [int(x) for x in sys.argv[1:] if x.isdigit() and x not in (ng, phim)]
    if "--tu-dong" in sys.argv:
        ch = {"bat": False, "chi": 3, "moi_luot": 5, **json.loads(EA._q("select gia_tri::text from etp.cau_hinh where khoa = 'cham_doi'") or "{}")}
        if not ch["bat"] and "--kho" not in sys.argv: print(json.dumps({"tat": True, "ghi": "etp.cau_hinh.cham_doi.bat = false"})); return
        ids = [int(x) for x in EA._q(f"""select c.creative_id from etp.camp_ngoai c join etp.tai_khoan t using (ad_account_id) left join etp.so_ngay_ngoai n using (camp_id)
                where not t.nha and c.trang_thai = 'ACTIVE' and c.creative_id > 0
                  and not exists (select 1 from etp.cham h where h.creative_id = c.creative_id) and not exists (select 1 from etp.cham_hang q where q.creative_id = c.creative_id)
                group by 1 having coalesce(sum(n.chi), 0) >= {float(ch['chi'])} order by sum(n.thu) - sum(n.chi) desc limit {int(ch['moi_luot'])}""").split()]
        if "--kho" in sys.argv: print(json.dumps({"se_nap": ids, "cau_hinh": ch})); return
        if not ids: print(json.dumps({"nap": [], "xep_cham": True})); return
        cham = True
    if ng:
        dk = f" and c.content_id in ({','.join(str(int(p)) for p in phim.split(','))})" if phim else ""
        ids += [int(x) for x in EA._q(f"select distinct c.creative_id from etp.camp_ngoai c join etp.tai_khoan t using (ad_account_id) "
                                      f"where t.nguoi_id = {int(ng)} and not t.nha and c.trang_thai = 'ACTIVE' and c.creative_id > 0{dk}").split()]
    ids = sorted(set(ids))
    if not ids: sys.exit("không có creative nào")
    rows, loi = [], []
    for cr in ids:
        try:
            d = EA._goi(f"/api/v1/creatives/{cr}")
            v = json.loads(d.get("video_url") or "[]"); v = v[0] if isinstance(v, list) and v else None
            if not v: loi.append(f"#{cr}: không có video"); continue
            rows.append({"creative_id": cr, "content_id": int(d.get("content_id") or 0) or None, "video": v, "dang": "team", "doan": f"cr:{cr}",
                         "lo": "team"})
        except Exception as e: loi.append(f"#{cr}: {e}")
    if rows:
        j = json.dumps(rows, ensure_ascii=False).replace("$J$", "")
        # creative đã có trong kho (của nhà, hoặc nạp trước) → giữ nguyên dạng / đoạn của nó, chỉ bù video còn trống
        EA._q(f"""insert into etp.creative (creative_id, content_id, video, dang, doan, lo)
                  select creative_id, content_id, video, dang, doan, lo from jsonb_to_recordset($J${j}$J$::jsonb) as x(creative_id int, content_id int, video text, dang text, doan text, lo text)
                  on conflict (creative_id) do update set video = coalesce(etp.creative.video, excluded.video), cap_nhat = now()""")
        if cham:
            EA._q(f"""insert into etp.cham_hang (creative_id, nguon, ai)
                      select x.creative_id, 'ngoai', 'nap-creative-ngoai: ' || {(chr(39) + 'chấm creative mọi thành viên' + chr(39)) if '--tu-dong' in sys.argv else chr(39) + 'creative team để lên camp tương đương' + chr(39)} from jsonb_to_recordset($J${j}$J$::jsonb) as x(creative_id int)
                      where not exists (select 1 from etp.cham c where c.creative_id = x.creative_id)
                      on conflict (creative_id) do nothing""")
    print(json.dumps({"nap": [r["creative_id"] for r in rows], "xep_cham": cham, "loi": loi}, ensure_ascii=False))

if __name__ == "__main__":
    main()
