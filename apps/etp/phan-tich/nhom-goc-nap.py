#!/usr/bin/env python3
"""NẠP NHÓM GỐC PHIM vào etp.phim.nhom_goc từ apps/etp/phan-tich/nhom-goc-phim.json (chấm bằng mắt trên lưới poster — luoi-poster.py). Chạy trên box3:
  cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 apps/etp/phan-tich/nhom-goc-nap.py"""
import json, os, subprocess
D = os.path.dirname(os.path.abspath(__file__))
NHOM = {"au_my", "trung", "an", "latin", "dong_a", "da_mau", "hoat_hinh"}
ds = json.load(open(os.path.join(D, "nhom-goc-phim.json")))["phim"]
sai = [k for k, v in ds.items() if v["nhom"] not in NHOM]
if sai: raise SystemExit(f"nhóm lạ ở {sai[:5]}")
j = json.dumps([{"id": int(k), "nhom": v["nhom"]} for k, v in ds.items()])
r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", f"update etp.phim p set nhom_goc = x.nhom from jsonb_to_recordset($J${j}$J$::jsonb) as x(id int, nhom text) where p.content_id = x.id and p.nhom_goc is distinct from x.nhom"], capture_output=True, text=True, check=True)
print(f"{len(ds)} phim trong tệp · {r.stdout.strip()}")
