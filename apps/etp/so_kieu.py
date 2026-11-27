#!/usr/bin/env python3
"""SỔ CHỮ KIỂU (Kiên…) — MỘT hàm đọc cho mọi nơi (anh 27/11/2026: "Mày phải sinh luôn text cho kiểu Kiên lúc review Ảnh").
Nguồn = apps/etp/chu-kieu.json (bộ chữ viết tay, ưu tiên) ∪ bảng etp.chu_kieu (bộ chữ máy sinh: apps/etp/sinh-chu-kien.py, migration 0487).
Người đọc: ethopex_api (cửa CamLechForm + chu_doi), chu-qc.py (chữ creative lúc lên), dong_phim (CC2 / DS_KIEN), bao-plan, luot2, ap-form-chu.
Đọc bảng lỗi → chỉ còn sổ json + in cảnh báo (không bịa chữ; phim thiếu thì người gọi dừng như cũ).
  python3 apps/etp/so_kieu.py --tu-kiem"""
import json, os, subprocess, sys, time

TEP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chu-kieu.json")
TTL = 30   # giây — dong_phim chạy dài: bộ chữ vừa sinh hiện ra sau tối đa ngần này

def q_mac(s):
    """box3: DATABASE_URL · iMac / máy khác: ssh box3 (cùng khuôn ethopex_api._q)"""
    dk = os.environ.get("DATABASE_URL")
    lenh = ["psql", dk, "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s] if dk else \
        ["ssh", "-o", "ConnectTimeout=15", "root@167.233.241.16", 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -']
    r = subprocess.run(lenh, input=None if dk else s, capture_output=True, text=True, timeout=60)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-200:])
    return r.stdout.strip()

def so_tay():
    try: return json.load(open(TEP))
    except Exception as e: print(f"so_kieu: không đọc được {TEP}: {e}", file=sys.stderr); return {}

_NHO = {"luc": 0.0, "bang": {}}
def bang(q=None, moi=False):
    """{kieu: {content_id: {primaryTexts, headlines, descriptions}}} từ etp.chu_kieu (nhớ TTL giây)"""
    if not moi and time.time() - _NHO["luc"] < TTL: return _NHO["bang"]
    try:
        r = (q or q_mac)("select coalesce(json_agg(json_build_object('c', content_id, 'k', kieu, 'pt', pt, 'hl', hl, 'de', de)), '[]') from etp.chu_kieu")
        b = {}
        for x in json.loads(r or "[]"): b.setdefault(x["k"], {})[str(x["c"])] = {"primaryTexts": x["pt"], "headlines": x["hl"], "descriptions": x["de"]}
        _NHO.update(luc=time.time(), bang=b)
    except Exception as e: print(f"so_kieu: đọc etp.chu_kieu lỗi ({str(e)[:120]}) — chỉ dùng sổ json", file=sys.stderr)
    return _NHO["bang"]

def doc(q=None):
    """sổ gộp cùng khuôn chu-kieu.json: {kieu: {"_link_url", content_id: bộ}} — sổ tay đè bảng máy"""
    t = so_tay(); ra = {k: (dict(v) if isinstance(v, dict) else v) for k, v in t.items()}
    for k, ds in bang(q).items():
        o = ra.setdefault(k, {})
        for c, b in ds.items(): o.setdefault(c, b)
    return ra

def bo(kieu, cid, q=None):
    """bộ chữ kiểu `kieu` của phim → dict {primaryTexts, headlines, descriptions} | None"""
    c = str(int(cid)); t = (so_tay().get(kieu) or {}).get(c)
    return t or (bang(q).get(kieu) or {}).get(c) or (bang(q, moi=time.time() - _NHO["luc"] > 5).get(kieu) or {}).get(c)

def ds(kieu, q=None): return sorted(k for k in (doc(q).get(kieu) or {}) if k.isdigit())
def link(kieu): return (so_tay().get(kieu) or {}).get("_link_url")
def kieu_doi(): return sorted(k for k in so_tay() if not k.startswith("_"))

if __name__ == "__main__" and "--tu-kiem" in sys.argv:
    gia = lambda s: json.dumps([{"c": 999000001, "k": "kien", "pt": ["a"], "hl": ["b"], "de": ["c"]}])
    _NHO["luc"] = 0; assert bo("kien", 999000001, gia) == {"primaryTexts": ["a"], "headlines": ["b"], "descriptions": ["c"]}, "bảng máy phải đọc được"
    assert "999000001" in ds("kien", gia), "ds phải gộp bảng máy"
    tay = next(k for k in (so_tay().get("kien") or {}) if k.isdigit())
    _NHO["luc"] = 0; assert bo("kien", tay, lambda s: json.dumps([{"c": int(tay), "k": "kien", "pt": ["X"], "hl": ["X"], "de": ["X"]}])) == so_tay()["kien"][tay], "sổ tay phải đè bảng máy"
    _NHO.update(luc=0, bang={}); assert bo("kien", 999000002, lambda s: (_ for _ in ()).throw(RuntimeError("x"))) is None, "đọc lỗi → None, không bịa"
    assert link("kien") and "kien" in kieu_doi()
    _NHO.update(luc=0, bang={}); n = len(ds("kien")); print(f"so_kieu ok — kiểu {kieu_doi()} · kien có {n} phim (sổ tay {len([k for k in so_tay()['kien'] if k.isdigit()])})")
