import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.bucketName = process.env.R2_BUCKET_NAME || 'catalogo-flash';
    this.publicUrl = process.env.R2_PUBLIC_URL || 'https://pub-26ae5bdf8e824fa9b97c006a492c69b4.r2.dev';

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async uploadFile(buffer: Buffer, key: string, contentType: string = 'image/webp'): Promise<{ url: string; key: string }> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = this.publicUrl ? `${this.publicUrl}/${key}` : `/${key}`;
    return { url, key };
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  }
}
