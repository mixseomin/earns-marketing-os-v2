"""CỔNG API ETHOPEX DÙNG CHUNG — chỉ thấy và chỉ đụng camp của 3 tài khoản QC nhà (bộ 1/2/3, xv_khoa_ngoai 'ethopex_bo_tk').
Gốc (anh 28/10/2026: "các rule chỉ áp dụng cho tk htuan82 … tk htuan82 đã thêm quyền xem thêm"): từ 15:06 28/10 token htuan82 thấy thêm 3 tài khoản của
người khác (9249473 / 9249477 / 9249479) → danh sách 703 → 1.769 camp, máy luật tăng ngân sách + thay creative 7 camp không phải của mình; danh sách
còn chia trang (tối đa 1.000/trang) mà script đọc một trang page_size=500 → sót cả camp nhà.
  api(duong, body=None)  — thay cho mọi api() riêng:
    · GET /api/v1/campaigns?…   → đọc ĐỦ mọi trang, chỉ giữ camp tài khoản nhà ({"data": [...]})
    · POST /api/v1/report       → chỉ giữ dòng tài khoản nhà (external_account_id)
    · GET /api/v1/campaigns/<id>[/…] camp người khác: ĐỌC được (anh 28/10/2026: "các tk khác sẽ dùng để theo dõi, kết hợp data để học và tối ưu")
    · mọi lệnh GHI (update / control / tạo) chạm camp người khác → lỗi NgoaiNha, không gửi
  loc_report(rows) — cho chỗ tự gọi urllib /report
  ds_tat_ca() / la_nha(camp) — dong-bo.py: kéo cả camp ngoài vào bảng *_ngoai để học (không bao giờ vào kho luật etp.camp / so_ngay / so_gio)
Dùng: sys.path.insert(0, '<repo>/apps/etp'); from ethopex_api import api"""
import json, os, re, subprocess, urllib.request

class NgoaiNha(RuntimeError): pass

def _q(s):
    # trên box3 đọc thẳng DATABASE_URL; trên iMac (the-loai / phim-moi… nạp module này) đọc qua ssh box3 — 28/10/2026 gãy phim-moi poster vì thiếu DATABASE_URL
    lenh = ["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s] if os.environ.get("DATABASE_URL") else \
        ["ssh", "-o", "ConnectTimeout=15", "root@167.233.241.16", 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -']
    r = subprocess.run(lenh, input=None if os.environ.get("DATABASE_URL") else s, capture_output=True, text=True, timeout=60)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-200:])
    return r.stdout.strip()

T = _q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
_BO = json.loads(_q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_bo_tk'") or "{}")
TK = {int(v["tk"]) for v in _BO.values() if v.get("tk")}            # id tài khoản trong Ethopex
EXT = {str(v["ext"]) for v in _BO.values() if v.get("ext")}          # id tài khoản Meta (report: external_account_id)
if not TK: raise RuntimeError("không đọc được tài khoản nhà (ethopex_bo_tk) — dừng cho an toàn")

def _goi(duong, body=None, timeout=90):
    r = urllib.request.Request("https://api.ethopex.dev" + duong, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ethopex"})
    return json.load(urllib.request.urlopen(r, timeout=timeout))

_NHA, _TAO = None, set()
def camp_nha():
    """{camp_id: camp} mọi camp tài khoản nhà (đủ mọi trang) — đọc một lần mỗi tiến trình"""
    global _NHA
    if _NHA is None: _NHA = {int(c["id"]): c for c in _ds_nha()}
    return _NHA

la_nha = lambda c: int((c or {}).get("ad_account_id") or 0) in TK
def ds_tat_ca():
    return _ds_nha(nha=False)

def _ds_nha(qs="", nha=True):
    ra, trang = [], 1
    qs = re.sub(r"(^|&)(page_size|page)=\d+", "", qs).strip("&")
    while True:
        d = _goi(f"/api/v1/campaigns?page_size=1000&page={trang}" + (f"&{qs}" if qs else ""))
        ra += [c for c in d.get("data") or [] if not nha or la_nha(c)]
        if trang >= int((d.get("meta") or {}).get("total_pages") or 1) or not d.get("data"): return ra
        trang += 1

def loc_report(rows):
    return [x for x in rows or [] if str(x.get("external_account_id") or "") in EXT or (not x.get("external_account_id") and int(x.get("campaign_id") or 0) in camp_nha())]

def _id_cham(duong, body):
    """mọi id camp mà lệnh này đụng tới"""
    ids = set(int(x) for x in re.findall(r"/api/v1/campaigns/(\d+)", duong))
    def quet(v, k=None):
        if isinstance(v, dict):
            for kk, vv in v.items(): quet(vv, kk)
        elif isinstance(v, list):
            for vv in v: quet(vv, k)
        elif k in ("campaign_id", "entity_ids", "id") and str(v).isdigit(): ids.add(int(v))
    if isinstance(body, dict) and body.get("entity_type") not in (None, "campaign"): return ids
    quet(body); return ids

def api(duong, body=None, timeout=90):
    if isinstance(body, (str, bytes)): body = json.loads(body)
    if duong.startswith("/api/v1/campaigns?") and body is None:
        return {"data": _ds_nha(duong.split("?", 1)[1]) if duong != "/api/v1/campaigns?" else _ds_nha()}
    if duong.startswith("/api/v1/report"):
        d = _goi(duong, body, timeout); d["rows"] = loc_report(d.get("rows")); return d
    if body is not None and isinstance(body, dict) and body.get("ads"):   # thay creative: {"ads": [{"ad_id"}]} → camp của ad
        nha_ad = {int(c.get("ad_id") or 0) for c in camp_nha().values()} | {int(x) for x in _q("select ad_id from etp.camp where ad_id is not null and bo is not null").split() if x.isdigit()}
        la = [int(a.get("ad_id") or 0) for a in body["ads"] if int(a.get("ad_id") or 0) not in nha_ad]
        if la: raise NgoaiNha(f"ad {la} không thuộc tài khoản nhà — không gửi")
    ids = _id_cham(duong, body if not isinstance(body, list) else {"x": body})
    if body is not None and duong.endswith("/campaigns/facebook"):   # tạo camp mới: tài khoản đích (ad_account_id trong payload) phải là tài khoản nhà
        tk = set(int(x) for x in re.findall(r'"ad_account_id":\s*"?(\d+)', json.dumps(body)))
        if not tk or tk - TK: raise NgoaiNha(f"tạo camp vào tài khoản {sorted(tk - TK) or '?'} không phải tài khoản nhà — không gửi")
        d = _goi(duong, body, timeout)   # camp vừa tạo (vào tài khoản nhà) có thể chưa hiện trong danh sách → nhớ id để lệnh sau (tạm dừng / lịch) không bị chặn oan
        moi = d.get("id") or (d.get("data") or {}).get("id") or (d.get("campaign") or {}).get("id") if isinstance(d, dict) else None
        if moi and str(moi).isdigit(): _TAO.add(int(moi))
        return d
    ngoai = [i for i in ids if i > 1000 and i not in _TAO and i not in camp_nha()] if body is not None else []   # chỉ lệnh GHI mới gác
    if ngoai:
        # camp vừa tạo chưa kịp vào danh sách đã nạp → đọc lại một lần
        global _NHA; _NHA = None; ngoai = [i for i in ngoai if i not in camp_nha()]
    if ngoai and body is not None: raise NgoaiNha(f"camp {sorted(ngoai)[:5]} không thuộc tài khoản nhà (bộ 1/2/3) — không gửi lệnh (camp ngoài chỉ để xem / học)")
    return _goi(duong, body, timeout)

if __name__ == "__main__":   # tự kiểm: python3 ethopex_api.py
    n = camp_nha(); print("camp nhà", len(n), "· tài khoản", sorted(TK))
    assert all(int(c["ad_account_id"]) in TK for c in n.values())
    ngoai = next((int(c["id"]) for c in _goi("/api/v1/campaigns?page_size=1000&page=1")["data"] if int(c.get("ad_account_id") or 0) not in TK), None)
    if ngoai:
        assert api(f"/api/v1/campaigns/{ngoai}")["campaign"], "đọc camp ngoài phải được"
        for duong, body in (("/api/v1/campaigns/update", {"campaign": {"campaign_id": ngoai, "source_payload": {"daily_budget": 1}}}),
                            ("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [ngoai], "status": "paused"}])):
            try: api(duong, body); raise SystemExit(f"LỌT: {duong} camp ngoài {ngoai}")
            except NgoaiNha as e: print("chặn đúng:", duong, "·", str(e)[:60])
    r = api("/api/v1/report", {"columns": ["campaign_name", "cost"], "filters": {}, "metric_conditions": [], "limit": 5000, "page": 1, "page_size": 5000, "date_from": "2026-10-27", "date_to": "2026-10-28"})["rows"]
    assert all(int(x["campaign_id"]) in n for x in r if x.get("campaign_id")), "report lọt camp ngoài"
    print("report", len(r), "dòng, đều của nhà · OK")
