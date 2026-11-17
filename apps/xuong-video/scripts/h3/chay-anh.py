#!/usr/bin/env python3
"""KEYFRAME TRÊN MÁY THUÊ (anh 17/11/2026 "làm thử theo phương án sinh ảnh 3 bản trên vast"): Qwen-Image-Edit-2511 INT8 ConvRot + LoRA Lightning 4 bước,
đúng mẫu chính thức Comfy-Org workflow_templates/templates/image_qwen_image_edit_2511_int8.json (TextEncodeQwenImageEditPlus nhận tối đa 3 ảnh:
Image 1 = khung 3D previs, Image 2–3 = ảnh mẫu nhân vật). Chạy TRÊN máy thuê sau tren-may.sh (XV_MO_HINH=qwen-edit), cùng khuôn chay-h3.py:
  vao.json {prompt, anh: [url ≤ 3], seed, so_ban, buoc, rong?, cao?} → N bản (seed, seed+1…; mô hình nạp một lần) → dòng CUỐI JSON {mp4: tệp đầu, mp4s: [tệp…]}
  (khoá 'mp4s' là tên chung của lam-lo.sh — tệp ở đây là PNG). chi_kiem: chỉ gửi đồ thị cho ComfyUI duyệt rồi huỷ (kiểm 0đ).
  python3 chay-anh.py /root/h3/vao/<tên>.json"""
import json, os, sys, time, urllib.request

C = '/root/ComfyUI'; API = 'http://127.0.0.1:8188'
V = json.load(open(sys.argv[1]))

def goi(duong, than=None):
    r = urllib.request.Request(API + duong, data=json.dumps(than).encode() if than is not None else None, headers={'content-type': 'application/json'})
    try: t = urllib.request.urlopen(r, timeout=60).read()
    except urllib.error.HTTPError as e: print(json.dumps({'loi': e.read().decode()[:3000]}, ensure_ascii=False)); sys.exit(2)
    return json.loads(t) if t.strip() else {}

os.makedirs(f'{C}/input', exist_ok=True)
anh = []
for i, u in enumerate(V['anh'][:3]):   # nút mã hoá chữ Qwen Edit Plus nhận image1..image3
    ten = f'qe_ref_{i}{os.path.splitext(u.split("?")[0])[1] or ".png"}'
    urllib.request.urlretrieve(u, f'{C}/input/{ten}'); anh.append(ten)

W = {
  '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'qwen_image_edit_2511_int8_convrot.safetensors', 'weight_dtype': 'default'}},
  '2': {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['1', 0], 'lora_name': 'Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors', 'strength_model': 1.0}},
  '3': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['2', 0], 'shift': 3.1}},
  '5': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_2.5_vl_7b_fp8_scaled.safetensors', 'type': 'qwen_image', 'device': 'default'}},
  '6': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'qwen_image_vae.safetensors'}},
  '10': {'class_type': 'FluxKontextImageScale', 'inputs': {'image': ['100', 0]}},   # khung ra theo cỡ của Image 1 (khung 3D) như mẫu
  '11': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['10', 0], 'vae': ['6', 0]}},
  '12': {'class_type': 'TextEncodeQwenImageEditPlus', 'inputs': {'clip': ['5', 0], 'prompt': V['prompt'], 'vae': ['6', 0]}},
  '13': {'class_type': 'TextEncodeQwenImageEditPlus', 'inputs': {'clip': ['5', 0], 'prompt': '', 'vae': ['6', 0]}},
  '14': {'class_type': 'FluxKontextMultiReferenceLatentMethod', 'inputs': {'conditioning': ['12', 0], 'reference_latents_method': 'index_timestep_zero'}},
  '15': {'class_type': 'FluxKontextMultiReferenceLatentMethod', 'inputs': {'conditioning': ['13', 0], 'reference_latents_method': 'index_timestep_zero'}},
  '20': {'class_type': 'KSampler', 'inputs': {'model': ['3', 0], 'seed': int(V.get('seed', 1)), 'steps': int(V.get('buoc', 4)), 'cfg': 1.0, 'sampler_name': 'euler',
         'scheduler': 'simple', 'positive': ['14', 0], 'negative': ['15', 0], 'latent_image': ['11', 0], 'denoise': 1.0}},
  '21': {'class_type': 'VAEDecode', 'inputs': {'samples': ['20', 0], 'vae': ['6', 0]}},
  '22': {'class_type': 'SaveImage', 'inputs': {'images': ['21', 0], 'filename_prefix': 'qe/b1'}},
}
for i, ten in enumerate(anh):
    W[f'10{i}'] = {'class_type': 'LoadImage', 'inputs': {'image': ten}}
    for n in ('12', '13'): W[n]['inputs'][f'image{i + 1}'] = [f'10{i}', 0]
if V.get('chi_kiem'):
    r = goi('/prompt', {'prompt': W}); goi('/interrupt', {}); goi('/queue', {'clear': True}); print(json.dumps({'kiem': 'đồ thị hợp lệ', 'id': r.get('prompt_id')}, ensure_ascii=False)); sys.exit(0)

def mot_ban(seed, k):
    """Một bản: seed riêng + tên tệp riêng (ComfyUI không trả tệp cũ từ bộ nhớ đệm) → đường dẫn PNG của SaveImage '22', hỏng thì in lỗi và trả None."""
    W['20']['inputs']['seed'] = seed; W['22']['inputs']['filename_prefix'] = f'qe/b{k + 1}'
    pid = goi('/prompt', {'prompt': W})['prompt_id']
    while True:
        time.sleep(3); h = goi(f'/history/{pid}').get(pid)
        if not h: continue
        st = h.get('status', {})
        if st.get('status_str') == 'error':
            e = next((m[1] for m in st.get('messages', []) if m and m[0] == 'execution_error'), {})
            print(json.dumps({'loi': f"seed {seed} · {e.get('node_type')}: {e.get('exception_type')}: {str(e.get('exception_message'))[:600]}"}, ensure_ascii=False)); return None
        if st.get('completed'):
            for o in h.get('outputs', {}).get('22', {}).get('images', []):
                p = f"{C}/output/{o.get('subfolder', '')}/{o.get('filename', '')}".replace('//', '/')
                if os.path.isfile(p): return p
            print(json.dumps({'loi': f'seed {seed} · SaveImage không có tệp'}, ensure_ascii=False)); return None

t0 = time.time(); seed0 = int(V.get('seed', 1)); ra = []
for k in range(max(1, int(V.get('so_ban', 1)))):
    t1 = time.time(); p = mot_ban(seed0 + k, k)
    if p: ra.append(p); print(json.dumps({'ban': k + 1, 'giay': round(time.time() - t1)}), flush=True)
if not ra: print(json.dumps({'loi': 'không bản nào ra ảnh'}, ensure_ascii=False)); sys.exit(3)
print(json.dumps({'mp4': ra[0], 'mp4s': ra, 'giay_chay': round(time.time() - t0)}))
sys.exit(0)
