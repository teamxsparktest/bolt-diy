import { createScopedLogger } from '~/utils/logger';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { CloudflareStorage } from './cloudflare-storage';
import { getCloudflareContext } from '~/root';

const logger = createScopedLogger('CloudflareFileManager');

export interface FileMetadata {
  id: string;
  chatId?: string;
  path: string;
  contentType?: string;
  size: number;
  timestamp: string;
  metadata?: Record<string, string>;
}

export class CloudflareFileManager {
  private storage: CloudflareStorage;
  private db: D1Database;

  constructor(storage: CloudflareStorage, db: D1Database) {
    this.storage = storage;
    this.db = db;
  }

  /**
   * Store a file in R2 and record its metadata in D1
   * @param fileData - The file data to store
   * @param path - The file path/name
   * @param chatId - Optional chat ID to associate with the file
   * @param contentType - Optional content type
   * @param metadata - Optional additional metadata
   * @returns Promise resolving to the file ID
   */
  async storeFile(
    fileData: string | ArrayBuffer | Uint8Array,
    path: string,
    chatId?: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      // Generate a unique ID for the file
      const id = crypto.randomUUID();

      // Store the file in R2
      await this.storage.storeFile(id, fileData, {
        ...metadata,
        path,
        contentType,
        chatId,
      });

      // Get the file size
      let size = 0;
      if (typeof fileData === 'string') {
        size = new TextEncoder().encode(fileData).length;
      } else if (fileData instanceof ArrayBuffer) {
        size = fileData.byteLength;
      } else {
        size = fileData.byteLength;
      }

      // Record the file metadata in D1
      const timestamp = new Date().toISOString();
      const metadataStr = metadata ? JSON.stringify(metadata) : null;

      await this.db.prepare(`
        INSERT INTO files (id, chatId, path, contentType, size, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, chatId || null, path, contentType || null, size, timestamp, metadataStr)
      .run();

      logger.debug(`File stored successfully: ${id} (${path})`);
      return id;
    } catch (error) {
      logger.error(`Failed to store file: ${path}`, error);
      throw error;
    }
  }

  /**
   * Retrieve a file by its ID
   * @param id - The file ID
   * @returns Promise resolving to the file data or null if not found
   */
  async getFile(id: string): Promise<ArrayBuffer | null> {
    try {
      return await this.storage.getFile(id);
    } catch (error) {
      logger.error(`Failed to get file: ${id}`, error);
      throw error;
    }
  }

  /**
   * Retrieve a file as text by its ID
   * @param id - The file ID
   * @returns Promise resolving to the file content as string or null if not found
   */
  async getFileAsText(id: string): Promise<string | null> {
    try {
      return await this.storage.getFileAsText(id);
    } catch (error) {
      logger.error(`Failed to get file as text: ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete a file by its ID
   * @param id - The file ID
   * @returns Promise resolving when the file is deleted
   */
  async deleteFile(id: string): Promise<void> {
    try {
      // Delete from R2
      await this.storage.deleteFile(id);

      // Delete from D1
      await this.db.prepare('DELETE FROM files WHERE id = ?')
        .bind(id)
        .run();

      logger.debug(`File deleted successfully: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete file: ${id}`, error);
      throw error;
    }
  }

  /**
   * Get file metadata by ID
   * @param id - The file ID
   * @returns Promise resolving to the file metadata or null if not found
   */
  async getFileMetadata(id: string): Promise<FileMetadata | null> {
    try {
      const { results } = await this.db.prepare('SELECT * FROM files WHERE id = ?')
        .bind(id)
        .all();

      if (results.length === 0) {
        return null;
      }

      const row = results[0];
      return {
        id: row.id,
        chatId: row.chatId,
        path: row.path,
        contentType: row.contentType,
        size: row.size,
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      };
    } catch (error) {
      logger.error(`Failed to get file metadata: ${id}`, error);
      throw error;
    }
  }

  /**
   * List files for a chat
   * @param chatId - The chat ID
   * @returns Promise resolving to an array of file metadata
   */
  async listFilesForChat(chatId: string): Promise<FileMetadata[]> {
    try {
      const { results } = await this.db.prepare('SELECT * FROM files WHERE chatId = ? ORDER BY timestamp DESC')
        .bind(chatId)
        .all();

      return results.map((row: any) => ({
        id: row.id,
        chatId: row.chatId,
        path: row.path,
        contentType: row.contentType,
        size: row.size,
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      logger.error(`Failed to list files for chat: ${chatId}`, error);
      throw error;
    }
  }

  /**
   * Search files by path pattern
   * @param pathPattern - The path pattern to search for (SQL LIKE pattern)
   * @returns Promise resolving to an array of file metadata
   */
  async searchFilesByPath(pathPattern: string): Promise<FileMetadata[]> {
    try {
      const { results } = await this.db.prepare('SELECT * FROM files WHERE path LIKE ? ORDER BY timestamp DESC')
        .bind(`%${pathPattern}%`)
        .all();

      return results.map((row: any) => ({
        id: row.id,
        chatId: row.chatId,
        path: row.path,
        contentType: row.contentType,
        size: row.size,
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      logger.error(`Failed to search files by path: ${pathPattern}`, error);
      throw error;
    }
  }
}

/**
 * Create a CloudflareFileManager instance using the current context
 * @returns CloudflareFileManager instance or null if not running on Cloudflare
 */
export function createFileManager(): CloudflareFileManager | null {
  const cfContext = getCloudflareContext();
  if (!cfContext) {
    return null;
  }

  return new CloudflareFileManager(cfContext.getStorage(), cfContext.getDatabase());
}
