#!/usr/bin/env python3
"""THỢ DÂY CHUYỀN CREATIVE (etp.on.tc bước 5, anh 24/10/2026). Chạy trên MÁY CÓ macOS (cổng chữ dùng Vision) — iMac, MacBook, Mac mini thêm sau.
Nhận việc từ hàng đợi etp.viec trên box3 (for update skip locked → nhiều thợ / nhiều máy không giành nhau), làm, ghi kết quả, nhận việc kế; HẾT việc thì THOÁT
(không phải tiến trình nền — phim-moi.py cat bật thợ theo lô).
  loai = cat: tải tập (tai-tap.py) → cat-cuoi-lo.py một phim (so_ban góc, kèm tờ soát) → máy khác iMac thì rsync đoạn cắt + tờ soát về iMac ~/.cache/ethopex/ra/<lô>/
Lỗi kỹ thuật (loi_ky_thuat.py) → trả việc về hàng chờ, tối đa 3 lần; lỗi nội dung → xong kèm lỗi.
Dùng: tho.py [--so-tho 2] [--lo <mã lô>]"""
import json, os, socket, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
R = os.path.dirname(os.path.abspath(__file__)); E = os.path.join(R, "..", "xuong-video", "scripts", "ethopex")
sys.path.insert(0, E); import loi_ky_thuat as LK
B = "root@167.233.241.16"; ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
C = os.path.expanduser("~/.cache/ethopex"); N = os.path.join(C, "nguon")
MAY = socket.gethostname().split(".")[0]; TRUNG_TAM = "Tuans-iMac"; IMAC = "htuan@100.98.66.49"

# TẢI HẾT TẬP MIỄN PHÍ (anh 04/11/2026 "mỗi film có 10 tập free đã dùng chưa"): trần cũ 8 tập bỏ sót tập free cuối — #80386 El gran y poderoso genio mở 9 tập,
# máy chỉ tải 8 rồi báo "hết khung mới". tai-tap.py tự dừng ở tập khoá / tập trả phí đầu tiên, nên trần này chỉ là chặn trên cho phim mở bất thường nhiều tập.
TAP_TOI_DA = 20

# TRẦN GIỜ CẮT THEO KHỐI VIỆC (07/11/2026): trần cố định 45 phút đặt khi mỗi phim cắt 2 bản; nay 5–8 bản, iMac đo 8–44 phút / phim → HP quá giờ lặp lại.
# Mỗi bản ~8 phút (đo 07/11: iMac 40 phút / 5 bản, HP 42 phút / 5 bản). Dòng LT (kieu=tap) đọc chữ cả phim: giữ 100 phút. Một công thức cho cả lúc cắt lẫn quet_chet (bản SQL ngay dưới).
def tran_phut(d): return 100 if d.get("kieu") == "tap" else 15 + 8 * int(d.get("so_ban") or 2)
TRAN_SQL = "(case when du_lieu->>'kieu' = 'tap' then 100 else 15 + 8 * coalesce((du_lieu->>'so_ban')::int, 2) end)"
# NHỊP SỐNG (07/11/2026): thợ đang làm ghi du_lieu.nhip = now() mỗi phút (giu_nhip). Việc 'dang' mà nhịp im quá 10 phút = thợ chết → xếp lại ngay,
# không phải chờ trần giờ (115 phút). Việc chưa có nhịp (thợ chạy mã cũ) vẫn theo trần giờ. MỘT điều kiện cho quet_chet + Mạnh (manh.py mục 4).
CHET_SQL = (f"(case when du_lieu->>'nhip' is null then bat_dau < now() - interval '1 minute' * ({TRAN_SQL} + 60)"
            " else (du_lieu->>'nhip')::timestamptz < now() - interval '10 minutes' end)")
BO_NHIP = "du_lieu = du_lieu - 'nhip'"   # mọi lần trả việc về hàng chờ xoá nhịp cũ, thợ nhận sau không bị coi là chết

def sql(cau):
    r = subprocess.run(["ssh", "-o", "ConnectTimeout=15", B, f'{ENV}; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -'], input=cau, capture_output=True, text=True, timeout=120)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def quet_chet():
    """việc 'dang' của máy này mà thợ đã chết (CHET_SQL: nhịp im 10 phút, hoặc chưa có nhịp thì quá trần cắt + 1 giờ) → trả về hàng chờ, không nằm kẹt mãi"""
    r = sql(f"update etp.viec set trang_thai = 'cho', may = null, {BO_NHIP}, loi = coalesce(loi, '') || ' | thợ chết giữa chừng, xếp lại' where trang_thai = 'dang' and may = '{MAY}' and {CHET_SQL} returning id")
    if r: print(f"[{MAY}] xếp lại việc kẹt: {r.replace(chr(10), ' ')}", flush=True)
def nhan(lo):
    dk = f"and lo = '{lo}'" if lo else ""
    j = sql(f"""update etp.viec set trang_thai = 'dang', may = '{MAY}', bat_dau = now(), lan_thu = lan_thu + 1, du_lieu = du_lieu || jsonb_build_object('nhip', now())
               where id = (select id from etp.viec where trang_thai = 'cho' {dk} and not coalesce(du_lieu->'may_hong', '[]'::jsonb) ? '{MAY}' order by id for update skip locked limit 1)
               returning json_build_object('id', id, 'loai', loai, 'lo', lo, 'content_id', content_id, 'du_lieu', du_lieu, 'lan_thu', lan_thu)""")
    return json.loads(j) if j else None

def xong(v, ket_qua, loi=None):
    kq = json.dumps(ket_qua, ensure_ascii=False).replace("$K$", "")
    if loi and LK.ky_thuat(loi) is True and v["lan_thu"] < 3:   # lỗi kỹ thuật → về hàng chờ cho MÁY KHÁC: máy này ghi vào may_hong, nhan() không đưa lại cho nó
        # (07/11/2026: phim 92980 quá giờ 3 lần liền cùng trên HP, 45 phút mất trắng mỗi lần). Tối đa 3 lần thử ≤ số máy thợ (iMac, HP, VPS) → luôn còn máy nhận.
        sql(f"update etp.viec set trang_thai = 'cho', may = null, loi = $L${str(loi)[:300]}$L$, du_lieu = jsonb_set(coalesce(du_lieu, '{{}}'::jsonb) - 'nhip', '{{may_hong}}', coalesce(du_lieu->'may_hong', '[]'::jsonb) || to_jsonb('{MAY}'::text)) where id = {v['id']}"); return "tra_lai"
    # 'loi' khi KHÔNG có đoạn dùng được (07/11/2026: #270 #273 ra 0 đoạn, ket_qua chỉ chứa dòng lỗi mà vẫn ghi 'xong' → bảng máy thợ đếm như việc đạt)
    dat = any(x.get("file") and not x.get("loi") for x in ket_qua)
    sql(f"update etp.viec set trang_thai = '{'loi' if loi and not dat else 'xong'}', xong = now(), ket_qua = $K${kq}$K$::jsonb, loi = {('$L$' + str(loi)[:300] + '$L$') if loi else 'null'} where id = {v['id']}")
    return "xong"

def cat(v):
    d, cid, lo = v["du_lieu"], str(v["content_id"]), v["lo"]
    tm = os.path.join(N, cid); ra = os.path.join(C, "ra", lo, f"p-{cid}"); os.makedirs(ra, exist_ok=True)
    # luôn gọi tai-tap: tự dùng lại tập có sẵn, tải tập thiếu, đã dò hết (dấu tap-het) thì trả ngay — luật nằm MỘT chỗ ở tai-tap.da_het
    os.makedirs(tm, exist_ok=True); subprocess.run(["python3", os.path.join(E, "tai-tap.py"), d.get("url", ""), tm, str(TAP_TOI_DA)], capture_output=True, text=True, timeout=1500)   # tải HẾT tập miễn phí (tai-tap dừng ở tập khoá đầu tiên)
    if not any(f.startswith("tap") and f.endswith(".mp4") for f in os.listdir(tm)): return [], "không tải được tập miễn phí"
    # thiếu poster thì cat-cuoi-lo đổ Errno 2 sau khi đã tốn công ghép phim (07/11/2026 VPS #270 #273) → dừng sớm, lỗi kỹ thuật → máy khác làm
    if not (os.path.exists(os.path.join(tm, "poster.jpg")) and os.path.getsize(os.path.join(tm, "poster.jpg")) > 2000): return [], "không tải được poster"
    tsv = os.path.join(ra, "lo.tsv"); open(tsv, "w").write(f"{cid}\t{d.get('locale', 'en')}\t{d.get('nguon', '')}\t{d.get('ten', '')}\t{d.get('url', '')}\n")
    # nice 10 cả ngày (anh 07/11/2026 "sửa đi"): trước ban ngày dùng taskpolicy -b → macOS dồn thợ cắt sang nhân tiết kiệm (nhân E) của chip M, một khung cắt 3–10 phút
    uu = ["nice", "-n", "10"]
    # cả nhóm tiến trình: quá giờ thì giết luôn cat-canh / ffmpeg con cháu (25/10/2026: 3 ffmpeg treo mồ côi 8 giờ sau khi thợ bỏ việc)
    pr = subprocess.Popen([*uu, "python3", os.path.join(E, "cat-cuoi-lo.py"), N, tsv, ra, "1", str(d.get("so_ban", 2))], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True,
                          env={**os.environ, **({"ETP_KIEU": d["kieu"]} if d.get("kieu") else {})})   # kieu=tap: mỗi tập một đoạn (dòng phim LT, anh 03/11/2026)
    try: pr.wait(timeout=tran_phut(d) * 60)   # trần theo số bản (tran_phut); trần cũ 3 giờ làm lô kẹt cả buổi (02/11/2026)
    except subprocess.TimeoutExpired:
        try: os.killpg(pr.pid, 9)
        except Exception: pass
        pr.wait(); qua_gio = True
    else: qua_gio = False
    lo_json = os.path.join(ra, "lo.json")
    kq = json.load(open(lo_json)) if os.path.exists(lo_json) else []
    if qua_gio:   # QUÁ GIỜ VẪN GIỮ ĐOẠN ĐÃ CẮT XONG (05/11/2026 dòng #51: 5/8 đoạn xong mà bỏ hết, báo 0 khung)
        kq = [x for x in kq if x.get("file") and os.path.exists(x["file"]) and os.path.getsize(x["file"]) > 50_000]
        if not kq: raise subprocess.TimeoutExpired(pr.args, 0)
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

def giu_nhip(vid, dung):
    """ghi nhịp sống mỗi phút tới khi việc xong (dung.set); mạng hỏng một nhịp thì bỏ qua — 10 nhịp liền mới bị coi là chết"""
    while not dung.wait(60):
        try: sql(f"update etp.viec set du_lieu = du_lieu || jsonb_build_object('nhip', now()) where id = {vid} and trang_thai = 'dang' and may = '{MAY}'")
        except Exception: pass

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
        t0 = time.time(); dung = threading.Event(); threading.Thread(target=giu_nhip, args=(v["id"], dung), daemon=True).start()
        try: kq, loi = cat(v) if v["loai"] == "cat" else ([], f"loại việc lạ {v['loai']}")
        except Exception as e: kq, loi = [], f"{type(e).__name__}: {str(e)[:200]}"
        finally: dung.set()
        r = xong(v, kq, loi); n += 1; DANG[0] -= 1
        print(f"[{MAY}] #{v['id']} {v['loai']} phim {v['content_id']}: {r} · {sum(1 for x in kq if x.get('file') and not x.get('loi'))} đoạn · {time.time() - t0:.0f}s{(' · ' + str(loi)[:100]) if loi else ''}", flush=True)

if __name__ == "__main__":
    a = sys.argv[1:]; so = int(a[a.index("--so-tho") + 1]) if "--so-tho" in a else 2; lo = a[a.index("--lo") + 1] if "--lo" in a else None
    try: quet_chet()
    except Exception as e: print("quét việc kẹt lỗi:", e, flush=True)
    with ThreadPoolExecutor(so) as ex: tong = sum(ex.map(lambda _: tho(lo), range(so)))
    print(f"[{MAY}] hết việc — đã làm {tong} việc", flush=True)
