#!/usr/bin/env python3
"""THANG CHUYỂN HƯỚNG / CẤT PHIM (anh 31/10/2026: "Phần sinh camp thay thế đã tự động nhg nếu sau nhiều lần thử mà ko có camp lãi, film lởm,... thị trường,...
thì làm thế nào" → "Đc làm đi"). Chỉ xét phim CHƯA có camp nhà nào lãi — phim đã có camp lãi vẫn nhân bản / thang như cũ.
  vòng 1  đổi creative theo dạng (thay-the.py, như trước)
  vòng 2  chi thử ≥ cau_hinh.cat_phim.chi mà ROI < .roi, mới thử < .so_bo bộ → thu_vong 'doi_bo': camp thay kế tiếp lên bộ chưa thử (bo_moi)
  vòng 3  team (camp ngoài) lãi phim đó 14 ngày → KHÔNG cất, báo nạp creative team (nap-creative-ngoai.py — chấm là lượt AI, chờ lệnh)
  vòng 4  hết đường (đủ bộ hoặc chi ≥ .chi_doi_bo) → thu_vong 'cat': cong.kiem chặn tạo / nhân bản / bật camp phim này; camp còn chạy để luật tắt xử
  mở lại  camp nhà lãi, hoặc team lãi 14 ngày → thu_vong về null (tự động)
Dùng: python3 cat_phim.py [--that]   (không --that = chạy khô, in sẽ làm gì) · python3 cat_phim.py --mo <content_id>  (anh mở tay một phim)
Trong script khác: import cat_phim; bao, doi_bo = cat_phim.xet(that=True)   → doi_bo = {content_id: bộ nên lên}"""
import json, os, subprocess, sys

MAC = {"chi": 25, "roi": -30, "chi_doi_bo": 50, "so_bo": 2, "bo": ["1", "2", "3"], "so_thu": 4,
       # THỬ ĐỦ DẠNG TRƯỚC KHI CẤT (anh 04/11/2026: "mới thử 5 camp cho 1 thể loại thì chưa đủ để kết luận film chưa ổn. Các định dạng như CC, CT, KT chưa thử thì làm sao biết đúng"):
       # cất chỉ khi MỖI dạng trong dang_can đã có ≥ so_moi_dang camp có chi (≥ $1) mà vẫn chưa camp nào lãi; thiếu dạng → chờ (sap_cat, ghi dạng thiếu) để camp thay / Sản xuất lên đúng dạng đó
       "dang_can": ["cảnh cuối", "cảnh thật", "kể chuyện"], "so_moi_dang": 2, "cho_dang_ngay": 3}   # chờ dạng thiếu quá cho_dang_ngay ngày mà không ai lên được dạng đó → cất (CT chưa có máy tự sản xuất)
TEN_DANG = {"cảnh cuối": "CC", "cảnh thật": "CT", "kể chuyện": "KT", "tập nguyên": "LT"}
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
    return _qj("""with c as (select c.content_id, c.camp_id, coalesce(c.bo, '') bo, coalesce((select r.dang from etp.creative r where r.creative_id = c.creative_id), '') dang, coalesce(sum(n.chi), 0) chi, coalesce(sum(n.thu), 0) thu
                             from etp.camp c left join etp.so_ngay n on n.camp_id = c.camp_id and n.ngay < (now() at time zone 'utc')::date   -- CHỈ NGÀY ĐÃ KHÉP (03/11/2026: phim test rộng 169553 lên 5 camp 16:12, vài giờ sau đã 'sắp cất 3/4 camp chưa lãi' vì đếm ngày đang chạy — chưa qua khung 0h–7h)
                             where coalesce(c.content_id, 0) > 0 group by 1, 2, 3, 4),
                       p as (select content_id, round(sum(chi), 2) chi, round(sum(thu), 2) thu, count(*) so_camp, count(*) filter (where chi >= 1) so_thu, bool_or(chi >= 3 and thu > chi) lai,
                                    array_agg(distinct bo) filter (where bo <> '') bo,
                                    coalesce(jsonb_object_agg(dang, so) filter (where dang <> ''), '{}'::jsonb) dang_thu from (select content_id, dang, count(*) filter (where chi >= 1) so from c group by 1, 2) d0
                                    right join c using (content_id, dang) group by 1),
                       t as (select cn.content_id, sum(n.chi) chi, sum(n.thu) thu from etp.camp_ngoai cn join etp.so_ngay_ngoai n using (camp_id)
                             where n.ngay >= current_date - 14 and coalesce(cn.content_id, 0) > 0 group by 1)
                  select p.*, f.thu_vong, f.thu_bo, f.thu_ly, f.ten, extract(epoch from now() - f.thu_luc) / 86400 cho_ngay, round(coalesce(t.chi, 0), 2) team_chi, round(coalesce(t.thu, 0), 2) team_thu,
                         (select count(*) from etp.camp_ngoai cn where cn.content_id = p.content_id and cn.trang_thai = 'ACTIVE') doi_chay
                  from p left join etp.phim f using (content_id) left join t using (content_id)""")

def dat(content, vong, ly, that, bo=None):
    v = lambda x: "null" if x is None else f"'{s_(x)}'"
    if that: _q(f"update etp.phim set thu_vong = {v(vong)}, thu_ly = {v(ly)}, thu_bo = {v(bo)}, thu_luc = now() where content_id = {int(content)}")

def xet(that=False):
    ch = cau_hinh(); bao, doi_bo = [], {}; N = int(ch["so_thu"])
    for p in so_phim():
        ct, chi, thu, vong = int(p["content_id"]), float(p["chi"] or 0), float(p["thu"] or 0), p.get("thu_vong")
        ten = p.get("ten") or f"phim {ct}"; so_thu = int(p.get("so_thu") or 0)
        team_lai = float(p["team_chi"] or 0) >= 10 and float(p["team_thu"] or 0) > float(p["team_chi"] or 0)
        # BÃO HOÀ KHÔNG CÒN LÀ LÝ DO CẤT (anh 06/11/2026 "Phim bão hoà chỉ cảnh báo"): phim đã cất vì bão hoà → mở lại; phim bão hoà chỉ hiện cảnh báo (etp.phim_bao_hoa)
        if vong == "cat" and str(p.get("thu_ly") or "").startswith("bão hoà"):
            dat(ct, None, None, that); bao.append(f"mở lại phim {ct} {ten}: bão hoà chỉ cảnh báo, không cất (anh 06/11/2026)"); continue
        if p.get("lai") or (vong == "cat" and team_lai):
            if vong: dat(ct, None, None, that); bao.append(f"mở lại phim {ct} {ten}: {'camp nhà lãi' if p.get('lai') else 'team lãi 14 ngày'}")
            continue
        roi = (thu - chi) / chi * 100 if chi else 0
        lo = chi >= float(ch["chi"]) and roi < float(ch["roi"])
        so = f"chi ${chi:.0f} · thu ${thu:.0f} · ROI {roi:.0f}% · {p['so_camp']} camp · bộ {','.join(sorted(p.get('bo') or [])) or '?'}"
        dt_ = p.get("dang_thu") or {}; thieu = [TEN_DANG.get(d, d) for d in ch.get("dang_can", []) if int(dt_.get(d) or 0) < int(ch.get("so_moi_dang", 1))]
        da_cho = vong == "sap_cat" and str(p.get("thu_ly") or "").startswith("chưa thử đủ dạng") and float(p.get("cho_ngay") or 0) >= float(ch.get("cho_dang_ngay", 3))
        if not team_lai and so_thu >= N and thieu and da_cho:   # chờ dạng thiếu quá hạn mà không ai lên được → cất
            dat(ct, "cat", f"chờ {ch.get('cho_dang_ngay', 3)} ngày không lên được dạng {', '.join(thieu)} · {so}", that); bao.append(f"cất phim {ct} {ten}: chờ dạng {', '.join(thieu)} quá hạn ({so})"); continue
        if not team_lai and so_thu >= N and thieu:   # đủ số camp nhưng CHƯA thử đủ dạng → chưa cất, chờ thử dạng thiếu (mở lại phim lỡ cất theo luật cũ)
            ly_ = f"chưa thử đủ dạng: thiếu {', '.join(thieu)} (mỗi dạng ≥ {ch.get('so_moi_dang', 1)} camp có chi) · {so}"
            if vong != "sap_cat" or not str(p.get("thu_ly") or "").startswith("chưa thử đủ dạng"): dat(ct, "sap_cat", ly_, that); bao.append(f"{'mở lại' if vong == 'cat' else 'chờ'} phim {ct} {ten}: {ly_}")   # giữ thu_luc lần đầu chờ (đếm hạn chờ), chỉ ghi khi mới chuyển sang chờ
            continue
        if not team_lai and so_thu >= N:   # thử đủ N camp có chi VÀ đủ mọi dạng, chưa camp nào lãi
            if vong != "cat": dat(ct, "cat", f"thử {so_thu} camp chưa camp nào lãi · {so}", that); bao.append(f"cất phim {ct} {ten}: thử {so_thu} camp chưa camp nào lãi ({so})")
            continue
        if not team_lai and so_thu == N - 1 and vong in (None, "sap_cat"):   # chờ: camp thử thứ N là lần cuối
            if vong != "sap_cat" or p.get("thu_ly") != f"đã thử {so_thu}/{N} camp chưa lãi · {so}": dat(ct, "sap_cat", f"đã thử {so_thu}/{N} camp chưa lãi · {so}", that)
            continue
        if vong == "sap_cat" and so_thu < N - 1: dat(ct, None, None, that)
        if vong == "doi_bo" and (roi >= float(ch["roi"]) or chi < float(ch["chi_doi_bo"])):   # vòng 2 đang thử bộ mới: giữ bộ đích tới khi chi chạm chi_doi_bo
            doi_bo[ct] = p.get("thu_bo") or ""; continue
        if not lo: continue
        if team_lai:   # vòng 3: thị trường có người ăn → lỗi ở creative nhà, không cất
            if vong != "team": dat(ct, "team", f"team lãi 14 ngày (${p['team_chi']:.0f} → ${p['team_thu']:.0f}) · {so}", that); bao.append(f"phim {ct} {ten}: team lãi (${p['team_chi']:.0f} → ${p['team_thu']:.0f}) mà Nhà lỗ ({so}) — nạp creative team: nap-creative-ngoai.py --phim {ct} --cham")
            continue
        bo_moi = next((b for b in ch["bo"] if b not in (p.get("bo") or [])), None)
        if vong not in ("doi_bo", "cat") and bo_moi and len(p.get("bo") or []) < int(ch["so_bo"]):
            doi_bo[ct] = bo_moi; dat(ct, "doi_bo", f"đổi sang bộ {bo_moi} · {so}", that, bo_moi)
            bao.append(f"đổi bộ phim {ct} {ten}: camp thay kế tiếp lên bộ {bo_moi} ({so})"); continue
        if vong != "cat": dat(ct, "cat", so, that); bao.append(f"cất phim {ct} {ten}: thôi lên camp mới ({so})" + (f" · ⚠ đội còn {p['doi_chay']} camp chạy phim này — không nên mở thêm (nhãn ⛔ chạm mốc trên etp)" if p.get("doi_chay") else ""))
    return bao, doi_bo

if __name__ == "__main__":
    if "--mo" in sys.argv:
        ct = int(sys.argv[sys.argv.index("--mo") + 1]); dat(ct, None, None, True); print(f"mở lại phim {ct}"); sys.exit()
    b, d = xet("--that" in sys.argv)
    print("\n".join(b) or "không có phim nào đổi vòng"); print(json.dumps({"doi_bo": d}, ensure_ascii=False))
