#!/usr/bin/env python3
"""THANG CHUYỂN HƯỚNG / CẤT PHIM (anh 31/10/2026: "Phần sinh camp thay thế đã tự động nhg nếu sau nhiều lần thử mà ko có camp lãi, film lởm,... thị trường,...
thì làm thế nào" → "Đc làm đi"). Chỉ xét phim CHƯA có camp cơ hội (etp.camp_co_hoi: chi ≥ $1 ROI ≥ 50%, hoặc chi ≥ $3 lãi) — phim có thì scale, không cất (anh 06/11/2026).
  vòng 1  đổi creative theo dạng (thay-the.py, như trước)
  vòng 2  chi thử ≥ cau_hinh.cat_phim.chi mà ROI < .roi, mới thử < .so_bo bộ → thu_vong 'doi_bo': camp mới kế tiếp lên bộ chưa thử (bo_moi, đọc qua cong.SQL_BO_PHIM)
  vòng 3  team (camp ngoài) lãi phim đó 14 ngày → KHÔNG cất, báo nạp creative team (nap-creative-ngoai.py — chấm là lượt AI, chờ lệnh)
  vòng 4  CẤT PHIM ĐÃ BỎ (anh 23/11/2026): không còn thu_vong 'cat' / 'sap_cat'; phim còn ở hai vòng đó được mở lại ở lượt xét kế
Dùng: python3 cat_phim.py [--that]   (không --that = chạy khô, in sẽ làm gì) · python3 cat_phim.py --mo <content_id>  (anh mở tay một phim)
Trong script khác: import cat_phim; bao, doi_bo = cat_phim.xet(that=True)   → doi_bo = {content_id: bộ nên lên}"""
import json, os, subprocess, sys

MAC = {"chi": 25, "roi": -30, "chi_doi_bo": 50, "so_bo": 2, "bo": ["1", "2", "3"], "so_thu": 4,
       # THỬ ĐỦ DẠNG TRƯỚC KHI CẤT (anh 04/11/2026: "mới thử 5 camp cho 1 thể loại thì chưa đủ để kết luận film chưa ổn. Các định dạng như CC, CT, KT chưa thử thì làm sao biết đúng"):
       # cất chỉ khi MỖI dạng trong dang_can đã có ≥ so_moi_dang camp có chi (≥ $1) mà vẫn chưa camp nào lãi; thiếu dạng → chờ (sap_cat, ghi dạng thiếu) để camp thay / Sản xuất lên đúng dạng đó
       "dang_can": ["cảnh cuối", "cảnh thật", "kể chuyện"], "so_moi_dang": 2, "cho_dang_ngay": 3,
       # CẤT SỚM (anh 09/11/2026 "Chốt. Triển khai luôn" — review: 35 phim 'chưa thử đủ dạng' vẫn nhận 97 camp mới / 7 ngày, lỗ $82): phim chưa có camp cơ hội,
       # chi ≥ som_chi, ROI ≤ som_roi%, đã thử ≥ som_dang dạng (mỗi dạng ≥ 1 camp chi ≥ $1) → cất luôn, không chờ dạng thứ 3. Đo 09/11: 18 phim, 89 camp mới / 7 ngày lỗ $102.
       "som_chi": 15, "som_roi": -30, "som_dang": 2}   # so-dang: chính sách (dạng phải thử trước khi cất, không phải bảng tra) · chờ dạng thiếu quá cho_dang_ngay ngày mà không ai lên được dạng đó → cất (CT chưa có máy tự sản xuất)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import so_dang as DG   # SỔ DẠNG một nơi (etp-dang.json)
TEN_DANG = DG.MA
# CẤT THEO SỐ LẦN THỬ + BÃO HOÀ (anh 02/11/2026 "Đã có luật drop film nếu thử nhiều lần mà ko thành công chưa?" · "hoặc đến lúc film bão hoà" ·
# "Phải show pending, chạm vào cột Luật của dòng Phim"):
#   thử so_thu camp có chi (≥ $1) mà chưa camp nào lãi → cất (đo 19/10–02/11: 29 phim chạm mốc 4 camp, 0 phim về sau thắng; chi sau mốc $142, lãi −$53)
#     — camp thứ so_thu − 1 chưa lãi → 'sap_cat' (chờ, hiện trên dòng phim etp) · phim bão hoà (etp.phim_bao_hoa) mà ROI phim cả hệ hôm qua < 0 → cất, ghi "bão hoà: …",
#     hết bão hoà / hết lỗ thì tự mở lại (camp lãi cũ KHÔNG mở lại phim bão hoà). Mốc thử dùng cùng cau_hinh.cat_phim (so_thu).

def _q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=60)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-200:])
    return r.stdout.strip()
def _qj(s): return json.loads(_q(f"select coalesce(json_agg(t), '[]') from ({s}) t") or "[]")
s_ = lambda t: str(t or "").replace("'", "''")

def cau_hinh():
    try: return {**MAC, **json.loads(_q("select gia_tri::text from etp.cau_hinh where khoa = 'cat_phim'") or "{}")}
    except Exception: return dict(MAC)

def so_phim():
    """mỗi phim có camp nhà: chi / thu cộng dồn, có camp lãi không, các bộ đã thử, trạng thái thang · team 14 ngày"""
    import gia_adsense as GA
    return _qj("""with c as (select c.content_id, c.camp_id, coalesce(c.bo, '') bo, coalesce((select r.dang from etp.creative r where r.creative_id = c.creative_id), '') dang, coalesce(sum(n.chi), 0) chi, coalesce(sum(n.thu / {HS}), 0) thu   -- thu bù giá AdSense ngày giá chợ tụt (gia_adsense.hs_sql, anh 13/11/2026)
                             from etp.camp c left join etp.so_ngay n on n.camp_id = c.camp_id and n.ngay < (now() at time zone 'utc')::date   -- CHỈ NGÀY ĐÃ KHÉP (03/11/2026: phim test rộng 169553 lên 5 camp 16:12, vài giờ sau đã 'sắp cất 3/4 camp chưa lãi' vì đếm ngày đang chạy — chưa qua khung 0h–7h)
                             where coalesce(c.content_id, 0) > 0 group by 1, 2, 3, 4),
                       p as (select content_id, round(sum(chi), 2) chi, round(sum(thu), 2) thu, count(*) so_camp, count(*) filter (where chi >= 1) so_thu,
                                    array_agg(distinct bo) filter (where bo <> '') bo,
                                    coalesce(jsonb_object_agg(dang, so) filter (where dang <> ''), '{}'::jsonb) dang_thu from (select content_id, dang, count(*) filter (where chi >= 1) so from c group by 1, 2) d0
                                    right join c using (content_id, dang) group by 1),
                       t as (select cn.content_id, sum(n.chi) chi, sum(n.thu) thu from etp.camp_ngoai cn join etp.so_ngay_ngoai n using (camp_id)
                             where n.ngay >= current_date - 14 and coalesce(cn.content_id, 0) > 0 group by 1)
                  select p.*, f.thu_vong, f.thu_bo, f.thu_ly, f.ten, extract(epoch from now() - f.thu_luc) / 86400 cho_ngay, round(coalesce(t.chi, 0), 2) team_chi, round(coalesce(t.thu, 0), 2) team_thu,
                         (select count(*) from etp.camp_ngoai cn where cn.content_id = p.content_id and cn.trang_thai = 'ACTIVE') doi_chay,
                         (select count(*) from (select cn.camp_id from etp.camp_ngoai cn join etp.so_ngay_ngoai n using (camp_id) where cn.content_id = p.content_id and n.ngay >= current_date - 7
                            group by 1 having sum(n.chi) >= 3 and sum(n.thu) > sum(n.chi)) x) doi_camp_lai,   -- camp ĐỘI lãi 7 ngày (anh 09/11/2026 "đội vẫn có camp lãi… cơ hội vẫn còn")
                         (select string_agg('#' || h.camp_id || ' ROI ' || h.roi || '%', ', ' order by h.roi desc) from etp.camp_co_hoi h where h.content_id = p.content_id) lai   -- CAMP CƠ HỘI (migration 0437, anh 06/11/2026)
                  from p left join etp.phim f using (content_id) left join t using (content_id)""".replace("{HS}", GA.hs_sql("n.ngay")))

# PHIM CẤM (etp:phim-cam-cho-3-2011, anh 20/11/2026 "fix triệt để các phim cấm là ko đc bật"): phim trong sổ ethopex_phim_cam bị bỏ qua ngay đầu vòng xét — hỏi đúng
# MỘT bộ đọc cong.phim_cam (lỗi đọc → chặn), không đọc sổ lần hai ở đây.
def la_cam(ct, doc=None):
    import cong as CG
    return bool((doc or CG.phim_cam)(cts=[ct], q=_q))

def dat(content, vong, ly, that, bo=None):
    v = lambda x: "null" if x is None else f"'{s_(x)}'"
    if that: _q(f"update etp.phim set thu_vong = {v(vong)}, thu_ly = {v(ly)}, thu_bo = {v(bo)}, thu_luc = now() where content_id = {int(content)}")

def xet(that=False):
    ch = cau_hinh(); bao, doi_bo = [], {}; N = int(ch["so_thu"])
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # thay-the.py nạp tệp này theo đường dẫn, không nằm trong apps/etp
        import lo_trinh_phim as LT
        tt_ = json.loads(_q("select gia_tri::text from etp.cau_hinh where khoa = 'lo_trinh_tt'") or "{}")
        gac_ = set(json.loads(_q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'gac_dang'), '[]')") or "[]"))   # dạng anh gác: lộ trình không xếp → không giữ hạn chờ
        ch["_thi_diem"] = {int(c): [m for m in LT.CAN if m not in gac_ and not (tt_.get(str(c), {}).get("dang", {}).get(m) or {}).get("bo")] for c in (LT.cau_hinh(lambda s: _q(s)).get("phim") or [])}
    except Exception as e: print(f"đọc thí điểm lộ trình lỗi: {e}", file=sys.stderr); ch["_thi_diem"] = {}
    for p in so_phim():
        ct, chi, thu, vong = int(p["content_id"]), float(p["chi"] or 0), float(p["thu"] or 0), p.get("thu_vong")
        ten = p.get("ten") or f"phim {ct}"; so_thu = int(p.get("so_thu") or 0)
        if la_cam(ct): continue   # phim cấm: không đổi vòng, không vào doi_bo (camp mới lên bộ khác), không mở lại (etp:phim-cam-cho-3-2011)
        # ĐỘI CÒN LÃI = tổng đội 14 ngày lãi HOẶC đội có ≥ 1 camp chi ≥ $3 thu > chi trong 7 ngày (anh 09/11/2026: tổng đội âm vì camp thử khác vẫn che mất camp đội đang thắng)
        team_lai = (float(p["team_chi"] or 0) >= 10 and float(p["team_thu"] or 0) > float(p["team_chi"] or 0)) or int(p.get("doi_camp_lai") or 0) > 0
        # BỎ ĐIỀU KIỆN CẤT PHIM (anh 23/11/2026 "Bỏ điều kiện 'Cất phim' đi"): máy không còn đặt phim sang 'cat' / 'sap_cat' — phim đang cất / sắp cất được mở lại,
        # camp lỗ để luật tắt (T1 / T2 / PL) xử từng camp. Thang chỉ còn đổi bộ (doi_bo) và báo team lãi (team).
        if vong in ("cat", "sap_cat"):
            dat(ct, None, None, that); bao.append(f"mở lại phim {ct} {ten}: bỏ điều kiện cất phim (anh 23/11/2026)"); vong = None
        # PHIM CÓ CAMP CƠ HỘI (etp.camp_co_hoi, anh 06/11/2026) → ra khỏi thang (không đổi bộ / không báo team): tập trung scale từ camp đó
        if p.get("lai"):
            if vong: dat(ct, None, None, that); bao.append(f"phim {ct} {ten}: có camp cơ hội {p['lai']} — ra khỏi thang đổi bộ")
            continue
        roi = (thu - chi) / chi * 100 if chi else 0
        lo = chi >= float(ch["chi"]) and roi < float(ch["roi"])
        so = f"chi ${chi:.0f} · thu ${thu:.0f} · ROI {roi:.0f}% · {p['so_camp']} camp · bộ {','.join(sorted(p.get('bo') or [])) or '?'}"
        if vong == "doi_bo" and (roi >= float(ch["roi"]) or chi < float(ch["chi_doi_bo"])):   # vòng 2 đang thử bộ mới: giữ bộ đích tới khi chi chạm chi_doi_bo
            doi_bo[ct] = p.get("thu_bo") or ""; continue
        if not lo: continue
        if team_lai:   # vòng 3: thị trường có người ăn → lỗi ở creative nhà, không cất
            if vong != "team": dat(ct, "team", f"team lãi 14 ngày (${p['team_chi']:.0f} → ${p['team_thu']:.0f}) · {so}", that); bao.append(f"phim {ct} {ten}: team lãi (${p['team_chi']:.0f} → ${p['team_thu']:.0f}) mà Nhà lỗ ({so}) — nạp creative team: nap-creative-ngoai.py --phim {ct} --cham")
            continue
        bo_moi = next((b for b in ch["bo"] if b not in (p.get("bo") or [])), None)
        if vong != "doi_bo" and bo_moi and len(p.get("bo") or []) < int(ch["so_bo"]):
            doi_bo[ct] = bo_moi; dat(ct, "doi_bo", f"đổi sang bộ {bo_moi} · {so}", that, bo_moi)
            bao.append(f"đổi bộ phim {ct} {ten}: camp mới kế tiếp (dòng phim / lên sau chấm) lên bộ {bo_moi} ({so})"); continue
    return bao, doi_bo

if __name__ == "__main__":
    if "--tu-kiem-phim-cam" in sys.argv:   # trên box3, SỔ THẬT: 167292 bị bỏ qua, một phim thường đi qua
        thuong = int(_q("select content_id from etp.phim where not coalesce((select gia_tri ? content_id::text from xv_khoa_ngoai where ten = 'ethopex_phim_cam'), false) order by content_id desc limit 1"))
        assert la_cam(167292), "LỌT: cat_phim không bỏ qua phim cấm 167292"
        assert not la_cam(thuong), f"phim thường #{thuong} bị bỏ nhầm"
        print(f"cat_phim phim cấm: 167292 bị bỏ qua, phim thường #{thuong} đi qua"); sys.exit()
    if "--mo" in sys.argv:
        ct = int(sys.argv[sys.argv.index("--mo") + 1]); dat(ct, None, None, True); print(f"mở lại phim {ct}"); sys.exit()
    b, d = xet("--that" in sys.argv)
    print("\n".join(b) or "không có phim nào đổi vòng"); print(json.dumps({"doi_bo": d}, ensure_ascii=False))
