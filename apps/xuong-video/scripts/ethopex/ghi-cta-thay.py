#!/usr/bin/env python3
"""SỔ BẢN SỬA CTA (anh 23/10/2026: "nhân bản một camp CTA sai rồi sửa lại thì vẫn gọi là nhân bản"): creative cũ (CTA trước luật) → creative mới đúng luật
của chính đoạn đó. nhan-ban.py tra sổ này khi nhân bản camp thắng mang CTA cũ. Ghi vào studio xv_khoa_ngoai['ethopex_cta_thay'], gỡ khỏi hàng dựng lại.
Chạy trên box3:
  python3 ghi-cta-thay.py <cũ>:<mới> …                 → ghi thẳng theo mã creative
  python3 ghi-cta-thay.py --camp <camp_cũ>:<mới> …      → đọc creative hiện tại của camp cũ trên Ethopex rồi ghi (len-creative.py gọi)"""
import json, os, subprocess, sys, urllib.request
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()

def creative_cua(camp):
    T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
    d = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.ethopex.dev/api/v1/campaigns/{int(camp)}", headers={"authorization": "Bearer " + T, "user-agent": "mos2-ethopex"}), timeout=60))
    return d["ad_groups"][0]["ads"][0]["creative_id"]

def main(a):
    theo_camp = "--camp" in a; cap = [x.split(":") for x in a if ":" in x]
    thay = {str(creative_cua(c) if theo_camp else int(c)): int(m) for c, m in cap}
    if not thay: return
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_cta_thay', '{}'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || '{json.dumps(thay)}'::jsonb where ten='ethopex_cta_thay'")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri - array[{','.join(repr(k) for k in thay)}]::text[] where ten='ethopex_cho_dung_lai'")
    print("bản sửa CTA:", thay)

if __name__ == "__main__":
    main(sys.argv[1:])
