#!/usr/bin/env python3
"""LÊN CREATIVE CHO MỘT LÔ ĐOẠN CẮT ĐÃ DỰNG (gom các bước làm tay ở lô 2310 / cta2, 22/10/2026) — chạy trên Mac (cổng chữ Vision) hoặc box3 (tesseract, kiem-thoai.doc_linux):
  1. đẩy video lên box3 + kho phat (R2) + ảnh đầu / thẻ cuối
  2. chữ QC (chu-qc.py, lọc thoại cấm + CTA dụ nhấp)
  3. POST /creatives/bulk-jobs → mã creative
  4. ghi studio (ghi-studio-canh-that.mts)
  5. cổng studio + cổng chữ trên video (kiem-studio.sh, kiem-thoai-creative.sh) — creative nào trượt thì bỏ
  6. đánh dấu đạt CTA (kiem-cta.py --dat)
Ra <ra>/len.json: [{camp_cu, content_id, creative_id, lang, ten, tu, den, ok, loi}] để lên camp (nhan-ban.py --creative).
Dùng: len-creative.py <lo.json (lam-lai-cta: content_id, lang, ten, tu, den, file[, camp, lo])> <mã lô (vd cta3)> <dạng (vd "canh cuoi")> [--da-soat]
  --da-soat: lô đã soát tờ khung TỪNG ĐOẠN trước khi gọi (đợt phim mới). Không có cờ: đoạn chưa soát bị giữ lại (soat_doan.py)."""
import csv, json, os, subprocess, sys, time, unicodedata, re
from concurrent.futures import ThreadPoolExecutor
import sys as _s; _s.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import xuong as XG; import cat_drive as CD
D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
GOC = "https://img.on.tc/kho/ethopex/thanh-pham/2026-10"
sh = lambda c, **k: subprocess.run(c, shell=True, capture_output=True, text=True, **k)

def ascii_(s):
    s = unicodedata.normalize("NFKD", s.replace("（DUBBED）", "").replace("(Doblado)", ""))
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9 \-]", "", s.encode("ascii", "ignore").decode())).strip()

def main(lo_f, ma, dang):
    lo = [x for x in json.load(open(lo_f)) if not x.get("loi") and x.get("file")]
    # CỔNG SOÁT THEO ĐOẠN (anh 24/10/2026, Meta từ chối góc mới Step Back vì cảnh cưỡng ép): đoạn chưa soát thì GIỮ LẠI, không đẩy — soat_doan.py
    import soat_doan as SD
    lo, giu = SD.loc(lo, ma, dang, da_soat="--da-soat" in sys.argv)
    if not lo:
        ra = os.path.join(C, "ra", ma); os.makedirs(ra, exist_ok=True); json.dump([], open(f"{ra}/len.json", "w"))
        return print(f"không đoạn nào được đẩy — {giu} đoạn chờ soát (python3 {D}/soat_doan.py ds)")
    for x in lo: x["ten_tep"] = f"{ma}-{x.get('lo', 'x')}-{os.path.basename(x['file'])}"
    ra = os.path.join(C, "ra", ma); os.makedirs(ra, exist_ok=True); json.dump(lo, open(f"{ra}/lo.json", "w"), ensure_ascii=False, indent=1)
    # 1. kho
    sh(f"ssh {B} 'mkdir -p /var/lib/ethopex/creative/{ma}'")
    # ĐẨY SONG SONG 12 LUỒNG (27/10/2026): mạng nhà đẩy được 254 Mbps nhưng MỘT luồng TCP tới box3 (Đức, trễ ~220 ms) chỉ ~1 Mbit/s →
    # lô 72 đoạn đẩy tuần tự mất ~5 giờ; 8–12 luồng cùng lúc đo được ~2 MB/s (gấp ~20). Đoạn cắt trên box3 ("box3:/đường") chép tại chỗ (23/10/2026).
    from concurrent.futures import ThreadPoolExecutor
    def day(x):
        if not x["file"].startswith("box3:"): CD.dam_bao(x["file"])   # đoạn đã cất lên Drive (cat_drive.py) → kéo về trước khi đẩy
        lenh = (["ssh", B, f"cp '{x['file'][5:]}' /var/lib/ethopex/creative/{ma}/{x['ten_tep']}"] if x["file"].startswith("box3:")
                else ["rsync", "-a", "--partial", x["file"], f"{B}:/var/lib/ethopex/creative/{ma}/{x['ten_tep']}"])
        for lan in range(3):   # sshd box3 bỏ bớt kết nối khi mở dồn (MaxStartups) — 27/10/2026 một luồng rớt làm gãy cả lô → thử lại
            if subprocess.run(lenh, capture_output=True).returncode == 0: return
            time.sleep(5 * (lan + 1))
        raise RuntimeError(f"đẩy {x['file']} lỗi 3 lần")
    with ThreadPoolExecutor(8) as ex: list(ex.map(day, lo))
    r = sh(f"""ssh {B} 'cd /var/lib/ethopex/creative/{ma} && for f in {ma}-*.mp4; do b=${{f%.mp4}}; ffmpeg -v error -y -ss 2 -i $f -frames:v 1 -q:v 3 $b.jpg; ffmpeg -v error -y -sseof -1.5 -i $f -frames:v 1 -q:v 3 tc-$b.jpg; echo "$b|$(ffprobe -v error -show_entries format=duration -of csv=p=0 $f)|$(kho phat $f ethopex thanh-pham $f | tail -1)|$(kho phat $b.jpg ethopex thanh-pham $b.jpg | tail -1)|$(kho phat tc-$b.jpg ethopex thanh-pham tc-$b.jpg | tail -1)"; done'""", timeout=3600)
    anh = {l.split("|")[0]: l.split("|") for l in r.stdout.splitlines() if l.count("|") == 4}
    XG.bao("day", ma, "đẩy video lên kho xong · viết chữ QC", 0, len(lo), ep=True)
    # 2. chữ QC
    ids = ",".join(sorted({str(x["content_id"]) for x in lo}))
    tsv = f"{ra}/chu.tsv"; sh(f"""ssh {B} '. /root/.secrets/spy.env; psql "$DATABASE_URL" -v ids={ids} -tA -F"\t" -f -' < {D}/qc-spy-phim.sql > {tsv}""")
    cr_f = f"{ra}/creative.json"; sh(f"python3 {D}/chu-qc.py {ra}/lo.json {tsv} {ma} {GOC} {cr_f} - '{dang}'")
    XG.bao("day", ma, "tạo creative trên Ethopex", 0, len(lo), ep=True)
    # 3. bulk-jobs
    subprocess.run(["scp", "-q", cr_f, f"{B}:/root/etp-kc/creative-{ma}.json"], check=True)
    r = sh(f"""ssh {B} '{ENV}; python3 - <<EOF
import json,os,subprocess,urllib.request,time
T=subprocess.run(["psql",os.environ["DATABASE_URL"],"-tAc","select gia_tri->>%s from xv_khoa_ngoai where ten=%s"%(chr(39)+"access_token"+chr(39),chr(39)+"ethopex"+chr(39))],capture_output=True,text=True).stdout.strip()
H={{"authorization":"Bearer "+T,"content-type":"application/json","user-agent":"mos2-kiem"}}
j=json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev/api/v1/creatives/bulk-jobs",data=open("/root/etp-kc/creative-{ma}.json","rb").read(),method="POST",headers=H),timeout=60))
for i in range(80):
    k=json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev/api/v1/creatives/bulk-jobs/%s"%j["job_id"],headers=H),timeout=60))
    if k.get("status") not in ("pending","processing","running","queued"): break
    time.sleep(15)
print(json.dumps([(x.get("creative") or {{}}).get("id") for x in k["data"]]))
EOF'""", timeout=3600)
    crs = json.loads(r.stdout.strip().splitlines()[-1])
    XG.bao("day", ma, "ghi studio", 0, len(lo), ep=True)
    # 4. studio
    import importlib.util as iu
    s_ = iu.spec_from_file_location("cq", os.path.join(D, "cta_qc.py")); CQ = iu.module_from_spec(s_); s_.loader.exec_module(CQ)
    giong = {"en": f"{GOC}/cta-en-george-v2.mp3", "es": f"{GOC}/cta-es-aria-v2.mp3"}
    st, pm = [], {}
    for x, c in zip(lo, crs):
        a = anh.get(x["ten_tep"][:-4]); x["creative_id"] = c
        if not c or not a: x["loi"] = "không tạo được creative / ảnh"; continue
        q = CQ.CTA[x["lang"]]
        st.append({"content_id": x["content_id"], "tu": x["tu"], "den": x["den"], "nguon_qc": x.get("nguon_qc"), "creative_id": c, "camp_id": None, "lang": x["lang"], "url": a[2],
                   "giay": round(float(a[1]), 1), "lo": ma, "anh": a[3], "anh_cuoi": a[4], "chu_cuoi": q["hoi"] + "\n" + q["nut"], "giong_cta": {"url": giong[x["lang"]], "loi": q["loi_giong"]}})
    # SỔ ĐIỂM CHẠM (anh 28/10/2026 "đo số điểm chạm như voice, text, hình, nội dung"): mỗi creative vừa tạo ghi hook · nội dung · voice · chữ video · CTA · ảnh đầu
    # · chữ QC vào etp.diem_cham (diem_cham.py) — chữ QC lấy theo phim từ creative.json (chu-qc.py)
    try:
        import diem_cham as DC
        _cq = json.load(open(cr_f)) if os.path.exists(cr_f) else []
        print("sổ điểm chạm:", DC.ghi([(x.get("creative_id"), DC.ban(x, dang, next((it.get("asset_spec") for it in _cq if str(it.get("content_id")) == str(x["content_id"])), None), CQ)) for x in lo if not x.get("loi")], SD.sql), "creative")
    except Exception as e: print("sổ điểm chạm lỗi:", e)
    r = sh(f"""ssh {B} '. /root/.secrets/spy.env; psql "$DATABASE_URL" -tA -F"\t" -c "select id, ten, url from ethopex_content where id in ({ids})"'""")
    for l in r.stdout.splitlines():
        i, t, u = l.split("\t"); pm[i] = {"ten": t.replace("（DUBBED）", "").replace("(Doblado)", "").strip(), "link": u}
    sf = os.path.join(D, f"canh-that-studio-{ma}.json"); json.dump({"creative": st, "phim_moi": pm, "dang": dang}, open(sf, "w"), ensure_ascii=False, indent=1)   # dạng thật → studio ghi đúng the_loai (29/10/2026: KT bị ghi cảnh thật)
    subprocess.run(["scp", "-q", sf, f"{B}:/opt/earns-marketing-os-v2/apps/xuong-video/scripts/ethopex/"], check=True)
    print(sh(f"ssh {B} '{ENV}; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/ghi-studio-canh-that.mts scripts/ethopex/{os.path.basename(sf)}'", timeout=900).stdout[-200:])
    # 5. cổng
    import loi_ky_thuat as LK   # lỗi kỹ thuật (tải hỏng, quá giờ…) → thử lại tại chỗ; bị loại vì nội dung → bỏ (23/10/2026)
    def cong(x):
        if x.get("loi"): return
        x.pop("loi", None); cong1(x)
        for _ in range(LK.THU_LAI):
            if LK.ky_thuat(x.get("loi")) is not True: break
            print("thử lại cổng", x["creative_id"], str(x["loi"])[:80], flush=True); time.sleep(LK.NGHI); x.pop("loi", None); cong1(x)
    def cong1(x):   # cổng treo / đổ (TimeoutExpired…) thành lỗi kỹ thuật của đoạn, không kéo sập cả lô
        try: cong2(x)
        except Exception as e: x["loi"] = f"{type(e).__name__}: {str(e)[:150]}"
    def cong2(x):
        a = sh(f"{D}/kiem-studio.sh {x['creative_id']} {x['content_id']} < /dev/null", timeout=900).stdout.strip().splitlines()[-1:]
        b = sh(f"{D}/kiem-thoai-creative.sh {x['creative_id']} '{x['file'] if not str(x.get('file','')).startswith('box3:') else ''}' < /dev/null", timeout=1800)
        if not (a and a[0].startswith("STUDIO OK")): x["loi"] = (a or ["studio ?"])[0]
        elif b.returncode != 0: x["loi"] = ((b.stdout.strip() or b.stderr.strip() or f"cổng chữ lỗi mã {b.returncode}").splitlines() or ["?"])[-1][:200]   # cổng chết không in gì (23/10/2026 lô moisom gãy cả lô vì [-1] của rỗng)
    dem = [0]
    def cong_bao(x): cong(x); dem[0] += 1; XG.bao("day", ma, f"cổng chữ · {x.get('ten', '')[:40]}", dem[0], len(lo))
    with ThreadPoolExecutor(4) as ex: list(ex.map(cong_bao, lo))
    dat = [str(x["creative_id"]) for x in lo if not x.get("loi")]
    if dat: print(sh(f"ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 kiem-cta.py --dat {' '.join(dat)} lô {ma} qua cổng'").stdout.strip())
    # BẢN SỬA CHO NHÂN BẢN (anh 23/10/2026): creative cũ của camp_cu → creative mới vừa đạt → nhan-ban.py tự dùng khi nhân bản camp thắng CTA cũ
    cap = [f"{x['camp']}:{x['creative_id']}" for x in lo if not x.get("loi") and x.get("camp") and x.get("creative_id")]
    if cap: print(sh(f"ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 ghi-cta-thay.py --camp {' '.join(cap)}'").stdout.strip())
    out = [{"camp_cu": x.get("camp"), "content_id": x["content_id"], "creative_id": x.get("creative_id"), "lang": x["lang"], "lo": x.get("lo", ma),
            "ten": f"{x.get('lo', ma)} {ascii_(x['ten'])} {x['lang'].upper()} - {dang} {int(x['tu'])}-{int(x['den'])}s {ma}", "ok": not x.get("loi"), "loi": x.get("loi")} for x in lo]
    json.dump(out, open(f"{ra}/len.json", "w"), ensure_ascii=False, indent=1)
    # TỰ CHẤM CREATIVE MỚI (anh 25/10/2026: "các creative mới từ giờ có bước chấm tự động"): xếp hàng etp.cham_hang → Worker Cloudflare etp-cham chấm (mỗi phút).
    # CHỈ CHẤM — không chặn lên camp (anh: "chưa áp dụng vào camp hay rule nào hết").
    moi = [str(int(x["creative_id"])) for x in lo if not x.get("loi") and x.get("creative_id")]
    if moi:
        try: SD.sql(f"insert into etp.cham_hang (creative_id, nguon, ai) select unnest('{{{','.join(moi)}}}'::int[]), 'moi', 'len-creative {ma}' on conflict (creative_id) do nothing")
        except Exception as e: print("xếp hàng chấm lỗi:", e)
    # TỜ REVIEW CTA CỦA CẢ LÔ (anh 22/10/2026: "tao đang review thì mày phải chụp lại hết") — mỗi creative 2 ô: giữa video + thẻ cuối, 4 cột, 16 ô/tờ
    o = []
    for x in lo:
        if x.get("loi"): continue
        vf = (anh.get(x["ten_tep"][:-4]) or [None, None, None])[2] if x["file"].startswith("box3:") else x["file"]   # đoạn trên box3 → đọc bản trên kho (https)
        if not vf: continue
        d = float(sh(f"ffprobe -v error -show_entries format=duration -of csv=p=0 '{vf}'").stdout.strip() or 0)
        for k, arg in (("a", ["-ss", str(d * 0.5)]), ("b", ["-sseof", "-1.2"])):
            f = f"{ra}/rv-{x['creative_id']}-{k}.jpg"; subprocess.run(["ffmpeg", "-v", "error", "-y", *arg, "-i", vf, "-frames:v", "1", "-vf", "scale=300:534", f], check=True); o.append(f)
    for k in range(0, len(o), 16):
        t = o[k:k + 16]; fc = "".join(f"[{i}]" for i in range(len(t))) + f"xstack=inputs={len(t)}:layout=" + "|".join(f"{(i % 4) * 300}_{(i // 4) * 534}" for i in range(len(t))) + ":fill=black"
        f = f"{ra}/review-cta-{k // 16 + 1}.jpg"; subprocess.run(["ffmpeg", "-v", "error", "-y"] + sum([["-i", p] for p in t], []) + ["-filter_complex", fc, f], check=True)
        print("TỜ REVIEW (iMac):", f)
    for o in out: print(o["ok"], o["creative_id"], o["camp_cu"], o["ten"][:70], o["loi"] or "")
    # CẤT LÊN DRIVE (anh 28/10/2026 "phải lưu lên drive chứ? Sao cứ lưu hết ở iMac"): lô vừa lên xong = sự kiện cất — mọi tệp video / tiếng đã nằm yên ≥ 24 giờ
    # trong ~/.cache/ethopex chuyển sang Drive htuan82 (gdrive:ethopex-cache), giữ đường dẫn; cần lại thì dam_bao / keo_thu_muc tự kéo về. Mọi luồng (phim mới, sửa CTA,
    # thay creative bị từ chối, đợt phim mới) đều lên qua đây → một chỗ cất, không dựng vòng chạy theo giờ.
    # thu-vien-len (máy sinh KT, mỗi nhịp 5 phút) đặt ETP_KHONG_CAT=1: lượt quét Drive chạy > 36 phút giữ chân máy sinh (29/10/2026 — El gran tạo xong creative 16:06 mà
    # bị cắt ở 40 phút, chưa ghi vào thư viện). Không mất gì: mọi lô cắt khác vẫn quét tệp ≥ 24 giờ lên Drive ở lượt của chúng.
    if os.environ.get("ETP_KHONG_CAT") != "1": CD.cat("24h")

if __name__ == "__main__":
    main(*sys.argv[1:4])
