#!/usr/bin/env python3
"""NHÂN BẢN CAMP THẮNG (luật NB — anh 22/10/2026: "rule clone camp thắng ko bị giới hạn bởi số camp trong ngày. Làm sao để áp dụng tự động luôn";
"mỗi phim tối đa 30 camp thắng. Nếu có camp thua thì sẽ dành slot cho creative mới"; "nhân bản thì cũng báo lên tele").
Cùng đường nút Duplicate của Ethopex (form create-facebook?sourceCampId= → POST /api/v1/campaigns/facebook): dựng payload từ CHÍNH camp gốc
(tài khoản, Page, pixel, cấu hình Ad Set, creative, phim) — chỉ đổi tên + ngân sách $1 + lịch chạy. 1 nhóm 1 ad như mọi camp.
Chặn: camp gốc phải đang bật; phim đã có ≥ TRAN_PHIM camp ĐANG CHẠY thì thôi (camp đã tắt không tính — camp thua tắt đi là nhường chỗ).
Chạy trên box3 (khoá ở studio):
  python3 nhan-ban.py <camp_gốc>            → in payload (chạy khô, không tạo gì)
  python3 nhan-ban.py <camp_gốc> --that [--lich today|tomorrow] [--luat "…"] [--ai "…"]   → tạo, đọc lại, ghi nhật ký (ethopex_nhat_ky)
  python3 nhan-ban.py <camp_khuôn> --creative <id> --content <id> --ten "<tên>" [--that …]   → camp MỚI cho creative khác trên khuôn camp đó
    (creative phải qua trước kiem-studio.sh + kiem-thoai-creative.sh; khuôn phải cùng ngôn ngữ với phim)
In một dòng JSON {ok, goc, moi, ten, loi}."""
import datetime as dt, importlib.util, json, os, re, subprocess, sys, time, urllib.request

TRAN_PHIM = 30
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
def api(duong, body=None):
    r = urllib.request.Request("https://api.ethopex.dev" + duong, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ethopex"})
    return json.load(urllib.request.urlopen(r, timeout=60))
js = lambda v: json.loads(v) if isinstance(v, str) and v.strip().startswith("{") else (v or {})

DEM_CR = {}
def dem_dang_chay(content_id):
    """số camp ĐANG CHẠY (ACTIVE) của phim; kèm DEM_CR {creative: số camp đang chạy dùng creative đó} của phim này (luật 1 đoạn ≤ 3 camp)"""
    n = 0; DEM_CR.clear()
    for c in api("/api/v1/campaigns?page_size=500")["data"]:
        if c.get("state") != "ACTIVE" and c.get("sync_status") == "done": continue
        try: d = api(f"/api/v1/campaigns/{c['id']}")
        except Exception: continue
        ads = [a for g in d.get("ad_groups") or [] for a in g.get("ads") or [] if a.get("content_id") == content_id]
        if ads: n += 1
        for a in ads: DEM_CR[a.get("creative_id")] = DEM_CR.get(a.get("creative_id"), 0) + 1
    return n

# MỘT ĐOẠN VIDEO TỐI ĐA 3 CAMP ĐANG CHẠY (anh duyệt 23/10/2026 sau Step Back: 12 camp cùng đoạn 692–757s tự đấu giá với nhau, ROI +199% → −11% trong một ngày).
# Nhân bản mà creative đã đủ 3 camp → tự đổi sang creative khác CÙNG PHIM (đạt CTA, chưa bị Meta từ chối, còn < 3 camp, mới nhất trước);
# phim chưa có creative nào như vậy → xếp hàng cắt GÓC MỚI ['ethopex_can_goc_moi'] (sua-cta.py trên iMac cắt + đẩy, rồi nhân bản lại) và dừng.
TRAN_DOAN = 3
def doan_cua():
    """creative → đoạn (content, tu, den) từ studio — hai creative cùng mốc là CÙNG ĐOẠN (bản CTA cũ + bản sửa CTA của Step Back #52951 / #53594, 24/10/2026)"""
    m = {}
    for l in q("select (kinh_thanh->'ethopex'->>'creative_id'), kinh_thanh->'ethopex'->>'content_id', round((kinh_thanh->'ethopex'->>'tu')::numeric), round((kinh_thanh->'ethopex'->>'den')::numeric) from xv_phim where project='ethopex' and kinh_thanh->'ethopex' ? 'tu' and coalesce(kinh_thanh->'ethopex'->>'tu','') <> ''").splitlines():
        x = l.split("|")
        if len(x) == 4 and x[0].isdigit(): m[int(x[0])] = (x[1], x[2], x[3])
    # bản sửa CTA cắt lại cùng cảnh từ tập sạch → mốc khác bản cũ: nối theo ethopex_cta_thay {cũ: mới} (cũ mang đoạn của mới)
    t = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_thay'") or "{}")
    for cu, moi in t.items(): m[int(cu)] = m.get(int(moi), ("cr", str(moi), ""))
    return m
_DOAN = None
def dem_doan(cr):
    """số camp đang chạy dùng cùng ĐOẠN với creative cr (gộp mọi creative cùng phim + cùng mốc); creative không rõ đoạn → đếm theo creative"""
    global _DOAN
    if _DOAN is None: _DOAN = doan_cua()
    d = _DOAN.get(cr)
    return sum(n for c, n in DEM_CR.items() if (_DOAN.get(c) == d if d else c == cr))
def creative_khac(content_id, bo_qua):
    dat = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_dat'") or "{}")
    tc = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_tu_choi'") or "{}")
    ds = [int(x) for x in q(f"select (kinh_thanh->'ethopex'->>'creative_id') from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(content_id)} order by 1 desc").split() if x.isdigit()]
    return next((c for c in ds if c not in bo_qua and str(c) in dat and str(c) not in tc and dem_doan(c) < TRAN_DOAN), None)
def xep_goc_moi(goc_id, content_id, ten):
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_can_goc_moi', '{}'::jsonb) on conflict (ten) do nothing")
    v = json.dumps({"goc": goc_id, "ten": ten, "luc": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")}, ensure_ascii=False).replace("'", "''")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(content_id)}', '{v}'::jsonb) where ten='ethopex_can_goc_moi' and not gia_tri ? '{int(content_id)}'")

def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(os.path.dirname(os.path.abspath(__file__)), tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

def cong(content_id, creative_id, ten=""):
    """cổng phim 18+ (kiem-phim-18.py) + cổng CTA (kiem-cta.py) + sổ bài học (bai-hoc.py: không lên lại đúng đoạn/dạng đã lỗ) — anh 22/10/2026"""
    chan = _nap("p18", "kiem-phim-18.py").kiem(content_id) or _nap("cta", "kiem-cta.py").kiem(creative_id)
    if chan: return chan
    c, w = _nap("bh", "bai-hoc.py").da_lo(content_id, ten)
    if w: print(w, file=sys.stderr)
    return c

# NHÂN BẢN CAMP THẮNG MANG CTA CŨ (anh 23/10/2026: "việc nhân bản một camp CTA sai rồi sửa lại thì vẫn gọi là nhân bản"): creative của camp gốc
# chưa đạt luật CTA → dùng BẢN SỬA đúng luật của chính đoạn đó (studio xv_khoa_ngoai['ethopex_cta_thay'] {creative cũ: creative sửa}, ghi bởi
# ghi-cta-thay.py — len-creative.py gọi khi dựng lại cho camp_cu). Chưa có bản sửa → xếp hàng dựng lại ['ethopex_cho_dung_lai'] thay vì chặn rồi bỏ.
def ban_sua(creative_id):
    v = q(f"select gia_tri->>'{int(creative_id)}' from xv_khoa_ngoai where ten='ethopex_cta_thay'")
    return int(v) if v and v.isdigit() else None
def xep_dung_lai(goc_id, creative_id, content_id, ten):
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_cho_dung_lai', '{}'::jsonb) on conflict (ten) do nothing")
    v = json.dumps({"goc": goc_id, "content_id": content_id, "ten": ten, "luc": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")}, ensure_ascii=False).replace("'", "''")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(creative_id)}', '{v}'::jsonb) where ten='ethopex_cho_dung_lai' and not gia_tri ? '{int(creative_id)}'")

# BỘ TÀI KHOẢN QC + FANPAGE (anh 23/10/2026: "1 bộ tk fb ads - fanpage mới: chỉ dành cho các phim mới, ko liên quan đến phim bộ tk khác; nhịp đăng,
# giới hạn camp, ngân sách vẫn như tk đầu tiên"). Sổ studio xv_khoa_ngoai['ethopex_bo_tk'] {bộ: {tk, ext, page, ten}}; mỗi PHIM thuộc đúng MỘT bộ —
# sổ ['ethopex_phim_tk'] {content_id: bộ}, ghi khi tạo camp; phim đã ở bộ này thì không lên bộ kia (cổng chan_bo).
def bo_tk(bo):
    v = q(f"select gia_tri->'{bo}' from xv_khoa_ngoai where ten='ethopex_bo_tk'")
    if not v: raise ValueError(f"không có bộ tài khoản '{bo}' trong ethopex_bo_tk")
    return json.loads(v)
def bo_cua_camp(c):
    v = q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_bo_tk'")
    return next((k for k, b in (json.loads(v) if v else {}).items() if int(b["tk"]) == int(c.get("ad_account_id") or 0)), None)
def chan_bo(content_id, bo):
    v = q(f"select gia_tri->>'{int(content_id)}' from xv_khoa_ngoai where ten='ethopex_phim_tk'")
    return f"phim {content_id} thuộc bộ tài khoản {v} — không lên bộ {bo} (mỗi phim một bộ, anh 23/10/2026)" if v and v != str(bo) else None
def ghi_bo(content_id, bo):
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_phim_tk', '{}'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(content_id)}', '{bo}') where ten='ethopex_phim_tk' and not gia_tri ? '{int(content_id)}'")

def payload(goc_id, lich, moi=None, bo=None):
    """moi = {creative, content, ten}: KHÔNG nhân bản mà dựng camp MỚI cho creative khác trên khuôn camp gốc (cùng tài khoản/Page/pixel/Ad Set/ngôn ngữ)
    — anh 22/10/2026 "camp cùng phim thì chủ động thêm góc khác"; trước đó phải đi br form (dung-camp.sh)."""
    d = api(f"/api/v1/campaigns/{goc_id}"); c = d["campaign"]; g = (d.get("ad_groups") or [{}])[0]; a = (g.get("ads") or [{}])[0]
    if c.get("state") != "ACTIVE": raise ValueError(f"camp gốc đang {c.get('state')}")
    if len(d.get("ad_groups") or []) != 1 or len(g.get("ads") or []) != 1: raise ValueError("camp gốc không đúng khuôn 1 nhóm 1 ad")
    if moi:
        ten = moi["ten"]; a = {**a, "creative_id": moi["creative"], "content_id": moi["content"]}
    else:
        goc_ten = re.sub(r"\s*\(nhan ban \d+ cua \d+\)$", "", c["name"])
        so = 1 + sum(1 for x in api("/api/v1/campaigns?page_size=500")["data"] if re.search(rf"\(nhan ban \d+ cua {goc_id}\)$", x.get("name", "")))
        ten = f"{goc_ten} (nhan ban {so} cua {goc_id})"
        if _nap("cta", "kiem-cta.py").kiem(a.get("creative_id")):   # CTA cũ → thay bằng bản sửa của chính đoạn đó
            sua = ban_sua(a.get("creative_id"))
            if not sua:
                xep_dung_lai(goc_id, a.get("creative_id"), a.get("content_id"), c["name"])
                raise ValueError(f"creative #{a.get('creative_id')} CTA cũ, chưa có bản sửa — đã xếp hàng dựng lại (ethopex_cho_dung_lai)")
            a = {**a, "creative_id": sua}; ten = f"{goc_ten} cta-sua (nhan ban {so} cua {goc_id})"
    # BỎ mọi mã định danh + mốc thời gian của camp GỐC (chạy khô 22/10/2026: source_payload Ad Set mang campaign_id FB + start_time của camp gốc
    # → gửi nguyên là gắn nhầm vào camp gốc / chạy theo lịch cũ). Lịch của bản mới do type_run quyết.
    BO = {"id", "campaign_id", "adset_id", "account_id", "start_time", "end_time", "stop_time", "created_time", "updated_time", "effective_status", "configured_status", "issues_info"}
    sp_c = {k: v for k, v in js(c.get("source_payload")).items() if k not in BO}; sp_c.update(name=ten, daily_budget=1, status="PAUSED")
    tk, ext, page = c.get("ad_account_id"), c.get("external_account_id"), a.get("facebook_page_id")
    bo = bo or bo_cua_camp(c) or "1"
    if bo_cua_camp(c) != str(bo):   # dựng trên khuôn camp của bộ khác → đổi đúng 3 trường tài khoản / Page (pixel dùng chung, bài đăng FB tạo mới)
        b = bo_tk(bo); tk, ext, page = int(b["tk"]), str(b["ext"]), int(b["page"])
    sp_g = {k: v for k, v in js(g.get("source_payload")).items() if k not in BO}; sp_g.update(name=f"{ten} · adset")
    return d, ten, a.get("content_id"), {
        "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": tk, "facebook_page_id": page, "bo": str(bo),
        "external_account_id": ext,
        "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
            "ads": [{"content_id": a.get("content_id"), "creative_id": a.get("creative_id"), "facebook_page_id": page, "domain": a.get("domain") or "",
                     "source_payload": {"name": ten, "status": "ACTIVE"}}]}]}}

def ghi_nhat_ky(kq, luat, ai):
    dong = {"luc": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y"), "viec": kq.get("viec") or "nhan_ban", "id": kq.get("moi") or kq.get("goc"), "goc": kq.get("goc"),
            "truoc": None, "sau": 1 if kq.get("ok") else None, "ok": kq.get("ok"), "loi": kq.get("loi"), "luat": luat or "(không ghi luật)", "ai": ai or "?"}
    v = json.dumps(dong, ensure_ascii=False).replace("'", "''")
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_nhat_ky', '[]'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(gia_tri || jsonb_build_array('{v}'::jsonb)) x offset greatest(jsonb_array_length(gia_tri) + 1 - 1000, 0)) t) where ten = 'ethopex_nhat_ky'")

def main(a):
    goc = int(a[0]); that = "--that" in a
    lay = lambda k, md=None: next((a[i + 1] for i, x in enumerate(a[:-1]) if x == k), md)
    lich, luat, ai = lay("--lich", "tomorrow"), lay("--luat"), lay("--ai")
    moi = {"creative": int(lay("--creative")), "content": int(lay("--content")), "ten": lay("--ten")} if lay("--creative") else None
    bo = lay("--bo")
    if moi and not (moi["content"] and moi["ten"]): raise SystemExit("--creative cần kèm --content và --ten")
    kq = {"ok": False, "goc": goc, "moi": None, "ten": None, "loi": None}
    try:
        d, ten, cid, pl = payload(goc, lich, moi, bo); kq["ten"] = ten; bo = pl.pop("bo")
        ly = chan_bo(cid, bo)
        if ly: raise ValueError(ly)
        if moi: kq["viec"] = "tao_camp"
        chan = cong(cid, pl["campaign"]["ad_groups"][0]["ads"][0]["creative_id"], ten)
        if chan: raise ValueError(chan)
        n = dem_dang_chay(cid)
        if n >= TRAN_PHIM: raise ValueError(f"phim {cid} đã {n} camp đang chạy (trần {TRAN_PHIM}) — chỗ còn lại để creative mới khi camp thua tắt")
        ad0 = pl["campaign"]["ad_groups"][0]["ads"][0]; cr = ad0["creative_id"]
        if dem_doan(cr) >= TRAN_DOAN:
            khac = creative_khac(cid, {cr})
            if not khac:
                xep_goc_moi(goc, cid, ten)
                raise ValueError(f"đoạn creative #{cr} đã {dem_doan(cr)} camp chạy (trần {TRAN_DOAN}/đoạn), phim chưa có góc khác — đã xếp hàng cắt góc mới (ethopex_can_goc_moi)")
            chan = cong(cid, khac, ten)
            if chan: raise ValueError(chan)
            ad0["creative_id"] = khac; kq["doi_creative"] = {"tu": cr, "sang": khac}
        kq["phim_dang_chay"] = n
        if not that:
            print(json.dumps({**kq, "ok": True, "chay_kho": True, "payload": pl}, ensure_ascii=False)); return
        r = api("/api/v1/campaigns/facebook", pl)
        moi = r.get("id") or (r.get("data") or {}).get("id") or (r.get("campaign") or {}).get("id")
        if not moi:   # đọc lại theo tên nếu API không trả id
            time.sleep(3); moi = next((x["id"] for x in api("/api/v1/campaigns?page_size=20")["data"] if x.get("name") == ten), None)
        if not moi: raise ValueError(f"Ethopex không trả camp mới: {str(r)[:160]}")
        for _ in range(12):
            time.sleep(5); c = api(f"/api/v1/campaigns/{moi}")["campaign"]
            if c.get("sync_status") in ("done", "synced") or c.get("error"): break
        kq.update(ok=not c.get("error"), moi=moi, dong_bo=c.get("sync_status"), loi=c.get("error") or None, bo=bo)
        if kq["ok"]: ghi_bo(cid, bo)
    except Exception as e:
        kq["loi"] = str(e)[:240]
    if that: ghi_nhat_ky(kq, luat, ai)
    print(json.dumps(kq, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1:])
