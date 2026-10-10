---
ten: MOS2 (hệ quản trị nội bộ)
nguon: CLAUDE.md (Deploy) + hook guard-actions
---
- Deploy = **git push** lên main → GHA tự dựng. Cấm scp/rsync mã lên máy chủ.
- Không mở mos2.on.tc bằng trình duyệt tự động; kiểm bằng curl / psql / ssh.
- Không commit .env hay tệp chứa bí mật.
