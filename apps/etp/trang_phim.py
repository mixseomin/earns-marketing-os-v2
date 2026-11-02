#!/usr/bin/env python3
"""TRANG PHIM TRONG WORKSPACE ETHOPEX → etp.trang_phim (anh 02/11/2026: "Đồng bộ và làm theo đề xuất vào đây" — tab Phim etp.on.tc).
Phim phải được "thêm content" vào workspace của người chạy thì camp mới có trang đích; Ethopex tự sinh mô tả + cốt truyện nhưng có lúc trượt.
  · danh sách: GET api-multi-be /api/v2/movie/contents (mọi trang, 100/trang — nhà + Sơn + Kiên cùng workspace)
  · chi tiết (description / storyline): chỉ bản mới, bản đổi updated_at, hoặc bản còn thiếu mô tả (Ethopex sinh trễ) — tối đa CHI_TIET / lượt
  · link tập 1: GET trang ReelShort / NetShort / DramaBox; 404 / 410 = chết, 403 / 429 / lỗi mạng = chưa kiểm được (không chặn); kiểm lại mỗi KIEM_LAI giờ
CHỈ ĐỌC Ethopex — không gửi lệnh ghi nào. dong-bo.py gọi chay(q) mỗi lượt; chạy tay: python3 trang_phim.py"""
import json, os, sys, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
import datetime as dt

MB = "https://api-multi-be.ethopex.dev"
CHI_TIET, LINK, KIEM_LAI = 80, 60, 24
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"

def _doc(T, duong):
    r = urllib.request.Request(MB + duong, headers={"authorization": "Bearer " + T, "user-agent": "mos2-etp"})
    return json.load(urllib.request.urlopen(r, timeout=60))

def _link(url):
    """→ (ok, lỗi): True 2xx/3xx · False 404/410 · None kiểm không được"""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": UA}), timeout=20) as r: return (r.status < 400, None)
    except urllib.error.HTTPError as e: return (False, f"HTTP {e.code}") if e.code in (404, 410) else (None, f"HTTP {e.code}")
    except Exception as e: return (None, type(e).__name__)

def chay(q, T):
    ds, p = [], 1
    while True:
        r = _doc(T, f"/api/v2/movie/contents?page={p}&page_size=100"); d = r.get("data") or []; ds += d
        if len(d) < 100 or p >= 50: break
        p += 1
    cu = {int(l.split("|")[0]): l.split("|")[1:] for l in q("select content_id, coalesce(sua::text, ''), mo_ta, cot_truyen, coalesce(link_luc::text, ''), coalesce(redirect_url, '') from etp.trang_phim").splitlines() if l}
    # bản cần đọc chi tiết: mới · đổi updated_at · còn thiếu mô tả / cốt truyện (Ethopex sinh trễ)
    def can(x):
        c = cu.get(int(x["content_id"]))
        return not c or c[0][:19].replace(" ", "T") != str(x.get("updated_at") or "")[:19] or c[1] == "0" or c[2] == "0"
    doi = [x for x in ds if can(x)][:CHI_TIET]
    def ct(x):
        try: return x, (_doc(T, f"/api/v2/movie/contents/{x['content_id']}").get("item") or {})
        except Exception: return x, None
    with ThreadPoolExecutor(8) as ex: chi = dict((int(x["content_id"]), it) for x, it in ex.map(ct, doi))
    now = dt.datetime.now(dt.timezone.utc)
    rows = []
    for x in ds:
        c, it = int(x["content_id"]), chi.get(int(x["content_id"]))
        old = cu.get(c)
        mo_ta = len((it or {}).get("description") or "") if it is not None else (int(old[1]) if old else 0)
        ct_ = len((it or {}).get("storyline") or "") if it is not None else (int(old[2]) if old else 0)
        url = x.get("redirect_url") or ""
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
    print(json.dumps(chay(q, EA.T_NHA)))
