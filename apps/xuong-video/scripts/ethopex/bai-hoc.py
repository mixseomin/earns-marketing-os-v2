#!/usr/bin/env python3
"""SỔ BÀI HỌC CAMP LỖ (anh 22/10/2026: các camp lỗ tắt luôn "nhưng phải lưu lại để lần sau ko dính lại lỗi của nó").
Mỗi camp đã tắt mà lỗ (tiêu ≥ $2, ROI tháng < −20%) → một dòng: phim · dạng creative · đoạn cắt · nguồn · chi/thu/ROI · NGUYÊN NHÂN (suy từ cả nhóm:
đoạn đầu/giữa phim thua đoạn sâu, phim lỗ mọi đoạn = phim yếu, dạng creative thua ở phim đó, nguồn QC spy, CTA cũ…), ghi studio xv_khoa_ngoai['ethopex_bai_hoc'].
CHẶN (nhan-ban.py → cong → da_lo): KHÔNG lên lại cùng phim + cùng dạng + đoạn cắt trùng ≥ 50% một đoạn đã lỗ. Phim lỗ ≥ 3 camp mà chưa camp nào lãi → cảnh báo
"phim yếu" (anh cho thử góc khác không giới hạn nên chỉ báo, không chặn).
Chạy trên box3:  python3 bai-hoc.py            → dựng lại sổ + in bảng
                 python3 bai-hoc.py --kiem <content_id> "<tên camp mới>"   → in lý do chặn / cảnh báo (mã 2 khi chặn)"""
import collections, datetime as dt, json, os, re, subprocess, sys, urllib.request
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
LO_ROI, LO_CHI = -20, 2.0

def api(p, b=None):
    T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
    return json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, data=json.dumps(b).encode() if b else None, method="POST" if b else "GET",
                     headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-kiem"}), timeout=60))

def tach(ten):
    """tên camp → (dạng, tu, den): '2010 Number One Nobody EN - canh that 84-141s' → ('canh that', 84, 141)"""
    t = ten.split(": ", 1)[-1].lower()
    dang = next((d for d in ("ke chuyen", "canh cuoi", "phim dai", "canh that", "lam moi") if d in t), "khac")
    m = re.search(r"(\d+)-(\d+)s", t)
    return dang, (int(m.group(1)) if m else None), (int(m.group(2)) if m else None)

def trung(a, b, c, d):
    if None in (a, b, c, d): return a is None and c is None   # cùng không có mốc (kể chuyện / cảnh thật lô 19/10) = cùng creative
    giao = max(0, min(b, d) - max(a, c)); return giao >= 0.5 * min(b - a, d - c)

def dung():
    hn = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date()
    rows = api("/api/v1/report", {"columns": ["campaign_name", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 2000, "page": 1, "page_size": 2000,
                                  "date_from": hn.replace(day=1).isoformat(), "date_to": (hn + dt.timedelta(days=1)).isoformat()})["rows"]
    so = {r["campaign_id"]: (float(r.get("cost") or 0), float(r.get("revenue") or 0), r["campaign_name"]) for r in rows}
    camps = {c["id"]: c for c in api("/api/v1/campaigns?page_size=500")["data"]}
    phim = {}
    for cid, c in camps.items():
        try: phim[cid] = api(f"/api/v1/campaigns/{cid}")["ad_groups"][0]["ads"][0]["content_id"]
        except Exception: pass
    nhom = collections.defaultdict(list)
    for cid, (chi, thu, ten) in so.items():
        if cid in phim and chi >= LO_CHI: nhom[phim[cid]].append((cid, chi, thu, ten, camps.get(cid, {}).get("state")))
    out = []
    for p, ds in nhom.items():
        lai = [x for x in ds if x[2] > x[1]]; lo = [x for x in ds if (x[2] - x[1]) / x[1] * 100 < LO_ROI]
        for cid, chi, thu, ten, st in ds:
            r = (thu - chi) / chi * 100
            if st == "ACTIVE" or r >= LO_ROI: continue
            dang, tu, den = tach(ten); ly = []
            if not lai and len(lo) >= 3: ly.append(f"phim yếu: {len(lo)} camp lỗ, chưa camp nào lãi")
            win_sau = [x for x in lai if tach(x[3])[1] is not None and tu is not None and tach(x[3])[1] > tu + 120]
            if win_sau: ly.append(f"đoạn đầu/giữa ({tu}s) thua đoạn sâu hơn đang lãi (#{win_sau[0][0]} {tach(win_sau[0][3])[1]}s)")
            cung = [x for x in lai if tach(x[3])[0] != dang]
            if cung: ly.append(f"dạng '{dang}' thua dạng '{tach(cung[0][3])[0]}' ở cùng phim")
            if re.search(r"^\d+: (1910|2010|2110) ", ten) and dang == "canh that": ly.append("cắt từ video QC spy (lớp phủ app gốc) — nay cấm nguồn này")
            if dang == "phim dai": ly.append("đoạn dài 2–3' từ đầu tập 1 — mở chậm")
            ly.append("CTA cũ (Tap + mũi tên)") if not re.search(r"cta\d", ten) else None
            out.append({"camp": cid, "content_id": p, "ten": ten.split(": ", 1)[-1], "dang": dang, "tu": tu, "den": den, "chi": round(chi, 2), "thu": round(thu, 2),
                        "roi": round(r), "nguyen_nhan": ly or ["chưa rõ — đoạn cắt không giữ chân"], "luc": f"{hn}"})
    v = json.dumps(out, ensure_ascii=False).replace("'", "''")
    q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_bai_hoc', '{v}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
    return out

def da_lo(content_id, ten_moi):
    """→ (chặn | None, cảnh báo | None) cho camp mới"""
    bh = json.loads(q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_bai_hoc'") or "[]")
    dang, tu, den = tach(ten_moi)
    cua = [b for b in bh if int(b["content_id"]) == int(content_id)]
    for b in cua:
        if b["dang"] == dang and trung(tu, den, b["tu"], b["den"]):
            return (f"đoạn này đã lỗ: #{b['camp']} {b['ten'][:60]} (chi ${b['chi']}, ROI {b['roi']}%) — {'; '.join(b['nguyen_nhan'])}", None)
    yeu = next((b for b in cua if any(n.startswith("phim yếu") for n in b["nguyen_nhan"])), None)
    return (None, f"cảnh báo: {yeu['nguyen_nhan'][0]}" if yeu else None)

if __name__ == "__main__":
    if "--kiem" in sys.argv:
        i = sys.argv.index("--kiem"); c, w = da_lo(sys.argv[i + 1], sys.argv[i + 2])
        print(f"BAI HOC CHAN: {c}" if c else (w or "BAI HOC OK")); sys.exit(2 if c else 0)
    ds = dung()
    print(f"sổ bài học: {len(ds)} camp lỗ")
    for b in sorted(ds, key=lambda b: b["roi"]): print(f"#{b['camp']} {b['roi']:+d}% chi ${b['chi']} · {b['ten'][:55]} · {'; '.join(b['nguyen_nhan'])}")
