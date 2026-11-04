#!/usr/bin/env python3
"""THẰNG MẠNH — CANH DÒNG PHIM (anh 03/11/2026: "có thằng Mạnh ở chờ ở phía sau để chủ động check nếu bị stuck cái nào đó timeout ngu mà ko chịu dừng").
Chạy trên box3 (etp-manh.timer, 2 phút/lần) — máy KHÁC với máy chạy dòng (apps/etp/dong_phim.py, iMac) để máy kia chết thì vẫn có người thấy.
Mỗi lượt:
  1. bước 'dang' quá hạn (han_giay) hoặc im (nhip) quá 10 phút → đặt huy (máy chạy dòng giết tiến trình), ghi lỗi; lần đầu thì tự FIX (chạy lại bước) một lần
  2. máy chạy dòng im > 3 phút mà còn dòng chạy → báo Telegram (30 phút một lần), bước của nó coi như chết (mục 1 lo)
  3. dòng vừa kết thúc (xong / dừng vì policy / lỗi) → báo Telegram một lần
  4. việc cắt lô dòng phim (etp.viec lô dp*) 'dang' quá 75 phút → xếp lại hàng chờ (tho.py chỉ tự quét việc của chính máy nó)
Dùng: manh.py [--thu] (--thu: chỉ in, không ghi / không báo)"""
import hashlib, importlib.util, json, os, subprocess, sys
THU = "--thu" in sys.argv
# .rstrip("\n"), KHÔNG .strip(): strip cắt luôn tab cuối → cột rỗng cuối hàng mất, "dòng vừa kết thúc" (camp rỗng) chết ValueError mỗi lượt — 180 lần / 3 giờ,
# Mạnh không báo Telegram, không xếp lại việc kẹt (04/11/2026). Hàng rỗng bỏ ở chỗ dùng (splitlines không sinh hàng rỗng ở giữa).
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-F", "\t", "-c", s], capture_output=True, text=True).stdout.rstrip("\n")
TEN = {"nhan": "Nhận phim", "ws": "Trang phim", "poster": "Soát poster", "cat": "Cắt đoạn", "soat": "Soát đoạn", "creative": "Tải + chấm", "camp": "Lên camp", "chay": "Camp chạy"}
IM_BUOC, IM_MAY = 600, 180   # giây
# MÃ LUẬT CỦA TỪNG BƯỚC (04/11/2026: nới luật máu poster + miễn trùng đội cho camp tay mà 11 + 2 dòng dừng cũ vẫn đứng — dấu cổng không thấy luật đổi):
# bước dừng ở đâu thì băm tệp làm luật bước đó; sửa tệp → dấu đổi → dòng tự chạy lại bước dừng một lần. Bước Lên camp thêm NGÀY: cổng camp
# (bão hoà, ngân sách, trùng đội) đổi theo số mỗi ngày → mỗi ngày thử lại một lần.
G = os.path.dirname(os.path.abspath(__file__)); XE = os.path.join(G, "..", "xuong-video", "scripts", "ethopex")
MA_BUOC = {"poster": [f"{G}/soat_18_ai.py"], "soat": [f"{XE}/soat_doan.py"], "cat": [f"{G}/dong_phim.py", f"{G}/tho.py"],
           "creative": [f"{G}/dong_phim.py", f"{XE}/len-creative.py", f"{G}/cong.py"], "camp": [f"{G}/dong_phim.py", f"{G}/cong.py", f"{XE}/nhan-ban.py"]}
def bam(tep):
    h = hashlib.md5()
    for f in tep:
        if os.path.exists(f): h.update(open(f, "rb").read())
    return h.hexdigest()[:10]

def bao(chu):
    if THU: return print("[TG]", chu)
    try:
        s = importlib.util.spec_from_file_location("lg", os.path.join(os.path.dirname(os.path.abspath(__file__)), "lich-gio.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
        m.bao_tg(chu)
    except Exception as e: print("báo Telegram lỗi:", e, file=sys.stderr)
def ghi(cau):
    if THU: return print("[SQL]", cau[:200])
    q(cau)

def main():
    lam = []
    # 1. bước quá hạn / im
    for l in q("""select b.dong_id, b.buoc, b.lan, extract(epoch from now() - b.bat_dau)::int, extract(epoch from now() - coalesce(b.nhip, b.bat_dau))::int, b.han_giay,
                         p.content_id, coalesce(p.ten, ''), coalesce(b.ghi, '')
                  from etp.dong_buoc b join etp.dong_phim p on p.id = b.dong_id where b.trang_thai = 'dang' and not b.huy and p.trang_thai = 'chay'""").splitlines():
        dong, buoc, lan, tuoi, im, han, cid, ten, gc = l.split("\t"); tuoi, im, han, lan = int(tuoi), int(im), int(han), int(lan)
        if tuoi <= han and im <= IM_BUOC: continue
        ly = f"quá hạn {tuoi // 60} phút (hạn {han // 60})" if tuoi > han else f"im {im // 60} phút (máy chạy dòng không còn báo sống)"
        tu_fix = lan < 2
        ghi(f"""update etp.dong_buoc set huy = true, trang_thai = 'loi', ket_thuc = now(), ghi = $G$Mạnh: {ly} — {gc[:200].replace('$G$', '')}$G$, fix = {str(tu_fix).lower()}
                where dong_id = {dong} and buoc = '{buoc}' and trang_thai = 'dang';
                update etp.dong_phim set trang_thai = 'loi', ly_do = $G${buoc}: Mạnh — {ly}$G$, xong_luc = now(){', bao_luc = now()' if tu_fix else ''} where id = {dong} and trang_thai = 'chay'""")
        lam.append(f"dòng #{dong} · {TEN.get(buoc, buoc)} {ly} → {'tự FIX lần ' + str(lan + 1) if tu_fix else 'đã FIX ' + str(lan - 1) + ' lần — Mạnh thử lại sau 2 giờ (tối đa 6 lần)'}")
        bao(f"🚧 <b>Mạnh</b> · phim <b>{ten or cid}</b> (#{cid}) · bước <b>{TEN.get(buoc, buoc)}</b> {ly}\n"
            + ("→ đã huỷ tiến trình, tự chạy lại bước (FIX tự động)" if tu_fix else "→ đã huỷ; FIX nhanh đã dùng — Mạnh tự thử lại sau 2 giờ (tối đa 6 lần), không để dòng chết"))
    # 2. máy chạy dòng im
    for l in q(f"""select m.may, extract(epoch from now() - m.nhip)::int, coalesce(extract(epoch from now() - m.bao_luc)::int, 999999) from etp.dong_may m
                  where m.nhip < now() - interval '{IM_MAY} seconds' and exists (select 1 from etp.dong_phim where trang_thai = 'chay')""").splitlines():
        may, im, da = l.split("\t")
        if int(da) < 1800: continue
        ghi(f"update etp.dong_may set bao_luc = now() where may = '{may}'")
        lam.append(f"máy chạy dòng {may} im {int(im) // 60} phút")
        bao(f"🚨 <b>Mạnh</b> · máy chạy dòng phim <b>{may}</b> im {int(im) // 60} phút mà còn dòng đang chạy — launchd com.htuan.etp-dong-phim (iMac) tự bật lại; bước đang dở sẽ bị huỷ + FIX khi quá {IM_BUOC // 60} phút")
    # 3. dòng vừa kết thúc
    for l in q("""select id, content_id, coalesce(ten, ''), trang_thai, coalesce(ly_do, ''), coalesce(camp_id::text, '') from etp.dong_phim
                  where trang_thai in ('xong', 'dung', 'loi') and bao_luc is null and xong_luc > now() - interval '1 day'""").splitlines():
        dong, cid, ten, tt, ly, camp = l.split("\t")
        ghi(f"update etp.dong_phim set bao_luc = now() where id = {dong}")
        dau = {"xong": "✅ lên camp xong", "dung": "⛔ dừng (policy / luật)", "loi": "❌ lỗi kỹ thuật"}[tt]
        lam.append(f"dòng #{dong} {tt}")
        bao(f"{dau} · phim <b>{ten or cid}</b> (#{cid}){f' · camp #{camp}' if camp else ''}\n{ly[:600]}")
    # 4. việc cắt lô dòng phim kẹt
    r = q("update etp.viec set trang_thai = 'cho', may = null, loi = coalesce(loi, '') || ' | Mạnh: kẹt quá 75 phút, xếp lại' where lo like 'dp%' and trang_thai = 'dang' and bat_dau < now() - interval '75 minutes' returning id") if not THU else ""
    if r: lam.append(f"xếp lại việc cắt kẹt: {r.replace(chr(10), ' ')}")
    # 5. TỰ MỞ LẠI DÒNG DỪNG KHI CỔNG CỦA PHIM ĐỔI (anh 04/11/2026 "tại sao cứ phải địt cụ mày mới fix? ko làm tự động hết đc à"):
    #    trước đây đọc CHỮ lý do, mỗi kiểu lý do một luật → kiểu chưa có luật thì sót (dòng #47 đứng "0"). Nay: lúc dòng dừng chụp DẤU cổng
    #    (sổ cấm 18+ · nhóm gốc · số creative đạt CTA chưa camp); dấu đổi → chạy lại đúng bước dừng, mọi lý do, không cần luật riêng.
    dau = """concat_ws('|', (select (k.gia_tri ? d.content_id::text)::text from xv_khoa_ngoai k where k.ten = 'ethopex_phim_cam'),
             (select f.nhom_goc from etp.phim f where f.content_id = d.content_id),
             (select count(*) from etp.creative r join etp.cham_cong g using (creative_id) where r.content_id = d.content_id and r.cta_dat and g.duoc_len
                and r.tu_choi is null and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)),
             case split_part(d.ly_do, ':', 1) """ + " ".join(f"when '{k}' then '{bam(v)}'" for k, v in MA_BUOC.items()) + f""" else '{bam([f"{G}/dong_phim.py"])}' end,
             case when split_part(d.ly_do, ':', 1) = 'camp' then to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') end)"""
    if THU: r = q(f"select d.id, d.dau_dung, {dau} from etp.dong_phim d where d.trang_thai = 'dung' and d.tao_luc > now() - interval '3 days'")
    else:
        q(f"update etp.dong_phim d set dau_dung = {dau} where d.trang_thai = 'dung' and d.dau_dung is null")
        r = q(f"""with mo as (update etp.dong_phim d set dau_dung = null where d.trang_thai = 'dung' and d.tao_luc > now() - interval '3 days'
                     and d.dau_dung is distinct from {dau} returning d.id)
                  update etp.dong_buoc b set fix = true from mo join etp.dong_phim p on p.id = mo.id where b.dong_id = mo.id and not b.fix
                    and (b.trang_thai in ('dung', 'loi') or (b.buoc = split_part(p.ly_do, ':', 1) and not exists (select 1 from etp.dong_buoc x where x.dong_id = mo.id and x.trang_thai in ('dung', 'loi'))))
                  returning b.dong_id, b.buoc""")
    if r: lam.append(f"mở lại (cổng phim đã đổi): {r.replace(chr(10), ' · ').replace(chr(9), ' ')}")
    # 6. KHÔNG DỪNG HẲN (anh 04/11/2026 "Lý do phải luôn đi kèm Bước giải quyết !! Ko dừng hẳn như vậy" — dòng #5 đứng 'lỗi' từ hôm qua):
    #    dòng LỖI KỸ THUẬT (không phải dừng vì luật) → thử lại bước lỗi sau 2 giờ, tối đa 6 lần, trong 3 ngày; hết lượt mới báo anh một lần
    r = q("""update etp.dong_buoc b set fix = true from etp.dong_phim d where d.id = b.dong_id and d.trang_thai = 'loi' and b.trang_thai = 'loi' and not b.fix
              and b.lan < 6 and b.ket_thuc < now() - interval '2 hours' and d.tao_luc > now() - interval '3 days' returning b.dong_id, b.buoc, b.lan""") if not THU else ""
    if r: lam.append(f"thử lại lỗi (2 giờ/lần): {r.replace(chr(10), ' · ').replace(chr(9), ' ')}")
    print("Mạnh:", " · ".join(lam) if lam else "không có gì kẹt")

if __name__ == "__main__": main()
