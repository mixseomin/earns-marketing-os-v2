#!/usr/bin/env python3
"""SỬA CTA CHO CAMP THẮNG ĐANG CHỜ NHÂN BẢN — xử hết hàng studio xv_khoa_ngoai['ethopex_cho_dung_lai'] (anh 23/10/2026: "phải luôn sửa lại CTA chứ").
nhan-ban.py gặp camp thắng mang creative CTA cũ mà chưa có bản sửa thì xếp vào hàng này; trước đây không gì xử hàng → camp thắng nằm chờ mãi.
Mỗi mục (creative cũ → camp gốc), cùng một đường cho mọi phim:
  1. đoạn cũ (studio kinh_thanh.ethopex: tu, den, nguon_qc) + tên/link phim (spy ethopex_content)
  2. bảo đảm nguồn: video QC spy (kho spy, mất tệp thì tải lại link FB trên box3) + tập sạch (tai-tap.py)
  3. dò đúng đoạn đó trên tập sạch (khop-nguon) → khớp: dựng lại đúng đoạn với CTA mới (lam-lai-cta)
     không khớp (spy dựng từ tập trả phí) → creative CTA đạt sẵn có của cùng phim; chưa có thì cắt góc mới từ tập sạch (cat-cuoi-lo)
  4. len-creative.py (đẩy + cổng studio + cổng chữ + đánh dấu CTA đạt + ghi bản sửa ethopex_cta_thay, gỡ khỏi hàng)
  5. nhân bản ngay camp gốc (nhan-ban.py --lich today) — lần sau máy tự nhân bản cũng dùng bản sửa
CHUẨN BỊ TRƯỚC (anh 23/10/2026: "camp mới chuẩn bị lên thì phải chủ động mà sửa CTA lỗi. Camp đang lãi cấm sửa gì"): ngoài hàng bị chặn, mọi camp ĐANG CHẠY
có lãi (ROI tháng ≥ 50%, chi ≥ $3) mang creative CTA cũ chưa có bản sửa cũng được dựng sẵn bản sửa → tới lượt nhân bản là có ngay. Chỉ dựng creative mới
+ tạo camp nhân bản; KHÔNG sửa / tắt / đổi creative của camp đang chạy. Mục chuẩn bị trước không nhân bản ở đây (để luật NB quyết như thường).
Phim bị đánh dấu cấm ở soát 18+ (ethopex_soat_18 ok=false) thì bỏ qua, báo lại.
Chạy trên box3 (etp-sua-tu-choi.timer, cổng chữ đọc bằng tesseract — kiem-thoai.doc_linux) hoặc iMac (Vision), gọi ở cuối mỗi đợt lên camp (dot-phim-moi.py): python3 sua-cta.py [--chi <creative cũ> …] [--khong-nb] [--khong-truoc]"""
import fcntl, glob, importlib.util, json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import loi_ky_thuat as LK; import soat_doan as SD
D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex")
N, Q = os.path.join(C, "nguon"), os.path.join(C, "nguon-qc")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
sh = lambda c, **k: subprocess.run(c, shell=True, capture_output=True, text=True, **k)
# ưu tiên nền: iMac taskpolicy -b · box3 (anh 31/10/2026 đưa dựng lên box3 — tiến trình etp-sua-tu-choi.timer) nice 15 để mos2 / etp.on.tc không chậm
NEN = ["taskpolicy", "-b"] if sys.platform == "darwin" else ["nice", "-n", "15"]
def nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

def sql(cau, spy=False):
    """một truy vấn trên box3 (studio, hoặc kho spy) → stdout; câu đi qua stdin, không đụng dấu nháy shell"""
    nen = ". /root/.secrets/spy.env" if spy else ENV
    return subprocess.run(["ssh", B, f'{nen}; psql "$DATABASE_URL" -tA -F"\t" -f -'], input=cau, capture_output=True, text=True).stdout.strip()
khoa = lambda ten: json.loads(sql(f"select coalesce(gia_tri, '{{}}'::jsonb)::text from xv_khoa_ngoai where ten='{ten}'") or "{}")

def nguon_spy(qc):
    f = os.path.join(Q, f"{qc}.mp4")
    if os.path.exists(f) and os.path.getsize(f) > 100_000: return f
    r = sql(f"select coalesce(video_kho,''), coalesce(video_hd, video_sd, '') from qc_meta where library_id::text = '{qc}'", spy=True).split("\t")
    if len(r) < 2: return None
    kho, url = r[0], r[1]
    tren = f"/opt/spy/tep{kho[4:]}" if kho else ""
    if not (tren and sh(f"ssh {B} test -s {tren}").returncode == 0):   # kho spy mất tệp → tải lại link FB đã lưu
        if not url: return None
        tren = f"/tmp/sua-cta-{qc}.mp4"
        if subprocess.run(["ssh", B, f"curl -s -L --max-time 300 -o {tren} '{url}' && test -s {tren}"]).returncode != 0: return None
    os.makedirs(Q, exist_ok=True)
    return f if subprocess.run(["scp", "-q", f"{B}:{tren}", f]).returncode == 0 else None

def nguon_sach(cid, url):
    tm = os.path.join(N, str(cid))
    co = os.path.isdir(tm) and any((x.startswith("tap") and x.endswith(".mp4")) or x == "ghep-cuoi.mp4" or x == f"{cid}.mp4" for x in os.listdir(tm))
    if not co and url:
        os.makedirs(tm, exist_ok=True); sh(f"python3 {D}/tai-tap.py '{url}' {tm} 8", timeout=1800)
    return tm if os.path.isdir(tm) and any(x.endswith(".mp4") for x in os.listdir(tm)) else None

UNG_VIEN = r'''
import json, os, subprocess, urllib.request, datetime as dt
from concurrent.futures import ThreadPoolExecutor
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
H = {"authorization": "Bearer " + T, "user-agent": "mos2-sua-cta", "content-type": "application/json"}
import sys; sys.path.insert(0, "/opt/earns-marketing-os-v2/apps/etp"); import ethopex_api as EA   # cổng chung: chỉ tài khoản nhà (anh 28/10/2026) — đoạn này chạy trên box3 qua ssh, không có __file__
api = lambda p, b=None: json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, data=b, method="POST" if b else "GET", headers=H), timeout=90))
api = lambda p, b=None: EA.api(p, b)   # mọi lệnh Ethopex qua cổng chung apps/etp/ethopex_api.py: danh sách đủ mọi trang + chỉ camp tài khoản nhà, lệnh ghi vào camp ngoài bị chặn (anh 28/10/2026)
dat = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_dat'") or "{}")
thay = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_thay'") or "{}")
nay = dt.datetime.now(dt.timezone.utc).date()
rows = api("/api/v1/report", json.dumps({"columns": ["campaign_name", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 1000, "page": 1, "page_size": 1000, "date_from": nay.strftime("%Y-%m-01"), "date_to": nay.isoformat()}).encode()).get("rows", [])
so = {}
for x in rows: a = so.setdefault(x["campaign_id"], [0.0, 0.0]); a[0] += float(x.get("cost") or 0); a[1] += float(x.get("revenue") or 0)
hay = [c for c in api("/api/v1/campaigns?page_size=500")["data"] if c.get("state") == "ACTIVE" and so.get(c["id"], [0, 0])[0] >= 3 and (so[c["id"]][1] - so[c["id"]][0]) / so[c["id"]][0] >= 0.5]
def ct(c):
    try: a = api(f"/api/v1/campaigns/{c['id']}")["ad_groups"][0]["ads"][0]; return c, a.get("creative_id"), a.get("content_id")
    except Exception: return c, None, None
ra = {}
with ThreadPoolExecutor(12) as ex:
    for c, cr, cid in ex.map(ct, hay):
        if not cr or str(cr) in dat or str(cr) in thay: continue
        r = (so[c["id"]][1] - so[c["id"]][0]) / so[c["id"]][0]
        if str(cr) not in ra or r > ra[str(cr)]["roi"]: ra[str(cr)] = {"goc": c["id"], "ten": c["name"].split(": ", 1)[-1], "content_id": cid, "roi": r, "truoc": True}
print(json.dumps(ra, ensure_ascii=False))
'''
def ung_vien():
    r = subprocess.run(["ssh", B, f"{ENV}; python3 -"], input=UNG_VIEN, capture_output=True, text=True, timeout=600)
    try: return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: print("không đọc được camp chuẩn bị trước:", r.stderr[-200:]); return {}

def goc_moi(ma, bao, nb):
    """GÓC MỚI cho phim mà mọi creative đã đủ 3 camp (nhan-ban.py xếp ['ethopex_can_goc_moi'] {content: {goc, ten}}, anh duyệt 23/10/2026):
    cắt tới 6 khung cuối tập từ tập sạch, bỏ khung chồng lên đoạn đã có creative → tối đa 3 góc → len-creative → nhân bản lại camp gốc
    (nhan-ban tự chọn creative mới vì còn < 3 camp). Làm xong (được hay không) gỡ khỏi hàng, báo lý do."""
    hang = khoa("ethopex_can_goc_moi")
    if not hang: return
    dung, viec = [], {}
    for cid, m in hang.items():
        r = sql(f"select ten, url from ethopex_content where id = {int(cid)}", spy=True).split("\t")
        ten = (r[0] if r and r[0] else "").replace("（DUBBED）", "").replace("(Doblado)", "").strip(); url = r[1] if len(r) > 1 else ""
        lang = "es" if " ES - " in m.get("ten", "") else "en"
        tm = nguon_sach(cid, url)
        if not tm: bao.append(f"góc mới phim {cid}: chưa tải được tập sạch"); continue
        da = [tuple(map(float, l.split("\t"))) for l in sql(f"select kinh_thanh->'ethopex'->>'tu', kinh_thanh->'ethopex'->>'den' from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(cid)} and kinh_thanh->'ethopex' ? 'tu'").splitlines() if l.count("\t") == 1 and "" not in l.split("\t")]
        rg = os.path.join(C, "ra", ma, f"gocmoi-{cid}"); tsv = rg + ".tsv"; open(tsv, "w").write(f"{cid}\t{lang}\tgoc\t{ten}\t{url}\n")
        subprocess.run([*NEN, "python3", f"{D}/cat-cuoi-lo.py", N, tsv, rg, "1", "6"], capture_output=True, text=True, timeout=4 * 3600)
        try: g = [x for x in json.load(open(os.path.join(rg, "lo.json"))) if x.get("file") and not x.get("loi")]
        except Exception: g = []
        da += SD.cam_cua(cid)   # tránh cả đoạn soát cấm + đoạn Meta đã từ chối
        g = [x for x in g if not any(float(x["tu"]) < d and float(x["den"]) > t for t, d in da)][:3]
        try: loi = " ".join(str(x.get("loi")) for x in json.load(open(os.path.join(rg, "lo.json"))) if x.get("loi"))
        except Exception: loi = "không có lo.json"
        if not g and LK.ky_thuat(loi) is True: bao.append(f"góc mới phim {cid}: lỗi kỹ thuật ({loi[:80]}) — giữ trong hàng, lượt sau cắt lại"); hang[cid]["giu"] = True; continue
        if g: dung += [{**x, "lo": "goc", "goc": m.get("goc")} for x in g]; viec[cid] = m; bao.append(f"góc mới phim {cid} ({ten[:30]}): {len(g)} góc " + ", ".join(f"{x['tu']:.0f}–{x['den']:.0f}s" for x in g))
        else: bao.append(f"góc mới phim {cid} ({ten[:30]}): hết khung cuối tập sạch chưa dùng — phim đã khai thác hết phần tập miễn phí")
    if dung:
        lf = os.path.join(C, "ra", ma, "len-goc-moi.json"); json.dump(dung, open(lf, "w"), ensure_ascii=False, indent=1)
        r = subprocess.run([*NEN, "python3", f"{D}/len-creative.py", lf, ma + "g", "canh cuoi"], capture_output=True, text=True, timeout=6 * 3600)
        print(r.stdout[-800:], r.stderr[-300:])
    try: day = {str(x["content_id"]) for x in json.load(open(os.path.join(C, "ra", ma + "g", "len.json"))) if x.get("ok")}
    except Exception: day = set()
    for cid, m in viec.items():
        if m.get("thay"):   # góc mới cho CAMP THAY THẾ (thay-the.py, anh 29/10/2026): không nhân bản camp cũ đang lỗ — nhịp ethopex kế tiếp thay-the.py lên camp bằng góc này
            bao.append(f"góc mới phim {cid}: góc cho camp thay #{m.get('goc')} — thay-the.py lên ở nhịp ethopex kế"); continue
        if nb and m.get("goc") and cid not in day: bao.append(f"góc mới phim {cid}: góc chờ soát đoạn — soat_doan.py len sẽ nhân bản #{m['goc']} sau khi soát"); continue
        if nb and m.get("goc"):
            r = sh(f"""ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {int(m["goc"])} --that --lich today --luat "nhân bản camp thắng bằng GÓC MỚI (đoạn cũ đủ 3 camp)" --ai "máy (anh duyệt 23/10/2026: một đoạn tối đa 3 camp, nhân bản bằng góc mới)"'""", timeout=600)
            bao.append(f"góc mới phim {cid} → nhân bản #{m['goc']}: {(r.stdout.strip().splitlines() or [r.stderr.strip()[-150:]])[-1][:200]}")
    xong = [c for c in hang if not hang[c].get("giu")]
    if xong: sql("update xv_khoa_ngoai set gia_tri = gia_tri - array[" + ",".join(f"'{c}'" for c in xong) + "] where ten='ethopex_can_goc_moi'")

def main():
    a = sys.argv[1:]
    goc_lan_nay = False
    if "--tu-choi" in a:   # tiến trình ethopex-sua-tu-choi (launchd iMac, 10 phút, anh duyệt 24/10/2026): ad bị Meta từ chối đang chờ góc mới; rỗng thì thoát ngay
        tc = [k for k, v in khoa("ethopex_cho_dung_lai").items() if v.get("tu_choi")]
        # TẠM (anh 25/10/2026: "làm tạm trên iMac lúc này cho đến khi CF xong lô chính"): cắt luôn GÓC MỚI cho phim trong hàng ethopex_can_goc_moi
        # (clone phải khác creative → phim hết creative khác cần góc mới) thay vì chờ cuối mỗi lô lên phim
        goc_lan_nay = bool(khoa("ethopex_can_goc_moi"))
        if not tc and not goc_lan_nay: return
        a = ["--khong-truoc", "--chi", *(tc or ["0"])]
    chi = set(a[a.index("--chi") + 1:]) if "--chi" in a else None; nb = "--khong-nb" not in a
    lk = open(os.path.join(C, "sua-cta.lock"), "w")
    try: fcntl.flock(lk, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError: return print("sua-cta đang chạy ở lượt khác — thoát")
    ma = time.strftime("sua%d%m%H%M"); os.makedirs(os.path.join(C, "ra", ma), exist_ok=True); bao0 = []
    import xuong as XG; XG.bao("sua", ma, "sửa CTA / góc mới cho camp thắng", ep=True)
    if not chi or goc_lan_nay: goc_moi(ma, bao0, nb)
    if bao0: print("\n".join(bao0), flush=True)
    hang = {k: v for k, v in khoa("ethopex_cho_dung_lai").items() if not chi or k in chi}
    if not chi and "--khong-truoc" not in a:
        for k, v in ung_vien().items(): hang.setdefault(k, v)
    if not hang: return print("hàng sửa CTA trống")
    soat, thay, dat = khoa("ethopex_soat_18"), khoa("ethopex_cta_thay"), khoa("ethopex_cta_dat")
    ra = os.path.join(C, "ra", ma)
    KN, LL = nap("kn", "khop-nguon.py"), nap("ll", "lam-lai-cta.py")
    cu = {}; dung = {"canh that": [], "canh cuoi": []}; bao = []
    for old, m in hang.items():
        if old in thay: bao.append(f"{old}: đã có bản sửa #{thay[old]}"); continue
        st = sql(f"select kinh_thanh->'ethopex' from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'creative_id')::int = {int(old)} limit 1")
        st = json.loads(st) if st else {}
        cid = int(st.get("content_id") or m.get("content_id") or 0)
        if not cid: bao.append(f"{old}: không tìm được phim"); continue
        if str(cid) in soat and soat[str(cid)].get("ok") is False: bao.append(f"{old}: phim {cid} bị cấm ở soát 18+ — bỏ qua"); continue
        r = sql(f"select ten, url from ethopex_content where id = {cid}", spy=True).split("\t")
        ten = (r[0] if r and r[0] else m.get("ten", "")).replace("（DUBBED）", "").replace("(Doblado)", "").strip(); url = r[1] if len(r) > 1 else ""
        lang = "es" if " ES - " in m.get("ten", "") else "en"
        cu[old] = {"goc": m.get("goc"), "cid": cid, "truoc": bool(m.get("truoc")), "tu_choi": bool(m.get("tu_choi"))}
        tm = nguon_sach(cid, url)
        if not tm: bao.append(f"{old}: chưa tải được tập sạch phim {cid}"); continue
        tu, den, qc = st.get("tu"), st.get("den"), st.get("nguon_qc")
        k = None
        tc = khoa("ethopex_tu_choi")
        if m.get("tu_choi"): bao.append(f"{old}: Meta từ chối ({str(m.get('ly_do'))[:60]}) → không dựng lại đoạn cũ, lấy creative khác / góc mới")
        elif tu is not None and qc:
            spy = nguon_spy(qc)
            if spy:
                try: k = KN.main(spy, tm, float(tu), float(den))
                except Exception as e: k = {"khop": False, "loi": str(e)[-120:]}
        elif tu is not None and not m.get("tu_choi"): k = {"khop": True, "tu": float(tu), "den": float(den)}   # đoạn cũ đã cắt từ tập sạch: dựng lại đúng mốc
        if k and k.get("khop"):
            x = LL.lam({"content_id": cid, "lang": lang, "ten": ten, "tu": k["tu"], "den": k["den"], "camp": m.get("goc"), "lo": "sua"}, ra)
            if "loi" not in x: dung["canh that"].append(x); bao.append(f"{old}: dựng lại đúng đoạn {k['tu']:.0f}–{k['den']:.0f}s trên tập sạch"); continue
            bao.append(f"{old}: dựng lại đoạn khớp lỗi ({str(x['loi'])[:80]}) → góc khác")
        # không khớp: creative CTA đạt sẵn có của cùng phim (chưa là bản sửa của creative khác thì ưu tiên)
        co = [int(r) for r in sql(f"select (kinh_thanh->'ethopex'->>'creative_id') from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {cid}").split() if r.isdigit()]
        san = [c for c in sorted(co, reverse=True) if str(c) in dat and str(c) not in tc and str(c) != old]
        if san:
            moi = next((c for c in san if c not in thay.values()), san[0])
            print(sh(f"ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 ghi-cta-thay.py {old}:{moi}'").stdout.strip()[-200:])
            thay[old] = moi; bao.append(f"{old}: spy không khớp tập sạch → dùng creative CTA đạt #{moi} cùng phim"); continue
        # chưa có: cắt góc mới từ tập sạch
        tsv = os.path.join(ra, f"goc-{cid}.tsv"); open(tsv, "w").write(f"{cid}\t{lang}\tsua\t{ten}\t{url}\n"); rg = os.path.join(ra, f"goc-{cid}")
        # 3 góc một lần: góc nào trượt cổng chữ (thoại nhạy cảm — Phantom Returns 23/10/2026) vẫn còn góc khác; len-creative ghi bản sửa theo góc đạt
        subprocess.run([*NEN, "python3", f"{D}/cat-cuoi-lo.py", N, tsv, rg, "1", "3"], capture_output=True, text=True, timeout=3 * 3600)
        try: g = [x for x in json.load(open(os.path.join(rg, "lo.json"))) if x.get("file") and not x.get("loi")]
        except Exception: g = []
        cam = SD.cam_cua(cid) + ([(float(tu), float(den))] if m.get("tu_choi") and tu is not None else [])   # bỏ góc chồng lên đoạn soát cấm / Meta từ chối
        g = [x for x in g if not any(float(x.get("tu", 0)) < d and float(x.get("den", 0)) > t for t, d in cam)]
        if g: dung["canh cuoi"] += [{**x, "camp": m.get("goc"), "lo": "sua"} for x in g]; bao.append(f"{old}: cắt {len(g)} góc mới từ tập sạch: " + ", ".join(f"{x.get('tu'):.0f}–{x.get('den'):.0f}s" for x in g))
        else: bao.append(f"{old}: chưa dựng được bản sửa (khớp đoạn / góc mới đều lỗi)")
    for dang, ds in dung.items():
        if not ds: continue
        lf = os.path.join(ra, f"len-{dang.replace(' ', '-')}.json"); json.dump(ds, open(lf, "w"), ensure_ascii=False, indent=1)
        m2 = f"{ma}{'t' if dang == 'canh that' else 'c'}"
        r = subprocess.run([*NEN, "python3", f"{D}/len-creative.py", lf, m2, dang], capture_output=True, text=True, timeout=6 * 3600)
        print(r.stdout[-800:], r.stderr[-400:])
    thay = khoa("ethopex_cta_thay")
    for old, v in cu.items():
        if old not in thay and not v["tu_choi"]: continue
        if v["tu_choi"]:   # ad bị từ chối: thay ngay trong camp, không nhân bản
            r = sh(f"ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 thay-tu-choi.py --camp {int(v['goc'])}'", timeout=600)
            bao.append(f"{old} (Meta từ chối) → thay trong camp #{v['goc']}: {(r.stdout.strip().splitlines() or [r.stderr.strip()[-150:]])[-1][:200]}"); continue
        if v["truoc"]: bao.append(f"{old} → #{thay[old]} · chuẩn bị sẵn cho camp #{v['goc']} (luật NB tự nhân bản khi tới lượt)"); continue
        if nb and v["goc"]:
            r = sh(f"""ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {int(v["goc"])} --that --lich today --luat "nhân bản camp thắng · bản sửa CTA #{thay[old]} thay creative #{old}" --ai "máy (anh 23/10/2026: phải luôn sửa lại CTA)"'""", timeout=600)
            bao.append(f"{old} → #{thay[old]} · nhân bản #{v['goc']}: {(r.stdout.strip().splitlines() or [r.stderr.strip()[-150:]])[-1][:200]}")
    print("\n".join(bao)); XG.bao("nghi", ma, "xong sửa CTA", ep=True)

if __name__ == "__main__": main()
