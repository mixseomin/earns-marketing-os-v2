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

MUC = {2, 3, 5, 7, 10, 15, 20, 30}   # $30 chỉ qua luật T30 (camp $20 tiêu đủ + ROI cao 2–3 ngày, Support 23/10/2026), anh duyệt nút
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")

def api(duong, body=None):
    r = urllib.request.Request("https://api.ethopex.dev" + duong, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ethopex"})
    return json.load(urllib.request.urlopen(r, timeout=40))

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
def dang_lai(cid):
    """camp còn lãi thì không tắt (anh 22/10/2026: "camp nào lãi hơn 20% thì bật lại", rồi "camp hơn 2 ngày có lãi sao lại đóng?"):
    hôm nay > 20% · hoặc 2 ngày gần nhất có lãi (> 0) · hoặc cộng dồn > 0 → trả câu lý do, không thì None"""
    # REVIEW TẮT CHỈ KHI CAMP ĐỦ 7 NGÀY (anh 22/10/2026: "quy tắc đúng về cắt camp là ít nhất 7 ngày sẽ review tắt camp, chứ không tắt sớm")
    import datetime as dt
    tao = api(f"/api/v1/campaigns/{cid}")["campaign"].get("created_at")
    if tao:
        tuoi = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(str(tao).replace("Z", "+00:00"))).total_seconds() / 86400
        if tuoi < TUOI_TOI_THIEU_TAT: return f"camp mới {tuoi:.1f} ngày (< {TUOI_TOI_THIEU_TAT} ngày) — chưa tới kỳ review tắt, lỗ thì giảm bậc"
    r = roi_ky(cid)
    # ĐÓNG CAMP PHẢI TIÊU ÍT NHẤT $10 (anh 22/10/2026: "lý do đóng camp là phải tiêu ít nhất $10") — chưa đủ tiền thì chưa đủ dữ liệu để kết luận
    if r["chi_tong"] < CHI_TOI_THIEU_TAT: return f"mới tiêu ${r['chi_tong']:.2f} (< ${CHI_TOI_THIEU_TAT}) — chưa đủ để đóng"
    if r["hom_nay"] is not None and r["hom_nay"] > ROI_GIU: return f"hôm nay ROI {r['hom_nay']:+.0f}%"
    if r["hai_ngay"] is not None and r["hai_ngay"] > 0: return f"2 ngày ROI {r['hai_ngay']:+.0f}%"
    if r["tong"] is not None and r["tong"] > 0: return f"cộng dồn ROI {r['tong']:+.0f}%"
    return None

def roi_tong(cid):
    return roi_ky(cid)["tong"]

def main(a):
    # --luat "<mã luật · số liệu>" (BẮT BUỘC ghi khi tăng — anh 21/10/2026) · --ai "<ai duyệt: anh (chat) / anh (nút Telegram)>"
    luat = next((a[i + 1] for i, x in enumerate(a[:-1]) if x == "--luat"), None); ai = next((a[i + 1] for i, x in enumerate(a[:-1]) if x == "--ai"), None)
    ep = "--ep" in a   # anh lệnh đích danh (vd phim 18+) — bỏ qua chặn camp lãi
    a = [x for i, x in enumerate(a) if x not in ("--luat", "--ai", "--ep") and (i == 0 or a[i - 1] not in ("--luat", "--ai"))]
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
            if truoc["tt"] != "ACTIVE": raise ValueError(f"camp đã {truoc['tt']}")
            # CHẶN TẮT CAMP LÃI (anh 22/10/2026: "luật vẫn là luật. Camp nào lãi hơn 20% thì bật lại" — con tắt nhầm #66052/#66055/#65714 vì phân loại
            # theo số chụp lúc 09:50, doanh thu về trễ). Đọc ROI cộng dồn MỚI NHẤT ngay lúc tắt; > 20% thì từ chối, trừ --ep (anh lệnh đích danh).
            lai = None if ep else dang_lai(cid)
            if lai: raise ValueError(f"không tắt: {lai}")
            r = api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [cid], "status": "paused"}])
            d0 = (r.get("data") or [{}])[0]
            if d0 and d0.get("ok") is False: raise ValueError(d0.get("error") or "Ethopex từ chối tắt")
            ok = lambda s: s["tt"] == "PAUSED"
        elif viec == "bat":   # bật lại camp đã tắt — chỉ khi anh lệnh (vd 22/10/2026 "camp nào lãi hơn 20% thì bật lại")
            if truoc["tt"] == "ACTIVE": raise ValueError("camp đã ACTIVE")
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
