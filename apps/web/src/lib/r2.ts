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

export async function uploadToR2(
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
