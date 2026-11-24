#!/usr/bin/env python3
"""ĐƯA MỌI CREATIVE NHÀ VỀ FORM CHỮ CỐ ĐỊNH (anh 24/11/2026: "Form đúng phải thế này !!" + "Tao cấm mày tự viết + sửa chỗ đó trong mọi phim, mọi camp").
Form = apps/etp/form-chu.json (một nguồn: chu-qc.py tạo creative mới cũng đọc tệp này).
  · đọc mọi creative trên Ethopex (GET /api/v1/creatives, đủ trang), chỉ giữ creative của CHÍNH tài khoản token (user_id trong JWT) — creative đội không đụng
  · creative lệch form → PATCH /api/v1/creatives/<id> {call_to_action, link_url, asset_spec}
  · trước khi PATCH: chữ cũ đang nằm ở etp.bai_cr (bai-qc.py đọc lúc lên) được GIỮ NGUYÊN — đó là chữ ad trên Meta đang mang; ghi etp.bai_cr.form_luc = lúc đưa về form
    → etp2 tab Thiết lập: camp tạo TRƯỚC form_luc vẫn chạy chữ cũ (Meta giữ bản creative riêng, external_creative_id), camp tạo SAU = chữ form
  · KHÔNG gắn lại creative vào ad đang có (cái gác CamThayCreative — anh 03/11/2026) — ad cũ đổi chữ chỉ khi anh lệnh riêng
Dùng (box3): python3 ap-form-chu.py            — chỉ đếm, in mẫu
             python3 ap-form-chu.py --chay     — PATCH thật"""
import concurrent.futures as cf, json, os, sys, urllib.request
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D); import ethopex_api as EA
F = json.load(open(os.path.join(D, "form-chu.json")))
CHAY = "--chay" in sys.argv

def ds_l(v):
    if isinstance(v, str):
        try: v = json.loads(v)
        except Exception: return [v] if v.strip() else []
    return [str(x).strip() for x in (v or [])] if isinstance(v, list) else []

def dung_form(c):
    a = c.get("asset_spec") or {}
    a = json.loads(a) if isinstance(a, str) and a.strip().startswith("{") else (a if isinstance(a, dict) else {})
    return (c.get("call_to_action") == F["call_to_action"] and (c.get("link_url") or "") == F["link_url"]
            and ds_l(a.get("primaryTexts")) == F["primaryTexts"] and ds_l(a.get("headlines")) == F["headlines"] and ds_l(a.get("descriptions")) == F["descriptions"])

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
