'use client';

// Portal publisher — bố cục theo đúng nếp net VN (AccessTrade/Adpia): Tổng quan · Chiến dịch ·
// Công cụ tạo link · Báo cáo. Publisher chỉ thấy số của CHÍNH MÌNH.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PubOffer, PubCatalogOffer } from '@/lib/network/data';
import type { PubView, PubConversion } from '@/lib/network/report';
import { SETTLE_LABEL, SETTLE_COLOR } from '@/lib/network/status';
import { trackingUrl, UTM_SLOTS, type Utm } from '@/lib/network/link';
import { requestOffer, requestCatalogOffer } from '@/lib/actions/network';
import { changePasswordAction, logoutAction } from '@/lib/actions/pub-auth';
import { Section, SimpleTable, StatsStrip, EmptyState, Pill, Segmented, TextField, type SimpleColumn, type StatCard } from './ui';

/** Publisher tự đổi mật khẩu. Ô để TRỐNG, giá trị chỉ nằm trong trình duyệt của họ rồi đi thẳng
 *  vào bcrypt — không qua admin, không lưu ở đâu khác, không ai khác đọc được. */
function ChangePassword() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  // Bắt gõ lại: gõ sai một ký tự ở ô mới là tự khoá mình ra ngoài, và không có đường nào biết
  // mật khẩu đã lưu là gì để dò lại.
  const mismatch = !!again && next !== again;
  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 340 }}>
      <TextField label="Mật khẩu hiện tại" type="password" autoComplete="current-password"
        value={cur} onChange={(e) => setCur(e.target.value)} />
      <TextField label="Mật khẩu mới" type="password" autoComplete="new-password"
        hint="Tối thiểu 8 ký tự." value={next} onChange={(e) => setNext(e.target.value)} />
      <TextField label="Gõ lại mật khẩu mới" type="password" autoComplete="new-password"
        error={mismatch ? 'Hai ô không khớp' : undefined}
        value={again} onChange={(e) => setAgain(e.target.value)} />
      <button type="button" disabled={busy || !next || mismatch}
        onClick={() => start(async () => {
          const r = await changePasswordAction(cur, next);
          setMsg({ ok: r.ok, text: r.ok ? 'Đã đổi mật khẩu' : r.error ?? 'lỗi' });
          if (r.ok) { setCur(''); setNext(''); setAgain(''); }
        })}
        style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'transparent',
                 color: 'var(--ok)', border: '1px solid var(--ok)', borderRadius: 4, cursor: 'pointer', justifySelf: 'start' }}>
        {busy ? 'Đang đổi…' : 'Đổi mật khẩu'}
      </button>
      {msg && <span style={{ fontSize: 11, color: msg.ok ? 'var(--ok)' : 'var(--warn)' }}>{msg.text}</span>}
    </div>
  );
}

/**
 * Danh mục toàn network — publisher TỰ tìm và tự dựng chiến dịch, không phải chờ admin dựng hộ.
 *
 * Chỉ CHỌN được, không gõ link tự do: `upstream_url` là link affiliate của tài khoản NHÀ, publisher
 * nhập tay thì họ dán link của chính họ và hoa hồng đi chỗ khác — nhìn bằng mắt không phát hiện ra.
 */
function CatalogPicker({ items, busy, onAsk }: {
  items: PubCatalogOffer[]; busy: boolean; onAsk: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    // Chưa gõ thì vẫn đổ 30 dòng đầu ra: bảng rỗng chờ-gõ nhìn y như "không có gì để chạy".
    const base = s
      ? items.filter((i) => i.name.toLowerCase().includes(s) || i.advertiser.toLowerCase().includes(s))
      : items;
    return { rows: base.slice(0, s ? 50 : 30), total: base.length };
  }, [q, items]);

  const cols: SimpleColumn<PubCatalogOffer>[] = [
    { key: 'n', header: 'Offer', cell: (c) => (
      <span><span style={{ color: 'var(--fg-0)' }}>{c.name}</span>
        {c.advertiser && c.advertiser !== c.name && <span style={dim}> · {c.advertiser}</span>}</span>
    ) },
    { key: 'v', header: 'Ngành', cell: (c) => <span style={dim}>{c.vertical ?? '—'}</span> },
    // Mức CỦA HỌ. Không có cột nào cho mức nhà, và cũng không có dữ liệu đó trong payload.
    { key: 'r', header: 'Hoa hồng', cell: (c) => (
      <span style={mono}>{c.payout ?? <span style={dim}>thoả thuận</span>}</span>
    ) },
    { key: 'a', header: '', align: 'right', cell: (c) => (
      <button type="button" disabled={busy} onClick={() => onAsk(c.id)}
        style={{ padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', background: 'transparent',
                 color: 'var(--accent)', border: '1px solid var(--accent-line)', borderRadius: 4, cursor: 'pointer' }}>
        Xin chạy
      </button>
    ) },
  ];

  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ tên offer hoặc nhãn hàng…"
        style={{ ...mono, width: '100%', maxWidth: 380, padding: '5px 8px', marginBottom: 8,
                 background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 4 }} />
      {hits.rows.length === 0
        ? <EmptyState icon="🔍" compact title="Không có offer nào khớp" />
        : <SimpleTable rows={hits.rows} columns={cols} getRowKey={(c) => c.id} />}
      {hits.total > hits.rows.length && (
        <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
          Còn {hits.total - hits.rows.length} offer nữa — gõ thêm để lọc.
        </p>
      )}
    </>
  );
}

const usd = (n: number) => (n >= 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);
const mono = { fontFamily: 'var(--font-mono)', fontSize: 11 } as const;
const dim = { color: 'var(--fg-3)' };

const REG_LABEL: Record<string, string> = { approved: 'đang chạy', pending: 'chờ duyệt', rejected: 'bị từ chối' };
const REG_COLOR: Record<string, string> = { approved: 'var(--ok)', pending: 'var(--warn)', rejected: 'var(--fg-3)' };

export function PubPortal({ pubName, offers, catalog, view, origin }: {
  pubName: string; offers: PubOffer[]; catalog: PubCatalogOffer[];
  view: PubView; origin: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const approved = offers.filter((o) => o.regStatus === 'approved');
  const [sel, setSel] = useState(approved[0]?.slug ?? '');
  const [utm, setUtm] = useState<Utm>({});

  const selToken = approved.find((o) => o.slug === sel)?.linkToken ?? null;
  const link = selToken ? trackingUrl(origin, selToken, utm) : '';

  // Nuốt lỗi ở đây là lý do lần trước hỏng mà không ai biết: bấm xong không có gì đổi, cũng không
  // có gì báo. Có lỗi thì phải in ra.
  const [reqErr, setReqErr] = useState<string | null>(null);
  const ask = (offerId: number) => start(async () => {
    const r = await requestOffer(offerId);
    setReqErr(r.ok ? null : r.error ?? 'Không gửi được yêu cầu');
    if (r.ok) router.refresh();
  });
  const askCatalog = (catalogId: string) => start(async () => {
    const r = await requestCatalogOffer(catalogId);
    setReqErr(r.ok ? null : r.error ?? 'Không gửi được yêu cầu');
    if (r.ok) router.refresh();
  });

  const cards: StatCard[] = [
    { key: 'c', label: 'Click', value: String(view.clicks), color: 'var(--neon-cyan)' },
    { key: 'o', label: 'Đơn', value: String(view.orders), color: 'var(--fg-0)' },
    { key: 'a', label: 'Hoa hồng được duyệt', value: usd(view.approved), color: 'var(--ok)',
      title: 'Đã đối soát xong — số này không đổi nữa' },
    { key: 'h', label: 'Tạm duyệt', value: usd(view.holding), color: 'var(--warn)',
      title: 'Nhà cung cấp đã xác nhận nhưng chưa đối soát. Số này CÒN ĐỔI ĐƯỢC, đừng tính là tiền đã có.' },
    { key: 'w', label: 'Chờ duyệt', value: usd(view.pending), color: 'var(--fg-2)',
      title: 'Mới ghi nhận, nhà cung cấp chưa xác nhận' },
  ];

  const offerCols: SimpleColumn<PubOffer>[] = [
    { key: 'n', header: 'Chiến dịch', cell: (o) => (
      <span><span style={{ color: 'var(--fg-0)' }}>{o.name}</span>
        {o.advertiser && o.advertiser !== o.name && <span style={dim}> · {o.advertiser}</span>}</span>
    ) },
    { key: 'cat', header: 'Ngành', cell: (o) => <span style={dim}>{o.category ?? '—'}</span> },
    // Mức CỦA PUBLISHER. Bản cũ fallback `?? o.upstreamRate` nên khi chưa đặt mức riêng là in
    // nguyên mức nhà kèm ghi chú nội bộ ("2.5% (CJ link 15534820)") ra cho người ngoài đọc.
    { key: 'r', header: 'Hoa hồng', cell: (o) => (
      <span style={mono}>{o.payout ?? <span style={dim}>thoả thuận</span>}</span>
    ) },
    { key: 't', header: 'Điều kiện ghi nhận', cell: (o) => <span style={{ ...dim, fontSize: 11 }}>{o.terms ?? '—'}</span> },
    // Chưa xin → "Xin chạy". Bị từ chối → "Xin lại": server VẪN nhận (đổi kênh, sửa cách chạy) nên
    // UI phải mở đúng cái server cho, không thì publisher tưởng cửa đã đóng hẳn.
    { key: 's', header: 'Trạng thái', cell: (o) => {
      const again = o.regStatus === 'rejected';
      return (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {o.regStatus && <Pill label={REG_LABEL[o.regStatus] ?? o.regStatus} color={REG_COLOR[o.regStatus] ?? 'var(--fg-3)'} size="xs" tone="soft" />}
          {(!o.regStatus || again) && (
            <button type="button" disabled={busy} onClick={() => ask(o.id)}
              style={{ padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', background: 'transparent',
                       color: 'var(--accent)', border: '1px solid var(--accent-line)', borderRadius: 4, cursor: 'pointer' }}>
              {again ? 'Xin lại' : 'Xin chạy'}
            </button>
          )}
        </span>
      );
    } },
  ];

  const convCols: SimpleColumn<PubConversion>[] = [
    { key: 'd', header: 'Ngày', cell: (r) => <span style={mono}>{r.date}</span> },
    { key: 'o', header: 'Chiến dịch', cell: (r) => r.advertiser },
    { key: 'u', header: 'Sub-id của bạn', cell: (r) => <span style={{ ...mono, ...dim }}>{r.utm.join(' · ') || '—'}</span> },
    { key: 's', header: 'Trạng thái', cell: (r) => <Pill label={SETTLE_LABEL[r.state]} color={SETTLE_COLOR[r.state]} size="xs" tone="soft" /> },
    { key: 'c', header: 'Hoa hồng', align: 'right', cell: (r) => <span style={{ ...mono, color: 'var(--ok)' }}>{usd(r.commission)}</span> },
  ];

  return (
    // Khung cuộn RIÊNG: body{overflow:hidden} nên chỗ cuộn duy nhất của app là .main trong
    // AppShell. Portal publisher không bọc AppShell (nav MOS2 không phải việc của người ngoài)
    // → phải tự dựng khung, nếu không trang đứng im không kéo lên xuống được.
    <div style={{ height: '100dvh', overflowY: 'auto' }}>
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">📈 {pubName}<small>// publisher</small></h1>
          <p className="page-sub">
            Hoa hồng <b>tạm duyệt</b> là số nhà cung cấp đã xác nhận nhưng chưa đối soát — còn đổi được.
            Chỉ <b>được duyệt</b> mới là tiền chốt.
          </p>
        </div>
        <button type="button" onClick={() => logoutAction()}
          style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'transparent',
                   color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer' }}>
          Thoát
        </button>
      </div>

      <StatsStrip cards={cards} />

      <Section title="Link của bạn" subtitle="đã gắn sẵn mã theo dõi — copy nguyên văn, không sửa gì" defaultOpen>
        {approved.length === 0 ? (
          <EmptyState icon="🔗" compact title="Chưa có chiến dịch nào được duyệt"
            description="Xin chạy một chiến dịch ở khối bên dưới; được duyệt thì link hiện ngay ở đây." />
        ) : (
          <>
            {/* Mỗi chiến dịch một link SẴN, không phải ghép từ mấy ô. Trước đây link là
                /c/<offer>?p=<slug-của-bạn> — publisher sửa `p=` thành người khác là công chạy sang
                tài khoản đó, xoá đi thì 403 và tưởng chiến dịch chết. Giờ cả hai nằm trong token. */}
            <SimpleTable
              rows={approved}
              getRowKey={(o) => o.slug}
              columns={[
                { key: 'n', header: 'Chiến dịch', cell: (o) => <span style={{ color: 'var(--fg-0)' }}>{o.name}</span> },
                { key: 'l', header: 'Link dán ra ngoài', cell: (o) => (
                  o.linkToken
                    ? <input readOnly value={trackingUrl(origin, o.linkToken)} onFocus={(e) => e.currentTarget.select()}
                        style={{ ...mono, width: '100%', minWidth: 320, padding: '4px 6px', background: 'var(--bg-2)',
                                 color: 'var(--accent)', border: '1px solid var(--line)', borderRadius: 4 }} />
                    : <span style={{ ...dim, fontSize: 11 }}>chưa cấp link — báo admin</span>
                ) },
              ]}
            />
            <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 8 }}>
              Bấm vào ô là chọn hết, Ctrl/Cmd+C là xong. <b>Đừng sửa gì trong link</b> — mã theo dõi nằm sẵn trong đó.
            </p>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 6 }}>
                Muốn tự chia nhỏ theo chiến dịch/mẫu quảng cáo thì thêm bốn ô dưới đây (không bắt buộc):
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <Segmented<string>
                  value={sel} onChange={setSel}
                  options={approved.map((o) => ({ value: o.slug, label: o.name, title: o.terms ?? undefined }))}
                />
                {UTM_SLOTS.map((k) => (
                  <input key={k} value={utm[k] ?? ''} placeholder={k}
                    onChange={(e) => setUtm((u) => ({ ...u, [k]: e.target.value }))}
                    style={{ ...mono, width: 130, padding: '3px 6px', background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 4 }} />
                ))}
              </div>
              {/* Ô đọc-được-chọn-được, không phải nút "copy": nút copy hỏng lặng lẽ khi trình duyệt
                  chặn clipboard, mà người dùng lại tưởng đã copy. */}
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
                style={{ ...mono, width: '100%', padding: '6px 8px', background: 'var(--bg-2)', color: 'var(--accent)', border: '1px solid var(--line)', borderRadius: 4 }} />
              <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
                Bốn ô <code>utm_*</code> là của bạn, chúng quay về nguyên văn trong báo cáo. Gõ hỏng cũng không sao —
                cùng lắm mất nhãn phụ, hoa hồng vẫn về đúng tài khoản.
              </p>
            </div>
          </>
        )}
      </Section>

      <Section title="Chiến dịch" subtitle="muốn chạy thêm cái nào thì bấm Xin chạy — duyệt xong link hiện ở khối trên" defaultOpen>
        {offers.length === 0
          ? <EmptyState icon="📦" compact title="Chưa có chiến dịch nào" />
          : <SimpleTable rows={offers} columns={offerCols} getRowKey={(o) => o.slug} />}
        {reqErr && <p style={{ fontSize: 11, color: 'var(--warn)', marginTop: 8 }}>{reqErr}</p>}
      </Section>

      <Section title="Tìm chiến dịch mới" subtitle={`${catalog.length} offer trong danh mục — chọn cái muốn chạy, admin duyệt là có link`} defaultOpen>
        <CatalogPicker items={catalog} busy={busy} onAsk={askCatalog} />
        {reqErr && <p style={{ fontSize: 11, color: 'var(--warn)', marginTop: 8 }}>{reqErr}</p>}
      </Section>

      <Section title="Đổi mật khẩu" defaultOpen={false}>
        <ChangePassword />
      </Section>

      <Section title="Báo cáo đơn hàng" defaultOpen>
        {view.conversions.length === 0
          ? <EmptyState icon="🧾" compact title="Chưa có đơn nào" description="Đơn hiện ở đây sau khi nhà cung cấp ghi nhận (thường vài giờ tới vài ngày)." />
          : <SimpleTable rows={view.conversions} columns={convCols} getRowKey={(r) => r.upstreamId} />}
      </Section>
    </div>
    </div>
  );
}
