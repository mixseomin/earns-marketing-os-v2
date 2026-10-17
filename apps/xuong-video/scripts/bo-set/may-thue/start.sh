#!/bin/bash
# Khởi động máy render (image xv-render): RunPod truyền khoá SSH của tài khoản qua biến PUBLIC_KEY → sshd → giữ container sống.
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -n "$PUBLIC_KEY" ] && echo "$PUBLIC_KEY" >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
ssh-keygen -A >/dev/null 2>&1
/usr/sbin/sshd
sleep infinity
