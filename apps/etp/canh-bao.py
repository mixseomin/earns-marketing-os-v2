#!/usr/bin/env python3
"""CẢNH BÁO BẤT THƯỜNG trên kho etp (etp.on.tc bước 3, anh 24/10/2026). dong-bo.py gọi cuối mỗi lượt; ghi etp.canh_bao (khoá chống lặp theo ngày),
phòng Ethopex (cty ethopex.mjs) gửi Telegram dòng chưa gửi. Chỉ đọc kho, không sửa camp.
Ngày = ngày Ethopex (UTC). Các dò (ngưỡng ở đầu tệp):
  chi_vuot     camp chi hôm nay > CHI_VUOT × ngân sách ngày (Meta tiêu lố / ngân sách bị đổi ngoài máy)
  roi_sup      cả hệ thống: chi hôm nay ≥ $ROI_SUP_CHI mà ROI < ROI_SUP% (sau ≥ 6 giờ UTC để có số)
  bo_ngung     một bộ tài khoản: có camp đang bật, hôm qua chi ≥ $20, hôm nay 0 sau 4 giờ UTC → có thể tài khoản / Page bị khoá
  tu_choi_loat ≥ TU_CHOI_LOAT ad bị Meta từ chối cùng lúc (khả năng Page / tên miền bị gắn cờ)
  dong_bo_tre  lượt đồng bộ gần nhất lỗi
  phim_bao_hoa  > 10 camp và ROI phim giảm 2 ngày liền (bảng etp.phim_bao_hoa: chan_nb cho luật NB, bao_hoa cho Telegram / etp / extension)
  roas_gan / roas_dat  camp ROI ≥ 50% ổn định 2–3 ngày: chi ≥ $70 sắp đủ, ≥ $100 đủ tiêu chí bid ROAS (một lần mỗi camp mỗi mức)"""
import datetime as dt, json, os, subprocess
CHI_VUOT, ROI_SUP_CHI, ROI_SUP, TU_CHOI_LOAT = 1.6, 100, -35, 5
ROAS_GAN, ROAS_DAT = 70, 100   # bid ROAS: báo sắp đủ từ $70 chi, đủ từ $100 (Support 24/10/2026)
def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def bao(loai, muc, khoa, chu):
    j = json.dumps([{"loai": loai, "muc": muc, "khoa": khoa, "noi_dung": chu}], ensure_ascii=False)
    q(f"insert into etp.canh_bao (loai, muc, khoa, noi_dung) select loai, muc, khoa, noi_dung from jsonb_to_recordset($J${j}$J$::jsonb) as x(loai text, muc text, khoa text, noi_dung text) on conflict (khoa) do nothing")

# BÃO HOÀ PHIM (anh 25/10/2026): nhiều camp cùng phim giành cùng tệp người xem → ROI cả phim tụt theo ngày (Number One 30 camp 148→106→76%,
# Dear Brother 16 camp 59→22→−8%; phim ít camp giữ ROI). Ngày trọn = ngày Ethopex (UTC) D−1, D−2, D−3.
#   chan_nb (B — luật NB đọc): ROI phim hôm qua < 50%, hoặc tụt hơn 20% so với hôm kia (dù vẫn > 100%), hoặc đang bão hoà (D) → không nhân bản thêm
#   bao_hoa (D — Telegram / etp / extension): > 10 camp đang chạy và ROI phim giảm 2 ngày liền (mỗi ngày chi ≥ $5)
BH_CAMP, NB_ROI_PHIM, NB_GIU = 10, 50, 0.8   # 0.7 → 0.8 (anh 25/10/2026: Number One 148% → 106% vẫn > 100% nhưng giảm sâu thì cũng phải dừng nhân bản)
def bao_hoa_phim(nay):
    d = [(nay - dt.timedelta(days=k)).isoformat() for k in (1, 2, 3)]
    rows = q(f"""with c as (select content_id, count(*) filter (where trang_thai = 'ACTIVE') so from etp.camp where content_id is not null group by 1),
                 s as (select k.content_id, s.ngay, sum(s.chi) chi, sum(s.thu) thu from etp.so_ngay s join etp.camp k using (camp_id)
                       where s.ngay in ('{d[0]}', '{d[1]}', '{d[2]}') group by 1, 2)
             select c.content_id, coalesce(p.ten, ''), c.so, coalesce(json_agg(json_build_object('d', s.ngay, 'chi', round(s.chi, 2), 'thu', round(s.thu, 2)) order by s.ngay) filter (where s.ngay is not null), '[]')
             from c left join s using (content_id) left join etp.phim p using (content_id) where c.so > 0 group by 1, 2, 3""").splitlines()
    out, n = [], 0
    for l in rows:
        cid, ten, so, js = l.split("|", 3); so = int(so); ng = {x["d"]: x for x in json.loads(js)}
        r = lambda x: (x["thu"] - x["chi"]) / x["chi"] * 100 if x and x["chi"] > 0 else None
        x1, x2, x3 = ng.get(d[0]), ng.get(d[1]), ng.get(d[2]); r1, r2, r3 = r(x1), r(x2), r(x3)
        chan = None
        if x1 and x1["chi"] >= 10 and r1 is not None:
            if r1 < NB_ROI_PHIM: chan = f"ROI phim hôm qua {r1:+.0f}% < {NB_ROI_PHIM}%"
            elif r2 is not None and r2 > 0 and r1 < NB_GIU * r2: chan = f"ROI phim tụt {r2:+.0f}% → {r1:+.0f}% (giảm {round((1 - r1 / r2) * 100)}%, ngưỡng {round((1 - NB_GIU) * 100)}%)"
        bh = None
        if so > BH_CAMP and None not in (r1, r2, r3) and all(x and x["chi"] >= 5 for x in (x1, x2, x3)) and r3 > r2 > r1:
            bh = f"{so} camp đang chạy · ROI phim {r3:+.0f}% → {r2:+.0f}% → {r1:+.0f}% (3 ngày) — camp tự giành cùng tệp người xem"
            bao("phim_bao_hoa", "vang", f"phim_bao_hoa:{cid}:{nay}", f"⚠ PHIM BÃO HOÀ: {ten[:50]} (#{cid}) — {bh}. Máy đã dừng nhân bản phim này; đoạn quá tải đang được dọn sang góc mới."); n += 1
            chan = chan or f"bão hoà: ROI phim giảm 2 ngày liền ({r3:+.0f}% → {r2:+.0f}% → {r1:+.0f}%)"
        roi = [{"d": k, "chi": v["chi"], "thu": v["thu"], "roi": None if r(v) is None else round(r(v))} for k, v in sorted(ng.items())]
        out.append({"content_id": int(cid), "ten": ten, "so_camp": so, "roi": roi, "chan_nb": chan, "bao_hoa": bh})
    j = json.dumps(out, ensure_ascii=False).replace("$J$", "")
    q(f"""begin; delete from etp.phim_bao_hoa; insert into etp.phim_bao_hoa (content_id, ten, so_camp, roi, chan_nb, bao_hoa)
          select content_id, ten, so_camp, roi, chan_nb, bao_hoa from jsonb_to_recordset($J${j}$J$::jsonb) as x(content_id int, ten text, so_camp int, roi jsonb, chan_nb text, bao_hoa text); commit;""")
    return n

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
    # BID ROAS (anh 24/10/2026: "camp nào gần đạt có cảnh báo; còn đạt thì cho vào một danh sách riêng"): ROI 30 ngày ≥ 50% và mọi ngày TRỌN có chi ≥ $1
    # trong 3 ngày gần nhất ROI ≥ 50% (≥ 2 ngày như vậy) — gần đạt = chi ≥ $ROAS_GAN, đạt = chi ≥ $ROAS_DAT. Báo MỘT lần mỗi camp mỗi mức.
    for l in q(f"""with t as (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay where ngay >= '{nay}'::date - 29 group by 1 having sum(chi) >= {ROAS_GAN} and sum(thu) >= 1.5 * sum(chi)),
                     d as (select camp_id, bool_and(thu >= 1.5 * chi) od, count(*) so from etp.so_ngay where ngay between '{nay}'::date - 3 and '{nay}'::date - 1 and chi >= 1 group by 1)
                   select c.camp_id, c.ten, c.ngan_sach, round(t.chi, 2), round(100 * (t.thu - t.chi) / t.chi) from t join d using (camp_id) join etp.camp c using (camp_id)
                   where d.od and d.so >= 2 and c.trang_thai = 'ACTIVE'""").splitlines():
        i, ten, ns, chi, roi = l.split("|"); dat = float(chi) >= ROAS_DAT
        bao("roas_dat" if dat else "roas_gan", "vang", f"roas_{'dat' if dat else 'gan'}:{i}",
            (f"★ Camp #{i} ĐỦ TIÊU CHÍ BID ROAS — chi ${float(chi):.0f}, ROI {roi}%, ổn định 2–3 ngày ≥ 50% — {ten[:70]} (etp.on.tc › Camp › ★ Đủ bid ROAS)" if dat else
             f"Camp #{i} SẮP ĐỦ bid ROAS — chi ${float(chi):.0f}/${ROAS_DAT}, ROI {roi}%, ổn định ≥ 50% · ${float(ns):g}/ngày ≈ {max(1, round((ROAS_DAT - float(chi)) / max(float(ns) * 0.7, 1)))} ngày nữa — {ten[:70]}")); n += 1
    n += bao_hoa_phim(now.date())
    l = q("select lan, coalesce(loi, '') from etp.dong_bo where xong is not null order by lan desc limit 1")
    if l and l.split("|", 1)[1]: bao("dong_bo_tre", "vang", f"dong_bo:{nay}:{now.hour}", f"Lượt đồng bộ kho etp #{l.split('|')[0]} lỗi: {l.split('|', 1)[1][:200]}"); n += 1
    print(json.dumps({"canh_bao_moi_thu": n}))

if __name__ == "__main__": main()
