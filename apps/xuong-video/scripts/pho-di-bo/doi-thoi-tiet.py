#!/usr/bin/env python3
"""Đổi thời tiết một ảnh phố, GIỮ NGUYÊN phố (Nano Banana qua CỔNG AI CHUNG — cổng chọn người bán rẻ trước). Chạy trên box3 (CONG_AI_KEY trong .env.production).
  ssh box3 '. env; python3 doi-thoi-tiet.py tuyet' < anh.jpg > ra.jpg      (stderr: model thật + giá)
Cổng tự sang người bán sau khi người trước hỏng; MODEL='<cổng>:<model>' ép đúng một cổng.
"""
import base64, json, os, sys, urllib.request

KIEU = sys.argv[1] if len(sys.argv) > 1 else 'tuyet'
GIU = ("Photorealistic edit of this exact dashcam street photo taken at night in Hanoi, Vietnam. Keep the camera angle, perspective, "
       "every building, shop sign, tree, street lamp, parked car, motorbike and wall EXACTLY the same position and shape. ")
if KIEU == 'tuyet-ngay':
    GIU = ("Image edit, not a new image. Use the input photo as the base and keep it pixel-faithful: same street in Hanoi, same camera angle, "
           "every shop sign and its exact text and logo, house number plates, buildings, windows, trees, cars, taxi, motorbikes, people and road markings "
           "must stay exactly where they are and look identical. Do not redraw, rename, translate or move anything. ")
DOI = {
    'tuyet-ngay': ("Only add winter snow on top of the existing scene, daytime overcast: a layer of fresh snow on the road with tire tracks, "
                   "snow on car roofs, hoods and the taxi sign, snow on motorbike seats, snow resting on tree branches and leaves, on balconies, "
                   "awnings, air conditioners, window ledges and sign tops, light snowflakes falling, cold soft grey-blue daylight. "),
    'tuyet': ("Change only the weather to a heavy snowfall night: thick fresh snow covering the whole road with soft tire tracks, "
              "snow piled on car roofs, hoods and windshields, on motorbike seats, snow weighing down tree branches and leaves, "
              "snow on rooftops, balconies, shop awnings, window ledges and the top of the white wall, snow banks along the curb. "
              "Snowflakes falling through the air, glowing in the street lamp light, light fog. Warm sodium lamp light against cold blue snow. "),
    'mua': ("Change only the weather to heavy rain at night: soaking wet asphalt with mirror-like reflections of lamps and shop lights, "
            "puddles with ripples, wet glossy car bodies with water droplets, rain streaks visible in lamp light, misty spray. "),
}.get(KIEU, '')
CUOI = "It must look like a real unedited photograph. Do not add people, text, watermark or a car dashboard. 16:9."
# Câu lệnh NGẮN cho ảnh mẫu — đo 09/11/2026: ShopAIKey trả 401 "Model not found or invalid" với câu dài ở trên, câu ngắn này
# chạy được và GIỮ ĐÚNG biển hiệu / cửa hàng (22 Hoa Lư, Thu Loan Kid). Người bán ckey (trừ wowztools) bỏ qua ảnh mẫu → bịa phố khác.
NGAN = {
    'tuyet-ngay': "Add a layer of fresh snow to this exact photo: thick snow covering the road with tire tracks, snow on car roofs, trees, balconies and awnings, light snow falling. Keep everything else identical, including all shop signs and text.",
    'tuyet': "Add fresh snow to this exact night photo: snow on the road, car roofs, trees and the wall, snow falling in the lamp light. Keep everything else identical, including all shop signs and text.",
    # bước 2 trên ảnh ĐÃ có tuyết: ảnh gốc chụp mùa hè → người mặc áo cộc tay giữa trời tuyết (anh bắt lỗi 09/11/2026)
    'ao-am': "In this exact photo, dress every person and every motorbike rider in thick winter clothing: long padded coats, scarves, knit hats, gloves and long trousers, no bare arms or legs. Keep everything else identical, including the snow, all shop signs and text.",
    # 'ao-am' vẽ THÊM người không có trong ảnh gốc → bịa; anh "không cần người" → xoá hẳn người trên ảnh đã có tuyết
    'bo-nguoi': "Remove all people and all moving motorbikes with their riders from this exact photo, filling the space with the snowy street behind them. Keep everything else identical, including parked cars, parked motorbikes, the snow, all shop signs and text.",
    # video ĐI BỘ (anh 09/11/2026: "phải đi trên vỉa hè, ko phải giữa lòng đường"): ảnh Mapillary chụp từ ô tô → dời góc nhìn lên vỉa hè trái
    'via-he': "Move the camera about 6 meters to the left, onto the left sidewalk, at 1.6 m eye height, as a pedestrian walking forward on the sidewalk between the trees and the parked motorbikes. The sidewalk runs straight ahead in the center of the image, the road is on the right side of the image. Add fresh snow on the sidewalk, road, parked vehicles and trees, light snow falling. Remove all people and moving motorbikes. Keep the same buildings, shops, trees, flag, wall and signs.",
    'mua': "Make this exact night photo rainy: wet reflective road, puddles, raindrops in the lamp light. Keep everything else identical, including all shop signs and text.",
}[KIEU]

import datetime, hashlib, hmac, uuid

def len_r2(data, key):
    """ckey từ chối ảnh data URI (403 upstream rejected, 09/11/2026) → đẩy ảnh lên R2 nhà (img.on.tc) lấy link công khai."""
    E = os.environ; host = f"{E['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"; uri = f"/{E['R2_BUCKET']}/{key}"
    t = datetime.datetime.now(datetime.timezone.utc); amz = t.strftime('%Y%m%dT%H%M%SZ'); ds = amz[:8]
    ph = hashlib.sha256(data).hexdigest()
    ch = f"content-type:image/jpeg\nhost:{host}\nx-amz-content-sha256:{ph}\nx-amz-date:{amz}\n"; sh = 'content-type;host;x-amz-content-sha256;x-amz-date'
    cr = f"PUT\n{uri}\n\n{ch}\n{sh}\n{ph}"; scope = f"{ds}/auto/s3/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amz}\n{scope}\n{hashlib.sha256(cr.encode()).hexdigest()}"
    k = ('AWS4' + E['R2_SECRET_ACCESS_KEY']).encode()
    for p in (ds, 'auto', 's3', 'aws4_request'): k = hmac.new(k, p.encode(), hashlib.sha256).digest()
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    auth = f"AWS4-HMAC-SHA256 Credential={E['R2_ACCESS_KEY_ID']}/{scope}, SignedHeaders={sh}, Signature={sig}"
    urllib.request.urlopen(urllib.request.Request(f"https://{host}{uri}", data=data, method='PUT', headers={
        'content-type': 'image/jpeg', 'x-amz-content-sha256': ph, 'x-amz-date': amz, 'authorization': auth}), timeout=60)
    return f"{E['R2_PUBLIC_BASE'].rstrip('/')}/{key}"

img = sys.stdin.buffer.read()
uri = len_r2(img, f"xuong-video/pho-di-bo/goc-{uuid.uuid4().hex[:12]}.jpg")
print(json.dumps({"ref": uri}), file=sys.stderr)
# QUA CỔNG AI CHUNG (anh 16/11/2026 "một nguồn cho mọi model"; soát 19/11/2026: script này còn gọi thẳng ckey / ShopAIKey): cổng spy /api/ai {loai: 'anh'} tự
# chọn chuỗi rẻ → đắt (ckey → plenxai → ShopAIKey → chính hãng), ghi sổ ai_luot. MODEL='<cổng>:<model>' (vd ckey:wowztools/nano-banana-pro) = ép đúng một cổng.
CONG = os.environ.get('CONG_AI_URL', 'http://127.0.0.1:3850/api/ai')
def khoa_cong():   # cùng nguồn khoá với studio (cong-ai-goi.ts): biến môi trường → box3 /root/.secrets/spy.env → ~/.secrets/cong-ai.env
    if os.environ.get('CONG_AI_KEY'): return os.environ['CONG_AI_KEY']
    for f in ('/root/.secrets/spy.env', os.path.expanduser('~/.secrets/cong-ai.env')):
        try:
            for l in open(f):
                if l.startswith('CONG_AI_KEY='): return l.split('=', 1)[1].strip()
        except OSError: pass
    raise SystemExit('thiếu CONG_AI_KEY')
body = {'viec': 'xv-pho-di-bo', 'loai': 'anh', 'prompt': GIU + DOI + CUOI, 'ti_le': '16:9', 'tham_chieu': [uri]}
ep = os.environ.get('MODEL', '')
if ':' in ep: body['cong'], body['model'] = ep.split(':', 1)
try:
    r = json.load(urllib.request.urlopen(urllib.request.Request(CONG, data=json.dumps(body).encode(),
                  headers={'authorization': f"Bearer {khoa_cong()}", 'content-type': 'application/json'}), timeout=600))
    if r.get('loi'): raise RuntimeError(r['loi'])
    print(json.dumps({'model': r.get('model'), 'chi_usd': r.get('chi_usd')}), file=sys.stderr)
    sys.stdout.buffer.write(base64.b64decode(r['anh_b64'])); sys.exit(0)
except Exception as e:
    print(f"HONG cổng AI: {e} {getattr(e, 'read', lambda: b'')()[:300]!r}", file=sys.stderr); sys.exit(1)
