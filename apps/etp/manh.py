#!/usr/bin/env python3
"""THẰNG MẠNH — CANH DÒNG PHIM (anh 03/11/2026: "có thằng Mạnh ở chờ ở phía sau để chủ động check nếu bị stuck cái nào đó timeout ngu mà ko chịu dừng").
Chạy trên box3 (etp-manh.timer, 2 phút/lần) — máy KHÁC với máy chạy dòng (apps/etp/dong_phim.py, iMac) để máy kia chết thì vẫn có người thấy.
Mỗi lượt:
  1. bước 'dang' quá hạn (han_giay) hoặc im (nhip) quá 10 phút → đặt huy (máy chạy dòng giết tiến trình), ghi lỗi; lần đầu thì tự FIX (chạy lại bước) một lần
  2. máy chạy dòng im > 3 phút mà còn dòng chạy → báo Telegram (30 phút một lần), bước của nó coi như chết (mục 1 lo)
  3. dòng vừa kết thúc (xong / dừng vì policy / lỗi) → báo Telegram một lần
  4. việc cắt lô dòng phim (etp.viec lô dp*) 'dang' quá 75 phút → xếp lại hàng chờ (tho.py chỉ tự quét việc của chính máy nó)
Dùng: manh.py [--thu] (--thu: chỉ in, không ghi / không báo)"""
import importlib.util, json, os, subprocess, sys
THU = "--thu" in sys.argv
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-F", "\t", "-c", s], capture_output=True, text=True).stdout.strip()
TEN = {"nhan": "Nhận phim", "ws": "Trang phim", "poster": "Soát poster", "cat": "Cắt đoạn", "soat": "Soát đoạn", "creative": "Tải + chấm", "camp": "Lên camp", "chay": "Camp chạy"}
IM_BUOC, IM_MAY = 600, 180   # giây

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
        lam.append(f"dòng #{dong} · {TEN.get(buoc, buoc)} {ly} → {'tự FIX lần ' + str(lan + 1) if tu_fix else 'đã FIX ' + str(lan - 1) + ' lần — DỪNG, chờ anh bấm FIX'}")
        bao(f"🚧 <b>Mạnh</b> · phim <b>{ten or cid}</b> (#{cid}) · bước <b>{TEN.get(buoc, buoc)}</b> {ly}\n"
            + ("→ đã huỷ tiến trình, tự chạy lại bước (FIX tự động)" if tu_fix else "→ đã huỷ, FIX tự đã dùng — dòng DỪNG, bấm FIX trên etp.on.tc tab Dòng phim"))
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
    print("Mạnh:", " · ".join(lam) if lam else "không có gì kẹt")

if __name__ == "__main__": main()
