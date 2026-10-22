# IMAGE MÁY RENDER THUÊ (anh 17/10/2026 "cài blender rồi xoá, lần sau lại cài — giải pháp nào tối ưu"): Blender + thư viện đồ hoạ đóng sẵn,
# máy RunPod mới kéo image gọn (~1–2 phút, thay image pytorch ~10 GB + cài Blender ~7 phút), không cài gì nữa. Build: GitHub Actions
# (.github/workflows/xv-render-image.yml) → ghcr.io/mixseomin/xv-render. Không CUDA trong image: Blender mang sẵn nhân CUDA / OptiX, driver do
# máy chủ RunPod gắn vào (NVIDIA_DRIVER_CAPABILITIES=all để có cả thư viện OptiX).
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive NVIDIA_DRIVER_CAPABILITIES=all NVIDIA_VISIBLE_DEVICES=all
RUN apt-get update && apt-get install -y --no-install-recommends openssh-server rsync xz-utils curl ca-certificates git zip unzip python3 \
      libxi6 libxrender1 libxkbcommon0 libsm6 libgl1 libegl1 libxxf86vm1 libxfixes3 libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*
ARG BAN=5.0.1
RUN cd /opt && curl -fsSL -A 'Mozilla/5.0' -o b.tar.xz https://download.blender.org/release/Blender5.0/blender-${BAN}-linux-x64.tar.xz \
    && tar -xJf b.tar.xz && rm b.tar.xz && mv blender-${BAN}-linux-x64 blender && /opt/blender/blender --version | head -1
# MPFB (người MakeHuman, CC0) + gói tài sản hệ thống + cơ mặt ARKit ĐÓNG SẴN (19/10/2026: máy thuê không có MPFB → cả tập dựng ra thân khối cũ).
# Cùng script cài của iMac (cai-mpfb.sh, hỏi Blender thư mục dữ liệu — Linux ~/.config/blender/…). Context build = scripts/bo-set.
COPY cai-mpfb.sh /tmp/cai-mpfb.sh
RUN bash /tmp/cai-mpfb.sh /opt/blender/blender && rm -rf /tmp/* \
    && /opt/blender/blender -b --factory-startup --python-expr "import addon_utils; addon_utils.enable('bl_ext.user_default.mpfb', default_set=True); import sys; assert any(m.endswith('mpfb.services.humanservice') for m in sys.modules); print('MPFB OK')" 2>&1 | grep 'MPFB OK'
RUN mkdir -p /run/sshd /root/.ssh /root/xv/scripts/bo-set && chmod 700 /root/.ssh
# TÀI SẢN + MOCAP ĐÓNG SẴN (22/10/2026: máy thuê mất ~10 phút nhận 160 MB tài sản đẩy từ iMac mỗi lần thuê): tai-san (Poly Haven / NASA, CC0) tải ngay
# lúc build bằng đúng script của iMac; mocap (CMU) chép từ repo. may-thue.sh chuan-bi chỉ còn đẩy mã (dung-set.py, mesh/) + tệp mới thiếu.
COPY tai-tai-san.sh /root/xv/scripts/bo-set/tai-tai-san.sh
RUN cd /root/xv/scripts/bo-set && bash tai-tai-san.sh >/dev/null && du -sh tai-san
COPY mocap /root/xv/scripts/bo-set/mocap
COPY may-thue/start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
