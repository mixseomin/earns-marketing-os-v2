#!/usr/bin/env python3
# PHÂN NHÓM KHO R2 kho/ethopex — nhóm nào Ethopex/Meta KHÔNG còn đọc lại, để cất Drive rồi gỡ khỏi R2 (sm94, 21/11/2026: R2 142 GB / ngưỡng 50 GB).
# Chỉ ĐỌC (R2 liệt kê + Ethopex API + psql) — không chép, không xoá. Việc chuyển là của người giữ kho (tai).
#   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 apps/etp/kho-r2.py do
#   … python3 apps/etp/kho-r2.py ds <nhom>      → khoá R2 (kho/ethopex/…) của nhóm, mỗi dòng một tệp
#   … python3 apps/etp/kho-r2.py chuyen <nhom> … → CHÉP nhóm sang Drive kho-may/ethopex/<cùng khoá> + đối kích thước (không xoá R2)
#   … python3 apps/etp/kho-r2.py xoa [--that]    → XOÁ HẲN khỏi R2 (không cất Drive, anh 26/11/2026): tệp chỉ thuộc creative mà MỌI camp (nhà + đội) đã tắt và tạo trước 20/11,
#                                                  + nhóm chết (tv_bo, tv_mo_coi, tp_mo_coi, tp_tu_choi) + thư viện đã lên của creative chết; bản Drive cùng khoá vào thùng rác Drive.
#                                                  Ghi etp.kho_xoa TRƯỚC khi xoá → cửa API chặn lên camp mới bằng creative mất tệp. Không --that = chỉ đo.
#   python3 apps/etp/kho-r2.py --tu-kiem        → tự kiểm phần phân nhóm (không cần mạng)
# Gốc sự thật "còn đọc": video_url / thumbnail_url / image_url của MỌI creative trên Ethopex + etp.creative.video/anh. Meta tải lại URL
# mỗi lần camp/ad mới dùng creative (external_creative_id rỗng), nên creative còn có thể nhân bản thì tệp của nó phải ở R2.
import json, os, re, subprocess, sys, time
from collections import defaultdict

NONG_NGAY = 14          # creative có camp mới / tạo trong 14 ngày = còn nóng (nhân bản đang dùng tới)
MO_COI_NGAY = 2         # tệp mồ côi trẻ hơn 2 ngày có thể đang giữa lô len-creative → chưa đụng
GOC = "kho/ethopex/"
NHOM = {   # tên: (an_toàn_chuyển, giải thích)
    "tv_bo":      (True,  "thư viện: bản đã loại / máy lỗi — không creative nào trỏ"),
    "tv_da_len":  (True,  "thư viện: bản đã lên creative — creative đọc bản thanh-pham, không đọc bản này"),
    "tv_mo_coi":  (True,  "thư viện: tệp không còn dòng nào trỏ (chạy lại đã ghi đè URL)"),
    "tp_mo_coi":  (True,  "thanh-pham: không creative nào trỏ, cũ hơn 2 ngày (lô hỏng / dựng lại)"),
    "tp_tu_choi": (True,  "thanh-pham: mọi creative trỏ tới đều bị từ chối"),
    "tp_nghi":    (False, "thanh-pham: creative còn sống nhưng không camp nào dùng trong 14 ngày — nhân bản vẫn có thể gọi lại"),
    "giu_nong":   (False, "thanh-pham: creative có camp / tạo trong 14 ngày"),
    "giu_giong":  (False, "giọng CTA mp3 — len-creative đọc thẳng"),
    "giu_tv_cho": (False, "thư viện: bản sẵn sàng / đang sinh — chờ lên"),
    "giu_moi":    (False, "tệp mồ côi mới hơn 2 ngày"),
    "khac":       (False, "ngoài thu-vien / thanh-pham"),
}

def _ref_tu_cr(cr):   # mọi khoá kho/ethopex/… nhắc trong một creative (video_url là chuỗi JSON danh sách)
    return set(re.findall(r"https?://[^\s\"'\\]+?/(kho/ethopex/[^\s\"'\\\]]+)", json.dumps(cr)))

def _goc_mp4(ten):    # ảnh bìa <b>.jpg / tc-<b>.jpg đi theo <b>.mp4
    d, f = os.path.split(ten)
    if f.endswith(".jpg"): return os.path.join(d, (f[3:] if f.startswith("tc-") else f)[:-4] + ".mp4")
    return ten

def phan_loai(tep, ref, tv, nong, tu_choi, bay_gio):
    """tep {khoá: (byte, epoch)} · ref {khoá: {creative_id}} · tv {khoá: trạng thái thu_vien} · nong {creative_id} · tu_choi {creative_id}"""
    ra = {}
    for k, (_, luc) in tep.items():
        cu = bay_gio - luc > MO_COI_NGAY * 86400
        if k.startswith(GOC + "thu-vien/"):
            if k in ref: ra[k] = "giu_nong" if ref[k] & nong else "tp_nghi"
            elif k not in tv: ra[k] = "tv_mo_coi" if cu else "giu_moi"
            elif tv[k] in ("loai", "loi_may"): ra[k] = "tv_bo"
            elif tv[k] == "da_len": ra[k] = "tv_da_len"
            else: ra[k] = "giu_tv_cho"
        elif k.startswith(GOC + "thanh-pham/"):
            f = os.path.basename(k)
            if f.endswith(".mp3") or f.startswith("cta-"): ra[k] = "giu_giong"; continue
            cr = ref.get(k) or ref.get(_goc_mp4(k)) or set()
            if not cr: ra[k] = "tp_mo_coi" if cu else "giu_moi"
            elif cr & nong: ra[k] = "giu_nong"
            elif cr <= tu_choi: ra[k] = "tp_tu_choi"
            else: ra[k] = "tp_nghi"
        else: ra[k] = "khac"
    return ra

DRIVE_DICH = "khodrive:kho-may/ethopex/"   # cùng gốc với `kho cat` (DRIVE=khodrive, DRIVE_GOC=kho-may) — khoá R2 kho/ethopex/<x> ↔ Drive kho-may/ethopex/<x>

def _dong_chuyen(khoa):   # khoá R2 → đường tương đối dưới kho/ethopex/ cho --files-from; giọng CTA mp3 KHÔNG bao giờ đi (len-creative đọc thẳng R2)
    f = os.path.basename(khoa)
    if not khoa.startswith(GOC) or ".." in khoa or (khoa.startswith(GOC + "thanh-pham/") and (f.endswith(".mp3") or f.startswith("cta-"))): return None
    return khoa[len(GOC):]

def chuyen(nhoms):
    """CHÉP các nhóm an toàn từ R2 sang Drive cùng đường dẫn, rồi ĐỐI kích thước từng tệp hai đầu. Không xoá gì ở R2 (gỡ R2 là bước riêng, cần duyệt)."""
    if not nhoms or any(n not in NHOM or not NHOM[n][0] for n in nhoms): raise SystemExit("chỉ nhận nhóm chuyển được: " + " ".join(n for n in NHOM if NHOM[n][0]))
    tep, ref, tv, nong, tu_choi = nap()
    nhom = phan_loai(tep, ref, tv, nong, tu_choi, time.time())
    ds = sorted({d for k, n in nhom.items() if n in nhoms for d in [_dong_chuyen(k)] if d})
    if not ds: print("không có tệp nào"); return True
    ff = f"/tmp/kho-r2-chuyen-{os.getpid()}.txt"
    with open(ff, "w") as o: o.write("\n".join(ds) + "\n")
    print(f"chép {len(ds)} tệp {sum(tep[GOC + d][0] for d in ds)/1e9:.1f} GB · R2 {GOC} → {DRIVE_DICH}", flush=True)
    e = dict(os.environ, RCLONE_CONFIG_KHOR2_TYPE="s3", RCLONE_CONFIG_KHOR2_PROVIDER="Cloudflare", RCLONE_CONFIG_KHOR2_NO_CHECK_BUCKET="true",
             RCLONE_CONFIG_KHOR2_ACCESS_KEY_ID=os.environ["R2_ACCESS_KEY_ID"], RCLONE_CONFIG_KHOR2_SECRET_ACCESS_KEY=os.environ["R2_SECRET_ACCESS_KEY"],
             RCLONE_CONFIG_KHOR2_ENDPOINT=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com")
    nguon = f"khor2:{os.environ['R2_BUCKET']}/{GOC}"
    # Drive không có client_id riêng = rclone dùng khoá OAuth CHUNG của rclone (dự án 202264815644), hạn mức lệnh/phút chia cả thế giới:
    # 21/11/2026 giảm còn 1 lệnh/giây vẫn 403 "Quota exceeded … Requests per minute", 7.053 tệp chỉ đi ~20 tệp/phút → kêu to ngay đầu lệnh
    try: cau_hinh = json.loads(subprocess.run(["rclone", "config", "dump"], capture_output=True, text=True, timeout=30).stdout or "{}").get(DRIVE_DICH.split(":")[0], {})
    except Exception: cau_hinh = {}
    if not cau_hinh.get("client_id"):
        print(f"CẢNH BÁO: {DRIVE_DICH.split(':')[0]} chưa có client_id riêng — đang dùng khoá chung của rclone, Drive sẽ từ chối 403 vượt hạn mức và chép rất chậm (~20 tệp/phút). Cần tạo khoá OAuth riêng rồi cấp lại quyền.", flush=True)
    # copy bỏ qua tệp Drive đã có cùng kích thước (chạy lại an toàn); Drive giới hạn ~3 tệp mới/giây nên 8 luồng là đủ
    # --fast-list: không có cờ này rclone hỏi Drive TỪNG thư mục / tệp — 1.893 tệp đứng 8 phút chưa chép tệp nào; có cờ thì đối cả lô 1 phút (đo 21/11/2026)
    r = subprocess.run(["rclone", "copy", nguon, DRIVE_DICH, "--files-from", ff, "--size-only", "--fast-list", "--transfers", "8", "--checkers", "16",
                        "--drive-chunk-size", "64M", "--retries", "5", "--stats-one-line", "--stats", "60s", "--stats-log-level", "NOTICE", "--log-level", "NOTICE"], env=e, text=True, timeout=6 * 3600)
    k = subprocess.run(["rclone", "check", nguon, DRIVE_DICH, "--files-from", ff, "--size-only", "--one-way", "--fast-list", "--checkers", "16", "--log-level", "ERROR"], env=e, capture_output=True, text=True, timeout=3600)
    thieu = [l for l in k.stderr.splitlines() if "ERROR" in l and "differences found" not in l]
    for l in thieu[:20]: print("THIẾU/LỆCH", l)
    print(f"đối kích thước R2 ↔ Drive: {len(ds) - len(thieu)}/{len(ds)} khớp · rclone copy mã {r.returncode} · check mã {k.returncode} · danh sách {ff}")
    return r.returncode == 0 and k.returncode == 0

def _psql(cau):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=cau, capture_output=True, text=True, timeout=300)
    if r.returncode: raise SystemExit("psql: " + r.stderr[-300:])
    return [l.split("\t") for l in r.stdout.splitlines() if l]

def _khoa(url):
    m = re.search(r"/(kho/ethopex/[^\s\"']+)", url or ""); return m.group(1) if m else None

def nap():
    for k in ("DATABASE_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"):
        if not os.environ.get(k): raise SystemExit(f"thiếu {k} — chạy sau: set -a; . ./.env.production; set +a")
    e = dict(os.environ, RCLONE_LOG_LEVEL="ERROR", RCLONE_CONFIG_KHOR2_TYPE="s3", RCLONE_CONFIG_KHOR2_PROVIDER="Cloudflare",
             RCLONE_CONFIG_KHOR2_NO_CHECK_BUCKET="true", RCLONE_CONFIG_KHOR2_ACCESS_KEY_ID=os.environ["R2_ACCESS_KEY_ID"],
             RCLONE_CONFIG_KHOR2_SECRET_ACCESS_KEY=os.environ["R2_SECRET_ACCESS_KEY"],
             RCLONE_CONFIG_KHOR2_ENDPOINT=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com")
    # --use-server-modtime: không có cờ này rclone HEAD TỪNG tệp để đọc mtime — 20 nghìn tệp chạy quá 10 phút (đo 21/11/2026)
    r = subprocess.run(["rclone", "lsjson", "-R", "--files-only", "--no-mimetype", "--fast-list", "--use-server-modtime",f"khor2:{os.environ['R2_BUCKET']}/{GOC}"], env=e, capture_output=True, text=True, timeout=1800)
    if r.returncode: raise SystemExit("rclone lsjson lỗi: " + r.stderr[-300:])
    tep = {}
    for x in json.loads(r.stdout):
        t = x.get("ModTime", "")[:19]
        tep[GOC + x["Path"]] = (x["Size"], time.mktime(time.strptime(t, "%Y-%m-%dT%H:%M:%S")) if t else 0)
    sys.path.insert(0, os.path.dirname(os.path.abspath(globals().get("__file__", "./x"))))
    import ethopex_api as E
    ref, tao = defaultdict(set), {}
    for cr in E.doc_het("/api/v1/creatives?page_size=1000").get("data") or []:
        for k in _ref_tu_cr(cr): ref[k].add(int(cr["id"]))
        tao[int(cr["id"])] = (cr.get("created_at") or "")[:10]
    tu_choi = set()
    for cid, v, a, tc in _psql("select creative_id, coalesce(video,''), coalesce(anh,''), coalesce(tu_choi,'') from etp.creative"):
        for u in (v, a):
            k = _khoa(u)
            if k: ref[k].add(int(cid))
        if tc: tu_choi.add(int(cid))
    moc = time.strftime("%Y-%m-%d", time.gmtime(time.time() - NONG_NGAY * 86400))
    nong = {c for c, d in tao.items() if d >= moc}
    nong |= {int(c) for (c,) in _psql(f"select distinct creative_id from (select creative_id, tao from etp.camp union all select creative_id, tao from etp.camp_ngoai) x where creative_id is not null and tao >= now() - interval '{NONG_NGAY} days'")}
    tv = {}
    for v, a, st in _psql("select coalesce(video,''), coalesce(anh,''), coalesce(trang_thai,'') from etp.thu_vien"):
        for u in (v, a):
            k = _khoa(u)
            if k: tv[k] = st
    return tep, ref, tv, nong, tu_choi

def do():
    tep, ref, tv, nong, tu_choi = nap()
    nhom = phan_loai(tep, ref, tv, nong, tu_choi, time.time())
    tong = defaultdict(lambda: [0, 0])
    for k, n in nhom.items(): tong[n][0] += 1; tong[n][1] += tep[k][0]
    print(f"{'nhóm':<11} {'tệp':>7} {'GB':>7}  chuyển?  ý nghĩa")
    an = [0, 0]
    for n, (ok, y) in NHOM.items():
        c, b = tong.get(n, [0, 0])
        if not c: continue
        if ok: an[0] += c; an[1] += b
        print(f"{n:<11} {c:>7} {b/1e9:>7.1f}  {'ĐƯỢC' if ok else 'giữ':<7}  {y}")
    print(f"tổng R2 {sum(v[0] for v in tep.values())/1e9:.1f} GB · chuyển được {an[0]} tệp {an[1]/1e9:.1f} GB")
    return nhom

def tu_kiem():
    T = time.time(); cu, moi = T - 5 * 86400, T - 3600; G = GOC
    tep = {G+"thu-vien/a.mp4": (1, cu), G+"thu-vien/b.mp4": (1, cu), G+"thu-vien/c.mp4": (1, cu), G+"thu-vien/d.mp4": (1, cu),
           G+"thu-vien/e.mp4": (1, moi), G+"thanh-pham/2026-10/cta-en-1.mp3": (1, cu), G+"thanh-pham/2026-11/x.mp4": (1, cu),
           G+"thanh-pham/2026-11/x.jpg": (1, cu), G+"thanh-pham/2026-11/tc-x.jpg": (1, cu), G+"thanh-pham/2026-11/y.mp4": (1, cu),
           G+"thanh-pham/2026-11/z.mp4": (1, cu), G+"thanh-pham/2026-11/w.mp4": (1, cu), G+"thanh-pham/2026-11/v.mp4": (1, moi), G+"khac/q": (1, cu)}
    ref = {G+"thanh-pham/2026-11/x.mp4": {1}, G+"thanh-pham/2026-11/y.mp4": {2}, G+"thanh-pham/2026-11/z.mp4": {3, 4}}
    tv = {G+"thu-vien/a.mp4": "loai", G+"thu-vien/b.mp4": "da_len", G+"thu-vien/c.mp4": "san_sang"}
    ra = phan_loai(tep, ref, tv, nong={1}, tu_choi={2, 3}, bay_gio=T)
    mong = {"thu-vien/a.mp4": "tv_bo", "thu-vien/b.mp4": "tv_da_len", "thu-vien/c.mp4": "giu_tv_cho", "thu-vien/d.mp4": "tv_mo_coi",
            "thu-vien/e.mp4": "giu_moi", "thanh-pham/2026-10/cta-en-1.mp3": "giu_giong", "thanh-pham/2026-11/x.mp4": "giu_nong",
            "thanh-pham/2026-11/x.jpg": "giu_nong", "thanh-pham/2026-11/tc-x.jpg": "giu_nong", "thanh-pham/2026-11/y.mp4": "tp_tu_choi",
            "thanh-pham/2026-11/z.mp4": "tp_nghi", "thanh-pham/2026-11/w.mp4": "tp_mo_coi", "thanh-pham/2026-11/v.mp4": "giu_moi", "khac/q": "khac"}
    sai = [(k, ra[G+k], v) for k, v in mong.items() if ra[G+k] != v]
    r = _ref_tu_cr({"video_url": json.dumps(["https://img.on.tc/kho/ethopex/thanh-pham/2026-11/x.mp4"]), "thumbnail_url": "https://img.on.tc/kho/ethopex/thanh-pham/2026-11/x.jpg"})
    if r != {G+"thanh-pham/2026-11/x.mp4", G+"thanh-pham/2026-11/x.jpg"}: sai.append(("_ref_tu_cr", sorted(r), "2 khoá"))
    if not all(NHOM[n][0] is False for n in NHOM if n.startswith("giu_")): sai.append(("NHOM", "giu_* phải là giữ", ""))
    d = [_dong_chuyen(G+"thanh-pham/2026-10/cta-en-1.mp3"), _dong_chuyen(G+"thanh-pham/2026-11/cta-x.mp4"), _dong_chuyen(G+"thu-vien/a.mp4"), _dong_chuyen("khac/a.mp4")]
    if d != [None, None, "thu-vien/a.mp4", None]: sai.append(("_dong_chuyen", d, "cta/khác không đi, giữ đường tương đối"))
    c = chon_ds(ra, ["tv_bo", "tp_tu_choi", "tv_mo_coi"])
    if c != sorted([G+"thu-vien/a.mp4", G+"thanh-pham/2026-11/y.mp4", G+"thu-vien/d.mp4"]): sai.append(("chon_ds", c, "đủ 3 nhóm, một danh sách đã xếp"))
    x = chon_xoa(tep, {**ref, G+"thanh-pham/2026-11/u.mp4": {5, 1}}, ra, {G+"thu-vien/b.mp4": 4}, chet={2, 3, 4, 5})   # z {3,4} chết hết · y {2} chết · u {5,1} còn 1 sống · b thư viện của 4 chết
    if x != sorted([G+"thanh-pham/2026-11/y.mp4", G+"thanh-pham/2026-11/z.mp4", G+"thanh-pham/2026-11/w.mp4", G+"thu-vien/a.mp4", G+"thu-vien/b.mp4", G+"thu-vien/d.mp4"]):
        sai.append(("chon_xoa", x, "creative chết hết + nhóm chết + thư viện của creative chết; giữ cta / creative còn sống / tệp mới"))
    for s in sai: print("SAI", *s)
    print(f"kho-r2 tự kiểm: {len(mong) + 5 - len(sai)}/{len(mong) + 5} đạt"); return not sai

MOC_TAT = "2026-11-19 17:00:00+00"   # 00:00 20/11/2026 giờ VN — camp tạo trước mốc này + đã tắt thì creative của nó không còn giữ tệp (anh 26/11/2026)
NHOM_CHET = ("tv_bo", "tv_mo_coi", "tp_mo_coi", "tp_tu_choi")

def chet_ids():   # creative có camp, MỌI camp (etp.camp ∪ etp.camp_ngoai) PAUSED và tạo trước MOC_TAT; camp thiếu ngày tạo → coi là còn sống
    return {int(c) for (c,) in _psql(f"""select creative_id from (select creative_id, trang_thai, tao from etp.camp union all select creative_id, trang_thai, tao from etp.camp_ngoai) x
        where creative_id is not null group by 1 having bool_and(trang_thai = 'PAUSED') and bool_and(tao is not null and tao < '{MOC_TAT}')""")}

def chon_xoa(tep, ref, nhom, tv_cr, chet):
    """khoá R2 xoá được: mọi creative trỏ tới đều chết · nhóm chết · thư viện đã lên của creative chết. Giọng CTA không bao giờ."""
    ra = []
    for k in tep:
        f = os.path.basename(k)
        if not k.startswith(GOC) or f.endswith(".mp3") or f.startswith("cta-"): continue
        cr = ref.get(k) or ref.get(_goc_mp4(k)) or set()
        if (cr and cr <= chet) or (not cr and nhom.get(k) in NHOM_CHET) or (nhom.get(k) == "tv_da_len" and tv_cr.get(k) in chet): ra.append(k)
    return sorted(ra)

def _rclone_env():
    return dict(os.environ, RCLONE_CONFIG_KHOR2_TYPE="s3", RCLONE_CONFIG_KHOR2_PROVIDER="Cloudflare", RCLONE_CONFIG_KHOR2_NO_CHECK_BUCKET="true",
                RCLONE_CONFIG_KHOR2_ACCESS_KEY_ID=os.environ["R2_ACCESS_KEY_ID"], RCLONE_CONFIG_KHOR2_SECRET_ACCESS_KEY=os.environ["R2_SECRET_ACCESS_KEY"],
                RCLONE_CONFIG_KHOR2_ENDPOINT=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com")

def xoa(that):
    tep, ref, tv, nong, tu_choi = nap()
    nhom, chet = phan_loai(tep, ref, tv, nong, tu_choi, time.time()), chet_ids()
    tv_cr = {}
    for v, a, c in _psql("select coalesce(video,''), coalesce(anh,''), coalesce(creative_id::text,'') from etp.thu_vien"):
        for u in (v, a):
            k = _khoa(u)
            if k and c: tv_cr[k] = int(c)
    ds = chon_xoa(tep, ref, nhom, tv_cr, chet)
    mat = sorted({c for k in ds for c in (ref.get(k) or ref.get(_goc_mp4(k)) or set())} | {tv_cr[k] for k in ds if k in tv_cr})
    print(f"creative chết (mọi camp tắt + trước 20/11): {len(chet)} · xoá {len(ds)} tệp {sum(tep[k][0] for k in ds)/1e9:.1f} GB / R2 {sum(v[0] for v in tep.values())/1e9:.1f} GB · creative mất tệp {len(mat)}", flush=True)
    if not that or not ds: return True
    if not set(mat) <= chet: raise SystemExit(f"DỪNG: {len(set(mat) - chet)} creative mất tệp không nằm trong tập chết")
    for i in range(0, len(mat), 2000):   # ghi sổ TRƯỚC khi xoá: cửa API chặn ngay từ lúc này
        _psql("insert into etp.kho_xoa (creative_id, ly) values " + ",".join(f"({c}, 'camp tắt trước 20/11 — xoá tệp R2')" for c in mat[i:i + 2000]) + " on conflict do nothing")
    ff = f"/tmp/kho-r2-xoa-{os.getpid()}.txt"
    with open(ff, "w") as o: o.write("\n".join(k[len(GOC):] for k in ds) + "\n")
    with open(ff + ".cr", "w") as o: o.write("\n".join(map(str, mat)) + "\n")
    e = _rclone_env()
    r = subprocess.run(["rclone", "delete", f"khor2:{os.environ['R2_BUCKET']}/{GOC}", "--files-from", ff, "--fast-list", "--checkers", "32", "--log-level", "ERROR"], env=e, text=True, timeout=6 * 3600)
    d = subprocess.run(["rclone", "delete", DRIVE_DICH, "--files-from", ff, "--fast-list", "--checkers", "8", "--log-level", "ERROR"], env=e, text=True, timeout=6 * 3600)   # bản Drive cùng khoá → thùng rác Drive
    print(f"R2 xoá mã {r.returncode} · Drive (thùng rác) mã {d.returncode} · danh sách tệp {ff} · creative {ff}.cr")
    return r.returncode == 0

def chon_ds(ra, nhoms):   # khoá thuộc bất kỳ nhóm nào trong nhoms, xếp tăng
    return sorted(k for k, n in ra.items() if n in set(nhoms))

if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--tu-kiem"]: sys.exit(0 if tu_kiem() else 1)
    if a[:1] == ["do"]: do(); sys.exit(0)
    if a[:1] == ["chuyen"]: sys.exit(0 if chuyen(a[1:]) else 1)
    if a[:1] == ["xoa"]: sys.exit(0 if xoa("--that" in a) else 1)
    if a[:1] == ["ds"] and len(a) >= 2 and all(n in NHOM for n in a[1:]):   # nhiều nhóm một lần nạp (máy chuyển lạnh cty gọi ds <5 nhóm an toàn>)
        tep, ref, tv, nong, tu_choi = nap()
        for k in chon_ds(phan_loai(tep, ref, tv, nong, tu_choi, time.time()), a[1:]): print(k)
        sys.exit(0)
    print(__doc__ or "kho-r2.py do | ds <nhom> | --tu-kiem   nhóm: " + " ".join(NHOM)); sys.exit(2)
