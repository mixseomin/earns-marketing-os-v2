#!/usr/bin/env python3
"""LÀM THEO LỆNH ANH DUYỆT (nút Telegram phòng Ethopex, anh 21/10/2026: "tao có thể duyệt trên đó luôn"). Chạy trên box3 (khoá ở studio xv_khoa_ngoai).
Chỉ hai việc, đúng API giao diện Ethopex dùng (đọc từ mã app 21/10/2026):
  tang <camp_id> <ngân sách>   → POST /api/v1/campaigns/update {campaign:{campaign_id, source_payload:{daily_budget}}}
  tat  <camp_id>               → POST /api/v1/campaigns/control/batch/bulk [{entity_type:'campaign', entity_ids:[id], status:'paused'}]
Chặn: ngân sách phải là mức hợp lệ ($2 · thang $3–20), lớn hơn mức đang chạy, không quá trần $20; camp phải đang ACTIVE; nhịp tăng (nhip_tang.py: ≥ 3 giờ giữa hai lần). Làm xong ĐỌC LẠI camp để xác nhận.
In một dòng JSON {ok, viec, id, truoc, sau, loi}."""
import json, os, subprocess, sys, time, urllib.request, importlib.util
_s = importlib.util.spec_from_file_location("nhip_tang", os.path.join(os.path.dirname(os.path.abspath(__file__)), "nhip_tang.py")); NT = importlib.util.module_from_spec(_s); _s.loader.exec_module(NT)

MUC = {2, 3, 5, 7, 10, 15, 20}
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")

def api(duong, body=None):
    r = urllib.request.Request("https://api.ethopex.dev" + duong, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ethopex"})
    return json.load(urllib.request.urlopen(r, timeout=40))

def doc(cid):
    c = api(f"/api/v1/campaigns/{cid}")["campaign"]
    return {"ns": c.get("budget_daily"), "tt": c.get("state")}

def main(a):
    # --luat "<mã luật · số liệu>" (BẮT BUỘC ghi khi tăng — anh 21/10/2026) · --ai "<ai duyệt: anh (chat) / anh (nút Telegram)>"
    luat = next((a[i + 1] for i, x in enumerate(a[:-1]) if x == "--luat"), None); ai = next((a[i + 1] for i, x in enumerate(a[:-1]) if x == "--ai"), None)
    a = [x for i, x in enumerate(a) if x not in ("--luat", "--ai") and (i == 0 or a[i - 1] not in ("--luat", "--ai"))]
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
        elif viec == "tat":
            if truoc["tt"] != "ACTIVE": raise ValueError(f"camp đã {truoc['tt']}")
            r = api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [cid], "status": "paused"}])
            d0 = (r.get("data") or [{}])[0]
            if d0 and d0.get("ok") is False: raise ValueError(d0.get("error") or "Ethopex từ chối tắt")
            ok = lambda s: s["tt"] == "PAUSED"
        else:
            raise ValueError("việc không hợp lệ (tang / tat)")
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
