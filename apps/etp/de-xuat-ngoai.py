#!/usr/bin/env python3
"""ĐỀ XUẤT BẬC CHO TEAM (anh 30/10/2026: "theo dõi hiệu suất của mọi người trong team về thời điểm lên bậc… và các đề xuất áp dụng bậc.
Nhưng chỉ đề xuất, ko tự ý update !! Trừ tk Nhà vẫn làm như cũ").
Chạy máy luật nhà (luat-ethopex.py --json) ở chế độ ETP_XEM_NGUOI cho từng người có tài khoản ngoài nhà: cùng luật, cùng ngưỡng — chỉnh luật nhà là
đề xuất cho team đổi theo. Cổng chung (ethopex_api.py) chặn mọi lệnh ghi ở chế độ này; script này chỉ ghi kho etp:
  · etp.xet_luat_ngoai (máy luật tự ghi) · etp.de_xuat_bac (migration 0374): mỗi đề xuất camp × loại × ngân sách, giữ lần đầu / lần cuối máy thấy.
Dùng (box3, đã nạp .env.production): python3 de-xuat-ngoai.py [nguoi_id …]   — không tham số = mọi người ngoài nhà. dong-bo.py gọi mỗi giờ."""
import json, os, subprocess, sys

DB = os.environ["DATABASE_URL"]
LUAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "luat-ethopex.py")
# khoá JSON máy luật → loại đề xuất bậc (mọi luật tắt gộp một loại 'tat'; luật thang bộ 2 chỉ có ở nhà)
LOAI = {"tang": "tang", "dau_phien": "dau_phien", "tang30": "tang30", "moc30": "moc30", "nb": "nb", "ha": "ha", "giam": "giam",
        "tat": "tat", "tat_d24": "tat", "tat_l3": "tat", "tat_l4": "tat", "tat2": "tat", "tat7": "tat", "tat_roas": "tat"}

def q(s):
    r = subprocess.run(["psql", DB, "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def nguoi_ngoai():
    return [int(x) for x in q("select distinct nguoi_id from etp.tai_khoan where not nha and nguoi_id is not null "
                              "and nguoi_id not in (select nguoi_id from etp.tai_khoan where nha and nguoi_id is not null) order by 1").split()]

def chay(ng):
    r = subprocess.run(["python3", LUAT, "--json"], env={**os.environ, "ETP_XEM_NGUOI": str(ng)}, capture_output=True, text=True, timeout=900)
    dong = [l for l in r.stdout.splitlines() if l.startswith("{")]
    if not dong: raise RuntimeError(f"máy luật không ra JSON (mã {r.returncode}): {r.stderr.strip()[-300:]}")
    kq = json.loads(dong[-1])
    rows = [{"c": int(x["id"]), "loai": LOAI[k], "luat": k, "chu": (x.get("chu") or "")[:500]}
            for k, ds in kq.items() if k in LOAI and isinstance(ds, list) for x in ds if str(x.get("id") or "").isdigit() and int(x["id"]) > 0]
    if rows:
        j = json.dumps(rows, ensure_ascii=False).replace("$J$", "")
        q(f"""insert into etp.de_xuat_bac (camp_id, loai, ns, nguoi_id, luat, chu)
              select x.c, x.loai, coalesce(k.ngan_sach, 0), {ng}, x.luat, x.chu
              from jsonb_to_recordset($J${j}$J$::jsonb) as x(c int, loai text, luat text, chu text) join etp.camp_ngoai k on k.camp_id = x.c
              on conflict (camp_id, loai, ns) do update set lan_cuoi = now(), chu = excluded.chu, luat = excluded.luat""")
    return {"nguoi": ng, "de_xuat": len(rows), "loi_may": [x.get("chu") for x in kq.get("loi_may") or []][:3]}

if __name__ == "__main__":
    ds = [int(x) for x in sys.argv[1:] if x.isdigit()] or nguoi_ngoai()
    ra = []
    for ng in ds:
        try: ra.append(chay(ng))
        except Exception as e: ra.append({"nguoi": ng, "loi": str(e)[:300]})
    print(json.dumps(ra, ensure_ascii=False))
