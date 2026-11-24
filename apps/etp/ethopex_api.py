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
import json, os, re, subprocess, urllib.error, urllib.request

class NgoaiNha(RuntimeError): pass
class CamThayCreative(NgoaiNha): pass
class CamNganSach(NgoaiNha, ValueError): pass     # camp mới > $1 (anh 08/11/2026) — cong.ns_tao đọc chính payload tạo camp
class CamDangAT(NgoaiNha, ValueError): pass       # creative ảnh tĩnh không phải dạng Free (anh 19/11/2026, sổ luật at_chi_dang_free) — cong.at_sai_dang
class CamLechForm(NgoaiNha, ValueError): pass     # camp MỚI lên bằng creative chưa đúng form chữ (anh 24/11/2026, góp ý #1813: "chưa có thì chờ chứ không lên chữ cũ")

# FORM CHỮ CỐ ĐỊNH (anh 24/11/2026 "Form đúng phải thế này !!") — MỘT nguồn apps/etp/form-chu.json; ap-form-chu.py + cửa CamLechForm dùng chung dung_form
FORM = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "form-chu.json")))
def ds_l(v):
    if isinstance(v, str):
        try: v = json.loads(v)
        except Exception: return [v] if v.strip() else []
    return [str(x).strip() for x in (v or [])] if isinstance(v, list) else []
def dung_form(c):
    a = c.get("asset_spec") or {}
    a = json.loads(a) if isinstance(a, str) and a.strip().startswith("{") else (a if isinstance(a, dict) else {})
    return (c.get("call_to_action") == FORM["call_to_action"] and (c.get("link_url") or "") == FORM["link_url"]
            and ds_l(a.get("primaryTexts")) == FORM["primaryTexts"] and ds_l(a.get("headlines")) == FORM["headlines"] and ds_l(a.get("descriptions")) == FORM["descriptions"])
_TAO_CR = re.compile(r"^/api/v1/creatives(?:/bulk-jobs)?/?$")
def lech_tao(duong, body):
    """lệnh TẠO creative (/api/v1/creatives, /creatives/bulk-jobs — thân dict, mảng trần hoặc {items}) → tên các bản chữ KHÁC form; không phải lệnh tạo → [].
    Anh 24/11/2026: "Tao cấm mày tự viết + sửa chỗ đó trong mọi phim, mọi camp" — tối 24/11 soát ra chữ camp nhà lỗ là chữ máy tự sinh (câu dự phòng chu-qc.py
    "<tên> — watch the full story free", bản AI kể chuyện "…Watch Now - Learn More."). Cửa này chặn ở gốc: không creative nào lên Ethopex mang chữ ngoài form-chu.json."""
    if body is None or not _TAO_CR.match(duong.split("?")[0]): return []
    if isinstance(body, (str, bytes)): body = json.loads(body)
    ds = body if isinstance(body, list) else (body["items"] if isinstance(body, dict) and isinstance(body.get("items"), list) else [body])
    return [str(x.get("name") or "?")[:60] if isinstance(x, dict) else "?" for x in ds if not (isinstance(x, dict) and dung_form(x))]
import importlib.util as _iu
_s = _iu.spec_from_file_location("cong", os.path.join(os.path.dirname(os.path.abspath(__file__)), "cong.py")); CG = _iu.module_from_spec(_s); _s.loader.exec_module(CG)

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
# CHẾ ĐỘ XEM NGƯỜI (anh 30/10/2026: "theo dõi hiệu suất của mọi người trong team về thời điểm lên bậc … chỉ đề xuất, ko tự ý update"):
# ETP_XEM_NGUOI=<nguoi_id> → "nhà" tạm là các tài khoản của người đó (etp.tai_khoan, trừ tài khoản nhà) để máy luật chấm camp của họ;
# MỌI lệnh ghi bị chặn ngay đầu api() — chế độ này chỉ đọc, kể cả khi người gọi lỡ gửi lệnh.
XEM = int(os.environ.get("ETP_XEM_NGUOI") or 0)
# CHẾ ĐỘ SỬA CỦA NGƯỜI (anh 31/10/2026: Sơn "được edit camp của Sơn" trên etp.on.tc — apps/etp/sua-ngoai.py): ETP_SUA_NGUOI=<nguoi_id> → "nhà" tạm là tài khoản
# của người đó; lệnh ghi ĐƯỢC gửi nhưng cùng một cái gác như nhà: camp đụng tới phải nằm trong tài khoản người đó (camp nhà / người khác bị NgoaiNha)
SUA = int(os.environ.get("ETP_SUA_NGUOI") or 0)
if XEM and SUA: raise RuntimeError("ETP_XEM_NGUOI và ETP_SUA_NGUOI không đi cùng nhau")
if XEM or SUA:
    TK = {int(x) for x in _q(f"select ad_account_id from etp.tai_khoan where nguoi_id = {XEM or SUA} and not nha").split() if x.isdigit()}
    EXT = set()   # report lọc theo camp_id của người đó (kho không giữ id tài khoản Meta của người khác)
    if not TK: raise RuntimeError(f"người #{XEM or SUA} không có tài khoản QC ngoài nhà — dừng")

def jwt_tai(tok):
    """phần thân JWT phiên Ethopex ({user_id, exp…}) — None khi không phải JWT"""
    import base64
    p = (tok or "").split(".")
    if len(p) != 3: return None
    try: return json.loads(base64.urlsafe_b64decode(p[1] + "=" * (-len(p[1]) % 4)))
    except Exception: return None

def khoa_nguoi(ng):
    """PHIÊN ETHOPEX RIÊNG của một người (anh 31/10/2026: "Sơn ko thể sửa camp thông qua api của tao" — token htuan82 chỉ được XEM tài khoản người khác).
    Người tự dán trên etp.on.tc (sua-ngoai.py ket) → xv_khoa_ngoai['ethopex_nguoi'][<nguoi_id>]. None khi chưa kết nối / đã hết hạn."""
    import time
    tok = _q(f"select gia_tri->'{int(ng)}'->>'access_token' from xv_khoa_ngoai where ten = 'ethopex_nguoi'")
    t = jwt_tai(tok)
    return tok if t and int(t.get("exp") or 0) > time.time() + 60 else None

# T_NHA = phiên CỦA tài khoản Nhà (htuan82) — khác T khi máy đang chạy bằng phiên dự phòng của người team (chon_token, #1667)
T_NHA = _q("select coalesce(gia_tri->>'nha_token', gia_tri->>'access_token') from xv_khoa_ngoai where ten='ethopex'") or T

def _ghi_stdin(cau):
    """câu SQL chứa token → psql đọc STDIN (không qua tham số dòng lệnh: ps thấy được)"""
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=cau, capture_output=True, text=True, timeout=30)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-200:])

def chon_token(ghi=True):
    """TOKEN ĐANG DÙNG CỦA MÁY — MỘT chỗ chọn (anh 18/11/2026 #1667: "dùng thêm API của Sơn để backup nếu API token của ta bị hết hạn").
    Mọi script đọc xv_khoa_ngoai['ethopex'].access_token (16 nơi) → hàm này đặt ĐÚNG chuỗi đó, không sửa từng nơi đọc.
    Thứ tự: token Nhà (nha_token) → phiên Ethopex người team đã cất (ethopex_nguoi, người vai admin etp trước — Sơn). Ứng viên phải còn hạn > 10 phút
    VÀ đọc được camp tài khoản nhà bằng chính nó (lọc TK như mọi lệnh) — phiên không thấy camp nhà thì không dùng. Không ứng viên nào đạt: giữ nguyên,
    ghi loi_token để etp2 hiện nút 🔑 Sửa token. Trả {nguon, ten, het, so_camp, loi} (không bao giờ trả / in token)."""
    import datetime, time
    global T, _NHA, T_NHA
    if XEM or SUA: raise RuntimeError("chon_token chỉ chạy ở chế độ Nhà")
    g = json.loads(_q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex'") or "{}")
    uid = int(_q("select coalesce(min(nguoi_id), 0) from etp.tai_khoan where nha") or 0)
    nha = g.get("nha_token") or (g.get("access_token") if (jwt_tai(g.get("access_token")) or {}).get("user_id") == uid else None)
    ng = json.loads(_q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_nguoi'") or "{}")
    ten = dict(l.split("|", 1) for l in _q("select nguoi_id || '|' || max(nguoi) from etp.tai_khoan where not nha and nguoi_id is not null group by nguoi_id").splitlines() if "|" in l)
    adm = set(_q("select distinct nguoi_id from etp.quyen where vai = 'admin' and nguoi_id is not null").split())
    ung = [("nha", "Nhà", nha)] + [(f"nguoi:{k}", ten.get(k, f"người #{k}"), (v or {}).get("access_token"))
                                    for k, v in sorted(ng.items(), key=lambda kv: (kv[0] not in adm, int(kv[0]) if kv[0].isdigit() else 0))]
    vn = lambda e: (datetime.datetime.fromtimestamp(e, datetime.timezone.utc) + datetime.timedelta(hours=7)).strftime("%H:%M %d/%m")
    het = lambda e: datetime.datetime.fromtimestamp(e, datetime.timezone.utc).isoformat() if e else None
    T0, ly, chon = T, [], None
    for ma, tn, tok in ung:
        j = jwt_tai(tok)
        if not j: ly.append(f"{tn}: chưa có token"); continue
        if int(j.get("exp") or 0) < time.time() + 600: ly.append(f"{tn}: hết hạn {vn(int(j.get('exp') or 0))}"); continue
        T, _NHA = tok, None
        try: n = len(camp_nha())
        except Exception as e: ly.append(f"{tn}: {str(e)[:160]}"); continue
        if not n: ly.append(f"{tn}: không thấy camp tài khoản nhà"); continue
        chon = (ma, tn, tok, int(j["exp"]), n); break
    T, _NHA = (chon[2] if chon else T0), None
    nha_het = (jwt_tai(nha) or {}).get("exp")
    kq = {"nguon": chon[0] if chon else "het", "ten": chon[1] if chon else None, "het": het(chon[3]) if chon else None, "so_camp": chon[4] if chon else 0,
          "nha_het": het(nha_het), "loi": " · ".join(ly) or None}
    if ghi:
        s = lambda x: (x or "").replace("$", "")
        trang = {"nguon": kq["nguon"], "nguon_ten": kq["ten"], "nguon_het": kq["het"], "nha_het": kq["nha_het"], "loi_token": kq["loi"],
                 "kiem": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        cau = f"update xv_khoa_ngoai set gia_tri = gia_tri || $J${json.dumps(trang, ensure_ascii=False).replace('$', '')}$J$::jsonb"
        if nha: cau += f" || jsonb_build_object('nha_token', $T${s(nha)}$T$)"
        if chon and chon[2] != g.get("access_token"): cau += f" || jsonb_build_object('access_token', $T${s(chon[2])}$T$), cap_nhat = now()"
        _ghi_stdin(cau + " where ten = 'ethopex';")
        if nha: T_NHA = nha
    return kq

if SUA: T = khoa_nguoi(SUA)   # chế độ sửa: MỌI lệnh đi bằng phiên của chính người đó — Ethopex ghi nhật ký đúng người, quyền đúng người

def _goi(duong, body=None, timeout=90):
    if not T: raise NgoaiNha(f"người #{SUA} chưa kết nối Ethopex (hoặc phiên đã hết hạn) — dán phiên Ethopex của mình trên etp.on.tc")
    r = urllib.request.Request("https://api.ethopex.dev" + duong, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ethopex"})
    # THỬ LẠI LỖI THOÁNG QUA của LỆNH ĐỌC (23/11/2026 "lắm lỗi thế": T1 không tắt được #108663, so-ngay --chup hỏng mọi nhịp — Ethopex trả 522 Cloudflare
    # và cắt ngang thân JSON 3 MB "Expecting ',' delimiter"; trước đây không chỗ nào thử lại, một lần chập là cả lệnh chết). Chỉ lệnh ĐỌC (GET, POST /report):
    # lệnh ghi (tắt / bật / sửa / tạo camp) có thể đã tới máy chủ dù trả lỗi → không tự gửi lại, nơi gọi tự quyết.
    doc = body is None or duong.startswith("/api/v1/report")
    for lan in range(3 if doc else 1):
        try: return _goi_mot(r, timeout)
        except Exception as e:
            if lan == 2 or not doc or not _thoang_qua(e): raise
            import time as _t, sys as _s; print(f"⚠ Ethopex {duong[:60]}: {type(e).__name__} {getattr(e, 'code', '')} — thử lại lần {lan + 2}/3", file=_s.stderr); _t.sleep((3, 10)[lan])

def _thoang_qua(e):
    """lỗi đáng thử lại: máy chủ / Cloudflare chập (429 · 5xx · 52x), đứt mạng, quá giờ, thân trả về bị cắt (JSON gãy)"""
    import http.client, socket
    if isinstance(e, urllib.error.HTTPError): return e.code in (408, 425, 429) or e.code >= 500
    return isinstance(e, (urllib.error.URLError, TimeoutError, socket.timeout, ConnectionError, http.client.IncompleteRead, http.client.RemoteDisconnected, json.JSONDecodeError))

def _goi_mot(r, timeout):
    try: return json.load(urllib.request.urlopen(r, timeout=timeout))
    except urllib.error.HTTPError as e:   # LỖI PHẢI NÓI LÝ DO (anh 10/11/2026 "Tại sao tele lắm lỗi": tin chỉ ghi "HTTP Error 400: Bad Request"): kèm câu Ethopex trả về;
        # chuỗi vẫn mở đầu "HTTP Error <mã>: " nên nơi gọi đang nhận lỗi theo mã (thử lại 502…) không đổi
        try: than = e.read().decode("utf-8", "replace").strip()
        except Exception: than = ""
        try: j = json.loads(than); than = j.get("message") or j.get("error") or j.get("detail") or than
        except Exception: pass
        raise urllib.error.HTTPError(e.url, e.code, f"{e.reason} · {str(than)[:1200]}" if than else e.reason, e.headers, None) from None

_NHA, _TAO = None, set()
_TRAN_TAO = {}   # camp vừa tạo → trần ngân sách lúc tạo (cong.ns_tao): lệnh đặt lại ngân sách ngay sau tạo không được vượt
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

TRANG_BC = 10000   # report: máy chủ trả tối đa 10.000 dòng / trang
def doc_het(duong, body=None, timeout=90):
    """ĐỦ MỌI TRANG cho MỌI danh sách Ethopex, KHÔNG lọc tài khoản (anh 29/10/2026: "sao lại limit theo trang được? Sau này sẽ có 1 tỷ camp").
    Máy chủ tự cắt: report tối đa 10.000 dòng / trang (xin 50.000 vẫn chỉ trả 10.000), danh sách GET tối đa 1.000 / trang — số người gọi xin KHÔNG
    phải trần. POST report: chia khoảng ngày (không lật trang — xem dưới); GET có '?': lật theo meta.total_pages. Không còn trang nào bị bỏ, bất kể bao nhiêu camp."""
    if body is not None:
        # REPORT KHÔNG LẬT TRANG: máy chủ không giữ thứ tự giữa các trang (order_by bị lờ, đo 30/10/2026: cùng lệnh 12.745 dòng → trang 1 và 2 trùng 16–71 dòng,
        # chừng ấy dòng rơi mất) → camp cộng đôi chi / camp mất chi, All time etp lệch Ethopex. Quá một trang thì CHIA ĐÔI khoảng ngày tới khi mỗi phần vừa một trang.
        # Trang tối đa của máy chủ (10.000) thay cho cỡ người gọi xin (luat-ethopex xin 1.000 → khung 30 ngày 2.159 dòng gãy cả máy luật 30/10/2026)
        b = {**body, "page": 1, "page_size": TRANG_BC, "limit": TRANG_BC}; d = _goi(duong, b, timeout)
        if int(d.get("total_pages") or 1) <= 1: return d
        # Trục chia mà mỗi dòng chỉ thuộc đúng MỘT phần: ngày (group_by có "date") · giờ (group_by có "hour", lọc filters {"hour": [..]}) · lô camp (filters campaign_id)
        tu, den = b.get("date_from"), b.get("date_to"); gb = b.get("group_by") or []; gio = list((b.get("filters") or {}).get("hour") or range(24))
        # Không trục nào mà dòng là dòng CAMP (group_by trống / có campaign_*) → cổng tự lấy mọi camp làm lô (người gọi không phải tự truyền)
        if not (b.get("filters") or {}).get("campaign_id") and "hour" not in gb and not ("date" in gb and tu and den and tu[:10] < den[:10]) \
                and all(k.startswith("campaign") or k in ("date", "geo") for k in gb):
            b = {**b, "filters": {**(b.get("filters") or {}), "campaign_id": sorted(int(c["id"]) for c in ds_tat_ca())}}
        import datetime as _dt
        if "date" in gb and tu and den and tu[:10] < den[:10]:
            a, z = _dt.date.fromisoformat(tu[:10]), _dt.date.fromisoformat(den[:10]); g = a + (z - a) // 2
            phan = [{**b, "date_to": g.isoformat()}, {**b, "date_from": (g + _dt.timedelta(days=1)).isoformat()}]
        elif "hour" in gb and len(gio) > 1:
            phan = [{**b, "filters": {**(b.get("filters") or {}), "hour": h}} for h in (gio[:len(gio) // 2], gio[len(gio) // 2:])]
        elif len(cid := list((b.get("filters") or {}).get("campaign_id") or [])) > 1:   # trục thứ ba: lô camp (người gọi truyền filters {"campaign_id": [..]})
            phan = [{**b, "filters": {**(b.get("filters") or {}), "campaign_id": c}} for c in (cid[:len(cid) // 2], cid[len(cid) // 2:])]
        else:
            raise RuntimeError(f"report {d.get('total_count')} dòng > 1 trang mà không chia được theo ngày / giờ / lô camp (group_by {gb}, {tu}→{den}): lật trang Ethopex mất / trùng dòng — thêm \"date\" vào group_by hoặc filters campaign_id")
        ds = [doc_het(duong, x, timeout) for x in phan]
        ds[0]["rows"] = [r for x in ds for r in (x.get("rows") or [])]; ds[0]["total_pages"] = 1
        # Đếm đối chiếu: các phần cộng lại so với tổng dòng máy chủ báo (camp vắng trong danh sách / trục chia sai → kêu ra stderr, không mất dòng âm thầm).
        # Không dừng: số hôm nay còn chạy giữa các lệnh nên lệch vài dòng là thường — dừng ở đây là tắt cả máy luật.
        if d.get("total_count") is not None and len(ds[0]["rows"]) < int(d["total_count"]):
            import sys as _sys; print(f"⚠ report chia phần ra {len(ds[0]['rows'])} dòng < {d['total_count']} dòng máy chủ báo ({tu}→{den}, group_by {gb})", file=_sys.stderr)
        ds[0]["total_count"] = len(ds[0]["rows"]); return ds[0]
    if "?" not in duong: return _goi(duong, None, timeout)
    goc = re.sub(r"([?&])page=\d+", r"\1", duong).replace("?&", "?").replace("&&", "&").rstrip("&")
    d = _goi(goc + "&page=1", None, timeout); data = list(d.get("data") or [])
    for tr in range(2, int((d.get("meta") or {}).get("total_pages") or 1) + 1): data += _goi(goc + f"&page={tr}", None, timeout).get("data") or []
    if isinstance(d.get("data"), list): d["data"] = data
    return d

# CAMP GỐC ĐỌC TỪ TÊN — MỘT chỗ cho mọi kiểu tên máy đặt (29/10/2026 anh: "bản thang sinh ra từ 1 camp gốc thì phải show cho đúng tree"):
# dong-bo.py chỉ nhận "(nhan ban N cua X)" + "duplicate by X" → bản thang "(thang $N cua X)" mất gốc, nằm ngang hàng trên cây etp
_GOC_TEN = re.compile(r"\((?:nhan ban \d+|thang \$\d+) cua (\d+)\)\s*$|\sduplicate by (\d+)\s*$")
def goc_tu_ten(ten):
    m = _GOC_TEN.search(ten or "")
    return int(m.group(1) or m.group(2)) if m else None

def loc_report(rows):
    if XEM or SUA: return [x for x in rows or [] if int(x.get("campaign_id") or 0) in camp_nha()]
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

# ── MỘT CỬA CHO MỌI LỆNH LÀM TĂNG CHI (anh 18/11/2026 "kiểm soát tuyệt đối" — Huy): cổng cong.kiem() tin lời khai của người gọi (anh_bam / roas / ngoai / lenh_anh / tay)
# → 17/11 dòng phim máy gọi nhan-ban --tay lọt 91 camp qua phanh chợ, 18/11 máy AT ghi ai "anh (chat 05/11/2026: …)" lọt 31 camp. Cửa này nằm ở tầng gọi API
# (mọi script đi qua api()): ĐỌC VIỆC TỪ CHÍNH LỆNH — tạo camp (POST /campaigns/facebook: ngân sách, bid strategy ROAS, tài khoản đích, camp gốc / camp thay trong tên,
# phim trong ad) · đổi ngân sách (campaigns/update: so với ngân sách ĐANG CHẠY đọc lại trên Ethopex) · bật (control/batch/bulk status active) — rồi chấm bằng
# cong.chan_cua (dừng khẩn · ít nước · bảo trì · phanh chợ). Miễn phanh CHỈ khi lệnh mang VÉ thao tác tay hợp lệ (ETP_VE, cong.ve_hop_le) — vé bị đốt lúc gửi.
# Loại hợp lệ đọc từ VẬT, không từ cờ: bật lại theo LỊCH GIỜ (camp trong etp.lich_tat) · camp THAY bài bị Meta từ chối (tên "(thay N bi tu choi)" + camp N có ad
# DISAPPROVED đọc lại) · đặt lại ngân sách camp vừa tạo trong cùng tiến trình (_TRAN_TAO — đã chấm lúc tạo) · giảm / tắt luôn qua.
# Mọi lệnh ghi đi qua (cho qua / chặn / gửi hỏng) ghi một dòng etp.cua — hậu kiểm apps/etp/hau_kiem.py (dong-bo mỗi lượt) so với thay đổi thật trên Ethopex.
class ChanCua(NgoaiNha, ValueError): pass
# CAMP TẠO TRƯỚC 20/11/2026 DỪNG TRIỆT ĐỂ (anh 23/11/2026 "các thứ từ trước 20/11 phải dừng triệt để"): máy không ghi gì vào camp cũ nữa — không bật lại, không tăng /
# giảm, không đổi creative (máy luật bỏ camp cũ khỏi danh sách nên cũng không nhân bản camp cũ thắng). Camp MỚI tạo từ khuôn cũ vẫn lên. Chỉ còn TẠM DỪNG (dừng thêm thì luôn được) và lệnh TRỰC TIẾP của anh (vé truc_tiep). Một cửa ở đây:
# mọi script (luat-ethopex, thay-tu-choi, sua-cta, soat_doan, lich-gio, nhan-ban…) đi qua api(). Người đọc (máy luật, hàng chờ) lọc thêm bằng camp_cu() để khỏi báo / thử.
MOC_CU, MOC_CU_CHU = f"{CG.LUAT_CU_MOC} 00:00+07", f"{CG.LUAT_CU_MOC[8:10]}/{CG.LUAT_CU_MOC[5:7]}"   # một mốc: sổ luật luat_cu.moc (etp-bang-luat.json) — cùng mốc "luật cũ dừng" của cong.py
_CU = None
def camp_cu(ids=None):
    """camp nhà tạo trước MOC_CU (etp.camp.tao) — ids=None: cả bộ; có ids: phần giao. Lỗi đọc → coi mọi id hỏi tới là cũ (chặn cho an toàn)."""
    global _CU
    if _CU is None:
        try: _CU = {int(x) for x in _q(f"select camp_id from etp.camp where tao < '{MOC_CU}'").split() if x.isdigit()}
        except Exception:
            if ids is None: raise
            return {int(x) for x in ids if str(x).isdigit()}
    return set(_CU) if ids is None else {int(x) for x in ids if str(x).isdigit()} & _CU
_THAY_TEN = re.compile(r"\(thay (\d+) bi tu choi\)\s*$")
def _js(x):
    if isinstance(x, str):
        try: return json.loads(x or "{}")
        except ValueError: return {}
    return x or {}
def _ns_dang(cid):
    """ngân sách camp ĐANG CHẠY đọc lại trên Ethopex ngay lúc gửi (không tin số người gọi đưa) — None khi không đọc được"""
    try: c = (_goi(f"/api/v1/campaigns/{int(cid)}", None, 60) or {}).get("campaign") or {}
    except Exception: return None
    v = c.get("budget_daily")
    return float(v) if v not in (None, "") else None
def _bi_tu_choi(cid):
    try: d = _goi(f"/api/v1/campaigns/{int(cid)}", None, 60) or {}
    except Exception: return False
    return any(a.get("delivery_status") == "DISAPPROVED" or "DISAPPROVED" in str(a.get("error") or "").upper() for g in d.get("ad_groups") or [] for a in g.get("ads") or [])
def phan_loai(duong, body):
    """lệnh GHI → danh sách việc đọc TỪ CHÍNH LỆNH: {viec, camp_id, goc, content_id, ns, ns_cu, roas, thay, lich, loai}. [] = không phải lệnh đổi chi / trạng thái."""
    if body is None or duong.startswith("/api/v1/report"): return []
    if duong.endswith("/campaigns/facebook") and isinstance(body, dict):
        cp = body.get("campaign") or {}; sp = _js(cp.get("source_payload"))
        ten = str(sp.get("name") or body.get("name") or "")
        goc, m = goc_tu_ten(ten), _THAY_TEN.search(ten)
        ads = [a for g in cp.get("ad_groups") or [] if isinstance(g, dict) for a in g.get("ads") or [] if isinstance(a, dict)]
        cts = [int(a["content_id"]) for a in ads if str(a.get("content_id") or "").isdigit()]   # MỌI phim trong lệnh — sổ phim cấm soát hết, không chỉ ad đầu
        ct = cts[0] if cts else None
        roas = sp.get("bid_strategy") == "LOWEST_COST_WITH_MIN_ROAS"
        bai = bool(ads) and all(str(a.get("effective_object_story_id") or "").strip() and a.get("creative_id") is None for a in ads)
        thay = int(m.group(1)) if m else None
        return [{"viec": "nhan_ban" if goc else "tao_camp", "camp_id": None, "goc": goc or thay, "thay_id": thay, "content_id": ct, "cts": cts, "ns": sp.get("daily_budget"), "roas": roas,
                 "loai": "roas" if roas else "thang" if re.search(r"\(thang \$", ten) else "bai_cu" if bai else "thay" if thay else None, "ten": ten[:200]}]
    if duong.endswith("/campaigns/update") and isinstance(body, dict) and isinstance(body.get("campaign"), dict):
        cp = body["campaign"]; ns = _js(cp.get("source_payload")).get("daily_budget")
        if ns is None or not str(cp.get("campaign_id") or "").isdigit(): return []
        cid = int(cp["campaign_id"])
        if cid in _TRAN_TAO: return [{"viec": "dat_sau_tao", "camp_id": cid, "ns": float(ns), "loai": "dat_sau_tao"}]
        cu = _ns_dang(cid)
        return [{"viec": "giam" if cu is not None and float(ns) <= cu else "tang", "camp_id": cid, "ns": float(ns), "ns_cu": cu}]   # không đọc được mức đang chạy → coi là tăng (an toàn trước)
    if "/control/" in duong:
        ra = []
        for x in body if isinstance(body, list) else [body]:
            if not isinstance(x, dict): continue
            tt = str(x.get("status") or "").lower(); et = x.get("entity_type") or "campaign"
            if tt not in ("active", "paused"): continue
            ids = [int(i) for i in (x.get("entity_ids") or []) if str(i).isdigit()] if et == "campaign" else []
            if et != "campaign": ra.append({"viec": "bat" if tt == "active" else "tat", "camp_id": None, "loai": f"cap_{et}"}); continue
            lich = {int(i) for i in _q(f"select camp_id from etp.lich_tat where camp_id in ({','.join(map(str, ids))})").split() if i.isdigit()} if tt == "active" and ids else set()
            ra += [{"viec": "bat" if tt == "active" else "tat", "camp_id": i, "lich": i in lich, "loai": "lich" if i in lich else None} for i in ids]
        return ra
    return []
def _ghi_cua(l, ok, ly=None, ve=None, camp_id=None):
    """một dòng etp.cua — lỗi ghi không chặn lệnh (hậu kiểm sẽ thấy thiếu dòng và báo đỏ)"""
    import sys as _sys
    try:
        f = lambda v: "null" if v in (None, "") else (str(float(v)) if isinstance(v, (int, float)) or str(v).replace(".", "", 1).isdigit() else "null")
        s = lambda v: "null" if v in (None, "") else f"$X${str(v).replace('$', '')[:400]}$X$"
        cid = camp_id or l.get("camp_id")
        _q(f"""insert into etp.cua (viec, loai, camp_id, goc, content_id, ns, ns_cu, ve, ok, ly, tep) values ({s(l.get('viec'))}, {s(('truc_tiep' if l.get('truc_tiep') else 'tay' if ve else 'may') + (':' + l['loai'] if l.get('loai') else ''))},
            {int(cid) if cid else 'null'}, {int(l['goc']) if l.get('goc') else 'null'}, {int(l['content_id']) if l.get('content_id') else 'null'}, {f(l.get('ns'))}, {f(l.get('ns_cu'))},
            {s(ve)}, {'null' if ok is None else ('true' if ok else 'false')}, {s(ly)}, {s(os.path.basename(_sys.argv[0] or '?') + (f' · sửa người #{SUA}' if SUA else ''))})""")
    except Exception as e: print(f"⚠ cửa API không ghi được sổ etp.cua: {str(e)[:160]}", file=_sys.stderr)
def cua(duong, body):
    """chấm mọi việc của lệnh trước khi gửi → [(việc, người bấm của vé | None)] · lệnh có việc bị chặn → ChanCua (không gửi gì). Đốt vé của việc được miễn."""
    ds = phan_loai(duong, body)
    if not ds: return []
    try: ch = CG.doc_cau_hinh()
    except Exception as e:
        for l in ds: _ghi_cua(l, False, f"không đọc được etp.cau_hinh: {str(e)[:80]}")
        raise ChanCua(f"cửa API không đọc được rào chắn etp ({str(e)[:80]}) — chặn cho an toàn")
    ra = []
    for l in ds:
        v = l["viec"]
        cu = camp_cu([l["camp_id"]]) if v != "tat" and l.get("camp_id") else set()   # chỉ camp BỊ GHI; tạo camp mới từ khuôn cũ (▶ Lên etp2, nhan-ban <khuôn>) không chạm camp cũ → vẫn đi
        if cu and not CG.truc_tiep(v, sorted(cu), l.get("content_id")):   # camp trước 20/11: chỉ tạm dừng / lệnh trực tiếp của anh (anh 23/11/2026)
            ly = f"camp #{', #'.join(map(str, sorted(cu)))} tạo trước {MOC_CU_CHU} — dừng triệt để, máy không {v} (anh 23/11/2026)"
            _ghi_cua(l, False, ly); raise ChanCua(f"cửa API chặn {v}: {ly}")
        if v not in CG.TANG: ra.append((l, None)); continue
        ids = [x for x in (l.get("camp_id"), l.get("goc")) if x]
        ct = l.get("content_id") or (_q(f"select content_id from etp.camp where camp_id = {int(l['goc'])}") or None if l.get("goc") else None)
        ve = CG.ve_hop_le(v, ids, ct)
        tt = bool(ve) and bool(CG.truc_tiep(v, ids, ct))   # vé LỆNH TRỰC TIẾP của anh (anh 20/11/2026) — miễn mọi phanh của cửa trừ phim cấm; sổ cửa ghi loai 'truc_tiep'
        if tt: l["truc_tiep"] = True
        thay = bool(l.get("thay_id")) and _bi_tu_choi(l["thay_id"])
        cts = [x for x in [ct] + list(l.get("cts") or []) if x]   # phim của lệnh + phim camp gốc → sổ phim cấm (cong.phim_cam, anh 19/11/2026)
        ly = CG.chan_cua(v, ch, l.get("camp_id"), thay=thay, ve=bool(ve), lich=bool(l.get("lich")), cts=cts, goc=l.get("goc"), q=_q, tt=tt)
        if ly:
            _ghi_cua(l, False, ly)
            raise ChanCua(f"cửa API chặn {v}{' #' + str(l['camp_id']) if l.get('camp_id') else ''}{' (gốc #' + str(l['goc']) + ')' if l.get('goc') else ''}: {ly}")
        if ve and not CG.ve_hop_le(v, ids, ct, dung=True, cho=f"{v} {ids or ct}"):   # vé vừa bị lệnh khác đốt → hết miễn: chấm lại như lệnh máy
            ve, ly = None, CG.chan_cua(v, ch, l.get("camp_id"), thay=thay, ve=False, lich=bool(l.get("lich")), cts=cts, goc=l.get("goc"), q=_q)
            if ly: _ghi_cua(l, False, ly); raise ChanCua(f"cửa API chặn {v}: {ly} (vé đã dùng cho lệnh khác)")
        ra.append((l, ve))
    return ra

def phim_cam_lenh(duong, body, q=None):
    """lệnh mang creative (tạo creative /creatives…, gắn / đổi creative vào ad /campaigns/update ads) → lý do chặn phim cấm | None (cong.phim_cam, một hàm đọc sổ)."""
    if body is None or duong.startswith("/api/v1/report"): return None
    tao_cr = "/creatives" in duong
    gan = duong.endswith("/campaigns/update") and isinstance(body, dict) and bool(body.get("ads"))
    if not tao_cr and not gan: return None
    s = json.dumps(body); q = q or _q
    cts = [int(x) for x in re.findall(r'"content_id":\s*"?(\d+)', s)]
    crs = sorted({int(x) for x in re.findall(r'"creative_id":\s*"?(\d+)', s)})
    ads = sorted({int(a.get("ad_id")) for a in body.get("ads") or [] if isinstance(a, dict) and str(a.get("ad_id") or "").isdigit()}) if gan else []
    try:
        if crs: cts += [int(x) for x in q(f"select content_id from etp.creative where creative_id in ({','.join(map(str, crs))}) and content_id is not null").split() if x.isdigit()]
        camps = [int(x) for x in q(f"select camp_id from etp.camp where ad_id in ({','.join(map(str, ads))})").split() if x.isdigit()] if ads else []
    except Exception as e: return f"không đọc được phim của lệnh creative ({str(e)[:80]}) — chặn cho an toàn"
    if tao_cr and not cts: return None   # lệnh creative không mang phim (đọc / sửa chữ) — không có gì để soát
    return CG.phim_cam(camps, cts, q=q)

def api(duong, body=None, timeout=90):
    if isinstance(body, (str, bytes)): body = json.loads(body)
    if XEM and body is not None and not duong.startswith("/api/v1/report"): raise NgoaiNha(f"chế độ xem người #{XEM}: chỉ đọc — không gửi {duong}")
    # TRẦN TUYỆT ĐỐI $30 / CAMP (anh 14/11/2026 "Ko bao giờ tăng ngân sách vượt trần $30"): đọc trên CHÍNH lệnh gửi đi (mọi tầng, mọi đường: tạo, nhân bản, ROAS, tăng,
    # sửa camp team) — không tin số người gọi khai; cùng số với cong.TRAN_TUYET
    if body is not None and not duong.startswith("/api/v1/report"):
        vuot = [float(v) for v in re.findall(r'"daily_budget":\s*"?([\d.]+)', json.dumps(body)) if float(v) > CG.TRAN_TUYET]
        if vuot: raise CamNganSach(f"ngân sách ${max(vuot):g} vượt trần tuyệt đối ${CG.TRAN_TUYET:g}/camp (anh 14/11/2026: không bao giờ vượt $30) — không gửi {duong}")
    tran = None
    if body is not None and duong.endswith("/campaigns/facebook"):   # tạo camp mới: tài khoản đích (ad_account_id trong payload) phải là tài khoản nhà
        tk = set(int(x) for x in re.findall(r'"ad_account_id":\s*"?(\d+)', json.dumps(body)))
        if not tk or tk - TK: raise NgoaiNha(f"tạo camp vào tài khoản {sorted(tk - TK) or '?'} không phải tài khoản nhà — không gửi")
        ly, tran = CG.ns_tao(body)   # CAMP MỚI $1 đọc trên CHÍNH payload (mọi tầng campaign + Ad Set), không tin số người gọi khai
        if ly: raise CamNganSach(ly)
    # AT CHỈ DẠNG FREE (anh 19/11/2026): mọi lệnh mang creative (tạo camp / nhân bản / hồi chợ / đổi creative bài bị từ chối) → creative ảnh tĩnh phải cta watch_for_free
    if body is not None and (duong.endswith("/campaigns/facebook") or (duong.endswith("/campaigns/update") and isinstance(body, dict) and body.get("ads"))):
        ly_at = CG.at_sai_dang(re.findall(r'"creative_id":\s*"?(\d+)', json.dumps(body)), q=_q)
        if ly_at: raise CamDangAT(f"{ly_at} — không gửi {duong}")
    # CAMP MỚI PHẢI LÊN BẰNG MẪU ĐÃ MANG CHỮ FORM (anh 24/11/2026, góp ý #1813): mọi đường tạo camp (lên phim, nhân bản, hồi chợ, ★ ROAS) — đọc lại từng creative_id
    # của CHÍNH lệnh trên Ethopex, lệch form → không gửi, chờ bản đúng form (creative đội / mẫu cũ: ap-form-chu.py --ban-nha <creative>). Đọc lỗi → chặn.
    # Ad đang chạy KHÔNG đụng (CamThayCreative, anh 03/11/2026) — chữ form chỉ áp cho camp lên sau.
    if body is not None and duong.endswith("/campaigns/facebook"):
        for cr in sorted({int(x) for x in re.findall(r'"creative_id":\s*"?(\d+)', json.dumps(body))}):
            try: c = _goi(f"/api/v1/creatives/{cr}", None, timeout); c = c.get("data", c) if isinstance(c, dict) else {}
            except Exception as e: raise CamLechForm(f"không đọc được creative {cr} để soát form chữ ({type(e).__name__}) — không gửi {duong}")
            if not dung_form(c or {}):
                raise CamLechForm(f"creative {cr} chưa đúng form chữ (apps/etp/form-chu.json) — camp mới chờ bản đúng form, không lên chữ cũ "
                                  f"(tạo bản nhà: ap-form-chu.py --ban-nha {cr}) — không gửi {duong}")
    # PHIM CẤM — LÊN / GẮN CREATIVE (anh 19/11/2026 "ko cho mở camp mới, lên creative dưới mọi hình thức"): lệnh tạo creative (/creatives…, kể cả bulk-jobs) và lệnh
    # gắn / đổi creative vào ad (/campaigns/update ads) soát cùng hàm cong.phim_cam trên phim của CHÍNH lệnh (content_id trong body, phim của creative_id, camp của ad_id).
    # Tạo / nhân bản / bật / tăng camp đã soát ở cua() → chan_cua. Lỗi đọc → chặn.
    ly_pc = phim_cam_lenh(duong, body)
    if ly_pc: raise ChanCua(f"cửa API chặn lên / gắn creative: {ly_pc} — không gửi {duong}")
    _lt = lech_tao(duong, body)   # CHỮ CREATIVE MỚI = FORM, không ngoại lệ (lech_tao — anh 24/11/2026 cấm tự viết chữ QC)
    if _lt: raise CamLechForm(f"{len(_lt)} creative mang chữ khác form (apps/etp/form-chu.json), vd {_lt[0]!r} — máy không tự viết chữ QC, không gửi {duong}")
    if body is not None and isinstance(body, dict) and duong.endswith("/campaigns/update"):   # đặt lại ngân sách camp VỪA TẠO (Ethopex không nhận lúc tạo) → không vượt trần lúc tạo
        cp = body.get("campaign") or {}; cid = int(cp.get("campaign_id") or 0); ns = (cp.get("source_payload") or {}).get("daily_budget")
        if cid in _TRAN_TAO and ns is not None and float(ns) > _TRAN_TAO[cid]:
            raise CamNganSach(f"camp #{cid} vừa tạo, trần lúc tạo ${_TRAN_TAO[cid]:g} — không đặt ${float(ns):g} (camp mới phải $1, anh 08/11/2026)")
    # MỘT CỬA (anh 18/11/2026) — sau các chặn theo VẬT ở trên (tài khoản nhà, $1, trần tuyệt đối): mọi lệnh tăng chi / bật chấm phanh / bảo trì / dừng khẩn trên dữ kiện
    # của chính lệnh — chặn thì ChanCua, không gửi gì
    lenh = cua(duong, body)
    if duong.startswith("/api/v1/campaigns?") and body is None:
        return {"data": _ds_nha(duong.split("?", 1)[1]) if duong != "/api/v1/campaigns?" else _ds_nha()}
    if duong.startswith("/api/v1/report"):
        # ĐỦ MỌI TRANG (29/10/2026: report tách dòng theo camp × phim — khung 9 ngày 1818 dòng / 2 trang; chỉ đọc trang 1 thì camp ở trang 2 thành $0,
        # máy luật không xét nhân bản / T30 cho #65722 $20 đang lãi). Mọi caller đi qua đây — không tự gọi report thẳng.
        d = doc_het(duong, body if isinstance(body, dict) else None, timeout); d["rows"] = loc_report(d.get("rows")); return d
    if body is not None and not duong.endswith("/campaigns/facebook"):   # mọi lệnh ghi khác chạm camp trước 20/11 mà cua() chưa cho qua (đổi creative, sửa tên, lịch…) → chặn
        _ad = sorted({int(a.get("ad_id")) for a in (body.get("ads") or []) if isinstance(a, dict) and str(a.get("ad_id") or "").isdigit()}) if isinstance(body, dict) else []
        _dung = _id_cham(duong, body if not isinstance(body, list) else {"x": body}) | ({int(x) for x in _q(f"select camp_id from etp.camp where ad_id in ({','.join(map(str, _ad))})").split() if x.isdigit()} if _ad else set())
        _con = camp_cu(_dung) - {int(l["camp_id"]) for l, _ in lenh if l.get("camp_id")}
        if _con: raise ChanCua(f"cửa API chặn {duong}: camp #{', #'.join(map(str, sorted(_con)[:5]))} tạo trước {MOC_CU_CHU} — dừng triệt để, máy không ghi gì vào camp cũ (anh 23/11/2026)")
    if body is not None and isinstance(body, dict) and body.get("ads") and not duong.endswith("/campaigns/facebook"):
        # CHỈ ĐỔI CREATIVE CHO AD ĐANG BỊ META TỪ CHỐI (anh 03/11/2026: "Đổi creative khác cho ad bị meta từ chối. Cấm tự ý đổi creative.") — sau khi
        # thay-tu-choi đổi luôn 10 camp chưa bị từ chối (cùng creative) trong đó 4 camp ACTIVE. Mọi đường (thay-tu-choi, sua-cta, soat_doan) đi qua đây:
        # mỗi ad trong lệnh phải đang DISAPPROVED trên Ethopex (đọc lại camp ngay lúc gửi), không thì chặn cả lệnh.
        nha_ad = {int(c.get("ad_id") or 0): int(i) for i, c in camp_nha().items()}
        nha_ad.update({int(a): int(c) for c, a in (l.split("|") for l in _q("select camp_id, ad_id from etp.camp where ad_id is not null and bo is not null").splitlines() if "|" in l)})
        for a in body["ads"]:
            ad = int(a.get("ad_id") or 0)
            if ad not in nha_ad: raise NgoaiNha(f"ad {ad} không thuộc tài khoản nhà — không gửi")
            d = _goi(f"/api/v1/campaigns/{nha_ad[ad]}", None, timeout)
            x = next((y for g in d.get("ad_groups") or [] for y in g.get("ads") or [] if int(y.get("id") or 0) == ad), None)
            if not x or not (x.get("delivery_status") == "DISAPPROVED" or "DISAPPROVED" in str(x.get("error") or "").upper()):
                # LỆNH TRỰC TIẾP đổi creative (anh 24/11/2026 "chủ động fix luôn các camp bị lỗi này ngay"): vé loai 'truc_tiep' việc doi_cr ĐÚNG camp này → cho qua + đốt vé
                if x and CG.ve_hop_le("doi_cr", [nha_ad[ad]], loai="truc_tiep", dung=True, cho=f"doi_cr ad {ad} → creative {a.get('creative_id')}"): continue
                raise CamThayCreative(f"ad #{ad} (camp #{nha_ad[ad]}) không bị Meta từ chối — cấm tự ý đổi creative (anh 03/11/2026)")
    ids = _id_cham(duong, body if not isinstance(body, list) else {"x": body})
    if body is not None and duong.endswith("/campaigns/facebook"):   # tạo camp (đã qua tài khoản nhà + $1 + cửa ở trên)
        d = _gui(duong, body, timeout, lenh)   # camp vừa tạo (vào tài khoản nhà) có thể chưa hiện trong danh sách → nhớ id để lệnh sau (tạm dừng / lịch) không bị chặn oan
        moi = d.get("id") or (d.get("data") or {}).get("id") or (d.get("campaign") or {}).get("id") if isinstance(d, dict) else None
        if moi and str(moi).isdigit(): _TAO.add(int(moi)); _TRAN_TAO[int(moi)] = tran
        return d
    if body is None and "?" in duong: return doc_het(duong, None, timeout)   # mọi danh sách GET khác (tài khoản QC, Page, pixel, creative…) cũng đủ mọi trang
    ngoai = [i for i in ids if i > 1000 and i not in _TAO and i not in camp_nha()] if body is not None else []   # chỉ lệnh GHI mới gác
    if ngoai:
        # camp vừa tạo chưa kịp vào danh sách đã nạp → đọc lại một lần
        global _NHA; _NHA = None; ngoai = [i for i in ngoai if i not in camp_nha()]
    if ngoai and body is not None: raise NgoaiNha(f"camp {sorted(ngoai)[:5]} không thuộc tài khoản nhà (bộ 1/2/3) — không gửi lệnh (camp ngoài chỉ để xem / học)")
    return _gui(duong, body, timeout, lenh) if body is not None else _goi(duong, body, timeout)

def _gui(duong, body, timeout, lenh):
    """gửi lệnh GHI + ghi sổ cửa etp.cua cho mọi việc của lệnh (cho qua và đã gửi / gửi hỏng); camp vừa tạo ghi id mới"""
    try: d = _goi(duong, body, timeout)
    except Exception as e:
        for l, ve in lenh: _ghi_cua(l, None, f"gửi hỏng: {str(e)[:200]}", ve)
        raise
    moi = (d.get("id") or (d.get("data") or {}).get("id") or (d.get("campaign") or {}).get("id")) if isinstance(d, dict) and isinstance(d.get("data") or {}, dict) else None
    for l, ve in lenh: _ghi_cua(l, True, None, ve, camp_id=moi if l["viec"] in ("tao_camp", "nhan_ban") and str(moi or "").isdigit() else None)
    return d

if __name__ == "__main__" and "--chon-token" in os.sys.argv:   # chọn lại token đang dùng (etp2 nút 🔑 / dong-bo mỗi lượt): một dòng JSON, không in token
    print(json.dumps(chon_token(), ensure_ascii=False)); raise SystemExit(0)
if __name__ == "__main__":   # tự kiểm: python3 ethopex_api.py
    tk0 = sorted(TK)[0]
    # MỘT CỬA (anh 18/11/2026) — phá thử với _goi GIẢ (không lệnh nào tới Ethopex) + phanh chợ giả: lệnh máy (kể cả ★ ROAS, kể cả mang chữ "anh (chat …)") bị chặn,
    # lệnh mang vé qua và vé bị đốt; giảm / tắt luôn qua; mã vé giả (không phải vé thật trong etp.ve_tay) không miễn
    import datetime as _dt
    _bay = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(hours=6)).isoformat()
    _goc_goi, _goc_ch, _goc_ve, _goc_ghi, _gui_that = _goi, CG.doc_cau_hinh, CG.ve_hop_le, _ghi_cua, []
    def _gia(d, b=None, t=90):
        if b is not None: _gui_that.append(d); return {"id": 999999990}
        if "/creatives/" in d:   # creative giả: đúng form (cửa CamLechForm); 777777771 = lệch form, 777777772 = đọc lỗi
            if d.endswith("/777777772"): raise RuntimeError("đọc lỗi giả")
            return {"data": {"call_to_action": FORM["call_to_action"], "link_url": "" if d.endswith("/777777771") else FORM["link_url"],
                             "asset_spec": {k: FORM[k] for k in ("primaryTexts", "headlines", "descriptions")}}}
        return {"campaign": {"budget_daily": 5}, "ad_groups": []}
    _so = []
    globals().update(_goi=_gia, _ghi_cua=lambda l, ok, ly=None, ve=None, camp_id=None: _so.append((l["viec"], ok, bool(ve))))
    CG.doc_cau_hinh = lambda: {"phanh_cho": {"phanh": {"den_tang": _bay, "den_len": _bay, "ly_do": "tự kiểm"}}}
    _goc_pc, CG.PC_CHAN = CG.PC_CHAN, True   # phá thử cơ chế chặn của phanh — sổ luật thật đang để phanh chỉ cảnh báo (anh 22/11/2026), không đổi sổ
    _pl = lambda ten, **sp: {"name": ten, "ad_account_id": tk0, "campaign": {"source_payload": {"name": ten, "daily_budget": 1, **sp}, "ad_groups": [{"source_payload": {}, "ads": [{"content_id": 1, "creative_id": 2}]}]}}
    try:
        os.environ["ETP_VE"] = "0" * 32   # mã đúng dạng nhưng không có trong etp.ve_tay → không miễn
        # camp gốc mẫu: camp nhà KHÔNG thuộc phim cấm (65110 cũ là phim 94344 — cấm từ 19/11/2026, cửa chặn trước phanh)
        _G = int(_q(f"select camp_id from etp.camp where content_id is not null and camp_id not in ({CG.SQL_CAMP_PHIM_CAM}) order by camp_id limit 1"))
        for ten, sp in (("dp1 X EN - creative #2", {}), (f"X (nhan ban 1 cua {_G})", {}), (f"★ ROAS 1 · X roas 1 duplicate by {_G}", {"bid_strategy": "LOWEST_COST_WITH_MIN_ROAS"})):
            try: api("/api/v1/campaigns/facebook", _pl(ten, **sp)); raise SystemExit(f"LỌT PHANH: máy tạo '{ten}'")
            except ChanCua as e: assert "PHANH CHỢ" in str(e), e
        _TAO.add(999999997)
        try: api("/api/v1/campaigns/update", {"campaign": {"campaign_id": 999999997, "source_payload": {"daily_budget": 9}}}); raise SystemExit("LỌT PHANH: máy tăng $5 → $9")
        except ChanCua: pass
        assert not _gui_that, f"cửa để lọt lệnh tới Ethopex: {_gui_that}"
        api("/api/v1/campaigns/update", {"campaign": {"campaign_id": 999999997, "source_payload": {"daily_budget": 3}}})   # giảm luôn qua
        api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [999999997], "status": "paused"}])   # tắt luôn qua
        _dot = []
        CG.ve_hop_le = lambda viec, ids=(), ct=None, dung=False, cho="", ma=None, loai=None: None if loai == "truc_tiep" else (_dot.append((viec, tuple(ids), ct)) if dung else None) or "anh (tự kiểm)"
        api("/api/v1/campaigns/update", {"campaign": {"campaign_id": 999999997, "source_payload": {"daily_budget": 9}}})
        api("/api/v1/campaigns/facebook", _pl(f"X (nhan ban 1 cua {_G})"))
        assert any(v == "tang" and 999999997 in i for v, i, _c in _dot) and any(v == "nhan_ban" and _G in i for v, i, _c in _dot), f"vé phải bị đốt lúc gửi: {_dot}"
        assert len(_gui_that) == 4 and ("tang", True, True) in _so and ("tang", False, False) in _so, (_gui_that, _so)
        print("chặn đúng: một cửa — phanh chặn lệnh máy (camp mới / nhân bản / ★ ROAS / tăng), vé tay qua + bị đốt, giảm / tắt qua, sổ etp.cua ghi đủ")
        # FORM CHỮ (anh 24/11/2026, góp ý #1813): camp mới lên bằng creative lệch form / đọc creative lỗi → chặn trước khi gửi, kể cả có vé; đúng form thì qua
        _n0 = len(_gui_that)
        for _cr in (777777771, 777777772):
            _b = {**_pl("dp1 X EN - creative #2"), "campaign": {"source_payload": {"name": "dp1 X", "daily_budget": 1}, "ad_groups": [{"source_payload": {}, "ads": [{"content_id": 1, "creative_id": _cr}]}]}}
            try: api("/api/v1/campaigns/facebook", _b); raise SystemExit(f"LỌT FORM CHỮ: camp mới lên bằng creative {_cr}")
            except CamLechForm as e: assert ("chưa đúng form" if _cr == 777777771 else "không đọc được") in str(e), e
        assert len(_gui_that) == _n0, f"creative lệch form lọt tới Ethopex: {_gui_that[_n0:]}"
        assert dung_form(_gia("/api/v1/creatives/2")["data"]) and not dung_form(_gia("/api/v1/creatives/777777771")["data"]), "dung_form sai"
        print("chặn đúng: form chữ — camp mới lên bằng creative lệch form / đọc creative lỗi đều chặn dù có vé, creative đúng form qua")
        # PHIM CẤM (anh 19/11/2026) — sổ THẬT ethopex_phim_cam, vé vẫn đang "hợp lệ" (ve_hop_le giả ở trên): bật (cả lịch giờ) / nhân bản / ★ ROAS / tạo camp phim cấm / tăng → chặn
        _r = _q(f"select camp_id || '|' || content_id from etp.camp where camp_id in ({CG.SQL_CAMP_PHIM_CAM}) order by 1 limit 1")
        if _r:
            _cc, _ct = map(int, _r.split("|")); _TAO.add(_cc); _n0 = len(_gui_that)
            _ca = (("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [_cc], "status": "active"}]),
                   ("/api/v1/campaigns/update", {"campaign": {"campaign_id": _cc, "source_payload": {"daily_budget": 9}}}),
                   ("/api/v1/campaigns/facebook", _pl(f"X (nhan ban 1 cua {_cc})")),
                   ("/api/v1/campaigns/facebook", _pl(f"★ ROAS 1 · X roas 1 duplicate by {_cc}", bid_strategy="LOWEST_COST_WITH_MIN_ROAS")),
                   ("/api/v1/campaigns/facebook", {**_pl("dp1 X EN - creative #2"), "campaign": {"source_payload": {"name": "dp1 X", "daily_budget": 1}, "ad_groups": [{"source_payload": {}, "ads": [{"content_id": _ct, "creative_id": 2}]}]}}))
            try:
                for _d, _b in _ca:
                    try: api(_d, _b); raise SystemExit(f"LỌT PHIM CẤM: {_d} camp #{_cc} phim #{_ct}")
                    except ChanCua as e: assert "sổ cấm" in str(e), e
                _so_lich = CG.chan_cua("bat", {}, _cc, ve=True, lich=True, q=_q)   # bật theo lịch giờ (lich=True) cũng phải chặn — không ghi thử vào etp.lich_tat thật
                assert _so_lich and "sổ cấm" in _so_lich, _so_lich
            finally: _TAO.discard(_cc)
            assert len(_gui_that) == _n0, f"phim cấm lọt tới Ethopex: {_gui_that[_n0:]}"
            print(f"chặn đúng: phim cấm #{_ct} (camp #{_cc}) — bật / bật theo lịch / tăng / nhân bản / ★ ROAS / tạo camp đều chặn dù có vé, không lệnh nào tới Ethopex")
        # CHỮ TỰ VIẾT (anh 24/11/2026): tạo creative mang chữ khác form — đơn, bulk-jobs {items}, mảng trần — đều chặn trước khi gửi; đúng form thì cửa này cho qua
        _n0 = len(_gui_that); _fm = {"call_to_action": FORM["call_to_action"], "link_url": FORM["link_url"], "asset_spec": {k: FORM[k] for k in ("primaryTexts", "headlines", "descriptions")}}
        _tv = {**_fm, "name": "TU KIEM CHU TU VIET", "asset_spec": {**_fm["asset_spec"], "primaryTexts": ["Get Out of My Bugatti — watch the full story free. Watch more"]}}
        for _d, _b in [("/api/v1/creatives", _tv), ("/api/v1/creatives/bulk-jobs", {"items": [_fm, _tv]}), ("/api/v1/creatives/bulk-jobs", [_tv]),
                       ("/api/v1/creatives/bulk-jobs", [{**_fm, "call_to_action": "LEARN_MORE"}])]:
            try: api(_d, _b); raise SystemExit(f"LỌT CHỮ TỰ VIẾT: {_d}")
            except CamLechForm as e: assert "khác form" in str(e), e
        assert len(_gui_that) == _n0, f"chữ tự viết lọt tới Ethopex: {_gui_that[_n0:]}"
        assert lech_tao("/api/v1/creatives/bulk-jobs", [_fm, _fm]) == [] and lech_tao("/api/v1/creatives/12/x", _tv) == [] and lech_tao("/api/v1/creatives", None) == []
        print("chặn đúng: tạo creative chữ khác form (đơn / bulk-jobs items / mảng trần / CTA lệch) — không lệnh nào tới Ethopex; đúng form qua cửa")
        # PHIM CẤM — LÊN / GẮN CREATIVE (anh 19/11/2026, phá thử phim 167292 The Dragon's Silly Captive, sổ thật): tạo creative (bulk-jobs / đơn) · gắn creative vào ad
        # của camp phim cấm · creative của phim cấm gắn vào ad bất kỳ · tạo camp · nhân bản camp phim cấm → chặn, vé không miễn, không lệnh nào tới Ethopex
        _P = 167292
        if CG.phim_cam(cts=[_P], q=_q):
            _n0 = len(_gui_that)
            _cc = _q(f"select camp_id from etp.camp where content_id = {_P} order by camp_id limit 1")
            _ad = _q(f"select ad_id from etp.camp where content_id = {_P} and ad_id is not null order by camp_id limit 1")
            _cr = _q(f"select creative_id from etp.creative where content_id = {_P} order by creative_id limit 1")
            _ca = [("/api/v1/creatives/bulk-jobs", {"items": [{"content_id": _P, "name": "TU KIEM PHIM CAM"}]}),
                   ("/api/v1/creatives", {"content_id": _P, "name": "TU KIEM PHIM CAM"}),
                   ("/api/v1/campaigns/facebook", {**_pl("dp1 X EN - creative #2"), "campaign": {"source_payload": {"name": "dp1 X", "daily_budget": 1}, "ad_groups": [{"source_payload": {}, "ads": [{"content_id": _P, "creative_id": 2}]}]}})]
            if _cc: _ca.append(("/api/v1/campaigns/facebook", _pl(f"X (nhan ban 1 cua {_cc})")))
            if _ad: _ca.append(("/api/v1/campaigns/update", {"ads": [{"ad_id": int(_ad), "creative_id": 1}]}))
            if _cr: _ca.append(("/api/v1/campaigns/update", {"ads": [{"ad_id": 1, "creative_id": int(_cr)}]}))
            for _d, _b in _ca:
                try: api(_d, _b); raise SystemExit(f"LỌT PHIM CẤM #{_P}: {_d} {json.dumps(_b)[:120]}")
                except ChanCua as e: assert "sổ cấm" in str(e), e
            assert len(_gui_that) == _n0, f"phim cấm #{_P} lọt tới Ethopex: {_gui_that[_n0:]}"
            assert phim_cam_lenh("/api/v1/creatives/bulk-jobs", {"items": [{"content_id": 1}]}, q=lambda s: "") is None, "phim thường phải qua"
            assert "chặn cho an toàn" in phim_cam_lenh("/api/v1/campaigns/update", {"ads": [{"ad_id": 1, "creative_id": 5}]}, q=lambda s: (_ for _ in ()).throw(RuntimeError("x"))), "lỗi đọc phải chặn"
            print(f"chặn đúng: phim cấm #{_P} — lên creative / gắn creative vào ad / tạo camp / nhân bản ({len(_ca)} ca) đều chặn dù có vé, không lệnh nào tới Ethopex")
        else: print(f"⚠ phim #{_P} không còn trong sổ cấm — bỏ ca phá thử lên creative")
    finally:
        globals().update(_goi=_goc_goi, _ghi_cua=_goc_ghi); CG.doc_cau_hinh, CG.ve_hop_le, CG.PC_CHAN = _goc_ch, _goc_ve, _goc_pc; _TAO.discard(999999997); os.environ.pop("ETP_VE", None)
    # CAMP MỚI $1 Ở CỔNG (phá thử, KHÔNG gửi gì lên Ethopex — mọi ca đều phải bị chặn trước khi gửi)
    for ns, g in ((3, {}), (1, {"daily_budget": 3})):
        pl = {"name": "TU KIEM", "ad_account_id": tk0, "campaign": {"source_payload": {"name": "TU KIEM", "daily_budget": ns}, "ad_groups": [{"source_payload": g}]}}
        try: api("/api/v1/campaigns/facebook", pl); raise SystemExit(f"LỌT: tạo camp ngân sách {ns}/{g}")
        except CamNganSach as e: print("chặn đúng: tạo camp >$1 ·", str(e)[:70])
    # AT SAI DẠNG Ở CỔNG (anh 19/11/2026, phá thử trên sổ thật, KHÔNG gửi gì): creative ảnh tĩnh không Free → tạo camp / đổi creative đều bị chặn
    sai = _q(f"select d.creative_id from etp.diem_cham d where d.cham->'hook'->>'dang' = '{CG.DANG_AT}' and coalesce(d.cham->'cta'->>'mau', '') <> '{CG.CTA_AT}' order by 1 desc limit 1")
    if sai:
        pl = {"name": "TU KIEM AT", "ad_account_id": tk0, "campaign": {"source_payload": {"name": "TU KIEM AT", "daily_budget": 1}, "ad_groups": [{"source_payload": {}, "ads": [{"content_id": 1, "creative_id": int(sai)}]}]}}
        for duong, body in (("/api/v1/campaigns/facebook", pl), ("/api/v1/campaigns/update", {"ads": [{"ad_id": 1, "creative_id": int(sai)}]})):
            try: api(duong, body); raise SystemExit(f"LỌT: {duong} với creative AT sai dạng #{sai}")
            except CamDangAT as e: print("chặn đúng: AT không Free ·", str(e)[:70])
    _TRAN_TAO[999999999] = 1.0
    try: api("/api/v1/campaigns/update", {"campaign": {"campaign_id": 999999999, "source_payload": {"daily_budget": 3}}}); raise SystemExit("LỌT: đặt $3 cho camp vừa tạo")
    except CamNganSach as e: print("chặn đúng: đặt lại >$1 camp vừa tạo ·", str(e)[:70])
    _TRAN_TAO.pop(999999999)
    for body in ({"campaign": {"campaign_id": 999999998, "source_payload": {"daily_budget": 31}}}, {"campaign": {"campaign_id": 999999998, "source_payload": {"daily_budget": "45"}}}):   # trần tuyệt đối $30 (anh 14/11/2026)
        try: api("/api/v1/campaigns/update", body); raise SystemExit(f"LỌT: đặt ngân sách vượt $30 · {body}")
        except CamNganSach as e: print("chặn đúng: vượt trần tuyệt đối ·", str(e)[:70])
    n = camp_nha(); print("camp nhà", len(n), "· tài khoản", sorted(TK))
    sach = next(((int(i), int(c["ad_id"])) for i, c in n.items() if c.get("ad_id") and c.get("state") == "ACTIVE"), None)
    if sach:   # ad đang chạy, không bị từ chối → lệnh đổi creative phải bị chặn
        try: api("/api/v1/campaigns/update", {"ads": [{"ad_id": sach[1], "creative_id": 1}]}); raise SystemExit(f"LỌT: đổi creative ad chưa bị từ chối camp #{sach[0]}")
        except CamThayCreative as e: print("chặn đúng: đổi creative ad chưa bị từ chối ·", str(e)[:60])
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
