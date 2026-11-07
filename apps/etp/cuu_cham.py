#!/usr/bin/env python3
"""CỨU CREATIVE BỊ CỔNG CHẤM CHẶN (anh 07/11/2026 "các chỗ kẹt này đang xử lý thế nào? Phải làm gì triệt để" → "làm cả 4").
Trước: creative bị cổng chấm chặn (etp.cham_cong.duoc_len = false) nằm mãi trong dòng "kẹt" của tab Camp cây — không máy nào đụng,
cat-bo-cham.py (anh 28/10/2026 "đoạn nào vi phạm chủ động cắt bỏ luôn") có mà không ai gọi.
Nay mỗi creative bị chặn (chưa có camp, chưa bị Meta từ chối, không chờ người duyệt) đi đúng MỘT đường, ghi etp.cuu_cham:
  1. bản cắt bỏ trước đó (là creative_moi của một dòng) mà vẫn trượt → 'bo' (mỗi creative chỉ cắt một lần, không vòng lặp)
  2. cat-bo-cham.xet: dính cả video / dính thẻ cuối / còn < 40% / thiếu dữ liệu khung → 'bo' kèm lý do (đã kết, rời danh sách kẹt)
  3. cắt được → cắt bỏ khung vi phạm (cat-bo-cham.mot, iMac) → len-creative.py (đủ cổng studio + chữ + CTA, xếp hàng chấm) → 'xong' + creative_moi
     → bản mới đi cổng chấm như mọi creative; sạch thì nằm trong kho "sẵn" (dong_phim.san_dung_lai / mo_rong / cho_len_v) để lên camp.
Chấm lại bản cắt là lượt AI (~38₫ / creative, đo 06–07/11/2026) → công tắc etp.cau_hinh.cuu_cham {bat, moi_luot}: bước 1–2 ($0) chạy cả khi tắt, bước 3 chỉ khi bat.
Máy dòng phim (dong_phim.py, iMac) gọi chay() mỗi 15 phút trong luồng riêng. Dùng tay (iMac): python3 cuu_cham.py [--kho] [--so N] [creative_id …]
  --kho: chỉ in sẽ làm gì · --so N: số creative cắt lượt này (ghi đè moi_luot, vẫn cần bat trừ khi chỉ định creative_id)"""
import importlib.util, json, os, subprocess, sys, time
R = os.path.dirname(os.path.abspath(__file__)); E = os.path.join(R, "..", "xuong-video", "scripts", "ethopex")
C = os.path.expanduser("~/.cache/ethopex")
B = "root@167.233.241.16"; ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
# dạng trong kho (etp.creative.dang) → nhãn không dấu len-creative ghi vào tên creative (dong-bo.DANG đọc ngược ra dạng)
NHAN = {"cảnh thật": "canh that", "cảnh cuối": "canh cuoi", "kể chuyện": "ke chuyen", "tập nguyên": "tap nguyen", "chọn phe": "chon phe", "bình luận": "binh luan",
        "ba khoảnh khắc": "ba khoanh khac", "trước sau": "truoc sau", "tin nhắn": "tin nhan", "ảnh tĩnh": "anh tinh", "team": "team"}
THU_TOI_DA = 3   # lỗi kỹ thuật: số lần thử lại
sys.path.insert(0, E); import loi_ky_thuat as LK

def sql(cau):
    r = subprocess.run(["ssh", "-o", "ConnectTimeout=15", B, f'{ENV}; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -'], input=cau, capture_output=True, text=True, timeout=180)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def s(v): return "null" if v is None else "$Q$" + str(v).replace("$Q$", "") + "$Q$"

KHO = """create table if not exists etp.cuu_cham (creative_id integer primary key, content_id integer,
           trang_thai text not null check (trang_thai in ('dang', 'xong', 'bo', 'loi')), ly_do text, creative_moi integer, lo text, lan integer not null default 0, luc timestamptz not null default now());
         create index if not exists etp_cuu_cham_moi on etp.cuu_cham (creative_moi);
         insert into etp.cau_hinh (khoa, gia_tri, ghi) values ('cuu_cham', '{"bat": false, "moi_luot": 10}'::jsonb,
           'cứu creative bị cổng chấm chặn (apps/etp/cuu_cham.py): bật · số creative cắt bỏ khung mỗi lượt 15 phút (mỗi bản chấm lại ~38₫)') on conflict (khoa) do nothing;"""

# creative bị chặn cần xét: một nguồn với danh sách kẹt (apps/web/src/lib/etp-doc.ts) — không camp, chưa bị Meta từ chối, không chờ người duyệt
CHAN = """from etp.cham_cong g join etp.creative r using (creative_id) join etp.cham h using (creative_id)
          where not g.duoc_len and g.cho_duyet is null and r.tu_choi is null and r.content_id is not null
            and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)"""

def cbc():
    sp = importlib.util.spec_from_file_location("cat_bo_cham", os.path.join(E, "cat-bo-cham.py")); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m

def ghi(cr, cid, tt, ly, moi=None, lo=None, tang=False):
    sql(f"""insert into etp.cuu_cham (creative_id, content_id, trang_thai, ly_do, creative_moi, lo, lan) values ({int(cr)}, {int(cid) if cid else 'null'}, '{tt}', {s((ly or '')[:300])}, {int(moi) if moi else 'null'}, {s(lo)}, {1 if tang else 0})
            on conflict (creative_id) do update set trang_thai = excluded.trang_thai, ly_do = excluded.ly_do, creative_moi = coalesce(excluded.creative_moi, etp.cuu_cham.creative_moi),
              lo = coalesce(excluded.lo, etp.cuu_cham.lo), lan = etp.cuu_cham.lan + excluded.lan, luc = now()""")

def chay(kho=False, so=None, chi=None):
    """một lượt. Trả câu tóm tắt cho nhật ký máy dòng phim."""
    sql(KHO)
    ch = {"bat": False, "moi_luot": 10, **json.loads(sql("select gia_tri::text from etp.cau_hinh where khoa = 'cuu_cham'") or "{}")}
    dk = f"and r.creative_id in ({','.join(str(int(x)) for x in chi)})" if chi else ""
    # bản mới đã có dạng nhãn không dấu → dong-bo tự gán; 'team' (không có trong dong-bo.DANG) thì giữ đúng dạng gốc
    if not kho: sql("update etp.creative r set dang = g.dang from etp.cuu_cham u join etp.creative g on g.creative_id = u.creative_id where r.creative_id = u.creative_moi and r.dang is null and g.dang is not null")
    ds = json.loads(sql(f"""select coalesce(json_agg(t), '[]') from (select r.creative_id, r.content_id, coalesce(r.dang, '') dang, u.trang_thai tt, u.lan,
            exists (select 1 from etp.cuu_cham x where x.creative_moi = r.creative_id) la_ban_cat,
            json_build_object('khung', h.khung, 'lop', h.lop->'anh', 'video', r.video) j, g.chan_boi
          {CHAN} {dk} and (u.creative_id is null or (u.trang_thai = 'loi' and u.lan < {THU_TOI_DA} and u.luc < now() - interval '1 hour')
                 or (u.trang_thai = 'dang' and u.luc < now() - interval '2 hours'))   -- 'dang' quá 2 giờ = máy chết giữa lượt (nạp lại mã / tắt máy) → làm lại
          order by r.creative_id desc) t""".replace("join etp.cham h using (creative_id)", "join etp.cham h using (creative_id) left join etp.cuu_cham u using (creative_id)")) or "[]")
    M = cbc(); bo, cat = [], []
    for x in ds:
        if x["la_ban_cat"]: bo.append((x, f"bản đã cắt bỏ khung mà vẫn trượt cổng chấm ({(x['chan_boi'] or '')[:120]}) — không cắt lần hai")); continue
        if "người duyệt" in (x["chan_boi"] or ""): bo.append((x, "người duyệt đã loại — không cắt lại bản người đã loại")); continue
        kh, loi = M.xet(x["j"] or {})
        if loi: bo.append((x, loi))
        else: cat.append(x)
    if kho:
        for x, ly in bo: print("BỎ", x["creative_id"], x["dang"], ly[:120])
        for x in cat: print("CẮT", x["creative_id"], x["dang"], (x["chan_boi"] or "")[:80])
        return f"chạy khô: {len(bo)} kết · {len(cat)} cắt được"
    for x, ly in bo: ghi(x["creative_id"], x["content_id"], "bo", ly)
    n = int(so if so is not None else ch["moi_luot"]) if (ch.get("bat") or chi) else 0
    lam = cat[:n]
    if not lam: return f"{len(bo)} creative kết (không cứu được) · {len(cat)} cắt được chờ" + ("" if ch.get("bat") else " (cuu_cham.bat = false)")
    ma = "cb" + time.strftime("%m%d%H%M"); ra = os.path.join(C, "ra", ma); os.makedirs(ra, exist_ok=True)
    for x in lam: ghi(x["creative_id"], x["content_id"], "dang", "đang cắt bỏ khung vi phạm", lo=ma)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(3) as ex: kq = list(ex.map(lambda x: (x, M.mot(x["creative_id"], ra)), lam))
    theo_dang = {}
    for x, k in kq:
        if not k.get("file"): ghi(x["creative_id"], x["content_id"], "bo" if not str(k.get("loi", "")).startswith("ffmpeg") else "loi", k.get("loi"), tang=True); continue
        theo_dang.setdefault(x["dang"], []).append(k)
    xong = 0
    for dang, lo in theo_dang.items():
        m2 = f"{ma}{list(theo_dang).index(dang)}"; d2 = os.path.join(C, "ra", m2); os.makedirs(d2, exist_ok=True)
        lf = os.path.join(d2, "cat.json"); json.dump(lo, open(lf, "w"), ensure_ascii=False, indent=1)
        # --da-soat: đoạn gốc đã qua soát + chấm; bản này chỉ BỎ bớt khung, không thêm hình mới — máy chấm vẫn chấm lại đủ
        r = subprocess.run(["python3", os.path.join(E, "len-creative.py"), lf, m2, NHAN.get(dang, "canh that"), "--da-soat"], capture_output=True, text=True, timeout=5400, env={**os.environ, "ETP_KHONG_CAT": "1"})
        lj = os.path.join(d2, "len.json"); vao = json.load(open(os.path.join(d2, "lo.json"))) if os.path.exists(os.path.join(d2, "lo.json")) else []
        ra_ = json.load(open(lj)) if os.path.exists(lj) else []
        da = set()
        for v, o in zip(vao, ra_):   # len-creative ghi lo.json + len.json cùng thứ tự (cùng danh sách lo)
            goc = v.get("cat_bo_tu"); da.add(goc)
            if o.get("ok") and o.get("creative_id"):
                ghi(goc, v["content_id"], "xong", f"đã cắt bỏ {', '.join(v.get('bo') or [])} → creative #{o['creative_id']} chờ chấm lại", moi=o["creative_id"], lo=m2); xong += 1
            else:   # cổng nội dung (thoại / studio) chặn = đã kết; chỉ lỗi kỹ thuật (tải, mạng, quá giờ) mới thử lại
                ly = str(o.get("loi") or "?"); kt = LK.ky_thuat(ly) is True
                ghi(goc, v["content_id"], "loi" if kt else "bo", f"bản cắt bỏ khung {'lỗi kỹ thuật' if kt else 'vẫn trượt cổng'}: {ly[:200]}", lo=m2, tang=True)
        for v in lo:
            if v["cat_bo_tu"] not in da: ghi(v["cat_bo_tu"], v["content_id"], "loi", f"len-creative không trả kết quả (mã {r.returncode}): {(r.stdout + r.stderr).strip()[-200:]}", lo=m2, tang=True)
    return f"{len(bo)} kết · cắt {len(lam)} → {xong} bản mới chờ chấm lại (~{xong * 38}₫) · còn {len(cat) - len(lam)} chờ lượt sau"

# DẠNG TRƯỢT (anh 07/11/2026, việc 3): phim mà phần lớn creative MỘT dạng trượt cổng chấm cùng MỘT tiêu chí (vd Vengeance of the Dragon Princess: 25/29 cảnh thật
# trượt meta.bao_luc) → cắt thêm dạng đó cũng trượt; dòng phim loại đó dừng ở bước Nhận và chuyển sang ảnh tĩnh (dong_phim.b_nhan).
TRUOT_N, TRUOT_TY = 5, 0.7
DANG_LOAI = {"CC": ["cảnh cuối"], "LT": ["cảnh thật", "tập nguyên"], "KT": ["kể chuyện"], "AT": ["ảnh tĩnh"]}
def xet_truot(dong):
    """[(dạng, chặn, đã chấm)] + chan_boi từng creative → (tiêu chí, số dính, số chặn, số chấm) nếu dạng trượt, không thì None. Hàm thuần — bài tự kiểm ở cuối tệp."""
    n, chan = len(dong), [c for c in dong if c]
    if n < TRUOT_N or len(chan) < TRUOT_TY * n: return None
    dem = {}
    for c in chan:
        for t in {p.strip().split(" ")[0] for p in c.split(",") if p.strip() and "." in p.strip().split(" ")[0]}: dem[t] = dem.get(t, 0) + 1
    if not dem: return None
    t, k = max(dem.items(), key=lambda a: a[1])
    return (t, k, len(chan), n) if k >= TRUOT_TY * len(chan) else None

def dang_truot(sql_, cid, loai):
    """phim + loại dòng → câu lý do nếu dạng của loại đó trượt cổng chấm (dùng sql của nơi gọi), không thì ''"""
    ds = DANG_LOAI.get(loai or "CC") or []
    if not ds: return ""
    # mỗi creative đã chấm một dòng: '-' = qua cổng, còn lại = chan_boi
    dong = sql_(f"""select case when g.duoc_len then '-' else coalesce(nullif(g.chan_boi, ''), '?') end from etp.cham_cong g join etp.creative r using (creative_id)
                where r.content_id = {int(cid)} and r.dang in ({','.join(s(d) for d in ds)}) and g.duoc_len is not null and g.cho_duyet is null""").splitlines()
    kq = xet_truot(["" if l.strip() == "-" else l for l in dong if l.strip()])
    if not kq: return ""
    t, k, c, n = kq
    return f"dạng {'/'.join(ds)} của phim trượt cổng chấm {c}/{n} bản, {k} bản cùng dính {t} — cắt thêm dạng này cũng trượt"

def _tu_kiem():
    assert xet_truot(["meta.bao_luc 3"] * 4) is None                                   # < 5 bản
    assert xet_truot(["meta.bao_luc 3, afs.an_toan 2"] * 5 + ["", ""]) == ("meta.bao_luc", 5, 5, 7)
    assert xet_truot(["meta.bao_luc 3"] * 3 + [""] * 3) is None                       # 50% chặn
    assert xet_truot(["meta.bao_luc 3", "meta.khoa_than 4", "afs.cta 2", "meta.ga_gam 3", "afs.chat_luong 4"]) is None   # chặn đủ nhưng mỗi bản một tiêu chí
    assert xet_truot(["người duyệt loại"] * 6) is None                                 # không phải tiêu chí chấm
    print("cuu_cham: 5 bài tự kiểm đạt")

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--tu-kiem" in a: _tu_kiem(); sys.exit()
    so = int(a[a.index("--so") + 1]) if "--so" in a else None
    chi = [int(x) for x in a if x.isdigit() and (so is None or x != str(so))]
    print(chay(kho="--kho" in a, so=so, chi=chi or None))
