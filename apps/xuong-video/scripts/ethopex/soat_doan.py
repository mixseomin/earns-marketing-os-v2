#!/usr/bin/env python3
"""CỔNG SOÁT THEO ĐOẠN (anh 24/10/2026: "xem lý do và cách chặn triệt để" — Meta từ chối creative #54964 Step Back góc mới 289–374s:
"Adult Sexual Exploitation … sexual violence"; đoạn có cảnh hồi tưởng gã đàn ông cưỡng ép cô gái trong hẻm, "Stop!", xé áo, cô ngồi khóc).
GỐC: soát 18+ (kiem-phim-18) duyệt theo PHIM, mà creative là ĐOẠN — góc mới / góc sửa CTA cắt thêm từ phim đã duyệt thì lên thẳng, không ai xem đoạn mới.
Luật: mọi đoạn đi qua len-creative.py phải có MỘT trong ba:
  (a) đã soát ok theo đoạn — studio xv_khoa_ngoai['ethopex_soat_doan'] {"<content>:<tu>-<den>": {ok, luc, ghi}}
  (b) lô đã soát tờ khung từng đoạn trước khi lên (dot-phim-moi / phim-moi gọi len-creative --da-soat) → ghi luôn (a)
  (c) đúng đoạn đó đang có creative Meta đã duyệt và đang giao (dựng lại CTA cùng đoạn)
Không có → GIỮ LẠI, không đẩy: tờ khung 30 ô ~/.cache/ethopex/cho-soat/<content>-<tu>-<den>.jpg (iMac) + hàng studio ['ethopex_cho_soat'].
Soát (Claude xem trong phiên, không gọi API trả tiền) — CẤM khi có: khoả thân / gợi dục, ĐỤNG CHẠM / CƯỠNG ÉP TÌNH DỤC (kéo áo, đè, "Stop!", nạn nhân
khóc sau cảnh giằng co), bạo lực máu me, vũ khí chĩa người, tự hại. Một khung dính là cấm cả đoạn.
  python3 soat_doan.py ds                          → đoạn đang chờ soát + đường tờ khung
  python3 soat_doan.py ok|cam <khoá> … [--ghi "…"]  → ghi kết quả (cam: đoạn này không bao giờ được cắt lại — goc_moi / sua-cta tránh)
  python3 soat_doan.py len                         → đẩy các đoạn đã ok (len-creative) + nhân bản camp góc mới đang chờ (nhan-ban --lich today)
Chạy trên iMac."""
import datetime as dt, json, os, subprocess, sys, time
D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
CHO = os.path.join(C, "cho-soat")
vn = lambda: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")

def sql(cau):
    r = subprocess.run(["ssh", "-o", "ConnectTimeout=15", B, f'{ENV}; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -'], input=cau, capture_output=True, text=True, timeout=120)
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

def loc(lo, ma, dang, da_soat=False):
    """cổng cho len-creative: → (đoạn được đẩy, số đoạn giữ lại chờ soát). Đoạn soát cấm thì bỏ hẳn (x['loi'])."""
    s = khoa("ethopex_soat_doan"); duyet = meta_duyet({x["content_id"] for x in lo}); di, giu, ghi = [], {}, {}
    for x in lo:
        k = khoa_doan(x); v = s.get(k)
        if da_soat: ghi[k] = {"ok": True, "luc": vn(), "ghi": f"soát tờ khung theo lô {ma}"}; di.append(x)
        elif v and v.get("ok") is False: print(f"SOÁT ĐOẠN: {k} đã bị cấm ({v.get('ghi', '')[:80]}) — bỏ", flush=True)
        elif (v and v.get("ok")) or k in duyet: di.append(x)
        else: giu[k] = {"x": x, "ma": ma, "dang": dang, "to": to_khung(x["file"], k), "luc": vn()}
    if ghi: gop("ethopex_soat_doan", ghi)
    if giu:
        gop("ethopex_cho_soat", giu)
        for k, v in giu.items(): print(f"SOÁT ĐOẠN: {k} chưa soát — GIỮ LẠI, chưa đẩy · tờ khung (iMac): {v['to']}", flush=True)
    return di, len(giu)

def main(a):
    lenh = a[0] if a else "ds"
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
