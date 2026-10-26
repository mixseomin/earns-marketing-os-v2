#!/usr/bin/env python3
"""NHÂN BẢN CAMP THẮNG (luật NB — anh 22/10/2026: "rule clone camp thắng ko bị giới hạn bởi số camp trong ngày. Làm sao để áp dụng tự động luôn";
"mỗi phim tối đa 30 camp thắng. Nếu có camp thua thì sẽ dành slot cho creative mới"; "nhân bản thì cũng báo lên tele").
Cùng đường nút Duplicate của Ethopex (form create-facebook?sourceCampId= → POST /api/v1/campaigns/facebook): dựng payload từ CHÍNH camp gốc
(tài khoản, Page, pixel, cấu hình Ad Set, creative, phim) — chỉ đổi tên + ngân sách $1 + lịch chạy. 1 nhóm 1 ad như mọi camp.
Chặn: camp gốc phải đang bật; phim đã có ≥ TRAN_PHIM camp ĐANG CHẠY thì thôi (camp đã tắt không tính — camp thua tắt đi là nhường chỗ).
Chạy trên box3 (khoá ở studio):
  python3 nhan-ban.py <camp_gốc>            → in payload (chạy khô, không tạo gì)
  python3 nhan-ban.py <camp_gốc> --that [--lich today|tomorrow] [--luat "…"] [--ai "…"]   → tạo, đọc lại, ghi nhật ký (ethopex_nhat_ky)
    Clone luôn dùng creative KHÁC creative gốc + chưa có camp chạy; mọi camp mới / clone chỉ dùng creative máy chấm SẠCH; chỉ clone camp gốc
    đã chạm trần ngân sách (etp.cau_hinh.tran_camp, $30) (anh 25/10/2026).
  python3 nhan-ban.py <camp_khuôn> --creative <id> --content <id> --ten "<tên>" [--that …]   → camp MỚI cho creative khác trên khuôn camp đó
    (creative phải qua trước kiem-studio.sh + kiem-thoai-creative.sh; khuôn phải cùng ngôn ngữ với phim)
  python3 nhan-ban.py <camp_gốc> --thang <$> --that …   → THANG NHÂN BẢN bộ 2 (anh 25/10/2026): bản mới ở bậc ngân sách cao hơn camp gốc
    (creative khác cùng phim, tên "(thang $X cua <gốc>)"); không đòi gốc chạm trần — camp gốc giữ nguyên ngân sách, không phải học lại
  python3 nhan-ban.py <camp_gốc> --roas <1.0–1.4> [--ns 20] [--tam-dung] --that …   → CAMP ROAS (tài liệu Support 26/10/2026, anh duyệt 26/10/2026):
    nhân bản camp gốc (chi all time > $100, ROI > 50%) với bid ROAS goal (LOWEST_COST_WITH_MIN_ROAS + roas_average_floor ở Ad Set),
    ad = BÀI ĐĂNG CŨ của camp gốc (use existing post — giữ tương tác), ngân sách $15–20, lịch tomorrow, tên "… roas X duplicate by <gốc>".
    Camp ROAS là loại riêng: KHÔNG qua luật clone-khác-creative / cổng chấm / chạm trần / bão hoà (dùng lại đúng bài cũ); vẫn qua cổng etp + trần phim.
    Tạo xong đọc lại: mức ROAS sai → tạm dừng camp ngay + báo lỗi (Support: "nhập sai là lỗi camp"). --tam-dung = để PAUSED chờ anh review.
In một dòng JSON {ok, goc, moi, ten, loi}."""
import datetime as dt, importlib.util, json, os, re, subprocess, sys, time, urllib.request

# RÀO CHẮN etp (etp.on.tc bước 3, 24/10/2026): dừng khẩn / trần camp / trần ngày / trần bộ — apps/etp/cong.py
import importlib.util as _iuc
_sc = _iuc.spec_from_file_location("etp_cong", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp", "cong.py")); CONG = _iuc.module_from_spec(_sc); _sc.loader.exec_module(CONG)
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
    """số camp ĐANG CHẠY (ACTIVE hoặc chưa đồng bộ xong) của phim; kèm DEM_CR {creative: số camp đó dùng creative} (luật 1 đoạn ≤ 3 camp).
    Đọc KHO etp (dong-bo.py 10 phút/lần) + camp vừa tạo trong 15 phút qua (nhật ký luật) — trước 25/10/2026 đọc chi tiết từng camp qua API
    (~500 lượt gọi, 3–4 phút mỗi lần tạo camp)."""
    n = 0; DEM_CR.clear()
    rows = q(f"""select camp_id, coalesce(creative_id, 0) from etp.camp c where content_id = {int(content_id)}
                 and (camp_id in (select camp_id from etp.camp_dang_chay) or coalesce(dong_bo, '') not in ('done', 'synced'))""").splitlines()   # view gồm camp tạm dừng theo lịch giờ
    for l in rows:
        _, cr = l.split("|"); n += 1; DEM_CR[int(cr)] = DEM_CR.get(int(cr), 0) + 1
    # camp vừa tạo chưa vào kho (đồng bộ 10 phút): lấy từ sổ nhật ký studio
    try:
        moi = json.loads(q("""select coalesce(jsonb_agg(x), '[]'::jsonb)::text from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky'
                              and x->>'viec' in ('tao_camp', 'nhan_ban') and (x->>'ok')::boolean and to_timestamp(x->>'luc', 'HH24:MI DD/MM/YYYY') > (now() at time zone 'Asia/Ho_Chi_Minh') - interval '15 minutes'""") or "[]")
        da = {int(l.split("|")[0]) for l in rows}
        for x in moi:
            if int(x.get("content") or x.get("content_id") or 0) == int(content_id) and int(x.get("moi") or x.get("id") or 0) not in da:
                n += 1; c = int(x.get("creative") or x.get("creative_id") or 0); DEM_CR[c] = DEM_CR.get(c, 0) + 1
    except Exception: pass
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
# CỔNG CHẤM CREATIVE (anh 25/10/2026: "cái nào đủ điều kiện lên camp thì lên luôn" · chọn "kiểu 1"): view etp.cham_cong (migration 0328 — MỘT nguồn):
# chặn khi bất kỳ tiêu chí Meta ≤ 4 hoặc AFS CTA / dụ nhấp ≤ 4; an toàn thương hiệu / chất lượng / khớp đích chỉ cảnh báo. Chưa chấm → xếp hàng etp.cham_hang.
def cham_sach(cr):
    k = q(f"select duoc_len::text || '|' || coalesce(chan_boi, '') from etp.cham_cong where creative_id = {int(cr)}")
    if not k:
        q(f"insert into etp.cham_hang (creative_id, nguon, ai) values ({int(cr)}, 'moi', 'nhan-ban: chờ chấm trước khi lên') on conflict (creative_id) do nothing")
        return f"creative #{cr} chưa được máy chấm — đã xếp hàng chấm, lượt sau mới lên"
    duoc, chan = k.split("|", 1)
    return None if duoc == "true" else f"creative #{cr} bị cổng chấm chặn ({chan}) — không lên"

# CLONE PHẢI KHÁC CREATIVE (anh 25/10/2026: "clone camp thì phải khác creative một chút, chặt chẽ hơn"): bản nhân bản KHÔNG dùng lại creative
# của camp gốc, cũng không dùng creative đang có camp chạy của cùng phim — chọn creative khác cùng phim (đạt CTA, chưa bị Meta từ chối,
# đoạn < 3 camp, chấm sạch, mới nhất trước); không có → xếp hàng cắt góc mới, không clone y nguyên.
def creative_clone(content_id, cr_goc):
    dat = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_dat'") or "{}")
    tc = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_tu_choi'") or "{}")
    ds = [int(x) for x in q(f"select (kinh_thanh->'ethopex'->>'creative_id') from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(content_id)} order by 1 desc").split() if x.isdigit()]
    for c in ds:
        if c == cr_goc or DEM_CR.get(c, 0) > 0 or str(c) not in dat or str(c) in tc or dem_doan(c) >= TRAN_DOAN: continue
        if cham_sach(c) is None: return c
    return None

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

def _cau_hinh(khoa, mac):   # một sổ với luat-ethopex.py: etp.cau_hinh thang_bo / thang_muc (migration 0333)
    v = q(f"select gia_tri::text from etp.cau_hinh where khoa = '{khoa}'")
    return json.loads(v) if v else mac
THANG_BO = [str(x) for x in _cau_hinh("thang_bo", ["2"])]
THANG_MUC = {float(x) for x in _cau_hinh("thang_muc", [1, 3, 7, 15, 30]) if float(x) > 1}   # bậc mở bản mới (trừ bậc đầu $1)
ROAS_MIN, ROAS_MAX = 1.0, 1.4
def payload(goc_id, lich, moi=None, bo=None, thang=None, roas=None, ns_roas=20):
    """moi = {creative, content, ten}: KHÔNG nhân bản mà dựng camp MỚI cho creative khác trên khuôn camp gốc (cùng tài khoản/Page/pixel/Ad Set/ngôn ngữ)
    — anh 22/10/2026 "camp cùng phim thì chủ động thêm góc khác"; trước đó phải đi br form (dung-camp.sh)."""
    d = api(f"/api/v1/campaigns/{goc_id}"); c = d["campaign"]; g = (d.get("ad_groups") or [{}])[0]; a = (g.get("ads") or [{}])[0]
    if c.get("state") != "ACTIVE" and not roas: raise ValueError(f"camp gốc đang {c.get('state')}")   # ROAS: chọn theo số all time, camp gốc tắt rồi vẫn dùng được bài đăng
    if len(d.get("ad_groups") or []) != 1 or len(g.get("ads") or []) != 1: raise ValueError("camp gốc không đúng khuôn 1 nhóm 1 ad")
    if roas:
        ten = f"★ {re.sub(r'^\d+:\s*', '', c['name'])} roas {roas:g} duplicate by {goc_id}"   # ★ = dấu camp ROAS (anh 26/10/2026), cong.la_roas nhận theo tên
    elif moi:
        ten = moi["ten"]; a = {**a, "creative_id": moi["creative"], "content_id": moi["content"]}
    else:
        goc_ten = re.sub(r"\s*\((nhan ban \d+|thang \$\d+) cua \d+\)$", "", c["name"])
        so = 1 + sum(1 for x in api("/api/v1/campaigns?page_size=500")["data"] if re.search(rf"\(nhan ban \d+ cua {goc_id}\)$", x.get("name", "")))
        ten = f"{goc_ten} (thang ${thang:g} cua {goc_id})" if thang else f"{goc_ten} (nhan ban {so} cua {goc_id})"
        if not roas and _nap("cta", "kiem-cta.py").kiem(a.get("creative_id")):   # CTA cũ → thay bằng bản sửa của chính đoạn đó
            sua = ban_sua(a.get("creative_id"))
            if not sua:
                xep_dung_lai(goc_id, a.get("creative_id"), a.get("content_id"), c["name"])
                raise ValueError(f"creative #{a.get('creative_id')} CTA cũ, chưa có bản sửa — đã xếp hàng dựng lại (ethopex_cho_dung_lai)")
            a = {**a, "creative_id": sua}; ten = f"{goc_ten} cta-sua " + (f"(thang ${thang:g} cua {goc_id})" if thang else f"(nhan ban {so} cua {goc_id})")   # giữ nhãn thang — luật nhận bản thang theo tên
    # BỎ mọi mã định danh + mốc thời gian của camp GỐC (chạy khô 22/10/2026: source_payload Ad Set mang campaign_id FB + start_time của camp gốc
    # → gửi nguyên là gắn nhầm vào camp gốc / chạy theo lịch cũ). Lịch của bản mới do type_run quyết.
    BO = {"id", "campaign_id", "adset_id", "account_id", "start_time", "end_time", "stop_time", "created_time", "updated_time", "effective_status", "configured_status", "issues_info"}
    sp_c = {k: v for k, v in js(c.get("source_payload")).items() if k not in BO}; sp_c.update(name=ten, daily_budget=int(thang) if thang else 1, status="PAUSED")   # số nguyên như lam-ethopex tang (bậc thang đều là $ nguyên)
    tk, ext, page = c.get("ad_account_id"), c.get("external_account_id"), a.get("facebook_page_id")
    bo = bo or bo_cua_camp(c) or "1"
    if bo_cua_camp(c) != str(bo):   # dựng trên khuôn camp của bộ khác → đổi đúng 3 trường tài khoản / Page (pixel dùng chung, bài đăng FB tạo mới)
        b = bo_tk(bo); tk, ext, page = int(b["tk"]), str(b["ext"]), int(b["page"])
    sp_g = {k: v for k, v in js(g.get("source_payload")).items() if k not in BO}; sp_g.update(name=f"{ten} · adset")
    if roas:   # đúng đường form Ethopex (bid strategy cấp campaign + roas_average_floor cấp Ad Set, tối ưu VALUE) — đọc từ mã app 26/10/2026
        sid = (a.get("effective_object_story_id") or "").strip()
        if not re.fullmatch(r"\d+_\d+", sid): raise ValueError(f"camp gốc #{goc_id} không có mã bài đăng (effective_object_story_id) để dùng lại")
        if bo and str(bo) != str(bo_cua_camp(c)): raise ValueError("camp ROAS dùng bài đăng của camp gốc → phải cùng bộ tài khoản / Page với camp gốc")
        sp_c.update(bid_strategy="LOWEST_COST_WITH_MIN_ROAS", daily_budget=int(ns_roas))
        sp_g.update(optimization_goal="VALUE", bid_constraints={"roas_average_floor": roas}); sp_g.pop("bid_amount", None)
        return d, ten, a.get("content_id"), {
            "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": tk, "facebook_page_id": page, "bo": str(bo),
            "external_account_id": ext,
            "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
                "ads": [{"effective_object_story_id": sid, "source_payload": {"name": ten, "status": "ACTIVE"}}]}]}}
    return d, ten, a.get("content_id"), {
        "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": tk, "facebook_page_id": page, "bo": str(bo),
        "external_account_id": ext,
        "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
            "ads": [{"content_id": a.get("content_id"), "creative_id": a.get("creative_id"), "facebook_page_id": page, "domain": a.get("domain") or "",
                     "source_payload": {"name": ten, "status": "ACTIVE"}}]}]}}

def ghi_nhat_ky(kq, luat, ai):
    dong = {"luc": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y"), "viec": kq.get("viec") or "nhan_ban", "id": kq.get("moi") or kq.get("goc"), "goc": kq.get("goc"),
            "truoc": None, "sau": (kq.get("ns") or 1) if kq.get("ok") else None, "ok": kq.get("ok"), "loi": kq.get("loi"), "luat": luat or "(không ghi luật)", "ai": ai or "?", "content": kq.get("content"), "creative": kq.get("creative")}
    v = json.dumps(dong, ensure_ascii=False).replace("'", "''")
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_nhat_ky', '[]'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(gia_tri || jsonb_build_array('{v}'::jsonb)) x offset greatest(jsonb_array_length(gia_tri) + 1 - 1000, 0)) t) where ten = 'ethopex_nhat_ky'")

def main(a):
    goc = int(a[0]); that = "--that" in a
    lay = lambda k, md=None: next((a[i + 1] for i, x in enumerate(a[:-1]) if x == k), md)
    lich, luat, ai = lay("--lich", "tomorrow"), lay("--luat"), lay("--ai")
    moi = {"creative": int(lay("--creative")), "content": int(lay("--content")), "ten": lay("--ten")} if lay("--creative") else None
    bo = lay("--bo"); thang = float(lay("--thang")) if lay("--thang") else None
    if thang and (moi or thang not in THANG_MUC): raise SystemExit(f"--thang phải là một trong {sorted(THANG_MUC)} và không đi kèm --creative")
    if moi and not (moi["content"] and moi["ten"]): raise SystemExit("--creative cần kèm --content và --ten")
    roas = float(lay("--roas")) if lay("--roas") else None
    if roas is not None:
        if moi or thang: raise SystemExit("--roas không đi kèm --creative / --thang")
        if not ROAS_MIN <= roas <= ROAS_MAX: raise SystemExit(f"--roas phải trong {ROAS_MIN}–{ROAS_MAX} (Support 26/10/2026)")
        return roas_main(goc, roas, int(float(lay("--ns", "20"))), lich, that, "--tam-dung" in a, luat, ai)
    kq = {"ok": False, "goc": goc, "moi": None, "ten": None, "loi": None}
    try:
        d, ten, cid, pl = payload(goc, lich, moi, bo, thang); kq["ten"] = ten; bo = pl.pop("bo")
        ly = chan_bo(cid, bo) or (None if moi else q(f"select etp.bo_chan_mo('{bo}')"))   # bộ có camp ĐÃ TĂNG vẫn lỗ 3 ngày khép → ngừng nhân bản / thang; camp mới $1 không chặn (migration 0339, anh 26/10/2026)
        if ly: raise ValueError(ly)
        if moi: kq["viec"] = "tao_camp"
        chan = cong(cid, pl["campaign"]["ad_groups"][0]["ads"][0]["creative_id"], ten)
        if chan: raise ValueError(chan)
        n = dem_dang_chay(cid)
        if moi and DEM_CR.get(int(moi["creative"]), 0) > 0:   # một creative một camp mới (25/10/2026: hai lượt lên camp chạy cùng lúc tạo trùng 3 camp)
            raise ValueError(f"creative #{moi['creative']} đã có camp đang chạy / vừa tạo — không tạo camp thứ hai")
        if n >= TRAN_PHIM: raise ValueError(f"phim {cid} đã {n} camp đang chạy (trần {TRAN_PHIM}) — chỗ còn lại để creative mới khi camp thua tắt")
        if thang:   # thang nhân bản: chỉ bộ 2, bậc mới phải cao hơn ngân sách camp gốc
            ns = float((d.get("campaign") or {}).get("budget_daily") or 0)
            if str(bo) not in THANG_BO: raise ValueError(f"thang nhân bản chỉ áp dụng bộ {', '.join(THANG_BO)} (camp gốc thuộc bộ {bo}) — bộ khác giữ tăng bậc (etp.cau_hinh.thang_bo)")
            if thang <= ns: raise ValueError(f"bậc ${thang:g} không cao hơn camp gốc ${ns:g}")
        elif not moi:   # CHỈ CLONE CAMP ĐÃ CHẠM TRẦN NGÂN SÁCH (anh 25/10/2026: "không tạo trùng nếu camp hiện tại chưa đạt $30 budget tối đa") — trần = etp.cau_hinh.tran_camp
            tran = float(q("select coalesce((select gia_tri::text::numeric from etp.cau_hinh where khoa = 'tran_camp'), 30)") or 30)
            ns = float((d.get("campaign") or {}).get("budget_daily") or 0)
            if ns < tran: raise ValueError(f"camp gốc #{goc} mới ${ns:g}/ngày, chưa chạm trần ${tran:g} — chưa clone (tăng ngân sách camp gốc trước)")
        if not moi:   # CỔNG BÃO HOÀ PHIM (B, anh 25/10/2026): mọi đường nhân bản (luật NB, góc mới, soát đoạn) — phim đang tụt thì không nhân thêm camp
            try: bh = q(f"select chan_nb from etp.phim_bao_hoa where content_id = {int(cid)} and chan_nb is not null")
            except Exception: bh = ""
            if bh: raise ValueError(f"phim {cid} đang bão hoà — {bh} → không nhân bản thêm (dồn tiền sang phim khác)")
        ad0 = pl["campaign"]["ad_groups"][0]["ads"][0]; cr = ad0["creative_id"]
        if not moi:   # clone: luôn đổi sang creative KHÁC (anh 25/10/2026)
            khac = creative_clone(cid, cr)
            if not khac:
                xep_goc_moi(goc, cid, ten)
                raise ValueError(f"clone phải khác creative — phim chưa có creative khác sạch, chưa dùng (creative gốc #{cr}) — đã xếp hàng cắt góc mới")
            chan = cong(cid, khac, ten)
            if chan: raise ValueError(chan)
            ad0["creative_id"] = khac; kq["doi_creative"] = {"tu": cr, "sang": khac}; cr = khac
        elif dem_doan(cr) >= TRAN_DOAN:
            khac = creative_khac(cid, {cr})
            if not khac:
                xep_goc_moi(goc, cid, ten)
                raise ValueError(f"đoạn creative #{cr} đã {dem_doan(cr)} camp chạy (trần {TRAN_DOAN}/đoạn), phim chưa có góc khác — đã xếp hàng cắt góc mới (ethopex_can_goc_moi)")
            chan = cong(cid, khac, ten)
            if chan: raise ValueError(chan)
            ad0["creative_id"] = khac; kq["doi_creative"] = {"tu": cr, "sang": khac}
        kq["content"], kq["creative"] = cid, ad0["creative_id"]   # nhật ký mang phim + creative → dem_dang_chay đếm được camp vừa tạo chưa vào kho
        ly = cham_sach(ad0["creative_id"])   # cổng chấm: creative cuối cùng phải SẠCH
        if ly: raise ValueError(ly)
        kq["phim_dang_chay"] = n
        ly = CONG.kiem("tao_camp" if moi else "nhan_ban", None, thang or 1, 0, str(bo) if bo else None)
        if ly: raise ValueError(ly)
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
        kq.update(ok=not c.get("error"), moi=moi, dong_bo=c.get("sync_status"), loi=c.get("error") or None, bo=bo, ns=c.get("budget_daily"))
        if thang and kq["ok"] and float(c.get("budget_daily") or 0) != thang:   # Ethopex không nhận ngân sách lúc tạo → đặt lại ngay (camp mới chưa học gì)
            api("/api/v1/campaigns/update", {"campaign": {"campaign_id": moi, "source_payload": {"daily_budget": int(thang)}}}); time.sleep(8)
            kq["ns"] = api(f"/api/v1/campaigns/{moi}")["campaign"].get("budget_daily")
        if kq["ok"]: ghi_bo(cid, bo)
    except Exception as e:
        kq["loi"] = str(e)[:240]
    if that: ghi_nhat_ky(kq, luat, ai)
    print(json.dumps(kq, ensure_ascii=False))

def roas_main(goc, roas, ns, lich, that, tam_dung, luat, ai):
    """CAMP ROAS — loại riêng (anh 26/10/2026: "Camp ROAS là 1 dạng riêng"): bỏ các luật nhân bản thường, giữ cổng etp + trần phim + mỗi phim một bộ."""
    kq = {"ok": False, "viec": "roas", "goc": goc, "moi": None, "ten": None, "roas": roas, "loi": None}
    try:
        if not 15 <= ns <= 20: raise ValueError("ngân sách camp ROAS $15–20 (Support 26/10/2026)")
        d, ten, cid, pl = payload(goc, lich, bo=None, roas=roas, ns_roas=ns); kq["ten"] = ten; bo = pl.pop("bo")
        ly = chan_bo(cid, bo)
        if ly: raise ValueError(ly)
        n = dem_dang_chay(cid)
        if n >= TRAN_PHIM: raise ValueError(f"phim {cid} đã {n} camp đang chạy (trần {TRAN_PHIM})")
        if any(x.get("name") == ten for x in api("/api/v1/campaigns?page_size=500")["data"]): raise ValueError(f"đã có camp '{ten}' — không tạo trùng")
        ly = CONG.kiem("nhan_ban", None, ns, 0, str(bo) if bo else None)
        if ly: raise ValueError(ly)
        kq["content"] = cid
        if not that:
            print(json.dumps({**kq, "ok": True, "chay_kho": True, "payload": pl}, ensure_ascii=False)); return
        r = api("/api/v1/campaigns/facebook", pl)
        moi = r.get("id") or (r.get("data") or {}).get("id") or (r.get("campaign") or {}).get("id")
        if not moi:
            time.sleep(3); moi = next((x["id"] for x in api("/api/v1/campaigns?page_size=20")["data"] if x.get("name") == ten), None)
        if not moi: raise ValueError(f"Ethopex không trả camp mới: {str(r)[:160]}")
        kq["moi"] = moi
        # ĐỢI ĐỒNG BỘ XONG HẲN (#70162, 26/10/2026: lệnh tạm dừng gửi lúc còn 'creating_adset' bị Ethopex đè — đồng bộ xong camp tự về ACTIVE)
        for _ in range(150):   # Meta kiểm ad (checking_ads) có lúc > 15 phút (#70162, #70174 26/10/2026) — chờ tới 20 phút
            time.sleep(8); d2 = api(f"/api/v1/campaigns/{moi}"); c = d2["campaign"]
            if c.get("sync_status") in ("done", "error") or c.get("error"): break
        if c.get("error"): raise ValueError("Ethopex báo lỗi: " + str(c.get("error"))[:200])
        if c.get("sync_status") != "done": raise ValueError(f"camp #{moi} chưa đồng bộ xong sau 20 phút ({c.get('sync_status')}) — chưa đọc lại / tạm dừng được, kiểm tay")
        if float(c.get("budget_daily") or 0) != ns:   # Ethopex có lúc không nhận ngân sách lúc tạo → đặt lại
            api("/api/v1/campaigns/update", {"campaign": {"campaign_id": moi, "source_payload": {"daily_budget": ns}}}); time.sleep(8)
            d2 = api(f"/api/v1/campaigns/{moi}"); c = d2["campaign"]
        g = js(((d2.get("ad_groups") or [{}])[0]).get("source_payload"))
        san = (g.get("bid_constraints") or {}).get("roas_average_floor")
        san = float(san) / 10000 if san is not None and float(san) > 100 else (float(san) if san is not None else None)   # Meta lưu ×10000
        kq.update(ns=c.get("budget_daily"), chien_luoc=c.get("source_bidding_strategy"), roas_doc_lai=san, target_roas=c.get("target_roas"), trang_thai=c.get("state"), dong_bo=c.get("sync_status"))
        sai = c.get("source_bidding_strategy") not in (None, "", "LOWEST_COST_WITH_MIN_ROAS") or san is None or abs(san - roas) > 1e-6
        if sai or tam_dung:
            api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [moi], "status": "paused"}])
            for _ in range(15):
                time.sleep(5); tt = api(f"/api/v1/campaigns/{moi}")["campaign"]
                if tt.get("state") == "PAUSED" and tt.get("source_status") == "PAUSED": break
            kq["tam_dung"] = tt.get("state") == "PAUSED"; kq["trang_thai"] = tt.get("state")
            if not kq["tam_dung"]: raise ValueError(f"đã gửi lệnh tạm dừng nhưng camp #{moi} vẫn {tt.get('state')} — tắt tay ngay")
        if sai: raise ValueError(f"đọc lại sai ROAS (đặt {roas}, Ethopex {san}, chiến lược {c.get('source_bidding_strategy')}) — đã tạm dừng camp")
        kq["ok"] = True; ghi_bo(cid, bo)
    except Exception as e:
        kq["loi"] = str(e)[:240]
    if that: ghi_nhat_ky(kq, luat, ai)
    print(json.dumps(kq, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1:])
