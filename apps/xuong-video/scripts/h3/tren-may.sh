#!/bin/bash
# CÀI H3 TRÊN MÁY THUÊ (chạy TRÊN pod RunPod, image runpod/pytorch cu12.9 + PyTorch cu130 cài tại chỗ): ComfyUI gốc + bản H3 chính thức của Comfy-Org (ref2va cắt gọn INT8,
# bộ mã hoá chữ Qwen3-VL NVFP4, VAE hình INT8 + VAE tiếng, LoRA turbo 4 bước) — đúng bộ mẫu workflow_templates/video_minimax_h3_r2v.json.
# Chạy lại an toàn (tệp đã có thì bỏ qua). Xong thì ComfyUI nghe ở 127.0.0.1:8188. Gọi từ may-h3.sh qua ssh.
set -euo pipefail
C=/root/ComfyUI
export PIP_BREAK_SYSTEM_PACKAGES=1 PIP_ROOT_USER_ACTION=ignore   # image Ubuntu 24.04: pip mặc định từ chối cài vào Python hệ thống (PEP 668) — máy thuê dùng một lần
command -v ffmpeg >/dev/null || (apt-get update -qq && apt-get install -y -qq ffmpeg >/dev/null)
[ -d $C ] || git clone -q --depth 1 https://github.com/Comfy-Org/ComfyUI.git $C
# Bản INT8 ConvRot cần PyTorch CUDA 13 (notebook minimax-h3-colab). Image cu12.9 để RunPod xếp được vào mọi máy (image cu13 tự khai yêu cầu CUDA 13 → chỉ máy
# driver mới, hết chỗ 16/11/2026); máy có driver ≥ 580 (may-h3.sh đã kiểm) thì cài PyTorch cu130 tại chỗ như notebook làm.
# THỨ TỰ: gói của ComfyUI TRƯỚC, PyTorch cu130 SAU — requirements.txt kéo torch bản mặc định (cu12.8) đè lên bản cu130 (16/11/2026 lượt 5: ComfyUI báo
# "PYTORCH CUDA VERSION BELOW 13.0"). Kiểm lại sau cùng: không phải CUDA 13 thì dừng, khỏi chạy chậm tốn tiền máy.
pip install -q -r $C/requirements.txt huggingface_hub hf_xet 2>&1 | tail -2
python3 -c 'import torch,sys; sys.exit(0 if (torch.version.cuda or "").startswith("13") else 1)' || pip install -q --force-reinstall torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130 2>&1 | tail -1
# XV_H3_CPU=1: kiểm 0đ không GPU (thu-0d.sh trên GitHub Actions) — vẫn bắt buộc PyTorch CUDA 13, bỏ đòi có card
python3 -c 'import torch,sys,os; cpu=os.environ.get("XV_H3_CPU")=="1"; print("torch", torch.__version__, "cuda", torch.version.cuda, "CPU (kiểm 0đ)" if cpu else torch.cuda.get_device_name(0)); sys.exit(0 if (torch.version.cuda or "").startswith("13") and (cpu or torch.cuda.is_available()) else 3)'
python3 - <<'PY'
import os
if os.environ.get('XV_H3_KHONG_TAI') == '1':   # kiểm 0đ: tệp rỗng giữ chỗ đúng tên — ComfyUI duyệt đồ thị theo TÊN tệp
    for t in ['diffusion_models/minimax_h3_ref2va_pruned_int8_convrot', 'text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq', 'vae/minimax_h3_video_vae_int8_convrot', 'vae/minimax_h3_audio_vae_fp32', 'loras/minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16']:
        os.makedirs(os.path.dirname(f'/root/ComfyUI/models/{t}'), exist_ok=True); open(f'/root/ComfyUI/models/{t}.safetensors', 'a').close()
    raise SystemExit(0)
from huggingface_hub import hf_hub_download
from concurrent.futures import ThreadPoolExecutor
import os, shutil, time
C = '/root/ComfyUI/models'
# XV_MO_HINH=qwen-edit: KEYFRAME trên máy thuê (anh 17/11/2026 "sinh ảnh 3 bản trên vast") — Qwen-Image-Edit-2511 INT8 ConvRot + LoRA Lightning 4 bước,
# đúng mẫu chính thức Comfy-Org workflow_templates/templates/image_qwen_image_edit_2511_int8.json (cùng PyTorch CUDA 13 như H3).
BO = {'h3': [('Comfy-Org/MiniMax-H3', 'diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors', 'diffusion_models'),
             ('Comfy-Org/MiniMax-H3', 'text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', 'text_encoders'),
             ('Comfy-Org/MiniMax-H3', 'vae/minimax_h3_video_vae_int8_convrot.safetensors', 'vae'),
             ('Comfy-Org/MiniMax-H3', 'vae/minimax_h3_audio_vae_fp32.safetensors', 'vae'),
             ('Comfy-Org/MiniMax-H3', 'loras/minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors', 'loras')],
      'qwen-edit': [('Comfy-Org/Qwen-Image-Edit_ComfyUI', 'split_files/diffusion_models/qwen_image_edit_2511_int8_convrot.safetensors', 'diffusion_models'),
             ('Comfy-Org/HunyuanVideo_1.5_repackaged', 'split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors', 'text_encoders'),
             ('Comfy-Org/Qwen-Image_ComfyUI', 'split_files/vae/qwen_image_vae.safetensors', 'vae'),
             ('lightx2v/Qwen-Image-Edit-2511-Lightning', 'Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors', 'loras')]}
TEP = BO[os.environ.get('XV_MO_HINH') or 'h3']
def tai(t):
    kho, ten, thu = t; dich = f'{C}/{thu}/{os.path.basename(ten)}'
    if os.path.isfile(dich): return f'có sẵn {os.path.basename(ten)}'
    t0 = time.time(); p = hf_hub_download(kho, ten, local_dir='/root/hf')
    os.makedirs(os.path.dirname(dich), exist_ok=True); shutil.move(p, dich)
    return f'{os.path.basename(ten)} {os.path.getsize(dich)/2**30:.1f} GiB {time.time()-t0:.0f}s'
with ThreadPoolExecutor(5) as ex:
    for r in ex.map(tai, TEP): print(r, flush=True)
PY
if ! curl -s -m 2 127.0.0.1:8188/system_stats >/dev/null; then
  # setsid + < /dev/null: tách hẳn khỏi phiên ssh — không thì phiên ssh treo chờ ComfyUI (lượt 5)
  cd $C && setsid nohup python3 main.py --listen 127.0.0.1 --port 8188 $([ "${XV_H3_CPU:-}" = 1 ] && echo --cpu) > /root/comfyui.log 2>&1 < /dev/null &
  for i in $(seq 1 90); do curl -s -m 2 127.0.0.1:8188/system_stats >/dev/null && break; sleep 2; done
fi
curl -s -m 5 127.0.0.1:8188/system_stats | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ComfyUI", d["system"]["comfyui_version"], "·", d["devices"][0]["name"])'
