#!/usr/bin/env python3
"""LÀM THEO LỆNH ANH DUYỆT (nút Telegram phòng Ethopex, anh 21/10/2026: "tao có thể duyệt trên đó luôn"). Chạy trên box3 (khoá ở studio xv_khoa_ngoai).
Chỉ hai việc, đúng API giao diện Ethopex dùng (đọc từ mã app 21/10/2026):
  tang <camp_id> <ngân sách>   → POST /api/v1/campaigns/update {campaign:{campaign_id, source_payload:{daily_budget}}}
  giam <camp_id> <ngân sách>   → cùng API update, chỉ xuống thang (luật GB, nhip_tang.chan_giam)
  bat  <camp_id>               → bật lại (cùng API control, status 'active') — chỉ khi anh lệnh
  tat  <camp_id> [--ep]        → POST /api/v1/campaigns/control/batch/bulk [{entity_type:'campaign', entity_ids:[id], status:'paused'}]
Chặn: ngân sách phải là mức hợp lệ ($2 · thang $3–20), lớn hơn mức đang chạy, không quá trần $20; camp phải đang ACTIVE; nhịp tăng (nhip_tang.py: ≥ 3 giờ giữa hai lần). Làm xong ĐỌC LẠI camp để xác nhận.
In một dòng JSON {ok, viec, id, truoc, sau, loi}."""
import json, os, subprocess, sys, time, urllib.request, importlib.util
_s = importlib.util.spec_from_file_location("nhip_tang", os.path.join(os.path.dirname(os.path.abspath(__file__)), "nhip_tang.py")); NT = importlib.util.module_from_spec(_s); _s.loader.exec_module(NT)

# RÀO CHẮN etp (etp.on.tc bước 3, 24/10/2026): dừng khẩn / trần camp / trần ngày / trần bộ — apps/etp/cong.py
import importlib.util as _iuc
_sc = _iuc.spec_from_file_location("etp_cong", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp", "cong.py")); CONG = _iuc.module_from_spec(_sc); _sc.loader.exec_module(CONG)
MUC = {2, 3, 5, 7, 10, 15, 20, 30}   # $30 chỉ qua luật T30 (camp $20 tiêu đủ + ROI cao 2–3 ngày, Support 23/10/2026) — máy tự tăng từ 28/10/2026 (anh: "ko cần xin nữa")
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp")); import ethopex_api as EA   # cổng chung: chỉ tài khoản nhà (anh 28/10/2026)
def api(duong, body=None):
    r = urllib.request.Request("https://api.ethopex.dev" + duong, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ethopex"})
    return json.load(urllib.request.urlopen(r, timeout=40))

api = lambda p, b=None: EA.api(p, b)   # mọi lệnh Ethopex qua cổng chung apps/etp/ethopex_api.py: danh sách đủ mọi trang + chỉ camp tài khoản nhà, lệnh ghi vào camp ngoài bị chặn (anh 28/10/2026)
def doc(cid):
    c = api(f"/api/v1/campaigns/{cid}")["campaign"]
    return {"ns": c.get("budget_daily"), "tt": c.get("state")}

ROI_GIU = 20
def roi_ky(cid):
    """ROI của camp theo ba mốc (Report Ethopex, số mới nhất): hôm nay · 2 ngày gần nhất · cộng dồn từ đầu tháng. Mốc chi < $0,3 → None."""
    import datetime as dt
    hn = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date(); mai = (hn + dt.timedelta(days=1)).isoformat()
    so = {}
    def mot(tu):
        rows = api("/api/v1/report", {"columns": ["campaign_name", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 2000, "page": 1, "page_size": 2000,
                                      "date_from": tu, "date_to": mai}).get("rows", [])
        x = next((r for r in rows if r.get("campaign_id") == cid), None)
        c, t = (float(x.get("cost") or 0), float(x.get("revenue") or 0)) if x else (0, 0)
        so[tu] = c
        return (t - c) / c * 100 if c >= 0.3 else None
    r = {"hom_nay": mot(hn.isoformat()), "hai_ngay": mot((hn - dt.timedelta(days=1)).isoformat()), "tong": mot(hn.replace(day=1).isoformat())}
    r["chi_tong"] = so.get(hn.replace(day=1).isoformat(), 0.0)
    return r

CHI_TOI_THIEU_TAT = 10
TUOI_TOI_THIEU_TAT = 7
def tat_bao_lau(cid):
    """số giờ camp đã tắt: từ lần tắt gần nhất trong etp.nhat_ky; không có thì từ cuối ngày UTC cuối cùng còn chi (etp.so_ngay); không biết → None"""
    g = q(f"select extract(epoch from now() - max(luc)) / 3600 from etp.nhat_ky where camp_id = {cid} and viec = 'tat' and ok")
    if not g: g = q(f"select extract(epoch from now() - (max(ngay) + 1)::timestamp at time zone 'utc') / 3600 from etp.so_ngay where camp_id = {cid} and chi > 0")
    try: return float(g)
    except (TypeError, ValueError): return None

def dang_lai(cid, t7=False):
    """camp còn lãi thì không tắt (anh 22/10/2026: "camp nào lãi hơn 20% thì bật lại", rồi "camp hơn 2 ngày có lãi sao lại đóng?"):
    hôm nay > 20% · hoặc 2 ngày gần nhất có lãi (> 0) · hoặc cộng dồn > 0 → trả câu lý do, không thì None"""
    # REVIEW TẮT CHỈ KHI CAMP ĐỦ 7 NGÀY (anh 22/10/2026: "quy tắc đúng về cắt camp là ít nhất 7 ngày sẽ review tắt camp, chứ không tắt sớm")
    import datetime as dt
    # LUẬT T7 của Support (anh 26/10/2026 "tắt luôn đi"): kỳ xét là 7 ngày, > 3 ngày bật, chi > $5 — bỏ hai chặn tuổi 7 ngày / tiêu $10; các chặn camp đang LÃI giữ nguyên
    tao = None if t7 else api(f"/api/v1/campaigns/{cid}")["campaign"].get("created_at")
    if tao:
        tuoi = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(str(tao).replace("Z", "+00:00"))).total_seconds() / 86400
        if tuoi < TUOI_TOI_THIEU_TAT: return f"camp mới {tuoi:.1f} ngày (< {TUOI_TOI_THIEU_TAT} ngày) — chưa tới kỳ review tắt, lỗ thì giảm bậc"
    r = roi_ky(cid)
    # ĐÓNG CAMP PHẢI TIÊU ÍT NHẤT $10 (anh 22/10/2026: "lý do đóng camp là phải tiêu ít nhất $10") — chưa đủ tiền thì chưa đủ dữ liệu để kết luận
    if not t7 and r["chi_tong"] < CHI_TOI_THIEU_TAT: return f"mới tiêu ${r['chi_tong']:.2f} (< ${CHI_TOI_THIEU_TAT}) — chưa đủ để đóng"
    if r["hom_nay"] is not None and r["hom_nay"] > ROI_GIU: return f"hôm nay ROI {r['hom_nay']:+.0f}%"
    if r["hai_ngay"] is not None and r["hai_ngay"] > 0: return f"2 ngày ROI {r['hai_ngay']:+.0f}%"
    if r["tong"] is not None and r["tong"] > 0: return f"cộng dồn ROI {r['tong']:+.0f}%"
    return None

def roi_tong(cid):
    return roi_ky(cid)["tong"]

def chan_sau_giam(cid):
    """CỔNG TĂNG LẠI SAU GIẢM (anh 24/10/2026: "camp bị giảm thì không được tự tăng lại bởi một rule khác tương đương — đã giảm rồi thì muốn tăng lại phải
    đúng quy trình, đủ rule"). Mọi đường tăng (máy tự tăng, nút Telegram, T30, lãi đầu phiên) đều qua đây. Camp có lần giảm mới hơn lần tăng gần nhất →
    chỉ được tăng khi: đã qua khoá sau giảm (nhip_tang) · ROI TỪ NGÀY GIẢM (ngày Ethopex = UTC) ≥ ROI_TANG_LAI% với chi ≥ $1 · hôm nay không âm.
    → câu lý do chặn, None nếu được. --ep (anh lệnh đích danh) bỏ qua."""
    import datetime as dt
    g, t = NT.lan_giam(lambda p: api(p), cid), NT.lan_tang(lambda p: api(p), cid)
    if not g or (t and t[0] > g[0]): return None
    tu, nay = g[0].date().isoformat(), dt.datetime.now(dt.timezone.utc).date().isoformat()
    def so(d1, d2):
        b = {"columns": ["campaign_name", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 1000, "page": 1, "page_size": 1000, "date_from": d1, "date_to": d2}
        x = {"chi": 0.0, "thu": 0.0}
        for r in api("/api/v1/report", b).get("rows", []):
            if int(r.get("campaign_id") or 0) == cid: x["chi"] += float(r.get("cost") or 0); x["thu"] += float(r.get("revenue") or 0)
        return x
    s, h = so(tu, nay), so(nay, nay)
    r = (s["thu"] - s["chi"]) / s["chi"] * 100 if s["chi"] >= 1 else None
    vn = (g[0] + dt.timedelta(hours=7)).strftime("%H:%M %d/%m")
    if r is None: return f"đã giảm lúc {vn}, chưa đủ số từ ngày giảm (chi < $1) — chưa được tăng lại"
    if r < ROI_TANG_LAI: return f"đã giảm lúc {vn}: ROI từ ngày giảm {r:+.0f}% < {ROI_TANG_LAI}% — chưa được tăng lại"
    if h["chi"] >= 0.3 and h["thu"] < h["chi"]: return f"đã giảm lúc {vn}: hôm nay đang âm — chưa được tăng lại"
    return None
ROI_TANG_LAI = 50

def tat_loat(ids, luat, ai, t7=False, ep=False):
    """TẮT HÀNG LOẠT (anh 26/10/2026: "sao ko gửi hàng loạt — backend có nút select all rồi set"): cùng chặn như `tat` nhưng đọc số MỘT lần cho cả danh sách
    (3 lượt Report: hôm nay · 2 ngày · từ đầu tháng) + một danh sách camp, rồi MỘT lệnh bulk mỗi 50 camp, đọc lại một lần. Bản cũ gọi từng camp ~25 giây/camp."""
    import datetime as dt
    if not ((ai or "").strip().lower().startswith("anh") or "(nút telegram)" in (ai or "").lower()): raise ValueError("cấm tự tắt camp — phải có anh duyệt")
    if not (luat or "").strip(): raise ValueError("tắt camp phải ghi rõ luật nào (--luat)")
    hn = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date(); mai = (hn + dt.timedelta(days=1)).isoformat()
    def ky(tu):
        g = {}
        for x in api("/api/v1/report", {"columns": ["campaign_name", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 5000, "page": 1, "page_size": 5000, "date_from": tu, "date_to": mai}).get("rows", []):
            a = g.setdefault(int(x["campaign_id"]), [0.0, 0.0]); a[0] += float(x.get("cost") or 0); a[1] += float(x.get("revenue") or 0)
        return g
    nay, hai, tong = ky(hn.isoformat()), ky((hn - dt.timedelta(days=1)).isoformat()), ky(hn.replace(day=1).isoformat())
    roi = lambda g, c: (lambda x: (x[1] - x[0]) / x[0] * 100 if x and x[0] >= 0.3 else None)(g.get(c))
    ds = {int(c["id"]): c for c in api("/api/v1/campaigns?page_size=2000")["data"]}
    kq = {"gui": [], "lich": [], "giu": {}, "da_tat": [], "chua": []}
    for c in ids:
        st = (ds.get(c) or {}).get("state")
        if st != "ACTIVE":
            if q(f"delete from etp.lich_tat where camp_id = {c} returning camp_id"): kq["lich"].append(c)
            else: kq["giu"][c] = f"camp đã {st}"
            continue
        tuoi = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(str(ds[c].get("created_at")).replace("Z", "+00:00"))).total_seconds() / 86400 if ds[c].get("created_at") else 99
        ly = (f"camp mới {tuoi:.1f} ngày (< {TUOI_TOI_THIEU_TAT})" if not t7 and tuoi < TUOI_TOI_THIEU_TAT else
              f"mới tiêu ${(tong.get(c) or [0])[0]:.2f} (< ${CHI_TOI_THIEU_TAT})" if not t7 and (tong.get(c) or [0])[0] < CHI_TOI_THIEU_TAT else
              f"hôm nay ROI {roi(nay, c):+.0f}%" if (roi(nay, c) or -1e9) > ROI_GIU else
              f"2 ngày ROI {roi(hai, c):+.0f}%" if (roi(hai, c) or -1e9) > 0 else
              f"cộng dồn ROI {roi(tong, c):+.0f}%" if (roi(tong, c) or -1e9) > 0 else None)
        if ly and not ep: kq["giu"][c] = ly   # ep: anh lệnh tắt cả danh sách (anh 26/10/2026 với luật T7: không giữ camp "hôm nay đang lãi")
        else: kq["gui"].append(c)
    for i in range(0, len(kq["gui"]), 50):
        r = api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": kq["gui"][i:i + 50], "status": "paused"}])
        d0 = (r.get("data") or [{}])[0]
        if d0 and d0.get("ok") is False: raise ValueError(d0.get("error") or "Ethopex từ chối tắt")
    if kq["gui"]:
        for _ in range(12):   # Ethopex đổi trạng thái chậm (đo 26/10/2026: > 20 giây cho 15 camp) — đọc lại tới 60 giây
            time.sleep(5); ds2 = {int(c["id"]): c.get("state") for c in api("/api/v1/campaigns?page_size=2000")["data"]}
            if all(ds2.get(c) == "PAUSED" for c in kq["gui"]): break
        kq["da_tat"] = [c for c in kq["gui"] if ds2.get(c) == "PAUSED"]; kq["chua"] = [c for c in kq["gui"] if ds2.get(c) != "PAUSED"]
    for c in kq["da_tat"] + kq["lich"]:
        ghi_nhat_ky({"viec": "tat", "id": c, "ok": True, "truoc": {"ns": ds[c].get("budget_daily"), "tt": "ACTIVE"}, "sau": {"ns": ds[c].get("budget_daily"), "tt": "PAUSED"}}, luat, ai)
    return kq

def main(a):
    # --luat "<mã luật · số liệu>" (BẮT BUỘC ghi khi tăng — anh 21/10/2026) · --ai "<ai duyệt: anh (chat) / anh (nút Telegram)>"
    luat = next((a[i + 1] for i, x in enumerate(a[:-1]) if x == "--luat"), None); ai = next((a[i + 1] for i, x in enumerate(a[:-1]) if x == "--ai"), None)
    ep = "--ep" in a   # anh lệnh đích danh (vd phim 18+) — bỏ qua chặn camp lãi
    a = [x for i, x in enumerate(a) if x not in ("--luat", "--ai", "--ep") and (i == 0 or a[i - 1] not in ("--luat", "--ai"))]
    if a[0] == "tat-loat":   # tat-loat <id,id,…> --luat … --ai … [--t7]
        print(json.dumps(tat_loat([int(x) for x in a[1].split(",") if x.strip().isdigit()], luat, ai, t7="--t7" in sys.argv, ep=ep), ensure_ascii=False)); return
    viec, cid = a[0], int(a[1]); kq = {"ok": False, "viec": viec, "id": cid}
    try:
        truoc = doc(cid); kq["truoc"] = truoc
        if viec == "tang":
            ns = int(a[2])
            if ns not in MUC: raise ValueError(f"${ns} không phải mức hợp lệ {sorted(MUC)}")
            if truoc["tt"] != "ACTIVE": raise ValueError(f"camp đang {truoc['tt']}, không tăng")
            if ns <= float(truoc["ns"] or 0): raise ValueError(f"camp đã ${truoc['ns']} ≥ ${ns}")
            ly = NT.chan_tang(lambda p: api(p), cid)   # nhịp tăng: ≥ 3 giờ giữa hai lần (nút cũ bấm muộn cũng bị chặn)
            if ly: raise ValueError(ly)
            ly = None if ep else chan_sau_giam(cid)   # đã giảm → tăng lại phải đủ quy trình, mọi đường tăng chung một cổng
            if ly: raise ValueError(ly)
            ly = CONG.kiem("tang", cid, ns, float(truoc["ns"] or 0))
            if ly: raise ValueError(ly)
            api("/api/v1/campaigns/update", {"campaign": {"campaign_id": cid, "source_payload": {"daily_budget": ns}}})
            ok = lambda s: float(s["ns"] or 0) == ns
        elif viec == "giam":   # luật GB giảm bậc — chỉ xuống trên thang, tối thiểu $1, cách lần đổi trước ≥ 6 giờ (nhip_tang.py)
            ns = int(a[2])
            if ns not in MUC | {1}: raise ValueError(f"${ns} không phải mức hợp lệ")
            if truoc["tt"] != "ACTIVE": raise ValueError(f"camp đang {truoc['tt']}, không giảm")
            if ns >= float(truoc["ns"] or 0): raise ValueError(f"camp đang ${truoc['ns']} ≤ ${ns}, không phải giảm")
            ly = NT.chan_giam(lambda p: api(p), cid)
            if ly: raise ValueError(ly)
            api("/api/v1/campaigns/update", {"campaign": {"campaign_id": cid, "source_payload": {"daily_budget": ns}}})
            ok = lambda s: float(s["ns"] or 0) == ns
        elif viec == "tat":
            # CẤM TỰ TẮT CAMP (anh 22/10/2026: "Giờ cấm mày tự đóng camp. Phải xin phép") — chỉ chạy khi người duyệt là anh:
            # "anh (nút Telegram)" (Phòng Ethopex truyền khi anh bấm nút) hoặc "anh (chat)" khi anh lệnh đích danh camp đó trong chat. Claude / máy → từ chối.
            if not ((ai or "").strip().lower().startswith("anh") or "(nút telegram)" in (ai or "").lower()): raise ValueError("cấm tự tắt camp — phải có anh duyệt (nút Telegram / lệnh đích danh trong chat)")
            if not (luat or "").strip() or luat.startswith("("): raise ValueError("tắt camp phải ghi rõ luật nào (--luat)")
            if truoc["tt"] != "ACTIVE":
                # camp đang tạm dừng vì LỊCH GIỜ (apps/etp/lich-gio.py): tắt = bỏ khỏi sổ lịch → máy không bật lại nữa (camp đã PAUSED sẵn)
                if q(f"delete from etp.lich_tat where camp_id = {cid} returning camp_id"):
                    kq.update(ok=True, sau=truoc, loi=None, lich="bỏ khỏi lịch giờ — không tự bật lại"); ghi_nhat_ky(kq, luat, ai); print(json.dumps(kq, ensure_ascii=False)); return
                raise ValueError(f"camp đã {truoc['tt']}")
            # CHẶN TẮT CAMP LÃI (anh 22/10/2026: "luật vẫn là luật. Camp nào lãi hơn 20% thì bật lại" — con tắt nhầm #66052/#66055/#65714 vì phân loại
            # theo số chụp lúc 09:50, doanh thu về trễ). Đọc ROI cộng dồn MỚI NHẤT ngay lúc tắt; > 20% thì từ chối, trừ --ep (anh lệnh đích danh).
            lai = None if ep else dang_lai(cid, t7=(luat or "").startswith("T7"))
            if lai: raise ValueError(f"không tắt: {lai}")
            r = api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [cid], "status": "paused"}])
            d0 = (r.get("data") or [{}])[0]
            if d0 and d0.get("ok") is False: raise ValueError(d0.get("error") or "Ethopex từ chối tắt")
            ok = lambda s: s["tt"] == "PAUSED"
        elif viec == "bat":   # bật lại camp đã tắt — chỉ khi anh lệnh (vd 22/10/2026 "camp nào lãi hơn 20% thì bật lại")
            if truoc["tt"] == "ACTIVE": raise ValueError("camp đã ACTIVE")
            # camp đang tạm dừng vì LỊCH GIỜ (etp.lich_tat): không bật giữa khung TẮT — apps/etp/lich-gio.py tự bật khi tới khung BẬT (≤ 10 phút sau mốc)
            if q(f"select 1 from etp.lich_tat where camp_id = {cid}"):
                kq.update(ok=True, sau=truoc, loi=None, lich="đang tạm dừng theo lịch giờ — lịch tự bật lại khi tới khung BẬT"); ghi_nhat_ky(kq, luat, ai); print(json.dumps(kq, ensure_ascii=False)); return
            # TẮT QUÁ 24 GIỜ THÌ KHÔNG BAO GIỜ BẬT LẠI (anh 26/10/2026) — mọi đường bật đi qua đây (nút anh, máy thay creative bị từ chối…)
            tg = None if cid in CONG.camp_roas() else tat_bao_lau(cid)   # camp ROAS miễn luật 24 giờ (anh 26/10/2026: dạng riêng, review tay rồi bật)
            if tg is not None and tg > 24: raise ValueError(f"camp đã tắt {tg:.0f} giờ (> 24 giờ) — luật: tắt quá 24 giờ không bao giờ bật lại")
            ly = CONG.kiem("bat", cid, float(truoc["ns"] or 0), 0)
            if ly: raise ValueError(ly)
            r = api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [cid], "status": "active"}])
            d0 = (r.get("data") or [{}])[0]
            if d0 and d0.get("ok") is False: raise ValueError(d0.get("error") or "Ethopex từ chối bật")
            ok = lambda s: s["tt"] == "ACTIVE"
        else:
            raise ValueError("việc không hợp lệ (tang / giam / tat / bat)")
        for _ in range(12):   # Ethopex ghi rồi mới đồng bộ Facebook — đọc lại tới ~60s (21/10/2026: 7/15 camp sau 18s chưa thấy, 20s sau mới đổi)
            time.sleep(5); sau = doc(cid)
            if ok(sau): break
        kq.update(sau=sau, ok=ok(sau)); kq["loi"] = None if kq["ok"] else "đã gửi nhưng đọc lại chưa thấy đổi — kiểm tab Ethopex"
    except Exception as e:
        kq["loi"] = str(e)[:200]
    ghi_nhat_ky(kq, luat, ai)
    print(json.dumps(kq, ensure_ascii=False))

def ghi_nhat_ky(kq, luat, ai):
    """NHẬT KÝ LUẬT (anh 21/10/2026: "khi tăng phải log rule cho việc tăng đó"): mỗi lệnh tăng / tắt ghi một dòng vào studio
    xv_khoa_ngoai['ethopex_nhat_ky'] (giữ 1000 dòng gần nhất): lúc (giờ VN) · việc · camp · trước → sau · ok · LUẬT kích hoạt kèm số · ai duyệt."""
    import datetime as dt
    dong = {"luc": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y"), "viec": kq.get("viec"), "id": kq.get("id"),
            "truoc": (kq.get("truoc") or {}).get("ns"), "sau": (kq.get("sau") or {}).get("ns"), "ok": kq.get("ok"), "loi": kq.get("loi"), "luat": luat or "(không ghi luật)", "ai": ai or "?"}
    v = json.dumps(dong, ensure_ascii=False).replace("'", "''")
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_nhat_ky', '[]'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(gia_tri || jsonb_build_array('{v}'::jsonb)) x offset greatest(jsonb_array_length(gia_tri) + 1 - 1000, 0)) t) where ten = 'ethopex_nhat_ky'")

if __name__ == "__main__":
    main(sys.argv[1:])
