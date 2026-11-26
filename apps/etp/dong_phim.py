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
import datetime as dt, json, os, re, shlex, signal, socket, subprocess, sys, threading, time
R = os.path.dirname(os.path.abspath(__file__)); E = os.path.join(R, "..", "xuong-video", "scripts", "ethopex")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex")); import nen_video as NV   # bộ nén theo máy (Mac = VideoToolbox)
sys.path.insert(0, E); import loi_ky_thuat as LK
sys.path.insert(0, R); import cuu_cham as CU   # cứu creative bị cổng chấm chặn + luật dạng trượt (anh 07/11/2026)
# MỘT kết nối ssh dùng chung (ControlMaster) cho mọi câu SQL / lệnh box3 — mỗi câu một ssh mới thì >10 dòng song song vượt MaxStartups của sshd box3,
# box3 đóng kết nối ("Connection closed by … port 22", 04/11/2026)
SSH = ["ssh", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=20", "-o", "ControlMaster=auto", "-o", f"ControlPath={os.path.expanduser('~/.ssh/cm-etp-dong-%r@%h')}", "-o", "ControlPersist=10m"]
B = "root@167.233.241.16"; ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
C = os.path.expanduser("~/.cache/ethopex"); MAY = socket.gethostname().split(".")[0]
KHUON = {"en": 65110, "es": 65734}   # camp mẫu cùng tiếng (dot-phim-moi.KHUON)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import so_dang as DG   # SỔ DẠNG một nơi (apps/web/src/lib/etp-dang.json, anh 08/11/2026)
import cong as CG   # khoá trần camp / ngày + câu đếm camp hôm nay dùng chung với cổng
LOAI = DG.DONG   # mã loại dòng phim → dạng creative (etp.creative.dang)
# CC2 — CẢNH CUỐI LOGO (anh 26/11/2026: "CC thì ko làm, phải dùng dạng CC kết hợp với cách lên của Kiên. Cc phải luôn dùng logo cắt đẹp như AD. Đặt tên loại CC2"; "Cc2 ko cần caption trên màn hình"):
# cắt như CC (cat-canh dung_tap) nhưng 5 giây cuối = logo cắt từ poster + nút WATCH NOW / VER AHORA (lop-logo-cc2.py, cùng hàm logo của AD), không chữ nào khác;
# lên camp bằng chữ KIỂU KIÊN của chính phim (apps/etp/chu-kieu.json "kien", ap-form-chu.py --kieu kien) → phim chưa có chữ Kiên thì không cắt.
CC2 = "CC2"
def DS_KIEN():
    try: return [k for k in (json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "chu-kieu.json"))).get("kien") or {}) if k.isdigit()]
    except Exception: return []
def chu_kien(cid):
    try: return str(int(cid)) in (json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "chu-kieu.json"))).get("kien") or {})
    except Exception: return False
# KIỂU TĨNH (anh 08/11/2026 "chọn cả 3 để xem hiệu suất"): mỗi loại một kiểu của tinh-ba-kieu.py, cùng khuôn AT — tự tải tập, 3 bản, 3 camp $1
TINH = {x["dong"]: (("tinh-ba-kieu.py", ["--kieu", x["kieu"]]) if x.get("kieu") else ("anh-tinh.py", [])) for x in DG.DS if x.get("tinh")}
# MẪU POSTER ĐỘNG MÁY DỰNG (anh 08/11/2026 "Trước mắt vẫn dùng mẫu PO ban đầu" → "Có mẫu PO5 mới trộn cùng PO"): máy dòng phim ép --mau theo danh sách này, xoay theo
# bản (--ban 3): bản 1 PO.5 ảnh AI (~111₫/ảnh) · bản 2, 3 PO.1 gốc (mỗi bản một giọng). PO.2 / .3 / .4 không vào máy (chỉ dựng thử bằng tay). Đổi mẫu = sửa đúng dòng này.
MAU_PO_MAY = ["ai", "goc", "goc"]
if "PO" in TINH: TINH["PO"] = (TINH["PO"][0], [*TINH["PO"][1], "--mau", ",".join(MAU_PO_MAY)])   # mã dòng tĩnh → script dựng: có kiểu trong sổ = tinh-ba-kieu --kieu, không = anh-tinh (AT)
BO_QUA = {"KT": {"cat", "soat"}, **{k: {"cat", "soat"} for k in DG.TINH}}   # KT: máy sinh kể chuyện (VideoExpress) làm video từ tóm tắt · AT: anh-tinh.py tự tải tập + chọn khung — không qua bước cắt / soát đoạn
HAN_RIENG = {("KT", "creative"): 4 * 3600, **{(k, "creative"): 60 * 60 for k in DG.TINH}, ("LT", "cat"): 2 * 3600, ("LT", "camp"): 7 * 24 * 3600}   # LT: cắt cả phim ~1 giờ; bước camp chờ anh bấm bắt đầu · AT ~10 phút/phim
# LT — LỘ TRÌNH TEST RỘNG (anh 03/11/2026 "Lên $8-10/phim + T2 thì sẽ cắt sớm đc lỗ và tìm nhanh đc camp lãi" · chọn A: miễn luật một camp ngày test rộng):
# cắt MỖI TẬP một creative (kiểu Kiên, tập trọn ETP_KIEU=tap, tới 10 đoạn) → soát → tải + chấm TẤT CẢ đoạn sạch → DỪNG chờ anh bắt đầu
# (etp.cau_hinh 'lo_trinh' {content_id: {bat_dau: true}}) → lên mỗi creative một camp $1 (nhan-ban miễn luật một camp khi phim ở lo_trinh) → T2 cắt lỗ.
def tu_bat_dau(cid, ly):
    """MÁY TỰ BẮT ĐẦU LÊN CAMP (anh 05/11/2026: "Ko cần tao vào bấm duyệt nữa. Các camp ở tab sx") — ghi lo_trinh[phim].bat_dau như nút anh từng bấm
    (batDauCamp, etp-dong.ts) để nhan-ban miễn luật một camp / phim / ngày cho lộ trình test rộng; giờ chạy vẫn do nhan-ban.lich_len, mọi cổng luật khác giữ nguyên"""
    if CG.phim_cam(cts=[cid], q=sql): return   # phim trong sổ cấm: máy không tự bắt đầu lộ trình (etp:phim-cam-con-lai-2011)
    sql(f"""insert into etp.cau_hinh (khoa, gia_tri) values ('lo_trinh', jsonb_build_object('{int(cid)}', jsonb_build_object('bat_dau', true, 'ai', {s(ly)}, 'luc', now()::text)))
            on conflict (khoa) do update set gia_tri = coalesce(etp.cau_hinh.gia_tri, '{{}}'::jsonb) || jsonb_build_object('{int(cid)}',
              coalesce(etp.cau_hinh.gia_tri->'{int(cid)}', '{{}}'::jsonb) || jsonb_build_object('bat_dau', true, 'ai', {s(ly)}, 'luc', now()::text))""")
def lo_trinh(cid): return json.loads(sql(f"select coalesce((select gia_tri->'{int(cid)}' from etp.cau_hinh where khoa = 'lo_trinh'), '{{}}'::jsonb)::text") or "{}")       # máy sinh KT làm tuần tự ~40–70 phút/phim, có hàng đợi
# camp 3600 (24/11/2026): creative mới lên ★ ROAS mặc định — nhan-ban chờ Meta đồng bộ tới 20 phút mỗi camp; box() mỗi lệnh 1500 giây
BUOC = [("nhan", 300), ("ws", 3600), ("poster", 900), ("cat", 4200), ("soat", 1800), ("creative", 3600), ("camp", 3600), ("chay", 7200)]   # (bước, hạn giây) — Mạnh huỷ khi quá
THU_MANG = {}         # (dòng, bước, lan) → số lượt đã tự thử lại vì lỗi mạng
CHO_LAI = 60          # bước trả "cho" → quay lại sau ngần này giây
TRAN_CAT = 2          # tối đa 2 dòng cắt cùng lúc (iMac)
# TRẦN BƯỚC CAMP (#1636, 17/11/2026 00:04 VN): bước camp = nhan-ban chạy trên box3 (4 nhân, Postgres 100 khe); lô mở rộng phim bật 52 bước camp cùng lúc →
# box3 tải 46, cạn khe kết nối ("remaining connection slots are reserved"), đồng bộ lich_gio / cpm_ngay hỏng, etp2 nặng + không hiện giá. Chỉ giới hạn số
# bước chạy CÙNG LÚC (bước thừa chờ vòng sau, trung vị ~3,5 phút/bước) — không đổi luật lên camp, giờ chạy vẫn do nhan-ban.lich_len.
TRAN_CAMP = 10
DANG = {}             # (dòng, bước) → Popen đang chạy — để Mạnh / nút Dừng giết được
LOAI_DONG = {}        # dòng → loại (CC / KT / AT / LT) — để đếm lượt nặng đang chạy (TRAN_CAT)
KHOA = threading.Lock()

def sql(cau, spy=False):
    nen = ". /root/.secrets/spy.env" if spy else ENV
    r = subprocess.run([*SSH, B, f'{nen}; psql "$DATABASE_URL" -qtA -F"\t" -v ON_ERROR_STOP=1 -f -'],
                       input=cau, capture_output=True, text=True, timeout=180)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def s(v): return "null" if v is None else "$Q$" + str(v).replace("$Q$", "") + "$Q$"
def js(v): return "$J$" + json.dumps(v, ensure_ascii=False).replace("$J$", "") + "$J$::jsonb"
def box(lenh, timeout=1800, ve=None):
    """lệnh trên box3 (trong /opt/earns-marketing-os-v2, có env) — trả (mã thoát, stdout+stderr) · ve: mã vé lệnh trực tiếp → ETP_VE của lệnh đó (nhan-ban đốt vé lúc gửi)"""
    ve = re.sub(r"[^0-9a-f]", "", str(ve or ""))
    r = subprocess.run([*SSH, B, f"{ENV}; {'ETP_VE=' + ve + ' ' if ve else ''}timeout {int(timeout)} {lenh}"], capture_output=True, text=True, timeout=timeout + 60)
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
    if (ly_cam := CG.phim_cam(cts=[cid], q=sql)): return "dung", ly_cam, None
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
    if str(cid) not in can_nguon():   # TẢI XONG DỌN NGAY (anh 16/11/2026): bước Cắt tự tải lại khi tới lượt, không giữ tập gốc từ lúc nhận
        for t in glob.glob(os.path.join(tm, "tap*.mp4")):
            try: os.remove(t)
            except OSError: pass
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
def lech_ngon_ngu(cid):
    """LINK TẬP SAI NGÔN NGỮ (21/11/2026, Sal de mi Bugatti 82854 es): kho spy + trang phim Nhà đưa link DramaBox bản EN cho phim es → đoạn cắt / ảnh tĩnh
    mang phụ đề tiếng Anh. DramaBox đặt ngôn ngữ ở đoạn đầu đường dẫn (/es/ep/…, bản EN không có) → đọc VẬT là đường dẫn, mọi dạng dòng qua đây trước khi cắt.
    Nguồn khác chưa có quy ước đường dẫn → không xét (không chặn oan)."""
    lc = (sql(f"select coalesce(locale, '') from etp.phim where content_id = {int(cid)}") or "").strip().lower()
    us = [sql(f"select coalesce(url, '') from ethopex_content where id = {int(cid)}", spy=True), sql(f"select coalesce(url, '') from etp.phim where content_id = {int(cid)}")]
    if not lc: lc = (sql(f"select coalesce(locale, '') from ethopex_content where id = {int(cid)}", spy=True) or "").strip().lower()
    return next((f"link tập sai ngôn ngữ: phim {lc} nhưng link DramaBox là bản {l} ({u[:120]}) — sửa link trong kho spy ethopex_content + etp.phim rồi chạy lại"
                 for u in (x.strip() for x in us) for l in [ngon_ngu_link(u)] if l and lc and l != lc[:2]), "")

def ngon_ngu_link(u):
    m = re.match(r"https?://(?:www\.)?dramaboxdb\.com/(?:([a-z]{2})/)?(?:ep|movie)/", u or "")
    return (m.group(1) or "en") if m else ""

def b_ws(d):
    lech = lech_ngon_ngu(d["content_id"])
    if lech: return "dung", lech, None
    rc, out = box(f"python3 - <<'PYEOF'\n{TRANG % d['content_id']}\nPYEOF", 300)
    m = re.findall(r'^\{"ly".*$', out, re.M)
    if not m: return "loi", f"không đọc được cổng trang phim: {out[-200:]}", None
    ly = json.loads(m[-1])["ly"]
    if not ly: return "xong", "trang phim Nhà đủ mô tả + cốt truyện + ảnh + link tập 1", None
    # đọc VẬT (kho trang phim), không đọc chữ lý do của cổng: bản đã thêm quá 1 giờ mà Ethopex chưa sinh → chờ nữa vô ích (cong.sql_trang_hong);
    # dấu cổng của Mạnh có mục này → Ethopex sinh xong thì tự mở lại dòng
    hong = sql(f"select {CG.sql_trang_hong(int(d['content_id']))}")
    if hong: return "dung", f"trang phim Nhà {CG.ly_trang_hong(hong)} — không có trang đích nên không lên camp; Ethopex có link thì máy tự mở lại dòng · {ly[:200]}", None
    if "vừa được máy" in ly or "còn thiếu" in ly:
        box("systemctl start --no-block etp-dong-bo", 30)   # đồng bộ kho trang phim ngay, không chờ 10 phút
        return "cho", ly, None
    # ensure-clone lỗi = API Ethopex chập chờn (timeout / 5xx, them_ws đã thử 3 lần), không phải luật chặn → 'loi' (đường lỗi mạng tự thử lại 3 lượt ở chay_buoc, rồi Mạnh mục 6); 4xx mới là API từ chối thật (26/11/2026: 6 dòng CC2 dừng hẳn vì một lần timeout)
    if "ensure-clone lỗi" in ly and not re.search(r"HTTP 4(?!29)", ly): return "loi", ly, None
    return "dung", ly, None

def b_poster(d):
    cid = d["content_id"]
    rc, out = box(f"python3 apps/etp/soat_18_ai.py {cid} --ghi", 600)
    # dòng PHÁN "<cid>: False · 12₫ · AI soát poster …" — không lấy dòng cuối: đó là "tổng N₫" (04/11/2026 dòng #48 hiện lý do "tổng 36₫")
    phan = next((l.split(" · ", 2)[-1] for l in out.splitlines() if l.startswith(f"{cid}: ")), "")
    if CG.phim_cam(cts=[cid], q=sql): return "dung", f"AI soát poster cấm 18+: {(phan or (khoa_studio('ethopex_soat_18').get(str(cid)) or {}).get('ghi', 'cấm'))[:300]}", None
    v = khoa_studio("ethopex_soat_18").get(str(cid)) or {}
    if v.get("ok") is False: return "dung", f"soát 18+: {v.get('ghi', 'cấm')}", None
    if rc: return "loi", f"soát poster lỗi (mã {rc}): {out[-200:]}", None
    nhan_lai(cid)   # poster qua (kể cả sau khi bỏ chặn) → phim phải đang được Nhà giữ
    return "xong", (out.splitlines() or ["poster sạch"])[-1][:300], None

def doi_at(d, ly, loai=("CC", CC2, None)):
    """CẤM BỎ CUỘC (anh 07/11/2026 "thử đa dạng cấm bỏ cuộc"): dòng CC không ra đoạn / hết khung mới → xếp dòng AT (ảnh tĩnh) cho cùng phim, không xếp đôi (dong_phim_mot).
    loai: các loại dòng được chuyển — dạng trượt cổng chấm (b_cat) chuyển cả LT."""
    if d.get("loai") not in loai: return ""
    # dạng thay đầu tiên CHƯA GÁC (AT → PO); gác cả hai thì không xếp gì (anh 26/11/2026 "Và giờ dùng AD và CC2" — gác KT/PO/LT/ATT trong gac_dang): dòng đứng lại để FIX,
    # không đẻ dòng dạng gác rồi vòng sau dừng nó
    g = gac_dang(); ma = next((m for m in ("AT", "PO") if m not in g), None)
    if not ma: return ""
    r = sql(f"""insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp) select content_id, ten, the_loai, '{ma}', {s('máy: CC không ra (' + ly[:80] + ') → thử ' + DG.DONG[ma])}, 1
               from etp.dong_phim where id = {d['id']} and not exists (select 1 from etp.dong_phim x where x.content_id = {d['content_id']} and x.loai = '{ma}' and x.tao_luc > now() - interval '2 days')
               on conflict do nothing returning id""")
    return f" · đã xếp dòng {DG.DONG[ma]} #{r}" if r else ""

def b_cat(d):
    cid, lo = d["content_id"], f"dp{d['id']}"
    # DẠNG TRƯỢT CỔNG CHẤM (anh 07/11/2026, việc 3 — Vengeance of the Dragon Princess 25/29 cảnh thật trượt meta.bao_luc): phần lớn bản dạng này của phim trượt cùng
    # một tiêu chí → không cắt thêm (chắc chắn trượt, tốn giờ máy + tiền chấm), dừng dòng và chuyển ảnh tĩnh. Luật một chỗ: apps/etp/cuu_cham.py dang_truot
    tr = CU.dang_truot(sql, cid, d.get("loai"))
    if tr: return "dung", tr + doi_at(d, "dạng trượt cổng chấm", ("CC", CC2, "LT", None)), None
    if d.get("loai") == CC2 and not chu_kien(cid): return "dung", f"CC2 lên bằng chữ kiểu Kiên — sổ apps/etp/chu-kieu.json \"kien\" chưa có phim {cid}, không cắt", None
    r = sql(f"select ten, url, locale, nguon from ethopex_content where id = {cid}", spy=True).split("\t")
    if len(r) < 2 or not r[1]:   # kho spy thiếu link (693 phim, 20/11/2026: American Sniper 49428) → link tập 1 của trang phim Nhà (etp.phim.url — cùng nguồn các dòng ảnh tĩnh dùng, tai-tap tự mở link rút gọn)
        u = sql(f"select coalesce(url, '') || chr(9) || coalesce(ten, '') || chr(9) || coalesce(locale, 'en') from etp.phim where content_id = {int(cid)}").split("\t")
        if not u[0]: return "loi", "không tìm thấy link tập: kho spy ethopex_content và trang phim Nhà (etp.phim.url) đều trống", None
        r = [(r[0] if r and r[0] else u[1]), u[0], (r[2] if len(r) > 2 and r[2] else u[2]), (r[3] if len(r) > 3 else "")]
    sql(f"""delete from etp.viec where lo = '{lo}';   -- lô riêng của dòng: chạy lại bước = xếp lại từ đầu
            insert into etp.viec (loai, lo, content_id, du_lieu) values ('cat', '{lo}', {cid}, {js({"locale": r[2] or "en", "nguon": r[3] if len(r) > 3 else "", "ten": r[0], "url": r[1], "so_ban": 10 if d.get("loai") == "LT" else (max(2, int(d.get("so_camp") or 0) - san_cua(cid, d.get("loai"))) + 1 if d.get("so_camp") else 2), **({"kieu": "tap"} if d.get("loai") == "LT" else {}), **({"logo": True} if d.get("loai") == CC2 else {}), "cam_them": json.loads(sql(f"select coalesce((select gia_tri->'{int(cid)}' from etp.cau_hinh where khoa = 'cam_them'), '[]'::jsonb)::text") or "[]")})}) on conflict do nothing""")
    if d["id"] in CAT_NGOAI:   # chế độ ngoài (CAT_NGOAI): việc đã vào hàng chung — chờ HP / VPS nhận, quá CHO_NGOAI không ai nhận thì iMac cắt
        t0 = time.time()
        try:
            while time.time() - t0 < CHO_NGOAI and sql(f"select 1 from etp.viec where lo = '{lo}' and trang_thai = 'cho' limit 1"):
                sql(f"update etp.dong_buoc set nhip = now(), ghi = {s('iMac đủ khe — chờ máy thợ khác (HP / VPS) nhận việc cắt')} where dong_id = {d['id']} and buoc = 'cat'"); time.sleep(30)
        finally: CAT_NGOAI.discard(d["id"])
    t1 = time.time()
    while str(cid) not in giu_nguon() and len(giu_nguon()) >= TRAN_TAI and time.time() - t1 < dict(BUOC)["cat"] - 600:
        don_dep()
        if len(giu_nguon()) < TRAN_TAI: break
        sql(f"update etp.dong_buoc set nhip = now(), ghi = {s(f'chờ dọn: iMac đang giữ tập gốc {len(giu_nguon())}/{TRAN_TAI} phim — phim trước cắt + soát xong, dọn rồi mới tải phim này')} where dong_id = {d['id']} and buoc = 'cat'")
        time.sleep(60)
    rc, out = chay_tien_trinh(d["id"], "cat", ["python3", os.path.join(R, "tho.py"), "--lo", lo, "--so-tho", "1"], dict(BUOC)["cat"] - 60)
    # THỢ MÁY KHÁC ĐÃ NHẬN LÔ (07/11/2026 dòng #112: VPS may-cao-vn nhận trước, thợ iMac "hết việc — đã làm 0 việc" → dòng ghi lỗi trong khi VPS đang cắt) → chờ máy đó xong
    # THỢ MÁY NÀY TRẢ LÔ VỀ HÀNG CHUNG (15/11/2026 #1608: Vision iMac lỗi → tho.xong 'tra_lai', lô về 'cho' cho HP / VPS cắt) → cũng chờ; trước chỉ chờ 'dang'
    # nên dòng báo "cắt lỗi" ngay trong khi lô còn đang được máy khác làm lại (dòng #4525 #4287 #4279)
    t0 = time.time()
    while (tt := sql(f"select trang_thai from etp.viec where lo = '{lo}' and (trang_thai = 'cho' or (trang_thai = 'dang' and may is distinct from '{MAY}')) order by id desc limit 1")) and time.time() - t0 < dict(BUOC)["cat"]:
        sql(f"update etp.dong_buoc set nhip = now(), ghi = {s('máy khác đang cắt lô này — chờ kết quả' if tt == 'dang' else 'máy này lỗi kỹ thuật — lô đã trả về hàng chung, chờ máy khác (HP / VPS) cắt lại')} where dong_id = {d['id']} and buoc = 'cat'"); time.sleep(30)
    kq = json.loads(sql(f"select coalesce(ket_qua, '[]'::jsonb)::text || chr(9) || coalesce(loi, '') from etp.viec where lo = '{lo}' order by id desc limit 1").split("\t")[0] or "[]")
    loi = sql(f"select coalesce(loi, '') from etp.viec where lo = '{lo}' order by id desc limit 1")
    ok = [x for x in kq if x.get("file") and not x.get("loi") and os.path.exists(x["file"])]
    if d.get("so_camp"):   # MỞ RỘNG: bỏ khung chồng lên đoạn đã có creative của phim (04/11/2026 dòng #35 cắt lại đúng đoạn #64977 → cổng trùng đoạn chặn hết)
        da = [tuple(map(float, l.split("\t"))) for l in sql(f"select tu, den from etp.creative where content_id = {cid} and tu is not null and den is not null and tu_choi is null and creative_id not in (select creative_id from etp.cham_duyet where not ok)").splitlines() if l.count("\t") == 1]
        bo = [x for x in ok if any(float(x["tu"]) < b and float(x["den"]) > a for a, b in da)]; ok = [x for x in ok if x not in bo]
        if not ok and bo: return "dung", f"mọi khung cuối tập cắt được đều trùng đoạn đã có creative ({len(bo)} khung) — phim hết khung mới" + doi_at(d, "hết khung mới"), None   # không cắt ra khung nào ≠ hết khung mới (05/11/2026 #51 báo "0 khung" khi thật ra cắt quá giờ) → rơi xuống nhánh lỗi
    if d.get("loai") == CC2 and (thieu := [x for x in ok if (x.get("bien") or {}).get("logo") != "cc2"]):   # CC2 không logo gốc = hỏng (anh 26/11/2026: 7081 7085 HP mã cũ ra ô chữ vẽ) → cắt lại, không đưa sang creative
        may = sql(f"select coalesce(may, '?') from etp.viec where lo = '{lo}' order by id desc limit 1")
        return "loi", f"{len(thieu)}/{len(ok)} đoạn CC2 thiếu logo gốc + nút (máy {may} cắt không qua lop-logo-cc2) — cắt lại", None
    if ok: return "xong", f"cắt {len(ok)} đoạn: " + ", ".join(f"{x['tu']:.0f}–{x['den']:.0f}s" for x in ok), {"doan": ok, "lo": lo}
    g = loi or " ".join(str(x.get("loi")) for x in kq) or out[-200:]
    kt = "loi" if rc == -9 or LK.ky_thuat(g) is not False else "dung"
    return kt, f"không ra đoạn nào: {g[:300]}" + (doi_at(d, g) if kt == "dung" else ""), None

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
    if (d.get("khoi") or {}).get("mau"): return b_creative_khoi(d)   # khối có mẫu: creative dựng ĐÚNG mẫu của khối, không đi đường dạng của dòng (anh 25/11/2026)
    if d.get("loai") == "KT": return b_creative_kt(d)
    if d.get("loai") in TINH: return b_creative_at(d)
    if d.get("loai") == "LT" or (d.get("so_camp") and d.get("loai") != "KT"): return b_creative_lt(d, truoc)   # mở rộng: tải MỌI đoạn sạch
    tr = (d.get("buoc") or {}).get("creative") or {}
    cr = (tr.get("ket_qua") or {}).get("creative_id")
    if not cr:   # lượt đầu: tải MỘT đoạn (luật một camp mỗi lần, anh 03/11/2026)
        doan = ((truoc.get("soat") or {}).get("doan") or [])[:1]
        if not doan: return "loi", "bước soát không để lại đoạn sạch", None
        ma = f"dp{d['id']}l{tr.get('lan') or 1}"; lf = os.path.join(C, "ra", f"dp{d['id']}", f"len-{ma}.json")
        json.dump([{**x, "lo": f"dp{d['id']}"} for x in doan], open(lf, "w"), ensure_ascii=False)
        rc, out = chay_tien_trinh(d["id"], "creative", ["python3", os.path.join(E, "len-creative.py"), lf, ma, DG.KHONG_DAU[LOAI[CC2]] if d.get("loai") == CC2 else "canh cuoi", "--da-soat"], dict(BUOC)["creative"] - 300, {"ETP_KHONG_CAT": "1"})
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
    if len(c) > 2 and c[2]: return "cho", f"creative #{cr} chờ anh duyệt (etp2 › Chờ duyệt)", tr["ket_qua"]
    return "dung", f"creative #{cr} bị cổng chấm chặn: {c[1][:200]}", tr["ket_qua"]

# CHỜ ANH DUYỆT ≠ BỊ CHẶN (26/11/2026): creative cổng chấm giữ ở tab Chờ duyệt etp2 (cham_cong.cho_duyet) trước đây trả 'dung' "bị cổng chấm chặn / giữ" →
# dòng dừng hẳn + câu khớp HET_NL → máy coi phim hết nguyên liệu, chuyển dạng khác. Nay: còn creative chờ anh duyệt thì bước đứng 'cho', anh ✅ là chạy tiếp.
def cho_anh(ids):
    """creative trong ids đang chờ anh duyệt (cho_duyet có, chưa được lên)"""
    ids = [int(x) for x in ids]
    if not ids: return set()
    return {int(x) for x in sql(f"select creative_id from etp.cham_cong where creative_id in ({','.join(map(str, ids))}) and coalesce(cho_duyet, '') <> '' and duoc_len is not true").split()}

def b_creative_lt(d, truoc):
    """LT: tải MỌI đoạn sạch (mỗi tập một creative) → chờ chấm hết → xong khi còn ≥ 1 creative được lên"""
    tr = (d.get("buoc") or {}).get("creative") or {}; ds = (tr.get("ket_qua") or {}).get("ds")
    if not ds:
        doan = (truoc.get("soat") or {}).get("doan") or []
        if not doan: return "loi", "bước soát không để lại đoạn sạch", None
        ma = f"dp{d['id']}lt"; lf = os.path.join(C, "ra", f"dp{d['id']}", f"len-{ma}.json")
        json.dump([{**x, "lo": f"dp{d['id']}"} for x in doan], open(lf, "w"), ensure_ascii=False)
        rc, out = chay_tien_trinh(d["id"], "creative", ["python3", os.path.join(E, "len-creative.py"), lf, ma, DG.KHONG_DAU[LOAI[CC2]] if d.get("loai") == CC2 else "tap nguyen", "--da-soat"], dict(BUOC)["creative"] - 300, {"ETP_KHONG_CAT": "1"})
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
    if not sach and (ca := cho_anh([x["creative_id"] for x in ds])): return "cho", f"{len(ca)}/{len(ds)} creative chờ anh duyệt (etp2 › Chờ duyệt)", {"ds": ds}
    if not sach: return "dung", f"cả {len(ds)} creative bị cổng chấm chặn", {"ds": ds}
    return "xong", f"{len(sach)}/{len(ds)} creative chấm sạch: " + ", ".join(f"#{x['creative_id']}" for x in sach), {"ds": ds, "sach": sach}

# MỖI MỨC ROAS MỘT CREATIVE MỚI (anh 25/11/2026 "ở mức level 0.9, 1.0, 1.1 của từng phim. Mỗi mức đó cần 1 creative riêng mới để ko cạnh tranh nhau"):
# etp.khoi.muc = các mức ★ ROAS (migration 0472); phim lên so_camp camp, camp thứ i ★ ROAS muc[i] (thiếu thì mức cuối) và MỘT creative riêng — không creative nào chạy hai camp.
# Cùng công thức bên etp2: apps/etp2/src/lib/etp-khoi-muc.ts (mucCampKhoi).
def muc_camp(k, so=None):
    muc = [float(x) for x in (k.get("muc") or []) if x is not None] or [float(k["roas"])]
    n = max(1, int(so or k.get("cr_camp") or len(muc)))
    return [muc[min(i, len(muc) - 1)] for i in range(n)]

def cr_mau_moi(ma, cid, bo_ra):
    """creative của (mẫu, phim) đã dựng mà CHƯA có camp, mỗi khung một cái (2 bản giọng cùng khung = cùng hình → chỉ lấy bản đầu), theo thứ tự dựng"""
    ids = [int(x) for x in re.findall(r"\d+", sql(f"select coalesce(array_to_string(creative_ids, ' '), '') from etp.mau_dung where mau = {s(ma)} and content_id = {int(cid)}"))]
    if not ids: return []
    khung = {int(a): b for a, b in (l.split("\t") for l in sql(f"""select t.creative_id, coalesce(substring(t.ghi from 'khung [^ ·]+'), t.id::text) from etp.thu_vien t
              where t.creative_id in ({','.join(map(str, ids))})""").splitlines() if l.count("\t") == 1)}
    co_camp = {int(x) for x in sql(f"select distinct creative_id from etp.camp where creative_id in ({','.join(map(str, ids))})").split()}
    ra, da_k = [], set()
    for c in ids:
        k_ = khung.get(c, str(c))
        if c in co_camp or c in bo_ra or k_ in da_k: da_k.add(k_); continue
        da_k.add(k_); ra.append(c)
    return ra

def b_creative_khoi(d):
    """KHỐI có mẫu (etp.khoi.mau, vd dt_anh_dong_logo): mỗi camp của phim (mức ★ ROAS muc_camp) cần MỘT creative mới riêng chưa có camp → dung-mau.py <mẫu> <phim> --ban <thiếu>
    trên iMac (môi trường poster-mau; mỗi bản một khung khác, máy dựng nhớ khung đã dùng) → cổng chấm. Bản đã dựng chưa có camp thì dùng lại, không dựng lần hai.
    Lượt chạy quá hạn bước thì lượt sau đọc lại etp.mau_dung.creative_ids, chỉ dựng phần còn thiếu."""
    k = d["khoi"]; ma = str(k["mau"]); cid = int(d["content_id"]); muc = muc_camp(k, d.get("so_camp"))
    tr = (d.get("buoc") or {}).get("creative") or {}; kq0 = tr.get("ket_qua") or {}
    # creative anh đã LOẠI hoặc bấm ✎ SỬA LẠI (etp.cham_duyet ok = false) rời khỏi khối → máy dựng bản thay (26/11/2026 #1897: #116378 logo cụt, anh bấm Sửa lại
    # mà dòng #7117 cứ giữ nó trong danh sách và "chờ anh duyệt" mãi — không bao giờ dựng lại). Bản bị loại cũng không được nhặt lại qua cr_mau_moi.
    ids = [int(x["creative_id"]) for x in kq0.get("ds") or []]
    loai = {int(x) for x in sql(f"select u.creative_id from etp.cham_duyet u join etp.creative r using (creative_id) where not u.ok and r.content_id = {cid}").split() if x.isdigit()}
    ids = [c for c in ids if c not in loai][:len(muc)]
    if len(ids) < len(muc): ids += cr_mau_moi(ma, cid, set(ids) | loai)[:len(muc) - len(ids)]
    if len(ids) < len(muc):
        rc, out = chay_tien_trinh(d["id"], "creative", [os.path.expanduser("~/.venvs/poster-mau/bin/python"), os.path.join(E, "dung-mau.py"), ma, str(cid), "--ban", str(len(muc) - len(ids))], dict(BUOC)["creative"] - 120)
        ids += cr_mau_moi(ma, cid, set(ids) | loai)[:len(muc) - len(ids)]
        # dung-mau chưa xong vì CHỜ (Ethopex đang sinh trang / link tập 1) → 'cho', lượt sau tự dựng tiếp; ssh tới box3 rớt (exit 255) → 'loi' để đường lỗi mạng thử lại.
        # Trước đây cả hai thành 'dung' → 10/10 dòng AD 26/11/2026 dừng hẳn chỉ vì chờ link tập / một lần ssh rớt.
        hk = "cho" if "trang_phim · cho" in out else "loi" if rc == -9 or "exit status 255" in out else "dung"
        if not ids: return hk, f"dựng mẫu {ma} không ra creative: {out[-300:]}", None
        if len(ids) < len(muc): return hk, f"mẫu {ma}: mới có {len(ids)}/{len(muc)} creative riêng cho {len(muc)} mức ★ ROAS — {out[-240:]}", {"ds": [{"creative_id": c} for c in ids]}
    sql(f"update etp.dong_phim set creative_id = {ids[0]} where id = {d['id']}")
    kq = {"creative_id": ids[0], "ds": [{"creative_id": c, "roas": muc[i]} for i, c in enumerate(ids)]}
    # TỶ LỆ K : D (anh 26/11/2026 "tạo creative mới theo 2 cách lên camp để thử" · "Tại sao tao cứ phải nhắc đi nhắc lại tỷ lệ này"):
    # creative khối chia NỬA K (chữ Kiên của phim, link search.com) · NỬA D (form Dol, info.com), xen kẽ theo mức ★ ROAS (0.9 D · 1.0 K · 1.1 D · 1.2 K).
    # Áp TRƯỚC máy chấm / Chờ duyệt để anh duyệt đúng chữ sẽ lên. Phim chưa có chữ Kiên (chu-kieu.json) → cả khối D, không tự viết chữ.
    k_ds = [c for i, c in enumerate(ids) if i % 2 == 1] if chu_kien(cid) else []
    if k_ds and sorted(kq0.get("k") or []) != sorted(k_ds):
        if h := ap_kien(d, {"creative": {"sach": [{"creative_id": c} for c in k_ds]}}): return h[0], h[1], kq
    kq["k"] = k_ds
    r = {int(l.split(chr(9))[0]): (l.split(chr(9))[1:] + ["", ""])[:2] for l in sql(f"""select r.creative_id, coalesce(r.lang, 'en'), coalesce(g.duoc_len::text, '')
            from etp.creative r left join etp.cham_cong g using (creative_id) where r.creative_id in ({','.join(map(str, ids))})""").splitlines() if chr(9) in l}
    ten = ", ".join(f"#{c}" for c in ids)
    if len(r) < len(ids): return "cho", f"creative mẫu {ma} {ten} đã tạo — chờ đồng bộ kho etp", kq
    if any(v[1] == "" for v in r.values()): return "cho", f"creative mẫu {ma} {ten} — chờ máy chấm", kq
    bi = [c for c in ids if r[c][1] != "true"]
    if bi and set(bi) <= cho_anh(bi): return "cho", f"creative mẫu {ma} {', '.join(f'#{c}' for c in bi)} chờ anh duyệt (etp2 › Chờ duyệt)", kq
    if bi: return "dung", f"creative mẫu {ma} {', '.join(f'#{c}' for c in bi)} bị cổng chấm chặn — mỗi mức ★ ROAS cần một creative sạch riêng", kq
    kq["sach"] = [{"creative_id": c, "lang": r[c][0], "roas": muc[i]} for i, c in enumerate(ids)]
    return "xong", f"{len(ids)} creative mẫu {ma} chấm sạch, mỗi mức một cái: " + " · ".join(f"★{muc[i]} #{c} {'K' if c in k_ds else 'D'}" for i, c in enumerate(ids)) + ("" if k_ds else " · cả khối D: phim chưa có chữ Kiên"), kq

def b_creative_kt(d):
    """KT: dòng đứng đầu hàng đợi máy sinh kể chuyện (hang-ke-chuyen.mts bậc 5000) → chờ creative kể chuyện MỚI của phim (tạo sau lúc bước này bắt đầu) → cổng chấm"""
    v = sql(f"""select coalesce(r.creative_id::text, '') || chr(9) || coalesce(g.duoc_len::text, '') || chr(9) || coalesce(g.chan_boi, '') || chr(9) || coalesce(g.cho_duyet, '')
                || chr(9) || coalesce(r.lang, 'en') || chr(9) || coalesce(r.tu, 0) || chr(9) || coalesce(r.den, 0)
                from etp.creative r left join etp.cham_cong g using (creative_id)
                where r.content_id = {d['content_id']} and r.dang = 'kể chuyện' and r.tu_choi is null
                  and (r.cap_nhat >= (select bat_dau from etp.dong_buoc where dong_id = {d['id']} and buoc = 'creative')
                       or r.creative_id = (select creative_id from etp.dong_phim where id = {d['id']}))   -- FIX sau ✅ duyệt tay: dùng lại creative của dòng, không sinh lại
                  order by r.creative_id desc limit 1""").split("\t")
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

AT_BAN = 3   # anh 08/11/2026 "tăng thêm số camp mỗi phim lên thành 3 camp mỗi loại từ $1" — mỗi dòng AT làm 3 bản (3 khung AI chọn, 3 kiểu giọng) → 3 camp
def b_creative_at(d):
    """AT — ẢNH TĨNH: anh-tinh.py <phim> --ban AT_BAN trên iMac (AI chọn khung, tên phim từ poster, HD, giọng tốt nhất đã đo — sổ luật giong_at, anh 18/11/2026) → thư viện → creative 'ảnh tĩnh' → cổng chấm.
    Mã creative vừa tạo ghi vào ket_qua.ds của bước (etp.creative chỉ có chúng sau lượt dong-bo 10 phút — 07/11/2026 dòng #142 tưởng không ra rồi sinh lại);
    lượt sau chỉ chờ đồng bộ + chấm, không chạy lại. Xong khi mọi bản đã chấm và ≥ 1 bản sạch → bước camp lên mỗi bản sạch một camp (b_camp_mr, so_camp)."""
    tr = (d.get("buoc") or {}).get("creative") or {}; kq0 = tr.get("ket_qua") or {}
    ids = [int(x["creative_id"]) for x in kq0.get("ds") or []] or ([int(kq0["creative_id"])] if kq0.get("creative_id") else [])
    if not ids:
        # DÙNG LẠI BẢN SẴN SÀNG TRƯỚC KHI SINH MỚI (anh 15/11/2026 "rất nhiều camp chờ đang ko thể sx … fix triệt để"): 09–15/11 cổng chữ sau chặn oan lớp Free →
        # mỗi lần FIX sinh lại 3 bản (giọng + ảnh AI) trong khi bản cũ vẫn nằm thư viện "sẵn sàng" — 2.178 bản PO + 87 AT, 133 phim. Bản sẵn sàng chưa thành creative
        # của đúng phim + dạng (≤ 7 ngày, mới nhất trước, tối đa AT_BAN) → thu-vien-len (cùng đường anh-tinh gọi ở cuối) · đưa lên không ra creative nào thì loại
        # các bản đó (trang_thai 'loai', ghi lý do — không xoá) rồi mới sinh mới, kẻo vòng sau bốc lại đúng mấy bản hỏng.
        san = sql(f"""select string_agg(id::text, ' ') from (select id from etp.thu_vien where content_id = {int(d['content_id'])} and dang = {s(LOAI[d['loai']])}
                      and trang_thai = 'san_sang' and creative_id is null and coalesce(video, '') <> '' and tao > now() - interval '7 days' order by id desc limit {AT_BAN}) x""").split()
        if san:
            rc, out = chay_tien_trinh(d["id"], "creative", ["python3", os.path.join(E, "thu-vien-len.py"), *san], HAN_RIENG[(d["loai"], "creative")] - 120)
            ids = [int(x) for x in dict.fromkeys(re.findall(r"→ creative #(\d+)", out))]
            if not ids:
                ly = (re.findall(r"✗ tv\d+: (.+)", out) or [out[-200:]])[-1][:200]
                sql(f"update etp.thu_vien set trang_thai = 'loai', ghi = coalesce(ghi, '') || {s(' · máy dòng phim: dùng lại không ra creative — ' + ly)}, cap_nhat = now() where id in ({','.join(san)}) and creative_id is null")
                print(f"[{time.strftime('%H:%M:%S')}] dòng #{d['id']} dùng lại tv{', tv'.join(san)} không ra creative ({ly[:80]}) → sinh mới", flush=True)
    if not ids:
        rc, out = chay_tien_trinh(d["id"], "creative", ["python3", os.path.join(E, TINH[d["loai"]][0]), str(d["content_id"]), *TINH[d["loai"]][1], "--ban", str(AT_BAN)], HAN_RIENG[(d["loai"], "creative")] - 120)
        ids = [int(x) for x in dict.fromkeys(re.findall(r"→ creative #(\d+)", out))]
        if not ids:
            j = next((json.loads(l) for l in out.splitlines() if l.startswith("{") and '"content_id"' in l), None) or {}
            g = j.get("loi") or out[-300:]
            return ("loi" if rc == -9 or not j or LK.ky_thuat(g) is not False else "dung"), f"anh-tinh không ra creative: {g[:300]}", None
        sql(f"update etp.dong_phim set creative_id = {ids[0]} where id = {d['id']}")
    kq = {"creative_id": ids[0], "ds": [{"creative_id": c} for c in ids]}
    # đệm đủ 3 cột: psql cắt tab cuối khi duoc_len / chan_boi rỗng (creative chưa chấm) → mảng ngắn, IndexError (08/11/2026 dòng #245 #200)
    r = {int(l.split(chr(9))[0]): (l.split(chr(9))[1:] + ["", "", ""])[:3] for l in sql(f"""select r.creative_id, coalesce(r.lang, 'en'), coalesce(g.duoc_len::text, ''), coalesce(g.chan_boi, '')
            from etp.creative r left join etp.cham_cong g using (creative_id) where r.creative_id in ({','.join(map(str, ids))})""").splitlines() if chr(9) in l}
    if len(r) < len(ids): return "cho", f"{len(ids)} creative ảnh tĩnh đã tạo (#{', #'.join(map(str, ids))}) — chờ đồng bộ kho etp ({len(r)}/{len(ids)})", kq
    if any(v[1] == "" for v in r.values()): return "cho", f"{len(ids)} creative ảnh tĩnh — chờ máy chấm ({sum(1 for v in r.values() if v[1])}/{len(ids)})", kq
    kq["sach"] = [{"creative_id": c, "lang": r[c][0]} for c in ids if r[c][1] == "true"]
    if not kq["sach"]: return "dung", f"cả {len(ids)} creative ảnh tĩnh bị cổng chấm chặn: " + " · ".join(f"#{c} {r[c][2][:60]}" for c in ids)[:300], kq
    return "xong", f"{len(kq['sach'])}/{len(ids)} creative ảnh tĩnh chấm sạch: " + ", ".join(f"#{x['creative_id']}" for x in kq["sach"]), kq

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
def ket_camp(d, xong, loi, cu, gan=None, may=False):
    """kết bước Lên camp: camp mới (xong) + camp đã có của creative (cu) đều tính là đã lên; chỉ còn creative 'vừa tạo' chưa đồng bộ thì chờ"""
    tat = list(dict.fromkeys([*xong, *cu.values()]))
    if not tat:
        if any(TRUNG_CR in str(x) for x in loi): return "cho", "Ethopex báo creative đã có camp vừa tạo — chờ đồng bộ etp.camp (10 phút) để gắn camp vào dòng: " + " · ".join(map(str, loi))[:300], None
        # may: có lượt hỏng vì máy / mã (nhan-ban.loi_may) hoặc không trả kết quả → 'loi' để Mạnh mục 6 thử lại; chỉ toàn luật chặn mới 'dung' (audit 05/11/2026)
        if may: return "loi", "lỗi máy khi lên camp (Mạnh tự thử lại): " + " · ".join(map(str, loi))[:400], None
        return "dung", "không lên được camp nào: " + " · ".join(map(str, loi))[:400], None
    sql(f"update etp.dong_phim set camp_id = {int(tat[0])} where id = {d['id']}")
    loi = [x for x in loi if TRUNG_CR not in str(x)]
    return "xong", (f"lên {len(xong)} camp ★ ROAS: " + ", ".join(f"#{c}" for c in xong) if xong else "không cần tạo camp mới") \
        + (f" · creative đã có camp: " + ", ".join(f"#{c}→camp #{k}" for c, k in cu.items()) if cu else "") \
        + (f" · chặn {len(loi)}: " + " · ".join(map(str, loi))[:300] if loi else ""), {"camp_id": int(tat[0]), "camps": tat, **({"gan": gan + [{"creative_id": c, "camp": k} for c, k in cu.items()]} if gan is not None else {})}

def b_camp_lt(d, truoc):
    sach = (truoc.get("creative") or {}).get("sach") or []
    if not sach: return "loi", "chưa có creative sạch", None
    if not lo_trinh(d["content_id"]).get("bat_dau"): tu_bat_dau(d["content_id"], f"máy tự bắt đầu — dòng #{d['id']} sẵn {len(sach)} creative sạch (anh 05/11/2026 bỏ bước duyệt)")
    xong, loi, gan, may_ = [], [], [], False   # gan: creative → camp (tab Dòng phim vẽ mỗi video một ô) · may_: có lượt hỏng vì máy / mã
    cu = camp_co_san(x["creative_id"] for x in sach)
    sach = [x for x in sach if int(x["creative_id"]) not in cu]   # creative đã có camp (anh lên riêng #1520 / lượt trước của chính dòng) = đã lên — không đi vào luật "một creative một camp" thành lỗi
    for i_, x in enumerate(sach):
        sql(f"update etp.dong_buoc set ghi = {s(f'đang lên camp {i_ + 1}/{len(sach)} (creative #{x["creative_id"]})')}, nhip = now() where dong_id = {d['id']} and buoc = 'camp'")   # trang Sản xuất thấy tiến độ ngay sau khi anh bấm
        lang = x.get("lang") or "en"; ten = re.sub(r"['\"$`\\]", "", x.get("ten") or f"dp{d['id']} phim {d['content_id']}")
        rc, out = box(f"""bash -c 'cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON.get(lang, KHUON["en"])} --tay --bo 2 --creative {int(x["creative_id"])} --content {d["content_id"]} --ten "{ten}" --that --luat "lộ trình test rộng (anh 03/11/2026: 8-10 USD/phim + T2)" --ai "{ai_dong(d, "dòng phim LT, anh bắt đầu")}"'""", 1500, ve=ve_dong(d))
        j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{") and '"ok"' in l), None) or {}
        (xong if j.get("ok") and j.get("moi") else loi).append(j.get("moi") or f"#{x['creative_id']}: {(j.get('loi') or out[-120:])[:120]}")
        if j.get("ok") and j.get("moi"): gan.append({"creative_id": int(x["creative_id"]), "camp": int(j["moi"])})
        elif not j or j.get("may"): may_ = True
    return ket_camp(d, xong, loi, cu, gan, may_)

def san_dung_lai(cid, loai=None):
    """creative DÙNG LẠI ĐƯỢC của phim — ĐÚNG các cổng nhan-ban.py sẽ chặn (04/11/2026: dòng #49/#50 phim 167292 đếm creative CTA cũ là 'có sẵn', bỏ cắt,
    tới bước Lên camp cả 6 bị chặn 'chưa đạt luật CTA mới'): chấm đạt · ĐẠT CTA mới (etp.creative.cta_dat) · chưa bị Meta từ chối · chưa có camp ·
    không cùng đoạn với camp đang chạy / đang đồng bộ của phim. MỘT chỗ — bước dựng dòng và bước Lên camp cùng gọi.
    MỖI ĐOẠN MỘT creative (06/11/2026: dòng #68 phim 167292 đếm 8 creative 'có sẵn' cùng đoạn 857–936 → bỏ cắt, lên camp 1 rồi 7 cái kia thành trùng đoạn → 1/5 camp)"""
    return [int(x) for x in sql(f"""select distinct on (coalesce(r.doan, r.creative_id::text)) r.creative_id from etp.creative r join etp.cham_cong g using (creative_id)
        where r.content_id = {int(cid)} and g.duoc_len and r.cta_dat and r.tu_choi is null{f" and r.dang = {s(LOAI[loai])}" if loai in TINH else ""}
          and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)
          and (r.doan is null or r.doan not in (select k.doan from etp.camp c join etp.creative k using (creative_id) where c.content_id = {int(cid)} and k.doan is not null
                                                and (c.trang_thai = 'ACTIVE' or coalesce(c.dong_bo, '') not in ('done', 'synced', 'error'))))
        order by coalesce(r.doan, r.creative_id::text), r.creative_id desc""").split() if x.isdigit()]
def san_cua(cid, loai=None): return len(san_dung_lai(cid, loai))
# loai: dòng kiểu tĩnh (PO / AT / …) chỉ dùng lại creative ĐÚNG dạng đó — lọc MỘT chỗ ở đây (09/11/2026: bước dựng đếm mọi dạng, thấy đủ nên bỏ bước làm creative,
# bước Lên camp lọc đúng dạng PO → "không có creative sạch nào để lên camp", 119 dòng PO / 24 giờ)

def ai_dong(d, chu):
    """NGƯỜI LÀM THẬT của lệnh lên camp từ dòng phim → --ai cho nhan-ban: dòng MÁY tạo (etp.dong_phim.ai bắt đầu "máy") ghi "máy: …", dòng anh / người tạo ghi "anh (…)".
    17/11/2026: mọi dòng máy lộ trình đều ghi người làm là anh (etp.on.tc) → cổng phanh chợ tưởng anh bấm tay, lọt 91 camp mới 00:01–00:12."""
    return f"máy: dòng phim #{d['id']} — {chu}" if str(d.get("ai") or "").strip().lower().startswith("máy") else f"anh ({chu})"

def b_camp_mr(d, truoc):
    """MỞ RỘNG (anh bấm ＋ ở dòng phim, chọn số camp): creative sạch vừa làm + creative sạch có sẵn chưa có camp của phim → lên đúng so_camp camp ★ ROAS (bộ của phim; mặc định nhan-ban từ 24/11/2026)"""
    cr = truoc.get("creative") or {}; moi = [int(x["creative_id"]) for x in (cr.get("sach") or ([cr] if cr.get("creative_id") else []))]
    san = [] if d.get("loai") == CC2 else san_dung_lai(d["content_id"], d.get("loai"))   # CC2: chỉ creative logo vừa dựng · kiểu tĩnh: chỉ creative đúng dạng đó (lọc trong san_dung_lai)
    cu = camp_co_san(moi)   # creative của chính dòng đã có camp (lượt trước bị huỷ giữa chừng / máy luật lấy thay) = đã lên, tính vào số camp
    ds = [c for c in dict.fromkeys(moi + san) if c not in cu][:max(0, int(d["so_camp"]) - len(cu))]
    if not ds and not cu: return "dung", "không có creative sạch nào để lên camp", None
    # bộ anh chọn ở Thao tác bảng phim (etp.dong_phim.bo, anh 15/11/2026) → bộ đó; không chọn → phim đã có bộ → bộ đó; phim mới → etp.cau_hinh.bo_phim_moi (cong.SQL_BO_PHIM)
    bo = str(d.get("bo") or "").strip() or sql(CG.SQL_BO_PHIM.format(cid=int(d['content_id'])))
    if not bo: return "loi", "không đọc được bộ của phim (ethopex_phim_tk / etp.cau_hinh.bo_phim_moi)", None
    xong, loi, may_ = [], [], False
    for i_, c in enumerate(ds):
        sql(f"update etp.dong_buoc set ghi = {s(f'đang lên camp {i_ + 1}/{len(ds)} (creative #{c})')}, nhip = now() where dong_id = {d['id']} and buoc = 'camp'")
        lang = sql(f"select coalesce(lang, 'en') from etp.creative where creative_id = {c}") or "en"
        ten = re.sub(r"[^ -~]|['\"$`\\]", "", f"dp{d['id']} {d.get('ten') or ''} {lang.upper()} - mo rong #{c}")
        rc, out = box(f"""bash -c 'cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON.get(lang, KHUON["en"])} --tay --bo {bo} --creative {c} --content {d["content_id"]} --ten "{ten}" --that --luat "mở rộng phim — anh chọn {d['so_camp']} camp (etp.on.tc)" --ai "{ai_dong(d, "etp.on.tc: nút mở rộng ở dòng phim, 04/11/2026")}"'""", 1500, ve=ve_dong(d))
        j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{") and '"ok"' in l), None) or {}
        if j.get("ok") and j.get("moi"): xong.append(int(j["moi"]))
        else: loi.append(f"#{c}: {(j.get('loi') or out[-120:])[:120]}"); may_ = may_ or not j or bool(j.get("may"))
    ket, ghi, kq = ket_camp(d, xong, loi, cu, may=may_)
    thieu = int(d["so_camp"]) - len(xong) - len(cu)
    return ket, (f"{len(xong) + len(cu)}/{d['so_camp']} camp · " + ghi + (f" · thiếu {thieu} (không đủ creative sạch)" if thieu > 0 and not loi else "")) if ket == "xong" else ghi, kq

# KHỐI CAMP (anh 25/11/2026 "Nếu lên theo khối của phim thì sẽ phải nhìn thấy đủ các thành phần, các camp đang sx", etp.khoi — migration 0470):
# dòng thuộc khối lên camp bằng ĐÚNG tham số khối (★ ROAS theo mức muc_camp · $/ngày · khuôn theo tiếng có miền = khối.mien), MỖI CAMP MỘT CREATIVE RIÊNG — không đọc hoi_cho / KHUON.
# Camp khối đi bằng vé trực tiếp → dòng khối mang ai DONG_TRUC_TIEP, mỗi camp một vé
# trong số camp của etp.cau_hinh.nhiem_vu_ngay (cong.py cấp theo câu anh). Hết vé = chờ, không có đường tự lên.
def b_camp_khoi(d, truoc):
    k = d["khoi"]
    if k.get("trang_thai") != "chay": return "cho", f"khối #{k['id']} {k.get('ten') or ''} chưa duyệt (trạng thái {k.get('trang_thai')})", None
    cr = truoc.get("creative") or {}; sach = cr.get("sach") or []
    muc = muc_camp(k, d.get("so_camp"))
    if len(sach) < len(muc): return "loi", f"mới có {len(sach)}/{len(muc)} creative sạch — mỗi mức ★ ROAS cần một creative riêng", None
    bo = str(d.get("bo") or "").strip() or sql(CG.SQL_BO_PHIM.format(cid=int(d['content_id'])))
    if not bo: return "loi", "không đọc được bộ của phim", None
    ds = [int(x["creative_id"]) for x in sach[:len(muc)]]
    # creative anh / máy đã LOẠI (etp.cham_duyet ok=false — vd trùng hình chỉ khác giọng, anh 25/11/2026 "Vi phạm nghiêm trọng luật") KHÔNG BAO GIỜ lên camp, kể cả đã nằm trong danh sách sạch của khối
    bo_loai = {int(x) for x in sql(f"select creative_id from etp.cham_duyet where ok is false and creative_id in ({','.join(map(str, ds))})").split() if x.isdigit()} if ds else set()
    if bo_loai: ds = [c for c in ds if c not in bo_loai]; muc = muc[:len(ds)]
    xong, loi, gan, may_ = [], [], [], False
    da = {int(a): int(b) for a, b in (l.split("\t") for l in sql(f"select creative_id, count(*) from etp.camp where creative_id in ({','.join(map(str, ds))}) group by 1").splitlines() if l.count("\t") == 1)}
    for i, c in enumerate(ds):
        if da.get(c): continue   # mỗi creative đúng MỘT camp — đã có thì mức này xong
        lang = sql(f"select coalesce(lang, 'en') from etp.creative where creative_id = {c}") or "en"
        khuon = int((k.get("khuon") or {}).get(lang) or 0)
        if not khuon: loi.append(f"#{c}: khối #{k['id']} không có khuôn tiếng {lang}"); continue
        mien = sql(f"select coalesce(mien, '') from etp.camp where camp_id = {khuon}")
        if k.get("mien") and mien != k["mien"]: return "dung", f"khuôn #{khuon} miền {mien or '?'} khác miền khối {k['mien']} — sửa etp.khoi.khuon", None
        ve = ve_dong(d)
        if not ve: return ("cho", f"đã lên {len(xong)} camp · chờ vé nhiệm vụ ngày cho phim {d['content_id']} (cong.py --ve-truc-tiep nhan_ban --phim {d['content_id']})", None) if not xong else ket_camp(d, xong, loi + ["hết vé"], {}, gan, may_)
        ke = sql(f"select roas from etp.ke_cr where creative_id = {c} limit 1")   # MỘT nguồn mức (view 0476) — cùng mức etp2 / lenh_cho.py hiện + lên khi anh duyệt
        if ke: muc[i] = float(ke)
        sql(f"update etp.dong_buoc set ghi = {s(f'khối #{k['id']}: lên camp ★{muc[i]:g} (creative #{c})')}, nhip = now() where dong_id = {d['id']} and buoc = 'camp'")
        ten = re.sub(r"[^ -~]|['\"$`\\]", "", f"dp{d['id']} {d.get('ten') or ''} {lang.upper()} - khoi {k['id']} roas {muc[i]} cr moi #{c}")
        rc, out = box(f"""bash -c 'cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {khuon} --roas {muc[i]} --ns {int(float(k["ns"]))} --tay --bo {bo} --creative {c} --content {d["content_id"]} --ten "{ten}" --that --luat "khối #{k['id']} ★{muc[i]} (anh 25/11/2026)" --ai "{ai_dong(d, f"khối #{k['id']} etp2")}"'""", 1500, ve=ve)
        j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{") and '"ok"' in l), None) or {}
        if j.get("ok") and j.get("moi"): xong.append(int(j["moi"])); gan.append({"creative_id": c, "camp": int(j["moi"]), "roas": muc[i]})
        else: loi.append(f"#{c}: {(j.get('loi') or out[-120:])[:120]}"); may_ = may_ or not j or bool(j.get("may")); break
    return ket_camp(d, xong, loi, {}, gan, may_) if xong or loi else ("xong", f"khối #{k['id']}: đủ {len(muc)} camp, mỗi mức ★ ROAS một creative riêng", None)

def ap_kien(d, truoc):
    """CC2: creative vừa dựng → chữ kiểu Kiên của phim (ap-form-chu.py --kieu kien, chỉ creative nhà chưa gắn camp) trước khi nhan-ban; lỗi → (kết, ghi), ổn → None"""
    cr = truoc.get("creative") or {}; ds = [int(x["creative_id"]) for x in (cr.get("sach") or ([cr] if cr.get("creative_id") else []))]
    if not ds: return None
    rc, out = box(f"bash -c 'cd apps/etp && python3 ap-form-chu.py --kieu kien {' '.join(map(str, ds))}'", 600)
    j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{")), None)
    if j is None: return "loi", f"áp chữ Kiên không trả kết quả: {out[-300:]}"
    hong = {k: v for k, v in j.items() if v not in ("ok", "không đổi") and "đã gắn camp" not in str(v)}
    return ("dung", "áp chữ Kiên: " + " · ".join(f"#{k}: {v}" for k, v in hong.items())[:400]) if hong else None

def b_camp(d, truoc):
    if d.get("loai") == CC2 and (h := ap_kien(d, truoc)): return h[0], h[1], None
    if d.get("khoi"): return b_camp_khoi(d, truoc)
    if d.get("loai") in TINH and not str(d.get("ai") or "").startswith("máy: bù camp"): d = {**d, "so_camp": max(int(d.get("so_camp") or 0), AT_BAN)}   # 3 camp $1 / phim (anh 08/11/2026); dòng bù giữ đúng k (09/11)
    if d.get("so_camp"): return b_camp_mr(d, truoc)
    if d.get("loai") == "LT": return b_camp_lt(d, truoc)
    # BỘ CREATIVE ĐỦ LOẠI TRƯỚC, CHƯA LÊN CAMP (anh 03/11/2026 "phải làm đủ 1 bộ creative cho mọi loại nội dung trước. Chưa lên camp"):
    # phim có etp.cau_hinh lo_trinh[cid].bo mà anh chưa bắt đầu → mọi loại (CC / KT …) dừng ở đây, giữ creative đã chấm
    lt = lo_trinh(d["content_id"])
    if lt.get("bo") and not lt.get("bat_dau"): tu_bat_dau(d["content_id"], f"máy tự bắt đầu — dòng #{d['id']} bộ creative đủ loại (anh 05/11/2026 bỏ bước duyệt)")
    x = truoc.get("creative") or {}
    if not x.get("creative_id"): return "loi", "chưa có creative", None
    if (cu := camp_co_san([x["creative_id"]])): return ket_camp(d, [], [], cu)
    lang = x.get("lang") or "en"; ten = re.sub(r"['\"$`\\]", "", x.get("ten") or f"dp{d['id']} phim {d['content_id']}")
    rc, out = box(f"""bash -c 'cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON.get(lang, KHUON["en"])} --tay --bo 2 --creative {int(x["creative_id"])} --content {d["content_id"]} --ten "{ten}" --that --luat "dòng phim tự động #{d["id"]} (etp.on.tc)" --ai "{ai_dong(d, "etp.on.tc: Chạy tự động dòng phim, 03/11/2026")}"'""", 1500, ve=ve_dong(d))
    j = next((json.loads(l) for l in reversed(out.splitlines()) if l.startswith("{") and '"ok"' in l), None)
    if not j: return "loi", f"nhan-ban không trả kết quả: {out[-300:]}", None
    if j.get("ok") and j.get("moi"):
        sql(f"update etp.dong_phim set camp_id = {int(j['moi'])} where id = {d['id']}")
        return "xong", f"lên camp ★ ROAS #{j['moi']} (bộ 2, {('chạy ' + str(j['chay_luc'])) if j.get('chay_luc') else 'giờ theo lịch lên'}{', chờ Meta đồng bộ' if j.get('cho_dong_bo') else ''})", {"camp_id": int(j["moi"])}   # giờ thật từ nhan-ban.lich_len
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
    if j.get("sync_status") == "done" and j.get("state") == "ACTIVE":
        # Ethopex để camp HẸN GIỜ ở ACTIVE ngay lúc tạo (lịch lên camp nhan-ban.lich_len): bước vẫn xong (chờ 8 giờ thì quá hạn bước, Mạnh huỷ) nhưng ghi giờ hẹn
        # vào ket_qua.hen — trang hiện "hẹn 07:00 06/11" tới giờ đó, không hiện "chạy" (anh 06/11/2026 "Phải lên theo lịch chứ?"); cùng định nghĩa lib/etp-chay.ts
        hen = sql(f"select to_char(lich at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') || '|' || to_char(lich at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') from etp.camp where camp_id = {int(camp)} and lich > now()")
        if hen: return "xong", f"camp #{camp} đã tạo, hẹn chạy {hen.split('|')[1]} theo lịch lên camp", {"camp_id": camp, "hen": hen.split("|")[0]}
        return "xong", f"camp #{camp} đang chạy (ACTIVE)", {"camp_id": camp}
    if j.get("sync_status") == "done" and j.get("state") == "PAUSED": return "dung", f"camp #{camp} đồng bộ xong nhưng PAUSED (có người / máy luật tắt)", None
    return "cho", f"camp #{camp} {j.get('state')} · {j.get('sync_status')} — chờ Ethopex kiểm ad", None

# DỌN TỆP THỪA TRÊN iMAC NGAY KHI PHIM SẢN XUẤT XONG (anh 04/11/2026 "sx xong phim nào trên iMAC thì dọn file thừa ngay lập tức" — đĩa còn 11 GB,
# nguon 70 GB · ra 18 GB · vx-kc 4 GB). Chỉ dọn thứ máy tự sinh lại được và không còn ai dùng:
#   ra/dp<id>*   — đoạn cắt / tệp tải creative của dòng đã XONG (dòng dừng / lỗi: hết 3 ngày Mạnh còn mở lại)
#   nguon/<phim> — tập gốc tải về, khi phim không còn dòng chạy, không còn việc cắt chờ / đang làm, và 30 phút không ai ghi
#   vx-kc/<tập>  — clip máy sinh kể chuyện, khi bản đó đã thành creative (thư viện có creative_id) / đã lên; bản bị bỏ thì sau 2 ngày
# TRẦN TẢI PHIM (anh 16/11/2026: "giới hạn ngay số phim ethopex tải về mỗi lần. Làm xong cái nào dọn dẹp gọn mới đc phép tải tiếp" — ổ iMac còn 3,6 GB,
# nguon/ 41 GB của 189 phim: bước Nhận tải 2 tập mọi phim vào hàng, luật dọn cũ giữ tập gốc của MỌI phim có dòng chạy, kể cả dòng còn đứng chờ cắt).
# Nay: iMac giữ tập gốc tối đa TRAN_TAI phim; tập gốc chỉ CẦN khi phim đang cắt (bước cắt 'dang' / việc cắt đang làm trên máy này) hoặc đã cắt mà chưa soát xong.
# Bước Nhận tải xong là xoá; bước Cắt tới trần thì dọn rồi chờ, phim trước xong + dọn mới tải phim kế.
TRAN_TAI = 3
def giu_nguon():
    """phim đang có tập gốc (.mp4) trong ~/.cache/ethopex/nguon trên máy này"""
    g = os.path.join(C, "nguon")
    return {t for t in (os.listdir(g) if os.path.isdir(g) else []) if t.isdigit() and any(f.endswith(".mp4") for f in os.listdir(os.path.join(g, t)) if os.path.isfile(os.path.join(g, t, f)))}
def can_nguon():
    """phim còn CẦN tập gốc: dòng chạy đang cắt, hoặc cắt xong mà soát chưa xong; việc cắt đang làm trên máy này"""
    return set(sql(f"""select distinct d.content_id::text from etp.dong_phim d join etp.dong_buoc c on c.dong_id = d.id and c.buoc = 'cat'
                       left join etp.dong_buoc s on s.dong_id = d.id and s.buoc = 'soat'
                       where d.trang_thai = 'chay' and (c.trang_thai = 'dang' or (c.trang_thai = 'xong' and coalesce(s.trang_thai, 'cho') <> 'xong'))
                       union select distinct content_id::text from etp.viec where trang_thai = 'dang' and may = '{MAY}' and content_id is not null""").split())
DON = [0.0]
def don_dep():
    import shutil
    ds = [l.split("\t") for l in sql("select id, trang_thai, (tao_luc < now() - interval '3 days')::text, content_id from etp.dong_phim").splitlines() if l.count("\t") == 3]
    xong = {int(i) for i, tt, cu, _ in ds if tt == "xong" or (tt in ("dung", "loi", "huy") and cu == "true")}
    dung = can_nguon()   # tập gốc chỉ giữ khi phim đang cắt / chờ soát (TRAN_TAI ở trên) — trước giữ cho mọi phim có dòng chạy, 41 GB / 189 phim
    xa = {t for t in sql("select tap_id from etp.thu_vien where tap_id is not null and (creative_id is not null or trang_thai = 'da_len' or (trang_thai = 'loai' and cap_nhat < now() - interval '2 days'))").split()}
    bo, tong = [], 0
    def xoa(p):
        nonlocal tong
        tong += sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(p) for f in fs if os.path.isfile(os.path.join(r, f)))
        shutil.rmtree(p, ignore_errors=True); bo.append(os.path.basename(p))
    chay = {int(i) for i, tt, _, _ in ds if tt == "chay"}
    moi_nhat = lambda p_: max([os.path.getmtime(p_)] + [os.path.getmtime(os.path.join(r, f)) for r, _, fs in os.walk(p_) for f in fs])
    for ten in os.listdir(os.path.join(C, "ra")):
        p_ = os.path.join(C, "ra", ten); m = re.fullmatch(r"dp(\d+)(l\w*)?", ten)
        if not os.path.isdir(p_): continue
        if m and int(m.group(1)) in xong: xoa(p_)
        # MỌI LÔ KHÁC (sua-cta.py, thư viện tv…, pm…) 3 ngày không ai ghi → xoá (anh 07/11/2026 "dọn đi + sửa": 212 lô sửa CTA giữ 21 GB vì luật chỉ biết lô dp)
        elif not (m and int(m.group(1)) in chay) and time.time() - moi_nhat(p_) > 3 * 86400: xoa(p_)
    for ten in os.listdir(os.path.join(C, "nguon")):
        p_ = os.path.join(C, "nguon", ten)
        if ten.isdigit() and os.path.isdir(p_) and ten not in dung and time.time() - moi_nhat(p_) > 600: xoa(p_)
        elif ten.isdigit() and os.path.isdir(p_):   # phim còn dùng: bản chuẩn hoá -chuan.mp4 đã nằm trong ghep-cuoi.mp4 → bỏ (cat-cuoi-lo dùng lại tệp ghép, không chuẩn hoá lại)
            g = os.path.join(p_, "ghep-cuoi.mp4")
            for f in os.listdir(p_):
                if f.endswith("-chuan.mp4") and os.path.exists(g) and os.path.getmtime(g) >= os.path.getmtime(os.path.join(p_, f)) and time.time() - os.path.getmtime(g) > 600:
                    tong += os.path.getsize(os.path.join(p_, f)); os.remove(os.path.join(p_, f)); bo.append(f"{ten}/{f}")
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
        args = NV.doi_nen([a.replace("@DIR@", tm).replace("@FONTS@", os.path.abspath(FONTS)) for a in v["args"]])   # box3 dựng lệnh libx264 → iMac nén bằng VideoToolbox
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
    j = sql("""select coalesce(json_agg(x), '[]') from (select p.id, p.content_id, p.ten, p.trang_thai, p.camp_id, p.loai, p.so_camp, p.ai, p.bo, p.khoi_id,
               (select row_to_json(k) from etp.khoi k where k.id = p.khoi_id) khoi,
               (select json_object_agg(b.buoc, json_build_object('trang_thai', b.trang_thai, 'ket_qua', b.ket_qua, 'lan', b.lan, 'fix', b.fix, 'huy', b.huy,
                       'tuoi', extract(epoch from now() - coalesce(b.nhip, b.bat_dau))::int)) from etp.dong_buoc b where b.dong_id = p.id) buoc
               from etp.dong_phim p where p.trang_thai = 'chay' or exists (select 1 from etp.dong_buoc b where b.dong_id = p.id and b.fix)
               order by (p.loai in (""" + ", ".join(f"'{k}'" for k in sorted(DG.TINH)) + """)) desc, (select coalesce(sum(s.thu - s.chi), 0) from (select k.content_id, s.ngay, s.chi, s.thu from etp.so_ngay s join etp.camp k using (camp_id) union all select k.content_id, s.ngay, s.chi, s.thu from etp.so_ngay_ngoai s join etp.camp_ngoai k using (camp_id)) s where s.content_id = p.content_id and s.ngay >= current_date - 3) desc, (p.ai like 'máy: lộ trình tự động thí điểm%') desc, p.id) x""")   # ảnh tĩnh lấy lượt nặng trước (anh 08/11/2026 "lên loại ảnh tĩnh ưu tiên cho nhanh")   # phim thí điểm lấy lượt cắt trước (TRAN_CAT), đừng đứng sau cả hàng
    return json.loads(j or "[]")

# HẾT NGUYÊN LIỆU CẮT THÌ CHUYỂN KỂ CHUYỆN (anh 04/11/2026 "vì sao vẫn còn film ko thể sx và cách khắc phục triệt để"): cắt / soát / chấm hết đường
# (mọi khung trùng đoạn đã có · không còn đoạn sạch · creative bị cổng chấm chặn) → dựng một dòng KT cho phim, cùng số camp, đứng đầu hàng máy sinh
# (bậc 5000) — máy sinh vốn chạy liên tục theo hàng đợi, dòng này chỉ đổi thứ tự, không thêm lượt sinh. Mỗi phim một dòng KT trong 3 ngày.
HET_NL = re.compile(r"hết khung mới|không còn đoạn sạch|bị cổng chấm chặn|creative bị cổng chấm chặn / giữ")
# TẠM GÁC DÒNG KT (anh 08/11/2026 "tạm gác dòng KT lại, tập trung các dạng khác"): công tắc etp.cau_hinh.gac_kt (true = gác). Gác thì dòng KT đang chạy dừng
# ('dung', vong), phim hết nguyên liệu cắt chuyển ảnh tĩnh thay vì mở dòng KT (sang_ke_chuyen). Mở lại: đặt gac_kt = false rồi bấm FIX dòng KT muốn chạy tiếp.
GAC_KT_LY = "tạm gác dòng kể chuyện (anh 08/11/2026) — mở lại: etp.cau_hinh.gac_kt = false rồi FIX"
def gac_kt(): return sql("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'gac_kt'), 'false')") == "true"
# GÁC THEO DẠNG (anh 08/11/2026 "Các camp chờ dạng khác như AT, ATT chưa lên thì pause lại để ưu tiên sang dạng PO"): etp.cau_hinh.gac_dang = [mã dòng] —
# dòng đang chạy của các dạng đó mà chưa tới bước lên camp thì dừng hẳn (ly_do "tạm gác dòng …", manh.py không tự mở lại); lo_trinh_phim không xếp dạng đó.
# Mở lại: bỏ mã khỏi gac_dang rồi FIX dòng. gac_kt = true (cũ) tính như có "KT" trong danh sách.
def gac_dang():
    try: g = {str(x) for x in json.loads(sql("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'gac_dang'), '[]')") or "[]")}
    except ValueError: g = set()
    return g | ({"KT"} if gac_kt() else set())
def gac_ly(ma):
    # lý do ĐỌC TỪ DB etp.cau_hinh.gac_dang_ly (anh ghi lúc bấm 🔒 Gác dạng ở tab Sản xuất etp2, 26/11/2026) — không viết cứng lý do ở đây
    try: ly = (sql(f"select coalesce((select gia_tri->>{s(ma)} from etp.cau_hinh where khoa = 'gac_dang_ly'), '')") or "").strip()
    except Exception: ly = ""
    if ma == "KT" and not ly: return GAC_KT_LY
    return f"tạm gác dòng {ma} — {ly or 'chưa ghi lý do'} · mở lại: nút 🔒 Gác dạng ở tab Sản xuất etp2 rồi FIX"

def sang_ke_chuyen(d, buoc, ghi):
    if d.get("loai") == "KT" or buoc not in ("cat", "soat", "creative") or not HET_NL.search(ghi or ""): return None
    if "KT" in gac_dang(): return (doi_at(d, "hết nguyên liệu cắt", ("CC", CC2, "LT", None)).lstrip(" ·") or None)   # gác KT (gac_dang hoặc gac_kt cũ) → ảnh tĩnh / poster nếu chưa gác
    cid = int(d["content_id"])
    if CG.phim_cam(cts=[cid], q=sql): return None
    co = sql(f"select id from etp.dong_phim where content_id = {cid} and loai = 'KT' and tao_luc > now() - interval '3 days' order by id desc limit 1")
    if co: return f"đã có dòng kể chuyện #{co} cho phim"
    moi = sql(f"""insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp) select content_id, ten, the_loai, 'KT', 'máy: dòng #{d["id"]} hết nguyên liệu cắt', so_camp
                  from etp.dong_phim where id = {d['id']} returning id""")
    return f"tự chuyển sang kể chuyện: dòng #{moi}" if moi else None

# SẢN XUẤT THEO CHỢ (anh 18/11/2026 "mấy hôm nay không cho lên camp mới thì sx cũng không bật lên được" — sổ luật san_xuat_theo_cho): 24 giờ tới 23:40 18/11
# 521 dòng chạy hết nhận / poster soát 18+ / cắt / soát / chấm rồi mới dừng ở bước camp vì PHANH CHỢ. Nay đọc khoá cong.KHOA_SX (lo_trinh_phim.ghi_sx ghi mỗi lượt
# đồng bộ — đúng cổng lên camp của máy, không đọc phanh lần thứ hai): phanh bật thì bước CHƯA BẮT ĐẦU trong BUOC_SX đứng 'cho' với lý do "chờ phanh nhả: …" (dòng vẫn
# 'chay' — giữ chỗ, lộ trình không xếp dòng thứ hai; phanh nhả thì chạy tiếp ngay, không FIX). Bước creative đang chờ máy chấm thì trả về 'cho' (giữ ket_qua, không làm
# lại). Phim hồi chợ còn thiếu kho dự trữ (du_tru) vẫn chạy các bước sản xuất; bước camp luôn chờ (cổng lên camp chặn máy khi phanh).
BUOC_SX = tuple(CG.SXC["buoc_cho"])   # sổ luật chung san_xuat_theo_cho.buoc_cho
SX = [{}]
# DÒNG LỆNH TRỰC TIẾP CỦA ANH (anh 21/11/2026 22:00 VN, lúc dừng khẩn đang bật: "Lên camp 2 phim này ở cả 2 ngôn ngữ en và es. Dùng các định dạng cc, ct và at") —
# dòng có etp.dong_phim.ai bắt đầu DONG_TRUC_TIEP chạy các bước SẢN XUẤT qua mọi phanh (kể cả dừng khẩn); bước CAMP vẫn chờ phanh như mọi dòng: camp chỉ lên bằng
# vé lệnh trực tiếp (cong.py --ve-truc-tiep, Claude cấp theo câu anh) — chữ ai tự khai giả được (18/11) nên nó không bao giờ mở cổng lên camp, chỉ mở sản xuất.
DONG_TRUC_TIEP = "anh — TRỰC TIẾP"
def la_truc_tiep(d): return str((d or {}).get("ai") or "").startswith(DONG_TRUC_TIEP)
# VÉ CHO DÒNG (21/11/2026): Claude cấp vé --ve-truc-tiep nhan_ban --phim <cid> theo câu anh, MỖI CAMP MỘT VÉ; máy dòng không cấp vé, chỉ DÙNG vé còn hạn của đúng phim:
# bước camp của dòng trực tiếp mở khi phim có vé, mỗi lệnh nhan-ban mang một vé (ETP_VE) — nhan-ban đốt lúc gửi, lệnh sau lấy vé kế; hết vé thì cổng chặn như thường.
SQL_VE_DONG = "select ma from etp.ve_tay where loai = 'truc_tiep' and viec = 'nhan_ban' and content_id = {cid} and camp_id is null and da_dung is null and het_han > now() order by tao limit 1"
def ve_dong(d): return (sql(SQL_VE_DONG.format(cid=int(d["content_id"]))) or None) if la_truc_tiep(d) else None
def cho_phanh(sx, d, buoc, co_ve=False):
    """hàm thuần: khoá san_xuat_cho + dòng + bước (+ phim có vé trực tiếp) → câu lý do chờ | None (chạy)"""
    if not (sx or {}).get("phanh"): return None
    if la_truc_tiep(d): return None if buoc != "camp" or co_ve else f"{sx['phanh']} · dòng lệnh trực tiếp: camp lên bằng vé cong.py --ve-truc-tiep nhan_ban --phim {d.get('content_id')}"
    if sx.get("khan"): return None if buoc == "chay" else sx["phanh"]   # DỪNG KHẨN: mọi bước chưa bắt đầu đứng chờ, không miễn du_tru / chi_sx
    if buoc not in BUOC_SX: return None
    if buoc != "camp" and int(d.get("content_id") or 0) in {int(x) for x in [*(sx.get("du_tru") or []), *(sx.get("chi_sx") or [])]}: return None   # chi_sx: phim chỉ sản xuất không lên camp nên không chờ phanh
    return sx["phanh"]

def lam_buoc(d, buoc):
    truoc = {k: (v.get("ket_qua") or {}) for k, v in (d.get("buoc") or {}).items() if v.get("trang_thai") == "xong"}
    # PHIM CẤM ĐỨNG ĐẦU MỌI BƯỚC (anh 19/11/2026 "ko cho mở camp mới, lên creative dưới mọi hình thức" — etp:phim-cam-con-lai-2011): dòng nào (lộ trình, mở rộng,
    # phim đội lãi, tự FIX) của phim trong sổ cấm cũng dừng trước khi cắt / soát / dựng / chấm / lên camp — cùng một bộ đọc cong.phim_cam (lỗi đọc → chặn)
    ly_cam = CG.phim_cam(cts=[d.get("content_id")], q=sql)
    try: ket, ghi, kq = ("dung", ly_cam, None) if ly_cam else HAM[buoc](d) if buoc in ("nhan", "ws", "poster", "cat") else HAM[buoc](d, truoc)
    except Exception as e: ket, ghi, kq = "loi", f"{type(e).__name__}: {str(e)[:300]}", None
    if ket == "cho" and buoc == "creative" and (ly := cho_phanh(SX[0], d, buoc)):   # creative đã dựng, chờ máy chấm mà phanh bật → trả bước về hàng, giữ kết quả
        sql(f"""update etp.dong_buoc set trang_thai = 'cho', bat_dau = null, nhip = now(), pid = null, lan = greatest(lan - 1, 0), ghi = {s(f'{ly} · {ghi}'[:500])}{', ket_qua = ' + js(kq) if kq else ''}
                where dong_id = {d['id']} and buoc = '{buoc}' and trang_thai = 'dang'""")
        print(f"[{time.strftime('%H:%M:%S')}] dòng #{d['id']} phim {d['content_id']} · {buoc} → chờ phanh nhả", flush=True); return
    if sql(f"select huy::text from etp.dong_buoc where dong_id = {d['id']} and buoc = '{buoc}'") == "true" and ket != "xong":
        ket, ghi = "loi", f"bị huỷ (Mạnh / nút Dừng) — {ghi}"
    k_mang = (d["id"], buoc, int(((d.get("buoc") or {}).get(buoc) or {}).get("lan") or 0))   # đếm RIÊNG lượt thử lại vì mạng của LẦN bật này — `lan` đếm cả FIX tay và không tăng khi thử lại (05/11/2026: #51 đã FIX 4 lần → không bao giờ được thử lại)
    if ket == "loi" and re.search(r"ssh:|Connection (closed|reset|refused|timed out)|kex_exchange|Operation timed out|Broken pipe|mux_client|Session open refused|Control ?[Ss]ocket|ensure-clone lỗi|exit status 255", ghi or "") and THU_MANG.get(k_mang, 0) < 3:
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

# NHÀ MỞ RỘNG PHIM ĐỘI LÃI (anh 06/11/2026 "phải mở thêm ở Nhà các camp kiểu này"): phim trong etp.phim_doi_lai (nhà + đội ROI cao, ngày đã khép) → máy tự xếp
# dòng mở rộng CC với so_camp = len_doi_lai.so_camp — đường dòng lo cả creative đúng CTA mới (dùng lại creative sạch có sẵn, thiếu thì cắt), soát, chấm, lên camp $1.
# Đợt đầu 06/11 qua hàng chờ cho_len_v lên 0 camp: creative có sẵn của 169100 / 172519 / 153695 đều CTA cũ. Mỗi phim một đợt / 24 giờ, không xếp khi phim đang có dòng chạy.
DOI_LAI = [0.0]
def dung_camp_moi():
    """anh dừng lên camp mới để review (cong.KHOA_DUNG_CAMP_MOI) → không xếp / mở lại dòng nào"""
    return sql(CG.SQL_DUNG_CAMP_MOI).strip() == "t"
def luat_cu():
    """LUẬT CŨ DỪNG (anh 22/11/2026, sổ luật luat_cu): đợt đổi lại 06/11, mở lại trần ngày 08/11, trần test 18/11, cứu creative 07/11 là luật trước 20/11 → không chạy"""
    return CG.LUAT_CU_DUNG

def mo_doi_lai():
    if time.time() - DOI_LAI[0] < 600 or dung_camp_moi() or luat_cu(): return
    if CC2 in gac_dang(): return   # CC2 gác → không tự xếp; CC đã thay bằng CC2 (anh 26/11/2026) — trước: CC gác (anh 21/11 + 26/11/2026 "ko sx cc/ct", gac_dang) → không tự xếp dòng CC mỗi 24 giờ rồi để vòng sau dừng
    con = (SX[0].get("kho") or {}).get("con")
    if SX[0].get("phanh") or (con is not None and con <= 0): return   # sản xuất theo chợ (anh 18/11/2026): phanh / đủ ~1 ngày chỗ lên → không xếp dòng mở rộng
    DOI_LAI[0] = time.time()
    for l in sql("""begin; select pg_advisory_xact_lock(4390);
        insert into etp.dong_phim (content_id, ten, loai, ai, so_camp)
        select d.content_id, p.ten, 'CC2', 'máy: phim đội lãi ROI ' || d.roi || '% trên $' || round(d.chi) || ' (' || coalesce((g.gia_tri->>'ngay'), '3') || ' ngày đã khép, nhà + đội)',
          case when m.pha = 'dinh' then least(2, coalesce((g.gia_tri->>'so_camp')::int, 5)) else coalesce((g.gia_tri->>'so_camp')::int, 5) end
        from etp.phim_doi_lai d left join etp.phim p using (content_id) left join etp.mo_rong m using (content_id), (select (select gia_tri from etp.cau_hinh where khoa = 'len_doi_lai') gia_tri) g
        -- ĐỒNG HỒ THỊ TRƯỜNG (etp.mo_rong.pha, anh 06/11/2026 "các đồng hồ đang có chưa dùng đến à"): vượt sức chứa → không mở · quanh tối ưu → 2 camp · còn dư địa / chưa đủ số → so_camp
        where coalesce(p.nhom_goc, 'au_my') = 'au_my' and m.pha is distinct from 'bao_hoa'
          and d.content_id = any('{@KIEN@}'::bigint[])   -- CC2 chỉ phim có chữ Kiên (chu-kieu.json)
          and not exists (select 1 from etp.dong_phim x where x.content_id = d.content_id and x.trang_thai = 'chay')
          and not exists (select 1 from etp.dong_phim x where x.content_id = d.content_id and x.ai like 'máy: phim đội lãi%' and x.tao_luc > now() - interval '24 hours')
        returning id, content_id; commit;""".replace("@KIEN@", ",".join(DS_KIEN()))).splitlines():
        if "\t" in l: print(f"[{time.strftime('%H:%M:%S')}] phim đội lãi → xếp dòng mở rộng #{l.split(chr(9))[0]} phim {l.split(chr(9))[1]}", flush=True)

# MỞ LẠI KHÔNG TRÙNG (18/11/2026: 1.197 dòng huỷ "FIX bỏ qua" / 24 giờ): mọi đường tự FIX (mo_tran_*, Mạnh muc5 / muc6) chỉ mở dòng d khi phim CHƯA có dòng cùng loại
# đang chạy — kiểm lúc đặt fix, không đặt rồi để vòng sau huỷ
KHONG_TRUNG = CG.SQL_KHONG_TRUNG
def mo_tran_ngay():
    """DÒNG DỪNG VÌ TRẦN CAMP MỚI / NGÀY TỰ LÊN LẠI SANG NGÀY MỚI (08/11/2026: đợt ATT/PD/CTS 9 phim — 6 dòng creative sạch dừng "chạm trần 100 camp
    mới / ngày … mai lên tiếp" mà không máy nào làm câu "mai lên tiếp"): ngày VN mới + còn chỗ dưới trần → FIX bước camp của các dòng đó (dừng từ ngày
    trước, trong 3 ngày), tối đa bằng số chỗ còn lại; dòng vẫn vấp trần thì dừng lại với ngày hôm nay và chờ hôm sau."""
    if dung_camp_moi() or luat_cu(): return
    for l in sql(f"""with con as (select (select gia_tri::text::int from etp.cau_hinh where khoa = '{CG.KHOA_TRAN_NGAY}') - ({CG.SQL_TAO_HOM_NAY}) n),
        -- chỗ còn tính theo SỐ CAMP, không theo số dòng (16/11/2026: limit n dòng, mỗi dòng mở rộng 2–6 camp → 61 chỗ thành ~147 camp lúc 00:00)
        ung as (select b.dong_id, sum(greatest(coalesce(d.so_camp, 1), 1)) over (order by d.so_camp desc nulls last, b.ket_thuc, b.dong_id) cong
                from etp.dong_buoc b join etp.dong_phim d on d.id = b.dong_id
                where b.buoc = 'camp' and b.trang_thai = 'dung' and not b.fix and strpos(b.ghi, '{CG.KHOA_TRAN_NGAY}') > 0 and d.trang_thai = 'dung' and {KHONG_TRUNG}
                  and (b.ket_thuc at time zone 'Asia/Ho_Chi_Minh')::date < (now() at time zone 'Asia/Ho_Chi_Minh')::date and b.ket_thuc > now() - interval '3 days'),
        mo as (select ung.dong_id from ung, con where con.n > 0 and ung.cong <= con.n)
        update etp.dong_buoc b set fix = true from mo where b.dong_id = mo.dong_id and b.buoc = 'camp' returning b.dong_id""").splitlines():
        if l.strip(): print(f"[{time.strftime('%H:%M:%S')}] dòng #{l.strip()} — ngày mới, còn chỗ dưới trần camp/ngày → FIX bước camp", flush=True)

def mo_tran_test():
    """DÒNG DỪNG VÌ TRẦN CAMP TEST / PHIM TỰ LÊN LẠI KHI CÓ CHỖ (anh 18/11/2026, cong.KHOA_TRAN_TEST): creative đã dựng xong mà bước camp bị cổng chặn vì phim đủ camp
    test chưa lãi → khi một camp test tắt / thành lãi (hoặc phim lãi ổn định) thì FIX bước camp — mỗi lượt một dòng / phim, dòng dừng trong 3 ngày; vẫn vấp thì dừng lại chờ lượt sau."""
    if dung_camp_moi() or luat_cu(): return
    for l in sql(f"""with ung as (select distinct on (d.content_id) b.dong_id, d.content_id from etp.dong_buoc b join etp.dong_phim d on d.id = b.dong_id
                where b.buoc = 'camp' and b.trang_thai = 'dung' and not b.fix and strpos(b.ghi, '{CG.KHOA_TRAN_TEST}') > 0 and d.trang_thai = 'dung' and b.ket_thuc > now() - interval '3 days' and {KHONG_TRUNG}
                order by d.content_id, b.ket_thuc),
        mo as (select dong_id from ung where coalesce({CG.sql_test_con('ung.content_id')}, 1) > 0)
        update etp.dong_buoc b set fix = true from mo where b.dong_id = mo.dong_id and b.buoc = 'camp' returning b.dong_id""").splitlines():
        if l.strip(): print(f"[{time.strftime('%H:%M:%S')}] dòng #{l.strip()} — phim có chỗ camp test → FIX bước camp", flush=True)

CHAY = {}   # (dòng, bước) → (thread, lần chạy cuối)
# KHE NẶNG CÔNG BẰNG (anh 15/11/2026 "rất nhiều camp chờ đang ko thể sx"): TRAN_CAT khe chung cho cắt CC + creative tĩnh, dòng tĩnh xếp trước (luật 08/11 khi
# chỉ ≤ 6 dòng AT chờ) → 250 dòng PO / AT chiếm trọn 2 khe, 146 dòng CC đứng ở bước cắt không dòng nào bắt đầu. Giờ: một loại chỉ giữ hết khe khi loại kia
# không có việc chờ; loại kia đang chờ thì mỗi loại tối đa TRAN_CAT // 2. Tổng tải iMac giữ nguyên (đo 15/11: 8 nhân, tải ~29 — không nới tổng).
# CẮT NHỜ MÁY THỢ KHÁC (anh 15/11/2026 "khi sx đã có nhiều máy tham gia hỗ trợ nên ko nhất thiết phải dùng iMAC"): HP may-cao-nha (etp-tho-nha.timer) + VPS
# may-cao-vn (etp-tho-vps.timer) tự nhận mọi việc etp.viec đang chờ, nhưng dòng phim chỉ XẾP việc cắt khi iMac còn khe → từ 07/11 hai máy không có việc nào.
# iMac đủ khe → dòng CC vẫn mở bước cắt ở chế độ NGOÀI: xếp việc vào hàng chung rồi chờ máy khác nhận (luồng nhẹ, không tính khe nặng iMac), tối đa TRAN_NGOAI
# dòng một lúc (HP 1 thợ có gác quạt + VPS 2 thợ); CHO_NGOAI giây không máy nào nhận thì iMac tự cắt như cũ.
CAT_NGOAI = set(); TRAN_NGOAI = 4; CHO_NGOAI = 20 * 60
def kieu_nang(i, b, loai=None):
    loai = loai or LOAI_DONG.get(i)
    return ("cat" if i not in CAT_NGOAI else None) if b == "cat" else "tinh" if b == "creative" and loai in TINH else None

def khe_nang(i, b, cho):
    me = kieu_nang(i, b); dang = [kieu_nang(j, c) for (j, c), (th, _) in CHAY.items() if th.is_alive() and kieu_nang(j, c)]
    if len(dang) >= TRAN_CAT: return False
    return not (cho - {me}) or dang.count(me) < max(1, TRAN_CAT // 2)
DUNG = [None]
def vong():
    if not (DUNG[0] and DUNG[0].is_alive()):   # một lệnh dựng dự phòng một lúc (iMac còn cắt phim cho dòng phim)
        DUNG[0] = threading.Thread(target=dung_imac, daemon=True); DUNG[0].start()
    sql(f"insert into etp.dong_may (may, nhip, pid) values ('{MAY}', now(), {os.getpid()}) on conflict (may) do update set nhip = now(), pid = excluded.pid")
    if time.time() - DON[0] > 1800:   # dọn khi có phim vừa xong (DON về 0) + quét lại 30 phút / lần cho phần còn lại (máy sinh KT, việc cắt vừa xong)
        DON[0] = time.time()
        try: don_dep()
        except Exception as e: print(f"dọn lỗi: {e}", flush=True)
    try: mo_doi_lai()
    except Exception as e: print(f"mở rộng phim đội lãi lỗi: {str(e)[:200]}", flush=True)
    try: mo_tran_ngay()
    except Exception as e: print(f"mở lại dòng chạm trần ngày lỗi: {str(e)[:200]}", flush=True)
    try: mo_tran_test()
    except Exception as e: print(f"mở lại dòng chạm trần camp test / phim lỗi: {str(e)[:200]}", flush=True)
    try: SX[0] = json.loads(sql(CG.SQL_SX) or "{}")   # khoá san_xuat_cho (lo_trinh_phim.ghi_sx) — quá hạn / đọc hỏng = {} → chạy như cũ
    except Exception: SX[0] = {}
    # PHIM CHỈ SẢN XUẤT (anh 20/11/2026 "chỉ sx", sổ cong.KHOA_CHI_SX): bước sản xuất chạy cả khi phanh, tới bước camp thì khép dòng. Đọc hỏng → {} (cổng chan_cua vẫn chặn tạo camp)
    try: chi_sx = CG.ds_chi_sx(q=sql)
    except Exception: chi_sx = {}
    if chi_sx and not SX[0].get("khan"): SX[0] = {**SX[0], "chi_sx": list(chi_sx)}
    cho_ph = {}   # câu chờ phanh → [dòng] — ghi gộp một câu SQL cuối vòng
    gac = gac_dang(); ds_dong = doc_dong()
    # loại lượt nặng đang CHỜ khe (cắt CC / creative tĩnh) — khe_nang giữ một khe cho loại kia khi nó có việc chờ
    cho_nang = {kieu_nang(d["id"], b, d.get("loai")) for d in ds_dong for b in [next((b for b, _ in BUOC if ((d.get("buoc") or {}).get(b) or {}).get("trang_thai") in ("dang", "cho")), None)]
                if b and d["trang_thai"] == "chay" and kieu_nang(d["id"], b, d.get("loai")) and ((d.get("buoc") or {}).get(b) or {}).get("trang_thai") == "cho"}
    for d in ds_dong:
        bs = d.get("buoc") or {}
        if d.get("loai") in gac and d["trang_thai"] == "chay" and not any((bs.get(b) or {}).get("trang_thai") in ("dang", "xong") for b in ("camp", "chay")):   # đã tới bước lên camp thì để chạy nốt
            with KHOA: pr = [p for (i, _), p in DANG.items() if i == d["id"]]
            for p in pr: giet_cay(p.pid)
            sql(f"""update etp.dong_buoc set trang_thai = 'dung', ket_thuc = now(), ghi = {s(gac_ly(d["loai"]))}, fix = false where dong_id = {d['id']} and trang_thai in ('dang', 'cho') and buoc not in ('camp', 'chay');
                    update etp.dong_phim set trang_thai = 'dung', ly_do = {s(gac_ly(d["loai"]))}, xong_luc = now() where id = {d['id']} and trang_thai = 'chay'""")
            print(f"[{time.strftime('%H:%M:%S')}] dòng #{d['id']} {d['loai']} — {gac_ly(d['loai'])}", flush=True); continue
        if not bs:   # dòng mới (web vừa tạo): dựng 8 bước — hạn từng bước khai MỘT chỗ ở đây
            live = d.get("so_camp") and sql(f"select count(*) from etp.camp where content_id = {d['content_id']} and trang_thai = 'ACTIVE' and not la_roas") not in ("", "0")
            bq = BO_QUA.get(d.get("loai") or "CC", set()) | ({"nhan", "ws", "poster"} if live else set()) | ({"cat", "soat"} if (d.get("khoi") or {}).get("mau") else set())   # khối có mẫu: dung-mau tự tải tập + chọn khung   # mở rộng phim ĐANG có camp Nhà chạy mới bỏ nhận / trang / poster; phim chưa có camp Nhà (vd phim chỉ team chạy, bấm ＋ ở tab Phim) vẫn qua đủ cổng
            co_mau = bool((d.get("khoi") or {}).get("mau"))   # khối có mẫu: creative MỚI theo mẫu, không lấy creative cũ của phim (anh 25/11/2026)
            if not co_mau:
                if d.get("so_camp") and san_cua(d["content_id"], d.get("loai")) >= int(d["so_camp"]): bq |= {"cat", "soat", "creative"}   # DÙNG LẠI creative sạch có sẵn đủ số → không cắt (anh 04/11/2026)
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
                # FIX mở lại dòng mà phim đã có dòng cùng loại đang chạy → vấp chỉ mục dong_phim_mot, lỗi ném ra hỏng CẢ VÒNG, mọi dòng xếp sau đứng
                # (07/11/2026: 34 lần, phim 165009) → chỉ dòng trùng bị huỷ, các dòng khác chạy tiếp
                if sql(f"select 1 from etp.dong_phim x where x.content_id = {d['content_id']} and x.loai = '{d.get('loai')}' and x.trang_thai = 'chay' and x.id <> {d['id']} limit 1"):
                    sql(f"update etp.dong_buoc set fix = false where dong_id = {d['id']}; update etp.dong_phim set trang_thai = 'huy', ly_do = 'FIX bỏ qua: phim đã có dòng cùng loại đang chạy' where id = {d['id']}")
                    print(f"[{time.strftime('%H:%M:%S')}] dòng #{d['id']} FIX bỏ qua — trùng dòng đang chạy", flush=True); bs = None; break
                # FIX giữ creative đã tải còn ĐANG CHỜ CHẤM (duoc_len null) hoặc đã được lên — chỉ bỏ ket_qua khi mọi creative đã bị chặn (26/11/2026: FIX 6 dòng CC2 chờ chấm suýt tải lại creative trùng)
                sql(f"""update etp.dong_buoc set trang_thai = 'cho', fix = false, huy = false, bat_dau = null, ket_thuc = null, pid = null, ghi = 'FIX — chạy lại', ket_qua = case when '{b}' = 'creative' and not exists (select 1 from etp.cham_cong g where g.duoc_len is not false and g.creative_id in (select (ket_qua->>'creative_id')::int union select (e->>'creative_id')::int from jsonb_array_elements(coalesce(ket_qua->'ds', '[]'::jsonb)) e)) then null else ket_qua end
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
        if not dang and ke == "camp" and int(d["content_id"]) in chi_sx:   # creative đã dựng + chấm xong → khép dòng, không gọi nhan-ban
            ly_sx = f"chỉ sản xuất — creative đã dựng + chấm, không lên camp ({chi_sx[int(d['content_id'])][:120]}; sổ etp.cau_hinh.{CG.KHOA_CHI_SX})"
            sql(f"""update etp.dong_buoc set trang_thai = 'bo_qua', ghi = {s(ly_sx)}, nhip = now() where dong_id = {d['id']} and buoc in ('camp', 'chay') and trang_thai = 'cho';
                    update etp.dong_phim set trang_thai = 'xong', ly_do = {s(ly_sx)}, xong_luc = now() where id = {d['id']} and trang_thai = 'chay'""")
            DON[0] = 0; print(f"[{time.strftime('%H:%M:%S')}] dòng #{d['id']} phim {d['content_id']} — {ly_sx}", flush=True); continue
        if not dang and (ly := cho_phanh(SX[0], d, ke, co_ve=ke == "camp" and la_truc_tiep(d) and bool(ve_dong(d)))): cho_ph.setdefault(f"{ke}: {ly}", []).append(d["id"]); continue   # phanh chợ: bước chưa bắt đầu đứng chờ (BUOC_SX)
        # LƯỢT NẶNG trên iMac = bước cắt + bước creative AT (anh-tinh.py cũng tải tập + ffmpeg + Vision) → chung trần TRAN_CAT, kẻo 13 dòng AT xếp một lúc chạy đồng loạt
        LOAI_DONG[d["id"]] = d.get("loai"); nang = lambda i, b: kieu_nang(i, b) is not None
        if nang(d["id"], ke) and not dang and not khe_nang(d["id"], ke, cho_nang):
            if ke != "cat" or sum(1 for (i, b), (th, _) in CHAY.items() if b == "cat" and i in CAT_NGOAI and th.is_alive()) >= TRAN_NGOAI: continue
            CAT_NGOAI.add(d["id"])   # iMac đủ khe → xếp việc cho máy thợ khác (b_cat chờ ở chế độ ngoài)
        if ke == "camp" and sum(1 for (_, b), (th, _) in CHAY.items() if b == "camp" and th.is_alive()) >= TRAN_CAMP: continue   # TRAN_CAMP: box3 không gánh 50 nhan-ban một lúc
        if not dang:
            sql(f"update etp.dong_buoc set trang_thai = 'dang', bat_dau = now(), nhip = now(), lan = lan + 1, may = '{MAY}' where dong_id = {d['id']} and buoc = '{ke}' and trang_thai = 'cho'")
            bs.setdefault(ke, {})["lan"] = (bs.get(ke) or {}).get("lan", 0) + 1
        th = threading.Thread(target=lam_buoc, args=(d, ke), daemon=True); th.start(); CHAY[(d["id"], ke)] = (th, time.time())
    # lý do chờ phanh hiện trên thẻ dòng phim (dong_phim.ly_do + ghi bước) — một câu SQL / vòng; phanh nhả thì gỡ lý do cũ
    cho_id = sorted({i for v in cho_ph.values() for i in v})
    cau = [f"update etp.dong_phim set ly_do = null where trang_thai = 'chay' and ly_do like '%chờ phanh nhả%' and id not in ({','.join(map(str, cho_id)) or '0'})"]
    for k, ids in cho_ph.items():
        b, ly = k.split(": ", 1)
        cau += [f"update etp.dong_phim set ly_do = {s(k[:500])} where id in ({','.join(map(str, ids))}) and trang_thai = 'chay' and ly_do is distinct from {s(k[:500])}",
                f"update etp.dong_buoc set ghi = {s(ly[:500])}, nhip = now() where dong_id in ({','.join(map(str, ids))}) and buoc = '{b}' and trang_thai = 'cho' and coalesce(ghi, '') not like 'chờ phanh nhả%'"]
    try: sql(";\n".join(cau) + ";")
    except Exception as e: print(f"ghi lý do chờ phanh lỗi: {str(e)[:200]}", flush=True)

# CỨU CREATIVE BỊ CỔNG CHẤM CHẶN (anh 07/11/2026 "làm cả 4"): mỗi 15 phút một lượt apps/etp/cuu_cham.py trong luồng riêng (cắt bỏ khung + lên creative chạy vài phút,
# không giữ chân vòng dòng phim). Lượt đang chạy thì không bật lượt mới. Chỉ ở iMac (cắt video — cấm dựng video trên box3).
CUU = {"luot": 0.0, "th": None}
def cuu():
    if luat_cu() or SX[0].get("khan") or time.time() - CUU["luot"] < 900 or (CUU["th"] and CUU["th"].is_alive()): return   # dừng khẩn: không cắt lại creative
    CUU["luot"] = time.time()
    def chay():
        try: print(f"[{time.strftime('%H:%M:%S')}] cứu creative bị chặn: {CU.chay()}", flush=True)
        except Exception as e: print(f"[{time.strftime('%H:%M:%S')}] cứu creative lỗi: {type(e).__name__}: {str(e)[:300]}", flush=True)
    CUU["th"] = threading.Thread(target=chay, daemon=True); CUU["th"].start()

# HÀNG CHỜ MÁY DỰNG THEO MẪU (anh 20/11/2026 "Sao ko tự chạy ? Máy dựng chờ cái gì ?" — phim anh chọn ở tab Mẫu Creative nằm "chờ máy dựng" vì không tiến trình nào gọi
# dung-mau.py --hang): máy dòng phim (tiến trình đã có trên iMac, không thêm tiến trình mới) mỗi 2 phút xem hàng etp.mau_phim / etp.mau_dung, có việc chờ thì chạy
# dung-mau.py --hang bằng môi trường ~/.venvs/poster-mau trong một luồng riêng — một lượt một lúc, lượt đang chạy thì không bật lượt mới. Nhật ký: ~/Library/Logs/ethopex/dung-mau.log
MAU_HANG = {"luot": 0.0, "th": None}
def mau_hang():
    if SX[0].get("khan") or time.time() - MAU_HANG["luot"] < 120 or (MAU_HANG["th"] and MAU_HANG["th"].is_alive()): return   # dừng khẩn: không dựng theo mẫu
    MAU_HANG["luot"] = time.time(); py = os.path.expanduser("~/.venvs/poster-mau/bin/python")
    if not os.path.exists(py): return
    try: n = int(sql("select count(*) from etp.mau_phim m left join etp.mau_dung d using (mau, content_id) where d.mau is null or (d.trang_thai = 'cho' and (d.buoc = 'cho' or d.cap_nhat < now() - interval '20 minutes'))") or 0)
    except Exception: return   # bảng chưa có / box3 không tới được → lượt sau
    if not n: return
    def chay():
        print(f"[{time.strftime('%H:%M:%S')}] máy dựng theo mẫu: {n} việc chờ → chạy hàng", flush=True)
        try:
            with open(os.path.expanduser("~/Library/Logs/ethopex/dung-mau.log"), "a") as f:
                rc = subprocess.run([py, os.path.join(E, "dung-mau.py"), "--hang"], stdout=f, stderr=subprocess.STDOUT, timeout=3 * 3600).returncode
            print(f"[{time.strftime('%H:%M:%S')}] máy dựng theo mẫu: xong lượt (mã thoát {rc})", flush=True)
        except Exception as e: print(f"[{time.strftime('%H:%M:%S')}] máy dựng theo mẫu lỗi: {type(e).__name__}: {str(e)[:300]}", flush=True)
    MAU_HANG["th"] = threading.Thread(target=chay, daemon=True); MAU_HANG["th"].start()

# XEM TRƯỚC BẢN SOẠN (anh 23/11/2026 "Chưa nhìn đc sp trc khi bấm sinh ra"): ngăn Creative của phim trên etp2 đổi mẫu / chữ / ô ghim → etp.cr_soan.xem_tt = 'cho'.
# Vòng này (mỗi 10 giây, cùng tiến trình) thấy việc chờ thì chạy dung-mau.py --xem-soan trong một luồng: dựng ảnh tĩnh thật, không giọng / không nạp (~0₫). Một lượt một lúc.
XEM_HANG = {"luot": 0.0, "th": None}
def xem_hang():
    if SX[0].get("khan") or time.time() - XEM_HANG["luot"] < 8 or (XEM_HANG["th"] and XEM_HANG["th"].is_alive()): return
    XEM_HANG["luot"] = time.time(); py = os.path.expanduser("~/.venvs/poster-mau/bin/python")
    if not os.path.exists(py): return
    try: n = int(sql("select count(*) from etp.cr_soan where xem_tt = 'cho' and mau is not null") or 0)
    except Exception: return   # cột chưa có (migration 0468 chưa áp) / box3 không tới được
    if not n: return
    def chay():
        try:
            with open(os.path.expanduser("~/Library/Logs/ethopex/dung-mau.log"), "a") as f:
                subprocess.run([py, os.path.join(E, "dung-mau.py"), "--xem-soan"], stdout=f, stderr=subprocess.STDOUT, timeout=1800)
        except Exception as e: print(f"[{time.strftime('%H:%M:%S')}] xem trước bản soạn lỗi: {type(e).__name__}: {str(e)[:300]}", flush=True)
    XEM_HANG["th"] = threading.Thread(target=chay, daemon=True); XEM_HANG["th"].start()

def tu_kiem():
    p = {"phanh": "chờ phanh nhả: PHANH CHỢ: x", "du_tru": [7]}
    assert cho_phanh(p, {"content_id": 1}, "poster") == p["phanh"] and cho_phanh(p, {"content_id": 1}, "camp") == p["phanh"] and cho_phanh(p, {"content_id": 1}, "chay") is None, "phanh: bước sản xuất + camp chờ, bước chờ camp chạy giữ nguyên"
    assert cho_phanh(p, {"content_id": 7}, "creative") is None and cho_phanh(p, {"content_id": 7}, "camp") == p["phanh"], "phim hồi chợ thiếu kho dự trữ vẫn sản xuất, không lên camp"
    assert cho_phanh({**p, "chi_sx": [9]}, {"content_id": 9}, "creative") is None and cho_phanh({**p, "chi_sx": [9]}, {"content_id": 1}, "creative") == p["phanh"], "phim chỉ sản xuất không chờ phanh ở bước sản xuất"
    k = {"phanh": "chờ phanh nhả: ĐANG DỪNG KHẨN", "khan": True, "du_tru": [7], "chi_sx": [9]}
    assert cho_phanh(k, {"content_id": 7}, "creative") == k["phanh"] and cho_phanh(k, {"content_id": 9}, "cat") == k["phanh"] and cho_phanh(k, {"content_id": 1}, "chay") is None, "dừng khẩn: không miễn du_tru / chi_sx"
    tt = {"content_id": 1, "ai": DONG_TRUC_TIEP + " (chat 21/11)"}
    assert cho_phanh(k, tt, "camp", co_ve=True) is None and cho_phanh(k, {"content_id": 1}, "camp", co_ve=True) == k["phanh"], "vé trực tiếp chỉ mở bước camp của dòng trực tiếp"
    assert cho_phanh(k, tt, "cat") is None and cho_phanh(k, tt, "creative") is None and cho_phanh(k, tt, "camp").startswith(k["phanh"]) and cho_phanh(k, {**tt, "ai": "anh (etp.on.tc)"}, "cat") == k["phanh"], "dòng lệnh trực tiếp: sản xuất qua dừng khẩn, camp vẫn chờ vé"
    assert cho_phanh({}, {"content_id": 1}, "nhan") is None and cho_phanh({"phanh": None}, {"content_id": 1}, "nhan") is None and cho_phanh(None, {"content_id": 1}, "nhan") is None, "không phanh / khoá quá hạn → chạy như cũ"
    assert set(BUOC_SX) == {b for b, _ in BUOC} - {"chay"} and "not exists" in KHONG_TRUNG
    # phim cấm (etp:phim-cam-con-lai-2011): cùng bộ đọc cong.phim_cam qua ssh — 167292 dừng mọi bước, phim thường đi qua
    thuong = int(sql("select min(content_id) from etp.cho_len_v where ly_do is null") or 0)
    assert "sổ cấm" in (CG.phim_cam(cts=[167292], q=sql) or ""), "LỌT: dòng phim 167292 không bị chặn"
    assert thuong and CG.phim_cam(cts=[thuong], q=sql) is None, f"phim thường #{thuong} bị chặn nhầm"
    print(f"✓ phim cấm: dòng phim 167292 dừng trước mọi bước, phim thường #{thuong} đi qua")
    assert ngon_ngu_link("https://www.dramaboxdb.com/ep/42000026686_get-out-of-my-bugatti/701580673_Episode-1") == "en" and ngon_ngu_link("https://www.dramaboxdb.com/es/ep/42000028394_x/1_Episode-1") == "es" and ngon_ngu_link("https://www.dramaboxdb.com/movie/42000026686/x") == "en" and ngon_ngu_link("https://www.reelshort.com/es/x") == "", "đọc ngôn ngữ link DramaBox"
    assert lech_ngon_ngu(82854) == "" and lech_ngon_ngu(85055) == "", "Bugatti es đã sửa link es, bản en đúng en"
    print("✓ link tập sai ngôn ngữ: DramaBox /es/ ↔ phim es, bản không tiền tố = en")
    print("✓ dong_phim.py tự kiểm (sản xuất theo chợ: bước chờ phanh, kho dự trữ hồi chợ, mở lại không trùng)")

# BẢN SAO BÁM MAIN (anh 20/11/2026 "tiếp và hoàn thiện b3"): máy từng chạy từ cây làm việc chung /Users/htuan/Me/GitHub/earns-marketing-os-v2 — cây đó chậm main 327 commit
# (việc dở của nhiều phiên), nên luật dòng phim từ 18/11, logo cắt rời, xếp khung theo tóm tắt đều chưa có ở máy sản xuất thật. Nay máy chạy từ bản sao riêng
# (thư mục gốc có tệp dấu .may-bam-main, không ai sửa tay ở đó): mỗi 10 phút kéo origin/main kiểu chỉ-tiến (không gộp, không ghi đè) → tệp mã đổi thì vòng tự nạp lại.
# Không có tệp dấu (cây làm việc thường) → không đụng git.
GOC_REPO = os.path.abspath(os.path.join(R, "..", "..")); BAM = [0.0, 0.0, 0.0]   # lần kéo cuối · lúc bắt đầu hỏng · lúc báo Telegram cuối
# BÁO TELEGRAM từ máy iMac: khoá bot chỉ nằm trên box3 (/root/.secrets/mine-tg.env) → gửi qua ssh, chữ đi STDIN; cùng chủ đề 📂 Ethopex như lich-gio.py bao_tg
TG_BOX = r"""import json, sys, urllib.request
env = dict(l.strip().split("=", 1) for l in open("/root/.secrets/mine-tg.env") if "=" in l and not l.lstrip().startswith("#"))
topic = json.load(open("/var/lib/cty/tg-ethopex.json")).get("topic")
body = {"chat_id": env["TG_CHAT"].strip('"'), "text": sys.stdin.read(), "link_preview_options": {"is_disabled": True}, **({"message_thread_id": topic} if topic else {})}
urllib.request.urlopen(urllib.request.Request("https://api.telegram.org/bot" + env["TG_BOT_TOKEN"].strip(chr(34)) + "/sendMessage", data=json.dumps(body).encode(), headers={"content-type": "application/json"}), timeout=20)"""
def bao_tg(chu):
    try: subprocess.run([*SSH, B, "python3 -c " + shlex.quote(TG_BOX)], input=chu, capture_output=True, text=True, timeout=60)
    except Exception as e: print(f"báo Telegram lỗi: {e}", flush=True)

def bam_main():
    """KÉO MAIN cho bản sao máy (có tệp .may-bam-main) mỗi 10 phút. 25–26/11/2026 máy đứng ở mã 25/11 hơn một ngày vì tệp sửa cục bộ cũ (.pyc, anh-tinh.py)
    chặn ff-only, lỗi chỉ nằm trong log → (1) tệp cục bộ chặn kéo: tự CẤT bằng git stash (giữ bản, không xoá) rồi kéo lại;
    (2) vẫn hỏng ≥ 30 phút: báo Telegram chủ đề Ethopex, nhắc lại mỗi 6 giờ tới khi kéo được."""
    if time.time() - BAM[0] < 600 or not os.path.exists(os.path.join(GOC_REPO, ".may-bam-main")): return
    BAM[0] = time.time()
    keo = lambda: subprocess.run(f"git -C '{GOC_REPO}' fetch -q origin main && git -C '{GOC_REPO}' merge -q --ff-only FETCH_HEAD", shell=True, capture_output=True, text=True, timeout=180)
    r = keo()
    if r.returncode and re.search(r"local changes|would be overwritten|commit your changes", r.stderr + r.stdout):
        ten = f"máy dòng phim tự cất {time.strftime('%d/%m %H:%M')}: tệp cục bộ chặn kéo main"
        c = subprocess.run(["git", "-C", GOC_REPO, "stash", "push", "-m", ten], capture_output=True, text=True, timeout=60)
        print(f"[{time.strftime('%H:%M:%S')}] {ten} → git stash ({(c.stdout or c.stderr).strip()[-120:]})", flush=True)
        r = keo()
    if not r.returncode:
        if BAM[1]: bao_tg(f"✅ [{MAY}] máy dòng phim kéo được main lại")
        BAM[1] = 0.0; return
    loi = (r.stderr or r.stdout).strip()[-300:]
    print(f"[{time.strftime('%H:%M:%S')}] kéo main cho bản sao máy dòng phim lỗi: {loi[-200:]}", flush=True)
    BAM[1] = BAM[1] or time.time()
    if time.time() - BAM[1] >= 1800 and time.time() - BAM[2] >= 6 * 3600:
        BAM[2] = time.time()
        bao_tg(f"⛔ [{MAY}] máy dòng phim KHÔNG kéo được mã mới {int((time.time() - BAM[1]) // 60)} phút — đang chạy mã cũ, commit mới chưa có hiệu lực.\n{GOC_REPO}\n{loi}")

def main(a):
    if a and a[0] == "--tu-kiem": return tu_kiem()
    if a and a[0] == "mot": vong(); time.sleep(int(a[1]) if len(a) > 1 else 60); return   # một vòng rồi chờ các bước vừa bật (thử)
    # BỎ TẦNG NỀN macOS (anh 07/11/2026 "vẫn chậm"): launcher cũ chạy `taskpolicy -b`, execv khi nạp mã giữ nguyên tầng nền → mọi thợ cắt / ffmpeg / Vision con
    # bị dồn sang nhân E + bóp đĩa (ưu tiên 4; khung 65 s cắt 13 phút). setpriority(PRIO_DARWIN_PROCESS, 0, 0) tự gỡ, con sinh sau thừa hưởng (đo: 4 → 31)
    if sys.platform == "darwin":
        import ctypes; ctypes.CDLL(None).setpriority(4, 0, 0)
    print(f"[{MAY}] máy chạy dòng phim bắt đầu (pid {os.getpid()})", flush=True)
    # TỰ NẠP MÃ MỚI (04/11/2026: tiến trình chạy liền từ 13:49 giữ mã cũ trong bộ nhớ — --tay, lý do poster, chờ KT sửa xong đều chưa có hiệu lực,
    # dòng #49 vẫn bị chặn trùng đội sau deploy): tệp mã của máy đổi → thôi nhận bước mới, chờ các bước đang chạy xong rồi execv chính nó
    ma = [os.path.abspath(__file__), os.path.join(E, "loi_ky_thuat.py"), os.path.join(R, "cuu_cham.py"), os.path.join(E, "cat-bo-cham.py"), os.path.join(R, "cong.py"), os.path.join(R, "so_dang.py")]
    dau = lambda: [os.path.getmtime(f) for f in ma if os.path.exists(f)]
    goc = dau()
    while True:
        try: bam_main()
        except Exception as e: print(f"kéo main lỗi: {str(e)[:160]}", flush=True)
        if dau() != goc:
            if not any(th.is_alive() for th, _ in CHAY.values()) and not (CUU["th"] and CUU["th"].is_alive()):
                print(f"[{MAY}] mã máy đổi — nạp lại", flush=True); os.execv(sys.executable, [sys.executable, "-u", os.path.abspath(__file__), *a])
            try: sql(f"update etp.dong_may set nhip = now() where may = '{MAY}'")   # còn sống trong lúc chờ — Mạnh không báo máy im
            except Exception: pass
            time.sleep(10); continue
        try: vong()
        except Exception as e: print(f"vòng lỗi: {type(e).__name__}: {str(e)[:300]}", flush=True)
        cuu()
        try: mau_hang()
        except Exception as e: print(f"hàng máy dựng theo mẫu lỗi: {str(e)[:160]}", flush=True)
        try: xem_hang()
        except Exception as e: print(f"xem trước bản soạn lỗi: {str(e)[:160]}", flush=True)
        time.sleep(10)

if __name__ == "__main__": main(sys.argv[1:])
