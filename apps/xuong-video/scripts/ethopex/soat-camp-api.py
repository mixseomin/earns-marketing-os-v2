#!/usr/bin/env python3
"""SOÁT TOÀN BỘ CAMP ETHOPEX QUA API (anh 20/10/2026: "mở ra xem chi tiết xem có lên camp sai sót gì ko thì fix").
Chạy trên box3 (khoá đọc từ xv_khoa_ngoai, không in): đối chiếu từng camp với khuôn + studio:
tài khoản · Page · pixel · ngân sách · content camp = content của creative trong studio · ngôn ngữ tên camp = studio = locale nhắm · lỗi đồng bộ / video.
  cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 apps/xuong-video/scripts/ethopex/soat-camp-api.py"""
import json, os, re, subprocess, urllib.request
DB = os.environ["DATABASE_URL"]
q = lambda s: subprocess.run(["psql", DB, "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
def api(p):
    r = urllib.request.Request("https://api.ethopex.dev" + p, headers={"authorization": "Bearer " + T, "user-agent": "mos2-soat"})
    return json.load(urllib.request.urlopen(r, timeout=30))
studio = {}
for l in q("select (kinh_thanh->'ethopex'->>'creative_id'), kinh_thanh->'ethopex'->>'content_id', kinh_thanh->>'ngon_ngu', id from xv_phim where project='ethopex' and kinh_thanh->'ethopex' ? 'creative_id'").splitlines():
    cr, ct, nn, pid = l.split("|"); studio[int(cr)] = (int(ct) if ct else None, nn, int(pid))
NGAN_SACH_DUYET = {65176: 3}  # camp anh đã duyệt tăng
ds = api("/api/v1/campaigns?page_size=500")["data"]
loi_tong = 0; content_lp = {}; duyet = {}; bi_tu_choi = []   # content → creative đã được Meta duyệt (để gợi ý thay ad bị từ chối)
for c in sorted(ds, key=lambda x: x["id"]):
    d = api(f"/api/v1/campaigns/{c['id']}"); cp = d["campaign"]; g = (d.get("ad_groups") or [{}])[0]; a = (g.get("ads") or [{}])[0]
    loi = []
    if cp.get("ad_account_id") != 11183179: loi.append(f"tài khoản {cp.get('ad_account_id')}")
    if str(a.get("facebook_page_id")) != "1295495": loi.append(f"Page {a.get('facebook_page_id')}")
    if not any(m.get("status") == "active" for m in d.get("pixel_mappings") or []): loi.append("không có pixel")
    ns = cp.get("budget_daily"); muon = NGAN_SACH_DUYET.get(cp["id"], 1)
    if ns != muon: loi.append(f"ngân sách ${ns} (phải ${muon})")
    for k, v in (("camp", cp), ("adset", g), ("ad", a)):
        if v.get("error"): loi.append(f"lỗi {k}: {str(v['error'])[:80]}")
    if a.get("media_status") != "done": loi.append(f"video {a.get('media_status')}")
    ten = cp.get("name", ""); m = re.search(r"\b(EN|ES|DE|FR|PT)\b", ten); nn_ten = m.group(1).lower() if m else None
    sp = (g.get("source_payload") or "")
    try: tg = (json.loads(sp) if isinstance(sp, str) else sp).get("targeting", {})
    except Exception: tg = {}
    loc = tg.get("locales") or []
    LOC = {"en": {6, 24, 1001}, "es": {23, 7, 1002}}
    if nn_ten in LOC and loc and not set(loc) <= LOC[nn_ten]: loi.append(f"locale nhắm {loc} lệch tên {nn_ten}")
    if nn_ten in LOC and not loc: loi.append("không nhắm locale")
    nuoc = len(((tg.get("geo_locations") or {}).get("countries")) or [])
    if nuoc != 39: loi.append(f"{nuoc} nước (phải 39)")
    cr = a.get("creative_id"); st = studio.get(cr)
    if not st: loi.append(f"creative {cr} chưa có trong studio")
    else:
        if st[0] != a.get("content_id"): loi.append(f"content camp {a.get('content_id')} ≠ studio {st[0]} (phim #{st[2]})")
        if nn_ten and st[1] and st[1] != nn_ten: loi.append(f"ngôn ngữ studio {st[1]} ≠ tên {nn_ten}")
    slug = re.search(r"/movie/([^/]+)/", a.get("final_url") or ""); slug = slug.group(1) if slug else None
    content_lp.setdefault(a.get("content_id"), set()).add((slug, a.get("landing_page_id")))
    trang = f"{cp.get('source_status')}/{a.get('delivery_status') or g.get('delivery_status') or '-'}"
    if "DISAPPROVED" in str(a.get("error") or "") or a.get("delivery_status") == "DISAPPROVED": bi_tu_choi.append((cp["id"], a.get("content_id"), cr))
    elif a.get("delivery_status") in ("ACTIVE", "ADSET_PAUSED", "CAMPAIGN_PAUSED") and not a.get("error"): duyet.setdefault(a.get("content_id"), []).append((cr, cp["id"]))
    print(("❌ " if loi else "✅ ") + f"#{cp['id']} {ten[:58]:58} ct{a.get('content_id')} cr{cr} ${ns} {trang}" + ("".join("\n     - " + x for x in loi)))
    loi_tong += bool(loi)
for ct, s in content_lp.items():
    if len({x[0] for x in s}) > 1: print(f"❌ content {ct} dùng nhiều link phim khác nhau: {s}"); loi_tong += 1
# AD BỊ META TỪ CHỐI (Dol Dang 21/10/2026): KHÔNG xoá — vào Edit camp, thay bằng creative SẠCH cùng phim đã được duyệt, Update để Meta duyệt lại.
# Trước khi thay: kiem-thoai-creative.sh <creative> phải OK.
for camp, ct, cr in bi_tu_choi:
    goi_y = [f"#{c} (camp #{k})" for c, k in duyet.get(ct, []) if c != cr][:4]
    print(f"⚠ #{camp} bị Meta từ chối (creative {cr}) → Edit camp, thay creative sạch đã duyệt cùng phim: " + (", ".join(goi_y) or "chưa có — dựng creative mới qua cổng thoại"))
print(f"\n{len(ds)} camp · {loi_tong} chỗ lỗi")
