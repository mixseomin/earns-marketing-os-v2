#!/usr/bin/env python3
"""CHẠY MỘT LƯỢT H3 (chạy TRÊN pod, sau tren-may.sh): đọc vao.json {prompt, anh: [url ≤ 9], video: url | null, giay, rong, cao, seed, buoc, turbo}
→ tải ảnh / clip tham chiếu vào ComfyUI/input → dựng workflow API đúng mẫu chính thức video_minimax_h3_r2v (MiniMaxH3ReferenceToVideo + SamplerCustomAdvanced,
res_multistep, LoRA turbo 4 bước) → gửi /prompt → đợi /history → in JSON {mp4, giay_chay}. Lỗi đồ thị (node_errors) in nguyên văn rồi thoát 2.
  python3 chay-h3.py /root/h3/vao.json"""
import json, os, subprocess, sys, time, urllib.request

C = '/root/ComfyUI'; API = 'http://127.0.0.1:8188'
V = json.load(open(sys.argv[1]))

def goi(duong, than=None):
    r = urllib.request.Request(API + duong, data=json.dumps(than).encode() if than is not None else None, headers={'content-type': 'application/json'})
    try: t = urllib.request.urlopen(r, timeout=60).read()
    except urllib.error.HTTPError as e: print(e.read().decode()[:4000]); sys.exit(2)
    return json.loads(t) if t.strip() else {}   # /interrupt, /queue trả thân rỗng (bộ kiểm 0đ bắt được 16/11/2026)

def so_khung(giay):   # 24 fps, lưới 17k + 5 của H3 (cùng công thức ComfyMathExpression trong mẫu)
    n = max(5, round(giay * 24)); return n + (5 - n % 17) % 17

os.makedirs(f'{C}/input', exist_ok=True)
anh = []
for i, u in enumerate(V['anh'][:9]):
    ten = f'h3_ref_{i}{os.path.splitext(u.split("?")[0])[1] or ".png"}'
    urllib.request.urlretrieve(u, f'{C}/input/{ten}'); anh.append(ten)
co_video = bool(V.get('video'))
if co_video:   # clip blockout 3D → đúng 24 fps, đúng khung của lượt (H3 đọc khung tham chiếu ở 24 fps)
    urllib.request.urlretrieve(V['video'], '/root/h3/ref_goc.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/root/h3/ref_goc.mp4', '-r', '24', '-vf', f'scale={V["rong"]}:{V["cao"]}', '-an', f'{C}/input/h3_ref_video.mp4'], check=True)

W = {
  '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', 'weight_dtype': 'default'}},
  '2': {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['1', 0], 'lora_name': 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors', 'strength_model': 1.0}},
  '3': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', 'type': 'minimax', 'device': 'default'}},
  '4': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_video_vae_int8_convrot.safetensors'}},
  '5': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_audio_vae_fp32.safetensors'}},
  '30': {'class_type': 'MiniMaxH3ReferenceToVideo', 'inputs': {'clip': ['3', 0], 'vae': ['4', 0], 'audio_vae': ['5', 0], 'prompt': V['prompt'],
         'width': V['rong'], 'height': V['cao'], 'length': so_khung(V['giay']), 'ref_image_size': 'match'}},
  '40': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': V.get('seed', 261662374822964)}},
  '41': {'class_type': 'BasicGuider', 'inputs': {'model': ['2' if V.get('turbo', True) else '1', 0], 'conditioning': ['30', 0]}},
  '42': {'class_type': 'KSamplerSelect', 'inputs': {'sampler_name': 'res_multistep'}},
  '43': {'class_type': 'BasicScheduler', 'inputs': {'model': ['2' if V.get('turbo', True) else '1', 0], 'scheduler': 'simple', 'steps': V.get('buoc', 4), 'denoise': 1.0}},
  '44': {'class_type': 'SamplerCustomAdvanced', 'inputs': {'noise': ['40', 0], 'guider': ['41', 0], 'sampler': ['42', 0], 'sigmas': ['43', 0], 'latent_image': ['30', 1]}},
  '50': {'class_type': 'VAEDecode', 'inputs': {'samples': ['44', 0], 'vae': ['4', 0]}},
  '51': {'class_type': 'VAEDecodeAudio', 'inputs': {'samples': ['44', 0], 'vae': ['5', 0]}},
  '52': {'class_type': 'CreateVideo', 'inputs': {'images': ['50', 0], 'audio': ['51', 0], 'fps': 24.0}},
  '53': {'class_type': 'SaveVideo', 'inputs': {'video': ['52', 0], 'filename_prefix': 'h3/thu', 'format': 'auto', 'format.codec': 'auto'}},   # DynamicCombo: tuỳ chọn con khoá "<cha>.<con>"
}
for i, ten in enumerate(anh):
    W[f'1{i}0'] = {'class_type': 'LoadImage', 'inputs': {'image': ten}}
    W['30']['inputs'][f'ref_images.ref_image_{i}'] = [f'1{i}0', 0]
if co_video:
    W['20'] = {'class_type': 'LoadVideo', 'inputs': {'file': 'h3_ref_video.mp4'}}
    W['21'] = {'class_type': 'GetVideoComponents', 'inputs': {'video': ['20', 0]}}
    W['30']['inputs']['ref_videos.ref_video_0'] = ['21', 0]
if V.get('thu_luu'):   # kiểm 0đ KHÂU LẤY CLIP (lỗi lượt 6): đồ thị nhỏ có CẢ ô xem trước của LoadVideo lẫn SaveVideo '53' — phải lấy đúng tệp của '53'
    W = {'20': W['20'], '21': W['21'], '52': {'class_type': 'CreateVideo', 'inputs': {'images': ['21', 0], 'fps': 24.0}}, '53': W['53']}
    W['53']['inputs']['video'] = ['52', 0]
if V.get('chi_kiem'):   # kiểm đồ thị (ComfyUI duyệt node + tên tệp) mà không chạy: gửi rồi huỷ ngay
    r = goi('/prompt', {'prompt': W}); goi('/interrupt', {}); goi('/queue', {'clear': True}); print(json.dumps({'kiem': 'đồ thị hợp lệ', 'id': r.get('prompt_id')}, ensure_ascii=False)); sys.exit(0)
t0 = time.time(); pid = goi('/prompt', {'prompt': W})['prompt_id']
while True:
    time.sleep(5); h = goi(f'/history/{pid}').get(pid)
    if not h: continue
    st = h.get('status', {})
    if st.get('status_str') == 'error': print(json.dumps(st.get('messages', [])[-3:])[:4000]); sys.exit(3)
    if st.get('completed'):
        # CHỈ đầu ra của node SaveVideo '53' (type output) — 16/11/2026 lượt 6 đọc nhầm ô xem trước của LoadVideo (clip 3D đầu vào, type input) cho cả 16 cụm,
        # clip H3 thật nằm trên máy rồi mất khi xoá máy. Kiểm tệp có thật trên đĩa trước khi báo.
        for k in h.get('outputs', {}).get('53', {}).values():
            for f in (k if isinstance(k, list) else []):
                p = f"{C}/{f.get('type', 'output')}/{f.get('subfolder', '')}/{f.get('filename', '')}".replace('//', '/')
                if isinstance(f, dict) and f.get('type', 'output') == 'output' and os.path.isfile(p):
                    print(json.dumps({'mp4': p, 'giay_chay': round(time.time() - t0)})); sys.exit(0)
        print('xong mà node SaveVideo không có tệp', json.dumps(h.get('outputs'))[:2000]); sys.exit(4)
