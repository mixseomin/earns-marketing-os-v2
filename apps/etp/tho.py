#!/usr/bin/env python3
"""THỢ DÂY CHUYỀN CREATIVE (etp.on.tc bước 5, anh 24/10/2026). Chạy trên MÁY CÓ macOS (cổng chữ dùng Vision) — iMac, MacBook, Mac mini thêm sau.
Nhận việc từ hàng đợi etp.viec trên box3 (for update skip locked → nhiều thợ / nhiều máy không giành nhau), làm, ghi kết quả, nhận việc kế; HẾT việc thì THOÁT
(không phải tiến trình nền — phim-moi.py cat bật thợ theo lô).
  loai = cat: tải tập (tai-tap.py) → cat-cuoi-lo.py một phim (so_ban góc, kèm tờ soát) → máy khác iMac thì rsync đoạn cắt + tờ soát về iMac ~/.cache/ethopex/ra/<lô>/
Lỗi kỹ thuật (loi_ky_thuat.py) → trả việc về hàng chờ, tối đa 3 lần; lỗi nội dung → xong kèm lỗi.
Dùng: tho.py [--so-tho 2] [--lo <mã lô>]"""
import json, os, socket, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
R = os.path.dirname(os.path.abspath(__file__)); E = os.path.join(R, "..", "xuong-video", "scripts", "ethopex")
sys.path.insert(0, E); import loi_ky_thuat as LK
B = "root@167.233.241.16"; ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
C = os.path.expanduser("~/.cache/ethopex"); N = os.path.join(C, "nguon")
MAY = socket.gethostname().split(".")[0]; TRUNG_TAM = "Tuans-iMac"; IMAC = "htuan@100.98.66.49"

def sql(cau):
    r = subprocess.run(["ssh", "-o", "ConnectTimeout=15", B, f'{ENV}; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -'], input=cau, capture_output=True, text=True, timeout=120)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def quet_chet():
    """việc 'dang' của máy này quá 4 giờ (hơn hạn 3 giờ của một việc cắt) = tiến trình đã chết → trả về hàng chờ, không nằm kẹt mãi"""
    r = sql(f"update etp.viec set trang_thai = 'cho', may = null, loi = coalesce(loi, '') || ' | thợ chết giữa chừng, xếp lại' where trang_thai = 'dang' and may = '{MAY}' and bat_dau < now() - interval '4 hours' returning id")
    if r: print(f"[{MAY}] xếp lại việc kẹt: {r.replace(chr(10), ' ')}", flush=True)
def nhan(lo):
    dk = f"and lo = '{lo}'" if lo else ""
    j = sql(f"""update etp.viec set trang_thai = 'dang', may = '{MAY}', bat_dau = now(), lan_thu = lan_thu + 1
               where id = (select id from etp.viec where trang_thai = 'cho' {dk} order by id for update skip locked limit 1)
               returning json_build_object('id', id, 'loai', loai, 'lo', lo, 'content_id', content_id, 'du_lieu', du_lieu, 'lan_thu', lan_thu)""")
    return json.loads(j) if j else None

def xong(v, ket_qua, loi=None):
    kq = json.dumps(ket_qua, ensure_ascii=False).replace("$K$", "")
    if loi and LK.ky_thuat(loi) is True and v["lan_thu"] < 3:   # lỗi kỹ thuật → về hàng chờ cho lượt / máy khác
        sql(f"update etp.viec set trang_thai = 'cho', may = null, loi = $L${str(loi)[:300]}$L$ where id = {v['id']}"); return "tra_lai"
    sql(f"update etp.viec set trang_thai = '{'loi' if loi and not ket_qua else 'xong'}', xong = now(), ket_qua = $K${kq}$K$::jsonb, loi = {('$L$' + str(loi)[:300] + '$L$') if loi else 'null'} where id = {v['id']}")
    return "xong"

def cat(v):
    d, cid, lo = v["du_lieu"], str(v["content_id"]), v["lo"]
    tm = os.path.join(N, cid); ra = os.path.join(C, "ra", lo, f"p-{cid}"); os.makedirs(ra, exist_ok=True)
    if not (os.path.isdir(tm) and any(f.startswith("tap") and f.endswith(".mp4") for f in os.listdir(tm))):
        os.makedirs(tm, exist_ok=True); subprocess.run(["python3", os.path.join(E, "tai-tap.py"), d.get("url", ""), tm, "8"], capture_output=True, text=True, timeout=1800)
    if not any(f.startswith("tap") and f.endswith(".mp4") for f in os.listdir(tm)): return [], "không tải được tập miễn phí"
    tsv = os.path.join(ra, "lo.tsv"); open(tsv, "w").write(f"{cid}\t{d.get('locale', 'en')}\t{d.get('nguon', '')}\t{d.get('ten', '')}\t{d.get('url', '')}\n")
    h = time.localtime().tm_hour   # đêm 22h–8h: nice (đủ lõi); ngày: chế độ nền (máy người dùng không giật) — cùng luật dot-phim-moi.uu_tien
    uu = ["nice", "-n", "10"] if (h >= 22 or h < 8) else (["taskpolicy", "-b"] if sys.platform == "darwin" else ["nice", "-n", "15"])
    # cả nhóm tiến trình: quá giờ thì giết luôn cat-canh / ffmpeg con cháu (25/10/2026: 3 ffmpeg treo mồ côi 8 giờ sau khi thợ bỏ việc)
    pr = subprocess.Popen([*uu, "python3", os.path.join(E, "cat-cuoi-lo.py"), N, tsv, ra, "1", str(d.get("so_ban", 2))], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    try: pr.wait(timeout=3 * 3600)
    except subprocess.TimeoutExpired:
        try: os.killpg(pr.pid, 9)
        except Exception: pass
        pr.wait(); raise
    lo_json = os.path.join(ra, "lo.json")
    kq = json.load(open(lo_json)) if os.path.exists(lo_json) else []
    for x in kq: x.pop("moc_tap", None)
    if MAY != TRUNG_TAM:   # gửi đoạn cắt về máy trung tâm, đường tệp đổi sang đường trên iMac
        dich = f"/Users/htuan/.cache/ethopex/ra/{lo}/p-{cid}/"
        subprocess.run(["ssh", IMAC, f"mkdir -p '{dich}'"], check=True, timeout=60)
        subprocess.run(["rsync", "-a", ra + "/", f"{IMAC}:{dich}"], check=True, timeout=1800)
        for x in kq:
            if x.get("file"): x["file"] = dich + os.path.basename(x["file"])
        json.dump(kq, open(lo_json, "w"), ensure_ascii=False)
    ok = [x for x in kq if x.get("file") and not x.get("loi")]
    return kq, (None if ok else (" ".join(str(x.get("loi")) for x in kq)[:300] or "không ra đoạn nào"))

DANG = [0]   # số luồng trong tiến trình này đang làm việc
def tho(lo):
    n = 0
    while True:
        try: v = nhan(lo)
        except Exception as e: print("không nhận được việc:", e, flush=True); time.sleep(10); continue
        if not v:
            # HÀNG TRỐNG nhưng luồng khác còn đang làm → chờ chứ không thoát (25/10/2026: 12 việc lỗi được xếp lại hàng mà chỉ còn 1 luồng,
            # luồng kia đã thoát từ lúc hàng trống → 10 phim nằm chờ sau một việc treo). Mọi luồng đều rỗi mới thoát.
            if DANG[0] > 0: time.sleep(30); continue
            return n
        DANG[0] += 1
        t0 = time.time()
        try: kq, loi = cat(v) if v["loai"] == "cat" else ([], f"loại việc lạ {v['loai']}")
        except Exception as e: kq, loi = [], f"{type(e).__name__}: {str(e)[:200]}"
        r = xong(v, kq, loi); n += 1; DANG[0] -= 1
        print(f"[{MAY}] #{v['id']} {v['loai']} phim {v['content_id']}: {r} · {sum(1 for x in kq if x.get('file') and not x.get('loi'))} đoạn · {time.time() - t0:.0f}s{(' · ' + str(loi)[:100]) if loi else ''}", flush=True)

if __name__ == "__main__":
    a = sys.argv[1:]; so = int(a[a.index("--so-tho") + 1]) if "--so-tho" in a else 2; lo = a[a.index("--lo") + 1] if "--lo" in a else None
    try: quet_chet()
    except Exception as e: print("quét việc kẹt lỗi:", e, flush=True)
    with ThreadPoolExecutor(so) as ex: tong = sum(ex.map(lambda _: tho(lo), range(so)))
    print(f"[{MAY}] hết việc — đã làm {tong} việc", flush=True)
