import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client, getR2BucketName } from "./client.ts";

/**
 * Generates a presigned PUT URL that the server can hand to the browser for
 * a direct, time-limited upload to R2. The URL expires in 10 minutes.
 *
 * Only the server calls this function. The browser receives only the URL.
 *
 * @param objectKey  The full key (path) the object will be stored at.
 * @param contentType MIME type validated server-side before URL generation.
 * @returns Presigned URL string.
 */
export async function generatePresignedUploadUrl(
  objectKey: string,
  contentType: string
): Promise<string> {
  const client = createR2Client();
  const bucket = getR2BucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 600 });
}

/**
 * Uploads an object directly to the private R2 bucket from the server.
 * Used for server-side order snapshots (order.json) and generated invoices (invoice.pdf).
 *
 * @param objectKey   The full key (path) the object will be stored at.
 * @param body        The object body (Buffer, Uint8Array, or string).
 * @param contentType The MIME content type.
 */
export async function putR2Object(
  objectKey: string,
  body: Uint8Array | Buffer | string,
  contentType: string
): Promise<void> {
  const client = createR2Client();
  const bucket = getR2BucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Generates a presigned GET URL that allows time-limited, authenticated
 * read access to a private R2 object without making the bucket public.
 *
 * Only the server calls this function. The URL is forwarded to the browser.
 *
 * @param objectKey  The full key (path) of the object to read.
 * @param expiresInSeconds  Defaults to 3600 (1 hour).
 * @returns Presigned URL string.
 */
export async function generatePresignedReadUrl(
  objectKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = createR2Client();
  const bucket = getR2BucketName();

  // Import GetObjectCommand lazily to keep the module clean
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Retrieves an object's bytes and metadata directly from the private R2 bucket.
 * Used by the server-side image optimization pipeline to avoid redirecting clients
 * to multi-megabyte raw originals.
 *
 * @param objectKey The full key (path) of the object to retrieve.
 */
export async function getR2Object(
  objectKey: string,
  ifNoneMatch?: string
): Promise<{
  body?: Uint8Array;
  contentType?: string;
  etag?: string;
  contentLength?: number;
  isNotModified?: boolean;
}> {
  const client = createR2Client();
  const bucket = getR2BucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    IfNoneMatch: ifNoneMatch
      ? `"${ifNoneMatch.replace(/^W\//, "").replace(/"/g, "")}"`
      : undefined,
  });

  try {
    const response = await client.send(command);
    if (!response.Body) {
      throw new Error(`Empty body returned for object ${objectKey}`);
    }

    const body = await response.Body.transformToByteArray();
    return {
      body,
      contentType: response.ContentType,
      etag: response.ETag?.replace(/"/g, ""),
      contentLength: response.ContentLength,
    };
  } catch (err: unknown) {
    const errorObj = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (errorObj?.name === "304" || errorObj?.$metadata?.httpStatusCode === 304) {
      return {
        isNotModified: true,
        etag: ifNoneMatch?.replace(/^W\//, "").replace(/"/g, ""),
      };
    }
    throw err;
  }
}

/**
 * Deletes a single object from the private R2 bucket.
 * Used when a single image is removed from a product.
 *
 * @param objectKey  The full key (path) of the object to delete.
 */
export async function deleteR2Object(objectKey: string): Promise<void> {
  const client = createR2Client();
  const bucket = getR2BucketName();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
}

/**
 * Deletes multiple objects from the private R2 bucket in a single request.
 * Used when an entire product and all its images are removed.
 *
 * Silently ignores keys that do not exist in R2 (idempotent).
 *
 * @param objectKeys  Array of full object keys to delete.
 */
export async function deleteR2Objects(objectKeys: string[]): Promise<void> {
  if (objectKeys.length === 0) return;

  const client = createR2Client();
  const bucket = getR2BucketName();

  // R2 (via S3 API) allows up to 1000 objects per delete request
  const BATCH_SIZE = 1000;

  for (let i = 0; i < objectKeys.length; i += BATCH_SIZE) {
    const batch = objectKeys.slice(i, i + BATCH_SIZE);

    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );
  }
}

/**
 * Lists objects in the private R2 bucket matching a specified key prefix.
 * Used for administrative inspection and cleanup of test runs (e.g. "test-uploads/").
 *
 * @param prefix  The key prefix filter (e.g. "test-uploads/").
 * @param maxKeys Maximum number of keys to return (default: 100).
 */
export async function listR2ObjectsByPrefix(
  prefix: string,
  maxKeys = 100
): Promise<Array<{ key: string; size?: number; lastModified?: Date }>> {
  const client = createR2Client();
  const bucket = getR2BucketName();

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await client.send(command);
  return (
    response.Contents?.map((item) => ({
      key: item.Key || "",
      size: item.Size,
      lastModified: item.LastModified,
    })).filter((item) => item.key.length > 0) || []
  );
}

