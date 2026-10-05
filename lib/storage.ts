import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 in staging/prod, Adobe S3Mock locally — identical S3-compatible calls.
// Local is the default. Set STORAGE=r2 (with R2_* vars) to target Cloudflare.
export function storageMode(): "local" | "r2" {
  return process.env.STORAGE === "r2" ? "r2" : "local";
}

function r2Endpoint(): string {
  const direct = process.env.R2_ENDPOINT;
  if (direct && !direct.includes("<account-id>")) return direct;
  const account = process.env.R2_ACCOUNT_ID;
  if (!account) throw new Error("R2_ACCOUNT_ID is not set (or R2_ENDPOINT). Add R2 keys to .env.");
  return `https://${account}.r2.cloudflarestorage.com`;
}

const useR2 = storageMode() === "r2";
const endpoint = useR2
  ? r2Endpoint()
  : process.env.S3_ENDPOINT_LOCAL || "http://localhost:9090";
const bucket = useR2
  ? process.env.R2_BUCKET || "crediscout-documents"
  : process.env.S3_BUCKET_LOCAL || "crediscout-documents";

const s3 = new S3Client({
  endpoint,
  region: useR2 ? "auto" : "us-east-1",
  credentials: {
    accessKeyId:
      (useR2 ? process.env.R2_ACCESS_KEY_ID : undefined) ||
      process.env.AWS_ACCESS_KEY_ID ||
      "test",
    secretAccessKey:
      (useR2 ? process.env.R2_SECRET_ACCESS_KEY : undefined) ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      "test",
  },
  forcePathStyle: true,
});

let bucketReady = false;

export async function ensureBucket() {
  if (bucketReady) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  bucketReady = true;
}

export function storageInfo() {
  return { mode: storageMode(), endpoint, bucket };
}

// Upload any file (documents, CAC, collateral photos, statements).
export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return { key, bucket };
}

// Short-lived download link (default 15 minutes). Prefer the ownership-checked
// /api/documents/[id] route for in-app downloads; use this for sharing.
export async function getFileUrl(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export async function deleteFile(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function putDocument(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

function toWebStream(source: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const it = source[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await it.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      await it.return?.();
    },
  });
}

export async function getDocument(key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body as unknown;
  // AWS SDK v3 yields a Node Readable on the server — pump it into a web stream.
  const stream =
    body instanceof ReadableStream
      ? body
      : toWebStream(body as AsyncIterable<Uint8Array>);
  return {
    stream,
    contentType: res.ContentType ?? "application/octet-stream",
    size: res.ContentLength ?? undefined,
  };
}
