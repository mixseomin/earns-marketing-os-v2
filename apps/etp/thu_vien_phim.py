#!/usr/bin/env python3
"""THƯ VIỆN PHIM ETHOPEX → kho spy ethopex_content (anh 02/11/2026 "làm mới thư viện đi"): kho chỉ nạp một lần 19/10 (27.429 phim EN/ES), thư viện Ethopex
thêm phim mỗi ngày (75.286 bản 02/11) → chon-phim-moi / soát poster / cắt / len-creative không thấy phim mới.
  · nguồn: GET api-multi-be /api/v2/contents?content_type_id=1&is_ref=0&hl=<en|es> — mới nhất trước, 100 bản / trang; CHỈ ĐỌC Ethopex
  · mỗi tiếng đọc từ trang 1 tới khi gặp một trang toàn bản đã có (lượt thường: 1 trang); --het đọc lại tới hết (nạp bù)
  · cột giữ đúng khuôn kho cũ: id · locale · ten · url (trang tập 1) · tao · anh · nap_luc — nguon / ma_goc là CỘT TỰ TÍNH từ url trong kho (không ghi)
  · đồng thời ghi etp.thu_vien_phim (kho mos2): mã phim → group_id + poster — ngăn phim etp.on.tc đọc nội dung qua /api/v2/movie/groups/{group_id} (anh 02/11/2026)
dong-bo.py gọi chay(T) mỗi lượt; chạy tay: python3 thu_vien_phim.py [--het]  (--het: đọc lại hết, ghi etp.thu_vien_phim cho MỌI phim)"""
import json, os, subprocess, sys, urllib.request

MB, TIENG, TRANG_MAX = "https://api-multi-be.ethopex.dev", ("en", "es"), 400
SPY = subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo $DATABASE_URL"], capture_output=True, text=True).stdout.strip()

def qs(s):
    r = subprocess.run(["psql", SPY, "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=300)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def qm(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=300)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def chay(T, het=False):
    co = {int(x) for x in qs("select id from ethopex_content").split() if x.isdigit()}
    rows, tv, trang = [], [], 0
    for hl in TIENG:
        p = 1
        while p <= TRANG_MAX:
            r = urllib.request.Request(f"{MB}/api/v2/contents?page={p}&page_size=100&content_type_id=1&is_ref=0&hl={hl}", headers={"authorization": "Bearer " + T, "user-agent": "mos2-etp"})
            d = json.load(urllib.request.urlopen(r, timeout=90)).get("data") or []; trang += 1
            # bỏ BẢN WORKSPACE (có ref_id / user_id): danh sách is_ref=0 trả lẫn bản người trong đội vừa "thêm content" — đó là bản trỏ về phim gốc, không phải phim thư viện
            moi = [x for x in d if int(x["content_id"]) not in co and (x.get("locale") or "").lower() == hl and not x.get("ref_id") and not x.get("user_id")]
            tv += [{"content_id": int(x["content_id"]), "nhom_id": x.get("group_id"), "ten": x.get("title"), "locale": hl, "anh": x.get("thumbnail"), "url": x.get("redirect_url"), "tao": x.get("created_at")}
                   for x in d if (het or int(x["content_id"]) not in co or x in moi) and (x.get("locale") or "").lower() == hl and not x.get("ref_id") and not x.get("user_id")]
            for x in moi:
                rows.append({"id": int(x["content_id"]), "locale": hl, "ten": x.get("title"), "url": x.get("redirect_url") or None, "tao": x.get("created_at"), "anh": x.get("thumbnail")})
                co.add(int(x["content_id"]))
            if len(d) < 100 or (not het and not moi): break
            p += 1
    if rows:
        for i in range(0, len(rows), 2000):
            j = json.dumps(rows[i:i + 2000], ensure_ascii=False).replace("$J$", "")
            qs(f"""insert into ethopex_content (id, locale, ten, url, tao, anh, nap_luc)
                   select id, locale, ten, url, tao, anh, now() from jsonb_to_recordset($J${j}$J$::jsonb)
                   as x(id int, locale text, ten text, url text, tao timestamptz, anh text) on conflict (id) do nothing""")
    for i in range(0, len(tv), 2000):
        j = json.dumps(tv[i:i + 2000], ensure_ascii=False).replace("$J$", "")
        qm(f"""insert into etp.thu_vien_phim (content_id, nhom_id, ten, locale, anh, url, tao) select content_id, nhom_id, ten, locale, anh, url, tao
               from jsonb_to_recordset($J${j}$J$::jsonb) as x(content_id bigint, nhom_id bigint, ten text, locale text, anh text, url text, tao timestamptz)
               on conflict (content_id) do update set nhom_id = excluded.nhom_id, ten = excluded.ten, anh = excluded.anh, url = excluded.url, cap_nhat = now()""")
    return {"thu_vien_moi": len(rows), "thu_vien_trang": trang, "thu_vien_ghi": len(tv)}

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import ethopex_api as EA
    print(json.dumps(chay(EA.T_NHA, het="--het" in sys.argv)))
