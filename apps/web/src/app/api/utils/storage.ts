// S3-compatible object storage (Cloudflare R2, AWS S3, MinIO) via SigV4
// query presigning — no SDK dependency needed. The source video lives here
// durably; AssemblyAI and platform publish APIs read it through presigned
// GET URLs.
//
// Env:
//   STORAGE_ENDPOINT          e.g. https://<account>.r2.cloudflarestorage.com
//   STORAGE_BUCKET            bucket name
//   STORAGE_ACCESS_KEY_ID
//   STORAGE_SECRET_ACCESS_KEY
//   STORAGE_REGION            optional, defaults to "auto" (R2)
import crypto from 'node:crypto';

interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export function getStorageConfig(): StorageConfig | null {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.STORAGE_REGION || 'auto',
  };
}

export function storageConfigured(): boolean {
  return getStorageConfig() !== null;
}

// Presigned GET URLs cap at 7 days (SigV4 limit).
export const MAX_PRESIGN_SECONDS = 7 * 24 * 3600;

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// RFC 3986 strict encoding (S3 canonical request requirement).
function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeKeyPath(key: string): string {
  return key.split('/').map(rfc3986Encode).join('/');
}

export function presignObjectUrl(
  method: 'GET' | 'PUT',
  key: string,
  expiresSec: number
): string {
  const cfg = getStorageConfig();
  if (!cfg) throw new Error('Object storage is not configured');

  const url = new URL(cfg.endpoint);
  const host = url.host;
  // Path-style addressing works across R2, S3, and MinIO.
  const canonicalUri = `/${cfg.bucket}/${encodeKeyPath(key)}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;

  const params: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${cfg.accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(Math.min(expiresSec, MAX_PRESIGN_SECONDS))],
    ['X-Amz-SignedHeaders', 'host'],
  ];
  const canonicalQuery = params
    .map(([k, v]) => `${rfc3986Encode(k)}=${rfc3986Encode(v)}`)
    .sort()
    .join('&');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp), cfg.region), 's3'),
    'aws4_request'
  );
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return `${cfg.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function presignUpload(key: string, expiresSec = 3600): string {
  return presignObjectUrl('PUT', key, expiresSec);
}

export function presignDownload(key: string, expiresSec = MAX_PRESIGN_SECONDS): string {
  return presignObjectUrl('GET', key, expiresSec);
}

// Object keys are generated server-side from a sanitized file name so user
// input can never traverse paths or break canonical signing.
export function buildObjectKey(userId: string, fileName: string, prefix = 'uploads'): string {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(-80);
  return `${prefix}/${userId}/${Date.now()}-${safeName || 'file'}`;
}
