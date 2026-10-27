"""Doanh thu về trễ: một ngày Ethopex (UTC) đã khép còn được cộng thêm bao nhiêu thu sau đó — đọc chuỗi ảnh chụp xv_khoa_ngoai['ethopex_do_tre'].
Chạy trên box3: psql "$DATABASE_URL" -tAc "select gia_tri::text from xv_khoa_ngoai where ten='ethopex_do_tre'" | python3 do-tre.py"""
import json, sys, datetime as dt
s = json.load(sys.stdin)
print("số ảnh chụp", len(s), s[0]["luc"][:16], "->", s[-1]["luc"][:16])
cuoi = s[-1]["ngay"]
for d in sorted(cuoi):
    if cuoi[d][1] < 50: continue
    D = dt.date.fromisoformat(d); ra = []
    for h in (2, 6, 12, 24, 48):
        moc = dt.datetime.combine(D + dt.timedelta(days=1), dt.time(), tzinfo=dt.timezone.utc) + dt.timedelta(hours=h)
        x = [a for a in s if dt.datetime.fromisoformat(a["luc"]) >= moc and d in a["ngay"]]
        ra.append(f"+{h}h {x[0]['ngay'][d][1] / cuoi[d][1] * 100:.0f}%" if x else f"+{h}h -")
    print(d, "thu cuối", round(cuoi[d][1]), "| đã về lúc khép:", " ".join(ra))
