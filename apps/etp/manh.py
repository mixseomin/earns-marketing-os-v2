#!/usr/bin/env python3
"""THẰNG MẠNH — CANH DÒNG PHIM (anh 03/11/2026: "có thằng Mạnh ở chờ ở phía sau để chủ động check nếu bị stuck cái nào đó timeout ngu mà ko chịu dừng").
Chạy trên box3 (etp-manh.timer, 2 phút/lần) — máy KHÁC với máy chạy dòng (apps/etp/dong_phim.py, iMac) để máy kia chết thì vẫn có người thấy.
Mỗi lượt:
  1. bước 'dang' quá hạn (han_giay) hoặc im (nhip) quá 10 phút → đặt huy (máy chạy dòng giết tiến trình), ghi lỗi; lần đầu thì tự FIX (chạy lại bước) một lần
  2. máy chạy dòng im > 3 phút mà còn dòng chạy → báo Telegram (30 phút một lần), bước của nó coi như chết (mục 1 lo)
  3. dòng vừa kết thúc (xong / dừng vì policy / lỗi) → báo Telegram một lần
  4. việc cắt lô dòng phim (etp.viec lô dp*) 'dang' quá trần cắt của việc + 60 phút (tho.TRAN_SQL) → xếp lại hàng chờ (tho.py chỉ tự quét việc của chính máy nó)
  5–6. mở lại dòng dừng khi cổng đổi · thử lại dòng lỗi kỹ thuật
  7. lỗi MÃ ở máy luật / lên camp (etp.nhat_ky) → báo Telegram ngay, mỗi kiểu một lần / 6 giờ
Dùng: manh.py [--thu] (--thu: chỉ in, không ghi / không báo)"""
import hashlib, importlib.util, json, os, subprocess, sys
THU = "--thu" in sys.argv
# .rstrip("\n"), KHÔNG .strip(): strip cắt luôn tab cuối → cột rỗng cuối hàng mất, "dòng vừa kết thúc" (camp rỗng) chết ValueError mỗi lượt — 180 lần / 3 giờ,
# Mạnh không báo Telegram, không xếp lại việc kẹt (04/11/2026). Hàng rỗng bỏ ở chỗ dùng (splitlines không sinh hàng rỗng ở giữa).
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-F", "\t", "-c", s], capture_output=True, text=True).stdout.rstrip("\n")
# HÀNG = danh sách cột, tách bằng ký tự điều khiển US/RS (không bao giờ có trong chữ) — ly_do / ghi có xuống dòng làm vỡ tách "\n" + "\t"
# (04/11/2026 01:32 → 05/11: Mạnh chết ValueError 471 lượt liền ở mục 3, mục 4–6 không chạy — dòng lỗi không ai mở lại, không ai báo)
hang = lambda s: [r.split("\x1f") for r in subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-F", "\x1f", "-R", "\x1e", "-c", s],
                                                          capture_output=True, text=True).stdout.rstrip("\n").split("\x1e") if r.strip()]
TEN = {"nhan": "Nhận phim", "ws": "Trang phim", "poster": "Soát poster", "cat": "Cắt đoạn", "soat": "Soát đoạn", "creative": "Tải + chấm", "camp": "Lên camp", "chay": "Camp chạy"}
IM_BUOC, IM_MAY = 600, 180   # giây
# MÃ LUẬT CỦA TỪNG BƯỚC (04/11/2026: nới luật máu poster + miễn trùng đội cho camp tay mà 11 + 2 dòng dừng cũ vẫn đứng — dấu cổng không thấy luật đổi):
# bước dừng ở đâu thì băm tệp làm luật bước đó; sửa tệp → dấu đổi → dòng tự chạy lại bước dừng một lần. Bước Lên camp thêm NGÀY: cổng camp
# (bão hoà, ngân sách, trùng đội) đổi theo số mỗi ngày → mỗi ngày thử lại một lần.
G = os.path.dirname(os.path.abspath(__file__)); XE = os.path.join(G, "..", "xuong-video", "scripts", "ethopex")
_s = importlib.util.spec_from_file_location("tho", os.path.join(G, "tho.py")); THO = importlib.util.module_from_spec(_s); _s.loader.exec_module(THO)   # TRAN_SQL: một trần cắt cho thợ + Mạnh
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
        s = importlib.util.spec_from_file_location("lk", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "loi_ky_thuat.py")); lk = importlib.util.module_from_spec(s); s.loader.exec_module(lk)
        chu = lk.de_hieu(chu).replace("\ncat: ", "\nCắt phim: ")   # anh 07/11/2026: tin không lộ đường dẫn / mã nguồn
    except Exception as e: print("lọc chữ tin lỗi:", e, file=sys.stderr)
    try:
        s = importlib.util.spec_from_file_location("lg", os.path.join(os.path.dirname(os.path.abspath(__file__)), "lich-gio.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
        m.bao_tg(chu)
    except Exception as e: print("báo Telegram lỗi:", e, file=sys.stderr)
def ghi(cau):
    if THU: return print("[SQL]", cau[:200])
    q(cau)

def main():
    lam = []
    def muc1():
        # 1. bước quá hạn / im
        for l in hang("""select b.dong_id, b.buoc, b.lan, extract(epoch from now() - b.bat_dau)::int, extract(epoch from now() - coalesce(b.nhip, b.bat_dau))::int, b.han_giay,
                             p.content_id, coalesce(p.ten, ''), coalesce(b.ghi, '')
                      from etp.dong_buoc b join etp.dong_phim p on p.id = b.dong_id where b.trang_thai = 'dang' and not b.huy and p.trang_thai = 'chay'"""):
            dong, buoc, lan, tuoi, im, han, cid, ten, gc = l; tuoi, im, han, lan = int(tuoi), int(im), int(han), int(lan)
            if tuoi <= han and im <= IM_BUOC: continue
            ly = f"quá hạn {tuoi // 60} phút (hạn {han // 60})" if tuoi > han else f"im {im // 60} phút (máy chạy dòng không còn báo sống)"
            tu_fix = lan < 2
            ghi(f"""update etp.dong_buoc set huy = true, trang_thai = 'loi', ket_thuc = now(), ghi = $G$Mạnh: {ly} — {gc[:200].replace('$G$', '')}$G$, fix = {str(tu_fix).lower()}
                    where dong_id = {dong} and buoc = '{buoc}' and trang_thai = 'dang';
                    update etp.dong_phim set trang_thai = 'loi', ly_do = $G${buoc}: Mạnh — {ly}$G$, xong_luc = now(){', bao_luc = now()' if tu_fix else ''} where id = {dong} and trang_thai = 'chay'""")
            lam.append(f"dòng #{dong} · {TEN.get(buoc, buoc)} {ly} → {'tự FIX lần ' + str(lan + 1) if tu_fix else 'đã FIX ' + str(lan - 1) + ' lần — Mạnh tự thử lại (hạ tầng 10 phút · khác 2 giờ)'}")
            bao(f"🚧 <b>Mạnh</b> · phim <b>{ten or cid}</b> (#{cid}) · bước <b>{TEN.get(buoc, buoc)}</b> {ly}\n"
                + ("→ đã huỷ tiến trình, tự chạy lại bước (FIX tự động)" if tu_fix else "→ đã huỷ; FIX nhanh đã dùng — Mạnh tự thử lại (hạ tầng 10 phút · khác 2 giờ), không để dòng chết"))
    def muc2():
        # 2. máy chạy dòng im
        for l in hang(f"""select m.may, extract(epoch from now() - m.nhip)::int, coalesce(extract(epoch from now() - m.bao_luc)::int, 999999) from etp.dong_may m
                      where m.nhip < now() - interval '{IM_MAY} seconds' and exists (select 1 from etp.dong_phim where trang_thai = 'chay')"""):
            may, im, da = l
            if int(da) < 1800: continue
            ghi(f"update etp.dong_may set bao_luc = now() where may = '{may}'")
            lam.append(f"máy chạy dòng {may} im {int(im) // 60} phút")
            bao(f"🚨 <b>Mạnh</b> · máy chạy dòng phim <b>{may}</b> im {int(im) // 60} phút mà còn dòng đang chạy — máy tự bật lại; bước đang dở sẽ bị huỷ + FIX khi quá {IM_BUOC // 60} phút")
    def muc3():
        # 3. dòng vừa kết thúc
        tin = []
        for l in hang("""select id, content_id, coalesce(ten, ''), trang_thai, coalesce(ly_do, ''), coalesce(camp_id::text, '') from etp.dong_phim
                      where trang_thai in ('xong', 'dung', 'loi') and bao_luc is null and xong_luc > now() - interval '1 day'"""):
            dong, cid, ten, tt, ly, camp = l
            ghi(f"update etp.dong_phim set bao_luc = now() where id = {dong}")
            dau = {"xong": "✅ lên camp xong", "dung": "⛔ dừng (policy / luật)", "loi": "❌ lỗi kỹ thuật"}[tt]
            lam.append(f"dòng #{dong} {tt}")
            tin.append((f"{dau} · phim <b>{ten or cid}</b> (#{cid}){f' · camp #{camp}' if camp else ''}", ly))
        # nhiều dòng một lượt (dồn sau khi Mạnh chết / một lần box3 ngắt) → MỘT tin, mỗi dòng một hàng; lỗi kỹ thuật ghi kèm "Mạnh tự thử lại"
        if len(tin) <= 3:
            for t, ly in tin: bao(f"{t}\n{ly[:600]}")
        elif tin: bao(f"📋 <b>Mạnh</b> · {len(tin)} dòng phim vừa kết thúc (lỗi kỹ thuật Mạnh tự thử lại: hạ tầng 10 phút, khác 2 giờ)\n" + "\n".join(f"• {t} — {ly[:110]}" for t, ly in tin)[:3800])
    def muc4():
        # 4. việc cắt lô dòng phim kẹt
        # trần chung với tho.py (07/11/2026): 75 phút cố định thấp hơn trần cắt 8 bản (79 phút) / LT (100 phút) → xếp lại cả việc đang cắt thật, hai máy cắt trùng
        r = q(f"update etp.viec set trang_thai = 'cho', may = null, loi = coalesce(loi, '') || ' | Mạnh: kẹt quá trần cắt + 60 phút, xếp lại' where lo like 'dp%' and trang_thai = 'dang' and bat_dau < now() - interval '1 minute' * ({THO.TRAN_SQL} + 60) returning id") if not THU else ""
        if r: lam.append(f"xếp lại việc cắt kẹt: {r.replace(chr(10), ' ')}")
    def muc5():
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
    def muc6():
        # 6. KHÔNG DỪNG HẲN (anh 04/11/2026 "Lý do phải luôn đi kèm Bước giải quyết !! Ko dừng hẳn như vậy" — dòng #5 đứng 'lỗi' từ hôm qua):
        #    dòng LỖI KỸ THUẬT (không phải dừng vì luật) → thử lại bước lỗi, trong 3 ngày
        #    LỖI HẠ TẦNG (ssh / kênh mux tới box3, máy chạy dòng im vì nạp lại mã / khởi động lại) → 10 phút, tối đa 10 lần (05/11/2026: 14 dòng đứng
        #    'lỗi' 3 giờ sau một lần box3 từ chối ssh 22:04–22:08); lỗi khác giữ 2 giờ, tối đa 6 lần
        HA_TANG = r"ssh:|mux_client|Session open refused|Operation timed out|Connection (closed|reset|refused|timed out)|Broken pipe|kex_exchange|im [0-9]+ phút \(máy chạy dòng"
        r = q(f"""update etp.dong_buoc b set fix = true from etp.dong_phim d where d.id = b.dong_id and d.trang_thai = 'loi' and b.trang_thai = 'loi' and not b.fix
                  and d.tao_luc > now() - interval '3 days'
                  and case when coalesce(b.ghi, '') ~ '{HA_TANG}' then b.lan < 10 and b.ket_thuc < now() - interval '10 minutes'
                           else b.lan < 6 and b.ket_thuc < now() - interval '2 hours' end
                  returning b.dong_id, b.buoc, b.lan""") if not THU else ""
        if r: lam.append(f"thử lại lỗi (hạ tầng 10 phút · khác 2 giờ): {r.replace(chr(10), ' · ').replace(chr(9), ' ')}")
    def muc7():
        # 7. LỖI MÃ Ở MÁY LUẬT / LÊN CAMP (05/11/2026: 3 lượt nhân bản ROAS chết NameError 00:09, chỉ hiện "⚠ lỗi" trong bảng Telegram, 9 giờ không ai sửa —
        #    Mạnh chỉ canh dòng phim). etp.nhat_ky ok = false mà lỗi là lỗi MÃ (nhan-ban.loi_may ghi "LỖI MÃ …", hoặc chữ lỗi Python quen) → báo ngay,
        #    mỗi kiểu lỗi một lần / 6 giờ. Máy gọi (worker) tự thử lại ở nhịp sau (r.may; nhân bản team nbLoi 6 giờ), bản sửa lên là tự chạy lại.
        MA = r"LỖI MÃ|is not defined|has no attribute|unexpected keyword argument|positional argument|not subscriptable|unsupported operand|referenced before assignment|Traceback"
        for l in hang(f"""select viec, regexp_replace(left(loi, 160), '[0-9]{{3,}}', '#', 'g'), count(*), string_agg(distinct camp_id::text, ' · '),
                              to_char(min(luc) at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), max(left(loi, 240))
                       from etp.nhat_ky where ok is false and luc > now() - interval '1 day' and coalesce(loi, '') ~ '{MA}' group by 1, 2"""):
            viec, kieu, n, camps, tu, loi = l
            dau = f"/tmp/manh-ma-{hashlib.md5((viec + kieu).encode()).hexdigest()[:10]}"
            if os.path.exists(dau) and os.path.getmtime(dau) > __import__("time").time() - 6 * 3600: continue
            if not THU: open(dau, "w").write(kieu)
            lam.append(f"lỗi mã {viec} ×{n}")
            bao(f"🐞 <b>Mạnh</b> · LỖI MÃ ở máy <b>{viec}</b> — {n} lượt từ {tu} (camp {camps[:120]})\n<code>{loi[:240]}</code>\n"
                "→ máy gọi tự thử lại ở nhịp sau (nhân bản tài khoản team: sau 6 giờ); cần sửa mã (lỗi không tự hết)")
    # MỖI MỤC CHẠY RIÊNG (05/11/2026: một hàng lạ ở mục 3 làm Mạnh chết cả lượt suốt 24 giờ — mục 1/4/5/6 không chạy, không ai biết):
    # mục hỏng → ghi lại, báo Telegram (một lần mỗi giờ mỗi mục), các mục khác vẫn chạy; cuối lượt trả mã lỗi để systemd vẫn thấy
    hong = []
    for ten, f in (("mục 1", muc1), ("mục 2", muc2), ("mục 3", muc3), ("mục 4", muc4), ("mục 5", muc5), ("mục 6", muc6), ("mục 7", muc7)):
        try: f()
        except Exception as e:
            import traceback; traceback.print_exc(); hong.append(ten)
            dau = f"/tmp/manh-hong-{ten[-1]}"
            if not THU and (not os.path.exists(dau) or os.path.getmtime(dau) < __import__("time").time() - 3600):
                open(dau, "w").write(str(e)[:300])
                bao(f"🛠 <b>Mạnh</b> · {ten} hỏng: <code>{type(e).__name__}: {str(e)[:200]}</code> — các mục khác vẫn chạy; sửa apps/etp/manh.py")
    lam += [f"{x} HỎNG" for x in hong]
    print("Mạnh:", " · ".join(lam) if lam else "không có gì kẹt")
    if hong: sys.exit(1)

if __name__ == "__main__": main()
