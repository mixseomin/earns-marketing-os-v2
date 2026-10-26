#!/usr/bin/env python3
"""LÊN CAMP SAU KHI CHẤM (anh 25/10/2026: "cái nào đủ điều kiện lên camp thì lên luôn. Mở lại quy định lên camp mới").
Creative của một lô đã đẩy lên Ethopex (ra/<mã lô>/len.json) mà CHƯA có camp → qua cổng chấm (view etp.cham_cong: Meta ≤ 4 / CTA ≤ 4 thì chặn) thì tạo camp ở bộ của phim (sổ ethopex_phim_tk; phim mới → bộ 2) (nhan-ban.py --creative, khuôn EN/ES
như dot-phim-moi); chưa chấm thì bỏ qua (nhan-ban tự xếp hàng chấm) — chạy lại lệnh này sau khi chấm xong để lên nốt. Cấm / cần xem: không lên.
Cổng thật nằm ở nhan-ban.py (cổng chấm + rào chắn etp + bão hoà + phim 18+ + CTA) — lệnh này chỉ chọn việc và gọi.
Chạy (iMac):  python3 len-sau-cham.py <mã lô, vd pm24101433 | cho = mọi creative đang chờ trong kho> [--lich today|tomorrow] [--thu]"""
import json, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); C = os.path.expanduser("~/.cache/ethopex")
sys.path.insert(0, D)
import soat_doan as SD
KHUON = {"en": 65110, "es": 65734}   # = dot-phim-moi.KHUON (camp mẫu cùng tiếng; nhan-ban --bo 2 đổi tài khoản + Page)

def main(a):
    import fcntl   # một lượt một lúc (25/10/2026: lượt tay + lượt nền chạy cùng lúc tạo trùng camp)
    lk = open(os.path.join(C, "len-sau-cham.lock"), "w")
    try: fcntl.flock(lk, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError: return print("len-sau-cham đang chạy ở lượt khác — thoát")
    ma = a[0]; lich = a[a.index("--lich") + 1] if "--lich" in a else "today"; thu = "--thu" in a
    if ma == "cho":   # MỌI creative đang chờ trong kho etp (anh 26/10/2026 "làm luôn 1 lượt để có camp lên") — không cần ra/<lô>/len.json (lô cắt ở máy khác / đã dọn); tên camp dựng từ kho
        import unicodedata
        a_ = lambda t: unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().replace("'", "").strip()
        ds = [{"creative_id": int(c), "content_id": int(p_), "lang": l, "ok": True, "ten": f"{lo} {a_(t) or 'phim ' + p_} {l.upper()} - {a_(d).lower()} {round(float(tu))}-{round(float(de))}s"}
              for c, p_, l, lo, t, d, tu, de in (r.split("|") for r in SD.sql("""select r.creative_id, r.content_id, coalesce(r.lang, 'en'), r.lo, coalesce(p.ten, ''), coalesce(r.dang, ''), coalesce(r.tu, 0), coalesce(r.den, 0)
                  from etp.creative r left join etp.phim p using (content_id) where r.tu_choi is null and r.content_id is not null
                  and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)""").splitlines() if r.count("|") == 7)]
    else: ds = [x for x in json.load(open(os.path.join(C, "ra", ma, "len.json"))) if x.get("ok") and x.get("creative_id")]
    ids = ",".join(str(int(x["creative_id"])) for x in ds) or "0"
    co_camp = set(SD.sql(f"select distinct creative_id from etp.camp where creative_id in ({ids}) and coalesce(trang_thai, '') <> 'ARCHIVED'").split())
    bo_phim = json.loads(SD.sql("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_phim_tk'") or "{}")   # mỗi phim một bộ — phim đã có bộ thì lên đúng bộ đó, phim mới → bộ 2
    cham = dict(l.split("|", 1) for l in SD.sql(f"select creative_id, case when duoc_len then 'ok' else 'chan' end from etp.cham_cong where creative_id in ({ids})").splitlines() if "|" in l)   # cổng một nguồn: view etp.cham_cong
    dem = {"len": 0, "loi": 0, "co_camp": 0, "chua_cham": 0, "khong_sach": 0}
    for x in ds:
        cr = str(int(x["creative_id"]))
        if cr in co_camp: dem["co_camp"] += 1; continue
        k = cham.get(cr)
        if k is None: dem["chua_cham"] += 1; continue
        if k != "ok": dem["khong_sach"] += 1; continue
        lang = (x.get("lang") or "en").lower()
        if thu: print(f"[thử] sẽ lên #{cr} ({lang}) {x['ten'][:60]}"); dem["len"] += 1; continue
        ten = x["ten"].replace("'", "").replace('"', "")
        r = subprocess.run(["ssh", SD.B, f"""{SD.ENV}; cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON.get(lang, KHUON['en'])} --bo {bo_phim.get(str(int(x['content_id'])), '2')} --creative {cr} --content {int(x['content_id'])} --ten "{ten}" --that --lich {lich} --luat "lên camp sau khi máy chấm Sạch — lô {ma}" --ai "anh (chat 25/10/2026: cái nào đủ điều kiện lên camp thì lên luôn)\""""],
                           capture_output=True, text=True, timeout=600)
        kq = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
        try: j = json.loads(kq); ok = j.get("ok")
        except Exception: j, ok = {"loi": kq}, False
        dem["len" if ok else "loi"] += 1
        print(f"{'✓' if ok else '✗'} #{cr} → {'camp #' + str(j.get('moi')) if ok else str(j.get('loi'))[:160]}", flush=True)
    print(f"lô {ma}: lên {dem['len']} · lỗi {dem['loi']} · đã có camp {dem['co_camp']} · chưa chấm {dem['chua_cham']} (chạy lại sau khi chấm) · không sạch {dem['khong_sach']}")

if __name__ == "__main__":
    main(sys.argv[1:])
