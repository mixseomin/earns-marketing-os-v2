#!/usr/bin/env bash
# KIỂM CAMP ĐỦ ĐIỀU KIỆN TĂNG NGÂN SÁCH (rule Ethopex — nhóm Support Ads, anh chuyển 20/10/2026):
#   cột Spending = cost / budget. Camp ROI CAO và Spending > 50% (chi tiêu lên mà ROI vẫn giữ) → tăng MỘT bậc theo thang
#   $1 → 3 → 5 → 7 → 10 → 15 → 20, TRẦN $20/camp (anh 20/10/2026, để giữ ROI cao); không thì giữ. Một ngày tác động tăng tối đa 2–3 lần.
# LUẬT CỦA ANH: chỉ ĐỌC + BÁO. Mọi lần tăng phải được anh DUYỆT đúng camp đó trước — script này không bao giờ sửa budget.
# Cách gọi (br đã mở profile htuan82, `br use 557`): kiem-ngan-sach.sh [roi_toi_thieu=20] [spending_toi_thieu=50]
set -u
BR=~/bin/br; ROI_MIN=${1:-20}; SP_MIN=${2:-50}
export BR_PROFILE=${BR_PROFILE:-/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82}
BR_URL_NGUON='vault #557 portal app.ethopex.dev, link Report trên menu' $BR goto https://app.ethopex.dev/report --here >/dev/null 2>&1; sleep 8
$BR eval '[...document.querySelectorAll("main tr")].map(r=>[...r.querySelectorAll("td")].slice(0,12).map(td=>td.innerText.trim().replace(/\s+/g," ")).join("|")).filter(x=>/\d{5}:/.test(x)).join("\n")' | tail -n +1 |
python3 -c '
import sys, re
roi_min, sp_min = float(sys.argv[1]), float(sys.argv[2])
BAC = [1, 3, 5, 7, 10, 15, 20]
def bac_sau(b):
    for x in BAC:
        if x > b + 1e-9: return x
    return None   # đã ở trần $20/camp — không đề xuất tăng nữa
so = lambda s: float(re.sub(r"[^0-9.\-]", "", s) or 0)
dat, gan = [], []
for d in sys.stdin.read().splitlines():
    c = d.split("|")
    if len(c) < 12: continue
    ten, budget, sp, roi, lai, chi, thu = c[1], so(c[2]), so(c[3]), so(c[7]), c[8], c[9], c[10]
    ke = bac_sau(budget)
    dong = f"{ten} · budget ${budget:g} → " + (f"bậc kế ${ke:g}" if ke else "đã ở trần $20") + f" · spending {sp:g}% · ROI {roi:g}% · lãi {lai} (chi {chi}, thu {thu})"
    if sp > sp_min and roi >= roi_min and ke: dat.append(dong)
    elif roi >= roi_min or sp > sp_min * 0.8: gan.append(dong)
print(f"ĐỦ ĐIỀU KIỆN (ROI ≥ {roi_min:g}% và spending > {sp_min:g}%) — CHỜ ANH DUYỆT trước khi tăng:")
print("\n".join("  " + x for x in dat) or "  (chưa có)")
print("GẦN ĐẠT (theo dõi tiếp):")
print("\n".join("  " + x for x in gan) or "  (không)")
' "$ROI_MIN" "$SP_MIN"
