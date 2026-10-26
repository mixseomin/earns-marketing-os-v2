#!/usr/bin/env python3
"""LỊCH GIỜ BẬT / TẮT CAMP THEO THỂ LOẠI (anh 25/10/2026: "Chốt kiểu này" — bảng giờ on-off theo khung ở etp.on.tc › Camp › Lịch giờ).
Ngày ngân sách của hai tài khoản reset 07:00 giờ VN (00:00 UTC) → Meta xả tiền ngay giờ đó; 13h–19h cũng lỗ ở mọi thể loại trừ vô danh (số 21–24/10).
Mỗi lượt (dong-bo.py gọi đầu lượt, 10 phút/lần):
  · camp ĐANG CHẠY mà thể loại của nó đang (hoặc trong TRUOC_PHUT phút tới sẽ) ở khung TẮT → tạm dừng (một lệnh bulk), ghi etp.lich_tat
  · camp trong etp.lich_tat mà thể loại đã sang khung BẬT (và không sắp TẮT) → bật lại, xoá khỏi etp.lich_tat
  · CHỈ bật lại camp do chính lịch tạm dừng — camp tắt vì lý do khác (anh, luật, Meta) không bao giờ bị bật. Dừng khẩn (etp.cau_hinh.dung_khan) → không bật gì.
  · công tắc tổng etp.cau_hinh['lich_gio'] = false → bật lại mọi camp đang tạm dừng vì lịch, không tắt thêm.
Ghi một dòng tóm tắt mỗi lượt có việc vào etp.nhat_ky (viec lich_tat / lich_bat).
Chạy tay (box3, đã nạp .env.production):  python3 lich-gio.py [--thu] [--luc HH:MM] | --tu-kiem
  --thu: chỉ in sẽ làm gì · --luc (chỉ đi cùng --thu): mô phỏng giờ VN đó trên camp hiện tại — liệt kê số camp sẽ tạm dừng / bật lại theo thể loại"""
import datetime as dt, json, os, subprocess, sys, urllib.request
TRUOC_PHUT = 15   # tắt sớm tối đa 15 phút trước khung TẮT (lượt chạy 10 phút/lần) — kịp chặn cú xả lúc 07:00
THU = "--thu" in sys.argv
LUC = sys.argv[sys.argv.index("--luc") + 1] if "--luc" in sys.argv else None
if LUC and not THU: raise SystemExit("--luc chỉ dùng cùng --thu (mô phỏng, không gửi lệnh)")
def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
def dieu_khien(ids, trang_thai):
    """Ethopex control bulk (cùng API nút Tắt / Bật) — trả danh sách id đã gửi thành công"""
    xong = []
    for i in range(0, len(ids), 50):
        lo = ids[i:i + 50]
        r = urllib.request.Request("https://api.ethopex.dev/api/v1/campaigns/control/batch/bulk", data=json.dumps([{"entity_type": "campaign", "entity_ids": lo, "status": trang_thai}]).encode(),
                                   method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "etp-lich-gio"})
        try:
            d = json.load(urllib.request.urlopen(r, timeout=60)); d0 = (d.get("data") or [{}])[0] if isinstance(d, dict) else {}
            if d0.get("ok") is False: print(f"Ethopex từ chối {trang_thai} {lo[:5]}…: {d0.get('error')}", file=sys.stderr); continue
            xong += lo
        except Exception as e: print(f"lỗi gọi {trang_thai}: {e}", file=sys.stderr)
    return xong

CHU_KY = 10   # phút giữa hai lượt (etp-dong-bo.timer) — để đoán lượt KẾ sẽ làm gì mà báo trước

def bao_tg(chu, nut=None):
    """Báo chủ đề 📂 Ethopex (anh 26/10/2026: "lúc chuẩn bị tắt/bật hàng loạt phải báo qua tele") — khoá bot đọc server-side ở /root/.secrets/mine-tg.env,
    mã chủ đề ở /var/lib/cty/tg-ethopex.json (cùng chủ đề máy luật cty dùng). Lỗi gửi chỉ in ra stderr, không chặn việc tắt / bật."""
    try:
        env = dict(l.strip().split("=", 1) for l in open("/root/.secrets/mine-tg.env") if "=" in l and not l.lstrip().startswith("#"))
        topic = json.load(open("/var/lib/cty/tg-ethopex.json")).get("topic")
        body = {"chat_id": env["TG_CHAT"].strip('"'), "text": chu, "parse_mode": "HTML", "link_preview_options": {"is_disabled": True}, **({"message_thread_id": topic} if topic else {}), **({"reply_markup": nut} if nut else {})}
        j = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{env['TG_BOT_TOKEN'].strip(chr(34))}/sendMessage", data=json.dumps(body).encode(),
                                                      headers={"content-type": "application/json"}), timeout=20))
        # SỔ TIN ĐÃ GỬI (anh 26/10/2026 "sửa luôn message vừa xong" — trước đây không giữ message_id nên không sửa được tin cũ): 200 tin gần nhất, sửa bằng editMessageText
        mid = (j.get("result") or {}).get("message_id")
        if mid:
            f = "/var/lib/cty/etp-tin.json"
            try: so = json.load(open(f))
            except Exception: so = []
            json.dump((so + [{"id": mid, "luc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "dau": chu[:60]}])[-200:], open(f, "w"), ensure_ascii=False)
        return mid
    except Exception as e: print(f"báo Telegram lỗi: {e}", file=sys.stderr)

def sua_tg(mid, chu):
    """sửa tin đã gửi (editMessageText) — mid lấy từ /var/lib/cty/etp-tin.json"""
    env = dict(l.strip().split("=", 1) for l in open("/root/.secrets/mine-tg.env") if "=" in l and not l.lstrip().startswith("#"))
    body = {"chat_id": env["TG_CHAT"].strip('"'), "message_id": mid, "text": chu, "parse_mode": "HTML", "link_preview_options": {"is_disabled": True}}
    return json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{env['TG_BOT_TOKEN'].strip(chr(34))}/editMessageText", data=json.dumps(body).encode(),
                                                                   headers={"content-type": "application/json"}), timeout=20))

_KHUNG = {}
def khung(t):
    """khung giờ VN của thời điểm t — MỘT nguồn: hàm SQL etp.khung_vn (sổ etp.khung_gio, migration 0333), cùng hàm trang etp.on.tc dùng"""
    if t.hour not in _KHUNG: _KHUNG[t.hour] = q(f"select etp.khung_vn({t.hour})")
    return _KHUNG[t.hour]

def main():
    vn = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)
    if LUC: vn = vn.replace(hour=int(LUC[:2]), minute=int(LUC[3:5]))
    k_nay, k_toi = khung(vn), khung(vn + dt.timedelta(minutes=TRUOC_PHUT))
    ch = {l.split("|", 1)[0]: json.loads(l.split("|", 1)[1]) for l in q("select khoa, gia_tri::text from etp.cau_hinh where khoa in ('lich_gio', 'dung_khan')").splitlines() if "|" in l}
    bat_lich, dung_khan = ch.get("lich_gio", False) is True, ch.get("dung_khan") is True
    lich = {}
    for l in q("select the_loai, khung, bat from etp.lich_gio").splitlines():
        t, k, b = l.split("|"); lich[(t, k)] = b == "t"
    on = lambda tl, k: lich.get((tl, k), lich.get(("_khac", k), True))   # thể loại lạ → theo '_khac'; không có dòng → bật
    # camp đang chạy + thể loại (kho etp, đồng bộ 10 phút)
    chay = [(int(c), t or "_khac") for c, t in (l.split("|") for l in q("""select c.camp_id, coalesce(p.the_loai, '') from etp.camp c left join etp.phim p using (content_id)
        where c.trang_thai = 'ACTIVE' and c.ten not like '% duplicate by %' and c.ten not like '★%'""").splitlines() if "|" in l)]   # camp ROAS miễn lịch giờ (cong.camp_roas)
    dang_tat = {int(c): t or "_khac" for c, t in (l.split("|") for l in q("""select l.camp_id, coalesce(p.the_loai, l.the_loai, '') from etp.lich_tat l
        left join etp.camp c using (camp_id) left join etp.phim p on p.content_id = c.content_id""").splitlines() if "|" in l)}
    # camp trong lich_tat đã bị lưu trữ / mất khỏi kho → bỏ khỏi sổ (không bật)
    # camp mới do nhan-ban vừa tạm dừng theo lịch (lich_ap) chưa vào kho trong 30 phút đầu — không bỏ khỏi sổ, kẻo 20h không bật lại
    q("delete from etp.lich_tat l where l.luc < now() - interval '30 minutes' and not exists (select 1 from etp.camp c where c.camp_id = l.camp_id and c.trang_thai <> 'ARCHIVED')")
    # camp trong sổ mà đang chạy lại (vd máy thay creative bị Meta từ chối xong bật lại) → tạm dừng lại luôn, không để chạy suốt khung TẮT
    # camp vừa tạm dừng mà kho chưa thấy Ethopex đổi gì sau lúc đó (cap_nhat_etp ≤ lúc ghi lich_tat) vẫn hiện ACTIVE trong kho — KHÔNG gửi lại lệnh + báo lại mỗi lượt;
    # chỉ tạm dừng lại camp trong sổ khi Ethopex có cập nhật MỚI hơn lúc tạm dừng (vd máy thay creative bật lại)
    cu_kho = {int(c) for c in q("""select l.camp_id from etp.lich_tat l join etp.camp c using (camp_id)
        where c.trang_thai = 'ACTIVE' and (c.cap_nhat_etp is null or c.cap_nhat_etp <= l.luc)""").split() if c.isdigit()}
    chay = [(c, t) for c, t in chay if c not in cu_kho]
    can_tat = [c for c, t in chay if bat_lich and (not on(t, k_nay) or not on(t, k_toi))]
    # TẮT QUÁ 24 GIỜ KHÔNG BAO GIỜ BẬT LẠI (anh 26/10/2026): camp nằm sổ lịch quá 24 giờ → bỏ khỏi sổ, không bật
    qua24 = {int(c) for c in q("delete from etp.lich_tat where luc < now() - interval '24 hours' returning camp_id").split() if c.isdigit()}
    if qua24: ghi("lich_bo24", sorted(qua24), "lịch giờ: tạm dừng quá 24 giờ → bỏ khỏi sổ, không bật lại (luật 24 giờ)")
    dang_tat = {c: t for c, t in dang_tat.items() if c not in qua24}
    can_bat = [c for c, t in dang_tat.items() if (not bat_lich or (on(t, k_nay) and on(t, k_toi))) and not dung_khan]
    # BÁO TRƯỚC: lượt này không đổi gì nhưng lượt KẾ (sau CHU_KY phút) sẽ tạm dừng / bật lại hàng loạt → báo một lần cho mỗi lần chuyển khung
    vn2 = vn + dt.timedelta(minutes=CHU_KY); k2_nay, k2_toi = khung(vn2), khung(vn2 + dt.timedelta(minutes=TRUOC_PHUT))
    tat2 = [c for c, t in chay if c not in can_tat and bat_lich and (not on(t, k2_nay) or not on(t, k2_toi))]
    bat2 = [c for c, t in dang_tat.items() if c not in can_bat and bat_lich and on(t, k2_nay) and on(t, k2_toi) and not dung_khan]
    print(f"giờ VN {vn:%H:%M} · khung {k_nay}{' → ' + k_toi if k_toi != k_nay else ''} · lịch {'BẬT' if bat_lich else 'TẮT'} · sẽ tạm dừng {len(can_tat)} · sẽ bật lại {len(can_bat)} · đang tạm dừng {len(dang_tat)}")
    if not THU:
        try: bao_chi_gio(vn)
        except Exception as e: print(f"báo chi theo giờ lỗi: {e}", file=sys.stderr)
    if THU:
        from collections import Counter
        if can_tat: print("  sẽ tạm dừng theo thể loại:", dict(Counter(dict(chay)[c] for c in can_tat)))
        print(f"  lượt kế ({vn2:%H:%M}): sẽ tạm dừng {len(tat2)} · sẽ bật lại {len(bat2)}" + (" → lượt này BÁO TRƯỚC lên Telegram" if (tat2 or bat2) and not (can_tat or can_bat) else ""))
        bo_qua = Counter(t for c, t in chay if c not in can_tat)
        print("  vẫn chạy theo thể loại:", dict(bo_qua))
        return
    tl_cua = dict(chay)
    if (tat2 or bat2) and not (can_tat or can_bat):
        khoa = f"{vn2:%Y-%m-%d} {k2_toi}"
        if q("select gia_tri #>> '{}' from etp.cau_hinh where khoa = 'lich_bao_truoc'") != khoa:
            q(f"insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('lich_bao_truoc', to_jsonb('{khoa}'::text), 'lần chuyển khung đã báo trước trên Telegram', 'lich-gio.py') "
              f"on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
            moc = (vn + dt.timedelta(minutes=CHU_KY)).strftime("%H:%M")
            _tat_tl = {t for t in set(tl_cua.values()) | {l.split("|")[0] for l in q("select the_loai from etp.lich_gio").splitlines()} if not on(t, k2_toi)}
            try: rp = bao_phien(vn, k_nay, k2_toi, _tat_tl)
            except Exception as e: rp = ""; print(f"report phiên lỗi: {e}", file=sys.stderr)
            bao_tg(rp + f"⏰ <b>LỊCH GIỜ — SẮP {'TẠM DỪNG' if tat2 else 'BẬT LẠI'} HÀNG LOẠT</b> khoảng {moc}\n"
                   + (f"⏸ sẽ tạm dừng <b>{len(tat2)}</b> camp (khung {k2_toi} TẮT): {tom_tl([tl_cua.get(c, '_khac') for c in tat2])}\n" if tat2 else "")
                   + (f"▶️ sẽ bật lại <b>{len(bat2)}</b> camp đang tạm dừng vì lịch (khung {k2_nay} BẬT)\n" if bat2 else "")
                   + "<i>Muốn hoãn: tắt công tắc Lịch giờ ở etp.on.tc › Camp › Lịch giờ trước giờ đó.</i>")
    if can_tat:
        ok = dieu_khien(can_tat, "paused")
        if len(ok) < len(can_tat): bao_tg(f"⚠️ <b>LỊCH GIỜ</b>: Ethopex không nhận lệnh tạm dừng {len(can_tat) - len(ok)}/{len(can_tat)} camp — lượt sau thử lại")
        if ok:
            j = json.dumps([{"camp_id": c, "the_loai": tl_cua.get(c), "khung": k_toi if on(tl_cua.get(c, "_khac"), k_nay) else k_nay} for c in ok])
            q(f"insert into etp.lich_tat (camp_id, the_loai, khung) select camp_id, the_loai, khung from jsonb_to_recordset($J${j}$J$::jsonb) as x(camp_id int, the_loai text, khung text) on conflict do nothing")
            bao_tg(f"⏸ <b>LỊCH GIỜ — ĐÃ TẠM DỪNG {len(ok)}/{len(can_tat)} camp</b> (khung {k_toi if k_toi != k_nay else k_nay} TẮT) · {tom_tl([tl_cua.get(c, '_khac') for c in ok])}\n<i>Máy tự bật lại khi tới khung BẬT; chỉ camp do lịch tạm dừng.</i>")
            ghi("lich_tat", ok, f"lịch giờ: khung {k_toi if k_toi != k_nay else k_nay} TẮT cho thể loại " + ", ".join(sorted({tl_cua.get(c, '_khac') for c in ok})))
    if can_bat:
        ok = dieu_khien(can_bat, "active")
        if len(ok) < len(can_bat): bao_tg(f"⚠️ <b>LỊCH GIỜ</b>: Ethopex không nhận lệnh bật lại {len(can_bat) - len(ok)}/{len(can_bat)} camp — lượt sau thử lại")
        if ok:
            q(f"delete from etp.lich_tat where camp_id in ({','.join(map(str, ok))})")
            bao_tg(f"▶️ <b>LỊCH GIỜ — ĐÃ BẬT LẠI {len(ok)}/{len(can_bat)} camp</b> (khung {k_nay} BẬT)" + ("" if bat_lich else " — công tắc lịch giờ tắt, bật lại hết"))
            ghi("lich_bat", ok, f"lịch giờ: khung {k_nay} BẬT" + ("" if bat_lich else " (công tắc lịch giờ tắt — bật lại hết)"))

NGUONG_HUT = 0.4               # trước 13h mà đã chi ≥ 40% tổng ngân sách ngày → cảnh báo đang hút nhanh

NUT_REPORT = {"inline_keyboard": [[{"text": "📊 Report", "callback_data": "eb:report"}]]}   # bấm → cty ethopex.mjs xuNutBang → lich-gio.py --bao-cao

def lap_bao_cao(vn, gio_cuoi=None):
    """BẢNG BÁO CÁO GIỜ (dùng chung cho tin mỗi giờ và nút 📊 Report): số từng giờ (6 giờ gần nhất tới gio_cuoi — giờ UTC; None = mọi giờ đã về)
    + luỹ kế ngày Ethopex (07h–07h VN = ngày UTC): chi · thu · lãi · ROI · % ngân sách cao nhất trong ngày · camp ROAS ★ · camp đã tiêu hết ngân sách.
    → (chữ HTML, giờ UTC cuối cùng có số) hoặc (None, None) khi chưa có số giờ nào."""
    ngay = (vn - dt.timedelta(hours=7)).strftime("%Y-%m-%d") if gio_cuoi is None else gio_cuoi[0]
    gioi = "" if gio_cuoi is None else f" and gio <= {gio_cuoi[1]}"
    gio = [l.split("|") for l in q(f"select gio, sum(chi), sum(thu) from etp.so_gio where ngay = '{ngay}'{gioi} group by 1 order by 1").splitlines() if "|" in l]
    if not gio: return None, None
    roi = lambda c, t: f"{(t - c) / c * 100:+.0f}%" if c >= 0.3 else "—"
    ns = float(q(f"select coalesce(sum(coalesce(ns_max, ngan_sach)) filter (where bat or chi > 0), 0) from etp.so_ngay where ngay = '{ngay}'") or 0)   # ngân sách cao nhất trong ngày (0340)
    c_ng, t_ng = [float(x) for x in q(f"select coalesce(sum(chi), 0), coalesce(sum(thu), 0) from etp.so_ngay where ngay = '{ngay}'").split("|")]
    c_r, t_r, n_r = [float(x) for x in q(f"""select coalesce(sum(s.chi), 0), coalesce(sum(s.thu), 0), count(*) filter (where c.trang_thai = 'ACTIVE') from etp.camp c
        left join etp.so_ngay s on s.camp_id = c.camp_id and s.ngay = '{ngay}' where c.ten like '% duplicate by %' or c.ten like '★%'""").split("|")]
    het = [l.split("|") for l in q(f"""select s.camp_id, s.chi, c.ngan_sach, s.thu from etp.so_ngay s join etp.camp_dang_chay c using (camp_id)
        where s.ngay = '{ngay}' and c.ngan_sach > 0 and s.chi >= c.ngan_sach order by s.chi desc""").splitlines() if "|" in l]
    moi_nhat = q("select to_char(max(xong) at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') from etp.dong_bo where xong is not null") or "?"
    ty = c_ng / ns if ns else 0
    # BẢNG chữ đều cột (anh 26/10/2026: "những kiểu này sau phải luôn dùng bảng") — ≤ 30 ký tự / dòng cho màn điện thoại; dam = đậm, nhat = nhạt
    b, dam, nhat = [f"{'Giờ':<6}{'Chi':>7}{'Thu':>7}{'ROI':>7}"], {0}, set()
    b += [f"{(int(h) + 7) % 24:02d}h{'':<3}{float(c):>7.0f}{float(t):>7.0f}{roi(float(c), float(t)):>7}" for h, c, t in gio]   # đủ mọi giờ từ 07h đầu ngày (anh 26/10/2026: "report này phải luôn từ 7h sáng đầu ngày")
    b.append("-" * 27); dam.add(len(b)); b.append(f"{'Từ 07h':<6}{c_ng:>7.0f}{t_ng:>7.0f}{roi(c_ng, t_ng):>7}")
    nhat.add(len(b)); b.append(f"Lãi {t_ng - c_ng:+.0f}$ · NS ${ns:.0f} · chi {ty * 100:.0f}%")
    if n_r or c_r:
        b.append(f"{'★ROAS':<6}{c_r:>7.0f}{t_r:>7.0f}{roi(c_r, t_r):>7}"); nhat.add(len(b)); b.append(f"{int(n_r)} camp ROAS đang bật")
    if het:
        b.append(""); dam |= {len(b), len(b) + 1}
        b += [f"HẾT NGÂN SÁCH: {len(het)} camp", f"{'Camp':<8}{'Chi/NS':>11}{'ROI':>8}"] + [f"#{c:<7}{f'{float(x):.2f}/{float(n):g}':>11}{roi(float(x), float(t)):>8}" for c, x, n, t in het[:8]] + (["…"] if len(het) > 8 else [])
    canh = (f"\n⚠️ <b>Đang hút nhanh</b>: chưa tới 13h đã chi {ty * 100:.0f}% ngân sách ngày — còn {(1 - ty) * 100:.0f}% cho khung tối 20h–06h" if 7 <= vn.hour < 13 and ty >= NGUONG_HUT else "")
    return bang(b, dam, nhat) + f"<i>ngày {ngay[8:10]}/{ngay[5:7]} (07h–07h) · số kho etp tới {moi_nhat}</i>" + canh, int(gio[-1][0])

def bao_chi_gio(vn):
    """BÁO CÁO GIỜ (anh 26/10/2026: "Trên tele, hàng giờ phải gửi báo cáo report định kỳ" — trước đó chỉ báo 09h–13h): lượt đầu tiên của MỖI giờ (24/24)
    báo lên 📂 Ethopex số tới hết giờ VN vừa qua, kèm nút 📊 Report (bấm = báo cáo mới ngay). Chỉ báo, không đổi camp nào."""
    p = vn.replace(minute=0, second=0, microsecond=0) - dt.timedelta(hours=1)   # giờ VN vừa qua
    khoa = f"{vn:%Y-%m-%d %H}"
    if q("select gia_tri #>> '{}' from etp.cau_hinh where khoa = 'chi_gio_bao'") == khoa: return
    pu = p - dt.timedelta(hours=7)
    chu, cuoi = lap_bao_cao(vn, (pu.strftime("%Y-%m-%d"), pu.hour))
    if chu is None or cuoi != pu.hour: return   # số giờ vừa qua chưa về — lượt sau thử lại
    bao_tg(f"🕐 <b>BÁO CÁO GIỜ — {p.hour:02d}h–{(p.hour + 1) % 24:02d}h</b>\n" + chu, NUT_REPORT)
    q(f"insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('chi_gio_bao', to_jsonb('{khoa}'::text), 'giờ đã báo chi theo giờ trên Telegram', 'lich-gio.py') "
      f"on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")

def bao_cao_ngay_bay_gio():
    """nút 📊 Report: báo cáo tới giờ mới nhất đã có số (giờ đang chạy dở cũng tính)"""
    vn = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)
    chu, _ = lap_bao_cao(vn)
    return bao_tg(f"📊 <b>REPORT {vn:%H:%M} {vn:%d/%m}</b> (anh bấm)\n" + (chu or "<i>chưa có số giờ nào của ngày này</i>"), NUT_REPORT)

def bang(dong, dam=(), nhat=()):
    """BẢNG Telegram chữ đều cột CÓ ĐẬM / NHẠT (anh 26/10/2026: "những kiểu này phải luôn dùng bảng" · "còn có format đậm nhạt ko thấy mày dùng"): <pre> không chứa được
    định dạng khác, nên mỗi dòng là một <code> riêng — dòng trong `dam` bọc <b> (tiêu đề cột, dòng tổng), dòng trong `nhat` bọc <i> (dòng so sánh / phụ)"""
    e = lambda x: x.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return "\n".join("" if not d else f"<b><code>{e(d)}</code></b>" if i in dam else f"<i><code>{e(d)}</code></i>" if i in nhat else f"<code>{e(d)}</code>" for i, d in enumerate(dong)) + "\n"

def _so_nhom(gio, tat_tl, lui=0):
    """chi / thu hai nhóm (sẽ tạm dừng / vẫn chạy) trong các giờ VN `gio` (lùi `lui` ngày) — etp.so_gio lưu giờ UTC"""
    cap = ",".join(f"('{(g - dt.timedelta(hours=7 + 24 * lui)):%Y-%m-%d}'::date, {(g - dt.timedelta(hours=7)).hour})" for g in gio)
    r = {"tat": [0.0, 0.0], "chay": [0.0, 0.0]}
    for l in q(f"select coalesce(p.the_loai, '_khac'), sum(s.chi), sum(s.thu) from etp.so_gio s left join etp.phim p using (content_id) where (s.ngay, s.gio) in ({cap}) group by 1").splitlines():
        t, c, th = l.split("|"); a = r["tat" if t in tat_tl else "chay"]; a[0] += float(c); a[1] += float(th)
    r["tong"] = [r["tat"][0] + r["chay"][0], r["tat"][1] + r["chay"][1]]
    return r

def _dong(ten, a, chi=True):   # một dòng bảng chữ đều cột (≤ 30 ký tự — vừa màn điện thoại)
    roi = f"{(a[1] - a[0]) / a[0] * 100:+.0f}%" if a[0] >= 0.3 else "—"
    return f"{ten:<9}{(f'{a[0]:.0f}' if chi else ''):>6}{a[1] - a[0]:>+7.0f}{roi:>7}"

def bao_phien(vn, k_cu, k_toi, tat_tl):
    """REPORT kèm tin báo trước, dạng BẢNG (anh 26/10/2026: "khi thông báo việc tắt cho phiên tiếp, thì có thêm report cho phiên vừa xong với các camp sẽ tắt và cả
    camp đang chạy" · "thêm report về phiên tiếp theo ngày hôm qua nữa" · "trình bày kiểu bảng cho dễ đọc"): (1) phiên vừa xong — giờ ĐÃ TRỌN của khung k_cu, mỗi nhóm
    kèm dòng cùng giờ hôm qua; (2) phiên sắp tới k_toi — trọn khung đó của hôm qua. Hai nhóm: thể loại SẼ TẠM DỪNG / VẪN CHẠY. Số $ làm tròn."""
    gt = int(q(f"select gio_tu from etp.khung_gio where khung = '{k_cu}'") or vn.hour)
    bd = vn.replace(minute=0, second=0, microsecond=0) - dt.timedelta(hours=(vn.hour - gt) % 24)
    gio = [bd + dt.timedelta(hours=i) for i in range(int((vn - bd).total_seconds() // 3600))]   # chỉ giờ ĐÃ TRỌN
    dong = [f"{'':<9}{'Chi':>6}{'Lãi':>7}{'ROI':>7}"]; dam, nhat = {0}, set()
    if gio:
        nay, qua = _so_nhom(gio, tat_tl), _so_nhom(gio, tat_tl, 1)
        dong = [f"PHIÊN VỪA XONG {gio[0]:%H}–{gio[-1] + dt.timedelta(hours=1):%H}h"] + dong; dam = {0, 1, 2}
        for k, ten in (("tong", "Tổng"), ("tat", "Tạm dừng"), ("chay", "Vẫn chạy")): dong += [_dong(ten, nay[k]), _dong(" hôm qua", qua[k], False)]; nhat.add(len(dong) - 1)
    t2 = q(f"select gio_tu, so_gio from etp.khung_gio where khung = '{k_toi}'")
    if t2:
        gt2, sg = [int(x) for x in t2.split("|")]
        b2 = (vn - dt.timedelta(days=1)).replace(hour=gt2, minute=0, second=0, microsecond=0)
        if b2 + dt.timedelta(hours=sg) > vn - dt.timedelta(hours=1): b2 -= dt.timedelta(days=1)   # khung qua đêm chưa khép hết → lùi thêm một ngày
        r = _so_nhom([b2 + dt.timedelta(hours=i) for i in range(sg)], tat_tl)
        dong += ["", f"PHIÊN TỚI · {b2:%d/%m} {gt2:02d}–{(gt2 + sg) % 24:02d}h", _dong("Tạm dừng", r["tat"]), _dong("Vẫn chạy", r["chay"])]; dam.add(len(dong) - 3)
    return bang(dong, dam, nhat)

def tom_tl(ds):
    from collections import Counter
    return ", ".join(f"{t} {n}" for t, n in Counter(ds).most_common(6)) + (" …" if len(set(ds)) > 6 else "")

def ghi(viec, ids, luat):
    j = json.dumps([{"viec": viec, "sau": str(len(ids)), "luat": (luat + " · camp " + ", ".join(f"#{c}" for c in ids[:40]) + (" …" if len(ids) > 40 else ""))[:1000]}], ensure_ascii=False)
    q(f"insert into etp.nhat_ky (luc, viec, camp_id, sau, ok, luat, ai) select now(), viec, null, sau, true, luat, 'máy lịch giờ (anh chốt 25/10/2026)' from jsonb_to_recordset($J${j}$J$::jsonb) as x(viec text, sau text, luat text) on conflict do nothing")

def tu_kiem():
    """--tu-kiem: mọi giờ 0–23 ra đúng khung (đối chiếu mốc anh chốt), và mốc tắt sớm 15 phút đúng chỗ — đỏ thì exit 1"""
    mong = {**{h: "k20" for h in list(range(20, 24)) + list(range(0, 7))}, 7: "k07", **{h: "k08" for h in range(8, 13)}, **{h: "k13" for h in range(13, 20)}}
    sai = [(h, khung(dt.datetime(2026, 1, 1, h)), k) for h, k in mong.items() if khung(dt.datetime(2026, 1, 1, h)) != k]
    t = lambda h, m: khung(dt.datetime(2026, 1, 1, h, m) + dt.timedelta(minutes=TRUOC_PHUT))
    sai += [(f"{h}:{m:02d}+15", t(h, m), k) for h, m, k in ((6, 44, "k20"), (6, 46, "k07"), (12, 44, "k08"), (12, 46, "k13"), (19, 46, "k20"))  if t(h, m) != k]
    print("lich-gio tự kiểm:", "ĐẠT 29/29" if not sai else f"SAI {sai}"); sys.exit(1 if sai else 0)

if __name__ == "__main__":
    if "--bao-cao" in sys.argv: print(bao_cao_ngay_bay_gio())   # nút 📊 Report (cty ethopex.mjs xuNutBang)
    else: tu_kiem() if "--tu-kiem" in sys.argv else main()
