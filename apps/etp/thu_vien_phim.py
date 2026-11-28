#!/usr/bin/env python3
"""THƯ VIỆN PHIM ETHOPEX → kho spy ethopex_content (anh 02/11/2026 "làm mới thư viện đi"): kho chỉ nạp một lần 19/10 (27.429 phim EN/ES), thư viện Ethopex
thêm phim mỗi ngày (75.286 bản 02/11) → chon-phim-moi / soát poster / cắt / len-creative không thấy phim mới.
  · nguồn: GET api-multi-be /api/v2/contents?content_type_id=1&is_ref=0&hl=<en|es> — mới nhất trước, 100 bản / trang; CHỈ ĐỌC Ethopex
  · mỗi tiếng đọc từ trang 1 tới khi gặp một trang toàn bản đã có (lượt thường: 1 trang); --het đọc lại tới hết (nạp bù)
  · cột giữ đúng khuôn kho cũ: id · locale · ten · url (trang tập 1) · tao · anh · nap_luc — nguon / ma_goc là CỘT TỰ TÍNH từ url trong kho (không ghi)
  · đồng thời ghi etp.thu_vien_phim (kho mos2): mã phim → group_id + poster — ngăn phim etp.on.tc đọc nội dung qua /api/v2/movie/groups/{group_id} (anh 02/11/2026)
  · CHÍNH SÁCH (Policy, Dol 28/11/2026): trường policy_rate (risk · medium · safe · not_yet) → etp.thu_vien_phim.chinh_sach. Ethopex chấm lại cả phim CŨ nên ngoài lượt
    đọc phim mới còn quet_chinh_sach(): đọc dần danh sách lọc &policy=<mức> (25 trang / lượt, con trỏ ở xv_khoa_ngoai['etp_chinh_sach_con_tro']) — trọn vòng ~1,5 giờ
dong-bo.py gọi chay(T) + quet_chinh_sach(T) mỗi lượt; chạy tay: python3 thu_vien_phim.py [--het] [--chinh-sach-het]  (--het: đọc lại hết, ghi etp.thu_vien_phim cho MỌI phim;
--chinh-sach-het: quét trọn mọi mức chính sách một lần)"""
import json, os, subprocess, sys, urllib.request

MB, TIENG, TRANG_MAX = "https://api-multi-be.ethopex.dev", ("en", "es"), 400
MUC_CS = ("risk", "medium", "safe")   # not_yet không quét: phim chưa chấm giữ nguyên, Ethopex chấm xong sẽ vào một trong ba danh sách này
SPY = subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo $DATABASE_URL"], capture_output=True, text=True).stdout.strip()

import re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import trang_phim as TP   # dùng chung _doc + CẦU DAO cổng phim (28/11/2026): trang phim đã thấy api-multi-be sập thì thư viện / chính sách bỏ ngay, không chờ timeout 90s mỗi bước
# LINK TRANG PHIM (28/11/2026, 85250 Deny Me, Dragon King): Ethopex có phim trả redirect_url là TỆP ẢNH poster (thwztchapter.dramaboxdb.com/…/<book>/<book>.jpg)
# → máy KT curl ra ảnh, không có tóm tắt, hỏng 3 lần. Ảnh DramaBox mang mã sách → đổi về trang https://www.dramaboxdb.com/movie/<book> (trang tự chuyển đúng slug);
# ảnh nguồn khác không đổi được → None (hàng KT ghi "thiếu link"), không ghi link ảnh vào kho.
def url_trang(u):
    if not u or not re.search(r"\.(jpe?g|png|webp|gif)(@|\?|$)", u, re.I): return u or None
    m = re.search(r"dramabox[a-z]*\.com/.*/(\d{8,})/\1\.", u)
    return f"https://www.dramaboxdb.com/movie/{m.group(1)}" if m else None

def qs(s):
    r = subprocess.run(["psql", SPY, "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=300)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def qm(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=300)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def ghi_tv(tv):
    for i in range(0, len(tv), 2000):
        j = json.dumps(tv[i:i + 2000], ensure_ascii=False).replace("$J$", "")
        qm(f"""insert into etp.thu_vien_phim (content_id, nhom_id, ten, locale, anh, url, tao, chinh_sach, chinh_sach_luc)
               select content_id, nhom_id, ten, locale, anh, url, tao, chinh_sach, case when chinh_sach is not null then now() end
               from jsonb_to_recordset($J${j}$J$::jsonb) as x(content_id bigint, nhom_id bigint, ten text, locale text, anh text, url text, tao timestamptz, chinh_sach text)
               on conflict (content_id) do update set nhom_id = excluded.nhom_id, ten = excluded.ten, anh = excluded.anh, url = excluded.url, cap_nhat = now(),
                 chinh_sach = coalesce(excluded.chinh_sach, etp.thu_vien_phim.chinh_sach),
                 chinh_sach_luc = case when excluded.chinh_sach is not null then now() else etp.thu_vien_phim.chinh_sach_luc end""")

def quet_chinh_sach(T, so_trang=25, het=False):
    """đọc dần danh sách Ethopex lọc theo mức chính sách → etp.thu_vien_phim.chinh_sach; con trỏ (thứ tự hl × mức, trang) nằm ở xv_khoa_ngoai — lượt sau đọc tiếp"""
    vong = [(hl, m) for hl in TIENG for m in MUC_CS]
    ct = json.loads(qm("select gia_tri from xv_khoa_ngoai where ten = 'etp_chinh_sach_con_tro'") or "{}")
    i, p, doc, tv = int(ct.get("i", 0)) % len(vong), int(ct.get("p", 1)), 0, []
    bat = (i, p)
    while het or doc < so_trang:
        hl, m = vong[i]
        d = TP._doc(T, f"/api/v2/contents?page={p}&page_size=100&content_type_id=1&is_ref=0&hl={hl}&policy={m}", 90).get("data") or []; doc += 1
        tv += [{"content_id": int(x["content_id"]), "nhom_id": x.get("group_id"), "ten": x.get("title"), "locale": hl, "anh": x.get("thumbnail"), "url": url_trang(x.get("redirect_url")),
                "tao": x.get("created_at"), "chinh_sach": x.get("policy_rate") or m} for x in d if not x.get("ref_id") and not x.get("user_id")]
        if len(d) < 100: i, p = (i + 1) % len(vong), 1
        else: p += 1
        if het and i == 0 and p == 1: break
        if not het and (i, p) == bat: break
    ghi_tv(tv)
    qm(f"""insert into xv_khoa_ngoai (ten, gia_tri) values ('etp_chinh_sach_con_tro', '{json.dumps({"i": i, "p": p})}'::jsonb)
           on conflict (ten) do update set gia_tri = excluded.gia_tri, cap_nhat = now()""")
    return {"chinh_sach_trang": doc, "chinh_sach_ghi": len(tv)}

def chay(T, het=False):
    co = {int(x) for x in qs("select id from ethopex_content").split() if x.isdigit()}
    rows, tv, trang = [], [], 0
    for hl in TIENG:
        p = 1
        while p <= TRANG_MAX:
            d = TP._doc(T, f"/api/v2/contents?page={p}&page_size=100&content_type_id=1&is_ref=0&hl={hl}", 90).get("data") or []; trang += 1
            # bỏ BẢN WORKSPACE (có ref_id / user_id): danh sách is_ref=0 trả lẫn bản người trong đội vừa "thêm content" — đó là bản trỏ về phim gốc, không phải phim thư viện
            moi = [x for x in d if int(x["content_id"]) not in co and (x.get("locale") or "").lower() == hl and not x.get("ref_id") and not x.get("user_id")]
            tv += [{"content_id": int(x["content_id"]), "nhom_id": x.get("group_id"), "ten": x.get("title"), "locale": hl, "anh": x.get("thumbnail"), "url": url_trang(x.get("redirect_url")), "tao": x.get("created_at"), "chinh_sach": x.get("policy_rate")}
                   for x in d if (het or int(x["content_id"]) not in co or x in moi) and (x.get("locale") or "").lower() == hl and not x.get("ref_id") and not x.get("user_id")]
            for x in moi:
                rows.append({"id": int(x["content_id"]), "locale": hl, "ten": x.get("title"), "url": url_trang(url_trang(x.get("redirect_url"))), "tao": x.get("created_at"), "anh": x.get("thumbnail")})
                co.add(int(x["content_id"]))
            if len(d) < 100 or (not het and not moi): break
            p += 1
    if rows:
        for i in range(0, len(rows), 2000):
            j = json.dumps(rows[i:i + 2000], ensure_ascii=False).replace("$J$", "")
            qs(f"""insert into ethopex_content (id, locale, ten, url, tao, anh, nap_luc)
                   select id, locale, ten, url, tao, anh, now() from jsonb_to_recordset($J${j}$J$::jsonb)
                   as x(id int, locale text, ten text, url text, tao timestamptz, anh text) on conflict (id) do nothing""")
    ghi_tv(tv)
    return {"thu_vien_moi": len(rows), "thu_vien_trang": trang, "thu_vien_ghi": len(tv)}

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import ethopex_api as EA
    if "--chinh-sach-het" in sys.argv: print(json.dumps(quet_chinh_sach(EA.T_NHA, het=True)))
    else: print(json.dumps(chay(EA.T_NHA, het="--het" in sys.argv)))
