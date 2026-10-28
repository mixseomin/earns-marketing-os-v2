#!/usr/bin/env python3
"""SỔ BỘ TÀI KHOẢN QC + FANPAGE (anh 23/10/2026): bộ 1 = ETP_440 + Andrew Rebecca Akumiah (phim đang chạy), bộ 2 = ETP_441 + Argo Love Tyrell (CHỈ phim mới).
Ghi studio xv_khoa_ngoai['ethopex_bo_tk'] và gán mọi phim đang có camp vào bộ của tài khoản camp đó (['ethopex_phim_tk']) — nhan-ban.py dùng để chặn
một phim lên hai bộ. Chạy lại an toàn (chỉ thêm phim chưa có). Chạy trên box3: python3 ghi-bo-tk.py"""
import json, os, subprocess, urllib.request
from concurrent.futures import ThreadPoolExecutor
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
BO = {"1": {"tk": 11183179, "ext": "1675072414209076", "page": 1295495, "ten": "ETP_440 · Andrew Rebecca Akumiah"},
      "2": {"tk": 11183178, "ext": "2270047060456855", "page": 1295499, "ten": "ETP_441 · Argo Love Tyrell", "chi_phim_moi": True}}
q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_bo_tk', '{json.dumps(BO, ensure_ascii=False)}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
import sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp")); import ethopex_api as EA   # cổng chung: chỉ tài khoản nhà (anh 28/10/2026)
api = lambda p: json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, headers={"authorization": "Bearer " + T, "user-agent": "mos2-bo-tk"}), timeout=90))
api = lambda p, b=None: EA.api(p, b)   # mọi lệnh Ethopex qua cổng chung apps/etp/ethopex_api.py: danh sách đủ mọi trang + chỉ camp tài khoản nhà, lệnh ghi vào camp ngoài bị chặn (anh 28/10/2026)
bo_cua = {b["tk"]: k for k, b in BO.items()}
def ct(c):
    try: return api(f"/api/v1/campaigns/{c['id']}")["ad_groups"][0]["ads"][0].get("content_id"), bo_cua.get(int(c.get("ad_account_id") or 0))
    except Exception: return None, None
with ThreadPoolExecutor(12) as ex: cap = [x for x in ex.map(ct, api("/api/v1/campaigns?page_size=500")["data"]) if x[0] and x[1]]
cu = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_phim_tk'") or "{}")
for cid, bo in cap: cu.setdefault(str(cid), bo)
q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_phim_tk', '{json.dumps(cu)}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
import collections
print("bộ:", {k: b["ten"] for k, b in BO.items()}, "· phim theo bộ:", dict(collections.Counter(cu.values())))
