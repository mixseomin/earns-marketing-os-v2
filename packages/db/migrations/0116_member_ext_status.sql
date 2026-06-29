-- Ext handover status per member (manual until per-user ext token ships in Phase 2).
-- none = chưa cấp · handed = đã bàn giao token · active = đang dùng · revoked = thu hồi.
ALTER TABLE members ADD COLUMN IF NOT EXISTS ext_status text;
