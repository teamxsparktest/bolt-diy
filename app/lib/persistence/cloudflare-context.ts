import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { CloudflareKVStore } from './cloudflare-kv';
import { CloudflareStorage } from './cloudflare-storage';
import { CloudflareFileManager } from './cloudflare-file-manager';
import * as CloudflareDB from './cloudflare-db';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CloudflareContext');

export interface CloudflareBindings {
  BOLT_DB: D1Database;
  BOLT_CACHE: KVNamespace;
  BOLT_STORAGE: R2Bucket;
}

export class CloudflareContext {
  private db: D1Database;
  private kv: CloudflareKVStore;
  private storage: CloudflareStorage;
  private fileManager: CloudflareFileManager;
  private initialized: boolean = false;

  constructor(bindings: CloudflareBindings) {
    this.db = bindings.BOLT_DB;
    this.kv = new CloudflareKVStore(bindings.BOLT_CACHE);
    this.storage = new CloudflareStorage(bindings.BOLT_STORAGE);
    this.fileManager = new CloudflareFileManager(this.storage, this.db);
  }

  /**
   * Initialize the Cloudflare context
   * This sets up the database schema and any other necessary initialization
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize database schema
      await CloudflareDB.initializeDatabase(this.db);
      this.initialized = true;
      logger.debug('Cloudflare context initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Cloudflare context', error);
      throw error;
    }
  }

  /**
   * Get the Cloudflare D1 database instance
   */
  getDatabase(): D1Database {
    return this.db;
  }

  /**
   * Get the Cloudflare KV store instance
   */
  getKVStore(): CloudflareKVStore {
    return this.kv;
  }

  /**
   * Get the Cloudflare R2 storage instance
   */
  getStorage(): CloudflareStorage {
    return this.storage;
  }

  /**
   * Get the Cloudflare file manager instance
   */
  getFileManager(): CloudflareFileManager {
    return this.fileManager;
  }

  /**
   * Get all chat history items
   */
  async getAllChats() {
    return CloudflareDB.getAll(this.db);
  }

  /**
   * Get chat messages by ID or URL ID
   */
  async getChatMessages(id: string) {
    return CloudflareDB.getMessages(this.db, id);
  }

  /**
   * Save chat messages
   */
  async saveChatMessages(
    id: string,
    messages: any[],
    urlId?: string,
    description?: string,
    timestamp?: string,
    metadata?: CloudflareDB.IChatMetadata,
  ) {
    return CloudflareDB.setMessages(this.db, id, messages, urlId, description, timestamp, metadata);
  }

  /**
   * Delete chat by ID
   */
  async deleteChat(id: string) {
    return CloudflareDB.deleteById(this.db, id);
  }

  /**
   * Create a new chat from messages
   */
  async createChat(description: string, messages: any[], metadata?: CloudflareDB.IChatMetadata) {
    return CloudflareDB.createChatFromMessages(this.db, description, messages, metadata);
  }

  /**
   * Update chat description
   */
  async updateChatDescription(id: string, description: string) {
    return CloudflareDB.updateChatDescription(this.db, id, description);
  }

  /**
   * Update chat metadata
   */
  async updateChatMetadata(id: string, metadata: CloudflareDB.IChatMetadata) {
    return CloudflareDB.updateChatMetadata(this.db, id, metadata);
  }

  /**
   * Get snapshot for a chat
   */
  async getChatSnapshot(chatId: string) {
    return CloudflareDB.getSnapshot(this.db, chatId);
  }

  /**
   * Save snapshot for a chat
   */
  async saveChatSnapshot(chatId: string, snapshot: any) {
    return CloudflareDB.setSnapshot(this.db, chatId, snapshot);
  }

  /**
   * Delete snapshot for a chat
   */
  async deleteChatSnapshot(chatId: string) {
    return CloudflareDB.deleteSnapshot(this.db, chatId);
  }

  /**
   * Store a file
   */
  async storeFile(
    path: string,
    data: string | ArrayBuffer | Uint8Array,
    chatId?: string,
    contentType?: string,
    metadata?: Record<string, string>
  ) {
    return this.fileManager.storeFile(data, path, chatId, contentType, metadata);
  }

  /**
   * Get a file by ID
   */
  async getFile(id: string) {
    return this.fileManager.getFile(id);
  }

  /**
   * Get a file as text by ID
   */
  async getFileAsText(id: string) {
    return this.fileManager.getFileAsText(id);
  }

  /**
   * Delete a file by ID
   */
  async deleteFile(id: string) {
    return this.fileManager.deleteFile(id);
  }

  /**
   * Get file metadata by ID
   */
  async getFileMetadata(id: string) {
    return this.fileManager.getFileMetadata(id);
  }

  /**
   * List files for a chat
   */
  async listFilesForChat(chatId: string) {
    return this.fileManager.listFilesForChat(chatId);
  }

  /**
   * Search files by path pattern
   */
  async searchFilesByPath(pathPattern: string) {
    return this.fileManager.searchFilesByPath(pathPattern);
  }

  /**
   * Store a session
   */
  async storeSession(sessionId: string, data: Record<string, any>, expirationTtl?: number) {
    return this.kv.setSession(sessionId, data, expirationTtl);
  }

  /**
   * Get a session
   */
  async getSession(sessionId: string) {
    return this.kv.getSession(sessionId);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string) {
    return this.kv.deleteSession(sessionId);
  }

  /**
   * Store API keys
   */
  async storeApiKeys(userId: string, apiKeys: Record<string, string>) {
    return this.kv.setApiKeys(userId, apiKeys);
  }

  /**
   * Get API keys
   */
  async getApiKeys(userId: string) {
    return this.kv.getApiKeys(userId);
  }

  /**
   * Store a cached value
   */
  async storeCache<T>(key: string, value: T, expirationTtl?: number) {
    return this.kv.setCache(key, value, expirationTtl);
  }

  /**
   * Get a cached value
   */
  async getCache<T>(key: string) {
    return this.kv.getCache<T>(key);
  }

  /**
   * Delete a cached value
   */
  async deleteCache(key: string) {
    return this.kv.deleteCache(key);
  }
}
