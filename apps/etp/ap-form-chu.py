#!/usr/bin/env python3
"""ĐƯA MỌI CREATIVE NHÀ VỀ FORM CHỮ CỐ ĐỊNH (anh 24/11/2026: "Form đúng phải thế này !!" + "Tao cấm mày tự viết + sửa chỗ đó trong mọi phim, mọi camp").
Form = apps/etp/form-chu.json (một nguồn: chu-qc.py tạo creative mới cũng đọc tệp này).
  · đọc mọi creative trên Ethopex (GET /api/v1/creatives, đủ trang), chỉ giữ creative của CHÍNH tài khoản token (user_id trong JWT) — creative đội không đụng
  · creative lệch form → PATCH /api/v1/creatives/<id> {call_to_action, link_url, asset_spec}
  · trước khi PATCH: chữ cũ đang nằm ở etp.bai_cr (bai-qc.py đọc lúc lên) được GIỮ NGUYÊN — đó là chữ ad trên Meta đang mang; ghi etp.bai_cr.form_luc = lúc đưa về form
    → etp2 tab Thiết lập: camp tạo TRƯỚC form_luc vẫn chạy chữ cũ (Meta giữ bản creative riêng, external_creative_id), camp tạo SAU = chữ form
  · KHÔNG gắn lại creative vào ad đang có (cái gác CamThayCreative — anh 03/11/2026) — ad cũ đổi chữ chỉ khi anh lệnh riêng
  · --ad (anh 24/11/2026 "chủ động fix luôn các camp bị lỗi này ngay để còn áp dụng luôn"): gắn lại ĐÚNG creative đó (đã về form) vào ad của camp
    → Ethopex đẩy bản creative mới lên Meta. Mỗi camp phải có vé TRỰC TIẾP việc doi_cr (cong.py --ve-truc-tiep doi_cr --camp <id> --lenh "<câu anh>");
    cửa CamThayCreative đốt vé lúc gửi. Meta duyệt lại ad + camp đang chạy mất pha học. Xong ghi etp.bai_camp.chu_form_luc.
Dùng (box3): python3 ap-form-chu.py            — chỉ đếm, in mẫu
             python3 ap-form-chu.py --chay     — PATCH thật
             python3 ap-form-chu.py --ad <camp>:<vé>[:<creative>] [<camp>:<vé> …]
             python3 ap-form-chu.py --ban-nha <creative> …   — creative của đội / bài đăng có sẵn: tạo bản nhà cùng video, chữ form (in {cũ: mới})"""
import concurrent.futures as cf, json, os, sys, urllib.request
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D); import ethopex_api as EA
F, ds_l, dung_form = EA.FORM, EA.ds_l, EA.dung_form   # một chuẩn form: ethopex_api.py (cửa CamLechForm cũng dùng)
CHAY = "--chay" in sys.argv

BODY = {"call_to_action": F["call_to_action"], "link_url": F["link_url"],
        "asset_spec": {"primaryTexts": F["primaryTexts"], "headlines": F["headlines"], "descriptions": F["descriptions"]}}

def patch(cid):
    r = urllib.request.Request(f"https://api.ethopex.dev/api/v1/creatives/{cid}", data=json.dumps(BODY).encode(), method="PATCH",
                               headers={"authorization": "Bearer " + EA.T, "content-type": "application/json", "user-agent": "etp-form-chu"})
    try:
        d = json.load(urllib.request.urlopen(r, timeout=60)); d = d.get("data", d)
        if not dung_form(d): return cid, "lệch sau PATCH"
        EA._q(f"update etp.bai_cr set form_luc = now() where creative_id = {cid} and form_luc is null")
        return cid, "ok"
    except Exception as e: return cid, str(e)[:160]

def ban_nha(cr):
    """creative của người khác (đội) / ad chạy bài đăng có sẵn: tạo BẢN NHÀ cùng phim + cùng video, chữ = form — creative gốc không đụng.
    Trả id creative mới (bulk-jobs, đợi xong)."""
    c = EA.api(f"/api/v1/creatives/{int(cr)}"); c = c.get("data", c)
    v = c.get("video_url"); v = json.loads(v) if isinstance(v, str) and v.strip().startswith("[") else (v or [])
    if c.get("creative_type") != F["creative_type"] or not v: raise RuntimeError(f"creative {cr} không phải {F['creative_type']} có video — không sao")
    it = {"name": f"{c.get('name') or cr} - form nha", "content_id": int(c["content_id"]), "creative_type": F["creative_type"], "traffic_source": "facebook",
          "status": "active", "image_url": [], "video_url": v, **{k: BODY[k] for k in ("call_to_action", "link_url", "asset_spec")}}
    j = EA.api("/api/v1/creatives/bulk-jobs", [it])   # thân là MẢNG trần (len-creative.py), bọc {"items": …} thì 400 unmarshal
    import time
    for _ in range(40):
        k = EA.api(f"/api/v1/creatives/bulk-jobs/{j['job_id']}")
        if k.get("status") not in ("pending", "processing", "running", "queued"): break
        time.sleep(10)
    moi = ((k.get("data") or [{}])[0].get("creative") or {}).get("id")
    if not moi: raise RuntimeError(f"bulk-jobs {j.get('job_id')} không trả creative: {str(k)[:200]}")
    return int(moi)

def gan_lai(camp, ve, cr_ep=None):
    """gắn lại creative (đã về form) vào ad của camp — vé trực tiếp doi_cr qua ETP_VE.
    cr_ep: creative chỉ định (bản nhà từ ban_nha / creative nhà đúng form) khi kho không có creative_id hoặc creative của ad không phải của nhà"""
    r = EA._q(f"select ad_id, coalesce(nullif(creative_id, 0), -1) from etp.camp where camp_id = {int(camp)} and ad_id is not null")
    if "|" not in r: return camp, "kho không có ad_id"
    ad, cr = (int(x) for x in r.split("|"))
    if cr_ep: cr = int(cr_ep)
    if cr <= 0: return camp, "kho không có creative_id — truyền creative: <camp>:<vé>:<creative>"
    c = EA.api(f"/api/v1/creatives/{cr}"); c = c.get("data", c)
    if not dung_form(c): return camp, f"creative {cr} chưa về form — không gắn"
    os.environ["ETP_VE"] = ve
    try: EA.api("/api/v1/campaigns/update", {"ads": [{"ad_id": ad, "creative_id": cr}]})
    except Exception as e: return camp, f"{type(e).__name__}: {str(e)[:160]}"
    finally: os.environ.pop("ETP_VE", None)
    EA._q(f"update etp.bai_camp set chu_form_luc = now() where camp_id = {int(camp)}")
    return camp, "ok"

if __name__ == "__main__" and "--ban-nha" in sys.argv:
    print(json.dumps({x: ban_nha(x) for x in sys.argv[sys.argv.index("--ban-nha") + 1:] if x.isdigit()})); sys.exit(0)

if __name__ == "__main__" and "--ad" in sys.argv:
    kq = [gan_lai(*x.split(":", 2)) for x in sys.argv[sys.argv.index("--ad") + 1:] if ":" in x]   # tuần tự: mỗi lệnh một vé trong ETP_VE
    print(json.dumps({"gan_lai": len(kq), "ok": sum(k[1] == "ok" for k in kq), "hong": [k for k in kq if k[1] != "ok"]}, ensure_ascii=False)); sys.exit(0)

if __name__ == "__main__":
    toi = (EA.jwt_tai(EA.T) or {}).get("user_id")
    if not toi: raise SystemExit("không đọc được user_id của token — dừng")
    EA._q("alter table etp.bai_cr add column if not exists form_luc timestamptz")
    tat = EA.doc_het("/api/v1/creatives?page_size=1000").get("data") or []
    nha = [c for c in tat if c.get("user_id") == toi]
    lech = [c for c in nha if not dung_form(c)]
    print(json.dumps({"tat_ca": len(tat), "nha": len(nha), "lech_form": len(lech), "chay": CHAY}, ensure_ascii=False))
    for c in lech[:3]: print(" mẫu", c["id"], c.get("call_to_action"), c.get("link_url"), str(c.get("asset_spec"))[:120])
    if CHAY and lech:
        with cf.ThreadPoolExecutor(6) as ex: kq = list(ex.map(patch, [c["id"] for c in lech]))
        hong = [k for k in kq if k[1] != "ok"]
        print(json.dumps({"da_sua": len(kq) - len(hong), "hong": len(hong), "mau_hong": hong[:5]}, ensure_ascii=False))
