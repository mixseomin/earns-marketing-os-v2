import 'server-only';
import { createHash, createHmac } from 'node:crypto';

// Cloudflare R2 (S3-compatible) upload — SigV4 ký thủ công, KHÔNG thêm
// dep aws-sdk. Trả public URL (qua custom domain img.on.tc) hoặc null
// nếu chưa cấu hình env / lỗi → caller fallback về data URL.
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//      R2_BUCKET, R2_PUBLIC_BASE (vd https://img.on.tc)

export function r2Enabled(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE,
  );
}

const sha256hex = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();

// Delete an object by key (SigV4 DELETE). Best-effort — returns true on 2xx/404.
export async function deleteFromR2(key: string): Promise<boolean> {
  if (!r2Enabled()) return false;
  const acct = process.env.R2_ACCOUNT_ID!;
  const ak = process.env.R2_ACCESS_KEY_ID!;
  const sk = process.env.R2_SECRET_ACCESS_KEY!;
  const bucket = process.env.R2_BUCKET!;
  const host = `${acct}.r2.cloudflarestorage.com`;
  const region = 'auto'; const service = 's3';
  const encKey = key.split('/').map(encodeURIComponent).join('/');
  const canonicalUri = `/${bucket}/${encKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex('');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `DELETE\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256hex(canonicalRequest)}`;
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${sk}`, dateStamp), region), service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  try {
    const res = await fetch(`https://${host}${canonicalUri}`, { method: 'DELETE', headers: { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: authorization } });
    return res.ok || res.status === 404;
  } catch { return false; }
}

/** Liệt kê object theo tiền tố (ListObjectsV2, SigV4 GET, tự lật trang) — cho script dọn ảnh render cũ. */
export async function listR2(prefix: string): Promise<{ key: string; size: number }[]> {
  if (!r2Enabled()) return [];
  const acct = process.env.R2_ACCOUNT_ID!; const ak = process.env.R2_ACCESS_KEY_ID!; const sk = process.env.R2_SECRET_ACCESS_KEY!; const bucket = process.env.R2_BUCKET!;
  const host = `${acct}.r2.cloudflarestorage.com`; const region = 'auto'; const service = 's3';
  const enc = (x: string) => encodeURIComponent(x).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const out: { key: string; size: number }[] = []; let token = '';
  for (let lan = 0; lan < 200; lan++) {
    const q: [string, string][] = [['list-type', '2'], ['prefix', prefix], ...(token ? [['continuation-token', token] as [string, string]] : [])];
    const qs = q.sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
    const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256hex('');
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`; const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `GET\n/${bucket}\n${qs}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const scope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256hex(canonicalRequest)}`;
    const kSigning = hmac(hmac(hmac(hmac(`AWS4${sk}`, dateStamp), region), service), 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    const res = await fetch(`https://${host}/${bucket}?${qs}`, { headers: { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` } });
    if (!res.ok) throw new Error(`R2 list ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)) out.push({ key: m[1]!.replace(/&amp;/g, '&'), size: Number(m[2]) });
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? '') : '';
    if (!token) break;
  }
  return out;
}

export function r2KeyFromUrl(url: string): string | null {
  const pub = (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '');
  if (!pub || !url.startsWith(pub + '/')) return null;
  return url.slice(pub.length + 1).split('/').map(decodeURIComponent).join('/');
}

/** Đẩy một tệp lên R2 — THỬ LẠI 4 lần (1s / 3s / 9s): ảnh vừa trả tiền mà mạng chập một nhịp thì mất luôn (18/10/2026 #20: FLUX vẽ xong, box chập
 *  mạng, "không đẩy được ảnh bước 1 lên kho" — tiền mất, ảnh mất). Chữ ký tính lại mỗi lần (x-amz-date). */
export async function uploadToR2(
  key: string, body: Buffer, contentType: string,
): Promise<string | null> {
  if (!r2Enabled()) return null;
  for (let lan = 0; lan < 4; lan++) {
    if (lan) await new Promise((o) => setTimeout(o, 1000 * 3 ** (lan - 1)));
    const url = await uploadToR2Mot(key, body, contentType);
    if (url) return url;
  }
  return null;
}
async function uploadToR2Mot(
  key: string, body: Buffer, contentType: string,
): Promise<string | null> {
  if (!r2Enabled()) return null;
  const acct = process.env.R2_ACCOUNT_ID!;
  const ak = process.env.R2_ACCESS_KEY_ID!;
  const sk = process.env.R2_SECRET_ACCESS_KEY!;
  const bucket = process.env.R2_BUCKET!;
  const pub = process.env.R2_PUBLIC_BASE!.replace(/\/+$/, '');
  const host = `${acct}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  // path-style: /<bucket>/<key> ; encode từng segment của key
  const encKey = key.split('/').map(encodeURIComponent).join('/');
  const canonicalUri = `/${bucket}/${encKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest =
    `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256hex(canonicalRequest)}`;

  const kDate = hmac(`AWS4${sk}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}${canonicalUri}`, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      console.error('[r2] upload failed', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return `${pub}/${encKey}`;
  } catch (e) {
    console.error('[r2] upload error', (e as Error).message);
    return null;
  }
}
