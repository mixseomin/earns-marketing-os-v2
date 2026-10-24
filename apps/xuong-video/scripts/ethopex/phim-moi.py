#!/usr/bin/env python3
"""QUY TRÌNH PHIM MỚI CHUẨN — bộ tài khoản chỉ phim mới (bộ 2 ETP_441 + Argo Love Tyrell; anh 23/10/2026 "chuẩn hoá luôn quy trình cho về sau").
Theo TRẠNG THÁI từng phim, không theo dải hạng: phim bị loại thì lượt sau tự lấy phim kế; danh sách mỏng thì tự bổ sung. Chỉ tiêu: 30 phim lên/ngày/bộ (2 góc = 60 camp).
Trạng thái: studio xv_khoa_ngoai['ethopex_phim_moi_tt'] {id: {tt, luc, ghi, lan}} — danh sách = ['ethopex_200_phim'] (chon-phim-moi.py, xếp theo cầu app gốc)
  (chưa có) → poster_ok | poster_loai          soát poster (Claude xem tờ poster: cởi trần ôm hôn, máu, súng, gợi dục → loại)
  poster_ok → da_cat | cat_loi | cat_loai       cắt 2 góc (cat-cuoi-lo; cat_loi = lỗi kỹ thuật, cắt lại tối đa 2 lần; cat_loai = không còn khung sạch / thoại cấm)
  da_cat    → da_len | soat_loai | cong_loai    soát 18+ tờ khung (Claude → kiem-phim-18 --soat) → len-creative (cổng chữ) → nhan-ban --bo 2 --lich today
Hằng ngày trên iMac (mỗi bước in việc kế tiếp):
  1. phim-moi.py tinh                 bảng đếm + dự trữ đủ mấy ngày + hôm nay đã lên bao nhiêu
  2. phim-moi.py them [so]            dự trữ < 2 ngày → chon-phim-moi.py --them (nối thêm, giữ thứ tự cũ)
  3. phim-moi.py poster [n=60]        tờ poster (30 phim/tờ, có mã) → Claude xem → poster-ok / poster-loai <id…>
  4. phim-moi.py cat [dat=30]         số phim cắt = (chỉ tiêu − đã lên hôm nay) ÷ tỷ lệ đạt thực đo (mặc định 0,6) → tờ soát 18+
  5. Claude xem tờ soát → ssh box3: kiem-phim-18.py --soat <id> ok|cam "<lý do>"   (máu / súng / gợi dục = cam)
  6. phim-moi.py len <lô>             lên mọi đoạn của phim soát ok → ghi trạng thái → sửa CTA cho camp thắng (sua-cta.py)
  Thiếu chỉ tiêu sau bước 6 → quay lại 4 (máy tự lấy phim kế, gồm phim cat_loi chưa quá 2 lần)."""
import datetime as dt, importlib.util, json, math, os, subprocess, sys, urllib.request
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D); import loi_ky_thuat as LK
D = D; B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
KTT, KDS, CHI_TIEU, NGAY_DU = "ethopex_phim_moi_tt", "ethopex_200_phim", 30, 2
# LÀM TRƯỚC CHO NGÀY MAI (anh 23/10/2026: "nếu slot hôm nay đủ rồi thì tận dụng sinh sẵn video và đặt vào lịch luôn"): chỉ tiêu hôm nay đủ → cắt/lên cho ngày
# mai, camp lịch tomorrow (Ethopex chạy từ 07:00 VN). Ngày đích tự tính: đủ hôm nay thì mai, đủ mai thì ngày kia… — máy không bao giờ ngồi không.
NGAY_LEN = None
def ngay_dich():
    return NGAY_LEN or vn().strftime("%d/%m/%Y")
vn = lambda: dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) + dt.timedelta(hours=7)

def sql(cau, spy=False):
    nen = ". /root/.secrets/spy.env" if spy else ENV
    return subprocess.run(["ssh", B, f'{nen}; psql "$DATABASE_URL" -tA -F"\t" -f -'], input=cau, capture_output=True, text=True).stdout.strip()
khoa = lambda ten, rong="{}": json.loads(sql(f"select coalesce(gia_tri, '{rong}'::jsonb)::text from xv_khoa_ngoai where ten='{ten}'") or rong)

def ghi(cap):
    """cap {id: (tt, ghi)} → gộp vào sổ trạng thái (một câu jsonb ||, không ghi đè phim khác)"""
    if not cap: return
    cu = khoa(KTT); luc = vn().strftime("%H:%M %d/%m/%Y")
    moi = {str(i): {"tt": tt, "luc": luc, "ghi": (g or "")[:200], **({"ngay": ngay_dich()} if tt == "da_len" else {}), "lan": (cu.get(str(i), {}).get("lan", 0) + 1) if tt == "cat_loi" else cu.get(str(i), {}).get("lan", 0)} for i, (tt, g) in cap.items()}
    v = json.dumps(moi, ensure_ascii=False).replace("'", "''")
    sql(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('{KTT}', '{v}'::jsonb) on conflict (ten) do update set gia_tri = coalesce(xv_khoa_ngoai.gia_tri, '{{}}'::jsonb) || excluded.gia_tri")
    # kho etp (bước 5): cùng trạng thái vào etp.phim_moi — trang etp.on.tc / thợ đọc từ đây
    j = json.dumps([{"content_id": int(i), **v} for i, v in moi.items()], ensure_ascii=False).replace("$J$", "")
    sql(f"insert into etp.phim_moi (content_id, tt, ghi, lan, ngay) select content_id, tt, ghi, lan, ngay from jsonb_to_recordset($J${j}$J$::jsonb) as x(content_id int, tt text, ghi text, lan int, ngay text) "
        f"on conflict (content_id) do update set tt = excluded.tt, ghi = excluded.ghi, lan = excluded.lan, ngay = coalesce(excluded.ngay, etp.phim_moi.ngay), cap_nhat = now()")

def dpm():
    s = importlib.util.spec_from_file_location("dpm", os.path.join(D, "dot-phim-moi.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

def so_lieu():
    ds, tt = khoa(KDS, "[]"), khoa(KTT); hom = vn().strftime("%d/%m/%Y")
    dem = {}; [dem.__setitem__(v["tt"], dem.get(v["tt"], 0) + 1) for v in tt.values()]
    xong = sum(dem.get(k, 0) for k in ("da_len", "soat_loai", "cong_loai", "cat_loai"))
    ty_le = dem.get("da_len", 0) / xong if xong >= 10 else 0.6
    chua = [p for p in ds if str(p["id"]) not in tt]
    san = [p for p in ds if tt.get(str(p["id"]), {}).get("tt") == "poster_ok" or (tt.get(str(p["id"]), {}).get("tt") == "cat_loi" and tt[str(p["id"])].get("lan", 0) < 2)]
    hom_nay = sum(1 for v in tt.values() if v["tt"] == "da_len" and v.get("ngay", v["luc"][-10:]) == ngay_dich())   # đã lên cho NGÀY ĐÍCH (hôm nay, hoặc mai khi hôm nay đủ)
    return ds, tt, dem, ty_le, chua, san, hom_nay

def tinh():
    lich, _ = chon_ngay()
    ds, tt, dem, ty_le, chua, san, hom_nay = so_lieu()
    con_ngay = (len(chua) * 0.7 + len(san)) * ty_le / CHI_TIEU   # poster loại ~30% (đo 23/10)
    print(f"danh sách {len(ds)} phim · trạng thái: " + " · ".join(f"{k} {v}" for k, v in sorted(dem.items())))
    print(f"tỷ lệ đạt (lên được / đã xử xong) {ty_le:.0%} · ngày {NGAY_LEN} ({lich}) đã lên {hom_nay}/{CHI_TIEU} phim · sẵn để cắt {len(san)} · chưa soát poster {len(chua)} · dự trữ ≈ {con_ngay:.1f} ngày")
    if con_ngay < NGAY_DU: print(f"→ dự trữ mỏng: phim-moi.py them {len(ds) + 200}")
    if hom_nay < CHI_TIEU: print("→ " + ("phim-moi.py poster" if len(san) * ty_le < CHI_TIEU - hom_nay else "phim-moi.py cat"))

def them(so):
    r = subprocess.run(["ssh", B, f"{ENV}; cd apps/xuong-video/scripts/ethopex && python3 chon-phim-moi.py {so} --them"], capture_output=True, text=True, timeout=3600)
    print((r.stdout.strip().splitlines() or [r.stderr[-300:]])[0])
    print(sql(f"select jsonb_array_length(gia_tri) from xv_khoa_ngoai where ten='{KDS}'"), "phim trong danh sách")

def poster(n=60):
    from PIL import Image, ImageDraw
    s_ = importlib.util.spec_from_file_location("tlm", os.path.join(D, "the-loai.py")); TLM = importlib.util.module_from_spec(s_); s_.loader.exec_module(TLM)
    ds, tt, *_ = so_lieu(); chon = [p for p in ds if str(p["id"]) not in tt][:n]
    if not chon: return print("không còn phim chưa soát poster → phim-moi.py them")
    ra = os.path.join(C, "ra", "poster-" + vn().strftime("%d%m%H%M")); os.makedirs(ra, exist_ok=True)
    import html as H, re
    from concurrent.futures import ThreadPoolExecutor
    UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"}
    def lay(p):   # cột anh của kho spy là đường dẫn tương đối → poster = og:image của trang phim (cùng cách tai-tap.py)
        f = os.path.join(C, "nguon", str(p["id"]), "poster.jpg")
        try:
            if not os.path.exists(f):
                h = urllib.request.urlopen(urllib.request.Request(p["url"], headers=UA), timeout=30).read().decode("utf-8", "ignore")
                m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"|<meta[^>]+content="([^"]+)"[^>]+property="og:image"', h)
                b = urllib.request.urlopen(urllib.request.Request(H.unescape(m.group(1) or m.group(2)).split("@")[0], headers={**UA, "Referer": p["url"]}), timeout=30).read()
                os.makedirs(os.path.dirname(f), exist_ok=True); open(f, "wb").write(b)
            return p, Image.open(f).convert("RGB")
        except Exception: return p, None
    with ThreadPoolExecutor(8) as ex: o = list(ex.map(lay, chon))
    W, H, K = 200, 300, 10
    for k in range(0, len(o), 30):
        t = o[k:k + 30]; to = Image.new("RGB", (W * K, (H + 34) * math.ceil(len(t) / K)), "black"); d = ImageDraw.Draw(to)
        for i, (p, im) in enumerate(t):
            x, y = (i % K) * W, (i // K) * (H + 34)
            if im: im.thumbnail((W, H)); to.paste(im, (x, y))
            d.text((x + 4, y + H + 2), f"{p['id']} · {TLM.doan(p['ten'])}", fill="yellow"); d.text((x + 4, y + H + 17), p["ten"][:30], fill="white")   # thể loại máy đoán — Claude sửa: the-loai.py --gan
        f = os.path.join(ra, f"to-{k // 30 + 1}.jpg"); to.save(f, quality=85); print("TỜ POSTER (iMac):", f)
    print("→ Claude xem (kèm thể loại máy đoán dưới mã, sai thì ssh box3: the-loai.py --gan <id>=<thể loại>): phim-moi.py poster-ok <id…> · phim-moi.py poster-loai <id…> --ghi '<lý do>'   (mã:", " ".join(str(p["id"]) for p, _ in o) + ")")

def don_mac():
    """PHIM XONG LÀ XOÁ TRÊN iMAC (23/10/2026: ổ iMac đầy còn 183 MB → ffmpeg chết giữa lô; anh đã duyệt luật này cho box3): xoá tập tải về / tệp ghép
    của mọi phim KHÔNG còn chờ (poster_ok · da_cat · cat_loi giữ lại) + đoạn cắt của các lô đã lên. Giữ poster, tap.json, bản chữ. Tải lại được từ site."""
    import glob, shutil
    tt = khoa(KTT); cho = {k for k, v in tt.items() if v["tt"] in ("poster_ok", "da_cat", "cat_loi")}; N = os.path.join(C, "nguon"); xoa = 0
    for d in os.listdir(N):
        p = os.path.join(N, d)
        if os.path.isdir(p) and d not in cho:
            for f in os.listdir(p):
                if f.endswith(".mp4"): xoa += os.path.getsize(os.path.join(p, f)); os.remove(os.path.join(p, f))
    dang = {v.get("ghi") for v in tt.values() if v["tt"] == "da_cat"}   # lô còn đoạn chờ lên
    for f in glob.glob(os.path.join(C, "ra", "*", "c-*.mp4")) + glob.glob(os.path.join(C, "ra", "*", "p-*", "c-*.mp4")):   # lô cũ + lô qua hàng đợi (p-<phim>/)
        lo_ = os.path.basename(os.path.dirname(f)); lo_ = os.path.basename(os.path.dirname(os.path.dirname(f))) if lo_.startswith("p-") else lo_
        if lo_ not in dang: xoa += os.path.getsize(f); os.remove(f)
    trong = shutil.disk_usage(os.path.expanduser("~")).free / 1e9
    print(f"dọn iMac: {xoa / 1e9:.1f} GB · ổ còn trống {trong:.0f} GB", flush=True)
    return trong

def cat_hang(phim, ten, so_tho=2):
    """CẮT QUA HÀNG ĐỢI etp.viec (bước 5, 24/10/2026): mỗi phim một việc → thợ apps/etp/tho.py trên iMac (so_tho luồng) — máy khác muốn góp sức chỉ cần
    chạy `tho.py --lo <lô>` cùng lúc. Hết việc thì gộp kết quả thành <ra>/lo.json + tờ soát như đường cũ (dot-phim-moi.cat_ds)."""
    ra = os.path.join(C, "ra", ten); os.makedirs(ra, exist_ok=True)
    j = json.dumps([{"content_id": int(p["id"]), "du_lieu": {"locale": p.get("locale"), "nguon": p.get("nguon"), "ten": p.get("ten"), "url": p.get("url"), "so_ban": 2}} for p in phim], ensure_ascii=False).replace("$J$", "")
    sql(f"insert into etp.viec (loai, lo, content_id, du_lieu) select 'cat', '{ten}', content_id, du_lieu from jsonb_to_recordset($J${j}$J$::jsonb) as x(content_id int, du_lieu jsonb) on conflict do nothing")
    print(f"đã xếp {len(phim)} việc cắt vào hàng đợi etp.viec (lô {ten}) — thợ iMac {so_tho} luồng; máy khác góp sức: python3 apps/etp/tho.py --lo {ten}", flush=True)
    subprocess.run(["python3", os.path.join(D, "..", "..", "..", "etp", "tho.py"), "--lo", ten, "--so-tho", str(so_tho)])
    kq = json.loads(sql(f"select coalesce(json_agg(x), '[]') from (select jsonb_array_elements(coalesce(ket_qua, '[]'::jsonb)) x from etp.viec where lo = '{ten}') t") or "[]")
    for v in json.loads(sql(f"select coalesce(json_agg(json_build_object('content_id', content_id, 'loi', loi)), '[]') from etp.viec where lo = '{ten}' and (ket_qua is null or ket_qua = '[]'::jsonb)") or "[]"):
        kq.append({"content_id": v["content_id"], "loi": v["loi"] or "chưa làm xong"})
    json.dump(kq, open(os.path.join(ra, "lo.json"), "w"), ensure_ascii=False, indent=1)
    dpm().to_soat(ra)
    return ra

def cat(dat=CHI_TIEU, san=0):
    """san > 0: CẮT SẴN san phim cho ngày kế tiếp không theo chỉ tiêu (Ethopex chỉ nhận lịch hôm nay / ngày mai — lô ngày kia cắt trước, lên sau 07:00)"""
    if don_mac() < 15: return print("ổ iMac còn dưới 15 GB sau khi dọn — không cắt (cắt một phim cần ~1–2 GB tạm); báo anh")
    lich, _ = chon_ngay(); print(f"cắt cho ngày {NGAY_LEN} (lịch {lich})", flush=True)
    ds, tt, dem, ty_le, chua, san_, hom_nay = so_lieu()
    can = max(0, dat - hom_nay); so = min(len(san_), math.ceil(can / max(ty_le, 0.2))) if not san else min(len(san_), san)
    if not so: return print("không có phim sẵn để cắt (poster_ok) → phim-moi.py poster" if (can or san) else "đủ chỉ tiêu ngày đích — muốn cắt sẵn cho ngày kia: phim-moi.py cat --san 45")
    phim = san_[:so]; ten = "pm-" + vn().strftime("%d%m%H%M"); print(f"cắt {so} phim (cần {can} phim lên, tỷ lệ đạt {ty_le:.0%}) → lô {ten}", flush=True)
    ra = cat_hang(phim, ten)
    lo = json.load(open(os.path.join(ra, "lo.json"))); cap = {}
    for p in phim:
        x = [y for y in lo if str(y.get("content_id")) == str(p["id"])]
        if any(y.get("file") and not y.get("loi") for y in x): cap[p["id"]] = ("da_cat", ten)
        else:
            loi = " ".join(str(y.get("loi")) for y in x)[:200] or "không tải được tập"
            cap[p["id"]] = ("cat_loi" if LK.ky_thuat(loi) is not False else "cat_loai", loi)   # kỹ thuật → lượt sau tự cắt lại (tối đa 2 lần)
    ghi(cap); print(f"→ Claude xem tờ soát ở {ra} (soat-<id>.jpg) → kiem-phim-18 --soat … → phim-moi.py len {ten}")

def chon_ngay():
    """ngày đích = ngày gần nhất chưa đủ chỉ tiêu (hôm nay → mai). Ethopex chỉ nhận lịch today / tomorrow."""
    global NGAY_LEN
    tt = khoa(KTT); hom = vn().strftime("%d/%m/%Y"); mai = (vn() + dt.timedelta(days=1)).strftime("%d/%m/%Y")
    dem = lambda d: sum(1 for v in tt.values() if v["tt"] == "da_len" and v.get("ngay", v["luc"][-10:]) == d)
    NGAY_LEN = hom if dem(hom) < CHI_TIEU else mai
    return ("today" if NGAY_LEN == hom else "tomorrow"), dem(NGAY_LEN)

def len_(ten):
    lich, da = chon_ngay(); print(f"lên cho ngày {NGAY_LEN} (lịch {lich}, đã có {da}/{CHI_TIEU} phim)", flush=True)
    tt = khoa(KTT); kq = dpm().len_ds(ten, ten.replace("-", ""), lich, "quy trình phim mới " + ten)
    lo = json.load(open(os.path.join(C, "ra", ten, "lo.json"))); ids = {str(x["content_id"]) for x in lo if x.get("content_id")}
    cap = {}
    for i in ids:
        if tt.get(i, {}).get("tt") != "da_cat": continue
        r = [y for y in kq["kq"] if str(y["content_id"]) == i]
        if any(y["ok"] for y in r): cap[i] = ("da_len", " ".join(f"#{y['moi']}" for y in r if y["ok"]))
        elif r and all(LK.ky_thuat(y["loi"]) is False for y in r): cap[i] = ("cong_loai", r[0]["loi"])
        elif r: cap[i] = ("da_cat", "lên lỗi kỹ thuật (đã thử lại tại chỗ) — phim-moi.py len chạy lại: " + str(r[0]["loi"])[:120])   # giữ da_cat → lượt len sau tự lên lại
        elif i not in kq["soat_ok"]:
            s = khoa("ethopex_soat_18").get(i)
            if s is not None: cap[i] = ("soat_loai", s.get("ghi", "soát 18+"))
    ghi(cap); print("ghi trạng thái:", {k: v[0] for k, v in cap.items()})
    subprocess.run(["taskpolicy", "-b", "python3", os.path.join(D, "sua-cta.py")])
    don_mac(); tinh()

if __name__ == "__main__":
    a = sys.argv[1:] or ["tinh"]; g = a[a.index("--ghi") + 1] if "--ghi" in a else ""
    ids = [x for x in a[1:] if x.isdigit()]
    if a[0] == "tinh": tinh()
    elif a[0] == "them": them(int(ids[0]) if ids else len(khoa(KDS, "[]")) + 200)
    elif a[0] == "poster": poster(int(ids[0]) if ids else 60)
    elif a[0] == "poster-ok": ghi({i: ("poster_ok", g) for i in ids})
    elif a[0] == "poster-loai": ghi({i: ("poster_loai", g or "poster") for i in ids})
    elif a[0] == "cat": cat(san=int(a[a.index("--san") + 1])) if "--san" in a else cat(int(ids[0]) if ids else CHI_TIEU)
    elif a[0] == "len": len_(a[1])
    else: print(__doc__)
