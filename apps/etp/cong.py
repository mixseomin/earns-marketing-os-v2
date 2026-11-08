"""CỔNG RÀO CHẮN etp (anh 24/10/2026 — bước 3 etp.on.tc): MỌI lệnh tự động gọi kiem() trước khi gửi lên Ethopex.
kiem(viec, camp_id=None, ns_moi=None, ns_cu=0, bo=None, content_id=None, ngoai=False, tay=False, roas=False, lenh_anh=False, bac=False) → None (cho qua) | câu lý do chặn.
  ngoai=True: camp trong tài khoản QC của người trong team (Luật tự động, apps/cty/worker/etp-tu-dong.mjs) — vẫn qua dừng khẩn / Âu-Mỹ / phim cất / trần camp,
  bỏ trần NGÀY + trần BỘ (hai trần đó cộng ngân sách camp NHÀ trong etp.camp — tiền của người đó không tính vào, cũng không bị trần nhà chặn).
  CHỈ PHIM ÂU-MỸ (anh 29/10/2026 "dừng các phim ngoài âu mỹ … chặn thể loại này khi lên camp target US"): phim có etp.phim.nhom_goc khác au_my
  (trung / an / latin / hoat_hinh / dong_a / da_mau) → chặn mọi việc tăng chi (tạo camp, nhân bản kể cả ROAS, bật lại, tăng). Phim chưa chấm nhóm → chấm poster ngay, thiếu poster thì 4 khung video creative đã chấm (apps/etp/nhom_goc.py, ckey ~13–36₫), không chấm được → chặn (anh 29/10/2026 "làm cho kín").
  TRÙNG PHIM VỚI ĐỘI: BỎ (anh 06/11/2026 "Bỏ tiêu chí ko lên camp cùng người trong đội") — luật 02/11/2026 chặn camp mới phim người khác trong đội đang chạy; nay lên bình thường.
  PHIM ĐÃ CẤT (anh 31/10/2026): etp.phim.thu_vong = 'cat' (apps/etp/cat_phim.py) → chặn tạo camp / nhân bản phim đó; camp đang chạy vẫn để luật tắt xử.
  viec: tang | bat | nhan_ban | tao_camp (làm tăng chi) · giam | tat (luôn cho qua — dừng khẩn vẫn phải hạ được chi)
Đọc etp.cau_hinh (dung_khan · tran_ngay · tran_camp · tran_bo · tran_camp_moi_ngay) + etp.camp (tổng ngân sách camp đang bật). Lỗi đọc kho → CHẶN (an toàn trước, không đoán).
Dùng trong script khác: sys.path.insert(0, '/opt/earns-marketing-os-v2/apps/etp'); import cong; ly = cong.kiem('tang', cid, 15, 10)"""
import json, os, subprocess
TANG = {"tang", "bat", "nhan_ban", "tao_camp"}
# TRẦN CAMP MỚI / NGÀY — một nguồn cho cổng này và máy dòng phim (dong_phim.mo_tran_ngay nhận dòng dừng vì trần bằng KHOA_TRAN_NGAY có trong lý do, đếm chỗ còn bằng SQL_TAO_HOM_NAY)
KHOA_TRAN_NGAY = "tran_camp_moi_ngay"
# BỘ LÊN CAMP MỚI — một nguồn (anh 08/11/2026 "Bộ 1 = 50% Kiên… Sửa đi" + "1 phim ở nhiều bộ thoải mái"): camp mới của creative (dòng phim, worker phim mới,
# nút lên camp etp.on.tc, len-sau-cham, thay-the) lên bộ etp.cau_hinh.bo_phim_moi, phim đã chạy bộ khác cũng vậy. Nhân bản / thang / ROAS ở bộ camp gốc.
SQL_BO_PHIM = "select gia_tri#>>'{{}}' from etp.cau_hinh where khoa = 'bo_phim_moi'"
SQL_TAO_HOM_NAY = "select count(*) from etp.camp where (tao at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date"

def _q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=30)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-200:])
    return r.stdout.strip()

LY_AU_MY = "phim nhóm gốc '{}' — chỉ chạy phim Âu-Mỹ (anh 29/10/2026: dừng các phim ngoài Âu-Mỹ, chặn khi lên camp; nhóm chấm trên poster, etp.phim.nhom_goc)"
LY_CAT = "phim #{0} đã cất ({1}) — thử đủ creative + đủ bộ mà chưa camp nào lãi; tự mở lại khi camp nhà / team lãi, mở tay: python3 apps/etp/cat_phim.py --mo {0}"

def phim_chan_len():
    """{content_id: lý do} — phim cổng CHẮC CHẮN chặn tạo camp / nhân bản, không phụ thuộc creative hay ngân sách (đã chấm nhóm ngoài Âu-Mỹ · đã cất).
    Máy chọn việc (thay-the.py) lọc trước bằng hàm này: 31/10/2026 máy thay camp thử 450 lần thì 445 lần bị chặn Âu-Mỹ — mỗi lần một lượt gọi Ethopex + một dòng nhật ký.
    Phim chưa chấm nhóm không có ở đây (kiem() chấm ngay lúc lên)."""
    ra = {}
    for l in _q("select content_id, coalesce(nhom_goc, ''), coalesce(thu_vong, ''), coalesce(thu_ly, '') from etp.phim where (nhom_goc is not null and nhom_goc <> 'au_my') or thu_vong = 'cat'").splitlines():
        cid, ng, tv, tl = l.split("|", 3)
        ra[int(cid)] = LY_AU_MY.format(ng) if ng and ng != "au_my" else LY_CAT.format(cid, tl)
    return ra

def kiem(viec, camp_id=None, ns_moi=None, ns_cu=0, bo=None, content_id=None, ngoai=False, tay=False, roas=False, lenh_anh=False, bac=False):
    if viec not in TANG: return None
    try:
        ct = content_id if content_id is not None else (_q(f"select content_id from etp.camp where camp_id = {int(camp_id)}") or None) if camp_id else None
        ng = _q(f"select coalesce(nhom_goc, '') from etp.phim where content_id = {int(ct)}") if ct else ''
        if ct and not ng:   # KÍN (anh 29/10/2026 "làm cho kín"): phim chưa chấm → chấm poster NGAY (nhom_goc.py, ckey ~36₫/phim); không chấm được → CHẶN
            import importlib.util as _iu
            _s = _iu.spec_from_file_location("nhom_goc", os.path.join(os.path.dirname(os.path.abspath(__file__)), "nhom_goc.py")); NG = _iu.module_from_spec(_s); _s.loader.exec_module(NG)
            ng, _chi, _ly = NG.cham(int(ct))
            if not ng: return f"phim #{ct} chưa chấm được nhóm gốc ({_ly}) — chỉ lên camp phim Âu-Mỹ đã chấm (anh 29/10/2026 'làm cho kín')"
        if ng and ng != 'au_my': return LY_AU_MY.format(ng)
        if ct and viec in ("nhan_ban", "tao_camp"):   # PHIM ĐÃ CẤT (anh 31/10/2026): thử đủ creative + đủ bộ, team không lãi → thôi lên camp mới (apps/etp/cat_phim.py)
            cl = _q(f"select coalesce(thu_ly, '') from etp.phim where content_id = {int(ct)} and thu_vong = 'cat'")
            if cl: return LY_CAT.format(ct, cl)
        ch = {k: json.loads(v) for k, v in (l.split("|", 1) for l in _q("select khoa, gia_tri::text from etp.cau_hinh").splitlines() if l)}
        if ch.get("dung_khan"): return "ĐANG DỪNG KHẨN (etp.cau_hinh.dung_khan) — không tăng / bật / nhân bản / tạo camp"
        if viec == "tang" and not roas and (ch.get("mua_le") or {}).get("khoa_tang"):   # mùa lễ Mỹ (apps/etp/mua_le.py, anh 08/11/2026): Meta học lại đúng tuần giá cao là tốn nhất
            return f"mùa lễ Mỹ: khoá tăng bậc ({(ch.get('mua_le') or {}).get('ly_do') or '25–30/11'}) — giảm / tắt / camp mới vẫn chạy (etp.cau_hinh.mua_le, apps/etp/mua_le.py)"
        # CAMP MỚI = $1 (anh 08/11/2026: "Ai cho mày lên camp mới ngân sách hơn $1" · "AB test vẫn phải đi từ $1. Nếu khác thì phải xin phép"): tạo camp / nhân bản thường
        # (kể cả camp A/B, clone sang bộ khác) gửi ngân sách > $1 → chặn. Miễn: camp ROAS (roas=True, loại anh duyệt 26/10/2026) · bản thang (bac=True, thang nhân bản anh duyệt 25/10/2026)
        if viec in ("tao_camp", "nhan_ban") and not roas and not bac and ns_moi is not None and float(ns_moi) > 1:
            return f"camp mới phải $1 — đang gửi ${float(ns_moi):g} (anh 08/11/2026); ngân sách khác phải xin anh"
        if ch.get("dung_camp_moi") and viec in ("nhan_ban", "tao_camp"): return "ĐANG DỪNG LÊN CAMP MỚI (anh 25/10/2026: chờ rà soát hết creative + quy trình soát) — tăng / giảm / thay creative vẫn chạy"
        them = float(ns_moi or 1) - float(ns_cu or 0)   # camp mới / nhân bản = $1
        tc = ch.get("tran_camp")
        # A/B ROAS TĂNG $30 (anh 08/11/2026 "Camp ROAS làm thêm thử nghiệm tăng bậc <=1.5 lần đến max $30 cho 1 vài camp"): camp nhánh THỬ của lần A/B
        # kiểu roas_tang đang chạy (etp.ab + etp.camp_ab, apps/etp/ab_mau.py) được qua trần tới $30 — chỉ đúng camp đó, mọi camp khác giữ tran_camp
        if tc is not None and ns_moi is not None and float(ns_moi) > float(tc) and camp_id and float(ns_moi) <= 30 and _q(f"""select 1 from etp.camp_ab a join etp.ab b on b.ma = a.ab
                where a.camp_id = {int(camp_id)} and a.nhanh = 'thu' and a.loai_tru is null and b.kieu = 'roas_tang' and b.trang_thai = 'dang' limit 1"""): tc = 30
        if tc is not None and ns_moi is not None and float(ns_moi) > float(tc): return f"vượt trần ${tc}/camp (etp.cau_hinh.tran_camp)"
        if ngoai: return None
        tcm = ch.get(KHOA_TRAN_NGAY)   # TRẦN CAMP MỚI MỖI NGÀY (anh 07/11/2026 chốt 100 camp thử / ngày): đếm camp nhà tạo trong ngày VN, kể cả bản nhân
        # lenh_anh: clone SANG BỘ KHÁC theo lệnh đích danh của anh trong lượt (nhan-ban.py --bo --ep; anh 08/11/2026 "50 camp này dup luôn sang tk số 4" — bản thay
        # cho camp bộ 2 không tiêu) → không tính vào trần camp mới / ngày; mọi cổng khác giữ nguyên
        if tcm is not None and viec in ("nhan_ban", "tao_camp") and not lenh_anh:
            so = int(_q(SQL_TAO_HOM_NAY) or 0)
            if so >= int(tcm): return f"hôm nay đã tạo {so} camp, chạm trần {tcm} camp mới / ngày (etp.cau_hinh.{KHOA_TRAN_NGAY}) — mai lên tiếp (dong_phim.mo_tran_ngay tự FIX sang ngày mới)"
        tn = ch.get("tran_ngay")
        if tn is not None:
            tong = float(_q("select coalesce(sum(ngan_sach), 0) from etp.camp where trang_thai = 'ACTIVE'") or 0)
            if tong + them > float(tn): return f"tổng ngân sách ngày ${tong:.0f} + ${them:.0f} vượt trần ${tn} (etp.cau_hinh.tran_ngay)"
        tb = (ch.get("tran_bo") or {})
        if bo is None and camp_id: bo = _q(f"select coalesce(bo, '') from etp.camp where camp_id = {int(camp_id)}") or None
        if bo and str(bo) in tb:
            tong = float(_q(f"select coalesce(sum(ngan_sach), 0) from etp.camp where trang_thai = 'ACTIVE' and bo = '{str(bo)}'") or 0)
            if tong + them > float(tb[str(bo)]): return f"bộ {bo}: ${tong:.0f} + ${them:.0f} vượt trần ${tb[str(bo)]} (etp.cau_hinh.tran_bo)"
        return None
    except Exception as e:
        return f"không đọc được rào chắn etp ({str(e)[:80]}) — chặn cho an toàn"

# CAMP ROAS (tài liệu Support 26/10/2026; anh: "Camp ROAS là 1 dạng riêng, miễn hết các luật"): nhận diện bằng TÊN — nhan-ban.py --roas luôn đặt
# "★ … roas X duplicate by <gốc>" (★ hiện ở mọi nơi có tên camp: Report Ethopex, Telegram, etp.on.tc, Ads Manager). Mọi luật / lịch giờ lọc qua đây.
# Camp ROAS do NGƯỜI TRONG TEAM tự lên (31/10/2026, kho etp.camp_ngoai): "…_D69655_ROAS1" · "…_V1_D2 (ROAS)" · "Dup by 66168 ROAS 1.1" — chữ ROAS đứng riêng
# (không có camp nhà nào khớp mẫu này, đếm 31/10/2026: 0). Không nhận thì camp ROAS của team bị chấm như camp thường (L3 / T2 tắt) và máy lên ROAS trùng gốc.
import re as _re
_ROAS_TEAM = _re.compile(r"(?:^|[\s_(])ROAS[\d.]*(?=$|[\s_)])")   # [\d.]: "ROAS1.2_S_…" (Sơn) — bản \d* cũ bỏ sót
def la_roas(x):
    """camp ROAS? x = camp (dict API / kho) hoặc tên. CHIẾN LƯỢC THẦU THẬT trước (anh 02/11/2026 — camp Kiên không đặt tên vẫn nhận):
    source_bidding_strategy / chien_luoc = LOWEST_COST_WITH_MIN_ROAS; chưa có chiến lược thì mới đọc tên. Cùng luật cột etp.*.la_roas (0401) + lib/etp-roas.ts."""
    if isinstance(x, dict):
        cl = x.get("source_bidding_strategy") or x.get("chien_luoc")
        if cl: return cl == "LOWEST_COST_WITH_MIN_ROAS"
        x = x.get("name") or x.get("ten")
    ten = x or ""
    return " duplicate by " in ten or ten.lstrip().startswith("★") or bool(_ROAS_TEAM.search(ten))
_GOC_ID = _re.compile(r"(?:duplicate by|dup by|_D)\s*(\d{5,})", _re.I)
_DUOI = _re.compile(r"(?:_D\d+)?(?:[_\s]ROAS[\d.\s]*|\s*\(ROAS\))\s*$")
def goc_roas(camps):
    """camp gốc ĐÃ CÓ camp ROAS (đọc từ tên, mọi kiểu đặt tên: nhà "duplicate by <gốc>", team "_D<gốc>" / "Dup by <gốc>", hoặc tên camp ROAS bỏ đuôi
    "_D2 (ROAS)" trùng tên gốc) → máy không lên ROAS lại cho gốc đó. camps = [{id, name}] (danh sách camp Ethopex)."""
    ro = [c.get("name") or "" for c in camps if la_roas(c)]
    ids = {int(m.group(1)) for n in ro for m in [_GOC_ID.search(n)] if m}
    goc_ten = {_DUOI.sub("", n).strip() for n in ro}
    return ids | {int(c["id"]) for c in camps if not la_roas(c) and (c.get("name") or "").strip() in goc_ten}
def camp_roas():
    """tập camp ROAS trong kho etp (đồng bộ 10 phút) — luật đọc API trực tiếp thì cộng thêm la_roas(tên)"""
    return {int(x) for x in _q("select camp_id from etp.camp where la_roas").split() if x.isdigit()}

# CAMP MỚI = $1, ĐỌC NGAY TRÊN PAYLOAD GỬI ĐI (anh 08/11/2026 "Rà ngay" sau vụ 52 camp A/B lên $3): kiem() ở trên tin số ns_moi + cờ roas/bac do NGƯỜI GỌI
# tự khai — người gọi tính sai (A/B đặt $3 vào payload sau khi cổng đã nhận "1") là lọt. Hàm này đọc CHÍNH lệnh tạo camp ở cổng API chung
# (ethopex_api.api, POST /campaigns/facebook — mọi đường tạo camp đi qua đó): mọi trường *budget* ở mọi tầng (campaign + Ad Set). Miễn theo VẬT, không theo cờ:
#   camp ROAS = chiến lược thầu LOWEST_COST_WITH_MIN_ROAS, $15–20 (Support 26/10/2026) · bản thang = tên "(thang $X cua <gốc>)", tới đúng $X (anh 25/10/2026).
# Trả (lý do chặn | None, trần ngân sách cho camp vừa tạo) — trần dùng tiếp cho lệnh đặt lại ngân sách ngay sau khi tạo (ethopex_api: camp trong _TAO).
def ns_tao(body):
    import re
    cp = (body or {}).get("campaign") or {}
    sp = cp.get("source_payload") or {}
    if isinstance(sp, str): sp = json.loads(sp or "{}")
    so = []
    def di(o):
        if isinstance(o, str) and o.strip().startswith("{"):
            try: o = json.loads(o)
            except ValueError: return
        if isinstance(o, dict):
            for k, v in o.items():
                if "budget" in k.lower() and not isinstance(v, bool) and isinstance(v, (int, float, str)) and str(v).replace(".", "", 1).isdigit(): so.append((k, float(v)))
                else: di(v)
        elif isinstance(o, list):
            for x in o: di(x)
    di(body)
    ten = str(sp.get("name") or body.get("name") or "")
    m = re.search(r"\(thang \$(\d+(?:\.\d+)?) cua \d+\)\s*$", ten)
    if sp.get("bid_strategy") == "LOWEST_COST_WITH_MIN_ROAS": tran, loai = 20.0, "camp ROAS"
    elif m: tran, loai = float(m.group(1)), "bản thang"
    else: tran, loai = 1.0, "camp mới"
    vuot = [(k, v) for k, v in so if v > tran]
    if vuot: return f"{loai} '{ten[:60]}' gửi {', '.join(f'{k}=${v:g}' for k, v in vuot)} > ${tran:g} — camp mới phải $1 (anh 08/11/2026), ngân sách khác phải xin anh", tran
    if not any(k == "daily_budget" for k, _ in so): return f"lệnh tạo camp '{ten[:60]}' không có daily_budget — không gửi (Ethopex có thể tự đặt mức khác)", tran
    return None, tran

def _tu_kiem():
    for t in ("★ ROAS 1.1 · X roas 1.1 duplicate by 65720", "S_FB_The-Dragons_167292_EN_EP8_x10_D69655_ROAS1", "S_FB_Max_153695_EN_VD-FULL-EP1_V1_D2 (ROAS)", "Dup by 66168 ROAS 1.2"):
        assert la_roas(t), t
    for t in ("2110 Number One Nobody EN - canh that 1400-1470s", "S_FB_Prosaic_ROASTED_x2", "S_FB_Max_153695_EN_VD-FULL-EP1_V1"):
        assert not la_roas(t), t
    assert la_roas("ROAS1.2_S_FB_The-Dragons-Silly-Captive_167292_EN_EP8_x3_D_69343") and la_roas("ROAS1.1_S_2210 Step Back EN")
    assert la_roas({"name": "S_FB_Dragons_x10", "source_bidding_strategy": "LOWEST_COST_WITH_MIN_ROAS"})   # Kiên: không đặt tên vẫn là ROAS
    assert not la_roas({"name": "★ ROAS 1 · Y roas 1 duplicate by 65720", "source_bidding_strategy": "LOWEST_COST_WITHOUT_CAP"})   # chiến lược thật thắng tên
    assert la_roas({"ten": "x", "chien_luoc": "LOWEST_COST_WITH_MIN_ROAS"}) and la_roas({"name": "Dup by 66168 ROAS 1.1"}) and not la_roas({"name": "S_FB_x1"})
    cs = [{"id": 66420, "name": "S_FB_Max_153695_EN_VD-FULL-EP1_V1"}, {"id": 1, "name": "S_FB_Max_153695_EN_VD-FULL-EP1_V1_D2 (ROAS)"},
          {"id": 69655, "name": "S_FB_Dragons_x10"}, {"id": 2, "name": "S_FB_Dragons_x10_D69655_ROAS1"}, {"id": 3, "name": "Dup by 66168 ROAS 1.1"},
          {"id": 70000, "name": "S_FB_Khac_x1"}, {"id": 4, "name": "★ ROAS 1 · Y roas 1 duplicate by 65720"}]
    assert goc_roas(cs) == {66420, 69655, 66168, 65720}, goc_roas(cs)
    # camp mới $1 đọc trên payload — phá thử: mỗi ca sai phải đỏ
    _pl = lambda ns, ten="X EN - anh tinh 0-9s", bid=None, g=None: {"name": ten, "campaign": {"source_payload": {"name": ten, "daily_budget": ns, **({"bid_strategy": bid} if bid else {})},
                                                                       "ad_groups": [{"source_payload": g or {"name": ten + " · adset"}}]}}
    assert ns_tao(_pl(1))[0] is None
    assert ns_tao(_pl(3))[0], "camp mới $3 phải chặn"
    assert ns_tao(_pl(1, g={"daily_budget": 3}))[0], "ngân sách $3 nấp ở Ad Set phải chặn"
    assert ns_tao(_pl(1, g={"lifetime_budget": "50"}))[0], "lifetime_budget ở Ad Set phải chặn"
    assert ns_tao({"name": "X", "campaign": {"source_payload": {"name": "X"}, "ad_groups": []}})[0], "thiếu daily_budget phải chặn"
    assert ns_tao(_pl(18, bid="LOWEST_COST_WITH_MIN_ROAS"))[0] is None and ns_tao(_pl(25, bid="LOWEST_COST_WITH_MIN_ROAS"))[0], "ROAS tới $20"
    assert ns_tao(_pl(18, ten="★ ROAS 1.1 · X duplicate by 1"))[0], "tên ROAS mà không có chiến lược thầu ROAS → vẫn là camp mới $1"
    assert ns_tao(_pl(5, ten="X (thang $5 cua 87811)")) == (None, 5.0) and ns_tao(_pl(10, ten="X (thang $5 cua 87811)"))[0], "bản thang tới đúng $X"
    assert ns_tao(_pl(3, ten="X (thang $5 cua 87811) copy"))[0], "chữ thang giữa tên không tính"
    assert ns_tao(_pl(1, g={"is_adset_budget_sharing_enabled": True}))[0] is None, "cờ boolean không phải ngân sách"
    print("✓ cong.py tự kiểm (nhận camp ROAS mọi kiểu tên + gốc đã có ROAS + camp mới $1 trên payload: 10 ca)")

if __name__ == "__main__":
    import sys; a = sys.argv[1:]
    if a[:1] == ["--tu-kiem"]: _tu_kiem(); sys.exit(0)
    print(kiem(a[0], int(a[1]) if len(a) > 1 and a[1].isdigit() else None, float(a[2]) if len(a) > 2 else None, float(a[3]) if len(a) > 3 else 0) or "CHO QUA")
