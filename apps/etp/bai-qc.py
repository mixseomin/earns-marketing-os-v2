#!/usr/bin/env python3
"""BÀI QUẢNG CÁO NHƯ NGƯỜI DÙNG THẤY (anh 20/11/2026: "creative đang ko show Primary Text và các thứ xung quanh — cần show giống như cách người dùng sẽ nhìn thấy").
Kho chưa giữ chữ của bài QC → thẻ creative trên etp2 chỉ có hình. Script này CHỈ ĐỌC Ethopex (GET), ghi hai bảng:
  etp.bai_cr   (creative_id) ← GET /api/v1/creatives/<cr>: asset_spec.primaryTexts / headlines / descriptions, call_to_action, link_url, creative_type
  etp.bai_camp (camp_id)     ← GET /api/v1/campaigns/<id>: ads[0].facebook_page_id + domain + final_url (Page hiện ở đầu bài, tên miền ở dải dưới)
Chỉ lấy dòng CHƯA có (creative / camp không đổi chữ sau khi lên); lỗi ghi loi + lan_loi, thử lại tối đa 3 lần.
Thứ tự: camp nhà đang chạy trước, rồi creative mới nhất. Trang etp2 đọc qua etp-doc.ts (bai).
Dùng (box3): python3 bai-qc.py [--so 80]   — dong-bo.py gọi mỗi lượt 10 phút; chạy tay --so 6000 để vét tồn."""
import concurrent.futures as cf, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ethopex_api as EA
SO = int(sys.argv[sys.argv.index("--so") + 1]) if "--so" in sys.argv else 80
J = lambda v: "$B$" + json.dumps(v, ensure_ascii=False).replace("$B$", "") + "$B$"
T = lambda v: ("$B$" + str(v).replace("$B$", "") + "$B$") if v not in (None, "") else "null"

EA._q("""create table if not exists etp.bai_cr (creative_id int primary key, kieu text, cta text, link text, chinh jsonb, tieu_de jsonb, mo_ta jsonb,
           loi text, lan_loi int not null default 0, luc timestamptz not null default now());
         create table if not exists etp.bai_camp (camp_id int primary key, page_id bigint, ten_mien text, final_url text,
           loi text, lan_loi int not null default 0, luc timestamptz not null default now())""")

def ds_l(v):   # Ethopex trả list hoặc chuỗi JSON của list
    if isinstance(v, str):
        try: v = json.loads(v)
        except Exception: return [v] if v.strip() else []
    return [str(x).strip() for x in (v or []) if str(x or "").strip()] if isinstance(v, list) else []

def cr_thieu():
    return [int(l) for l in EA._q(f"""with ids as (select creative_id, max(case when trang_thai = 'ACTIVE' then 1 else 0 end) chay from etp.camp where creative_id > 0 group by 1
              union all select creative_id, 0 from etp.camp_ngoai where creative_id > 0)
        select i.creative_id from (select creative_id, max(chay) chay from ids group by 1) i left join etp.bai_cr b using (creative_id)
        where (b.creative_id is null or (b.chinh is null and b.lan_loi < 3)) order by i.chay desc, i.creative_id desc limit {SO}""").split()]

def camp_thieu():
    return [int(l) for l in EA._q(f"""select c.camp_id from etp.camp c left join etp.bai_camp b using (camp_id)
        where b.camp_id is null or (b.page_id is null and b.lan_loi < 3) order by (c.trang_thai = 'ACTIVE') desc, c.camp_id desc limit {SO}""").split()]

def mot_cr(cr):
    try:
        d = EA._goi(f"/api/v1/creatives/{cr}", None, 60) or {}
        a = d.get("asset_spec") or {}
        a = json.loads(a) if isinstance(a, str) and a.strip().startswith("{") else (a if isinstance(a, dict) else {})
        EA._q(f"""insert into etp.bai_cr (creative_id, kieu, cta, link, chinh, tieu_de, mo_ta) values ({cr}, {T(d.get('creative_type'))}, {T(d.get('call_to_action'))}, {T(d.get('link_url'))},
            {J(ds_l(a.get('primaryTexts')))}::jsonb, {J(ds_l(a.get('headlines')))}::jsonb, {J(ds_l(a.get('descriptions')))}::jsonb)
            on conflict (creative_id) do update set kieu = excluded.kieu, cta = excluded.cta, link = excluded.link, chinh = excluded.chinh, tieu_de = excluded.tieu_de,
            mo_ta = excluded.mo_ta, loi = null, luc = now()""")
        return "ok"
    except Exception as e:
        EA._q(f"insert into etp.bai_cr (creative_id, loi, lan_loi) values ({cr}, {T(str(e)[:300])}, 1) on conflict (creative_id) do update set loi = excluded.loi, lan_loi = etp.bai_cr.lan_loi + 1, luc = now()")
        return "loi"

def mot_camp(cid):
    try:
        d = EA._goi(f"/api/v1/campaigns/{cid}", None, 60) or {}
        a = ((d.get("ad_groups") or [{}])[0].get("ads") or [{}])[0]
        p = a.get("facebook_page_id")
        EA._q(f"""insert into etp.bai_camp (camp_id, page_id, ten_mien, final_url) values ({cid}, {int(p) if str(p or '').isdigit() else 'null'}, {T(a.get('domain'))}, {T(a.get('final_url'))})
            on conflict (camp_id) do update set page_id = excluded.page_id, ten_mien = excluded.ten_mien, final_url = excluded.final_url, loi = null, luc = now()""")
        return "ok"
    except Exception as e:
        EA._q(f"insert into etp.bai_camp (camp_id, loi, lan_loi) values ({cid}, {T(str(e)[:300])}, 1) on conflict (camp_id) do update set loi = excluded.loi, lan_loi = etp.bai_camp.lan_loi + 1, luc = now()")
        return "loi"

if __name__ == "__main__":
    a, b = cr_thieu(), camp_thieu()
    with cf.ThreadPoolExecutor(6) as ex: k1 = list(ex.map(mot_cr, a)); k2 = list(ex.map(mot_camp, b))
    print(json.dumps({"thieu": len(a) + len(b), "cr": len(a), "camp": len(b), "loi": k1.count("loi") + k2.count("loi")}))
