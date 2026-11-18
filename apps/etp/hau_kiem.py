#!/usr/bin/env python3
"""HẬU KIỂM CỬA (anh 18/11/2026 "kiểm soát tuyệt đối" — lớp 3, Huy): mỗi lượt đồng bộ (dong-bo.py, 10 phút) so thay đổi THẬT trên Ethopex của camp tài khoản nhà
với sổ cửa etp.cua (cửa API apps/etp/ethopex_api.api ghi mọi lệnh cho qua). CHỈ ĐỌC + BÁO — không tắt camp, không đổi gì trên Ethopex.
  · camp MỚI không có dòng cửa cho qua (tao_camp / nhan_ban) và không có nhật ký máy tạo (etp.nhat_ky ok) → LỌT CỬA
  · NGÂN SÁCH TĂNG mà không có dòng cửa tang / dat_sau_tao cho camp đó trong khoảng giữa hai lượt
  · camp BẬT (PAUSED → ACTIVE) mà không có dòng cửa bat (kể cả bật theo lịch giờ) và không phải camp vừa tạo hẹn giờ chạy (tạo qua cửa trong 3 ngày)
  Lọt (kể cả do menu "Auto Camp Config" của Ethopex, người bấm trên app.ethopex.dev, hay đường chưa biết) → etp.canh_bao đỏ 'cua_lot' (Telegram 📂 Ethopex qua phòng
  Ethopex cty, biển đỏ đầu trang etp2). Kèm đọc Auto Camp Config của Ethopex (GET /api/v1/campaign-auto-configs — mã app.ethopex.dev 18/11/2026: trạng thái
  pending / checking = Ethopex sắp TỰ tạo camp) → báo đỏ khi có cấu hình đang chờ / đang kiểm.
Dùng: dong-bo.py gọi chup() TRƯỚC khi ghi trạng thái mới vào etp.camp và xet() ở CUỐI lượt (sau khi chép nhật ký). Chạy tay: python3 hau_kiem.py --tu-kiem"""
import json, os, re

LOAI = "cua_lot"
DAU = "🚨 LỌT CỬA"   # đầu câu cảnh báo — trang etp2 dựng biển đỏ theo chữ này (etp-view BienLotCua)
SQL_BANG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ve_tay.sql")

def dam_bao_bang(q):
    """bảng etp.ve_tay + etp.cua (create if not exists) — chạy mỗi lượt, rẻ"""
    q(open(SQL_BANG).read())

def chup(q):
    """{camp_id: (trạng thái, ngân sách)} của kho etp.camp TRƯỚC khi lượt này ghi trạng thái mới + mốc giờ (now) của kho"""
    ra = {}
    for l in q("select camp_id, trang_thai, coalesce(ngan_sach, 0) from etp.camp").splitlines():
        p = l.split("|")
        if len(p) == 3 and p[0].isdigit(): ra[int(p[0])] = (p[1], float(p[2] or 0))
    return ra, q("select now()")

def doi(cu, ds):
    """hàm thuần: [(loại, camp_id, chữ)] thay đổi làm TĂNG CHI giữa kho cũ và danh sách camp nhà vừa đọc (loại: moi | tang | bat). cu rỗng = lượt đầu → không so."""
    if not cu: return []
    ra = []
    for c in ds:
        i, tt, ns = int(c["id"]), c.get("state"), float(c.get("budget_daily") or 0)
        ten = re.sub(r"^\d+:\s*", "", str(c.get("name") or ""))[:80]
        if i not in cu: ra.append(("moi", i, f"camp mới #{i} '{ten}' ${ns:g} ({tt})")); continue
        tt0, ns0 = cu[i]
        if ns > ns0 + 1e-6: ra.append(("tang", i, f"#{i} '{ten}' ngân sách ${ns0:g} → ${ns:g}"))
        if tt == "ACTIVE" and tt0 != "ACTIVE": ra.append(("bat", i, f"#{i} '{ten}' {tt0} → ACTIVE (${ns:g})"))
    return ra

def _co_cua(q, loai, cid, tu):
    """có dòng cửa cho qua (hoặc nhật ký máy) giải thích thay đổi này không"""
    tu_ = f"'{tu}'::timestamptz - interval '20 minutes'"
    if loai == "moi":
        return q(f"""select (exists (select 1 from etp.cua where ok and viec in ('tao_camp', 'nhan_ban') and camp_id = {cid})
            or exists (select 1 from etp.nhat_ky where ok and camp_id = {cid} and viec in ('tao_camp', 'nhan_ban', 'roas', 'sang_bo')))::text""") == "true"
    if loai == "tang":
        return q(f"""select exists (select 1 from etp.cua where ok and viec in ('tang', 'dat_sau_tao') and camp_id = {cid} and luc >= {tu_})::text""") == "true"
    # bật: có lệnh bật qua cửa, HOẶC camp vừa tạo qua cửa (tạo PAUSED hẹn giờ — Ethopex tự bật tới giờ chạy, lich_len) trong 3 ngày
    return q(f"""select (exists (select 1 from etp.cua where ok and viec = 'bat' and camp_id = {cid} and luc >= {tu_})
        or exists (select 1 from etp.cua where ok and viec in ('tao_camp', 'nhan_ban') and camp_id = {cid} and luc > now() - interval '3 days')
        or exists (select 1 from etp.nhat_ky where ok and camp_id = {cid} and viec in ('tao_camp', 'nhan_ban', 'roas', 'sang_bo') and luc > now() - interval '3 days'))::text""") == "true"

def bao(q, khoa, chu):
    j = json.dumps([{"loai": LOAI, "muc": "do", "khoa": khoa, "noi_dung": chu}], ensure_ascii=False)
    q(f"insert into etp.canh_bao (loai, muc, khoa, noi_dung) select loai, muc, khoa, noi_dung from jsonb_to_recordset($J${j}$J$::jsonb) as x(loai text, muc text, khoa text, noi_dung text) on conflict (khoa) do nothing")

def xet(q, chup_cu, ds, auto=None):
    """so + báo. chup_cu = chup() đầu lượt; ds = camp nhà vừa đọc; auto = hàm GET Ethopex (None = bỏ đọc Auto Camp Config). → {lot: [...], auto: {...}}"""
    cu, nay = chup_cu
    # khoảng giữa hai lượt: thay đổi thấy lượt này xảy ra sau lúc lượt TRƯỚC đọc Ethopex (≈ bat_dau lượt trước) — dòng cửa tìm từ mốc đó (trừ 20 phút dư)
    tu = q(f"select coalesce(max(bat_dau), '{nay}'::timestamptz - interval '30 minutes') from etp.dong_bo where bat_dau < '{nay}'::timestamptz - interval '1 minute'")
    # SỔ CỬA CHƯA ĐỦ CŨ (lượt đầu sau khi cửa lên): lệnh tăng / bật của bản mã cũ không có dòng cửa → chưa so tăng / bật, camp mới vẫn so (nhật ký máy có sẵn)
    du_cu = q(f"select coalesce(min(luc) < '{tu}'::timestamptz, false)::text from etp.cua") == "true"
    lot = [(k, i, s) for k, i, s in doi(cu, ds) if (k == "moi" or du_cu) and not _co_cua(q, k, i, tu)]
    ngay = q("select to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')")
    for k, i, s in lot:
        bao(q, f"{LOAI}:{k}:{i}:{ngay}", f"{DAU}: {s} — Ethopex có thay đổi làm tăng chi mà cửa API không cho qua lệnh nào (máy không tự làm; có thể do Auto Camp Config của Ethopex, "
                                           f"người bấm trên app.ethopex.dev, hoặc đường gọi thẳng chưa qua cửa). Máy chỉ báo, không tắt — anh / người phụ trách xem camp này.")
    ra = {"lot": [f"{k}:{i}" for k, i, _ in lot]}
    if auto:
        try:
            d = auto("/api/v1/campaign-auto-configs?page=1&page_size=100") or {}
            from collections import Counter
            dem = Counter(str(r.get("status") or "?") for r in d.get("data") or [])
            ra["auto"] = dict(dem)
            cho = dem.get("pending", 0) + dem.get("checking", 0)
            if cho: bao(q, f"{LOAI}:auto:{ngay}", f"{DAU}: Auto Camp Config của Ethopex đang có {cho} cấu hình chờ / đang kiểm (pending / checking) — Ethopex sẽ TỰ tạo camp, "
                                                  f"không qua cửa API và không qua phanh chợ. Tắt ở app.ethopex.dev › Campaign › Auto Camp Config nếu không phải anh đặt.")
        except Exception as e: ra["auto"] = f"không đọc được: {str(e)[:120]}"
    return ra

def _tu_kiem():
    cu = {1: ("ACTIVE", 1.0), 2: ("PAUSED", 3.0), 3: ("ACTIVE", 5.0)}
    ds = [{"id": 1, "state": "ACTIVE", "budget_daily": 2}, {"id": 2, "state": "ACTIVE", "budget_daily": 3}, {"id": 3, "state": "ACTIVE", "budget_daily": 3},
          {"id": 4, "state": "PAUSED", "budget_daily": 1, "name": "123: X"}]
    d = {(k, i) for k, i, _ in doi(cu, ds)}
    assert d == {("tang", 1), ("bat", 2), ("moi", 4)}, d   # giảm (#3) không phải lọt; camp mới đủ
    assert doi({}, ds) == [], "lượt đầu (kho trống) không so"
    assert all(s.startswith("camp mới #4 'X'") for k, i, s in doi(cu, ds) if k == "moi")
    print("✓ hau_kiem tự kiểm: tăng / bật / camp mới được nhận, giảm không báo, lượt đầu không so")

if __name__ == "__main__":
    import sys
    if "--tu-kiem" in sys.argv: _tu_kiem()
