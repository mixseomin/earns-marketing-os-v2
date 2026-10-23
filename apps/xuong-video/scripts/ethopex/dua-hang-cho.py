#!/usr/bin/env python3
"""ĐƯA DANH SÁCH 200 PHIM MỚI (studio xv_khoa_ngoai['ethopex_200_phim'], chon-phim-moi.py) VÀO HÀNG CHỜ để anh xem ở mos2 › Ethopex › Hàng chờ.
Chỉ GHÉP THÊM phim chưa có, giữ nguyên mục cũ của hàng chờ. Chạy trên box3: python3 dua-hang-cho.py"""
import json, os, re, subprocess
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
ds = json.loads(q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_200_phim'") or "[]")
hc = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_hang_cho'") or "{}")
phim = hc.get("phim", []); co = {str(p.get("id")) for p in phim}; them = 0
for n, x in enumerate(ds, 1):
    if str(x["id"]) in co: continue
    m = re.search(r"(\d+) QC đang chạy · (\d+) Page · (\d+) QC", x.get("vi_sao") or "")
    vi = x.get("vi_sao") or ""
    phim.append({"id": int(x["id"]), "nguon": x.get("nguon") or "", "locale": x.get("locale") or "", "ten": x.get("ten") or "", "url": x.get("url") or "",
                 "so_page": int(m.group(2)) if m else 0, "so_qc": int(m.group(3)) if m else 0, "trang_thai": "cho", "ghi": f"200 phim mới 23/10 · hạng {n} · {vi}"})
    them += 1
hc["phim"] = phim
v = json.dumps(hc, ensure_ascii=False).replace("'", "''")
q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_hang_cho', '{v}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
print("thêm", them, "· tổng hàng chờ", len(phim))
