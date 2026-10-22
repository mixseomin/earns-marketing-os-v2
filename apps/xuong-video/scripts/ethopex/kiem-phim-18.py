#!/usr/bin/env python3
"""CỔNG PHIM 18+ (anh 22/10/2026: "Dừng camp film này toàn bộ vì có cảnh 18+ nhạy cảm. Làm rule để chặn ko lên kiểu phim đó" — SIMP NO MORE #102995:
poster + cảnh dàn gái mặc hở, cốt truyện "hệ thống trả 100x tiền tiêu cho phụ nữ… bốn người đẹp quanh hắn").
Bộ phân loại ảnh của Mac không nhận ra hở hang (poster SIMP ra "people, suit, sky") nên cổng gồm ba lớp, đủ cả ba mới qua:
  (1) DANH SÁCH CẤM — studio xv_khoa_ngoai['ethopex_phim_cam'] {"<content_id>": {ly_do, luc}}
  (2) TỪ KHOÁ — tên phim + chữ QC của app gốc (spy, qc-spy-phim.sql) dính từ khoá gợi dục / dàn gái → chặn
  (3) ĐÃ SOÁT HÌNH — xv_khoa_ngoai['ethopex_soat_18'] {"<content_id>": {ok, luc, ghi}}: Claude xem poster + tờ khung đoạn cắt TRƯỚC camp đầu tiên của phim
      (xem trong phiên, không gọi API trả tiền). Chưa có bản ghi = chặn; ok=false = chặn và đưa vào danh sách cấm.
Gọi ở: dung-camp.sh (cổng trước Publish) · nhan-ban.py (nhân bản + camp góc mới, kể cả luật NB tự chạy).
Chạy trên box3 (studio DB + DB spy ở /root/.secrets/spy.env):
  python3 kiem-phim-18.py <content_id>                     → in "PHIM18 OK…" (mã 0) / "PHIM18 CHAN: …" (mã 2)
  python3 kiem-phim-18.py --soat <content_id> ok|cam "<ghi chú>"   → ghi kết quả soát hình (cam = kèm thêm vào danh sách cấm)
  python3 kiem-phim-18.py --cam <content_id> "<lý do>"     → thêm vào danh sách cấm
  python3 kiem-phim-18.py --tu-kiem                        → bài tự kiểm bộ từ khoá"""
import datetime as dt, json, os, re, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
# Gợi dục / dàn gái. Không đưa từ phổ biến của phim ngắn (affair, lover, divorce, mistress của truyện ngoại tình…) để khỏi chặn oan cả kho.
TU = re.compile(r"\bsimps?\b|harem|har[eé]n\b|seduc|\blust|lujuria|\bsexy\b|erotic|er[oó]tic|lingerie|lencer[ií]a|\bnaked\b|\bnude\b|desnud|stripper|"
                r"one[- ]night stand|sugar (?:daddy|baby)|playboy|irresistible (?:wom|girl|beaut)|(?:four|five|six|seven|nine|\d+) (?:beautiful |gorgeous |hot |irresistible )?(?:women|wives|girls|beauties) (?:in his|around him|fall for)|"
                r"bed partner|steamy|\bspicy\b|hook ?up|sleep(?:s|ing)? with (?:him|her|me)|slept with|"
                r"(?:pays?|reward(?:s|ed)?) (?:him )?\d+x[^.]{0,40}(?:women|girls)", re.I)
now = lambda: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")

def q(s, db=None):
    return subprocess.run(["psql", db or os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
def doc(ten):
    return json.loads(q(f"select gia_tri::text from xv_khoa_ngoai where ten='{ten}'") or "{}")
def ghi(ten, k, v):
    j = json.dumps(v, ensure_ascii=False).replace("'", "''")
    q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('{ten}', '{{}}'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{k}', '{j}'::jsonb) where ten = '{ten}'")

def spy_db():
    for l in open("/root/.secrets/spy.env"):
        l = l.strip().removeprefix("export ")
        if l.startswith("DATABASE_URL="): return l.split("=", 1)[1].strip().strip('"')

def chu_phim(cid):
    """tên phim + chữ QC app gốc (bỏ trùng). Bỏ đoạn chữ nhắc TÊN PHIM KHÁC trong kho — NetShort ghép QC theo tên landing nên spy hay gắn nhầm
    (22/10/2026: chữ QC của SIMP NO MORE nằm dưới 'Seven Five-Star Generals' và 'Billionaire's Illegal Obsession' → chặn oan)."""
    db = spy_db(); ten = q(f"select ten from ethopex_content where id={int(cid)}", db) or ""
    khac = [t.lower() for t in q(f"select distinct ten from ethopex_content where id<>{int(cid)} and length(ten) >= 12", db).splitlines() if t.lower() not in ten.lower()]
    r = subprocess.run(["psql", db, "-v", f"ids={int(cid)}", "-tA", "-F", "\t", "-f", os.path.join(D, "qc-spy-phim.sql")], capture_output=True, text=True).stdout
    chu = list(dict.fromkeys(x.split("\t")[6] for x in r.splitlines() if len(x.split("\t")) > 6))
    return ten, [c for c in chu if not any(k in c.lower() for k in khac)]

def kiem(cid):
    cid = str(int(cid))
    cam = doc("ethopex_phim_cam")
    if cid in cam: return f"phim {cid} trong danh sách cấm 18+ ({cam[cid].get('ly_do')}, {cam[cid].get('luc')})"
    ten, chu = chu_phim(cid)
    for t in [ten or ""] + chu:
        m = TU.search(t)
        if m: return f"phim {cid} '{ten}' dính từ khoá 18+ '{m.group(0)}' — «{t[max(0, m.start() - 60):m.end() + 60]}»"
    s = doc("ethopex_soat_18").get(cid)
    if not s: return f"phim {cid} '{ten}' CHƯA SOÁT HÌNH 18+ — xem poster + tờ khung đoạn cắt rồi ghi: kiem-phim-18.py --soat {cid} ok|cam \"…\""
    if not s.get("ok"): return f"phim {cid} soát hình KHÔNG ĐẠT ({s.get('ghi')}, {s.get('luc')})"
    return None

def tu_kiem():
    chan = ["After serving three years… a system that pays him 100x every dollar he spends on women. With revenge, limitless wealth and four irresistible women in his orbit",
            "SIMP NO MORE", "Her steamy one-night stand with the CEO", "El millonario y su harén", "Sugar Daddy's Secret Deal", "She was hired to seduce the heir"]
    qua = ["Votos destrozados", "Abandoned at birth, true Athenian Princess Callista returns 20 years later with divine power",
           "My Cheating Wife's Downfall", "Every member of the Stone family is brilliant, yet youngest daughter Ivy Stone is written off as a fool",
           "The Billionaire's Illegal Obsession", "After dying in prison for a crime she didn't commit, top medical student Leia Sutton wakes up",
           "Legendary racer Ethan Kingsley hides his identity as Phantom to support his wife Claire’s auto company for five years"]
    sai = [t for t in chan if not TU.search(t)] + [t for t in qua if TU.search(t)]
    print(f"kiem-phim-18 tự kiểm: {len(chan) + len(qua) - len(sai)}/{len(chan) + len(qua)}" + ("" if not sai else f" — SAI: {sai}"))
    return not sai

if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--tu-kiem"]: sys.exit(0 if tu_kiem() else 1)
    if a[:1] == ["--soat"]:
        cid, kq, gc = str(int(a[1])), a[2], (a[3] if len(a) > 3 else "")
        ghi("ethopex_soat_18", cid, {"ok": kq == "ok", "luc": now(), "ghi": gc})
        if kq != "ok": ghi("ethopex_phim_cam", cid, {"ly_do": gc or "soát hình 18+ không đạt", "luc": now()})
        print(f"đã ghi soát 18+ phim {cid}: {kq}"); sys.exit(0)
    if a[:1] == ["--cam"]:
        ghi("ethopex_phim_cam", str(int(a[1])), {"ly_do": a[2] if len(a) > 2 else "18+", "luc": now()}); print(f"đã cấm phim {a[1]}"); sys.exit(0)
    loi = kiem(a[0])
    print(f"PHIM18 CHAN: {loi}" if loi else f"PHIM18 OK: phim {a[0]} không trong danh sách cấm, không dính từ khoá, đã soát hình")
    sys.exit(2 if loi else 0)
