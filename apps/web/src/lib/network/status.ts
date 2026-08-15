// Vòng đời đối soát của một đơn, theo đúng nếp net VN (AccessTrade/Adpia/MasOffer):
//
//   chờ duyệt   — hệ thống ghi nhận đơn, nhà cung cấp chưa xác nhận
//   tạm duyệt   — nhà cung cấp đã xác nhận, CHƯA đối soát xong → tiền chưa chắc
//   được duyệt  — đối soát xong, đây là con số dùng để trả tiền
//   huỷ         — bị loại khi đối soát (hàng trả, đơn ảo, không đủ điều kiện)
//
// Vì sao ba bậc chứ không phải hai: publisher nhìn "đã có $19.75" rồi tiêu, tới lúc đối soát bị
// cắt còn 0 thì đó là mình nợ họ một lời giải thích. Tách "tạm duyệt" ra là cách net VN nói trước
// rằng con số này còn đổi được.
//
// Mình KHÔNG tự chấm trạng thái — suy từ dữ liệu upstream, vì tiền là của họ chấm:
//   CJ: `action-status` (new/locked/closed/extended/corrected) + `locking-date`. Đơn khoá rồi
//       (locking-date đã qua) thì CJ không sửa được nữa → đó chính là "được duyệt".
//       CJ để locking-date = 9999-12-31 nghĩa là CHƯA ấn định ngày khoá, không phải khoá vào năm 9999.

export type SettleState = 'pending' | 'holding' | 'approved' | 'cancelled';

export const SETTLE_LABEL: Record<SettleState, string> = {
  pending: 'chờ duyệt',
  holding: 'tạm duyệt',
  approved: 'được duyệt',
  cancelled: 'huỷ',
};

export const SETTLE_COLOR: Record<SettleState, string> = {
  pending: 'var(--fg-3)',
  holding: 'var(--warn)',
  approved: 'var(--ok)',
  cancelled: 'var(--danger)',
};

/** Ngày CJ dùng để nói "chưa ấn định ngày khoá". Không phải một ngày thật. */
const CJ_NO_LOCK = '9999';

export function cjSettleState(actionStatus: string, lockDate: string, amount: number, now = new Date()): SettleState {
  const s = (actionStatus || '').toLowerCase();
  // Số tiền về 0 sau khi đã ghi nhận = đơn bị đánh hỏng. Bắt trước mọi nhánh khác vì một đơn
  // "closed" mà 0 đồng vẫn là huỷ, không phải "được duyệt 0 đồng".
  if (amount === 0) return 'cancelled';
  if (s === 'corrected' && amount < 0) return 'cancelled';
  const locked = !!lockDate && !lockDate.startsWith(CJ_NO_LOCK) && Date.parse(lockDate) <= now.getTime();
  if (locked || s === 'closed') return 'approved';
  if (s === 'locked' || s === 'extended') return 'holding';
  return 'pending';
}

/**
 * Trạng thái đối soát của Awin → cùng bốn nấc với CJ.
 *
 * Awin chỉ có ba nấc trong payload (pending · approved · declined) và KHÔNG có mốc khoá đơn kiểu
 * `locking-date` của CJ, nên không có nấc "tạm duyệt" ở đây. Không bịa ra một nấc mình không đo
 * được: giá trị lạ (deleted, chuỗi mới Awin thêm sau này) rơi về `pending` — chưa chốt là an toàn,
 * đoán thành đã duyệt là hứa tiền chưa chắc có.
 */
export function awinSettleState(commissionStatus: string, amount: number): SettleState {
  if (amount <= 0) return 'cancelled';
  const s = (commissionStatus || '').toLowerCase();
  if (s === 'declined' || s === 'deleted') return 'cancelled';
  if (s === 'approved') return 'approved';
  return 'pending';
}
