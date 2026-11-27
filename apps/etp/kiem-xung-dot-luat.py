#!/usr/bin/env python3
# tra-repo-ok: keo noi bo — luoi tu kiem xung dot luat tang giua cac noi cua nha (viec #125 phan C, anh 19/11/2026)
"""LƯỚI CHẶN TÁI PHÁT XUNG ĐỘT LUẬT TĂNG (việc #125 phần C, anh 19/11/2026) — chạy trong deploy.sh, ĐỎ thì không lên.

Ma trận 180 ô: giờ VN 07 / 09 / 13 / 18 / 22 × đã tiêu 35 / 55 / 80% ngân sách × ROI hôm nay 0 / 60 / 120% × phanh chợ bật / tắt × camp thường / ★ ROAS.
Mỗi ô hỏi "có tăng không" ở từng nơi quyết:
  máy luật   luat-ethopex.py → nhip_tang.qua_cong (cổng theo giờ, _nap_sang, cờ qua_cong) + cong.phanh_cho (_bo_phanh bỏ cả ★ ROAS khỏi danh sách tăng)
  cổng       cong.chan_cua('tang') — phần thuần của cong.kiem (dừng khẩn / phim cấm / phanh chợ; phanh không miễn ROAS, chỉ vé tay)
  worker     /opt/cty/worker/ethopex.mjs — khungCua, congNap thật; quyết định dòng vòng tăng (khungDoi === 'tang' || napDuoc(m)) giữ bằng gop-y-luat.mjs
  etp2       <repo etp2>/src/lib/etp-khung.ts — khungLuc, congTang, quaCong, luatThang (qua kiem-xung-dot-luat.mts, chạy tsx)
ĐỎ khi hai nơi trả lời khác nhau, hoặc thẻ ghi đạt mà worker không tăng và không có lý do hiện ra.

Sau ma trận, lưới TỰ PHÁ THỬ: đổi tạm ngưỡng tang_ngay.roi_duoi phía máy luật (chỉ trong bộ nhớ) → phải đỏ, nếu không đỏ = lưới mù → ĐỎ.
Chạy: python3 apps/etp/kiem-xung-dot-luat.py [--day-du]   (--day-du: thiếu worker / tsx = ĐỎ — deploy.sh dùng cờ này)
"""
import datetime as dt, json, os, subprocess, sys

GOC = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(GOC, "apps", "xuong-video", "scripts", "ethopex"))
sys.path.insert(0, os.path.join(GOC, "apps", "etp"))
import goc_etp2 as G2  # noqa: E402  — repo etp2 riêng (27/11/2026)
import nhip_tang as NT  # noqa: E402
import cong as CONG  # noqa: E402

GIO, CHI, ROI, NS = (7, 9, 13, 18, 22), (0.35, 0.55, 0.80), (0, 60, 120), 10.0
TSX = next((p for p in (os.path.join(GOC, "node_modules", ".bin", "tsx"), os.path.join(G2.GOC, "node_modules", ".bin", "tsx")) if os.path.exists(p)),
           os.path.join(GOC, "node_modules", ".bin", "tsx"))   # repo etp2 chạy lưới từ bản kéo nông .mono (không node_modules) → dùng tsx của etp2
MTS = os.path.join(GOC, "apps", "etp", "kiem-xung-dot-luat.mts")
WORKER = next((p for p in (os.environ.get("ETP_WORKER"), "/opt/cty/worker/ethopex.mjs",
                           os.path.join(os.path.dirname(GOC), "cty", "worker", "ethopex.mjs")) if p and os.path.exists(p)), None)
KD = NT.BANG_LUAT["khung_doi"]
PHANH = {"phanh": {"den_tang": "2099-01-01T00:00:00+00:00", "ly_do": "kiểm"}}


def bay(h):
    return dt.datetime(2026, 11, 20, (h - 7) % 24, 30, tzinfo=dt.timezone.utc)   # 30 phút: giữa giờ, không dính biên


def trong(h, k):
    a, b = k
    return a <= h < b if a <= b else (h >= a or h < b)


def o_mt():
    for h in GIO:
        for p in CHI:
            for r in ROI:
                for ph in (False, True):
                    for roas in (False, True):
                        chi = round(p * NS, 4)
                        yield dict(h=h, p=p, r=r, ph=ph, roas=roas, chi=chi, thu=round(chi * (1 + r / 100), 4))


def ts(o):
    """phần TS (etp2) + worker thật, qua tsx — None khi máy không có tsx"""
    if not os.path.exists(TSX): return None
    if not os.path.exists(os.path.join(G2.GOC, "src", "lib", "etp-khung.ts")): print(f"⚠ bỏ so etp2: không thấy repo etp2 ở {G2.GOC} (ETP2_GOC)"); return None
    arg = json.dumps({"o": [[x["h"] + 0.5, x["chi"], x["thu"], NS] for x in o]})
    kq = subprocess.run([TSX, MTS, arg, WORKER or ""], capture_output=True, text=True, timeout=120, cwd=GOC, env={**os.environ, "ETP2_GOC": G2.GOC, "TSX_TSCONFIG_PATH": os.path.join(G2.GOC, "tsconfig.json")})   # "@/…" của etp-khung.ts theo tsconfig repo etp2
    if kq.returncode: raise SystemExit(f"✗ kiem-xung-dot-luat.mts lỗi: {kq.stderr.strip()[-600:]}")
    return json.loads(kq.stdout.strip().splitlines()[-1])


def cham(o, T):
    """→ danh sách dòng ĐỎ"""
    do = []
    # khung theo giờ: máy luật (KD + nhip_tang.trong_sang) · etp2 khungLuc · worker khungCua — đủ 24 giờ
    for h in range(24):
        py = "giam" if trong(h, KD["giam"]) else "tang" if trong(h, KD["tang"]) else "sang" if NT.trong_sang(bay(h)) else "bang"
        if T and T["khungLuc"][h] != py: do.append(f"{h:02d}h khung: máy luật {py} ≠ etp2 khungLuc {T['khungLuc'][h]}")
        if T and T["khungCua"] and T["khungCua"][h] != py: do.append(f"{h:02d}h khung: máy luật {py} ≠ worker khungCua {T['khungCua'][h]}")
    a, b, r = NT.cong(bay(9))
    if T:
        c = T["congTangSang"]
        if (c["tu"], c["den"], c["roi"]) != (a, b, r): do.append(f"cổng sáng: nhip_tang.cong {(a, b, r)} ≠ etp2 congTang {c}")
        n = T["congNapSang"]
        if n is not None and (n["tu"], n["den"], n["roi"]) != (a, b, r): do.append(f"cổng sáng: nhip_tang.cong {(a, b, r)} ≠ worker congNap {n}")
        if T["congNapNgoai"] is not None: do.append(f"worker congNap ngoài khung sáng phải null (máy luật quyết, worker đọc cờ qua_cong): {T['congNapNgoai']}")
    for i, x in enumerate(o):
        h, b_ = x["h"], bay(x["h"])
        ten = f"{h:02d}h · tiêu {int(x['p'] * 100)}% · ROI {x['r']}% · phanh {'bật' if x['ph'] else 'tắt'} · {'★ ROAS' if x['roas'] else 'thường'}"
        tt = PHANH if x["ph"] else {}
        dat = NT.qua_cong(x["chi"], x["thu"], NS, b_)                       # máy luật: cổng theo giờ (cờ qua_cong)
        ly_phanh = CONG.phanh_cho(tt, "tang", b_) if CONG.PC_CHAN else None   # máy luật _bo_phanh — cả ★ ROAS; chan=false chỉ cảnh báo (anh 22/11/2026), y như luat-ethopex
        vao_ds = dat and not ly_phanh                                        # thẻ "Máy xếp tăng nhịp này"
        giam_nay = trong(h, KD["giam"])                                      # máy luật _GIAM_NAY → thẻ "đạt — máy tăng lúc 21:00 VN"
        cong_chan = CONG.chan_cua("tang", {"phanh_cho": tt}, ve=False)       # cổng (không vé: máy tự tăng)
        if bool(ly_phanh) != bool(cong_chan): do.append(f"{ten}: máy luật phanh={bool(ly_phanh)} ≠ cổng chặn={bool(cong_chan)}")
        if vao_ds and cong_chan: do.append(f"{ten}: máy luật xếp tăng mà cổng chặn ({cong_chan[:60]})")
        if T:
            q2 = T["quaCong"][i]
            if q2 != dat: do.append(f"{ten}: máy luật qua_cong={dat} ≠ etp2 quaCong={q2}")
            k = T["khungCua"][h] if T["khungCua"] else T["khungLuc"][h]
            w_tang = vao_ds and (k == "tang" or (k == "sang" and dat))   # worker vòng tăng: khung tăng, hoặc khung sáng + cờ qua_cong
            if w_tang and cong_chan: do.append(f"{ten}: worker tăng mà cổng chặn")
            if vao_ds and not w_tang and not giam_nay: do.append(f"{ten}: thẻ máy luật ghi đạt, worker không tăng (khung {k}), thẻ không có lý do")
            if q2 and not w_tang:
                ly2 = T["lyPhanh"] if x["ph"] else T["lyKhung"] if T["khungLuc"][h] == "giam" else None
                if not ly2: do.append(f"{ten}: etp2 ghi đạt cổng, worker không tăng (khung {k}), etp2 không có lý do")
    return do


def main():
    du = "--day-du" in sys.argv
    o = list(o_mt())
    if du and not os.path.exists(TSX): raise SystemExit(f"✗ thiếu {TSX} — không so được etp2 / worker")
    if du: G2.tep("src", "lib", "etp-khung.ts")   # --day-du: thiếu repo etp2 = ĐỎ
    if du and not WORKER: raise SystemExit("✗ không thấy worker ethopex.mjs (/opt/cty/worker, ETP_WORKER) — không so được worker")
    T = ts(o)
    do = cham(o, T)
    for d in do[:40]: print("ĐỎ", d)
    noi = "máy luật · cổng" + (" · etp2" if T else "") + (" · worker" if T and T["khungCua"] else "")
    if do: raise SystemExit(f"✗ kiem-xung-dot-luat: {len(do)} ô lệch ({noi}) — sửa ở sổ luật / hàm chung, không vá từng nơi")
    # PHÁ THỬ: đổi tạm ngưỡng máy luật (tiêu < 50% cần ROI ≥ 100% → ≥ 50%), lưới phải đỏ đúng ô tiêu 35% · ROI 60% ngoài khung sáng
    cu = NT.tn_roi
    NT.tn_roi = lambda chi, ns: NT.TN["roi"]
    try: pha = cham(o, T) if T else []
    finally: NT.tn_roi = cu
    if T and not pha: raise SystemExit("✗ kiem-xung-dot-luat: phá thử roi_duoi mà lưới không đỏ — lưới mù")
    print(f"kiem-xung-dot-luat: {len(o)} ô xanh ({noi})" + (f" · phá thử roi_duoi đỏ {len(pha)} ô, vd: {pha[0]}" if pha else " · bỏ phá thử (không có tsx)"))


if __name__ == "__main__":
    main()
