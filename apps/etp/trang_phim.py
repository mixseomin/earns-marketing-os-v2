#!/usr/bin/env python3
"""TRANG PHIM TRONG WORKSPACE ETHOPEX → etp.trang_phim (anh 02/11/2026: "Đồng bộ và làm theo đề xuất vào đây" — tab Phim etp.on.tc).
Phim phải được "thêm content" vào workspace của người chạy thì camp mới có trang đích; Ethopex tự sinh mô tả + cốt truyện nhưng có lúc trượt.
  · danh sách: GET api-multi-be /api/v2/movie/contents (mọi trang, 100/trang — nhà + Sơn + Kiên cùng workspace)
  · chi tiết (description / storyline): chỉ bản mới, bản đổi updated_at, hoặc bản còn thiếu mô tả (Ethopex sinh trễ) — tối đa CHI_TIET / lượt
  · link tập 1 = theo chuỗi trang của bản: detail.redirect_url là link ngoài thì lấy luôn, là tên trang con (review / trailer) thì lấy redirect_url của trang
    con đó (/pages); danh sách chỉ có link khi trang con tên review — 36/489 bản (02/11) chỉ có link ở trang trailer
  · bản chưa đọc chi tiết: mô tả / cốt truyện NULL = chưa biết (không tính thiếu, cổng nhan-ban không chặn) — chạy tay --het đọc lại mọi bản
  · link tập 1: GET trang ReelShort / NetShort / DramaBox; 404 / 410 = chết, 403 / 429 / lỗi mạng = chưa kiểm được (không chặn); kiểm lại mỗi KIEM_LAI giờ
CHỈ ĐỌC Ethopex — không gửi lệnh ghi nào. dong-bo.py gọi chay(q) mỗi lượt; chạy tay: python3 trang_phim.py"""
import json, os, sys, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
import datetime as dt

MB = "https://api-multi-be.ethopex.dev"
CHI_TIET, LINK, KIEM_LAI = 80, 60, 24
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"

def _doc(T, duong):
    r = urllib.request.Request(MB + duong, headers={"authorization": "Bearer " + T, "user-agent": "mos2-etp"})
    return json.load(urllib.request.urlopen(r, timeout=60))

def _link(url):
    """→ (ok, lỗi): True 2xx/3xx · False 404/410 · None kiểm không được. Không phải http (vd 'movie' = bước Movie có sẵn của Ethopex, phát ngay trên
    Ethopex) → None, ghi rõ, không chặn. Đường dẫn có dấu / chữ Nhật (NetShort es / ja) được mã hoá trước khi gọi."""
    if not url.startswith("http"): return (None, f"trang Ethopex: {url}")
    try:
        with urllib.request.urlopen(urllib.request.Request(urllib.parse.quote(url, safe=":/?&=%#@+,;~"), headers={"user-agent": UA}), timeout=20) as r: return (r.status < 400, None)
    except urllib.error.HTTPError as e: return (False, f"HTTP {e.code}") if e.code in (404, 410) else (None, f"HTTP {e.code}")
    except Exception as e: return (None, type(e).__name__)

def chay(q, T, het=False):
    ds, p = [], 1
    while True:
        r = _doc(T, f"/api/v2/movie/contents?page={p}&page_size=100"); d = r.get("data") or []; ds += d
        if len(d) < 100 or p >= 50: break
        p += 1
    # MỘT phim MỘT hàng: phim mới thêm giữa lúc đọc làm danh sách trôi → cùng content_id ở hai trang → upsert chết
    # "ON CONFLICT DO UPDATE command cannot affect row a second time" (05/11/2026 01:40) — giữ bản updated_at mới nhất
    gom = {}
    for x in ds:
        k = int(x["content_id"])
        if k not in gom or str(x.get("updated_at") or "") > str(gom[k].get("updated_at") or ""): gom[k] = x
    ds = list(gom.values())
    cu = {int(l.split("|")[0]): l.split("|")[1:] for l in q("select content_id, coalesce(sua::text, ''), coalesce(mo_ta::text, ''), coalesce(cot_truyen::text, ''), coalesce(redirect_url, '') from etp.trang_phim").splitlines() if l}
    # bản cần đọc chi tiết: mới · đổi updated_at · còn thiếu mô tả / cốt truyện (Ethopex sinh trễ)
    def can(x):
        c = cu.get(int(x["content_id"]))
        return not c or c[0][:19].replace(" ", "T") != str(x.get("updated_at") or "")[:19] or c[1] in ("0", "") or c[2] in ("0", "")
    doi = [x for x in ds if het or can(x)][:None if het else CHI_TIET]
    def ct(x):
        c = x["content_id"]
        try:
            it = _doc(T, f"/api/v2/movie/contents/{c}").get("item") or {}
            dr = str((_doc(T, f"/api/v2/movie/contents/{c}/detail").get("item") or {}).get("redirect_url") or "")
            pg = {str(p_.get("path")): p_.get("redirect_url") for p_ in (_doc(T, f"/api/v2/movie/contents/{c}/pages").get("data") or [])}
            it["_link"] = dr if dr.startswith("http") else (pg.get(dr) or x.get("redirect_url") or next((v for v in pg.values() if v), None) or "")
            return x, it
        except Exception: return x, None
    with ThreadPoolExecutor(8) as ex: chi = dict((int(x["content_id"]), it) for x, it in ex.map(ct, doi))
    now = dt.datetime.now(dt.timezone.utc)
    rows = []
    for x in ds:
        c, it = int(x["content_id"]), chi.get(int(x["content_id"]))
        old = cu.get(c)
        so_cu = lambda i: int(old[i]) if old and old[i] != "" else None
        mo_ta = len(it.get("description") or "") if it is not None else so_cu(1)
        ct_ = len(it.get("storyline") or "") if it is not None else so_cu(2)
        url = (it.get("_link") if it is not None else (old[3] if old else "")) or x.get("redirect_url") or ""
        rows.append({"content_id": c, "ref_id": x.get("ref_id"), "nguoi_id": x.get("user_id"), "nguoi": x.get("user_name"), "ten": x.get("title"), "locale": x.get("locale"),
                     "nguon": url.split("/")[2] if "//" in url else None, "redirect_url": url or None, "mo_ta": mo_ta, "cot_truyen": ct_,
                     "tom_tat": len(x.get("short_description") or ""), "anh": x.get("thumbnail") or None, "tao": x.get("created_at"), "sua": x.get("updated_at")})
    if not rows: return {"trang_phim": 0}
    j = json.dumps(rows, ensure_ascii=False).replace("$J$", "")
    cot = "content_id bigint, ref_id bigint, nguoi_id int, nguoi text, ten text, locale text, nguon text, redirect_url text, mo_ta int, cot_truyen int, tom_tat int, anh text, tao timestamptz, sua timestamptz"
    ten = [c.split()[0] for c in cot.split(", ")]
    q(f"""insert into etp.trang_phim ({', '.join(ten)}) select {', '.join(ten)} from jsonb_to_recordset($J${j}$J$::jsonb) as x({cot})
          on conflict (content_id) do update set {', '.join(f'{c} = excluded.{c}' for c in ten if c != 'content_id')},
          link_ok = case when etp.trang_phim.redirect_url is distinct from excluded.redirect_url then null else etp.trang_phim.link_ok end,
          link_luc = case when etp.trang_phim.redirect_url is distinct from excluded.redirect_url then null else etp.trang_phim.link_luc end, cap_nhat = now()""")
    # link tập 1: chưa kiểm hoặc quá KIEM_LAI giờ — bản mới nhất trước
    kiem = [l.split("|", 1) for l in q(f"""select content_id, redirect_url from etp.trang_phim where coalesce(redirect_url, '') <> ''
              and (link_luc is null or link_luc < now() - interval '{KIEM_LAI} hours') order by tao desc nulls last limit {LINK}""").splitlines() if "|" in l]
    with ThreadPoolExecutor(8) as ex: kq = list(ex.map(lambda r: (r[0], *_link(r[1])), kiem))
    if kq:
        jk = json.dumps([{"c": int(c), "ok": ok, "loi": loi} for c, ok, loi in kq])
        q(f"""update etp.trang_phim t set link_ok = x.ok, link_loi = x.loi, link_luc = now() from jsonb_to_recordset($J${jk}$J$::jsonb) as x(c bigint, ok boolean, loi text)
              where t.content_id = x.c""")
    return {"trang_phim": len(rows), "trang_phim_chi_tiet": len(doi), "trang_phim_link": len(kq), "trang_phim_link_chet": sum(1 for _, ok, _ in kq if ok is False)}

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import subprocess, ethopex_api as EA
    def q(s):
        r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=120)
        if r.returncode: raise RuntimeError(r.stderr[-300:])
        return r.stdout.strip()
    print(json.dumps(chay(q, EA.T_NHA, het="--het" in sys.argv)))
