#!/usr/bin/env python3
"""SỐ QC FACEBOOK CỦA TỪNG PHIM (anh 02/11/2026: "film nào đang chạy nhiều ads fb… film càng chạy nhiều ads thì càng ko hiệu quả. Nên đây cũng là tiêu chí chọn film
(ít camp fb)" · "hoặc là số ads fb đang bật"). Kho spy chỉ gắn được QC có link thẳng về ReelShort / NetShort / DramaBox (447 phim) → tra Thư viện QC Meta theo TÊN PHIM:
  --nap [N=200]  đưa tên N phim đầu danh sách có thể test (xv_khoa_ngoai['ethopex_co_the_test']) vào từ khoá spy (tu_khoa, ngach phim_ngan · nguon etp_phim · US);
                 máy cào spy (spy-on-tc scripts/cao.sh, trình duyệt spy-cao) tra ở lượt kế, mỗi từ khoá trang đầu ≈ 30 QC đang bật
  --dem          (dong-bo gọi mỗi lượt) đếm cho mọi từ khoá etp_phim đã được tra: QC đang bật (ngay_dung trống) mà nội dung / link có ĐÚNG tên phim
                 (search keyword_unordered kéo cả QC lạc với tên chung chung) → xv_khoa_ngoai['ethopex_qc_fb_phim'] {id: {qc_dang, qc, page, tra}}
                 tra = lúc lượt cào gần nhất có từ khoá đó xong; chưa tra = không có mục (cột hiện "chưa tra", bộ chấm không cộng / trừ).
Trần trang đầu ≈ 30 QC: QC_NHIEU (25) = trang đầu gần đầy → coi là nhiều. Chỉ đọc / ghi kho spy + xv_khoa_ngoai — không gửi gì lên Meta / Ethopex."""
import json, os, re, subprocess, sys

QC_NHIEU = 25
DB = os.environ["DATABASE_URL"]
SPY = subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo $DATABASE_URL"], capture_output=True, text=True).stdout.strip()

def chay(db, s):
    r = subprocess.run(["psql", db, "-qtA", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=300)
    if r.returncode: raise SystemExit(r.stderr.strip()[-300:])
    return r.stdout.strip()

chuan = lambda t: re.sub(r"[^a-z0-9]", "", (t or "").lower())

def ds_test():
    return json.loads(chay(DB, "select coalesce(gia_tri->'ds', '[]'::jsonb)::text from xv_khoa_ngoai where ten = 'ethopex_co_the_test'") or "[]")

def nap(n):
    ds = [x for x in ds_test() if (x.get("ten") or "").strip()][:n]
    j = json.dumps([{"tu": x["ten"].strip()[:200]} for x in ds], ensure_ascii=False).replace("$J$", "")
    moi = chay(SPY, f"""with x as (select distinct tu from jsonb_to_recordset($J${j}$J$::jsonb) as x(tu text))
        insert into tu_khoa (tu, nuoc, bat, tao, ngach, nguon) select tu, 'US', true, now(), 'phim_ngan', 'etp_phim' from x
        on conflict (tu, nuoc) do nothing returning id""")
    print(json.dumps({"nap": len(ds), "tu_khoa_moi": len([l for l in moi.splitlines() if l.strip()])}))

def dem():
    ds = {chuan(x["ten"]): x for x in ds_test() if x.get("ten")}
    tu = [l.split("\t") for l in chay(SPY, """select t.tu, coalesce((select max(l.xong)::text from luot_cao l where l.xong is not null and t.tu = any(l.tu_khoa)), '')
        from tu_khoa t where t.nguon = 'etp_phim'""").splitlines() if "\t" in l]
    da_tra = {t: luc for t, luc in tu if luc}
    if not da_tra: print(json.dumps({"qc_fb_phim": 0})); return
    j = json.dumps(list(da_tra), ensure_ascii=False).replace("$J$", "")
    # QC đang bật mỗi từ khoá: tu_khoa của QC chứa từ khoá, và tên phim (bỏ dấu câu) nằm trong nội dung / link — loại QC lạc của tìm theo từ
    rows = chay(SPY, f"""with k as (select tu, regexp_replace(lower(tu), '[^a-z0-9]', '', 'g') c from jsonb_array_elements_text($J${j}$J$::jsonb) tu)
        select k.tu, count(*) filter (where q.ngay_dung is null), count(*), count(distinct q.page_id) filter (where q.ngay_dung is null)
        from k left join qc_meta q on k.tu = any(q.tu_khoa)
          and regexp_replace(lower(coalesce(q.noi_dung, '') || ' ' || coalesce(q.dich, '') || ' ' || coalesce(q.dich_cuoi, '')), '[^a-z0-9]', '', 'g') like '%' || k.c || '%'
        group by k.tu""")
    out = {}
    for l in rows.splitlines():
        t, dang, tong, page = l.split("\t")
        x = ds.get(chuan(t))
        if x: out[str(x["id"])] = {"qc_dang": int(dang), "qc": int(tong), "page": int(page), "tra": da_tra[t]}
    v = json.dumps(out, ensure_ascii=False).replace("$J$", "")
    chay(DB, f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_qc_fb_phim', $J${v}$J$::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
    print(json.dumps({"qc_fb_phim": len(out), "qc_fb_nhieu": sum(1 for o in out.values() if o["qc_dang"] >= QC_NHIEU)}))

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--nap" in a: nap(next((int(x) for x in a if x.isdigit()), 200))
    elif "--dem" in a: dem()
    else: print(__doc__)
