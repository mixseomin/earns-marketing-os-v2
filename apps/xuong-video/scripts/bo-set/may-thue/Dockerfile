# IMAGE MÁY RENDER THUÊ (anh 17/10/2026 "cài blender rồi xoá, lần sau lại cài — giải pháp nào tối ưu"): Blender + thư viện đồ hoạ đóng sẵn,
# máy RunPod mới kéo image gọn (~1–2 phút, thay image pytorch ~10 GB + cài Blender ~7 phút), không cài gì nữa. Build: GitHub Actions
# (.github/workflows/xv-render-image.yml) → ghcr.io/mixseomin/xv-render. Không CUDA trong image: Blender mang sẵn nhân CUDA / OptiX, driver do
# máy chủ RunPod gắn vào (NVIDIA_DRIVER_CAPABILITIES=all để có cả thư viện OptiX).
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive NVIDIA_DRIVER_CAPABILITIES=all NVIDIA_VISIBLE_DEVICES=all
RUN apt-get update && apt-get install -y --no-install-recommends openssh-server rsync xz-utils curl ca-certificates \
      libxi6 libxrender1 libxkbcommon0 libsm6 libgl1 libegl1 libxxf86vm1 libxfixes3 libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*
ARG BAN=5.0.1
RUN cd /opt && curl -fsSL -A 'Mozilla/5.0' -o b.tar.xz https://download.blender.org/release/Blender5.0/blender-${BAN}-linux-x64.tar.xz \
    && tar -xJf b.tar.xz && rm b.tar.xz && mv blender-${BAN}-linux-x64 blender && /opt/blender/blender --version | head -1
RUN mkdir -p /run/sshd /root/.ssh /root/xv/scripts/bo-set && chmod 700 /root/.ssh
COPY start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
