# IMAGE MÁY THUÊ H3 (16/11/2026, anh: "test script ở đâu cho rẻ trước khi deploy"): ComfyUI + PyTorch CUDA 13 đóng sẵn → máy RunPod / Vast lên là chạy, khỏi
# ~15 phút cài mỗi lần thuê (chỉ còn tải 40GB mô hình từ Hugging Face, ~1 phút). KHÔNG khai NVIDIA_REQUIRE_CUDA: image cu13 của RunPod tự khai yêu cầu CUDA 13
# nên RunPod chỉ xếp vào máy driver mới (hết chỗ 4 lần liền) — ở đây driver ≥ 580 do may-h3.sh kiểm sau khi máy lên. Mô hình KHÔNG đóng vào image (40GB kéo
# image còn chậm hơn tải Hugging Face). Build + KIỂM 0đ trên GitHub Actions (.github/workflows/xv-h3-image.yml chạy thu-0d.sh trong image, đạt mới đẩy).
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive NVIDIA_DRIVER_CAPABILITIES=all NVIDIA_VISIBLE_DEVICES=all \
    PIP_BREAK_SYSTEM_PACKAGES=1 PIP_ROOT_USER_ACTION=ignore PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends openssh-server rsync curl ca-certificates git python3 python3-pip ffmpeg \
    && rm -rf /var/lib/apt/lists/*
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130
ARG COMFY=master
RUN git clone -q --depth 1 --branch ${COMFY} https://github.com/Comfy-Org/ComfyUI.git /root/ComfyUI \
    && pip install -r /root/ComfyUI/requirements.txt huggingface_hub hf_xet \
    && python3 -c 'import torch,sys; print("torch", torch.__version__, torch.version.cuda); sys.exit(0 if (torch.version.cuda or "").startswith("13") else 1)'
RUN curl -fsSL -o /usr/local/bin/runpodctl https://github.com/runpod/runpodctl/releases/download/v3.1.1/runpodctl-linux-amd64 && chmod +x /usr/local/bin/runpodctl
RUN mkdir -p /run/sshd /root/.ssh /root/h3 && chmod 700 /root/.ssh
COPY tren-may.sh chay-h3.py lam-lo.sh thu-0d.sh thu-may.sh /root/h3/
COPY may/start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
