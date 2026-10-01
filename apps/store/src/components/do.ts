'use client';
// Đo lường: GA4 + Meta Pixel (+ Google Ads chuyển đổi) theo cấu hình mat_tien.do của từng shop. Một hàm bao() cho mọi sự kiện thương mại.
type W = Window & { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };

export type MonDo = { item_id: string; item_name: string; item_variant?: string; price: number; quantity: number };

const FB: Record<string, string> = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', add_payment_info: 'AddPaymentInfo', purchase: 'Purchase' };

export function bao(ten: string, v: { value: number; items: MonDo[]; transaction_id?: string }) {
  const w = window as W;
  w.gtag?.('event', ten, { currency: 'USD', ...v });
  const fb = FB[ten];
  if (fb) w.fbq?.('track', fb, { currency: 'USD', value: v.value, content_type: 'product', content_ids: v.items.map((i) => i.item_id),
    contents: v.items.map((i) => ({ id: i.item_id, quantity: i.quantity })), num_items: v.items.reduce((t, i) => t + i.quantity, 0) },
    v.transaction_id ? { eventID: `don-${v.transaction_id}` } : undefined);
}
