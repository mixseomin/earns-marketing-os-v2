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
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ethopex_api as EA   # cổng chung: tài khoản nhà / ngoài (anh 28/10/2026)
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

def _roas(sp):
    """ROAS goal đang đặt ở Ad Set (bid_constraints.roas_average_floor; Meta có lúc trả ×10000) — None khi camp không bid ROAS"""
    v = (sp.get("bid_constraints") or {}).get("roas_average_floor")
    try: v = float(v)
    except (TypeError, ValueError): return None
    return round(v / 10000 if v > 100 else v, 4)

def ghi(bang, rows, khoa_, cot):
    """upsert rows (list dict) vào etp.<bang>; cot = {tên cột: kiểu}"""
    if not rows: return 0
    j = json.dumps(rows, ensure_ascii=False, default=str)
    dk = ", ".join(f"{c} {t}" for c, t in cot.items()); cs = ", ".join(cot)
    cap = ", ".join(f"{c} = excluded.{c}" for c in cot if c not in khoa_) + ", cap_nhat = now()"
    q(f"insert into etp.{bang} ({cs}) select {cs} from jsonb_to_recordset($J${j}$J$::jsonb) as x({dk}) on conflict ({', '.join(khoa_)}) do update set {cap}")
    return len(rows)

DANG = [("tap nguyen", "tập nguyên"), ("ke chuyen", "kể chuyện"), ("canh that", "cảnh thật"), ("canh cuoi", "cảnh cuối"), ("phim dai", "phim dài"), ("lam moi", "làm mới")]
def main():
    day_du = "--day-du" in sys.argv
    lan = q("insert into etp.dong_bo default values returning lan"); loi = []; kq = {"so_camp": 0, "so_chi_tiet": 0, "so_dong_ngay": 0}
    nay = dt.datetime.now(dt.timezone.utc).date()
    # ── LỊCH GIỜ (anh 25/10/2026): bật / tắt camp theo thể loại × khung giờ VN — chạy ĐẦU lượt cho đúng giờ (lượt đồng bộ dài vài phút); lỗi không chặn đồng bộ
    try:
        r = subprocess.run(["python3", os.path.join(os.path.dirname(os.path.abspath(__file__)), "lich-gio.py")], capture_output=True, text=True, timeout=300)
        print((r.stdout or "").strip()[-300:]); r.stderr.strip() and loi.append(f"lich_gio: {r.stderr.strip()[-200:]}")
    except Exception as e: loi.append(f"lich_gio: {e}")
    # ── camp
    try:
        # TÀI KHOẢN NHÀ / NGOÀI (anh 28/10/2026): danh sách đủ mọi trang (tối đa 1.000/trang); camp tài khoản nhà vào kho luật như cũ, camp tài khoản
        # khác htuan82 được xem → etp.camp_ngoai (chỉ để theo dõi / học, không luật nào đọc)
        tat_ca = EA.ds_tat_ca(); ds = [c for c in tat_ca if EA.la_nha(c)]; ngoai = [c for c in tat_ca if not EA.la_nha(c)]; kq["so_camp"] = len(ds)
        ghi("camp_ngoai", [{"camp_id": c["id"], "ten": re.sub(r"^\d+:\s*", "", c.get("name", "")), "ad_account_id": c.get("ad_account_id"), "trang_thai": c.get("state"),
                            "ngan_sach": c.get("budget_daily"), "tao": c.get("created_at"), "cap_nhat_etp": c.get("updated_at")} for c in ngoai], ["camp_id"],
            {"camp_id": "int", "ten": "text", "ad_account_id": "bigint", "trang_thai": "text", "ngan_sach": "numeric", "tao": "timestamptz", "cap_nhat_etp": "timestamptz"})
        # PHIM / CREATIVE CỦA CAMP NGOÀI lấy từ AD của camp (chi tiết camp), không từ report: report trả nhóm nội dung riêng của team ("Unknown Content" #143938)
        # trong khi ad trỏ đúng phim (#67443 → 94344 Number One Nobody) — anh 28/10/2026. Chỉ camp mới / đổi / chưa có phim
        cu_n = {int(l.split("|")[0]): l.split("|", 1)[1] for l in q("select camp_id || '|' || coalesce(cap_nhat_etp::text, '') from etp.camp_ngoai where content_id is not null and creative_id is not null").splitlines() if l}
        doi_n = [c for c in ngoai if c["id"] not in cu_n or str(c.get("updated_at") or "")[:19] != (cu_n.get(c["id"]) or "")[:19].replace(" ", "T")]
        def ct_n(c):
            try: a = (EA.api(f"/api/v1/campaigns/{c['id']}").get("ad_groups") or [{}])[0].get("ads", [{}])[0]
            except Exception: return None
            return {"id": c["id"], "ct": a.get("content_id"), "cr": a.get("creative_id")}
        with ThreadPoolExecutor(10) as ex: ad_n = [x for x in ex.map(ct_n, doi_n) if x and (x["ct"] or x["cr"])]
        if ad_n:
            _an = json.dumps(ad_n)
            q(f"update etp.camp_ngoai n set content_id = coalesce(x.ct, n.content_id), creative_id = coalesce(x.cr, n.creative_id) from jsonb_to_recordset($J${_an}$J$::jsonb) as x(id int, ct int, cr int) where n.camp_id = x.id")
        kq["chi_tiet_ngoai"] = len(ad_n)
        # tài khoản → người dùng (report theo người trên etp.on.tc, anh 28/10/2026)
        try:
            ghi("tai_khoan", [{"ad_account_id": int(x["id"]), "nguoi_id": x.get("used_by_user_id"), "nguoi": x.get("used_by_user_name") or x.get("user_name") or None, "nha": int(x["id"]) in EA.TK}
                              for x in (EA._goi("/api/v1/ad-accounts?page_size=500").get("data") or [])], ["ad_account_id"],
                {"ad_account_id": "bigint", "nguoi_id": "int", "nguoi": "text", "nha": "boolean"})
        except Exception as e: loi.append(f"tai_khoan: {e}")
        # TRẠNG THÁI + NGÂN SÁCH của MỌI camp từ danh sách mỗi lượt (26/10/2026: lệnh bật / tắt / đổi ngân sách qua API control KHÔNG đổi updated_at → camp không
        # vào nhánh "đổi" bên dưới, kho giữ ACTIVE cũ cho camp đã tắt; lượt lịch giờ 12h sẽ ghi camp vừa tắt theo T7 vào sổ lịch rồi 20h bật lại)
        _tt = json.dumps([{"id": c["id"], "tt": c.get("state"), "ns": c.get("budget_daily")} for c in ds])
        q(f"""update etp.camp c set trang_thai = x.tt, ngan_sach = coalesce(x.ns, c.ngan_sach), cap_nhat = now() from jsonb_to_recordset($J${_tt}$J$::jsonb) as x(id int, tt text, ns numeric)
            where c.camp_id = x.id and (c.trang_thai is distinct from x.tt or (x.ns is not null and c.ngan_sach is distinct from x.ns))""")
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
                m = re.search(r"\(nhan ban \d+ cua (\d+)\)", c.get("name", "")) or re.search(r" duplicate by (\d+)\s*$", c.get("name", ""))   # camp ROAS ★ … duplicate by <gốc>
                rows.append({"camp_id": c["id"], "ten": re.sub(r"^\d+:\s*", "", c.get("name", "")), "bo": bo_tk.get(int(c.get("ad_account_id") or 0)), "ad_account_id": c.get("ad_account_id"),
                             "trang_thai": c.get("state"), "giao": a.get("delivery_status"), "dong_bo": c.get("sync_status"), "ngan_sach": c.get("budget_daily"),
                             "creative_id": a.get("creative_id"), "content_id": a.get("content_id"), "ad_id": a.get("id"), "goc": int(m.group(1)) if m else None,
                             "lich": sp.get("start_time"), "loi": (a.get("error") or c.get("error") or None), "tao": c.get("created_at"), "cap_nhat_etp": c.get("updated_at"),
                             "roas": _roas(sp), "chien_luoc": (d or {}).get("campaign", {}).get("source_bidding_strategy") or c.get("source_bidding_strategy")})
        kq["so_chi_tiet"] = ghi("camp", rows, ["camp_id"], {"camp_id": "int", "ten": "text", "bo": "text", "ad_account_id": "bigint", "trang_thai": "text", "giao": "text", "dong_bo": "text",
            "ngan_sach": "numeric", "creative_id": "int", "content_id": "int", "ad_id": "int", "goc": "int", "lich": "timestamptz", "loi": "text", "tao": "timestamptz", "cap_nhat_etp": "timestamptz", "roas": "numeric", "chien_luoc": "text"})
        # camp ROAS chạy BÀI ĐĂNG CŨ: ad không mang content/creative → nhận phim của camp gốc (cây camp + số theo phim trên etp.on.tc)
        q("""update etp.camp c set content_id = g.content_id from etp.camp g where c.goc = g.camp_id and coalesce(c.content_id, 0) = 0 and coalesce(g.content_id, 0) <> 0""")
    except Exception as e: loi.append(f"camp: {e}")
    # ── PHỐT META (anh 25/10/2026): ad bị Meta từ chối = một phốt gắn bộ tài khoản · tài khoản QC · Page → etp.phot + báo đỏ (Telegram qua etp.canh_bao)
    try:
        moi = q("""with bt as (select k bo, (v->>'page')::bigint page_id, v->>'ten' ten from xv_khoa_ngoai, jsonb_each(gia_tri) e(k, v) where ten = 'ethopex_bo_tk'),
            m as (insert into etp.phot (camp_id, ad_id, creative_id, content_id, bo, ad_account_id, page_id, nhom, ly_do)
              select c.camp_id, c.ad_id, c.creative_id, c.content_id, c.bo, c.ad_account_id, bt.page_id,
                case when c.loi ~* 'Sexual Exploitation|sexual violence' then 'cuong_ep' when c.loi ~* 'Solicitation|Sexually Explicit Language' then 'ga_gam' when c.loi ~* 'Nudity|Sexual' then 'khoa_than'
                     when c.loi ~* 'Violent|Graphic' then 'mau' when c.loi ~* 'Weapon|Dangerous' then 'vu_khi' else 'khac' end, c.loi
              from etp.camp c left join bt on bt.bo = c.bo
              where (c.giao = 'DISAPPROVED' or c.loi ilike '%DISAPPROVED%') and c.creative_id is not null
              on conflict (camp_id, creative_id) do nothing returning camp_id, creative_id, bo, page_id, nhom)
            insert into etp.canh_bao (loai, khoa, muc, noi_dung)
              select 'phot', 'phot:' || m.camp_id || ':' || m.creative_id, 'do', 'Phốt Meta: bộ ' || coalesce(m.bo, '?') || coalesce(' (' || bt.ten || ')', '') || ' · Page ' || coalesce(m.page_id::text, '?') || ' · camp #' || m.camp_id
                || ' · creative #' || m.creative_id || ' · ' || case m.nhom when 'cuong_ep' then 'cưỡng ép / bạo lực tình dục' when 'khoa_than' then 'khoả thân / gợi dục' when 'ga_gam' then 'gạ gẫm / lời tình dục'
                when 'mau' then 'bạo lực / máu' when 'vu_khi' then 'vũ khí' else 'vi phạm khác' end
                || ' · bộ này đã ' || (select count(*) from etp.phot p where p.bo is not distinct from m.bo and p.luc > now() - interval '7 days') || ' phốt trong 7 ngày'
              from m left join bt on bt.bo = m.bo on conflict (khoa) do nothing returning 1""")
        kq["phot_moi"] = len([x for x in moi.splitlines() if x])
    except Exception as e: loi.append(f"phot: {e}")
    # ── số theo ngày (camp × ngày)
    try:
        tu = "2026-10-19" if day_du or q("select count(*) from etp.so_ngay") == "0" else (nay - dt.timedelta(days=3)).isoformat()
        g, gn = {}, {}
        phim_ngoai = {}   # camp ngoài → (content_id, tên phim) cho cây phim theo người
        for x in bc(["campaign_name", "content_name", "date", "cost", "revenue"], ["campaign_name", "content_name", "date"], tu, nay.isoformat()):
            nha = str(x.get("external_account_id") or "") in EA.EXT
            if not nha and x.get("content_group_name") and x.get("content_group_name") != "Unknown Content": phim_ngoai[x["campaign_id"]] = x["content_group_name"]   # chỉ tên phim dự phòng (phim không có trong etp.phim)
            k = (x["campaign_id"], str(x["report_date"])[:10]); e = (g if nha else gn).setdefault(k, [0.0, 0.0])
            e[0] += float(x.get("cost") or 0); e[1] += float(x.get("revenue") or 0)
        kq["so_dong_ngay"] = ghi("so_ngay", [{"camp_id": c, "ngay": d, "chi": round(v[0], 4), "thu": round(v[1], 4)} for (c, d), v in g.items()], ["camp_id", "ngay"], {"camp_id": "int", "ngay": "date", "chi": "numeric", "thu": "numeric"})
        ghi("so_ngay_ngoai", [{"camp_id": c, "ngay": d, "chi": round(v[0], 4), "thu": round(v[1], 4)} for (c, d), v in gn.items()], ["camp_id", "ngay"], {"camp_id": "int", "ngay": "date", "chi": "numeric", "thu": "numeric"})
        if phim_ngoai:
            _pn = json.dumps([{"id": c, "ten": p} for c, p in phim_ngoai.items()], ensure_ascii=False).replace("$J$", "")
            q(f"update etp.camp_ngoai n set phim_ten = x.ten from jsonb_to_recordset($J${_pn}$J$::jsonb) as x(id int, ten text) where n.camp_id = x.id")
        # ngân sách + trạng thái của camp cho NGÀY HÔM NAY (giá trị lượt cuối ngày thắng) — lịch sử cho chạy thử luật (bước 3c)
        # + ns_max / bat: ngân sách CAO NHẤT trong ngày lúc camp bật, camp có lúc nào bật (migration 0340 — cột ngân sách theo ngày trên etp.on.tc)
        q(f"insert into etp.so_ngay (camp_id, ngay, ngan_sach, trang_thai, ns_max, bat) select camp_id, '{nay.isoformat()}', ngan_sach, trang_thai, "
          f"case when trang_thai = 'ACTIVE' then ngan_sach end, coalesce(trang_thai, '') = 'ACTIVE' from etp.camp where trang_thai <> 'ARCHIVED' "
          f"on conflict (camp_id, ngay) do update set ngan_sach = excluded.ngan_sach, trang_thai = excluded.trang_thai, "
          f"ns_max = greatest(so_ngay.ns_max, excluded.ns_max), bat = so_ngay.bat or excluded.bat")
    except Exception as e: loi.append(f"so_ngay: {e}")
    # ── PHỄU camp × ngày (đo điểm chạm creative, anh 28/10/2026) — bảng riêng etp.so_pheu, không đụng chi/thu ở trên; 3 ngày gần nhất ghi đè (số về trễ)
    try:
        tu_p = "2026-10-19" if day_du or q("select count(*) from etp.so_pheu") == "0" else (nay - dt.timedelta(days=3)).isoformat()
        cot_p = ["impressions", "clicks", "conversions", "supply_impressions", "supply_clicks", "supply_conversions", "supply_conversion_value"]
        gp = {}
        for x in bc(["campaign_name", "date"] + cot_p, ["campaign_name", "date"], tu_p, nay.isoformat()):
            if not x.get("campaign_id"): continue
            e = gp.setdefault((x["campaign_id"], str(x["report_date"])[:10]), [0.0] * len(cot_p))
            for i, c in enumerate(cot_p): e[i] += float(x.get(c) or 0)
        kq["so_dong_pheu"] = ghi("so_pheu", [{"camp_id": c, "ngay": d, "hien": int(v[0]), "nhap": int(v[1]), "chuyen": int(v[2]), "s_hien": int(v[3]), "s_nhap": int(v[4]), "s_chuyen": int(v[5]), "s_gt": round(v[6], 4)}
            for (c, d), v in gp.items()], ["camp_id", "ngay"], {"camp_id": "int", "ngay": "date", "hien": "int", "nhap": "int", "chuyen": "int", "s_hien": "int", "s_nhap": "int", "s_chuyen": "int", "s_gt": "numeric"})
    except Exception as e: loi.append(f"so_pheu: {e}")
    # ── số theo giờ (phim × giờ) hôm qua + hôm nay
    try:
        for d in ([(nay - dt.timedelta(days=i)).isoformat() for i in range((nay - dt.date(2026, 10, 20)).days, -1, -1)] if day_du else [(nay - dt.timedelta(days=1)).isoformat(), nay.isoformat()]):
            # tách nhà / ngoài theo tài khoản: report phim × giờ không mang tài khoản → nhóm thêm theo camp (dòng có external_account_id) rồi cộng lại theo phim × giờ
            gg = {True: {}, False: {}}
            for x in bc(["content_name", "hour", "campaign_name", "cost", "revenue"], ["content_name", "hour", "campaign_name"], d, d):
                if x.get("content_group_id") is None: continue
                e = gg[str(x.get("external_account_id") or "") in EA.EXT].setdefault((x["content_group_id"], int(x["hour"])), [0.0, 0.0]); e[0] += float(x.get("cost") or 0); e[1] += float(x.get("revenue") or 0)
            q(f"update etp.so_gio set chi = 0, thu = 0, cap_nhat = now() where ngay = '{d}'")   # số cũ của ngày này có thể lẫn tài khoản ngoài → tính lại từ đầu
            for nha, bang in ((True, "so_gio"), (False, "so_gio_ngoai")):
                ghi(bang, [{"content_id": c, "ngay": d, "gio": h, "chi": round(v[0], 4), "thu": round(v[1], 4)} for (c, h), v in gg[nha].items()],
                    ["content_id", "ngay", "gio"], {"content_id": "int", "ngay": "date", "gio": "smallint", "chi": "numeric", "thu": "numeric"})
    except Exception as e: loi.append(f"so_gio: {e}")
    # ── LUẬT TỪ CẤM / CTA cho Worker chấm creative (anh 25/10/2026: một nguồn — danh sách gốc ở kiem-thoai.py / cta_qc.py) → xv_khoa_ngoai['ethopex_mau_cam']
    try:
        import importlib.util as _iu
        _s = _iu.spec_from_file_location("kiem_thoai", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "kiem-thoai.py"))
        _kt = _iu.module_from_spec(_s); _s.loader.exec_module(_kt)
        q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_mau_cam', $J$" + json.dumps(_kt.mau_js(), ensure_ascii=False).replace("$J$", "") + "$J$::jsonb) "
          "on conflict (ten) do update set gia_tri = excluded.gia_tri, cap_nhat = now() where xv_khoa_ngoai.gia_tri is distinct from excluded.gia_tri")
    except Exception as e: loi.append(f"mau_cam: {e}")
    # ── phim + creative (studio + spy)
    try:
        tl, ptk = khoa("ethopex_the_loai"), khoa("ethopex_phim_tk")
        ids = sorted({int(x) for x in q("select distinct content_id from etp.camp where content_id is not null union select distinct content_id from etp.camp_ngoai where content_id > 0").split()} | {int(i) for i in tl if i.isdigit()})   # + phim camp ngoài (tên phim cho report theo người, 28/10/2026)
        spy = {}
        for l in q(f"select id, coalesce(locale,''), coalesce(nguon,''), coalesce(url,''), coalesce(ten,'') from ethopex_content where id in ({','.join(map(str, ids)) or '0'})", SPY).splitlines():
            p = l.split("|", 4)
            if len(p) == 5: spy[int(p[0])] = p
        # PHIM MỚI CHƯA CÓ THỂ LOẠI (anh 25/10/2026: "nhiều film không thuộc thể loại nào là vì sao?" — sổ chỉ cập nhật ở báo cáo thể loại sáng thứ Hai,
        # phim lên giữa tuần trống thể loại → lịch giờ xếp vào "chưa gắn"): đoán theo từ khoá trong tên (the-loai.py › doan, nguồn "tu"), ghi luôn vào sổ studio;
        # Claude / anh sửa bằng the-loai.py --gan <id>=<tl> (nguồn "claude", không bị ghi đè)
        thieu = {i: (spy.get(i) or [None] * 5)[4] for i in ids if str(i) not in tl and (spy.get(i) or [None] * 5)[4]}
        if thieu:
            import importlib.util as _iu
            _s = _iu.spec_from_file_location("the_loai", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "the-loai.py")); _m = _iu.module_from_spec(_s); _s.loader.exec_module(_m)
            moi = {str(i): {"tl": _m.doan(t), "nguon": "tu", "ten": t} for i, t in thieu.items()}
            q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_the_loai', '{}'::jsonb) on conflict (ten) do nothing")
            q(f"update xv_khoa_ngoai set gia_tri = $J${json.dumps(moi, ensure_ascii=False)}$J$::jsonb || gia_tri where ten = 'ethopex_the_loai'")   # bản có sẵn thắng
            tl = {**moi, **tl}
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
    # ── tài nguyên: tài khoản QC · Page · pixel · tên miền (tab Tài nguyên)
    try:
        rows = []
        for loai, duong in (("tk_qc", "/api/v1/ad-accounts?page_size=200"), ("page", "/api/v1/facebook-pages?page_size=200"), ("pixel", "/api/v1/my-asset-groups/pixels"), ("ten_mien", "/api/v1/my-asset-groups/domains")):
            d = api(duong); ds = d.get("data", d) if isinstance(d, dict) else d
            for x in ds or []:
                rows.append({"loai": loai, "id": x.get("id"), "external_id": str(x.get("external_id") or ""), "ten": x.get("display_name") or x.get("name"), "trang_thai": x.get("status"),
                             "them": {k: x.get(k) for k in ("account_controls_status", "ads_restricted", "picture_url", "link", "available", "facebook_bm_id", "is_published", "used_by_asset_group", "cache_status") if x.get(k) is not None}})
        ghi("tai_nguyen", rows, ["loai", "id"], {"loai": "text", "id": "bigint", "external_id": "text", "ten": "text", "trang_thai": "text", "them": "jsonb"})
    except Exception as e: loi.append(f"tai_nguyen: {e}")
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
                  as x(luc timestamptz, viec text, camp_id int, goc int, truoc text, sau text, ok boolean, loi text, luat text, ai text)
                  where not exists (select 1 from etp.nhat_ky n where n.luc = x.luc and n.viec = x.viec and n.camp_id is not distinct from x.camp_id
                                    and n.sau is not distinct from x.sau and n.loi is not distinct from x.loi)
                  on conflict do nothing""")   # KHÔNG CHÉP LẠI (anh 27/10/2026 "⚠302 nghĩa là gì"): khoá (luc, viec, camp_id, sau) coi NULL là khác nhau → dòng lỗi (sau NULL) bị chép lại mỗi lượt 10 phút, 1 lần thử thành 130 dòng
    except Exception as e: loi.append(f"nhat_ky: {e}")
    l_ = "; ".join(loi)[:1000].replace("$L$", "")
    q(f"update etp.dong_bo set xong = now(), so_camp = {kq['so_camp']}, so_chi_tiet = {kq['so_chi_tiet']}, so_dong_ngay = {kq['so_dong_ngay']}, loi = {('$L$' + l_ + '$L$') if loi else 'null'} where lan = {lan}")
    print(json.dumps({**kq, "loi": loi}, ensure_ascii=False))
    # ── BẢN XEM NHẸ cho creative chấm lỗi vì video (anh 26/10/2026 "lỗi thì phải có cách xử lý") — cham-nhe.py, tối đa 1 creative / lượt
    try:
        r = subprocess.run(["python3", os.path.join(os.path.dirname(os.path.abspath(__file__)), "cham-nhe.py")], capture_output=True, text=True, timeout=540)
        if (r.stdout or r.stderr).strip(): print((r.stdout + r.stderr).strip()[-300:])
    except Exception as e: print(f"cham-nhe: {e}")
    r = subprocess.run(["python3", os.path.join(os.path.dirname(os.path.abspath(__file__)), "canh-bao.py")], capture_output=True, text=True, timeout=120)   # bước 3: cảnh báo bất thường
    print((r.stdout or r.stderr).strip()[-300:])

if __name__ == "__main__": main()
