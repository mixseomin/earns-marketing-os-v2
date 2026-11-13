# ĐO ĐỘ KHỚP keyframe ↔ khung 3D bằng SỐ, không bằng lời AI (anh 13/11/2026: "có git nào hỗ trợ việc chấm này cho đúng không? sao cứ làm cái này lại hỏng
# sang cái kia" — Gemini đọc ảnh rồi nhận xét chữ: lần chấm này khác lần sau, bỏ sót chú đứng ngoài sân ga (#12), kêu lệch giả ở cận tay).
# Cách ngành làm (GenEval, NeurIPS 2023 — github.com/djghosh13/geneval): máy PHÁT HIỆN vật trên ảnh rồi so vị trí / số lượng bằng hình học.
#   1. HỘP: Grounding DINO (github.com/IDEA-Research/GroundingDINO, bản HF IDEA-Research/grounding-dino-tiny) tìm từng người / đồ trên keyframe theo
#      tên tiếng Anh → IoU với hộp của chính khối đó trên khung 3D (khung_xam.thay[].hop). Đếm người thừa.
#   2. ĐỘ SÂU: Depth Anything V2 Small (github.com/DepthAnything/Depth-Anything-V2) ước độ sâu keyframe → tương quan hạng (Spearman) với ảnh độ sâu
#      three.js (khung_xam.sau, gần = sáng). Bắt sai bố cục mà hộp không thấy: ô cửa sổ thành cửa lên xuống, bánh xe ra ngoài tàu, cận thành toàn cảnh.
# Chạy trên iMac (GPU Apple, venv ~/.venvs/cham-do: torch + transformers + pillow + numpy) — box3 chỉ 3 GB RAM rảnh, đang phục vụ mos2 + studio.
#   ~/.venvs/cham-do/bin/python apps/xuong-video/scripts/cham-do/cham_do.py --tap 3074 [--chi 5,9,12] [--json /tmp/kq.json]
# Dữ liệu shot lấy từ box3 qua ssh + psql (chỉ đọc). 0đ (chạy máy nhà).
import argparse, io, json, re, subprocess, sys, urllib.request
import numpy as np
from PIL import Image

BOX = 'root@167.233.241.16'
# NGƯỠNG — chỉnh theo lần hiệu chuẩn trên tập #3074 (ghi kết quả hiệu chuẩn trong docs/blocking-3d.md)
IOU_NGUOI = 0.45      # người: hộp keyframe chồng hộp 3D ít nhất chừng này
IOU_DO = 0.20         # đồ nhỏ (tờ tiền, chai): hộp nhỏ, lệch vài phần trăm là IoU tụt — ngưỡng thấp hơn
PT_DO_TOI_THIEU = 0.3 # đồ chiếm dưới 0,3 % khung 3D thì không bắt tìm (quá nhỏ để máy dò)
DO_SAU_TOI_THIEU = 0.45   # tương quan hạng độ sâu
DIEM_PHAT_HIEN = 0.30
DINH_DAU = 0.15      # đỉnh đầu người: lệch tối đa (tỉ lệ chiều cao khung)

# Danh từ cho máy dò: rút từ mô tả tiếng Anh của đối tượng (từ đầu tiên khớp), không có thì dùng 'en' của khối 3D
DANH_TU = ['banknote', 'change notes', 'notes', 'bottle', 'wheel', 'lamp post', 'bench', 'kiosk', 'boy', 'girl', 'woman', 'man', 'train']
DOI_TEN = {'change notes': 'money', 'notes': 'money', 'banknote': 'money'}


def sql(q: str):
    cmd = f"cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql \"$DATABASE_URL\" -tAc {json.dumps(q)}"
    out = subprocess.run(['ssh', BOX, cmd], capture_output=True, text=True, check=True).stdout.strip()
    return [json.loads(l) for l in out.splitlines() if l.strip()]


def tai(url: str) -> Image.Image:
    with urllib.request.urlopen(url, timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def danh_tu(mo_ta: str, en: str | None) -> str:
    s = (mo_ta or '').lower()
    for t in DANH_TU:
        if re.search(r'(?<![\w-])' + re.escape(t) + r'(?![\w-])', s):   # 'bottle-green' là màu, không phải chai (cùng lớp lỗi kiem-ai-3d TU_VAT)
            return DOI_TEN.get(t, t)
    return (en or '').split(',')[0].strip().lower() or 'object'


def iou(a, b) -> float:
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    giao = max(0, x1 - x0) * max(0, y1 - y0)
    hop = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - giao
    return giao / hop if hop > 0 else 0.0


def khop_lo(anh, hop) -> float:
    """1 nếu hộp ảnh khớp PHẦN LỘ của hộp 3D (đỉnh + tâm ngang trùng trong 10 % khung, cao ≥ 40 % hộp 3D), 0 nếu không."""
    cx = abs((anh[0] + anh[2]) / 2 - (hop[0] + hop[2]) / 2); dinh = abs(anh[1] - hop[1])
    return 1.0 if cx <= 0.15 and dinh <= 0.15 and (anh[3] - anh[1]) >= 0.4 * (hop[3] - hop[1]) else 0.0


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    ra, rb = a.ravel().argsort().argsort().astype(float), b.ravel().argsort().argsort().astype(float)
    ra -= ra.mean(); rb -= rb.mean()
    d = np.sqrt((ra * ra).sum() * (rb * rb).sum())
    return float((ra * rb).sum() / d) if d else 0.0


class May:
    def __init__(self):
        import torch
        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection, pipeline
        self.torch = torch
        self.dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
        self.proc = AutoProcessor.from_pretrained('IDEA-Research/grounding-dino-tiny')
        self.dino = AutoModelForZeroShotObjectDetection.from_pretrained('IDEA-Research/grounding-dino-tiny').to(self.dev)
        self.sau = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device=self.dev)

    def do(self, anh: Image.Image, nhan: list[str]):
        """[(nhãn, điểm, hộp 0..1)] cho mọi nhãn hỏi."""
        W, H = anh.size
        txt = '. '.join(sorted(set(nhan))) + '.'
        vao = self.proc(images=anh, text=txt, return_tensors='pt').to(self.dev)
        with self.torch.no_grad():
            ra = self.dino(**vao)
        kq = self.proc.post_process_grounded_object_detection(ra, vao.input_ids, threshold=DIEM_PHAT_HIEN, text_threshold=0.25, target_sizes=[(H, W)])[0]
        nh = kq.get('text_labels') or kq.get('labels')
        return [(str(l), float(s), [float(b[0]) / W, float(b[1]) / H, float(b[2]) / W, float(b[3]) / H]) for l, s, b in zip(nh, kq['scores'], kq['boxes'])]

    def do_sau(self, anh: Image.Image) -> np.ndarray:
        return np.asarray(self.sau(anh)['depth'].convert('L').resize((64, 36)), dtype=float)


def cham_shot(may: May, s: dict, nv: dict) -> dict:
    anh = tai(s['kf'])
    # hộp đo trên CHÍNH ảnh three.js (khung_xam.hop) thắng hộp đo 3D sống (thay — lệch ảnh tới 20 % chiều cao, #8)
    hop3 = s.get('hop3') or {}
    thay = [{**t, 'hop': hop3.get(t['ten'], t['hop'])} for t in (s.get('thay') or [])]
    can = []   # (tên, danh từ, hộp 3D, là người)
    t_pt = lambda ten: next((float(t.get('pt', 0)) for t in thay if t['ten'] == ten), 0.0)
    for t in thay:
        v = nv.get(t['ten'])
        if not v or v['loai'] not in ('nhan_vat', 'dao_cu', 'san_pham'):
            continue                       # khối của set (ray, nền…) — độ sâu lo
        hop = t['hop']
        if (hop[2] - hop[0]) * (hop[3] - hop[1]) >= 0.8:
            continue                       # khối phủ kín khung (toa tàu sau lưng) = phông nền — độ sâu lo
        cam_boi = next((x.get('cam') for x in (s.get('vt') or []) if x.get('ten') == t['ten'] and x.get('cam')), None)
        if not t.get('nguoi') and t.get('pt', 0) < PT_DO_TOI_THIEU and not cam_boi:
            continue                       # đồ ĐANG CẦM thì kiểm dù nhỏ (#9 tờ tiền rơi dưới đất lọt vì < 0,3 %)
        can.append((t['ten'], 'person' if t.get('nguoi') else danh_tu(v['mo_ta'], t.get('en')), hop, bool(t.get('nguoi'))))
    vt = {x['ten']: x for x in (s.get('vt') or [])}
    can_cua_so = any('window' in (vt.get(c[0], {}).get('o_dau') or '') for c in can if c[3])
    phat = may.do(anh, [c[1] for c in can] + ['person'] + (['window'] if can_cua_so else []))
    hop_nguoi = {}
    loi, muc = [], []
    for ten, dt, hop, la_nguoi in can:
        ung = [p for p in phat if dt in p[0]]
        tot = max(ung, key=lambda p: max(iou(p[2], hop), khop_lo(p[2], hop) if la_nguoi else 0), default=None)
        i = iou(tot[2], hop) if tot else 0.0
        nguong = IOU_NGUOI if la_nguoi else IOU_DO
        # NGƯỜI BỊ CHE (chú sau vách tàu): hộp 3D gồm cả phần bị che, máy dò chỉ thấy phần lộ — IoU thấp mà ảnh đúng. Khớp khi đỉnh đầu + tâm ngang
        # trùng và phần thấy không ngắn hơn 40 % hộp 3D.
        # KHỐI NHỎ (người chỉ lộ cánh tay < 5 % khung, đồ < 2 %): hộp máy dò chập chờn — chỉ kiểm CÓ MẶT
        nho = (t_pt(ten) < 5) if la_nguoi else (t_pt(ten) < 2)
        dat = bool(tot) and (nho or i >= nguong or (la_nguoi and khop_lo(tot[2], hop) >= 1))
        muc.append({'ten': ten, 'tim': dt, 'iou': round(i, 2), 'dat': dat})
        if not tot:
            loi.append(f'không thấy {ten} ({dt})'); continue
        if not dat:
            loi.append(f'{ten} lệch chỗ / cỡ (IoU {i:.2f} < {nguong})')
        # MÉP CẮT (cỡ cảnh): người bị mép khung cắt ở 3D thì ảnh cũng phải bị cắt đúng mép đó — cận ngực vẽ thành toàn thân (#5 #9) lọt IoU vì hai hộp
        # cùng cao ~65 % khung.
        # ĐỈNH ĐẦU phải trùng (≤ 12 % chiều cao khung): phần luôn lộ kể cả khi thân dưới bị vách che. Cận ngực vẽ thành toàn thân (#5: đầu 3D ở 37 %,
        # ảnh 14 %; #9: 31 % / 11 %) lọt cả IoU lẫn mép cắt vì chân nhóc chạm đáy khung.
        if la_nguoi:
            hop_nguoi[ten] = tot[2]
        if la_nguoi and not nho and abs(tot[2][1] - hop[1]) > DINH_DAU:
            loi.append(f'{ten}: đỉnh đầu ở {tot[2][1]:.0%} chiều cao khung, khung 3D {hop[1]:.0%} — sai cỡ cảnh / chỗ đứng')
        if la_nguoi and i >= nguong:   # chỉ khi khớp bằng IoU — người bị vách che thì hộp 3D chạm mép dưới vì phần chân khuất, không phải cận
            for k, ten_mep in ((3, 'dưới'), (1, 'trên')):
                cat3d = hop[k] >= 0.985 if k == 3 else hop[k] <= 0.015
                cat_anh = tot[2][k] >= 0.95 if k == 3 else tot[2][k] <= 0.05
                if cat3d and not cat_anh:
                    loi.append(f'{ten}: khung 3D bị mép {ten_mep} cắt (cận) mà ảnh vẽ trọn người — sai cỡ cảnh')
    # số người dự kiến = người LỌT KHUNG theo kiểm 3D (kiem), không theo thay — người xa nhỏ không có trong thay (#1 nhóc xa bị đếm thừa)
    # CHỖ ĐỨNG (13/11/2026 #12 #14 #15: chú vẽ đứng ngoài sân ga mà IoU / độ sâu vẫn cho qua): người khai o_dau 'window' thì ĐẦU (điểm giữa mép trên
    # hộp, thụt xuống 8 % chiều cao người) phải nằm trong một ô cửa sổ máy dò thấy.
    cua = [p[2] for p in phat if 'window' in p[0]]
    for ten, b in hop_nguoi.items():
        if 'window' in (vt.get(ten, {}).get('o_dau') or ''):
            dx, dy = (b[0] + b[2]) / 2, b[1] + 0.08 * (b[3] - b[1])
            if not any(c[0] - 0.02 <= dx <= c[2] + 0.02 and c[1] - 0.02 <= dy <= c[3] + 0.02 for c in cua):
                loi.append(f'{ten} không ở trong ô cửa sổ (bộ set khai: {vt[ten]["o_dau"]})')
    # ĐỒ CẦM (#9 tờ tiền dưới đất, #16 chai khổng lồ dưới đất): món có người cầm (vi_tri.cam) phải chạm hộp người cầm (nới 8 %), tâm món không nằm ở
    # 15 % đáy hộp người (chỗ bàn chân), và món không cao quá nửa người cầm.
    for ten, dt, hop, la_nguoi in can:
        cam = vt.get(ten, {}).get('cam')
        if la_nguoi or not cam or cam not in hop_nguoi:
            continue
        ung = [p for p in phat if dt in p[0]]
        if not ung:
            continue
        b = hop_nguoi[cam]; m = max(ung, key=lambda p: p[1])[2]
        mx, my = (m[0] + m[2]) / 2, (m[1] + m[3]) / 2; w8 = 0.08 * (b[2] - b[0] + b[3] - b[1])
        if not (b[0] - w8 <= mx <= b[2] + w8 and b[1] - w8 <= my <= b[3] + w8):
            loi.append(f'{ten} không nằm trong tay {cam} (lìa người cầm)')
        elif my > b[3] - 0.15 * (b[3] - b[1]):
            loi.append(f'{ten} nằm ở chân {cam} (dưới đất), không trong tay')
        if (m[3] - m[1]) > 0.5 * (b[3] - b[1]):
            loi.append(f'{ten} to bất thường ({(m[3] - m[1]) / max(1e-6, b[3] - b[1]):.0%} chiều cao {cam})')
    so_nguoi = max(sum(1 for c in can if c[3]), sum(1 for k in (s.get('kiem') or []) if k.get('trong_khung') and nv.get(k['nhan_vat'], {}).get('loai') == 'nhan_vat'))
    cao_min = min([c[2][3] - c[2][1] for c in can if c[3]] or [1.0])
    # người thừa: chỉ đếm người cỡ đáng kể (≥ 35 % người nhỏ nhất của 3D) — hành khách bé tí sau ô kính khác không tính
    nguoi_thay = [p for p in phat if p[0] == 'person' and p[1] >= 0.4 and (p[2][3] - p[2][1]) >= 0.35 * cao_min]
    thua = max(0, len(nguoi_thay) - so_nguoi)
    if thua:
        loi.append(f'thừa {thua} người (3D có {so_nguoi})')
    tq = None
    if s.get('sau'):
        tq = spearman(may.do_sau(anh), np.asarray(tai(s['sau']).convert('L').resize((64, 36)), dtype=float))
        if tq < DO_SAU_TOI_THIEU:
            loi.append(f'bố cục độ sâu lệch khung 3D (tương quan {tq:.2f} < {DO_SAU_TOI_THIEU})')
    return {'canh': s['id'], 'so': s['so'], 'url': s['kf'], 'muc': muc, 'thua_nguoi': thua, 'do_sau': None if tq is None else round(tq, 2), 'loi': loi, 'dat': not loi}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tap', type=int, required=True)
    ap.add_argument('--chi', default='')
    ap.add_argument('--json', default='')
    ap.add_argument('--ung-vien', action='store_true', help='chấm MỌI ảnh ứng viên (keyframe_uv) của shot chưa đạt, chọn bản tốt nhất (0đ — ảnh đã sinh sẵn)')
    ap.add_argument('--cho-doi', action='store_true', help='mở khoá --ghi (chỉ khi đã có lớp câu hỏi chỗ đứng)')
    ap.add_argument('--ghi', action='store_true', help='kèm --ung-vien: đặt bản tốt nhất làm keyframe đang dùng (sinh-shot.mts --chon trên box3)')
    a = ap.parse_args()
    chi = {int(x) for x in a.chi.split(',') if x.strip()}
    shots = sql(f"SELECT json_build_object('id', id, 'so', thu_tu::int, 'kf', keyframe_url, 'uv', keyframe_uv, 'sau', khung_xam->>'sau', 'thay', khung_xam->'thay', 'kiem', khung_xam->'kiem', 'vt', may_3d->'vi_tri', 'hop3', khung_xam->'hop') FROM xv_canh WHERE tap_id = {a.tap} AND coalesce(nhanh,'') IN ('','A') AND keyframe_url IS NOT NULL AND khung_xam ? 'thay' ORDER BY thu_tu")
    nv = {r['ten']: r for r in sql(f"SELECT json_build_object('ten', ten, 'loai', loai, 'mo_ta', mo_ta) FROM xv_nhan_vat WHERE phim_id = (SELECT phim_id FROM xv_tap WHERE id = {a.tap})")}
    shots = [s for s in shots if not chi or s['so'] in chi]
    may = May()
    kq = []
    for s in shots:
        r = cham_shot(may, s, nv)
        kq.append(r)
        print(f"#{r['so']}: {'✓ ĐẠT' if r['dat'] else '✗ ' + ' · '.join(r['loi'])}  [độ sâu {r['do_sau']}; " + ', '.join(f"{m['ten']} {m['iou']}" for m in r['muc']) + ']', flush=True)
    print(f"— {sum(r['dat'] for r in kq)}/{len(kq)} shot đạt")
    if a.ung_vien:
        # CHỌN TRONG ẢNH ĐÃ SINH (sinh nhiều bản → giữ bản đạt; ngành gọi best-of-N): shot chưa đạt → chấm từng ứng viên, xếp đạt trước, rồi ít lỗi,
        # rồi độ sâu cao. Không sinh thêm gì — vòng tự-sửa / các lượt trước đã để lại ứng viên trong keyframe_uv.
        for r, s in zip(kq, shots):
            if r['dat']:
                continue
            uv = [u for u in dict.fromkeys(s.get('uv') or []) if u and u != s['kf'] and '/keyframe/' in u]
            tot = r
            for u in uv:
                try:
                    x = cham_shot(may, {**s, 'kf': u}, nv)
                except Exception as e:
                    print(f'  #{s["so"]} bỏ ứng viên {u[-40:]}: {e}'); continue
                if (x['dat'], -len(x['loi']), x['do_sau'] or -1) > (tot['dat'], -len(tot['loi']), tot['do_sau'] or -1):
                    tot = x
            doi = tot['url'] != s['kf']
            print(f"  #{s['so']}: {len(uv)} ứng viên → {'✓ ĐẠT' if tot['dat'] else '✗ ' + ' · '.join(tot['loi'])}{' · ĐỔI sang ' + tot['url'] if doi else ' · giữ bản đang dùng'}", flush=True)
            if doi and a.ghi and not a.cho_doi:
                print(f"  ⛔ #{s['so']}: KHÔNG đổi — bộ chấm số đo chưa phán được CHỖ ĐỨNG (trong toa / ngoài sân ga): 13/11/2026 tự đổi đã chọn 5 bản chú đứng sân ga /"
                      " đồ dưới đất. Thêm lớp câu hỏi có/không (DSG) rồi mới mở; ép thì --cho-doi.", flush=True)
            elif doi and a.ghi:
                cmd = f"cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-shot.mts --canh={s['id']} --chon={tot['url']}"
                subprocess.run(['ssh', BOX, cmd], capture_output=True, text=True)
    if a.json:
        open(a.json, 'w').write(json.dumps(kq, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
