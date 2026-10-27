# Máy dựng ffmpeg cho studio (cloudflare/dung-video). ffmpeg của Debian có libass (phụ đề .ass của mẫu máy dựng).
# tesseract + gói eng: POST /soi (soi chữ lạ trong clip — apps/xuong-video soi-chu.ts, chỉ dùng -l eng).
# Font: build context = thư mục cloudflare/dung-video, scripts/dong-goi.sh chép apps/xuong-video/public/fonts vào container/fonts trước khi deploy.
FROM node:22-bookworm-slim
# fonts-noto-cjk + fonts-noto-core: chữ Nhật / Hàn / Trung / Thái cho mẫu "Câu nói theo tình huống" (libass rơi về font có ký tự qua fontconfig) — 27/10/2026
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fontconfig ca-certificates tesseract-ocr tesseract-ocr-eng fonts-noto-cjk fonts-noto-core && rm -rf /var/lib/apt/lists/*
COPY container/fonts /fonts
RUN fc-cache -f /fonts
WORKDIR /app
COPY container/server.mjs /app/server.mjs
EXPOSE 8080
CMD ["node", "/app/server.mjs"]
