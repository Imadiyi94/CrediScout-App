import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

// R2 in staging/prod, Adobe S3Mock locally — identical S3-compatible calls.
// Local is the default. Set STORAGE=r2 (with R2_* vars) to target Cloudflare.
const useR2 = process.env.STORAGE === "r2";
const endpoint = useR2
  ? process.env.R2_ENDPOINT!
  : process.env.S3_ENDPOINT_LOCAL || "http://localhost:9090";
const bucket = useR2
  ? process.env.R2_BUCKET!
  : process.env.S3_BUCKET_LOCAL || "crediscout-docs";

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
  return { endpoint, bucket };
}

export async function putDocument(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getDocument(key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return {
    stream: res.Body as unknown as ReadableStream,
    contentType: res.ContentType ?? "application/octet-stream",
    size: res.ContentLength ?? undefined,
  };
}
