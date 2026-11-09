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
  roas_gan / roas_dat  camp ROI ≥ 50% ổn định 2–3 ngày: chi ≥ $70 sắp đủ, ≥ $100 đủ tiêu chí bid ROAS (một lần mỗi camp mỗi mức)
  phim_bao_hoa thêm luật "lên thêm camp mà ROI phim cả hệ giảm" (02/11/2026) — mọi số phim tính trên nhà + team; lãi $ vẫn tăng thì không tính bão hoà (06/11/2026)
  bao_hoa_team   tài khoản team lên camp mới cho phim đang bão hoà — chỉ báo, không chặn (anh 02/11/2026)
  tran_phim_vuot  một phim có > etp.cau_hinh.tran_phim camp đang chạy trong MỘT tài khoản (nhà: máy đã chặn mở thêm; team: chỉ báo) — mỗi ngày một lần
  tieu_vong      camp thường 2 ngày khép liền tiêu ≥ 60% NS trước 12h UTC mà lỗ (Dol 09/11/2026: mùa Ads phân phối lệch) — báo vàng, chưa tắt
  tran_phim_mo    phim đủ trần ở một tài khoản nhà và MỌI camp đang chạy lãi đều (3 ngày đã khép, ≥ 2 ngày có chi ≥ $1, ngày nào cũng thu > chi)
                  → đề xuất anh mở thêm chỗ (anh 02/11/2026: "khi nào tất cả 30 cùng lãi đều và ổn định mới đề xuất mở thêm slot")"""
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
CM_CHI, CM_ROI = 20, 20   # clone mới: chi ≥ $20 trong 2 ngày khép mà ROI < 20% → chặn nhân bản phim
BH_CAMP, NB_ROI_PHIM, NB_GIU = 10, 50, 0.8   # 0.7 → 0.8 (anh 25/10/2026: Number One 148% → 106% vẫn > 100% nhưng giảm sâu thì cũng phải dừng nhân bản)
_NGOAI = "ad_account_id in (select ad_account_id from etp.tai_khoan where not nha)"
_SO = f"""select k.content_id, k.tao, s.ngay, s.chi, s.thu from etp.so_ngay s join etp.camp k using (camp_id) union all
         select k.content_id, k.tao, s.ngay, s.chi, s.thu from etp.so_ngay_ngoai s join etp.camp_ngoai k using (camp_id) where k.{_NGOAI}"""
def bao_hoa_phim(nay):
    d = [(nay - dt.timedelta(days=k)).isoformat() for k in (1, 2, 3)]
    # đếm theo view etp.camp_dang_chay (gồm camp tạm dừng vì LỊCH GIỜ) — khung TẮT không được làm phim rơi khỏi bảng bão hoà
    # CẢ HỆ (anh 02/11/2026 "của từng film"): nhà + tài khoản team cùng giành một tệp người xem → ROI phim, số camp, clone mới đều tính trên mọi tài khoản
    rows = q(f"""with c as (select content_id, count(*) so from (select content_id from etp.camp_dang_chay union all
                        select content_id from etp.camp_ngoai where trang_thai = 'ACTIVE' and {_NGOAI}) x where content_id is not null group by 1),
                 s as (select content_id, ngay, sum(chi) chi, sum(thu) thu from ({_SO}) s
                       where s.ngay in ('{d[0]}', '{d[1]}', '{d[2]}') group by 1, 2)
             select c.content_id, coalesce(p.ten, ''), c.so, coalesce(json_agg(json_build_object('d', s.ngay, 'chi', round(s.chi, 2), 'thu', round(s.thu, 2)) order by s.ngay) filter (where s.ngay is not null), '[]')
             from c left join s using (content_id) left join etp.phim p using (content_id) where c.so > 0 group by 1, 2, 3""").splitlines()
    moi_cua = {int(l.split("|")[0]): (float(l.split("|")[1]), float(l.split("|")[2])) for l in q(f"""select content_id, sum(chi), sum(thu) from ({_SO}) s
        where s.ngay in ('{d[0]}', '{d[1]}') and content_id is not null and s.ngay - (s.tao at time zone 'utc')::date <= 2 group by 1""").splitlines() if l.count("|") == 2}
    # camp MỚI lên mỗi ngày đã khép (mọi tài khoản, kể cả ROAS — ROAS không bị chặn nhưng vẫn là thêm camp giành tệp người xem)
    len_moi = {}
    for l in q(f"""select content_id, (tao at time zone 'utc')::date, count(*) from (select content_id, tao from etp.camp union all
                     select content_id, tao from etp.camp_ngoai where {_NGOAI}) x where content_id is not null and (tao at time zone 'utc')::date in ('{d[0]}', '{d[1]}') group by 1, 2""").splitlines():
        cid, ng, so = l.split("|"); len_moi.setdefault(int(cid), {})[ng] = int(so)
    out, n = [], 0
    for l in rows:
        cid, ten, so, js = l.split("|", 3); so = int(so); ng = {x["d"]: x for x in json.loads(js)}
        r = lambda x: (x["thu"] - x["chi"]) / x["chi"] * 100 if x and x["chi"] > 0 else None
        x1, x2, x3 = ng.get(d[0]), ng.get(d[1]), ng.get(d[2]); r1, r2, r3 = r(x1), r(x2), r(x3)
        chan = None
        if x1 and x1["chi"] >= 10 and r1 is not None:
            if r1 < NB_ROI_PHIM: chan = f"ROI phim hôm qua {r1:+.0f}% < {NB_ROI_PHIM}%"
            elif r2 is not None and r2 > 0 and r1 < NB_GIU * r2: chan = f"ROI phim tụt {r2:+.0f}% → {r1:+.0f}% (giảm {round((1 - r1 / r2) * 100)}%, ngưỡng {round((1 - NB_GIU) * 100)}%)"
        cm = moi_cua.get(int(cid))   # CLONE MỚI KHÔNG ĂN (anh 26/10/2026 "làm đi": ¡Atrás! camp cũ +42% mà clone ≤ 2 ngày chỉ +2%) — clone mới 2 ngày khép ROI < 20% → ngừng nhân bản
        if not chan and cm and cm[0] >= CM_CHI and (cm[1] - cm[0]) / cm[0] * 100 < CM_ROI: chan = f"clone mới (≤ 2 ngày tuổi) 2 ngày khép ROI {(cm[1] - cm[0]) / cm[0] * 100:+.0f}% < {CM_ROI}% trên ${cm[0]:.0f} — nhân bản thêm không ăn"
        # Lý do bắt đầu bằng "bão hoà" được ưu tiên ghi vào chan_nb: nhan-ban.py chặn CREATIVE MỚI chỉ với lý do này; nhân bản thì lý do nào cũng chặn
        # LÊN THÊM CAMP MÀ ROI PHIM GIẢM (anh 02/11/2026: "sau mỗi lần nhân bản, lên thêm camp mà tổng thể ROI giảm có thể coi là chạm mức bão hoà cần theo dõi
        # và không lên camp mới"): phim có camp mới lên trong 2 ngày đã khép, ROI cả hệ hôm qua thấp hơn ngày TRƯỚC đợt lên → chặn mở camp mới (trừ ROAS).
        # Hết đợt lên mới (2 ngày không thêm camp) thì luật này tự nhả; các luật trên vẫn giữ nếu ROI còn thấp.
        lm = len_moi.get(int(cid), {}); goc = (x3, r3, d[2]) if lm.get(d[1]) else (x2, r2, d[1])
        # LÃI VẪN TĂNG THÌ KHÔNG BÃO HOÀ (anh 06/11/2026 sau tin #169100 "lên thêm 44 camp mà ROI +43% → +25%": "Phim mà lên camp vẫn tăng roi thì ko đc coi là bão hoà nữa"
        # — lãi phim $17 → $87 → $93/ngày): ROI % giảm vì chi to hơn mà lãi $ hôm qua vẫn ≥ lãi ngày gốc = phim còn hấp thụ, không gắn bão hoà
        lai = lambda x: x["thu"] - x["chi"]
        if lm and x1 and x1["chi"] >= 10 and r1 is not None and goc[0] and goc[0]["chi"] >= 5 and goc[1] is not None and r1 < goc[1] and lai(x1) < lai(goc[0]):
            chan = f"bão hoà theo dõi: lên thêm {sum(lm.values())} camp mà ROI phim cả hệ {goc[1]:+.0f}% ({goc[2][8:]}/{goc[2][5:7]}) → {r1:+.0f}% hôm qua, lãi ${lai(goc[0]):.0f} → ${lai(x1):.0f}"
        bh = None
        if so > BH_CAMP and None not in (r1, r2, r3) and all(x and x["chi"] >= 5 for x in (x1, x2, x3)) and r3 > r2 > r1 and lai(x1) < lai(x3):
            bh = f"{so} camp đang chạy · ROI phim {r3:+.0f}% → {r2:+.0f}% → {r1:+.0f}% (3 ngày) — camp tự giành cùng tệp người xem"
            bao("phim_bao_hoa", "vang", f"phim_bao_hoa:{cid}:{nay}", f"⚠ PHIM BÃO HOÀ: {ten[:50]} (#{cid}) — {bh}. Chỉ cảnh báo — máy vẫn lên camp / nhân bản phim này (anh 06/11/2026)."); n += 1
            chan = chan if chan and chan.startswith("bão hoà") else f"bão hoà: ROI phim giảm 2 ngày liền ({r3:+.0f}% → {r2:+.0f}% → {r1:+.0f}%)"
        roi = [{"d": k, "chi": v["chi"], "thu": v["thu"], "roi": None if r(v) is None else round(r(v))} for k, v in sorted(ng.items())]
        out.append({"content_id": int(cid), "ten": ten, "so_camp": so, "roi": roi, "chan_nb": chan, "bao_hoa": bh})
    j = json.dumps(out, ensure_ascii=False).replace("$J$", "")
    q(f"""begin; delete from etp.phim_bao_hoa; insert into etp.phim_bao_hoa (content_id, ten, so_camp, roi, chan_nb, bao_hoa)
          select content_id, ten, so_camp, roi, chan_nb, bao_hoa from jsonb_to_recordset($J${j}$J$::jsonb) as x(content_id int, ten text, so_camp int, roi jsonb, chan_nb text, bao_hoa text); commit;""")
    return n

# TIÊU VỐNG (Dol / Ethopex 16:00 09/11/2026: mùa Ads đội Ecom lớn chạy, "camp của mình bị tiêu vống trong thời gian ngắn hoặc phân phối không đều là hỏng camp"):
# đo kho 02–08/11 (467 camp-ngày thường NS ≥ $3): ngày tiêu ≥ TV_PHAN ngân sách trước giờ TV_GIO UTC → ROI −2%, ngày tiêu đều → +24%.
# Camp thường đang bật, 2 ngày đã khép liền đều tiêu sớm ≥ TV_PHAN × NS và lỗ → báo vàng (một lần mỗi camp mỗi ngày), CHƯA tự tắt (anh chưa duyệt luật tắt).
TV_PHAN, TV_GIO, TV_NGAY = 0.6, 12, 2
def tieu_vong(nay):
    ds = q(f"""with g as (select camp_id, ngay, sum(chi) filter (where gio < {TV_GIO}) som, sum(chi) chi, sum(thu) thu from etp.so_gio_camp
                            where ngay between '{nay}'::date - {TV_NGAY} and '{nay}'::date - 1 group by 1, 2),
                    x as (select g.*, k.ten, k.ngan_sach ns from g join etp.camp k using (camp_id) where not k.la_roas and k.trang_thai = 'ACTIVE' and k.ngan_sach >= 3
                            and g.som >= {TV_PHAN} * k.ngan_sach and g.thu < g.chi)
               select camp_id, min(ten), min(ns), string_agg(to_char(ngay, 'DD/MM') || ' sớm $' || round(som::numeric, 1) || ' ROI ' || round(100 * (thu - chi) / nullif(chi, 0)) || '%', ' · ' order by ngay)
               from x group by 1 having count(*) >= {TV_NGAY}""")
    n = 0
    for l in ds.splitlines():
        i, ten, ns, chu = l.split("|", 3)
        bao("tieu_vong", "vang", f"tieu_vong:{i}:{nay}", f"Camp #{i} tiêu vống: {TV_NGAY} ngày liền chi ≥ {TV_PHAN:.0%} ngân sách ${float(ns):g} trước {TV_GIO}h UTC mà lỗ ({chu}) — Meta phân phối lệch (mùa Ads), xem hạ / thay creative · {ten[:60]}"); n += 1
    return n

def tran_phim(nay):
    """TRẦN CAMP / PHIM THEO TỪNG TÀI KHOẢN (anh 02/11/2026: "Set lại 30 cho mọi camp nhà. Và theo từng tk. Có cảnh báo nếu film nhiều camp hơn mức đó").
    Đếm camp đang chạy (nhà: etp.camp_dang_chay; team: ACTIVE), camp ROAS ★ không tính — cùng cách đếm với nhan-ban.py dem_tk."""
    tran = int(float(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'tran_phim'), '0')") or 0))
    if tran <= 0: return 0
    n = 0
    for l in q(f"""with c as (select true nha, ad_account_id tk, content_id, camp_id from etp.camp
                      where content_id is not null and camp_id in (select camp_id from etp.camp_dang_chay) and not la_roas
                    union all select false, c.ad_account_id, c.content_id, c.camp_id from etp.camp_ngoai c join etp.tai_khoan t using (ad_account_id)
                      where not t.nha and c.trang_thai = 'ACTIVE' and c.content_id is not null and not c.la_roas),
                  s as (select camp_id, ngay, chi, thu from etp.so_ngay union all select camp_id, ngay, chi, thu from etp.so_ngay_ngoai),
                  d as (select camp_id, count(*) so, bool_and(thu > chi) lai from s where ngay between '{nay}'::date - 3 and '{nay}'::date - 1 and chi >= 1 group by 1)
                select c.nha, c.tk, c.content_id, count(*), count(*) filter (where d.so >= 2 and d.lai),
                  coalesce((select t.nguoi from etp.tai_khoan t where t.ad_account_id = c.tk), '?'),
                  coalesce((select max(x.bo) from etp.camp x where x.ad_account_id = c.tk), ''),
                  coalesce((select p.ten from etp.phim p where p.content_id = c.content_id), (select max(x.phim_ten) from etp.camp_ngoai x where x.content_id = c.content_id), '')
                from c left join d using (camp_id) group by 1, 2, 3 having count(*) >= {tran}""").splitlines():
        nha, tk, cid, so, on, nguoi, bo, ten = l.split("|", 7); nha, so, on = nha == "t", int(so), int(on)
        nhan = f"tk {tk} · {nguoi}" + (f" · bộ {bo}" if nha and bo else "")
        if so > tran:
            bao("tran_phim_vuot", "vang", f"tran_phim_vuot:{tk}:{cid}:{nay}", f"Phim {ten[:50]} (#{cid}) đang chạy {so} camp ở {nhan} — vượt trần {tran}/tài khoản · "
                + ("máy đã chặn mở thêm, camp đang chạy giữ nguyên" if nha else "tài khoản team chưa áp trần, chỉ báo")); n += 1
        if nha and on == so:
            bao("tran_phim_mo", "vang", f"tran_phim_mo:{tk}:{cid}:{nay}", f"ĐỀ XUẤT MỞ THÊM CHỖ: phim {ten[:50]} (#{cid}) đủ {so}/{tran} camp ở {nhan}, cả {so} camp lãi đều "
                f"mọi ngày đã khép (3 ngày, ≥ 2 ngày có chi) — anh quyết nâng trần etp.cau_hinh.tran_phim"); n += 1
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
    n += tran_phim(nay)
    n += tieu_vong(nay)
    # TÀI KHOẢN TEAM LÊN CAMP CHO PHIM ĐANG BÃO HOÀ (anh 02/11/2026: "tk team chỉ cảnh báo") — không chặn, báo mỗi tài khoản × phim một lần mỗi ngày
    for l in q(f"""select c.ad_account_id, c.content_id, count(*), coalesce(max(t.nguoi), '?'), max(b.ten), max(b.chan_nb) from etp.camp_ngoai c
                   join etp.tai_khoan t using (ad_account_id) join etp.phim_bao_hoa b using (content_id)
                   where not t.nha and b.chan_nb like 'bão hoà%' and c.tao > now() - interval '24 hours' and not c.la_roas group by 1, 2""").splitlines():
        tk, cid, so, nguoi, ten, ly = l.split("|", 5)
        bao("bao_hoa_team", "vang", f"bao_hoa_team:{tk}:{cid}:{nay}", f"Tài khoản {tk} · {nguoi} vừa lên {so} camp cho phim đang bão hoà {ten[:50]} (#{cid}) — {ly}. chỉ cảnh báo, không chặn (nhà lẫn team)"); n += 1
    # TRANG PHIM THIẾU (anh 02/11/2026, tab Phim): phim thêm vào workspace Ethopex > 30 phút mà Ethopex chưa sinh đủ mô tả / cốt truyện, thiếu ảnh / link tập 1,
    # hoặc link tập 1 trả 404 — nhan-ban.py đã chặn lên camp phim đó; báo mỗi bản × kiểu thiếu một lần (sửa xong rồi thiếu kiểu khác thì báo lại)
    try:
        for l in q("""select content_id, coalesce(ref_id, 0), coalesce(nguoi, '?'), coalesce(ten, ''), array_to_string(thieu, ', ') from etp.trang_phim_v
                       where cardinality(thieu) > 0 and tao < now() - interval '30 minutes' and tao > now() - interval '14 days'""").splitlines():
            ws, ref, nguoi, ten, thieu = l.split("|", 4)
            bao("trang_phim_thieu", "vang", f"trang_phim_thieu:{ws}:{thieu}", f"Trang phim {ten[:50]} (#{ref}, bản workspace #{ws} của {nguoi}) còn thiếu: {thieu} — máy không lên camp phim này tới khi đủ (mở lại trên Ethopex cho máy sinh / sửa)")
    except Exception as e: print(f"trang_phim_thieu: {e}")
    l = q("select lan, coalesce(loi, '') from etp.dong_bo where xong is not null order by lan desc limit 1")
    if l and l.split("|", 1)[1]: bao("dong_bo_tre", "vang", f"dong_bo:{nay}:{now.hour}", f"Lượt đồng bộ kho etp #{l.split('|')[0]} lỗi: {l.split('|', 1)[1][:200]}"); n += 1
    print(json.dumps({"canh_bao_moi_thu": n}))

if __name__ == "__main__": main()
