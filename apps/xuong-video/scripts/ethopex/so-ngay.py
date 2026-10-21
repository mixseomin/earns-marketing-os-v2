#!/usr/bin/env python3
"""TIỀN THẬT MỖI NGÀY (anh 22/10/2026: "mỗi ngày thực sự kiếm được bao nhiêu tiền mới… báo cáo định kỳ qua tele và show trên mos2 chart realtime").
Hai góc, vì doanh thu của một click còn về thêm nhiều ngày sau (ghi nhận tới 7 ngày):
  (1) THEO NGÀY QUẢNG CÁO — Report Ethopex group_by date: chi / thu của các click trong ngày đó (vài ngày gần nhất còn tăng).
  (2) TIỀN MỚI VÀO — mỗi nhịp chụp TỔNG CỘNG DỒN chi / thu từ trước tới nay (studio xv_khoa_ngoai['ethopex_so_luy']); tiền mới của ngày D (giờ VN)
      = tổng cuối ngày D − tổng cuối ngày D−1 → đúng số tiền thật vào / ra trong ngày, kể cả doanh thu về trễ của click cũ.
Chạy trên box3 (khoá ở studio):
  python3 so-ngay.py --chup     → chụp một điểm cộng dồn (Phòng Ethopex gọi mỗi nhịp 30 phút)
  python3 so-ngay.py --json     → {luc, theo_ngay:[{ngay, chi, thu, lai, roi}], tien_moi:[{ngay, chi, thu, lai, du}], hom_nay:{…}}"""
import datetime as dt, json, os, subprocess, sys, urllib.request

q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
BAT_DAU = "2026-10-19"   # ngày lên camp đầu tiên của dự án
vn = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)

def bc(body):
    body = {"filters": {}, "metric_conditions": [], "limit": 1000, "page": 1, "page_size": 1000, **body}
    r = urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=json.dumps(body).encode(), method="POST",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-so-ngay"})
    return json.load(urllib.request.urlopen(r, timeout=60)).get("rows", [])

def theo_ngay():
    ra = []
    for x in bc({"columns": ["date", "cost", "revenue"], "group_by": ["date"], "date_from": BAT_DAU, "date_to": vn.date().isoformat()}):
        chi, thu = float(x.get("cost") or 0), float(x.get("revenue") or 0)
        ra.append({"ngay": str(x.get("report_date"))[:10], "chi": round(chi, 2), "thu": round(thu, 2), "lai": round(thu - chi, 2), "roi": round((thu - chi) / chi * 100, 1) if chi else None})
    return sorted(ra, key=lambda r: r["ngay"])

def chup():
    ds = theo_ngay(); chi, thu = sum(r["chi"] for r in ds), sum(r["thu"] for r in ds)
    v = json.dumps({"luc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "chi": round(chi, 2), "thu": round(thu, 2)}).replace("'", "''")
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_so_luy', '[]'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(gia_tri || jsonb_build_array('{v}'::jsonb)) x offset greatest(jsonb_array_length(gia_tri) + 1 - 4000, 0)) t) where ten = 'ethopex_so_luy'")
    return {"chi": round(chi, 2), "thu": round(thu, 2)}

def tien_moi():
    """mỗi ngày VN: điểm chụp CUỐI ngày − điểm chụp cuối ngày trước (ngày đầu tiên có số = từ điểm chụp đầu tiên). du=False khi ngày chưa trọn."""
    ds = json.loads(q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_so_luy'") or "[]")
    cuoi = {}
    for p in ds:
        ngay = (dt.datetime.fromisoformat(p["luc"]) + dt.timedelta(hours=7)).date().isoformat()
        cuoi.setdefault(ngay, {"dau": p}); cuoi[ngay]["cuoi"] = p
    ra, truoc = [], None
    for ngay in sorted(cuoi):
        a = truoc or cuoi[ngay]["dau"]; b = cuoi[ngay]["cuoi"]
        chi, thu = b["chi"] - a["chi"], b["thu"] - a["thu"]
        ra.append({"ngay": ngay, "chi": round(chi, 2), "thu": round(thu, 2), "lai": round(thu - chi, 2), "du": truoc is not None and ngay < vn.date().isoformat()})
        truoc = b
    return ra

if __name__ == "__main__":
    if "--chup" in sys.argv: print(json.dumps(chup())); sys.exit(0)
    tn = theo_ngay(); tm = tien_moi()
    print(json.dumps({"luc": f"{vn:%H:%M %d/%m}", "theo_ngay": tn, "tien_moi": tm,
                      "thang": {"chi": round(sum(r["chi"] for r in tn if r["ngay"][:7] == vn.date().isoformat()[:7]), 2), "thu": round(sum(r["thu"] for r in tn if r["ngay"][:7] == vn.date().isoformat()[:7]), 2)}}, ensure_ascii=False))
