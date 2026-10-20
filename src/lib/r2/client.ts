import { S3Client } from "@aws-sdk/client-s3";

/**
 * Validates that all required Cloudflare R2 environment variables are present.
 * Throws a descriptive error — without revealing any credential values — if any
 * are missing.
 */
function getR2Config(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
} {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  const missing: string[] = [];
  if (!accountId) missing.push("R2_ACCOUNT_ID");
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
  if (!bucketName) missing.push("R2_BUCKET_NAME");

  if (missing.length > 0) {
    throw new Error(
      `Missing server-side environment variable(s): ${missing.join(", ")}. ` +
        "These must be set in .env.local and are never exposed to the browser."
    );
  }

  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucketName: bucketName!,
  };
}

/**
 * Returns the Cloudflare R2 bucket name from the environment.
 * Safe to call anywhere the full config is already validated.
 */
export function getR2BucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing R2_BUCKET_NAME environment variable.");
  }
  return bucketName;
}

/**
 * Creates an AWS S3-compatible client configured for Cloudflare R2.
 * The client is scoped to the Cloudflare account's R2 endpoint.
 *
 * This is SERVER-SIDE ONLY. The R2 secret access key must never be
 * sent to or used in any browser context.
 */
export function createR2Client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}
