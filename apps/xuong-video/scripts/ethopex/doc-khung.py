#!/usr/bin/env python3
"""ĐỌC CHỮ KHUNG ĐÃ TRÍCH TRÊN BOX3 bằng Vision của iMac (anh 23/10/2026 "setup box3"): kéo /root/.cache/ethopex/khung/<id>/ (nguon-box.py trích,
1 giây/khung, ảnh 540px) về iMac → doc-chu (Vision, 0,09s/khung) → {giây nguyên: chữ} → ghi lên box3 cạnh nguồn: <nguồn bỏ đuôi>.chu.json.
kiem-thoai.doc trên box3 đọc bản này (chọn khung cuối + cổng thoại cấm của từng đoạn); thiếu giây nào thì box3 báo lỗi, không cho qua.
Dùng (iMac): doc-khung.py <id> …"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
B = "root@167.233.241.16"; L = os.path.expanduser("~/.cache/ethopex/khung-box"); D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)

def may_doc():
    import importlib.util
    s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m.may_doc()

def mot(cid, doc):
    ld = os.path.join(L, str(cid)); os.makedirs(ld, exist_ok=True)
    if subprocess.run(["rsync", "-a", "--delete", f"{B}:/root/.cache/ethopex/khung/{cid}/", ld + "/"], capture_output=True).returncode != 0: return {"id": cid, "loi": "không kéo được khung"}
    meta = json.load(open(os.path.join(ld, "meta.json"))); fs = sorted(f for f in os.listdir(ld) if f.endswith(".jpg"))
    chu = {}
    for i in range(0, len(fs), 300):
        r = subprocess.run([doc] + [os.path.join(ld, f) for f in fs[i:i + 300]], capture_output=True, text=True, timeout=900, check=True)
        for j, l in enumerate(r.stdout.splitlines()): chu[str(round(meta["tu0"] + i + j))] = json.loads(l)["chu"]
    ra = os.path.join(ld, "chu.json"); json.dump(chu, open(ra, "w"), ensure_ascii=False)
    dich = os.path.splitext(meta["src"])[0] + ".chu.json"
    if subprocess.run(["scp", "-q", ra, f"{B}:{dich}"]).returncode != 0: return {"id": cid, "loi": "không ghi được lên box3"}
    return {"id": cid, "giay": len(chu)}

if __name__ == "__main__":
    doc = may_doc()
    with ThreadPoolExecutor(3) as ex:
        for k in ex.map(lambda c: mot(c, doc), sys.argv[1:]): print(json.dumps(k, ensure_ascii=False), flush=True)
