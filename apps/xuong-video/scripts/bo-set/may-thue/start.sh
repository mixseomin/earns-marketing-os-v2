#!/bin/bash
# Khởi động máy render (image xv-render): RunPod truyền khoá SSH của tài khoản qua biến PUBLIC_KEY → sshd → giữ container sống.
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -n "$PUBLIC_KEY" ] && echo "$PUBLIC_KEY" >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
ssh-keygen -A >/dev/null 2>&1
# /run là tmpfs trên máy chủ container → thư mục tạo lúc build mất, sshd chết "Missing privilege separation directory" (17/10/2026: 3 máy
# RunPod liền không vào được SSH). Tạo lại lúc khởi động; lỗi sshd ghi ra log container.
mkdir -p /run/sshd && chmod 755 /run/sshd
/usr/sbin/sshd -e || echo "sshd không chạy được" >&2
sleep infinity
