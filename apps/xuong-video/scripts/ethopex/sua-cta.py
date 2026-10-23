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
Phim bị đánh dấu cấm ở soát 18+ (ethopex_soat_18 ok=false) thì bỏ qua, báo lại.
Chạy trên iMac (cổng chữ dùng Vision): python3 sua-cta.py [--chi <creative cũ> …] [--khong-nb]"""
import fcntl, glob, importlib.util, json, os, subprocess, sys, time
D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex")
N, Q = os.path.join(C, "nguon"), os.path.join(C, "nguon-qc")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
sh = lambda c, **k: subprocess.run(c, shell=True, capture_output=True, text=True, **k)
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
    co = os.path.isdir(tm) and any(x.startswith("tap") or x == "ghep-cuoi.mp4" or x == f"{cid}.mp4" for x in os.listdir(tm))
    if not co and url:
        os.makedirs(tm, exist_ok=True); sh(f"python3 {D}/tai-tap.py '{url}' {tm} 8", timeout=1800)
    return tm if os.path.isdir(tm) and any(x.startswith("tap") or x.endswith(".mp4") for x in os.listdir(tm)) else None

def main():
    a = sys.argv[1:]; chi = set(a[a.index("--chi") + 1:]) if "--chi" in a else None; nb = "--khong-nb" not in a
    lk = open(os.path.join(C, "sua-cta.lock"), "w")
    try: fcntl.flock(lk, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError: return print("sua-cta đang chạy ở lượt khác — thoát")
    hang = {k: v for k, v in khoa("ethopex_cho_dung_lai").items() if not chi or k in chi}
    if not hang: return print("hàng sửa CTA trống")
    soat, thay, dat = khoa("ethopex_soat_18"), khoa("ethopex_cta_thay"), khoa("ethopex_cta_dat")
    ma = time.strftime("sua%d%m%H%M"); ra = os.path.join(C, "ra", ma); os.makedirs(ra, exist_ok=True)
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
        cu[old] = {"goc": m.get("goc"), "cid": cid}
        tm = nguon_sach(cid, url)
        if not tm: bao.append(f"{old}: chưa tải được tập sạch phim {cid}"); continue
        tu, den, qc = st.get("tu"), st.get("den"), st.get("nguon_qc")
        k = None
        if tu is not None and qc:
            spy = nguon_spy(qc)
            if spy:
                try: k = KN.main(spy, tm, float(tu), float(den))
                except Exception as e: k = {"khop": False, "loi": str(e)[-120:]}
        elif tu is not None: k = {"khop": True, "tu": float(tu), "den": float(den)}   # đoạn cũ đã cắt từ tập sạch: dựng lại đúng mốc
        if k and k.get("khop"):
            x = LL.lam({"content_id": cid, "lang": lang, "ten": ten, "tu": k["tu"], "den": k["den"], "camp": m.get("goc"), "lo": "sua"}, ra)
            if "loi" not in x: dung["canh that"].append(x); bao.append(f"{old}: dựng lại đúng đoạn {k['tu']:.0f}–{k['den']:.0f}s trên tập sạch"); continue
            bao.append(f"{old}: dựng lại đoạn khớp lỗi ({str(x['loi'])[:80]}) → góc khác")
        # không khớp: creative CTA đạt sẵn có của cùng phim (chưa là bản sửa của creative khác thì ưu tiên)
        co = [int(r) for r in sql(f"select (kinh_thanh->'ethopex'->>'creative_id') from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {cid}").split() if r.isdigit()]
        san = [c for c in sorted(co, reverse=True) if str(c) in dat]
        if san:
            moi = next((c for c in san if c not in thay.values()), san[0])
            print(sh(f"ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 ghi-cta-thay.py {old}:{moi}'").stdout.strip()[-200:])
            thay[old] = moi; bao.append(f"{old}: spy không khớp tập sạch → dùng creative CTA đạt #{moi} cùng phim"); continue
        # chưa có: cắt góc mới từ tập sạch
        tsv = os.path.join(ra, f"goc-{cid}.tsv"); open(tsv, "w").write(f"{cid}\t{lang}\tsua\t{ten}\t{url}\n"); rg = os.path.join(ra, f"goc-{cid}")
        subprocess.run(["taskpolicy", "-b", "python3", f"{D}/cat-cuoi-lo.py", N, tsv, rg, "1", "1"], capture_output=True, text=True, timeout=3 * 3600)
        try: g = [x for x in json.load(open(os.path.join(rg, "lo.json"))) if x.get("file") and not x.get("loi")]
        except Exception: g = []
        if g: dung["canh cuoi"].append({**g[0], "camp": m.get("goc"), "lo": "sua"}); bao.append(f"{old}: cắt góc mới {g[0].get('tu')}–{g[0].get('den')}s từ tập sạch")
        else: bao.append(f"{old}: chưa dựng được bản sửa (khớp đoạn / góc mới đều lỗi)")
    for dang, ds in dung.items():
        if not ds: continue
        lf = os.path.join(ra, f"len-{dang.replace(' ', '-')}.json"); json.dump(ds, open(lf, "w"), ensure_ascii=False, indent=1)
        m2 = f"{ma}{'t' if dang == 'canh that' else 'c'}"
        r = subprocess.run(["taskpolicy", "-b", "python3", f"{D}/len-creative.py", lf, m2, dang], capture_output=True, text=True, timeout=6 * 3600)
        print(r.stdout[-800:], r.stderr[-400:])
    thay = khoa("ethopex_cta_thay")
    for old, v in cu.items():
        if old not in thay: continue
        if nb and v["goc"]:
            r = sh(f"""ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {int(v["goc"])} --that --lich today --luat "nhân bản camp thắng · bản sửa CTA #{thay[old]} thay creative #{old}" --ai "máy (anh 23/10/2026: phải luôn sửa lại CTA)"'""", timeout=600)
            bao.append(f"{old} → #{thay[old]} · nhân bản #{v['goc']}: {(r.stdout.strip().splitlines() or [r.stderr.strip()[-150:]])[-1][:200]}")
    print("\n".join(bao))

if __name__ == "__main__": main()
