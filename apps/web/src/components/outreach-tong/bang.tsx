'use client';
// HAI BẢNG RỘNG của outreach.on.tc (chiến dịch, người nhận) — bọc DataTable nhà: máy chủ đưa dữ liệu thuần, cột dựng ở đây
// (hàm vẽ ô không đi qua ranh giới máy chủ → trình duyệt). Bấm tên chiến dịch / người nhận → khung trang mở trang outreach của dự án đó TẠI CHỖ
// (ngăn trang nhúng của components/home/trang.tsx), đúng chiến dịch (?c=) / đúng người (?prospect=) — hai tham số trang đó đã đọc sẵn.
// tra-repo-ok: bọc DataTable nhà, không phải khối mã mới nhiều thao tác.
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Pill } from '@/components/ui';
import { KIEU, nguonCua, ttCua } from '@/lib/outreach/kieu';
import type { ChienDich, NguoiNhan } from '@/lib/outreach/du-lieu';

const MO = 'var(--fg-3)', DO = 'var(--bad, #f87171)', XANH = 'var(--neon-lime, #4ade80)';
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a * 10 < b ? 1 : 0)}%` : '—');
const h2 = (n: number) => String(n).padStart(2, '0');
const vn = (s: string) => new Date(Date.parse(s) + 7 * 3600_000);
/** giờ Việt Nam, dạng 14:05 21/09 */
const gioVn = (s: string | null) => { if (!s) return '—'; const d = vn(s); return `${h2(d.getUTCHours())}:${h2(d.getUTCMinutes())} ${h2(d.getUTCDate())}/${h2(d.getUTCMonth() + 1)}`; };
const ngayVn = (s: string | null) => { if (!s) return '—'; const d = vn(s); return `${h2(d.getUTCDate())}/${h2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
const so = (v: number) => (v ? v.toLocaleString('vi-VN') : <span style={{ color: MO }}>0</span>);
const tong = <T,>(lay: (r: T) => number) => (rs: T[]) => so(rs.reduce((a, r) => a + lay(r), 0));
/** đèn trạng thái: màu + chữ ở hover (trạng thái lặp theo hàng thì không in chữ từng dòng) */
const Den = ({ mau, chu }: { mau: string; chu: string }) => <span title={chu} aria-label={chu} style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: mau }} />;

export function BangChienDich({ ds, dung }: { ds: ChienDich[]; dung: number[] }) {
  const cot: DataColumn<ChienDich>[] = [
    { key: 'tt', header: '', title: 'đang chạy · tạm dừng · đang đứng (bật tự gửi, còn thư chờ, mà nhiều ngày không gửi được thư nào)', align: 'center', width: 26,
      sortValue: (c) => (dung.includes(c.id) ? 0 : c.chay ? 1 : 2),
      cell: (c) => (dung.includes(c.id) ? <Den mau={DO} chu="Đang đứng: bật tự gửi, còn thư chờ, mà nhiều ngày không gửi được thư nào" /> : c.chay ? <Den mau={XANH} chu="Đang chạy" /> : <Den mau="var(--fg-3)" chu="Tạm dừng" />) },
    { key: 'ten', header: 'Chiến dịch', align: 'left', width: '100%', sortValue: (c) => c.ten.toLowerCase(),
      cell: (c) => <a href={`/p/${c.da}/outreach?c=${c.id}`} style={{ color: 'var(--fg-1)', fontWeight: 600 }} title="Mở trang outreach của dự án, đúng chiến dịch này">{c.ten}</a> },
    { key: 'da', header: 'Dự án', align: 'left', sortValue: (c) => c.da, cell: (c) => c.da || <span style={{ color: MO }}>chưa gắn</span> },
    { key: 'kieu', header: 'Kiểu', align: 'left', sortValue: (c) => KIEU[c.kieu].ten, cell: (c) => KIEU[c.kieu].ten, cellTitle: (c) => `gửi cho: ${KIEU[c.kieu].nhan}\ntính thắng: ${KIEU[c.kieu].dich}` },
    { key: 'gui', header: 'Cách gửi', align: 'left', title: 'tự gửi theo lịch hay gửi tay · trần thư mỗi ngày', sortValue: (c) => (c.tuGui ? c.tran : -1),
      cell: (c) => (c.tuGui ? `tự gửi · ${c.tran}/ngày` : <span style={{ color: MO }}>gửi tay</span>), cellTitle: (c) => (c.tuEmail ? `gửi từ ${c.tuTen ? `${c.tuTen} ` : ''}<${c.tuEmail}>` : 'chưa đặt người gửi') },
    { key: 'n', header: 'Người nhận', sortValue: (c) => c.n, total: tong((c) => c.n), cell: (c) => so(c.n), cellTitle: (c) => `${c.coEmail} có email · ${c.n - c.coEmail} chỉ có form liên hệ` },
    { key: 'cho', header: 'Chờ gửi', sortValue: (c) => c.choGui, total: tong((c) => c.choGui), cell: (c) => so(c.choGui) },
    { key: 'dagui', header: 'Đã gửi', sortValue: (c) => c.daGui, total: tong((c) => c.daGui), cell: (c) => so(c.daGui) },
    { key: 'tl', header: 'Trả lời', sortValue: (c) => c.traLoi, total: tong((c) => c.traLoi), cell: (c) => <span style={{ color: c.traLoi ? XANH : MO }}>{c.traLoi}</span> },
    { key: 'ptl', header: '% trả lời', title: 'trả lời / đã gửi', sortValue: (c) => (c.daGui ? c.traLoi / c.daGui : null), cell: (c) => pct(c.traLoi, c.daGui) },
    { key: 'thang', header: 'Thắng', title: 'đạt đích của kiểu chiến dịch (màn Kiểu và nguồn ghi rõ từng kiểu)', sortValue: (c) => c.thang, total: tong((c) => c.thang), cell: (c) => <b style={{ color: c.thang ? XANH : MO }}>{c.thang}</b> },
    { key: 'doi', header: 'Thư dội', sortValue: (c) => c.doi, cell: (c) => <span style={{ color: c.doi ? DO : MO }}>{c.doi}</span> },
    { key: 'han', header: 'Tới hạn nhắc', sortValue: (c) => c.toiHan, total: tong((c) => c.toiHan), cell: (c) => so(c.toiHan) },
    { key: 'cuoi', header: 'Gửi cuối', sortValue: (c) => c.guiCuoi, cell: (c) => ngayVn(c.guiCuoi), cellTitle: (c) => (c.guiCuoi ? `${gioVn(c.guiCuoi)} giờ Việt Nam` : 'chưa gửi thư nào') },
  ];
  return <DataTable rows={ds} columns={cot} getRowKey={(c) => String(c.id)} persistKey="ob_chien_dich" minWidth={980} pageSize={50}
    searchText={(c) => `${c.da} ${c.ten} ${KIEU[c.kieu].ten}`} searchPlaceholder="Tìm chiến dịch, dự án, kiểu" defaultSort={[{ key: 'cuoi', dir: 'desc' }]} />;
}

export function BangNguoiNhan({ ds, tong: tongSo }: { ds: NguoiNhan[]; tong: number }) {
  const cot: DataColumn<NguoiNhan>[] = [
    { key: 'ten', header: 'Người nhận', align: 'left', width: '100%', sortValue: (p) => p.ten.toLowerCase(),
      cell: (p) => <a href={`/p/${p.da}/outreach?prospect=${p.id}`} style={{ color: 'var(--fg-1)', fontWeight: 600 }} title="Mở trang outreach của dự án, đúng người này">{p.ten || '(không tên)'}</a>,
      cellTitle: (p) => [p.congTy, p.website].filter(Boolean).join(' · ') || undefined },
    { key: 'tt', header: 'Trạng thái', align: 'left', sortValue: (p) => ttCua(p.tt).ten, cell: (p) => <Pill color={ttCua(p.tt).mau} label={ttCua(p.tt).ten} uppercase={false} /> },
    { key: 'da', header: 'Dự án', align: 'left', sortValue: (p) => p.da, cell: (p) => p.da },
    { key: 'cd', header: 'Chiến dịch', align: 'left', sortValue: (p) => p.cdTen ?? '', cell: (p) => p.cdTen ?? <span style={{ color: MO }}>chưa vào chiến dịch</span>, cellTitle: (p) => `kiểu: ${KIEU[p.kieu].ten}` },
    { key: 'lh', header: 'Liên hệ', align: 'left', sortValue: (p) => p.email ?? '', cell: (p) => p.email ?? <span style={{ color: MO }}>chỉ có form</span> },
    { key: 'nguon', header: 'Nguồn', align: 'left', sortValue: (p) => nguonCua(p.nguon).ten, cell: (p) => nguonCua(p.nguon).ten },
    { key: 'gui', header: 'Gửi lúc', title: 'giờ Việt Nam', sortValue: (p) => p.guiLuc, cell: (p) => gioVn(p.guiLuc) },
    { key: 'lan', header: 'Đã nhắc', sortValue: (p) => p.lan, cell: (p) => so(p.lan) },
    { key: 'tl', header: 'Trả lời lúc', title: 'giờ Việt Nam', sortValue: (p) => p.traLoiLuc, cell: (p) => <span style={{ color: p.traLoiLuc ? XANH : MO }}>{gioVn(p.traLoiLuc)}</span> },
    { key: 'hen', header: 'Hẹn nhắc', title: 'giờ Việt Nam', sortValue: (p) => p.hen, cell: (p) => gioVn(p.hen) },
  ];
  return (<>
    {tongSo > ds.length && <div role="alert" style={{ fontSize: 11, color: DO, marginBottom: 6 }}>Bảng đang cắt ở {ds.length.toLocaleString('vi-VN')} người mới nhất trên tổng {tongSo.toLocaleString('vi-VN')} — người cũ hơn chưa hiện ở đây.</div>}
    <DataTable rows={ds} columns={cot} getRowKey={(p) => String(p.id)} persistKey="ob_nguoi_nhan" minWidth={980} pageSize={100}
      searchText={(p) => `${p.ten} ${p.congTy ?? ''} ${p.email ?? ''} ${p.website} ${p.da} ${p.cdTen ?? ''} ${ttCua(p.tt).ten}`} searchPlaceholder="Tìm tên, email, website, chiến dịch, trạng thái" />
  </>);
}
