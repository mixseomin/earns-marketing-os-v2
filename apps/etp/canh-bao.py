#!/usr/bin/env python3
"""CẢNH BÁO BẤT THƯỜNG trên kho etp (etp.on.tc bước 3, anh 24/10/2026). dong-bo.py gọi cuối mỗi lượt; ghi etp.canh_bao (khoá chống lặp theo ngày),
phòng Ethopex (cty ethopex.mjs) gửi Telegram dòng chưa gửi. Chỉ đọc kho, không sửa camp.
Ngày = ngày Ethopex (UTC). Các dò (ngưỡng ở đầu tệp):
  chi_vuot     camp chi hôm nay > CHI_VUOT × ngân sách ngày (Meta tiêu lố / ngân sách bị đổi ngoài máy)
  roi_sup      cả hệ thống: chi hôm nay ≥ $ROI_SUP_CHI mà ROI < ROI_SUP% (sau ≥ 6 giờ UTC để có số)
  bo_ngung     một bộ tài khoản: có camp đang bật, hôm qua chi ≥ $20, hôm nay 0 sau 4 giờ UTC → có thể tài khoản / Page bị khoá
  tu_choi_loat ≥ TU_CHOI_LOAT ad bị Meta từ chối cùng lúc (khả năng Page / tên miền bị gắn cờ)
  dong_bo_tre  lượt đồng bộ gần nhất lỗi"""
import datetime as dt, json, os, subprocess
CHI_VUOT, ROI_SUP_CHI, ROI_SUP, TU_CHOI_LOAT = 1.6, 100, -35, 5
def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def bao(loai, muc, khoa, chu):
    j = json.dumps([{"loai": loai, "muc": muc, "khoa": khoa, "noi_dung": chu}], ensure_ascii=False)
    q(f"insert into etp.canh_bao (loai, muc, khoa, noi_dung) select loai, muc, khoa, noi_dung from jsonb_to_recordset($J${j}$J$::jsonb) as x(loai text, muc text, khoa text, noi_dung text) on conflict (khoa) do nothing")

def main():
    now = dt.datetime.now(dt.timezone.utc); nay = now.date().isoformat(); qua = (now.date() - dt.timedelta(days=1)).isoformat(); n = 0
    for l in q(f"""select c.camp_id, c.ten, c.ngan_sach, s.chi from etp.camp c join etp.so_ngay s on s.camp_id = c.camp_id and s.ngay = '{nay}'
                   where c.ngan_sach > 0 and s.chi > {CHI_VUOT} * c.ngan_sach and s.chi >= 3""").splitlines():
        i, ten, ns, chi = l.split("|"); bao("chi_vuot", "vang", f"chi_vuot:{i}:{nay}", f"Camp #{i} chi hôm nay ${float(chi):.2f} > {CHI_VUOT}× ngân sách ${float(ns):g} — {ten[:70]}"); n += 1
    if now.hour >= 6:
        r = q(f"select coalesce(sum(chi),0), coalesce(sum(thu),0) from etp.so_ngay where ngay = '{nay}'").split("|"); chi, thu = float(r[0]), float(r[1])
        if chi >= ROI_SUP_CHI and (thu - chi) / chi * 100 < ROI_SUP: bao("roi_sup", "do", f"roi_sup:{nay}", f"ROI cả hệ thống hôm nay {(thu - chi) / chi * 100:+.0f}% (chi ${chi:.0f}, thu ${thu:.0f}) — dưới {ROI_SUP}%, doanh thu có thể còn về trễ; xem tab Ethopex"); n += 1
    if now.hour >= 4:
        for l in q(f"""select c.bo, count(*) filter (where c.trang_thai = 'ACTIVE'),
                         coalesce((select sum(chi) from etp.so_ngay s join etp.camp x on x.camp_id = s.camp_id where x.bo = c.bo and s.ngay = '{qua}'), 0),
                         coalesce((select sum(chi) from etp.so_ngay s join etp.camp x on x.camp_id = s.camp_id where x.bo = c.bo and s.ngay = '{nay}'), 0)
                       from etp.camp c where c.bo is not null group by c.bo""").splitlines():
            bo, chay, cq, cn = l.split("|")
            if int(chay) > 0 and float(cq) >= 20 and float(cn) == 0: bao("bo_ngung", "do", f"bo_ngung:{bo}:{nay}", f"Bộ tài khoản {bo}: {chay} camp đang bật, hôm qua chi ${float(cq):.0f} mà hôm nay $0 sau {now.hour}h UTC — kiểm tài khoản QC / Page có bị khoá không"); n += 1
    tc = int(q("select count(*) from etp.camp where trang_thai = 'ACTIVE' and (giao = 'DISAPPROVED' or loi ilike '%disapprov%')") or 0)
    if tc >= TU_CHOI_LOAT: bao("tu_choi_loat", "do", f"tu_choi_loat:{nay}:{tc // TU_CHOI_LOAT}", f"{tc} ad đang bị Meta từ chối cùng lúc — khả năng Page / tên miền bị gắn cờ; máy đang tự thay creative từng camp"); n += 1
    l = q("select lan, coalesce(loi, '') from etp.dong_bo where xong is not null order by lan desc limit 1")
    if l and l.split("|", 1)[1]: bao("dong_bo_tre", "vang", f"dong_bo:{nay}:{now.hour}", f"Lượt đồng bộ kho etp #{l.split('|')[0]} lỗi: {l.split('|', 1)[1][:200]}"); n += 1
    print(json.dumps({"canh_bao_moi_thu": n}))

if __name__ == "__main__": main()
