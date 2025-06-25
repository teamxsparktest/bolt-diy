import { createScopedLogger } from '~/utils/logger';
import type { R2Bucket } from '@cloudflare/workers-types';

const logger = createScopedLogger('CloudflareStorage');

export class CloudflareStorage {
  private bucket: R2Bucket;
  private prefix: string;

  constructor(bucket: R2Bucket, prefix: string = '') {
    this.bucket = bucket;
    this.prefix = prefix;
  }

  /**
   * Store a file in R2 storage
   * @param key - The unique identifier for the file
   * @param data - The file data (string, ArrayBuffer, etc.)
   * @param metadata - Optional metadata to store with the file
   * @returns Promise resolving to the R2 object key
   */
  async storeFile(key: string, data: string | ArrayBuffer | Uint8Array, metadata?: Record<string, string>): Promise<string> {
    try {
      const fullKey = this.getFullKey(key);

      await this.bucket.put(fullKey, data, {
        customMetadata: metadata,
      });

      logger.debug(`File stored successfully: ${fullKey}`);
      return fullKey;
    } catch (error) {
      logger.error(`Failed to store file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieve a file from R2 storage
   * @param key - The unique identifier for the file
   * @returns Promise resolving to the file data or null if not found
   */
  async getFile(key: string): Promise<ArrayBuffer | null> {
    try {
      const fullKey = this.getFullKey(key);
      const object = await this.bucket.get(fullKey);

      if (!object) {
        logger.debug(`File not found: ${fullKey}`);
        return null;
      }

      return await object.arrayBuffer();
    } catch (error) {
      logger.error(`Failed to get file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieve a file as text from R2 storage
   * @param key - The unique identifier for the file
   * @returns Promise resolving to the file content as string or null if not found
   */
  async getFileAsText(key: string): Promise<string | null> {
    try {
      const fullKey = this.getFullKey(key);
      const object = await this.bucket.get(fullKey);

      if (!object) {
        logger.debug(`File not found: ${fullKey}`);
        return null;
      }

      return await object.text();
    } catch (error) {
      logger.error(`Failed to get file as text: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete a file from R2 storage
   * @param key - The unique identifier for the file
   * @returns Promise resolving when the file is deleted
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.bucket.delete(fullKey);
      logger.debug(`File deleted successfully: ${fullKey}`);
    } catch (error) {
      logger.error(`Failed to delete file: ${key}`, error);
      throw error;
    }
  }

  /**
   * List files in R2 storage with an optional prefix
   * @param prefix - Optional prefix to filter files
   * @param limit - Maximum number of files to return
   * @returns Promise resolving to an array of file keys
   */
  async listFiles(prefix: string = '', limit: number = 1000): Promise<string[]> {
    try {
      const fullPrefix = this.getFullKey(prefix);
      const listed = await this.bucket.list({
        prefix: fullPrefix,
        limit,
      });

      return listed.objects.map(obj => obj.key.replace(this.prefix, ''));
    } catch (error) {
      logger.error(`Failed to list files with prefix: ${prefix}`, error);
      throw error;
    }
  }

  /**
   * Get metadata for a file in R2 storage
   * @param key - The unique identifier for the file
   * @returns Promise resolving to the file metadata or null if not found
   */
  async getFileMetadata(key: string): Promise<Record<string, string> | null> {
    try {
      const fullKey = this.getFullKey(key);
      const object = await this.bucket.head(fullKey);

      if (!object) {
        logger.debug(`File not found: ${fullKey}`);
        return null;
      }

      return object.customMetadata;
    } catch (error) {
      logger.error(`Failed to get file metadata: ${key}`, error);
      throw error;
    }
  }

  /**
   * Update metadata for a file in R2 storage
   * @param key - The unique identifier for the file
   * @param metadata - The new metadata to set
   * @returns Promise resolving when the metadata is updated
   */
  async updateFileMetadata(key: string, metadata: Record<string, string>): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const object = await this.bucket.get(fullKey);

      if (!object) {
        logger.error(`File not found for metadata update: ${fullKey}`);
        throw new Error(`File not found: ${fullKey}`);
      }

      // We need to re-upload the file with the new metadata
      await this.bucket.put(fullKey, await object.arrayBuffer(), {
        customMetadata: metadata,
      });

      logger.debug(`File metadata updated successfully: ${fullKey}`);
    } catch (error) {
      logger.error(`Failed to update file metadata: ${key}`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists in R2 storage
   * @param key - The unique identifier for the file
   * @returns Promise resolving to true if the file exists, false otherwise
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const object = await this.bucket.head(fullKey);
      return object !== null;
    } catch (error) {
      logger.error(`Failed to check if file exists: ${key}`, error);
      return false;
    }
  }

  /**
   * Generate a full key by combining the prefix with the provided key
   * @param key - The key to combine with the prefix
   * @returns The full key
   */
  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}/${key}`.replace(/\/+/g, '/') : key;
  }
}
