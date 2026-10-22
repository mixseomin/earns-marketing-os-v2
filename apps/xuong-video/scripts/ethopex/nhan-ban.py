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

def dem_dang_chay(content_id):
    """số camp ĐANG CHẠY (ACTIVE) của phim + số bản nhân bản tạo trong 24 giờ cho từng camp gốc"""
    n, ban = 0, {}
    for c in api("/api/v1/campaigns?page_size=500")["data"]:
        if c.get("state") != "ACTIVE" and c.get("sync_status") == "done": continue
        try: d = api(f"/api/v1/campaigns/{c['id']}")
        except Exception: continue
        if any(a.get("content_id") == content_id for g in d.get("ad_groups") or [] for a in g.get("ads") or []): n += 1
    return n

def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(os.path.dirname(os.path.abspath(__file__)), tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

def cong(content_id, creative_id):
    """cổng phim 18+ (kiem-phim-18.py) + cổng CTA (kiem-cta.py) — áp cho cả nhân bản lẫn camp góc mới (anh 22/10/2026)"""
    return _nap("p18", "kiem-phim-18.py").kiem(content_id) or _nap("cta", "kiem-cta.py").kiem(creative_id)

def payload(goc_id, lich, moi=None):
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
    # BỎ mọi mã định danh + mốc thời gian của camp GỐC (chạy khô 22/10/2026: source_payload Ad Set mang campaign_id FB + start_time của camp gốc
    # → gửi nguyên là gắn nhầm vào camp gốc / chạy theo lịch cũ). Lịch của bản mới do type_run quyết.
    BO = {"id", "campaign_id", "adset_id", "account_id", "start_time", "end_time", "stop_time", "created_time", "updated_time", "effective_status", "configured_status", "issues_info"}
    sp_c = {k: v for k, v in js(c.get("source_payload")).items() if k not in BO}; sp_c.update(name=ten, daily_budget=1, status="PAUSED")
    sp_g = {k: v for k, v in js(g.get("source_payload")).items() if k not in BO}; sp_g.update(name=f"{ten} · adset")
    return d, ten, a.get("content_id"), {
        "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": c.get("ad_account_id"), "facebook_page_id": a.get("facebook_page_id"),
        "external_account_id": c.get("external_account_id"),
        "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
            "ads": [{"content_id": a.get("content_id"), "creative_id": a.get("creative_id"), "facebook_page_id": a.get("facebook_page_id"), "domain": a.get("domain") or "",
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
    if moi and not (moi["content"] and moi["ten"]): raise SystemExit("--creative cần kèm --content và --ten")
    kq = {"ok": False, "goc": goc, "moi": None, "ten": None, "loi": None}
    try:
        d, ten, cid, pl = payload(goc, lich, moi); kq["ten"] = ten
        if moi: kq["viec"] = "tao_camp"
        chan = cong(cid, pl["campaign"]["ad_groups"][0]["ads"][0]["creative_id"])
        if chan: raise ValueError(chan)
        n = dem_dang_chay(cid)
        if n >= TRAN_PHIM: raise ValueError(f"phim {cid} đã {n} camp đang chạy (trần {TRAN_PHIM}) — chỗ còn lại để creative mới khi camp thua tắt")
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
        kq.update(ok=not c.get("error"), moi=moi, dong_bo=c.get("sync_status"), loi=c.get("error") or None)
    except Exception as e:
        kq["loi"] = str(e)[:240]
    if that: ghi_nhat_ky(kq, luat, ai)
    print(json.dumps(kq, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1:])
