#!/usr/bin/env python3
"""CỔNG SOÁT THEO ĐOẠN (anh 24/10/2026: "xem lý do và cách chặn triệt để" — Meta từ chối creative #54964 Step Back góc mới 289–374s:
"Adult Sexual Exploitation … sexual violence"; đoạn có cảnh hồi tưởng gã đàn ông cưỡng ép cô gái trong hẻm, "Stop!", xé áo, cô ngồi khóc).
GỐC: soát 18+ (kiem-phim-18) duyệt theo PHIM, mà creative là ĐOẠN — góc mới / góc sửa CTA cắt thêm từ phim đã duyệt thì lên thẳng, không ai xem đoạn mới.
Luật: mọi đoạn đi qua len-creative.py phải có MỘT trong ba:
  (a) đã soát ok theo đoạn — studio xv_khoa_ngoai['ethopex_soat_doan'] {"<content>:<tu>-<den>": {ok, luc, ghi}}
  (b) lô đã soát tờ khung từng đoạn trước khi lên (dot-phim-moi / phim-moi gọi len-creative --da-soat) → ghi luôn (a)
  (c) đúng đoạn đó đang có creative Meta đã duyệt và đang giao (dựng lại CTA cùng đoạn)
Không có → GIỮ LẠI, không đẩy: tờ khung 30 ô ~/.cache/ethopex/cho-soat/<content>-<tu>-<den>.jpg (iMac) + hàng studio ['ethopex_cho_soat'].
Máy soát ngay bằng Claude API (anh duyệt 24/10/2026): ok → đẩy, cam → bỏ, không chắc → giữ cho Claude trong phiên / anh. Tiêu chí CẤM: khoả thân / gợi dục, ĐỤNG CHẠM / CƯỠNG ÉP TÌNH DỤC (kéo áo, đè, "Stop!", nạn nhân
khóc sau cảnh giằng co), bạo lực máu me, vũ khí chĩa người, tự hại. Một khung dính là cấm cả đoạn.
  python3 soat_doan.py ds                          → đoạn đang chờ soát + đường tờ khung
  python3 soat_doan.py ok|cam <khoá> … [--ghi "…"]  → ghi kết quả (cam: đoạn này không bao giờ được cắt lại — goc_moi / sua-cta tránh)
  python3 soat_doan.py lo <thư mục lô>             → soát cả lô bằng máy (Claude, chuỗi rẻ): in đoạn cấm / cần người xem kèm tờ 30 khung
  python3 soat_doan.py quet                        → rà soát mọi creative đang chạy chưa soát đoạn (video thành phẩm) → ghi sổ; cấm → thay creative ở camp mới
  python3 soat_doan.py len                         → đẩy các đoạn đã ok (len-creative) + nhân bản camp góc mới đang chờ (nhan-ban --lich today)
Chạy trên iMac."""
import datetime as dt, json, os, subprocess, sys, time
D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
CHO = os.path.join(C, "cho-soat")
vn = lambda: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")

TREN_BOX = bool(os.environ.get("DATABASE_URL"))   # chạy ngay trên box3 (quet song song, anh 25/10/2026): psql / Claude gọi tại chỗ, không ssh vòng
def sql(cau):
    lenh = ["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"] if TREN_BOX else ["ssh", "-o", "ConnectTimeout=15", B, f'{ENV}; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -']
    r = subprocess.run(lenh, input=cau, capture_output=True, text=True, timeout=120)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def khoa(ten): return json.loads(sql(f"select coalesce(gia_tri, '{{}}'::jsonb)::text from xv_khoa_ngoai where ten='{ten}'") or "{}")
def gop(ten, moi):
    v = json.dumps(moi, ensure_ascii=False).replace("$J$", "")
    sql(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('{ten}', $J${v}$J$::jsonb) on conflict (ten) do update set gia_tri = coalesce(xv_khoa_ngoai.gia_tri, '{{}}'::jsonb) || excluded.gia_tri")
def bo(ten, ks):
    if ks: sql(f"update xv_khoa_ngoai set gia_tri = gia_tri - array[{','.join(repr(str(k)) for k in ks)}] where ten='{ten}'")

def khoa_doan(x): return f"{int(x['content_id'])}:{int(round(float(x['tu'])))}-{int(round(float(x['den'])))}"

def cam_cua(cid):
    """khoảng (tu, den) của phim không được cắt lại: đoạn soát cấm + đoạn Meta đã từ chối (etp.creative.tu_choi)"""
    s = khoa("ethopex_soat_doan"); ra = []
    for k, v in s.items():
        c, td = k.split(":"); t, d = td.split("-")
        if c == str(cid) and v.get("ok") is False: ra.append((float(t), float(d)))
    for l in sql(f"select tu, den from etp.creative where content_id = {int(cid)} and tu_choi is not null and tu is not null").splitlines():
        t, d = l.split("|"); ra.append((float(t), float(d)))
    return ra

def meta_duyet(cids):
    """{khoá đoạn} có creative không bị từ chối đang giao ở ít nhất một camp (Meta đã duyệt nội dung đúng đoạn này)"""
    if not cids: return set()
    r = sql(f"""select distinct c.content_id || ':' || round(c.tu) || '-' || round(c.den) from etp.creative c join etp.camp k on k.creative_id = c.creative_id
               where c.content_id in ({','.join(str(int(x)) for x in cids)}) and c.tu_choi is null and k.giao = 'ACTIVE' and c.tu is not null""")
    return set(r.splitlines())

def to_khung(f, k):
    os.makedirs(CHO, exist_ok=True); o = os.path.join(CHO, k.replace(":", "-") + ".jpg")
    if f.startswith("box3:"): return None
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip() or 90)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-vf", f"fps=30/{d},scale=200:-2,tile=6x5", "-frames:v", "1", o], check=False)
    return o if os.path.exists(o) else None

# MÁY SOÁT BẰNG CLAUDE (anh duyệt 24/10/2026: "Cho gọi Claude API", ~$0,005/đoạn): tờ khung 30 ô → ok / cam / xem. Chỉ "ok" chắc chắn mới cho qua;
# "xem" (không chắc) giữ lại cho Claude trong phiên / anh. Khoá ANTHROPIC_API_KEY chỉ có trên box3 → iMac gửi tờ khung sang box3 gọi.
# Chuỗi rẻ trước (anh 24/10/2026: "API phải chạy qua fallback từ các nguồn rẻ trước") — cùng thứ tự claude.ts › duongChu của studio:
# ckey (người bán trên chợ, ~30–125₫/lượt) → ShopAIKey (~315₫) → Anthropic trực tiếp (~2.500₫). Đường nào lỗi / trả sai khuôn → đường sau.
MO_HINH = "claude-sonnet-5-5"
CKEY = ["duc121026ab/claude-sonnet-5-5", "thanhnhan9023/claude-sonnet-5.5"]   # = CKEY_CLAUDE['claude-sonnet-5-5'] trong claude.ts
HOI = ("You review a contact sheet (30 frames, in order) cut from a short drama, to be used as a Facebook/Instagram video ad. "
       "Decide if Meta would reject it under Adult Nudity / Adult Sexual Exploitation / Violent or Graphic Content / Dangerous content. "
       "BAN (cam) if ANY frame shows: nudity or exposed intimate parts; sexual acts or strongly sexualised posing; non-consensual or forced sexual touching, "
       "a man grabbing / pinning / tearing clothes of a woman, a victim crying or disheveled right after a struggle, any suggested sexual threat; "
       "a person cornered / pressed against a wall or door while someone leans in face-to-face inches away or touches them (Meta reads it as sexual); "
       "sheer / see-through / lingerie-like clothing in close-up; "
       "blood, gore, injuries; a weapon pointed at a person or used; self-harm; drug use. "
       "Ordinary drama (arguments, slaps without blood, kneeling, crying from sadness, kissing fully clothed, business suits, parties) is OK. "
       "If unsure, answer 'xem'. Reply ONLY JSON: {\"ket\": \"ok\"|\"cam\"|\"xem\", \"ly\": \"<short reason in Vietnamese, name the frame>\"}")

def goi_claude(jpg, hoi, max_tokens=300, kiem=None):
    """chạy TRÊN BOX3: một tờ khung + câu hỏi → (JSON trả về, đường đã dùng) qua chuỗi rẻ ckey → ShopAIKey → Anthropic.
    kiem(j) ném lỗi khi JSON sai khuôn → thử đường sau. Mọi đường lỗi → RuntimeError (người gọi quyết định giữ lại)."""
    import base64, urllib.request
    b64 = base64.b64encode(open(jpg, "rb").read()).decode()
    nd = [{"role": "user", "content": [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}}, {"type": "text", "text": hoi}]}]
    e = os.environ; duong = []
    if e.get("CKEY_API_KEY"): duong += [("ckey", "https://api.xah.io/v1/messages", e["CKEY_API_KEY"], m) for m in CKEY]
    if e.get("SHOPAIKEY_API_KEY"): duong.append(("shopaikey", "https://api.shopaikey.com/v1/messages", e["SHOPAIKEY_API_KEY"], MO_HINH))
    if e.get("ANTHROPIC_API_KEY"): duong.append(("anthropic", "https://api.anthropic.com/v1/messages", e["ANTHROPIC_API_KEY"], MO_HINH))
    loi = []
    for ten, url, k, m in duong:
        try:
            h = {"x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json"}
            if ten != "anthropic": h["authorization"] = "Bearer " + k
            r = urllib.request.Request(url, data=json.dumps({"model": m, "max_tokens": max_tokens, "messages": nd}).encode(), method="POST", headers=h)
            t = "".join(b.get("text", "") for b in json.load(urllib.request.urlopen(r, timeout=180)).get("content", []) if b.get("type") == "text")
            j = json.loads(t[t.index("{"): t.rindex("}") + 1])
            if kiem: kiem(j)
            return j, f"{ten}:{m}"
        except Exception as x: loi.append(f"{ten} {m}: {type(x).__name__} {str(x)[:80]}")
    raise RuntimeError("mọi đường Claude lỗi — " + " | ".join(loi)[:300])

def ai_box(jpg):
    """chạy TRÊN BOX3: soát một tờ khung → {ket, ly, duong}"""
    def kiem(j):
        if j.get("ket") not in ("ok", "cam", "xem"): raise ValueError(f"khuôn sai: {str(j)[:80]}")
    try: j, d = goi_claude(jpg, HOI, 300, kiem)
    except RuntimeError as e: return {"ket": "xem", "ly": str(e), "duong": None}
    return {"ket": j["ket"], "ly": str(j.get("ly", ""))[:200], "duong": d}

def ai(to):
    """từ iMac: gửi tờ khung sang box3, gọi ai_box → {ket, ly}; lỗi thì 'xem' (giữ lại)"""
    if not to or not os.path.exists(to): return {"ket": "xem", "ly": "không có tờ khung"}
    if TREN_BOX:
        try: return ai_box(to)
        except Exception as e: return {"ket": "xem", "ly": f"máy soát lỗi: {type(e).__name__}: {str(e)[:100]}"}
    try:
        dich = f"/root/etp-soat/{os.path.basename(to)}"
        subprocess.run(["ssh", B, "mkdir -p /root/etp-soat"], check=True, timeout=60); subprocess.run(["scp", "-q", to, f"{B}:{dich}"], check=True, timeout=300)
        r = subprocess.run(["ssh", B, f"{ENV}; cd apps/xuong-video/scripts/ethopex && python3 soat_doan.py ai-box {dich}"], capture_output=True, text=True, timeout=300)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e: return {"ket": "xem", "ly": f"máy soát lỗi: {type(e).__name__}: {str(e)[:100]}"}

def loc(lo, ma, dang, da_soat=False):
    """cổng cho len-creative: → (đoạn được đẩy, số đoạn giữ lại chờ soát). Đoạn soát cấm thì bỏ hẳn (x['loi'])."""
    s = khoa("ethopex_soat_doan"); duyet = meta_duyet({x["content_id"] for x in lo}); di, giu, ghi = [], {}, {}
    for x in lo:
        k = khoa_doan(x); v = s.get(k)
        if v and v.get("ok") is False: print(f"SOÁT ĐOẠN: {k} đã bị cấm ({v.get('ghi', '')[:80]}) — bỏ", flush=True)   # cấm thắng cả --da-soat (25/10/2026)
        # --da-soat KHÔNG còn cho qua đoạn chưa có kết quả soát (25/10/2026: đoạn 165796 1078s bị cắt lại sau lượt máy soát, cờ này
        # ghi "ok" đè lên mà chưa ai xem → Meta từ chối "gợi dục"). Đoạn nào chưa có dòng soát đều qua máy soát Claude bên dưới.
        elif (v and v.get("ok")) or k in duyet: di.append(x)
        else: giu[k] = {"x": x, "ma": ma, "dang": dang, "to": to_khung(x["file"], k), "luc": vn()}
    for k in list(giu):   # máy soát ngay: ok → đẩy luôn lượt này, cam → bỏ, xem → giữ chờ người
        kq = ai(giu[k]["to"]); print(f"SOÁT ĐOẠN (Claude {kq.get('duong')}): {k} → {kq['ket']} · {kq['ly']}", flush=True)
        if kq["ket"] == "xem": giu[k]["may"] = kq["ly"]; continue
        ghi[k] = {"ok": kq["ket"] == "ok", "luc": vn(), "ghi": f"máy soát Claude: {kq['ly']}"}
        if kq["ket"] == "ok": di.append(giu[k]["x"])
        del giu[k]
    if ghi: gop("ethopex_soat_doan", ghi)
    if giu:
        gop("ethopex_cho_soat", giu)
        for k, v in giu.items(): print(f"SOÁT ĐOẠN: {k} chưa soát — GIỮ LẠI, chưa đẩy · tờ khung (iMac): {v['to']}", flush=True)
    return di, len(giu)

def main(a):
    lenh = a[0] if a else "ds"
    if lenh == "ai-box": print(json.dumps(ai_box(a[1]), ensure_ascii=False)); return
    if lenh == "lo":   # soát cả lô bằng máy (anh duyệt Claude API 24/10/2026): mọi đoạn trong <lô>/lo.json → tờ 30 khung → ok / cam / xem, ghi ethopex_soat_doan
        from concurrent.futures import ThreadPoolExecutor
        lo_dir = a[1]; lo = [x for x in json.load(open(os.path.join(lo_dir, "lo.json"))) if x.get("file") and not x.get("loi") and os.path.exists(x["file"])]
        s = khoa("ethopex_soat_doan"); viec = [x for x in lo if not s.get(khoa_doan(x))]
        def mot(x):
            k = khoa_doan(x); kq = ai(to_khung(x["file"], k)); return k, kq, x
        kq_all = list(ThreadPoolExecutor(4).map(mot, viec)); ghi = {}; tong = {"ok": 0, "cam": 0, "xem": 0}
        for k, kq, x in kq_all:
            tong[kq["ket"]] += 1
            if kq["ket"] != "xem": ghi[k] = {"ok": kq["ket"] == "ok", "luc": vn(), "ghi": f"máy soát Claude ({kq.get('duong')}): {kq['ly']}"}
            if kq["ket"] != "ok": print(f"{kq['ket'].upper()} {k} · {x.get('ten', '')[:40]} · {kq['ly'][:160]} · tờ (iMac): {os.path.join(CHO, k.replace(':', '-') + '.jpg')}", flush=True)
        if ghi: gop("ethopex_soat_doan", ghi)
        print(f"soát lô {lo_dir}: {len(viec)} đoạn soát mới ({len(lo) - len(viec)} đã có) → ok {tong['ok']} · cấm {tong['cam']} · cần người xem {tong['xem']}"); return
    if lenh == "quet":   # RÀ SOÁT MỌI CREATIVE ĐANG CHẠY (anh 25/10/2026: "dừng lên camp mới đến khi rà soát hết các creative"): creative của camp đang chạy /
        # đang chờ Meta duyệt / bị từ chối mà đoạn chưa có dòng soát → tờ 30 khung từ video thành phẩm → máy soát (Claude, chuỗi rẻ) → ghi sổ; cấm → thay-tu-choi
        from concurrent.futures import ThreadPoolExecutor
        r = sql("""select distinct c.creative_id, c.doan, c.video from etp.camp k join etp.creative c on c.creative_id = k.creative_id
                   where (k.trang_thai = 'ACTIVE' or k.giao in ('IN_PROCESS', 'DISAPPROVED')) and c.doan is not null and c.video is not null
                     and c.doan not in (select jsonb_object_keys(gia_tri) from xv_khoa_ngoai where ten = 'ethopex_soat_doan')""")
        viec = [l.split("|") for l in r.splitlines() if l.count("|") == 2]
        if "--phan" in a:   # chia việc cho nhiều máy chạy song song: --phan i/n lấy creative có id % n == i (iMac 0/2, box3 1/2)
            i, n = map(int, a[a.index("--phan") + 1].split("/")); viec = [x for x in viec if int(x[0]) % n == i]
        luong = int(a[a.index("--luong") + 1]) if "--luong" in a else 6
        print(f"rà soát {len(viec)} creative đang chạy chưa soát đoạn", flush=True)
        # BÁO THỜI GIAN THỰC (anh 25/10/2026: "khi quét thì phải báo thời gian thực lên etp.on.tc/?t=creative&v=soat"): mỗi đoạn xong ghi ngay sổ soát đoạn
        # + tiến độ máy này vào xv_khoa_ngoai['ethopex_quet'][<máy>] {tong, xong, ok, cam, xem, bat_dau, cap_nhat, dang, cuoi}; trang tự làm mới 5 giây khi đang quét
        import socket, threading
        may = "box3" if TREN_BOX else socket.gethostname().split(".")[0]; khoa_lk = threading.Lock(); cam = []
        td = {"tong": len(viec), "xong": 0, "ok": 0, "cam": 0, "xem": 0, "bat_dau": vn(), "cap_nhat": vn(), "dang": True, "cuoi": ""}
        gop("ethopex_quet", {may: td})
        def mot(x):
            cr, k, v = x; kq = ai(to_khung(v, k))
            with khoa_lk:
                td["xong"] += 1; td[kq["ket"]] += 1; td["cap_nhat"] = vn(); td["cuoi"] = f"#{cr} {kq['ket']}: {kq['ly'][:90]}"
                if kq["ket"] == "cam": cam.append(cr)
                if kq["ket"] != "ok": print(f"{kq['ket'].upper()} creative #{cr} đoạn {k} · {kq['ly'][:160]} · tờ ({may}): {os.path.join(CHO, k.replace(':', '-') + '.jpg')}", flush=True)
                moi = {"ok": kq["ket"] == "ok", "luc": vn(), "ghi": f"máy soát Claude ({kq.get('duong')}): {kq['ly']}"} if kq["ket"] != "xem" else None
                try:
                    if moi: gop("ethopex_soat_doan", {k: moi})
                    else: gop("ethopex_cho_soat", {k: {"x": {"content_id": int(k.split(":")[0]), "file": v, "tu": float(k.split(":")[1].split("-")[0]), "den": float(k.split("-")[-1])}, "ma": "quet", "dang": "canh cuoi", "to": to_khung(v, k), "luc": vn(), "may": kq["ly"], "creative": cr}})
                    gop("ethopex_quet", {may: td})
                except Exception as e: print("ghi lỗi:", e, flush=True)
        list(ThreadPoolExecutor(luong).map(mot, viec))
        td["dang"] = False; td["cap_nhat"] = vn(); gop("ethopex_quet", {may: td})
        print(f"rà soát xong ({may}): ok {td['ok']} · cấm {td['cam']} · cần người xem {td['xem']}", flush=True)
        # CHỈ CHẤM, KHÔNG ĐỤNG CAMP (anh 25/10/2026: "giờ chỉ làm hệ chấm điểm, chưa áp dụng vào camp hay rule nào hết")
        return
    if lenh == "ds":
        h = khoa("ethopex_cho_soat")
        for k, v in h.items(): print(k, "·", v["x"].get("ten", "")[:50], "·", v["dang"], "· lô", v["ma"], "· tờ khung (iMac):", v.get("to"))
        print(f"{len(h)} đoạn chờ soát")
    elif lenh in ("ok", "cam"):
        ghi = a[a.index("--ghi") + 1] if "--ghi" in a else ""
        ks = [x for x in a[1:] if ":" in x and x != ghi]
        gop("ethopex_soat_doan", {k: {"ok": lenh == "ok", "luc": vn(), "ghi": ghi or ("soát ok" if lenh == "ok" else "soát cấm")} for k in ks})
        if lenh == "cam": bo("ethopex_cho_soat", ks)
        print(f"đã ghi {lenh}: {', '.join(ks)}")
    elif lenh == "len":
        h, s = khoa("ethopex_cho_soat"), khoa("ethopex_soat_doan")
        san = {k: v for k, v in h.items() if (s.get(k) or {}).get("ok")}
        theo = {}
        for k, v in san.items(): theo.setdefault(v["dang"], []).append(v)
        for dang, ds in theo.items():
            ma = time.strftime("soat%d%m%H%M") + dang[:1]; lf = os.path.join(C, "ra", f"{ma}.json"); os.makedirs(os.path.dirname(lf), exist_ok=True)
            json.dump([v["x"] for v in ds], open(lf, "w"), ensure_ascii=False, indent=1)
            r = subprocess.run(["python3", f"{D}/len-creative.py", lf, ma, dang], capture_output=True, text=True, timeout=6 * 3600); print(r.stdout[-1200:], r.stderr[-300:])
            for goc in sorted({v["x"].get("goc") for v in ds if v["x"].get("goc")}):
                r = subprocess.run(["ssh", B, f"{ENV}; cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {int(goc)} --that --lich today --luat 'nhân bản camp thắng bằng GÓC MỚI (đã soát đoạn)' --ai 'máy (anh duyệt 23/10/2026: một đoạn tối đa 3 camp)'"], capture_output=True, text=True, timeout=600)
                print(f"nhân bản #{goc}:", (r.stdout.strip().splitlines() or [r.stderr.strip()[-150:]])[-1][:200])
        bo("ethopex_cho_soat", list(san)); print(f"đã đẩy {len(san)} đoạn đã soát")
        # camp đang bị Meta từ chối chờ góc mới (sua-cta xếp ethopex_cho_dung_lai tu_choi=true) → thay creative + bật lại ngay (anh 24/10/2026:
        # "báo xong thì phải có con phụ trách fix luôn creative … update + bật lại camp đó")
        cho = [v.get("goc") for v in khoa("ethopex_cho_dung_lai").values() if v.get("tu_choi") and v.get("goc")]
        if cho:
            r = subprocess.run(["ssh", B, f"{ENV}; cd apps/xuong-video/scripts/ethopex && python3 thay-tu-choi.py --camp {' '.join(str(int(c)) for c in cho)}"], capture_output=True, text=True, timeout=900)
            print(r.stdout[-1500:], r.stderr[-300:])

if __name__ == "__main__": main(sys.argv[1:])
