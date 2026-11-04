#!/usr/bin/env python3
"""MÁY CHẠY DÒNG PHIM (anh 03/11/2026: "khi tao chọn phim xong, form hỏi thêm về thể loại rồi hệ thống tự động chạy xuyên suốt ko cần đến mày + tao đến khi
lên được camp. Nếu có vấn đề về policy… thì chủ động dừng lại dòng phim đó. Mọi thứ trên 1 dòng phim đó, có thời gian bắt đầu, kết thúc mỗi step. Có nút để FIX").
Chạy trên iMac (launchd com.htuan.etp-dong-phim, KeepAlive) — cắt / soát đoạn / tải creative đều chạy ở iMac. Kho: etp.dong_phim + etp.dong_buoc (migration 0413).
Thằng Mạnh (apps/etp/manh.py, box3 timer 2 phút) canh phía sau: bước quá hạn / tiến trình chết / máy này im → huỷ, FIX tự một lần, báo Telegram.

8 bước, mỗi bước gọi ĐÚNG công cụ đang dùng (không chép lại luật):
  nhan      Nhận phim     nhóm gốc Âu-Mỹ · không trong sổ cấm 18+ · đội không giữ · phim chưa có camp → ghi etp.phim_nhan (Nhà)
  ws        Trang phim    nhan-ban.trang_chua_san: thêm workspace (ensure-clone) + điền mô tả / cốt truyện → chờ đồng bộ tới khi đủ
  poster    Soát poster   apps/etp/soat_18_ai.py --ghi → cấm thì dừng
  cat       Cắt đoạn      etp.viec lô dp<dòng> → tho.py (tải tập + cat-cuoi-lo, CTA kiểu Kiên)
  soat      Soát đoạn     soat_doan.py lo (máy soát Claude, chuỗi rẻ) → giữ đoạn ok; không còn đoạn ok thì dừng
  creative  Tải + chấm    len-creative.py (MỘT đoạn — luật một camp mỗi lần) → chờ cổng chấm etp.cham_cong: chặn / chờ duyệt thì dừng
  camp      Lên camp      nhan-ban.py --bo 2 --creative … (giờ chạy do nhan-ban.lich_len: tạo 07–12h VN chạy ngay, ngoài khung hẹn 07:00 hôm sau — anh 05/11/2026; trước: --lich tomorrow, anh 04/11/2026) (mọi cổng luật nằm ở đó) → chặn thì dừng
  chay      Camp chạy     chờ Ethopex đồng bộ xong + ACTIVE
Kết quả bước: xong · dung (policy / luật — máy chủ động dừng dòng) · loi (kỹ thuật) · cho (chưa tới — máy quay lại sau, bước vẫn đang).
Dùng: dong_phim.py (vòng chính) · dong_phim.py mot [giây] (một vòng, thử)"""
import datetime as dt, json, os, re, signal, socket, subprocess, sys, threading, time
R = os.path.dirname(os.path.abspath(__file__)); E = os.path.join(R, "..", "xuong-video", "scripts", "ethopex")
sys.path.insert(0, E); import loi_ky_thuat as LK
# MỘT kết nối ssh dùng chung (ControlMaster) cho mọi câu SQL / lệnh box3 — mỗi câu một ssh mới thì >10 dòng song song vượt MaxStartups của sshd box3,
# box3 đóng kết nối ("Connection closed by … port 22", 04/11/2026)
SSH = ["ssh", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=20", "-o", "ControlMaster=auto", "-o", f"ControlPath={os.path.expanduser('~/.ssh/cm-etp-dong-%r@%h')}", "-o", "ControlPersist=10m"]
B = "root@167.233.241.16"; ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
C = os.path.expanduser("~/.cache/ethopex"); MAY = socket.gethostname().split(".")[0]
KHUON = {"en": 65110, "es": 65734}   # camp mẫu cùng tiếng (dot-phim-moi.KHUON)
LOAI = {"CC": "cảnh cuối", "KT": "kể chuyện", "LT": "tập nguyên"}   # loại nội dung QC form chọn → dạng creative trong kho (etp.creative.dang)
BO_QUA = {"KT": {"cat", "soat"}}                 # KT: máy sinh kể chuyện (VideoExpress) làm video từ tóm tắt — không cắt phim
HAN_RIENG = {("KT", "creative"): 4 * 3600, ("LT", "cat"): 2 * 3600, ("LT", "camp"): 7 * 24 * 3600}   # LT: cắt cả phim ~1 giờ; bước camp chờ anh bấm bắt đầu
# LT — LỘ TRÌNH TEST RỘNG (anh 03/11/2026 "Lên $8-10/phim + T2 thì sẽ cắt sớm đc lỗ và tìm nhanh đc camp lãi" · chọn A: miễn luật một camp ngày test rộng):
# cắt MỖI TẬP một creative (kiểu Kiên, tập trọn ETP_KIEU=tap, tới 10 đoạn) → soát → tải + chấm TẤT CẢ đoạn sạch → DỪNG chờ anh bắt đầu
# (etp.cau_hinh 'lo_trinh' {content_id: {bat_dau: true}}) → lên mỗi creative một camp $1 (nhan-ban miễn luật một camp khi phim ở lo_trinh) → T2 cắt lỗ.
def lo_trinh(cid): return json.loads(sql(f"select coalesce((select gia_tri->'{int(cid)}' from etp.cau_hinh where khoa = 'lo_trinh'), '{{}}'::jsonb)::text") or "{}")       # máy sinh KT làm tuần tự ~40–70 phút/phim, có hàng đợi
BUOC = [("nhan", 300), ("ws", 3600), ("poster", 900), ("cat", 4200), ("soat", 1800), ("creative", 3600), ("camp", 1200), ("chay", 7200)]   # (bước, hạn giây) — Mạnh huỷ khi quá
THU_MANG = {}         # (dòng, bước, lan) → số lượt đã tự thử lại vì lỗi mạng
CHO_LAI = 60          # bước trả "cho" → quay lại sau ngần này giây
TRAN_CAT = 2          # tối đa 2 dòng cắt cùng lúc (iMac)
DANG = {}             # (dòng, bước) → Popen đang chạy — để Mạnh / nút Dừng giết được
KHOA = threading.Lock()

def sql(cau, spy=False):
    nen = ". /root/.secrets/spy.env" if spy else ENV
    r = subprocess.run([*SSH, B, f'{nen}; psql "$DATABASE_URL" -qtA -F"\t" -v ON_ERROR_STOP=1 -f -'],
                       input=cau, capture_output=True, text=True, timeout=180)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def s(v): return "null" if v is None else "$Q$" + str(v).replace("$Q$", "") + "$Q$"
def js(v): return "$J$" + json.dumps(v, ensure_ascii=False).replace("$J$", "") + "$J$::jsonb"
def box(lenh, timeout=1800):
    """lệnh trên box3 (trong /opt/earns-marketing-os-v2, có env) — trả (mã thoát, stdout+stderr)"""
    r = subprocess.run([*SSH, B, f"{ENV}; timeout {int(timeout)} {lenh}"], capture_output=True, text=True, timeout=timeout + 60)
    return r.returncode, (r.stdout + r.stderr).strip()
def khoa_studio(ten): return json.loads(sql(f"select coalesce(gia_tri, '{{}}'::jsonb)::text from xv_khoa_ngoai where ten = '{ten}'") or "{}")

def tien_do(dong, buoc):
    """câu tiến độ cho người xem trong lúc bước chạy (tab Dòng phim vẽ thanh từ 'N/M') — None = không có số riêng"""
    try:
        if buoc == "cat":
            ra = os.path.join(C, "ra", f"dp{dong}"); thu = next((os.path.join(ra, x) for x in os.listdir(ra) if x.startswith("p-")), None)
            if not thu: return "đang tải tập phim"
            cid = os.path.basename(thu)[2:]; tap = os.path.join(C, "nguon", cid, "tap.json")
            m = len(json.load(open(tap))) if os.path.exists(tap) else 0
            n = len([x for x in os.listdir(thu) if x.endswith(".mp4") and not x.endswith(".goc.mp4") and x[:2] in ("t-", "c-")])
            return f"đang đọc chữ trên phim (trước khi cắt) · 0/{m or '?'} video" if not n else f"đã cắt {n}/{m or '?'} video"
    except Exception: return None
    return None

def giet_cay(pid):
    """giết CẢ CÂY con cháu trước, rồi nhóm của bước (03/11/2026: Huỷ và chạy lại bước cắt dòng #2 — tho.py chết nhưng cat-cuoi-lo nó mở bằng
    start_new_session là nhóm khác, sống mồ côi 1 giờ, hai lượt cắt cùng ghi một thư mục). Phải gom con cháu TRƯỚC khi giết cha (chết rồi ppid = 1, hết dò)."""
    ds, hang = [], [pid]
    while hang:
        c = hang.pop(); ds.append(c)
        hang += [int(x) for x in subprocess.run(["pgrep", "-P", str(c)], capture_output=True, text=True).stdout.split()]
    for x in reversed(ds):
        for f_ in (lambda: os.killpg(os.getpgid(x), signal.SIGKILL), lambda: os.kill(x, signal.SIGKILL)):
            try: f_()
            except Exception: pass

def chay_tien_trinh(dong, buoc, lenh, han, env=None):
    """Popen cả nhóm tiến trình, ghi pid; giết khi hết hạn hoặc khi bước bị đặt huy (Mạnh / nút Dừng / FIX) → (mã, đuôi stdout)"""
    log = os.path.join(C, "dong", f"{dong}-{buoc}.log"); os.makedirs(os.path.dirname(log), exist_ok=True)
    f = open(log, "w")
    pr = subprocess.Popen(lenh, stdout=f, stderr=subprocess.STDOUT, start_new_session=True, env={**os.environ, **(env or {})})
    with KHOA: DANG[(dong, buoc)] = pr
    sql(f"update etp.dong_buoc set pid = {pr.pid}, may = '{MAY}' where dong_id = {dong} and buoc = '{buoc}'")
    t0 = time.time()
    try:
        while pr.poll() is None:
            time.sleep(5)
            if time.time() - t0 > han or sql(f"select huy from etp.dong_buoc where dong_id = {dong} and buoc = '{buoc}'") == "t":
                giet_cay(pr.pid)
                pr.wait(); f.close()
                return -9, f"bị huỷ sau {int(time.time() - t0)}s ({'quá hạn' if time.time() - t0 > han else 'Mạnh / nút Dừng yêu cầu'}) — nhật ký (iMac): {log}"
            td = tien_do(dong, buoc) if int(time.time() - t0) % 30 < 5 else None   # 30 giây một lần: câu tiến độ cho tab Dòng phim
            sql(f"update etp.dong_buoc set nhip = now(){f', ghi = {s(td)}' if td else ''} where dong_id = {dong} and buoc = '{buoc}'")
    finally:
        with KHOA: DANG.pop((dong, buoc), None)
    f.close()
    return pr.returncode, open(log).read()[-3000:]

# ---------------- các bước: (dòng dict) → (kết, ghi, kết quả) ----------------
def nhan_bat_buoc():
    """công tắc etp.cau_hinh.nhan_bat_buoc (0418) — false = tạm bỏ cơ chế nhận phim (anh 04/11/2026); MỘT chỗ đọc cho bước Nhận + nhan_lai"""
    return sql("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'nhan_bat_buoc'), 'true')") != "false"

def b_nhan(d):
    cid = d["content_id"]
    goc = sql(f"select coalesce(nhom_goc, '') from etp.phim where content_id = {cid}")
    if not goc:   # CHẤM NHÓM GỐC NGAY (anh 04/11/2026 "chạy đủ các bước, kể cả phân tích loại phim, nhóm gốc"): AI nhìn poster ~36₫ (apps/etp/nhom_goc.py --ghi)
        rc, out = box(f"python3 apps/etp/nhom_goc.py {cid} --ghi", 300)
        goc = sql(f"select coalesce(nhom_goc, '') from etp.phim where content_id = {cid}")
        if not goc: return "loi", f"chưa chấm được nhóm gốc trên poster: {out[-200:]}", None
    if goc != "au_my":   # POSTER CHƯA RA ÂU-MỸ → xem thêm CẢNH TRONG PHIM rồi mới kết luận (anh 04/11/2026 "quét poster + vài cảnh trong phim")
        goc2, ghi_ = cham_bang_canh(cid)
        if goc2: goc = goc2
        if goc != "au_my": return "dung", f"nhóm gốc phim là '{goc or 'chưa rõ'}' (poster + cảnh: {ghi_[:160]}) — chỉ chạy phim Âu-Mỹ (luật anh 02/11/2026)", None
    if str(cid) in khoa_studio("ethopex_phim_cam"): return "dung", "phim nằm trong sổ cấm 18+ (ethopex_phim_cam)", None
    nhan_bb = nhan_bat_buoc()
    doi = "" if not nhan_bb else sql(f"select coalesce(max(nguoi), '') from etp.phim_nhan_v where content_id = {cid} and trang_thai in ('giu', 'da_len') and nguoi_id not in (select nguoi_id from etp.tai_khoan where nha)")
    if doi: return "dung", f"{doi} (đội) đang giữ phim này", None
    co = sql(f"select string_agg(camp_id::text, ' ') from etp.camp where content_id = {cid} and (trang_thai = 'ACTIVE' or coalesce(dong_bo, '') not in ('done', 'synced', 'error'))")
    if co: return "dung", f"phim đã có camp đang chạy: #{co} — mỗi lần chỉ lên một camp cho một phim (luật anh 03/11/2026)", None
    nhan_lai(cid)
    return "xong", ("Nhà nhận phim (giữ 24 giờ), " if nhan_bb else "") + "nhóm gốc Âu-Mỹ, không trong sổ cấm", None

def cham_bang_canh(cid):
    """tải 2 tập đầu (cùng thư mục bước Cắt dùng lại) → 4 khung giữa các tập → nhom_goc.py --khung-stdin --ghi trên box3 (poster + cảnh, ~36₫) → (nhóm, ghi)"""
    import base64, glob
    r = sql(f"select ten, url from ethopex_content where id = {int(cid)}", spy=True).split("\t")
    tm = os.path.join(C, "nguon", str(cid)); os.makedirs(tm, exist_ok=True)
    if not glob.glob(os.path.join(tm, "tap*.mp4")) and len(r) > 1 and r[1]:
        subprocess.run(["python3", os.path.join(E, "tai-tap.py"), r[1], tm, "2"], capture_output=True, text=True, timeout=600)
    taps = sorted(glob.glob(os.path.join(tm, "tap*.mp4")))[:2]
    if not taps: return None, "không tải được tập để xem cảnh"
    khung = []
    for t in taps:
        d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", t], capture_output=True, text=True).stdout.strip() or 0)
        for f in (0.3, 0.7):
            b = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(d * f), "-i", t, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "5", "-f", "mjpeg", "pipe:1"], capture_output=True, timeout=60).stdout
            if b: khung.append("data:image/jpeg;base64," + base64.b64encode(b).decode())
    if not khung: return None, "không cắt được khung cảnh"
    p = subprocess.run([*SSH, B, f"{ENV}; python3 apps/etp/nhom_goc.py {int(cid)} --ghi --khung-stdin"], input=json.dumps(khung), capture_output=True, text=True, timeout=300)
    goc = sql(f"select coalesce(nhom_goc, '') from etp.phim where content_id = {int(cid)}")
    return goc or None, (p.stdout.strip().splitlines() or [p.stderr.strip()[-200:]])[0]

def nhan_lai(cid):
    """Nhà giữ phim nếu chưa ai giữ — dùng ở bước Nhận và SAU KHI POSTER QUA (03/11/2026: poster cấm → kiem-phim-18 nha_phim_cam trả phim; anh bỏ chặn + FIX
    poster thì dòng chạy tiếp nhưng phim đã 'tra' → nhan-ban chặn 'phim mới chưa nhận', 2 phim kẹt ở bước camp)"""
    if not nhan_bat_buoc(): return   # tạm bỏ nhận (anh 04/11/2026, 0418)
    sql(f"""insert into etp.phim_nhan (content_id, nguoi_id, nguoi, het_luc)
            select {int(cid)}, g.nguoi_id, 'Nhà', now() + interval '24 hours' from (select nguoi_id from etp.tai_khoan where nha order by nguoi_id limit 1) g
            where not exists (select 1 from etp.phim_nhan_v n where n.content_id = {int(cid)} and n.trang_thai in ('giu', 'da_len'))""")

TRANG = r'''
import importlib.util, sys, json
s = importlib.util.spec_from_file_location("nb", "apps/xuong-video/scripts/ethopex/nhan-ban.py"); m = importlib.util.module_from_spec(s); sys.argv = ["nb"]; s.loader.exec_module(m)
tk = m.q("select ad_account_id from etp.tai_khoan where nha and ad_account_id is not null order by nguoi_id limit 1")
print(json.dumps({"ly": m.trang_chua_san(%d, tk)}, ensure_ascii=False))
'''
def b_ws(d):
    rc, out = box(f"python3 - <<'PYEOF'\n{TRANG % d['content_id']}\nPYEOF", 300)
    m = re.findall(r'^\{"ly".*$', out, re.M)
    if not m: return "loi", f"không đọc được cổng trang phim: {out[-200:]}", None
    ly = json.loads(m[-1])["ly"]
    if not ly: return "xong", "trang phim Nhà đủ mô tả + cốt truyện + ảnh + link tập 1", None
    if "vừa được máy" in ly or "còn thiếu" in ly:
        box("systemctl start --no-block etp-dong-bo", 30)   # đồng bộ kho trang phim ngay, không chờ 10 phút
        return "cho", ly, None
    return "dung", ly, None

def b_poster(d):
    cid = d["content_id"]
    rc, out = box(f"python3 apps/etp/soat_18_ai.py {cid} --ghi", 600)
    # dòng PHÁN "<cid>: False · 12₫ · AI soát poster …" — không lấy dòng cuối: đó là "tổng N₫" (04/11/2026 dòng #48 hiện lý do "tổng 36₫")
    phan = next((l.split(" · ", 2)[-1] for l in out.splitlines() if l.startswith(f"{cid}: ")), "")
    if str(cid) in khoa_studio("ethopex_phim_cam"): return "dung", f"AI soát poster cấm 18+: {(phan or (khoa_studio('ethopex_soat_18').get(str(cid)) or {}).get('ghi', 'cấm'))[:300]}", None
    v = khoa_studio("ethopex_soat_18").get(str(cid)) or {}
    if v.get("ok") is False: return "dung", f"soát 18+: {v.get('ghi', 'cấm')}", None
    if rc: return "loi", f"soát poster lỗi (mã {rc}): {out[-200:]}", None
    nhan_lai(cid)   # poster qua (kể cả sau khi bỏ chặn) → phim phải đang được Nhà giữ
    return "xong", (out.splitlines() or ["poster sạch"])[-1][:300], None

def b_cat(d):
    cid, lo = d["content_id"], f"dp{d['id']}"
    r = sql(f"select ten, url, locale, nguon from ethopex_content where id = {cid}", spy=True).split("\t")
    if len(r) < 2 or not r[1]: return "loi", "không tìm thấy link tập trong ethopex_content (spy)", None
    sql(f"""delete from etp.viec where lo = '{lo}';   -- lô riêng của dòng: chạy lại bước = xếp lại từ đầu
            insert into etp.viec (loai, lo, content_id, du_lieu) values ('cat', '{lo}', {cid}, {js({"locale": r[2] or "en", "nguon": r[3] if len(r) > 3 else "", "ten": r[0], "url": r[1], "so_ban": 10 if d.get("loai") == "LT" else (max(2, int(d.get("so_camp") or 0) - san_cua(cid)) + 3 if d.get("so_camp") else 2), **({"kieu": "tap"} if d.get("loai") == "LT" else {})})}) on conflict do nothing""")
    rc, out = chay_tien_trinh(d["id"], "cat", ["python3", os.path.join(R, "tho.py"), "--lo", lo, "--so-tho", "1"], dict(BUOC)["cat"] - 60)
    kq = json.loads(sql(f"select coalesce(ket_qua, '[]'::jsonb)::text || chr(9) || coalesce(loi, '') from etp.viec where lo = '{lo}' order by id desc limit 1").split("\t")[0] or "[]")
    loi = sql(f"select coalesce(loi, '') from etp.viec where lo = '{lo}' order by id desc limit 1")
    ok = [x for x in kq if x.get("file") and not x.get("loi") and os.path.exists(x["file"])]
    if d.get("so_camp"):   # MỞ RỘNG: bỏ khung chồng lên đoạn đã có creative của phim (04/11/2026 dòng #35 cắt lại đúng đoạn #64977 → cổng trùng đoạn chặn hết)
        da = [tuple(map(float, l.split("\t"))) for l in sql(f"select tu, den from etp.creative where content_id = {cid} and tu is not null and den is not null").splitlines() if l.count("\t") == 1]
        bo = [x for x in ok if any(float(x["tu"]) < b and float(x["den"]) > a for a, b in da)]; ok = [x for x in ok if x not in bo]
        if not ok and bo: return "dung", f"mọi khung cuối tập cắt được đều trùng đoạn đã có creative ({len(bo)} khung) — phim hết khung mới", None   # không cắt ra khung nào ≠ hết khung mới (05/11/2026 #51 báo "0 khung" khi thật ra cắt quá giờ) → rơi xuống nhánh lỗi
    if ok: return "xong", f"cắt {len(ok)} đoạn: " + ", ".join(f"{x['tu']:.0f}–{x['den']:.0f}s" for x in ok), {"doan": ok, "lo": lo}
    g = loi or " ".join(str(x.get("loi")) for x in kq) or out[-200:]
    return ("loi" if rc == -9 or LK.ky_thuat(g) is not False else "dung"), f"không ra đoạn nào: {g[:300]}", None

def b_soat(d, truoc):
    doan = (truoc.get("cat") or {}).get("doan") or []
    if not doan: return "loi", "bước cắt không để lại đoạn nào", None
    thu = os.path.join(C, "ra", f"dp{d['id']}", "soat"); os.makedirs(thu, exist_ok=True)
    json.dump(doan, open(os.path.join(thu, "lo.json"), "w"), ensure_ascii=False)
    rc, out = chay_tien_trinh(d["id"], "soat", ["python3", os.path.join(E, "soat_doan.py"), "lo", thu], dict(BUOC)["soat"] - 60)
    if rc == -9: return "loi", out[-300:], None
    s_ = khoa_studio("ethopex_soat_doan"); k = lambda x: f"{int(x['content_id'])}:{int(round(float(x['tu'])))}-{int(round(float(x['den'])))}"
    ok = [x for x in doan if (s_.get(k(x)) or {}).get("ok") is True]
    cam = [f"{k(x)}: {(s_.get(k(x)) or {}).get('ghi', 'chưa có kết quả')[:120]}" for x in doan if x not in ok]
    if not ok: return "dung", "soát đoạn: không còn đoạn sạch — " + " · ".join(cam)[:500], None
    return "xong", f"{len(ok)}/{len(doan)} đoạn sạch" + (f" · bỏ {' · '.join(cam)}"[:400] if cam else ""), {"doan": ok}

def b_creative(d, truoc):
    if d.get("loai") == "KT": return b_creative_kt(d)
    if d.get("loai") == "LT" or (d.get("so_camp") and d.get("loai") != "KT"): return b_creative_lt(d, truoc)   # mở rộng: tải MỌI đoạn sạch
    tr = (d.get("buoc") or {}).get("creative") or {}
    cr = (tr.get("ket_qua") or {}).get("creative_id")
    if not cr:   # lượt đầu: tải MỘT đoạn (luật một camp mỗi lần, anh 03/11/2026)
        doan = ((truoc.get("soat") or {}).get("doan") or [])[:1]
        if not doan: return "loi", "bước soát không để lại đoạn sạch", None
        ma = f"dp{d['id']}l{tr.get('lan') or 1}"; lf = os.path.join(C, "ra", f"dp{d['id']}", f"len-{ma}.json")
        json.dump([{**x, "lo": f"dp{d['id']}"} for x in doan], open(lf, "w"), ensure_ascii=False)
        rc, out = chay_tien_trinh(d["id"], "creative", ["python3", os.path.join(E, "len-creative.py"), lf, ma, "canh cuoi", "--da-soat"], dict(BUOC)["creative"] - 300, {"ETP_KHONG_CAT": "1"})
        lj = os.path.join(C, "ra", ma, "len.json")
        kq = json.load(open(lj)) if os.path.exists(lj) else []
        x = next((y for y in kq if y.get("ok") and y.get("creative_id")), None)
        if not x:
            g = " ".join(str(y.get("loi")) for y in kq) or out[-300:]
            return ("loi" if rc == -9 or not kq or LK.ky_thuat(g) is not False else "dung"), f"tải creative không ra: {g[:300]}", None
        sql(f"update etp.dong_buoc set ket_qua = {js(x)} where dong_id = {d['id']} and buoc = 'creative'"); sql(f"update etp.dong_phim set creative_id = {int(x['creative_id'])} where id = {d['id']}")
        cr = x["creative_id"]; tr = {"ket_qua": x}
    c = sql(f"select duoc_len::text || chr(9) || coalesce(chan_boi, '') || chr(9) || coalesce(cho_duyet, '') from etp.cham_cong where creative_id = {int(cr)}").split("\t")
    c += [""] * (3 - len(c))   # psql .strip() cắt tab cuối khi chan_boi / cho_duyet rỗng — đừng đọc thành "chưa chấm" (03/11/2026: dòng #1 chờ oan 30 phút)
    if c[0] == "": return "cho", f"creative #{cr} đã tải — chờ máy chấm (etp.cham_hang)", tr["ket_qua"]
    if c[0] == "true": return "xong", f"creative #{cr} chấm sạch", tr["ket_qua"]
    return "dung", f"creative #{cr} bị cổng chấm {'giữ chờ người duyệt' if len(c) > 2 and c[2] else 'chặn'}: {c[1][:200]}", tr["ket_qua"]

def b_creative_lt(d, truoc):
    """LT: tải MỌI đoạn sạch (mỗi tập một creative) → chờ chấm hết → xong khi còn ≥ 1 creative được lên"""
    tr = (d.get("buoc") or {}).get("creative") or {}; ds = (tr.get("ket_qua") or {}).get("ds")
    if not ds:
        doan = (truoc.get("soat") or {}).get("doan") or []
        if not doan: return "loi", "bước soát không để lại đoạn sạch", None
        ma = f"dp{d['id']}lt"; lf = os.path.join(C, "ra", f"dp{d['id']}", f"len-{ma}.json")
        json.dump([{**x, "lo": f"dp{d['id']}"} for x in doan], open(lf, "w"), ensure_ascii=False)
        rc, out = chay_tien_trinh(d["id"], "creative", ["python3", os.path.join(E, "len-creative.py"), lf, ma, "tap nguyen", "--da-soat"], dict(BUOC)["creative"] - 300, {"ETP_KHONG_CAT": "1"})
        lj = os.path.join(C, "ra", ma, "len.json"); kq = json.load(open(lj)) if os.path.exists(lj) else []
        ds = [y for y in kq if y.get("ok") and y.get("creative_id")]
        if not ds:
            g = " ".join(str(y.get("loi")) for y in kq) or out[-300:]
            return ("loi" if rc == -9 or not kq or LK.ky_thuat(g) is not False else "dung"), f"tải creative không ra: {g[:300]}", None
        sql(f"update etp.dong_buoc set ket_qua = {js({'ds': ds})} where dong_id = {d['id']} and buoc = 'creative'")
    ids = ",".join(str(int(x["creative_id"])) for x in ds)
    c = dict(l.split("\t")[:2] for l in sql(f"select creative_id, coalesce(duoc_len::text, '') from etp.cham_cong where creative_id in ({ids})").splitlines() if "\t" in l)
    if any(c.get(str(x["creative_id"]), "") == "" for x in ds): return "cho", f"{len(ds)} creative đã tải — chờ máy chấm ({sum(1 for v in c.values() if v)} / {len(ds)} xong)", {"ds": ds}
    sach = [x for x in ds if c.get(str(x["creative_id"])) == "true"]
    if not sach: return "dung", f"cả {len(ds)} creative bị cổng chấm chặn / giữ", {"ds": ds}
    return "xong", f"{len(sach)}/{len(ds)} creative chấm sạch: " + ", ".join(f"#{x['creative_id']}" for x in sach), {"ds": ds, "sach": sach}

def b_creative_kt(d):
    """KT: dòng đứng đầu hàng đợi máy sinh kể chuyện (hang-ke-chuyen.mts bậc 5000) → chờ creative kể chuyện MỚI của phim (tạo sau lúc bước này bắt đầu) → cổng chấm"""
    v = sql(f"""select coalesce(r.creative_id::text, '') || chr(9) || coalesce(g.duoc_len::text, '') || chr(9) || coalesce(g.chan_boi, '') || chr(9) || coalesce(g.cho_duyet, '')
                || chr(9) || coalesce(r.lang, 'en') || chr(9) || coalesce(r.tu, 0) || chr(9) || coalesce(r.den, 0)
                from etp.creative r left join etp.cham_cong g using (creative_id)
                where r.content_id = {d['content_id']} and r.dang = 'kể chuyện' and r.tu_choi is null
                  and r.cap_nhat >= (select bat_dau from etp.dong_buoc where dong_id = {d['id']} and buoc = 'creative') order by r.creative_id desc limit 1""").split("\t")
    if not v or not v[0]:
        tv = sql(f"select coalesce(trang_thai, '') || ' ' || coalesce(left(ghi, 160), '') from etp.thu_vien where content_id = {d['content_id']} and dang = 'kể chuyện' and tao >= (select bat_dau from etp.dong_buoc where dong_id = {d['id']} and buoc = 'creative') order by id desc limit 1")
        if tv.startswith("loai") or tv.startswith("loi_may"): return "loi", f"máy sinh kể chuyện hỏng: {tv[:300]}", None
        # máy bỏ phim TRƯỚC khi bước chạy (dòng #5: 'loai' 06:49, bước 10:41 → chờ mù 4 giờ): hàng đợi nay không để dòng phim KT bị sổ bỏ 3 ngày chặn (hang-ke-chuyen.mts) — ghi rõ cho người xem
        cu = sql(f"select coalesce(left(ghi, 140), '') from etp.thu_vien where content_id = {d['content_id']} and dang = 'kể chuyện' and trang_thai = 'loai' and tao >= (select tao_luc from etp.dong_phim where id = {d['id']}) order by id desc limit 1")
        if cu: return "cho", f"lần trước máy sinh bỏ ({cu}) — đã xếp lại đầu hàng đợi (bậc 5000), chờ máy nhận"[:300], None
        return "cho", f"máy sinh kể chuyện: {tv or 'phim đứng đầu hàng đợi (bậc 5000), chờ máy nhận'}"[:300], None
    cr = int(v[0]); kq = {"creative_id": cr, "lang": v[4], "tu": float(v[5] or 0), "den": float(v[6] or 0), "ten": f"dp{d['id']} {re.sub(r'[^ -~]', '', d.get('ten') or '')} {v[4].upper()} - ke chuyen"}
    sql(f"update etp.dong_phim set creative_id = {cr} where id = {d['id']}")
    if v[1] == "": return "cho", f"creative kể chuyện #{cr} đã lên — chờ máy chấm", kq
    if v[1] == "true": return "xong", f"creative kể chuyện #{cr} chấm sạch", kq
    return "dung", f"creative #{cr} bị cổng chấm {'giữ chờ người duyệt' if v[3] else 'chặn'}: {v[2][:200]}", kq

# LÊN CAMP PHẢI LÀM LẠI ĐƯỢC (04/11/2026: dòng #11 / #35 / #45 dừng "creative đã có camp đang chạy / vừa tạo" — lượt đầu đã tạo camp rồi bị Mạnh huỷ / FIX,
# lượt sau thấy CHÍNH camp đó là trùng; #35 thì máy luật lấy creative của dòng thay vào camp cũ). Creative đã có camp = ĐÃ LÊN, gắn camp đó vào dòng;
# Ethopex báo có camp mà etp.camp chưa đồng bộ (10 phút) → chờ, không dừng.
TRUNG_CR = "đã có camp đang chạy / vừa tạo"
def camp_co_san(crs):
    """creative → camp đã có (ưu tiên camp ACTIVE, mới nhất)"""
    crs = [int(c) for c in crs]
    if not crs: return {}
    return {int(a): int(b) for a, b in (l.split("\t") for l in sql(f"""select distinct on (creative_id) creative_id, camp_id from etp.camp where creative_id in ({','.join(map(str, crs))})
        order by creative_id, (trang_thai = 'ACTIVE') desc, tao desc nulls last""").splitlines() if l.count("\t") == 1)}
def ket_camp(d, xong, loi, cu, gan=None):
    """kết bước Lên camp: camp mới (xong) + camp đã có của creative (cu) đều tính là đã lên; chỉ còn creative 'vừa tạo' chưa đồng bộ thì chờ"""
    tat = list(dict.fromkeys([*xong, *cu.values()]))
    if not tat:
        if any(TRUNG_CR in str(x) for x in loi): return "cho", "Ethopex báo creative đã có camp vừa tạo — chờ đồng bộ etp.camp (10 phút) để gắn camp vào dòng: " + " · ".join(map(str, loi))[:300], None
        return "dung", "không lên được camp nào: " + " · ".join(map(str, loi))[:400], None
    sql(f"update etp.dong_phim set camp_id = {int(tat[0])} where id = {d['id']}")
    loi = [x for x in loi if TRUNG_CR not in str(x)]
    return "xong", (f"lên {len(xong)} camp $1: " + ", ".join(f"#{c}" for c in xong) if xong else "không cần tạo camp mới") \
        + (f" · creative đã có camp: " + ", ".join(f"#{c}→camp #{k}" for c, k in cu.items()) if cu else "") \
        + (f" · chặn {len(loi)}: " + " · ".join(map(str, loi))[:300] if loi else ""), {"camp_id": int(tat[0]), "camps": tat, **({"gan": gan + [{"creative_id": c, "camp": k} for c, k in cu.items()]} if gan is not None else {})}

def b_camp_lt(d, truoc):
    sach = (truoc.get("creative") or {}).get("sach") or []
    if not sach: return "loi", "chưa có creative sạch", None
    if not lo_trinh(d["content_id"]).get("bat_dau"):
        return "cho", f"sẵn {len(sach)} creative sạch → {len(sach)} camp × $1 ≈ ${len(sach)}/ngày (bộ 2, T2 cắt lỗ) — CHỜ ANH BẮT ĐẦU", None
    xong, loi, gan = [], [], []   # gan: creative → camp (tab Dòng phim vẽ mỗi video một ô)
    cu = camp_co_san(x["creative_id"] for x in sach)
    sach = [x for x in sach if int(x["creative_id"]) not in cu]   # creative đã có camp (anh lên riêng #1520 / lượt trước của chính dòng) = đã lên — không đi vào luật "một creative một camp" thành lỗi
    for i_, x in enumerate(sach):
        sql(f"update etp.dong_buoc set ghi = {s(f'anh đã duyệt — đang lên camp {i_ + 1}/{len(sach)} (creative #{x["creative_id"]})')}, nhip = now() where dong_id = {d['id']} and buoc = 'camp'")   # trang Sản xuất thấy tiến độ ngay sau khi anh bấm
        lang = x.get("lang") or "en"; ten = re.sub(r"['\"$`\\]", "", x.get("ten") or f"dp{d['id']} phim {d['content_id']}")
        rc, out = box(f"""bash -c 'cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON.get(lang, KHUON["en"])} --tay --bo 2 --creative {int(x["creative_id"])} --content {d["content_id"]} --ten "{ten}" --that --luat "lộ trình test rộng (anh 03/11/2026: 8-10 USD/phim + T2)" --ai "dòng phim LT — anh bắt đầu"'""", 900)
        j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{") and '"ok"' in l), None) or {}
        (xong if j.get("ok") and j.get("moi") else loi).append(j.get("moi") or f"#{x['creative_id']}: {(j.get('loi') or out[-120:])[:120]}")
        if j.get("ok") and j.get("moi"): gan.append({"creative_id": int(x["creative_id"]), "camp": int(j["moi"])})
    return ket_camp(d, xong, loi, cu, gan)

def san_dung_lai(cid):
    """creative DÙNG LẠI ĐƯỢC của phim — ĐÚNG các cổng nhan-ban.py sẽ chặn (04/11/2026: dòng #49/#50 phim 167292 đếm creative CTA cũ là 'có sẵn', bỏ cắt,
    tới bước Lên camp cả 6 bị chặn 'chưa đạt luật CTA mới'): chấm đạt · ĐẠT CTA mới (etp.creative.cta_dat) · chưa bị Meta từ chối · chưa có camp ·
    không cùng đoạn với camp đang chạy / đang đồng bộ của phim. MỘT chỗ — bước dựng dòng và bước Lên camp cùng gọi."""
    return [int(x) for x in sql(f"""select r.creative_id from etp.creative r join etp.cham_cong g using (creative_id)
        where r.content_id = {int(cid)} and g.duoc_len and r.cta_dat and r.tu_choi is null
          and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)
          and (r.doan is null or r.doan not in (select k.doan from etp.camp c join etp.creative k using (creative_id) where c.content_id = {int(cid)} and k.doan is not null
                                                and (c.trang_thai = 'ACTIVE' or coalesce(c.dong_bo, '') not in ('done', 'synced', 'error'))))
        order by r.creative_id desc""").split() if x.isdigit()]
def san_cua(cid): return len(san_dung_lai(cid))

def b_camp_mr(d, truoc):
    """MỞ RỘNG (anh bấm ＋ ở dòng phim, chọn số camp): creative sạch vừa làm + creative sạch có sẵn chưa có camp của phim → lên đúng so_camp camp $1 (bộ của phim)"""
    cr = truoc.get("creative") or {}; moi = [int(x["creative_id"]) for x in (cr.get("sach") or ([cr] if cr.get("creative_id") else []))]
    san = san_dung_lai(d["content_id"])
    cu = camp_co_san(moi)   # creative của chính dòng đã có camp (lượt trước bị huỷ giữa chừng / máy luật lấy thay) = đã lên, tính vào số camp
    ds = [c for c in dict.fromkeys(moi + san) if c not in cu][:max(0, int(d["so_camp"]) - len(cu))]
    if not ds and not cu: return "dung", "không có creative sạch nào để lên camp", None
    bo = sql(f"select coalesce((select gia_tri->>'{d['content_id']}' from xv_khoa_ngoai where ten = 'ethopex_phim_tk'), '2')") or "2"
    xong, loi = [], []
    for i_, c in enumerate(ds):
        sql(f"update etp.dong_buoc set ghi = {s(f'đang lên camp {i_ + 1}/{len(ds)} (creative #{c})')}, nhip = now() where dong_id = {d['id']} and buoc = 'camp'")
        lang = sql(f"select coalesce(lang, 'en') from etp.creative where creative_id = {c}") or "en"
        ten = re.sub(r"[^ -~]|['\"$`\\]", "", f"dp{d['id']} {d.get('ten') or ''} {lang.upper()} - mo rong #{c}")
        rc, out = box(f"""bash -c 'cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON.get(lang, KHUON["en"])} --tay --bo {bo} --creative {c} --content {d["content_id"]} --ten "{ten}" --that --luat "mở rộng phim — anh chọn {d['so_camp']} camp (etp.on.tc)" --ai "anh (etp.on.tc: nút mở rộng ở dòng phim, 04/11/2026)"'""", 900)
        j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{") and '"ok"' in l), None) or {}
        if j.get("ok") and j.get("moi"): xong.append(int(j["moi"]))
        else: loi.append(f"#{c}: {(j.get('loi') or out[-120:])[:120]}")
    ket, ghi, kq = ket_camp(d, xong, loi, cu)
    thieu = int(d["so_camp"]) - len(xong) - len(cu)
    return ket, (f"{len(xong) + len(cu)}/{d['so_camp']} camp · " + ghi + (f" · thiếu {thieu} (không đủ creative sạch)" if thieu > 0 and not loi else "")) if ket == "xong" else ghi, kq

def b_camp(d, truoc):
    if d.get("so_camp"): return b_camp_mr(d, truoc)
    if d.get("loai") == "LT": return b_camp_lt(d, truoc)
    # BỘ CREATIVE ĐỦ LOẠI TRƯỚC, CHƯA LÊN CAMP (anh 03/11/2026 "phải làm đủ 1 bộ creative cho mọi loại nội dung trước. Chưa lên camp"):
    # phim có etp.cau_hinh lo_trinh[cid].bo mà anh chưa bắt đầu → mọi loại (CC / KT …) dừng ở đây, giữ creative đã chấm
    lt = lo_trinh(d["content_id"])
    if lt.get("bo") and not lt.get("bat_dau"): return "cho", "bộ creative đủ loại — chưa lên camp, CHỜ ANH BẮT ĐẦU", None
    x = truoc.get("creative") or {}
    if not x.get("creative_id"): return "loi", "chưa có creative", None
    if (cu := camp_co_san([x["creative_id"]])): return ket_camp(d, [], [], cu)
    lang = x.get("lang") or "en"; ten = re.sub(r"['\"$`\\]", "", x.get("ten") or f"dp{d['id']} phim {d['content_id']}")
    rc, out = box(f"""bash -c 'cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON.get(lang, KHUON["en"])} --tay --bo 2 --creative {int(x["creative_id"])} --content {d["content_id"]} --ten "{ten}" --that --luat "dòng phim tự động #{d["id"]} (etp.on.tc)" --ai "anh (etp.on.tc: Chạy tự động dòng phim, 03/11/2026)"'""", 900)
    j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{") and '"ok"' in l), None)
    if not j: return "loi", f"nhan-ban không trả kết quả: {out[-300:]}", None
    if j.get("ok") and j.get("moi"):
        sql(f"update etp.dong_phim set camp_id = {int(j['moi'])} where id = {d['id']}")
        return "xong", f"lên camp #{j['moi']} ($1, bộ 2, chạy từ 07:00 VN hôm sau)", {"camp_id": int(j["moi"])}
    g = j.get("loi") or out[-200:]
    if TRUNG_CR in g: return ket_camp(d, [], [g], {})
    if j.get("ok") is None: return ("cho" if "lượt sau" in g else "dung"), f"cổng luật chặn: {g[:400]}", None   # ChanLuat; trang vừa sửa → thử lại
    return "loi", f"Ethopex lỗi tạo camp: {g[:400]}", None

DOC_CAMP = r'''
import sys, json; sys.path.insert(0, "apps/etp"); import ethopex_api as EA
c = next((x for x in EA.api("/api/v1/campaigns?page_size=200")["data"] if int(x["id"]) == %d), {})
print(json.dumps({k: c.get(k) for k in ("state", "sync_status", "error")}))
'''
def b_chay(d, truoc):
    camp = (truoc.get("camp") or {}).get("camp_id") or d.get("camp_id")
    if not camp: return "loi", "chưa có camp", None
    rc, out = box(f"python3 - <<'PYEOF'\n{DOC_CAMP % int(camp)}\nPYEOF", 120)
    j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{")), None)
    if not j: return "cho", f"chưa đọc được trạng thái camp #{camp}: {out[-150:]}", None
    if j.get("error"): return "loi", f"camp #{camp} lỗi đồng bộ: {j['error']}", None
    if j.get("sync_status") == "done" and j.get("state") == "ACTIVE": return "xong", f"camp #{camp} đang chạy (ACTIVE)", {"camp_id": camp}
    if j.get("sync_status") == "done" and j.get("state") == "PAUSED": return "dung", f"camp #{camp} đồng bộ xong nhưng PAUSED (có người / máy luật tắt)", None
    return "cho", f"camp #{camp} {j.get('state')} · {j.get('sync_status')} — chờ Ethopex kiểm ad", None

# DỌN TỆP THỪA TRÊN iMAC NGAY KHI PHIM SẢN XUẤT XONG (anh 04/11/2026 "sx xong phim nào trên iMAC thì dọn file thừa ngay lập tức" — đĩa còn 11 GB,
# nguon 70 GB · ra 18 GB · vx-kc 4 GB). Chỉ dọn thứ máy tự sinh lại được và không còn ai dùng:
#   ra/dp<id>*   — đoạn cắt / tệp tải creative của dòng đã XONG (dòng dừng / lỗi: hết 3 ngày Mạnh còn mở lại)
#   nguon/<phim> — tập gốc tải về, khi phim không còn dòng chạy, không còn việc cắt chờ / đang làm, và 30 phút không ai ghi
#   vx-kc/<tập>  — clip máy sinh kể chuyện, khi bản đó đã thành creative (thư viện có creative_id) / đã lên; bản bị bỏ thì sau 2 ngày
DON = [0.0]
def don_dep():
    import shutil
    ds = [l.split("\t") for l in sql("select id, trang_thai, (tao_luc < now() - interval '3 days')::text, content_id from etp.dong_phim").splitlines() if l.count("\t") == 3]
    xong = {int(i) for i, tt, cu, _ in ds if tt == "xong" or (tt in ("dung", "loi", "huy") and cu == "true")}
    dung = {c for _, tt, _, c in ds if tt == "chay"} | set(sql("select distinct content_id from etp.viec where trang_thai in ('cho', 'dang') and content_id is not null").split())
    xa = {t for t in sql("select tap_id from etp.thu_vien where tap_id is not null and (creative_id is not null or trang_thai = 'da_len' or (trang_thai = 'loai' and cap_nhat < now() - interval '2 days'))").split()}
    bo, tong = [], 0
    def xoa(p):
        nonlocal tong
        tong += sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(p) for f in fs if os.path.isfile(os.path.join(r, f)))
        shutil.rmtree(p, ignore_errors=True); bo.append(os.path.basename(p))
    for ten in os.listdir(os.path.join(C, "ra")):
        m = re.fullmatch(r"dp(\d+)(l\w*)?", ten)
        if m and int(m.group(1)) in xong: xoa(os.path.join(C, "ra", ten))
    for ten in os.listdir(os.path.join(C, "nguon")):
        p_ = os.path.join(C, "nguon", ten)
        if ten.isdigit() and os.path.isdir(p_) and ten not in dung and time.time() - max([os.path.getmtime(p_)] + [os.path.getmtime(os.path.join(r, f)) for r, _, fs in os.walk(p_) for f in fs]) > 1800: xoa(p_)
    for ten in os.listdir(os.path.join(C, "vx-kc")):
        p_ = os.path.join(C, "vx-kc", ten)
        if ten.isdigit() and os.path.isdir(p_) and ten in xa: xoa(p_)
    if bo: print(f"[{time.strftime('%H:%M:%S')}] dọn {len(bo)} thư mục · {tong / 1e9:.1f} GB ({', '.join(bo[:12])}{' …' if len(bo) > 12 else ''})", flush=True)

HAM = {"nhan": b_nhan, "ws": b_ws, "poster": b_poster, "cat": b_cat, "soat": b_soat, "creative": b_creative, "camp": b_camp, "chay": b_chay}

# ---------------- dựng dự phòng cho studio (anh 03/11/2026: "Cấm mày ren video trên box3" · "CF lỗi thì lùi về iMAC") ----------------
# studio (apps/xuong-video/src/lib/xuong-video/may-dung-cf.ts) dựng ở máy Cloudflare; lỗi thì xếp xv_dung_imac (0414) và chờ. iMac KÉO việc
# (box3 không ssh được tới iMac): tải thư mục lượt về, ffmpeg tại iMac, đẩy MP4 về đúng chỗ trên box3.
FONTS = os.path.join(R, "..", "xuong-video", "public", "fonts")
def dung_imac():
    try: j = sql(f"""update xv_dung_imac set trang_thai = 'dang', may = '{MAY}', bat_dau = now() where id = (select id from xv_dung_imac where trang_thai = 'cho'
               and tao > now() - interval '25 minutes' order by id for update skip locked limit 1) returning json_build_object('id', id, 'thu_muc', thu_muc, 'args', args, 'ra', ra)""")
    except Exception as e: return print(f"hàng dựng dự phòng chưa đọc được: {str(e)[:120]}", flush=True)
    if not j: return
    v = json.loads(j); t0 = time.time(); tm = os.path.join(C, "dung-imac", str(v["id"])); os.makedirs(tm, exist_ok=True)
    try:
        r = subprocess.run(["rsync", "-a", "--exclude", v["ra"], f"{B}:{v['thu_muc'].rstrip('/')}/", tm + "/"], capture_output=True, text=True, timeout=600)
        if r.returncode: raise RuntimeError(f"tải đầu vào: {r.stderr[-200:]}")
        args = [a.replace("@DIR@", tm).replace("@FONTS@", os.path.abspath(FONTS)) for a in v["args"]]
        r = subprocess.run(["ffmpeg", *args], capture_output=True, text=True, timeout=15 * 60)
        ra = os.path.join(tm, v["ra"])
        if r.returncode or not os.path.exists(ra): raise RuntimeError(f"ffmpeg: {r.stderr[-300:]}")
        r = subprocess.run(["scp", "-q", ra, f"{B}:{v['thu_muc'].rstrip('/')}/{v['ra']}"], capture_output=True, text=True, timeout=600)
        if r.returncode: raise RuntimeError(f"đẩy MP4 về box3: {r.stderr[-200:]}")
        sql(f"update xv_dung_imac set trang_thai = 'xong', xong = now(), giay = {time.time() - t0:.1f} where id = {v['id']}")
        print(f"[{time.strftime('%H:%M:%S')}] dựng dự phòng #{v['id']} xong ({time.time() - t0:.0f}s)", flush=True)
    except Exception as e:
        sql(f"update xv_dung_imac set trang_thai = 'loi', xong = now(), loi = {s(str(e)[:400])} where id = {v['id']}")
        print(f"[{time.strftime('%H:%M:%S')}] dựng dự phòng #{v['id']} lỗi: {str(e)[:200]}", flush=True)
    finally:
        subprocess.run(["mv", tm, os.path.expanduser(f"~/.Trash/dung-imac-{v['id']}")], capture_output=True)   # không xoá thẳng (luật nhà) — vào Thùng rác

# ---------------- vòng chính ----------------
def doc_dong():
    j = sql("""select coalesce(json_agg(x), '[]') from (select p.id, p.content_id, p.ten, p.trang_thai, p.camp_id, p.loai, p.so_camp,
               (select json_object_agg(b.buoc, json_build_object('trang_thai', b.trang_thai, 'ket_qua', b.ket_qua, 'lan', b.lan, 'fix', b.fix, 'huy', b.huy,
                       'tuoi', extract(epoch from now() - coalesce(b.nhip, b.bat_dau))::int)) from etp.dong_buoc b where b.dong_id = p.id) buoc
               from etp.dong_phim p where p.trang_thai = 'chay' or exists (select 1 from etp.dong_buoc b where b.dong_id = p.id and b.fix) order by p.id) x""")
    return json.loads(j or "[]")

# HẾT NGUYÊN LIỆU CẮT THÌ CHUYỂN KỂ CHUYỆN (anh 04/11/2026 "vì sao vẫn còn film ko thể sx và cách khắc phục triệt để"): cắt / soát / chấm hết đường
# (mọi khung trùng đoạn đã có · không còn đoạn sạch · creative bị cổng chấm chặn) → dựng một dòng KT cho phim, cùng số camp, đứng đầu hàng máy sinh
# (bậc 5000) — máy sinh vốn chạy liên tục theo hàng đợi, dòng này chỉ đổi thứ tự, không thêm lượt sinh. Mỗi phim một dòng KT trong 3 ngày.
HET_NL = re.compile(r"hết khung mới|không còn đoạn sạch|bị cổng chấm chặn|creative bị cổng chấm chặn / giữ")
def sang_ke_chuyen(d, buoc, ghi):
    if d.get("loai") == "KT" or buoc not in ("cat", "soat", "creative") or not HET_NL.search(ghi or ""): return None
    cid = int(d["content_id"])
    if str(cid) in khoa_studio("ethopex_phim_cam"): return None
    co = sql(f"select id from etp.dong_phim where content_id = {cid} and loai = 'KT' and tao_luc > now() - interval '3 days' order by id desc limit 1")
    if co: return f"đã có dòng kể chuyện #{co} cho phim"
    moi = sql(f"""insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp) select content_id, ten, the_loai, 'KT', 'máy: dòng #{d["id"]} hết nguyên liệu cắt', so_camp
                  from etp.dong_phim where id = {d['id']} returning id""")
    return f"tự chuyển sang kể chuyện: dòng #{moi}" if moi else None

def lam_buoc(d, buoc):
    truoc = {k: (v.get("ket_qua") or {}) for k, v in (d.get("buoc") or {}).items() if v.get("trang_thai") == "xong"}
    try: ket, ghi, kq = HAM[buoc](d) if buoc in ("nhan", "ws", "poster", "cat") else HAM[buoc](d, truoc)
    except Exception as e: ket, ghi, kq = "loi", f"{type(e).__name__}: {str(e)[:300]}", None
    if sql(f"select huy::text from etp.dong_buoc where dong_id = {d['id']} and buoc = '{buoc}'") == "true" and ket != "xong":
        ket, ghi = "loi", f"bị huỷ (Mạnh / nút Dừng) — {ghi}"
    k_mang = (d["id"], buoc, int(((d.get("buoc") or {}).get(buoc) or {}).get("lan") or 0))   # đếm RIÊNG lượt thử lại vì mạng của LẦN bật này — `lan` đếm cả FIX tay và không tăng khi thử lại (05/11/2026: #51 đã FIX 4 lần → không bao giờ được thử lại)
    if ket == "loi" and re.search(r"ssh:|Connection (closed|reset|refused|timed out)|kex_exchange|Operation timed out|Broken pipe|mux_client|Session open refused|Control ?[Ss]ocket", ghi or "") and THU_MANG.get(k_mang, 0) < 3:
        THU_MANG[k_mang] = THU_MANG.get(k_mang, 0) + 1
        ket, ghi = "cho", f"lỗi mạng tới box3, thử lại {THU_MANG[k_mang]}/3 — {ghi[:200]}"   # LỖI MẠNG TỰ THỬ LẠI (04/11/2026: 3 dòng chết vì box3 ngắt ssh) — tối đa 3 lượt · mux_client / Session open refused = kênh ssh dùng chung bị box3 từ chối (22:08 04/11: #15 #21 #51)
    if ket == "cho":
        sql(f"update etp.dong_buoc set ghi = {s(ghi)}, nhip = now(){', ket_qua = ' + js(kq) if kq else ''} where dong_id = {d['id']} and buoc = '{buoc}' and trang_thai = 'dang'")
        return
    sql(f"""update etp.dong_buoc set trang_thai = '{ket}', ket_thuc = now(), ghi = {s(ghi)}, nhip = now(), pid = null, huy = false{', ket_qua = ' + js(kq) if kq is not None else ''}
            where dong_id = {d['id']} and buoc = '{buoc}' and trang_thai = 'dang'""")
    if ket == "dung":
        try: kt = sang_ke_chuyen(d, buoc, ghi)
        except Exception as e: kt = f"chuyển kể chuyện lỗi: {str(e)[:120]}"
        if kt: ghi = f"{ghi[:300]} → {kt}"
    if ket in ("dung", "loi"): sql(f"update etp.dong_phim set trang_thai = '{ket}', ly_do = {s(f'{buoc}: {ghi}')}, xong_luc = now() where id = {d['id']} and trang_thai = 'chay'")
    elif buoc == "chay":
        sql(f"update etp.dong_phim set trang_thai = 'xong', ly_do = {s(ghi)}, xong_luc = now() where id = {d['id']}")
        DON[0] = 0   # phim xong → vòng sau dọn ngay
    print(f"[{time.strftime('%H:%M:%S')}] dòng #{d['id']} phim {d['content_id']} · {buoc} → {ket} · {ghi[:160]}", flush=True)

CHAY = {}   # (dòng, bước) → (thread, lần chạy cuối)
DUNG = [None]
def vong():
    if not (DUNG[0] and DUNG[0].is_alive()):   # một lệnh dựng dự phòng một lúc (iMac còn cắt phim cho dòng phim)
        DUNG[0] = threading.Thread(target=dung_imac, daemon=True); DUNG[0].start()
    sql(f"insert into etp.dong_may (may, nhip, pid) values ('{MAY}', now(), {os.getpid()}) on conflict (may) do update set nhip = now(), pid = excluded.pid")
    if time.time() - DON[0] > 1800:   # dọn khi có phim vừa xong (DON về 0) + quét lại 30 phút / lần cho phần còn lại (máy sinh KT, việc cắt vừa xong)
        DON[0] = time.time()
        try: don_dep()
        except Exception as e: print(f"dọn lỗi: {e}", flush=True)
    for d in doc_dong():
        bs = d.get("buoc") or {}
        if not bs:   # dòng mới (web vừa tạo): dựng 8 bước — hạn từng bước khai MỘT chỗ ở đây
            live = d.get("so_camp") and sql(f"select count(*) from etp.camp where content_id = {d['content_id']} and trang_thai = 'ACTIVE' and not la_roas") not in ("", "0")
            bq = BO_QUA.get(d.get("loai") or "CC", set()) | ({"nhan", "ws", "poster"} if live else set())   # mở rộng phim ĐANG có camp Nhà chạy mới bỏ nhận / trang / poster; phim chưa có camp Nhà (vd phim chỉ team chạy, bấm ＋ ở tab Phim) vẫn qua đủ cổng
            if d.get("so_camp") and san_cua(d["content_id"]) >= int(d["so_camp"]): bq |= {"cat", "soat", "creative"}   # DÙNG LẠI creative sạch có sẵn đủ số → không cắt (anh 04/11/2026)
            sql("insert into etp.dong_buoc (dong_id, buoc, thu_tu, han_giay, trang_thai) values " + ", ".join(
                f"({d['id']}, '{b}', {i}, {HAN_RIENG.get((d.get('loai'), b), h)}, '{'bo_qua' if b in bq else 'cho'}')" for i, (b, h) in enumerate(BUOC, 1)) + " on conflict do nothing")
            print(f"[{time.strftime('%H:%M:%S')}] dòng #{d['id']} phim {d['content_id']} ({d.get('loai')}) — dựng bước", flush=True); continue
        # FIX (nút / Mạnh): giết tiến trình bước nếu còn, đưa bước về chờ, mở lại dòng
        for b, v in bs.items():
            if v.get("fix"):
                with KHOA: pr = DANG.get((d["id"], b))
                if pr: giet_cay(pr.pid)
                t = CHAY.get((d["id"], b))
                if t and t[0].is_alive(): bs = None; break   # luồng cũ chưa thoát hẳn (vừa giết) → FIX ở vòng sau, kẻo luồng cũ ghi đè lượt mới
                sql(f"""update etp.dong_buoc set trang_thai = 'cho', fix = false, huy = false, bat_dau = null, ket_thuc = null, pid = null, ghi = 'FIX — chạy lại', ket_qua = case when '{b}' = 'creative' then null else ket_qua end
                        where dong_id = {d['id']} and buoc = '{b}';
                        update etp.dong_buoc set trang_thai = 'cho', bat_dau = null, ket_thuc = null, ghi = null, ket_qua = null, lan = 0 where dong_id = {d['id']} and thu_tu > (select thu_tu from etp.dong_buoc where dong_id = {d['id']} and buoc = '{b}');
                        update etp.dong_phim set trang_thai = 'chay', ly_do = null, xong_luc = null, bao_luc = null where id = {d['id']} and trang_thai <> 'huy'""")
                print(f"[{time.strftime('%H:%M:%S')}] dòng #{d['id']} FIX bước {b}", flush=True); bs = None; break
        if bs is None or d["trang_thai"] != "chay": continue
        # Mạnh / nút Dừng đặt huy cho bước đang chạy → giết tiến trình
        for b, v in bs.items():
            if v.get("huy"):
                with KHOA: pr = DANG.get((d["id"], b))
                if pr: giet_cay(pr.pid)
        dang = [b for b, _ in BUOC if (bs.get(b) or {}).get("trang_thai") == "dang"]
        ke = dang[0] if dang else next((b for b, _ in BUOC if (bs.get(b) or {}).get("trang_thai") == "cho"), None)
        if not ke: continue
        t = CHAY.get((d["id"], ke))
        if t and t[0].is_alive(): continue
        if dang and t and time.time() - t[1] < CHO_LAI: continue   # bước đang "chờ": quay lại sau CHO_LAI giây
        if ke == "cat" and not dang and sum(1 for (i, b), (th, _) in CHAY.items() if b == "cat" and th.is_alive()) >= TRAN_CAT: continue
        if not dang:
            sql(f"update etp.dong_buoc set trang_thai = 'dang', bat_dau = now(), nhip = now(), lan = lan + 1, may = '{MAY}' where dong_id = {d['id']} and buoc = '{ke}' and trang_thai = 'cho'")
            bs.setdefault(ke, {})["lan"] = (bs.get(ke) or {}).get("lan", 0) + 1
        th = threading.Thread(target=lam_buoc, args=(d, ke), daemon=True); th.start(); CHAY[(d["id"], ke)] = (th, time.time())

def main(a):
    if a and a[0] == "mot": vong(); time.sleep(int(a[1]) if len(a) > 1 else 60); return   # một vòng rồi chờ các bước vừa bật (thử)
    print(f"[{MAY}] máy chạy dòng phim bắt đầu (pid {os.getpid()})", flush=True)
    # TỰ NẠP MÃ MỚI (04/11/2026: tiến trình chạy liền từ 13:49 giữ mã cũ trong bộ nhớ — --tay, lý do poster, chờ KT sửa xong đều chưa có hiệu lực,
    # dòng #49 vẫn bị chặn trùng đội sau deploy): tệp mã của máy đổi → thôi nhận bước mới, chờ các bước đang chạy xong rồi execv chính nó
    ma = [os.path.abspath(__file__), os.path.join(E, "loi_ky_thuat.py")]
    dau = lambda: [os.path.getmtime(f) for f in ma if os.path.exists(f)]
    goc = dau()
    while True:
        if dau() != goc:
            if not any(th.is_alive() for th, _ in CHAY.values()):
                print(f"[{MAY}] mã máy đổi — nạp lại", flush=True); os.execv(sys.executable, [sys.executable, "-u", os.path.abspath(__file__), *a])
            try: sql(f"update etp.dong_may set nhip = now() where may = '{MAY}'")   # còn sống trong lúc chờ — Mạnh không báo máy im
            except Exception: pass
            time.sleep(10); continue
        try: vong()
        except Exception as e: print(f"vòng lỗi: {type(e).__name__}: {str(e)[:300]}", flush=True)
        time.sleep(10)

if __name__ == "__main__": main(sys.argv[1:])
