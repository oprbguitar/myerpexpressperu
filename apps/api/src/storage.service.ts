import { Injectable } from "@nestjs/common";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import type { DocumentStorage, StoredDocument } from "@erp/contracts";

@Injectable()
export class StorageService implements DocumentStorage {
  private readonly client = new S3Client({
    region: process.env.STORAGE_REGION ?? "us-east-1",
    forcePathStyle: true,
    ...(process.env.STORAGE_ENDPOINT ? { endpoint: process.env.STORAGE_ENDPOINT } : {}),
    ...(process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_SECRET_KEY
      ? { credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY, secretAccessKey: process.env.STORAGE_SECRET_KEY } }
      : {})
  });
  private readonly bucket = process.env.STORAGE_BUCKET ?? "erp-private";

  async put(input: { key: string; body: Uint8Array; contentType: string }): Promise<StoredDocument> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: input.key, Body: input.body, ContentType: input.contentType
    }));
    return {
      key: input.key, size: input.body.byteLength, contentType: input.contentType,
      sha256: createHash("sha256").update(input.body).digest("hex")
    };
  }

  createAuthorizedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds }
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
