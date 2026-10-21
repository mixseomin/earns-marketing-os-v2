#!/usr/bin/env python3
"""LÀM THEO LỆNH ANH DUYỆT (nút Telegram phòng Ethopex, anh 21/10/2026: "tao có thể duyệt trên đó luôn"). Chạy trên box3 (khoá ở studio xv_khoa_ngoai).
Chỉ hai việc, đúng API giao diện Ethopex dùng (đọc từ mã app 21/10/2026):
  tang <camp_id> <ngân sách>   → POST /api/v1/campaigns/update {campaign:{campaign_id, source_payload:{daily_budget}}}
  tat  <camp_id>               → POST /api/v1/campaigns/control/batch/bulk [{entity_type:'campaign', entity_ids:[id], status:'paused'}]
Chặn: ngân sách phải là mức hợp lệ ($2 · thang $3–20), lớn hơn mức đang chạy, không quá trần $20; camp phải đang ACTIVE; nhịp tăng (nhip_tang.py: ≥ 3 giờ giữa hai lần, ≤ 2 lần/ngày). Làm xong ĐỌC LẠI camp để xác nhận.
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
    viec, cid = a[0], int(a[1]); kq = {"ok": False, "viec": viec, "id": cid}
    try:
        truoc = doc(cid); kq["truoc"] = truoc
        if viec == "tang":
            ns = int(a[2])
            if ns not in MUC: raise ValueError(f"${ns} không phải mức hợp lệ {sorted(MUC)}")
            if truoc["tt"] != "ACTIVE": raise ValueError(f"camp đang {truoc['tt']}, không tăng")
            if ns <= float(truoc["ns"] or 0): raise ValueError(f"camp đã ${truoc['ns']} ≥ ${ns}")
            ly = NT.chan_tang(lambda p: api(p), cid)   # nhịp tăng: ≥ 3 giờ giữa hai lần, ≤ 2 lần/ngày (nút cũ bấm muộn cũng bị chặn)
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
        for _ in range(6):   # Ethopex ghi rồi mới đồng bộ Facebook — đọc lại vài lần
            time.sleep(3); sau = doc(cid)
            if ok(sau): break
        kq.update(sau=sau, ok=ok(sau)); kq["loi"] = None if kq["ok"] else "đã gửi nhưng đọc lại chưa thấy đổi — kiểm tab Ethopex"
    except Exception as e:
        kq["loi"] = str(e)[:200]
    print(json.dumps(kq, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1:])
