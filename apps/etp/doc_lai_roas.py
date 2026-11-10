#!/usr/bin/env python3
"""ĐỌC LẠI CAMP ROAS VỪA TẠO (anh 10/11/2026 "lỗi này thì ai phụ trách xử lý?" — 4 camp ROAS #72910 chờ đồng bộ quá 20 phút, nhan-ban báo "kiểm tay" rồi bỏ đó;
sau đó Meta từ chối cả 4 "Spam", không ai biết). Máy là người phụ trách: nhan-ban.py --roas hết 20 phút mà chưa xong → ghi sổ xv_khoa_ngoai 'ethopex_roas_cho_doc'
{camp_moi: {goc, roas, ns, luc}}; worker (apps/cty/worker/ethopex.mjs) gọi tệp này MỖI NHỊP:
  · đồng bộ xong, không lỗi, đúng bid LOWEST_COST_WITH_MIN_ROAS + sàn ROAS + ngân sách → ✅ xong, bỏ khỏi sổ
  · Meta / Ethopex từ chối (DISAPPROVED / error) → camp ở trạng thái dừng (đảm bảo PAUSED), ghi BÀI ĐĂNG của gốc vào sổ 'ethopex_bai_roas_tu_choi'
    (máy luật không lên ROAS lại từ bài đó), báo một dòng có lý do Meta
  · sai bid / sàn → tạm dừng camp, báo
  · còn đang đồng bộ: < 3 giờ chờ tiếp (không báo), ≥ 3 giờ báo một lần
In mỗi kết quả một dòng JSON {camp, goc, viec: xong|tu_choi|sai|cho|qua_lau, chu}."""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ethopex_api as EA
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
SO, BAI = "ethopex_roas_cho_doc", "ethopex_bai_roas_tu_choi"
def doc(k): return json.loads(q(f"select coalesce((select gia_tri::text from xv_khoa_ngoai where ten = '{k}'), '{{}}')") or "{}")
def ghi(k, v):
    j = json.dumps(v, ensure_ascii=False).replace("'", "''")
    q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('{k}', '{j}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
js = lambda x: json.loads(x) if isinstance(x, str) and x else (x or {})
def main():
    so, bai, ra = doc(SO), doc(BAI), []
    for moi, v in list(so.items()):
        try: d = EA.api(f"/api/v1/campaigns/{int(moi)}")
        except Exception as e: ra.append({"camp": int(moi), "goc": v.get("goc"), "viec": "cho", "chu": f"chưa đọc được: {str(e)[:80]}"}); continue
        c, g = d["campaign"], (d.get("ad_groups") or [{}])[0]; a = (g.get("ads") or [{}])[0]
        loi = c.get("error") or a.get("error") or ""
        tu_choi = "DISAPPROVED" in str(loi).upper() or a.get("delivery_status") == "DISAPPROVED"
        if tu_choi or (c.get("sync_status") == "error"):
            if c.get("state") != "PAUSED":
                try: EA.api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [int(moi)], "status": "paused"}])
                except Exception: pass
            sid = a.get("effective_object_story_id") or v.get("bai")
            if sid: bai[str(v.get("goc"))] = {"bai": sid, "ly_do": str(loi)[:300], "luc": time.strftime("%H:%M %d/%m")}
            ra.append({"camp": int(moi), "goc": v.get("goc"), "viec": "tu_choi", "chu": f"Meta / Ethopex từ chối camp ROAS {v.get('roas')} — camp đã dừng, không tốn tiền; máy không lên ROAS lại từ bài đăng này · lý do: {str(loi)[:160]}"})
            so.pop(moi); continue
        if c.get("sync_status") != "done":
            gio = (time.time() - float(v.get("luc_s") or time.time())) / 3600
            if gio >= 3 and not v.get("bao"): v["bao"] = 1; ra.append({"camp": int(moi), "goc": v.get("goc"), "viec": "qua_lau", "chu": f"camp ROAS chờ đồng bộ {gio:.0f} giờ ({c.get('sync_status')}) — máy vẫn đọc lại mỗi nhịp"})
            else: ra.append({"camp": int(moi), "goc": v.get("goc"), "viec": "cho", "chu": c.get("sync_status") or "?"})
            continue
        sg = js(g.get("source_payload")); san = (sg.get("bid_constraints") or {}).get("roas_average_floor")
        san = float(san) / 10000 if san is not None and float(san) > 100 else (float(san) if san is not None else None)
        sai = c.get("source_bidding_strategy") not in (None, "", "LOWEST_COST_WITH_MIN_ROAS") or san is None or abs(san - float(v.get("roas") or 0)) > 1e-6
        if sai:
            try: EA.api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [int(moi)], "status": "paused"}])
            except Exception: pass
            ra.append({"camp": int(moi), "goc": v.get("goc"), "viec": "sai", "chu": f"đọc lại sai ROAS (đặt {v.get('roas')}, Ethopex {san}, chiến lược {c.get('source_bidding_strategy')}) — đã tạm dừng"})
        else: ra.append({"camp": int(moi), "goc": v.get("goc"), "viec": "xong", "chu": f"đồng bộ xong · ROAS {san:g} · ${c.get('budget_daily')}/ngày · {c.get('state')}"})
        so.pop(moi)
    ghi(SO, so); ghi(BAI, bai)
    for x in ra: print(json.dumps(x, ensure_ascii=False))
if __name__ == "__main__": main()
