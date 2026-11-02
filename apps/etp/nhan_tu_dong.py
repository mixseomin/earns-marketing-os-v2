"""NHẬN PHIM TỰ ĐỘNG — BỘ ĐIỀU PHỐI (anh 02/11/2026: "Khi nhận phim thì nếu là Tự động thì hệ thống sẽ phải tự lên camp luôn" · chọn soát 18+ bằng AI ·
"Nếu có lỗi gì đó thì sẽ phải báo lại ở phần danh sách phim Nhận để biết đang làm đến đâu, vấn đề gì"). dong-bo.py gọi chay(q) mỗi lượt (10 phút).
Dây chuyền (view etp.phim_nhan_td tính bước — tab Phim / ngăn phim đọc cùng view):
  cho_soat  → soat_18_ai.py (≈ 550₫ / phim, ckey) → sổ ethopex_soat_18 · lỗi máy → phim_nhan.loi, 30 phút sau tự thử lại
  cho_sinh  → máy sinh kể chuyện iMac lấy phim ĐẦU hàng đợi (hang-ke-chuyen.mts bậc 4000) → kịch bản · giọng / ảnh / clip · CTA → thư viện → creative
  cho_cham  → Worker chấm Meta / AFS · cho_len → worker ethopex.mjs lên camp ở TÀI KHOẢN NGƯỜI NHẬN (nhà: bộ của phim; đội: phiên Ethopex của người đó)
Bước hỏng (loai_18 · cham_chan · loi_sinh · loi) → báo etp.canh_bao (Telegram qua worker) mỗi lượt nhận × bước một lần."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SOAT_LUOT, THU_LAI_PHUT = 5, 30

def chay(q):
    import soat_18_ai as S
    # lỗi (soát của bộ điều phối / lên camp của worker) quá THU_LAI_PHUT → xoá để bước đó thử lại; Telegram vẫn chỉ báo một lần (khoá canh_bao theo lượt nhận × bước)
    q(f"update etp.phim_nhan set loi = null, loi_luc = null where loi is not null and loi_luc < now() - interval '{THU_LAI_PHUT} minutes'")
    kq = {"nhan_soat": 0, "nhan_chi_vnd": 0}
    for l in q(f"select id || '|' || content_id from etp.phim_nhan_td where buoc = 'cho_soat' order by id limit {SOAT_LUOT}").splitlines():
        i, cid = l.split("|")
        d, chi, ly = S.soat(int(cid), ghi=True); kq["nhan_soat"] += 1; kq["nhan_chi_vnd"] += chi
        if d is None: q(f"update etp.phim_nhan set loi = $L$soát 18+ AI lỗi: {ly[:200].replace('$L$', '')}$L$, loi_luc = now() where id = {int(i)}")
    # báo bước hỏng — khoá canh_bao duy nhất theo lượt nhận × bước (worker gửi Telegram những dòng chưa gửi)
    hong = [l.split("|", 4) for l in q("""select id || '|' || content_id || '|' || coalesce(nguoi, '?') || '|' || buoc || '|' || coalesce(ghi, '') from etp.phim_nhan_td
                                            where buoc in ('loai_18', 'cham_chan', 'loi_sinh', 'loi')""").splitlines() if l.count("|") >= 4]
    if hong:
        ten = {l.split("|")[0]: l.split("|", 1)[1] for l in q(f"select content_id || '|' || coalesce(ten, '') from etp.thu_vien_phim where content_id in ({','.join(h[1] for h in hong)})").splitlines() if "|" in l}
        j = json.dumps([{"loai": "nhan_phim", "muc": "do" if b == "loi" else "vang", "khoa": f"nhan_phim:{i}:{b}",
                         "noi_dung": f"Phim nhận {ten.get(c, '#' + c)[:60]} (#{c}, {ng}) dừng ở bước {b}: {g[:240]}"} for i, c, ng, b, g in hong], ensure_ascii=False).replace("$J$", "")
        q(f"""insert into etp.canh_bao (loai, muc, khoa, noi_dung) select loai, muc, khoa, noi_dung from jsonb_to_recordset($J${j}$J$::jsonb) as x(loai text, muc text, khoa text, noi_dung text)
              on conflict (khoa) do nothing""")
    kq["nhan_hong"] = len(hong)
    return kq

if __name__ == "__main__":
    import subprocess
    def q(s):
        r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True, timeout=300)
        if r.returncode: raise RuntimeError(r.stderr[-300:])
        return r.stdout.strip()
    print(json.dumps(chay(q)))
