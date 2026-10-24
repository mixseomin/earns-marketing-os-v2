#!/usr/bin/env python3
"""ĐỒNG BỘ KHO ETP (etp.on.tc — anh 24/10/2026). Chạy trên box3 bằng systemd etp-dong-bo.timer (10 phút/lần, anh cho phép 24/10/2026).
Kéo về schema `etp` (migration 0313):
  · camp: danh sách camp Ethopex (1 lượt gọi) + chi tiết ad (creative / content / ad_id / lịch) CHỈ cho camp mới hoặc updated_at đổi
  · so_ngay: Report camp × ngày — lượt đầu từ 19/10, các lượt sau 3 ngày gần nhất (doanh thu về trễ, ghi đè)
  · so_gio: Report phim × giờ cho hôm nay + hôm qua (mỗi ngày một lượt gọi)
  · phim / creative: studio (xv_phim kinh_thanh.ethopex, ethopex_cta_dat, ethopex_cta_thay, ethopex_tu_choi, ethopex_the_loai, ethopex_phim_tk) + spy (tên, nguồn, url)
  · nhat_ky: chép dòng mới từ studio ethopex_nhat_ky (bản đó chỉ giữ 1000 dòng — kho giữ hết)
Ghi bằng psql + jsonb_to_recordset (không cần thư viện ngoài). Lỗi một phần không chặn phần khác; ghi lượt vào etp.dong_bo.
Dùng: dong-bo.py [--day-du]   (--day-du = kéo lại chi tiết mọi camp + số từ 19/10)"""
import datetime as dt, json, os, re, subprocess, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
DB = os.environ["DATABASE_URL"]
SPY = subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo $DATABASE_URL"], capture_output=True, text=True).stdout.strip()
def q(s, db=DB):
    r = subprocess.run(["psql", db, "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-400:])
    return r.stdout.strip()
khoa = lambda ten, rong="{}": json.loads(q(f"select coalesce(gia_tri, '{rong}'::jsonb)::text from xv_khoa_ngoai where ten='{ten}'") or rong)
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
H = {"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "etp-dong-bo"}
def api(p, b=None):
    for i in range(3):
        try: return json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, data=json.dumps(b).encode() if b is not None else None, method="POST" if b is not None else "GET", headers=H), timeout=120))
        except OSError as e:
            if (isinstance(e, urllib.error.HTTPError) and e.code < 500) or i == 2: raise
            time.sleep(5 * (i + 1))
def bc(cols, gb, tu, den):
    return api("/api/v1/report", {"columns": cols, "group_by": gb, "filters": {}, "metric_conditions": [], "limit": 50000, "page": 1, "page_size": 50000, "date_from": tu, "date_to": den})["rows"]

def ghi(bang, rows, khoa_, cot):
    """upsert rows (list dict) vào etp.<bang>; cot = {tên cột: kiểu}"""
    if not rows: return 0
    j = json.dumps(rows, ensure_ascii=False, default=str)
    dk = ", ".join(f"{c} {t}" for c, t in cot.items()); cs = ", ".join(cot)
    cap = ", ".join(f"{c} = excluded.{c}" for c in cot if c not in khoa_) + ", cap_nhat = now()"
    q(f"insert into etp.{bang} ({cs}) select {cs} from jsonb_to_recordset($J${j}$J$::jsonb) as x({dk}) on conflict ({', '.join(khoa_)}) do update set {cap}")
    return len(rows)

DANG = [("ke chuyen", "kể chuyện"), ("canh that", "cảnh thật"), ("canh cuoi", "cảnh cuối"), ("phim dai", "phim dài"), ("lam moi", "làm mới")]
def main():
    day_du = "--day-du" in sys.argv
    lan = q("insert into etp.dong_bo default values returning lan"); loi = []; kq = {"so_camp": 0, "so_chi_tiet": 0, "so_dong_ngay": 0}
    nay = dt.datetime.now(dt.timezone.utc).date()
    # ── camp
    try:
        ds = api("/api/v1/campaigns?page_size=2000")["data"]; kq["so_camp"] = len(ds)
        bo_tk = {int(v["tk"]): k for k, v in khoa("ethopex_bo_tk").items()}
        cu = {} if day_du else {int(l.split("|")[0]): l.split("|", 1)[1] for l in q("select camp_id || '|' || coalesce(cap_nhat_etp::text, '') from etp.camp").splitlines() if l}
        doi = [c for c in ds if day_du or c["id"] not in cu or str(c.get("updated_at") or "")[:19] != (cu.get(c["id"]) or "")[:19].replace(" ", "T")]
        def ct(c):
            try: d = api(f"/api/v1/campaigns/{c['id']}")
            except Exception as e: return c, None
            return c, d
        rows = []
        with ThreadPoolExecutor(10) as ex:
            for c, d in ex.map(ct, doi):
                a = ((d or {}).get("ad_groups") or [{}])[0].get("ads", [{}])[0] if d else {}
                sp = ((d or {}).get("ad_groups") or [{}])[0].get("source_payload") if d else None
                sp = json.loads(sp) if isinstance(sp, str) and sp.strip().startswith("{") else (sp or {})
                m = re.search(r"\(nhan ban \d+ cua (\d+)\)", c.get("name", ""))
                rows.append({"camp_id": c["id"], "ten": re.sub(r"^\d+:\s*", "", c.get("name", "")), "bo": bo_tk.get(int(c.get("ad_account_id") or 0)), "ad_account_id": c.get("ad_account_id"),
                             "trang_thai": c.get("state"), "giao": a.get("delivery_status"), "dong_bo": c.get("sync_status"), "ngan_sach": c.get("budget_daily"),
                             "creative_id": a.get("creative_id"), "content_id": a.get("content_id"), "ad_id": a.get("id"), "goc": int(m.group(1)) if m else None,
                             "lich": sp.get("start_time"), "loi": (a.get("error") or c.get("error") or None), "tao": c.get("created_at"), "cap_nhat_etp": c.get("updated_at")})
        kq["so_chi_tiet"] = ghi("camp", rows, ["camp_id"], {"camp_id": "int", "ten": "text", "bo": "text", "ad_account_id": "bigint", "trang_thai": "text", "giao": "text", "dong_bo": "text",
            "ngan_sach": "numeric", "creative_id": "int", "content_id": "int", "ad_id": "int", "goc": "int", "lich": "timestamptz", "loi": "text", "tao": "timestamptz", "cap_nhat_etp": "timestamptz"})
    except Exception as e: loi.append(f"camp: {e}")
    # ── số theo ngày (camp × ngày)
    try:
        tu = "2026-10-19" if day_du or q("select count(*) from etp.so_ngay") == "0" else (nay - dt.timedelta(days=3)).isoformat()
        g = {}
        for x in bc(["campaign_name", "date", "cost", "revenue"], ["campaign_name", "date"], tu, nay.isoformat()):
            k = (x["campaign_id"], str(x["report_date"])[:10]); e = g.setdefault(k, [0.0, 0.0]); e[0] += float(x.get("cost") or 0); e[1] += float(x.get("revenue") or 0)
        kq["so_dong_ngay"] = ghi("so_ngay", [{"camp_id": c, "ngay": d, "chi": round(v[0], 4), "thu": round(v[1], 4)} for (c, d), v in g.items()], ["camp_id", "ngay"], {"camp_id": "int", "ngay": "date", "chi": "numeric", "thu": "numeric"})
        # ngân sách + trạng thái của camp cho NGÀY HÔM NAY (giá trị lượt cuối ngày thắng) — lịch sử cho chạy thử luật (bước 3c)
        q(f"insert into etp.so_ngay (camp_id, ngay, ngan_sach, trang_thai) select camp_id, '{nay.isoformat()}', ngan_sach, trang_thai from etp.camp where trang_thai <> 'ARCHIVED' "
          f"on conflict (camp_id, ngay) do update set ngan_sach = excluded.ngan_sach, trang_thai = excluded.trang_thai")
    except Exception as e: loi.append(f"so_ngay: {e}")
    # ── số theo giờ (phim × giờ) hôm qua + hôm nay
    try:
        for d in ([(nay - dt.timedelta(days=i)).isoformat() for i in range((nay - dt.date(2026, 10, 20)).days, -1, -1)] if day_du else [(nay - dt.timedelta(days=1)).isoformat(), nay.isoformat()]):
            ghi("so_gio", [{"content_id": x.get("content_group_id"), "ngay": d, "gio": int(x["hour"]), "chi": float(x.get("cost") or 0), "thu": float(x.get("revenue") or 0)}
                           for x in bc(["content_name", "hour", "cost", "revenue"], ["content_name", "hour"], d, d) if x.get("content_group_id") is not None],
                ["content_id", "ngay", "gio"], {"content_id": "int", "ngay": "date", "gio": "smallint", "chi": "numeric", "thu": "numeric"})
    except Exception as e: loi.append(f"so_gio: {e}")
    # ── phim + creative (studio + spy)
    try:
        tl, ptk = khoa("ethopex_the_loai"), khoa("ethopex_phim_tk")
        ids = sorted({int(x) for x in q("select distinct content_id from etp.camp where content_id is not null").split()} | {int(i) for i in tl if i.isdigit()})
        spy = {}
        for l in q(f"select id, coalesce(locale,''), coalesce(nguon,''), coalesce(url,''), coalesce(ten,'') from ethopex_content where id in ({','.join(map(str, ids)) or '0'})", SPY).splitlines():
            p = l.split("|", 4)
            if len(p) == 5: spy[int(p[0])] = p
        ghi("phim", [{"content_id": i, "ten": (spy.get(i) or [None] * 5)[4] or (tl.get(str(i)) or {}).get("ten"), "locale": (spy.get(i) or [None, None])[1], "nguon": (spy.get(i) or [None] * 3)[2],
                      "url": (spy.get(i) or [None] * 4)[3], "the_loai": (tl.get(str(i)) or {}).get("tl"), "the_loai_nguon": (tl.get(str(i)) or {}).get("nguon"), "bo": ptk.get(str(i))} for i in ids],
            ["content_id"], {"content_id": "int", "ten": "text", "locale": "text", "nguon": "text", "url": "text", "the_loai": "text", "the_loai_nguon": "text", "bo": "text"})
        dat, thay, tc = khoa("ethopex_cta_dat"), khoa("ethopex_cta_thay"), khoa("ethopex_tu_choi")
        thay_nguoc = {int(v): int(k) for k, v in thay.items()}
        rows = []
        for l in q("""select (p.kinh_thanh->'ethopex'->>'creative_id'), coalesce(p.kinh_thanh->'ethopex'->>'content_id',''), coalesce(p.kinh_thanh->'ethopex'->>'tu',''), coalesce(p.kinh_thanh->'ethopex'->>'den',''),
                coalesce(p.kinh_thanh->'ethopex'->>'lo',''), coalesce(p.kinh_thanh->>'ngon_ngu',''), coalesce(p.kinh_thanh->>'the_loai',''),
                coalesce((select x->>'url' from xv_tap t, jsonb_array_elements(coalesce(t.xuat,'[]'::jsonb)) x where t.phim_id = p.id and coalesce(x->>'url','') <> '' order by x->>'luc' desc limit 1), ''),
                coalesce((select c.keyframe_url from xv_tap t join xv_canh c on c.tap_id = t.id where t.phim_id = p.id and coalesce(c.keyframe_url, '') <> '' order by t.so, c.thu_tu limit 1), p.poster_url, '')
              from xv_phim p where p.project = 'ethopex' and p.kinh_thanh->'ethopex' ? 'creative_id'""").splitlines():
            f = l.split("|")
            if len(f) < 9 or not f[0].isdigit(): continue
            cr = int(f[0]); tu_, den_ = (float(f[2]) if f[2] else None), (float(f[3]) if f[3] else None)
            rows.append({"creative_id": cr, "content_id": int(f[1]) if f[1].isdigit() else None, "tu": tu_, "den": den_, "lo": f[4] or None, "lang": f[5] or None,
                         "dang": {"qc_canh_that": "cảnh thật", "qc_ke_chuyen": "kể chuyện"}.get(f[6], f[6] or None), "video": f[7] or None, "anh": f[8] or None,
                         "cta_dat": str(cr) in dat, "thay_cho": thay_nguoc.get(cr), "tu_choi": (tc.get(str(cr)) or {}).get("ly_do")})
        # dạng theo tên camp đang dùng creative (chính xác hơn loại studio) + khoá đoạn: bản CTA cũ mang đoạn của bản sửa
        dang_camp = {int(a): b for a, b in (l.split("|", 1) for l in q("select creative_id, string_agg(distinct ten, ' ') from etp.camp where creative_id is not null group by 1").splitlines() if l)}
        theo = {r["creative_id"]: r for r in rows}
        for r in rows:
            t = (dang_camp.get(r["creative_id"]) or "").lower(); r["dang"] = next((v for k, v in DANG if k in t), r["dang"])
            r["doan"] = f"{r['content_id']}:{round(r['tu'])}-{round(r['den'])}" if r["tu"] is not None and r["den"] is not None else f"cr:{r['creative_id']}"
        for cu_, moi_ in thay.items():
            if int(cu_) in theo and int(moi_) in theo: theo[int(cu_)]["doan"] = theo[int(moi_)]["doan"]
        ghi("creative", rows, ["creative_id"], {"creative_id": "int", "content_id": "int", "dang": "text", "tu": "numeric", "den": "numeric", "doan": "text", "lang": "text", "lo": "text",
            "video": "text", "anh": "text", "cta_dat": "boolean", "thay_cho": "int", "tu_choi": "text"})
    except Exception as e: loi.append(f"phim/creative: {e}")
    # ── nhật ký luật
    try:
        nk = khoa("ethopex_nhat_ky", "[]"); rows = []
        for x in nk:
            try: luc = dt.datetime.strptime(x["luc"], "%H:%M %d/%m/%Y").replace(tzinfo=dt.timezone(dt.timedelta(hours=7))).isoformat()
            except Exception: continue
            rows.append({"luc": luc, "viec": x.get("viec") or "?", "camp_id": x.get("id"), "goc": x.get("goc"), "truoc": None if x.get("truoc") is None else str(x.get("truoc")),
                         "sau": None if x.get("sau") is None else str(x.get("sau")), "ok": x.get("ok"), "loi": x.get("loi"), "luat": x.get("luat"), "ai": x.get("ai")})
        if rows:
            j = json.dumps(rows, ensure_ascii=False)
            q(f"""insert into etp.nhat_ky (luc, viec, camp_id, goc, truoc, sau, ok, loi, luat, ai)
                  select luc, viec, camp_id, goc, truoc, sau, ok, loi, luat, ai from jsonb_to_recordset($J${j}$J$::jsonb)
                  as x(luc timestamptz, viec text, camp_id int, goc int, truoc text, sau text, ok boolean, loi text, luat text, ai text) on conflict do nothing""")
    except Exception as e: loi.append(f"nhat_ky: {e}")
    l_ = "; ".join(loi)[:1000].replace("$L$", "")
    q(f"update etp.dong_bo set xong = now(), so_camp = {kq['so_camp']}, so_chi_tiet = {kq['so_chi_tiet']}, so_dong_ngay = {kq['so_dong_ngay']}, loi = {('$L$' + l_ + '$L$') if loi else 'null'} where lan = {lan}")
    print(json.dumps({**kq, "loi": loi}, ensure_ascii=False))
    r = subprocess.run(["python3", os.path.join(os.path.dirname(os.path.abspath(__file__)), "canh-bao.py")], capture_output=True, text=True, timeout=120)   # bước 3: cảnh báo bất thường
    print((r.stdout or r.stderr).strip()[-300:])

if __name__ == "__main__": main()
