#!/usr/bin/env python3
"""BỘ CHẤM CREATIVE THEO META + AFS (anh 25/10/2026: "mọi creative đều phải show chi tiết đã quét text, ảnh, nội dung, voice… chưa và có điểm chấm
so với yêu cầu của Meta. Ngoài ra có thêm bộ chấm riêng cho AFS về content ads, CTA…" · "mọi thứ phải sạch và bền nhất").
Mỗi creative quét BỐN LỚP, mỗi lớp ghi vào etp.cham.lop khi chạy được (thiếu khoá = chưa quét, trang hiện rõ):
  chu      chữ trên hình — mỗi giây một khung → Vision macOS (doc-chu.swift, 0đ) → luật thoại cấm (kiem-thoai) + luật CTA (cta_qc)
  giong    lời nói — mlx-whisper large-v3-turbo chạy trên iMac M4 (0đ) → cùng luật thoại cấm
  anh      tờ 30 khung (soat_doan.to_khung)
  noi_dung Claude (chuỗi rẻ ckey → ShopAIKey → Anthropic, gọi trên box3) xem tờ khung + chữ + lời → tóm tắt + điểm 0–10 từng tiêu chí;
           chấm HAI lượt độc lập, lấy điểm thấp hơn, lệch ≥ 4 điểm → cần người xem
Tiêu chí: MỘT nguồn etp.tieu_chi (migration 0322) — nhóm meta + afs. Điểm nhóm = điểm thấp nhất (một tiêu chí hỏng là hỏng).
Luật máy đọc chữ / lời kéo điểm xuống (không tự kết cấm): dính từ cấm → ngôn từ ≤ 6 (cần người xem); dính CTA dụ nhấp → CTA ≤ 4.
Kết luận: cấm khi Meta ≤ 5 · cần người xem khi Meta ≤ 7 hoặc AFS ≤ 7 · còn lại sạch. Ghi luôn vào sổ soát đoạn (ethopex_soat_doan) để cổng lên creative dùng chung.
Tiến độ từng creative ghi ngay vào xv_khoa_ngoai['ethopex_quet'] → etp.on.tc/?t=creative&v=soat hiện thời gian thực.
Chạy (iMac):  cham-creative.py chay [--lai] [--creative <id>…] [--luong 4]   → chấm creative đang chạy chưa có bản chấm (--lai: chấm lại hết)
Tiến trình iMac (launchd com.htuan.ethopex-cham, mỗi phút):  cham-creative.py hang   → chấm hàng chờ etp.cham_hang (nút trên trang + creative mới)
Box3 (máy gọi):  cham-creative.py box <tờ khung.jpg> <câu hỏi.txt>   → in JSON"""
import importlib.util, json, os, socket, subprocess, sys, tempfile, threading, urllib.request
D = os.path.dirname(os.path.abspath(__file__))
def nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
SD = nap("soat_doan", "soat_doan.py")
B, ENV, C = SD.B, SD.ENV, SD.C
KHO = os.path.join(C, "cham")   # video tải về + tờ khung (iMac, xoá được — chấm lại thì tải lại)
GIONG_PY = os.path.expanduser("~/.cache/ethopex/venv-giong/bin/python")   # venv Python 3.12 có mlx-whisper (python hệ thống 3.15 chưa có bánh mlx)
MO_HINH_GIONG = "mlx-community/whisper-large-v3-turbo"
CAM_META, XEM = 5, 7   # chấm thử 25/10/2026: Meta từ chối #55305 ở mức 5/10 → cấm ≤ 5, cần xem 6–7

def tieu_chi():
    r = SD.sql("select nhom, ma, ten, mo_ta from etp.tieu_chi order by nhom, thu_tu")
    return [dict(zip(("nhom", "ma", "ten", "mo_ta"), l.split("|", 3))) for l in r.splitlines() if l.count("|") >= 3]

def tai(cr, url):
    os.makedirs(KHO, exist_ok=True); f = os.path.join(KHO, f"{cr}.mp4")
    if not os.path.exists(f) or os.path.getsize(f) < 10_000:
        tmp = f + ".tai"; urllib.request.urlretrieve(url, tmp); os.replace(tmp, f)
    return f

def lop_chu(f, KT, CQ):
    """chữ trên hình mỗi giây (Vision) → (văn bản gọn, các dòng dính luật)"""
    with tempfile.TemporaryDirectory() as t:
        subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", "fps=1,scale=540:-2", f"{t}/k%04d.png"], check=True, timeout=300)
        anh = sorted(os.listdir(t))
        r = subprocess.run([KT.may_doc()] + [f"{t}/{a}" for a in anh], capture_output=True, text=True, check=True, timeout=600)
    dong, thay = [], set()
    for i, l in enumerate(r.stdout.splitlines()):
        c = (json.loads(l).get("chu") or "").strip()
        if c and c not in thay: thay.add(c); dong.append((i, c))
    loi = [f"giây {i}: «{c[:80]}» — {h}" for i, c in dong for h in [KT.soat(c)] if h]
    cta = [f"giây {i}: «{c[:80]}» — {h}" for i, c in dong for h in [CQ.sai_luat(c)] if h]
    return {"noi_dung": " / ".join(c for _, c in dong)[:4000], "so_khung": len(anh), "loi": loi, "cta": cta}

KHOA_GIONG = threading.Lock()   # một lượt whisper một lúc (GPU M4) — các lớp khác vẫn song song
def lop_giong(f, KT):
    with KHOA_GIONG:
        r = subprocess.run([GIONG_PY, "-c", "import json,sys,mlx_whisper; r=mlx_whisper.transcribe(sys.argv[1], path_or_hf_repo=sys.argv[2], condition_on_previous_text=False, compression_ratio_threshold=2.0, no_speech_threshold=0.5); "
                            "print(json.dumps({'text': r.get('text',''), 'lang': r.get('language')}, ensure_ascii=False))", f, MO_HINH_GIONG],
                           capture_output=True, text=True, timeout=900)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-200:])
    j = json.loads(r.stdout.strip().splitlines()[-1]); t = (j.get("text") or "").strip()
    # whisper hay lặp ảo trên nhạc / im lặng ("Let's go" ×15) → gộp câu lặp liền nhau, giữ một lần
    import re; cau = [c.strip() for c in re.split(r"(?<=[.!?¿¡])\s+", t) if c.strip()]; gon = []
    for c in cau:
        if not gon or c.lower() != gon[-1].lower(): gon.append(c)
    t = " ".join(gon)
    h = KT.soat(t)
    return {"noi_dung": t[:4000], "ngon_ngu": j.get("lang"), "loi": [f"«{h}»"] if h else []}

def to_net(f, cr):
    """BA TỜ KHUNG NÉT cho máy chấm (chấm thử 25/10/2026: tờ 6×5 khung 200px không thấy váy ren xuyên sáng #55305): cùng 30 mốc với tờ trên trang,
    chia 3 tờ 5×2, mỗi khung rộng 384px → khung 1–10, 11–20, 21–30"""
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip() or 90)
    ra = []
    for i in range(3):
        o = os.path.join(KHO, f"{cr}-net{i + 1}.jpg")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{i * d / 3:.3f}", "-t", f"{d / 3:.3f}", "-i", f, "-vf", f"fps=30/{d:.3f},scale=384:-2,tile=5x2", "-frames:v", "1", "-q:v", "3", o], check=True, timeout=300)
        ra.append(o)
    return ra

def cau_hoi(tc, chu, giong):
    ds = "\n".join(f'- "{x["nhom"]}.{x["ma"]}": {x["mo_ta"]}' for x in tc)
    return ("You review a Facebook/Instagram video ad for a short drama. The 3 images are contact sheets of 30 frames in order "
            "(sheet 1 = frames 1–10, sheet 2 = 11–20, sheet 3 = 21–30; each sheet 5 across × 2 down, left to right, top to bottom). Look closely at clothing, skin and body contact. "
            "The voice transcript comes from speech recognition and may contain repeated phrases by mistake — ignore repetition. "
            f"On-screen text read by OCR: {chu.get('noi_dung', '')[:2500] or '(none)'}\nSpoken voice transcript: {(giong or {}).get('noi_dung', '')[:2500] or '(none)'}\n"
            "Score EACH criterion from 0 to 10 where 10 = fully compliant / no risk, 7 = minor doubt, 4 or less = Meta or Google would very likely reject:\n"
            f"{ds}\nReply ONLY JSON: {{\"noi_dung\": \"<2 sentences in Vietnamese: what happens in the video>\", "
            "\"diem\": {\"<group.code>\": <0-10>, ...every criterion...}, \"ly_do\": {\"<group.code>\": \"<short reason in Vietnamese naming the frame / words, only for scores below 10>\"}, "
            "\"khung\": {\"<group.code>\": [<frame numbers 1-30 (left to right, top to bottom) that show the problem, only for scores below 10>]}}")

def claude(to, net, hoi, tc):
    """tờ khung (trang) + 3 tờ nét (máy chấm) + câu hỏi → box3 chạy goi_claude → {noi_dung, diem, ly_do, khung, duong, anh_url}"""
    ma = os.path.basename(to)[:-4]; hf = to[:-4] + ".hoi.txt"; open(hf, "w").write(hoi)
    subprocess.run(["ssh", B, "mkdir -p /root/etp-cham"], check=True, timeout=60)
    subprocess.run(["scp", "-q", to, hf, *net, f"{B}:/root/etp-cham/"], check=True, timeout=300)
    r = subprocess.run(["ssh", B, f"{ENV}; cd apps/xuong-video/scripts/ethopex && python3 cham-creative.py box /root/etp-cham/{ma}.jpg /root/etp-cham/{ma}.hoi.txt " + " ".join(f"/root/etp-cham/{os.path.basename(x)}" for x in net)],
                       capture_output=True, text=True, timeout=400)
    j = json.loads(r.stdout.strip().splitlines()[-1])
    if j.get("loi"): raise RuntimeError(j["loi"])
    return j

def box(jpg, hf, net=()):
    tc = tieu_chi(); can = {f"{x['nhom']}.{x['ma']}" for x in tc}
    def kiem(j):
        d = j.get("diem") or {}
        thieu = can - set(d)
        if thieu or not all(isinstance(d[k], (int, float)) and 0 <= d[k] <= 10 for k in can): raise ValueError(f"thiếu / sai điểm: {sorted(thieu)[:4]}")
    try:
        j, duong = SD.goi_claude(list(net) or jpg, open(hf).read(), 1500, kiem)
        # tờ khung lên kho img.on.tc → trang etp hiện đúng khung bị bắt khi rê chuột (anh 25/10/2026: "hover phải xem được đoạn nội dung đó để còn xác nhận sai")
        u = subprocess.run(["kho", "phat", jpg, "ethopex", "thanh-pham", os.path.basename(jpg)], capture_output=True, text=True, timeout=120).stdout.strip().splitlines()
        print(json.dumps({**j, "duong": duong, "anh_url": u[-1] if u and u[-1].startswith("http") else None}, ensure_ascii=False))
    except Exception as e: print(json.dumps({"loi": str(e)[:300]}, ensure_ascii=False))

def mot(cr, doan, url, tc, KT, CQ):
    lop, loi = {}, []
    f = tai(cr, url)
    try: lop["chu"] = {"luc": SD.vn(), **lop_chu(f, KT, CQ)}
    except Exception as e: loi.append(f"chữ: {str(e)[:120]}")
    try: lop["giong"] = {"luc": SD.vn(), **lop_giong(f, KT)}
    except Exception as e: loi.append(f"giọng: {str(e)[:120]}")
    to = SD.to_khung(f, f"cham-{cr}")
    if to: lop["anh"] = {"luc": SD.vn(), "so_khung": 30}
    else: loi.append("ảnh: không dựng được tờ khung")
    diem, ly, khung = {}, {}, {}
    if to:
        try:
            # HAI LƯỢT ĐỘC LẬP, lấy điểm thấp hơn (chấm thử 25/10/2026: cùng đầu vào #55305 lần 5 điểm, lần 10 — máy dao động);
            # hai lượt lệch ≥ 4 điểm ở tiêu chí nào thì tiêu chí đó ≤ 7 (cần người xem) kèm ghi chú lệch
            hoi = cau_hoi(tc, lop.get("chu", {}), lop.get("giong"))
            from concurrent.futures import ThreadPoolExecutor as _TP
            net = to_net(f, cr)
            with _TP(2) as ex: ls = [x.result() for x in [ex.submit(claude, to, net, hoi, tc) for _ in range(2)]]
            j = min(ls, key=lambda x: sum((x.get("diem") or {}).values()))
            d2 = [{k: int(round(float(v))) for k, v in (x.get("diem") or {}).items()} for x in ls]
            for k in set(d2[0]) | set(d2[1]):
                a_, b_ = d2[0].get(k, 10), d2[1].get(k, 10); lo_ = 0 if a_ <= b_ else 1
                diem[k] = min(a_, b_)
                if diem[k] < 10: ly[k] = str((ls[lo_].get("ly_do") or {}).get(k, ""))[:300]
                if abs(a_ - b_) >= 4: diem[k] = min(diem[k], 7); ly[k] = (f"hai lượt chấm lệch {a_} / {b_} — cần người xem. " + ly.get(k, ""))[:300]
                kh = sorted({int(n) for x in ls for n in ((x.get("khung") or {}).get(k) or []) if str(n).isdigit() and 1 <= int(n) <= 30})
                if kh and diem[k] < 10: khung[k] = kh
            lop["noi_dung"] = {"luc": SD.vn(), "tom_tat": str(j.get("noi_dung", ""))[:600], "duong": j.get("duong")}
            if j.get("anh_url"): lop["anh"]["url"] = j["anh_url"]
            # khung bị bắt → giây trong video (30 khung chia đều độ dài) để trang tua video tới đúng chỗ
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip() or 0)
            lop["anh"]["giay"] = round(dur, 2)

        except Exception as e: loi.append(f"nội dung: {str(e)[:160]}")
    # luật máy đọc chữ / lời thắng điểm Claude
    tu_cam = (lop.get("chu", {}).get("loi") or []) + (lop.get("giong", {}).get("loi") or [])
    if tu_cam: diem["meta.ngon_tu"] = min(diem.get("meta.ngon_tu", 10), 6); ly["meta.ngon_tu"] = "máy đọc thấy từ cấm: " + "; ".join(tu_cam)[:280]
    if lop.get("chu", {}).get("cta"): diem["afs.cta"] = min(diem.get("afs.cta", 10), 4); ly["afs.cta"] = "chữ dụ nhấp: " + "; ".join(lop["chu"]["cta"])[:280]
    meta = min([v for k, v in diem.items() if k.startswith("meta.")], default=None); afs = min([v for k, v in diem.items() if k.startswith("afs.")], default=None)
    ket = "xem" if meta is None or afs is None else "cam" if meta <= CAM_META else "xem" if meta <= XEM or afs <= XEM else "ok"
    v = json.dumps({"creative_id": int(cr), "doan": doan, "may": MAY, "lop": lop, "diem": diem, "ly_do": ly, "khung": khung, "meta": meta, "afs": afs, "ket": ket, "loi": "; ".join(loi) or None}, ensure_ascii=False).replace("$J$", "")
    SD.sql(f"""insert into etp.cham (creative_id, doan, may, lop, diem, ly_do, khung, meta, afs, ket, loi)
               select creative_id, doan, may, lop, diem, ly_do, khung, meta, afs, ket, loi from jsonb_populate_record(null::etp.cham, $J${v}$J$::jsonb)
               on conflict (creative_id) do update set doan = excluded.doan, luc = now(), may = excluded.may, lop = excluded.lop, diem = excluded.diem,
                 ly_do = excluded.ly_do, khung = excluded.khung, meta = excluded.meta, afs = excluded.afs, ket = excluded.ket, loi = excluded.loi""")
    # CHỈ CHẤM (anh 25/10/2026): không ghi vào sổ soát đoạn / cổng lên creative / camp — áp dụng khi anh cho
    return ket, meta, afs

MAY = socket.gethostname().split(".")[0]
def chay(a):
    KT, CQ = nap("kiem_thoai", "kiem-thoai.py"), nap("cta_qc", "cta_qc.py")
    tc = tieu_chi()
    if "--creative" in a: chon = "c.creative_id in (" + ",".join(str(int(x)) for x in a[a.index("--creative") + 1:] if x.isdigit()) + ")"
    else: chon = "(k.trang_thai = 'ACTIVE' or k.giao in ('IN_PROCESS', 'DISAPPROVED'))" + ("" if "--lai" in a else " and c.creative_id not in (select creative_id from etp.cham where loi is null)")
    r = SD.sql(f"select distinct c.creative_id, coalesce(c.doan, ''), c.video from etp.creative c left join etp.camp k on k.creative_id = c.creative_id where c.video is not null and {chon}")
    viec = [l.split("|") for l in r.splitlines() if l.count("|") == 2]
    luong = int(a[a.index("--luong") + 1]) if "--luong" in a else 4
    print(f"chấm {len(viec)} creative ({luong} luồng, {MAY})", flush=True)
    td = {"tong": len(viec), "xong": 0, "ok": 0, "cam": 0, "xem": 0, "bat_dau": SD.vn(), "cap_nhat": SD.vn(), "dang": True, "cuoi": "", "loai": "cham"}
    SD.gop("ethopex_quet", {MAY: td}); kl = threading.Lock()
    hang = "--hang" in a
    def lam(x):
        cr, doan, url = x
        try:
            ket, meta, afs = mot(cr, doan or None, url, tc, KT, CQ); dong = f"#{cr} {ket} · Meta {meta} · AFS {afs}"
            if hang: SD.sql(f"update etp.cham_hang set trang_thai = 'xong', xong = now(), loi = null where creative_id = {int(cr)}")
        except Exception as e:
            ket, dong = "xem", f"#{cr} lỗi: {type(e).__name__} {str(e)[:120]}"
            if hang: SD.sql(f"update etp.cham_hang set trang_thai = 'loi', xong = now(), loi = $L${str(e)[:200].replace('$L$', '')}$L$ where creative_id = {int(cr)}")
        print(dong, flush=True)
        with kl:
            td["xong"] += 1; td[ket] += 1; td["cap_nhat"] = SD.vn(); td["cuoi"] = dong[:120]
            try: SD.gop("ethopex_quet", {MAY: td})
            except Exception: pass
    from concurrent.futures import ThreadPoolExecutor
    list(ThreadPoolExecutor(luong).map(lam, viec))
    td["dang"] = False; td["cap_nhat"] = SD.vn(); SD.gop("ethopex_quet", {MAY: td})
    print(f"xong: sạch {td['ok']} · cấm {td['cam']} · cần người xem {td['xem']}", flush=True)

def hang():
    """TIẾN TRÌNH com.htuan.ethopex-cham (launchd iMac, mỗi phút, anh duyệt 25/10/2026): nhận etp.cham_hang (nút "Chấm" trên trang + creative mới)
    → chấm. Hàng trống → thoát ngay (một lệnh đọc, 0đ). Một lượt một lúc (khoá tệp). Ưu tiên nút anh bấm."""
    import fcntl
    os.makedirs(C, exist_ok=True); lk = open(os.path.join(C, "cham.lock"), "w")
    try: fcntl.flock(lk, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError: return
    # 'dang' quá 30 phút = lượt trước chết giữa chừng → trả về hàng; creative chưa vào kho sau 2 giờ (đồng bộ 10 phút) → lỗi
    nhan = SD.sql("""update etp.cham_hang set trang_thai = 'cho', bat_dau = null where trang_thai = 'dang' and bat_dau < now() - interval '30 minutes';
        update etp.cham_hang h set trang_thai = 'loi', xong = now(), loi = 'creative không có trong kho / không có video sau 2 giờ'
          where trang_thai = 'cho' and luc < now() - interval '2 hours' and not exists (select 1 from etp.creative c where c.creative_id = h.creative_id and c.video is not null);
        update etp.cham_hang set trang_thai = 'dang', bat_dau = now() where creative_id in (
          select h.creative_id from etp.cham_hang h join etp.creative c on c.creative_id = h.creative_id and c.video is not null
          where h.trang_thai = 'cho' order by (h.nguon = 'nut') desc, h.luc limit 6) returning creative_id""")
    ids = [x for x in nhan.split() if x.isdigit()]
    if ids: chay(["--creative", *ids, "--luong", "3", "--hang"])

if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["box"]: box(a[1], a[2], a[3:])
    elif a[:1] == ["chay"]: chay(a[1:])
    elif a[:1] == ["hang"]: hang()
    else: print(__doc__)
