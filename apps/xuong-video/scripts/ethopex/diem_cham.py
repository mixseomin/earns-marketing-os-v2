#!/usr/bin/env python3
"""SỔ ĐIỂM CHẠM CREATIVE (anh 28/10/2026: "creative cũng cần thử với các dạng CTA khác nhau, màu sắc nút, style… đoạn hook"; "cần đo về số điểm chạm
như voice, text, hình, nội dung"). MỘT chỗ mô tả creative xưởng dựng ra gồm những điểm chạm nào → etp.diem_cham (đọc ở etp › Creative › Điểm chạm).
Mỗi điểm chạm là một nhóm khoá phẳng; thêm biến thể mới (mẫu CTA khác, màu nút khác, kiểu hook khác) = đổi giá trị tại nguồn dựng + ghi đúng khoá ở đây,
không thêm bảng. Giá trị là chữ ngắn để gom nhóm (vd cta.nut_mau = 'do'), không phải tham số kỹ thuật.
  ban(x, dang, chu_qc, CQ) → dict điểm chạm của một đoạn đã lên (x = dòng lo.json: content_id, lang, tu, den, giay …)
  ghi(rows, sql)          → upsert etp.diem_cham (sql = soat_doan.sql)"""
import json

# MẪU ĐANG DỰNG (cat-canh.py + cta_qc.py, 28/10/2026) — đổi mẫu ở nguồn thì đổi luôn ở đây, sổ mới phân biệt được bản cũ / bản mới
MAU_CTA = "v2"            # cta_qc.CTA giọng v2 (EN cắt "Tap", ES đọc lại không "Toca") — luật CTA Support 22/10/2026
NUT = {"nut_mau": "do", "nut_kieu": "nhun_nhe", "nut_tu_giay": 3}            # cat-canh.py: NÚT ĐỎ CTA nhún nhẹ từ giây 3 tới hết
THE_CUOI = {"the_cuoi": "poster_sach+hoi_vang"}                               # thẻ cuối = poster sạch + dòng vàng câu hỏi, không mũi tên / Tap
GIONG = {"en": "george_v2", "es": "aria_v2"}                                 # assets/ethopex/cta-<lang>-<giọng>.mp3
BO_CUC = "giu_bo_cuc_app_goc"                                                # tên phim trên đầu, phụ đề thoại giữa, tóm tắt dưới đáy (bản B cảnh phim thật)


def ban(x, dang, chu_qc, CQ):
    lang = x.get("lang") or "en"; c = CQ.CTA.get(lang) or CQ.CTA["en"]
    tu, den = float(x.get("tu") or 0), float(x.get("den") or 0)
    return {
        "hook": {"dang": dang, "giay_vao_phim": round(tu), "cat_tai": "dau_canh", "chu_hook": None},
        "noi_dung": {"content_id": x.get("content_id"), "giay": x.get("giay") or round(den - tu, 1), "lang": lang},
        "voice": {"thoai": "goc", "giong_cta": GIONG.get(lang), "cau_cta": c.get("loi_giong")},
        "chu_video": {"bo_cuc": BO_CUC, "phu_de": "goc"},
        "cta": {"mau": MAU_CTA, "nut_chu": c.get("nut"), "hoi": c.get("hoi"), **NUT, **THE_CUOI,
                **({"nut_mau": (x.get("bien") or {}).get("nut_mau")} if (x.get("bien") or {}).get("nut_mau") else {}),
                **({"the_cuoi": "khung_cuoi+hoi_vang"} if (x.get("bien") or {}).get("the_cuoi") == "canh" else {})},   # biến thể lúc cắt (cat-cuoi-lo → lo.json "bien")
        "anh_dau": {"khung": "giay_2"},                                            # len-creative.py: ảnh đầu = khung giây 2
        "chu_qc": {"so_cau": len((chu_qc or {}).get("primaryTexts") or []), "cau_1": ((chu_qc or {}).get("primaryTexts") or [None])[0],
                   "headline": ((chu_qc or {}).get("headlines") or [None])[0], "mo_ta": ((chu_qc or {}).get("descriptions") or [None])[0]},
    }


def ghi(rows, sql, nguon="len_creative"):
    """rows = [(creative_id, dict)] → upsert etp.diem_cham"""
    rows = [(int(c), d) for c, d in rows if c]
    if not rows: return 0
    j = json.dumps([{"creative_id": c, "cham": d} for c, d in rows], ensure_ascii=False).replace("$J$", "")
    sql(f"insert into etp.diem_cham (creative_id, cham, nguon) select creative_id, cham, '{nguon}' from jsonb_to_recordset($J${j}$J$::jsonb) as x(creative_id int, cham jsonb) "
        f"on conflict (creative_id) do update set cham = excluded.cham, nguon = excluded.nguon, luc = now()")
    return len(rows)


DIEN_NGUOC = """
-- creative cũ (chưa có sổ): chỉ điểm chạm suy ra CHẮC từ kho etp.creative — loại creative, giây vào phim, độ dài, ngôn ngữ; mẫu CTA theo cờ cta_dat
-- (kiem-cta.py --dat: creative đã qua luật CTA mới = bản v2), không có cờ = 'cu'; chữ QC / chữ hook không biết → null
insert into etp.diem_cham (creative_id, cham, nguon)
select c.creative_id, jsonb_build_object(
  'hook', jsonb_build_object('dang', c.dang, 'giay_vao_phim', round(c.tu), 'cat_tai', 'dau_canh', 'chu_hook', null),
  'noi_dung', jsonb_build_object('content_id', c.content_id, 'giay', round((c.den - c.tu)::numeric, 1), 'lang', c.lang),
  'voice', jsonb_build_object('thoai', 'goc', 'giong_cta', case when c.cta_dat then case when c.lang = 'es' then 'aria_v2' else 'george_v2' end end),
  'chu_video', jsonb_build_object('bo_cuc', 'giu_bo_cuc_app_goc', 'phu_de', 'goc'),
  'cta', case when c.cta_dat then jsonb_build_object('mau', 'v2', 'nut_mau', 'do', 'nut_kieu', 'nhun_nhe', 'the_cuoi', 'poster_sach+hoi_vang')
              else jsonb_build_object('mau', 'cu') end,   -- bản CTA cũ: kiểu nút / thẻ cuối không ghi lại được → chỉ ghi mẫu
  'anh_dau', jsonb_build_object('khung', 'giay_2'),
  'chu_qc', jsonb_build_object('so_cau', null)), 'dien_nguoc'
from etp.creative c where not exists (select 1 from etp.diem_cham d where d.creative_id = c.creative_id)
on conflict (creative_id) do nothing
"""


if __name__ == "__main__":
    import sys, os
    if sys.argv[1:] == ["dien-nguoc"]:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import soat_doan as SD
        SD.sql(DIEN_NGUOC); print(SD.sql("select nguon, cham->'cta'->>'mau', count(*) from etp.diem_cham group by 1, 2 order by 1, 2"))

