import { createScopedLogger } from '~/utils/logger';
import type { KVNamespace } from '@cloudflare/workers-types';

const logger = createScopedLogger('CloudflareKV');

export class CloudflareKVStore {
  private namespace: KVNamespace;
  private prefix: string;

  constructor(namespace: KVNamespace, prefix: string = '') {
    this.namespace = namespace;
    this.prefix = prefix;
  }

  /**
   * Store a value in KV
   * @param key - The key to store the value under
   * @param value - The value to store (will be JSON stringified)
   * @param options - Optional KV put options
   * @returns Promise resolving when the value is stored
   */
  async set<T>(key: string, value: T, options?: { expirationTtl?: number; expiration?: number }): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValue = JSON.stringify(value);

      await this.namespace.put(fullKey, serializedValue, options);
      logger.debug(`Value stored successfully: ${fullKey}`);
    } catch (error) {
      logger.error(`Failed to store value: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieve a value from KV
   * @param key - The key to retrieve
   * @returns Promise resolving to the value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.namespace.get(fullKey);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Failed to get value: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete a value from KV
   * @param key - The key to delete
   * @returns Promise resolving when the value is deleted
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.namespace.delete(fullKey);
      logger.debug(`Value deleted successfully: ${fullKey}`);
    } catch (error) {
      logger.error(`Failed to delete value: ${key}`, error);
      throw error;
    }
  }

  /**
   * List keys in KV with an optional prefix
   * @param prefix - Optional prefix to filter keys
   * @param limit - Maximum number of keys to return
   * @returns Promise resolving to an array of keys
   */
  async listKeys(prefix: string = '', limit: number = 1000): Promise<string[]> {
    try {
      const fullPrefix = this.getFullKey(prefix);
      const listed = await this.namespace.list({ prefix: fullPrefix, limit });

      return listed.keys.map(key => key.name.replace(this.prefix ? `${this.prefix}/` : '', ''));
    } catch (error) {
      logger.error(`Failed to list keys with prefix: ${prefix}`, error);
      throw error;
    }
  }

  /**
   * Store a session in KV
   * @param sessionId - The session ID
   * @param sessionData - The session data
   * @param expirationTtl - Session expiration time in seconds
   * @returns Promise resolving when the session is stored
   */
  async setSession(sessionId: string, sessionData: Record<string, any>, expirationTtl: number = 3600): Promise<void> {
    return this.set(`session:${sessionId}`, sessionData, { expirationTtl });
  }

  /**
   * Retrieve a session from KV
   * @param sessionId - The session ID
   * @returns Promise resolving to the session data or null if not found
   */
  async getSession(sessionId: string): Promise<Record<string, any> | null> {
    return this.get<Record<string, any>>(`session:${sessionId}`);
  }

  /**
   * Delete a session from KV
   * @param sessionId - The session ID
   * @returns Promise resolving when the session is deleted
   */
  async deleteSession(sessionId: string): Promise<void> {
    return this.delete(`session:${sessionId}`);
  }

  /**
   * Store a value in cache
   * @param cacheKey - The cache key
   * @param value - The value to cache
   * @param expirationTtl - Cache expiration time in seconds
   * @returns Promise resolving when the value is cached
   */
  async setCache<T>(cacheKey: string, value: T, expirationTtl: number = 300): Promise<void> {
    return this.set(`cache:${cacheKey}`, value, { expirationTtl });
  }

  /**
   * Retrieve a value from cache
   * @param cacheKey - The cache key
   * @returns Promise resolving to the cached value or null if not found
   */
  async getCache<T>(cacheKey: string): Promise<T | null> {
    return this.get<T>(`cache:${cacheKey}`);
  }

  /**
   * Delete a value from cache
   * @param cacheKey - The cache key
   * @returns Promise resolving when the cached value is deleted
   */
  async deleteCache(cacheKey: string): Promise<void> {
    return this.delete(`cache:${cacheKey}`);
  }

  /**
   * Store API keys in KV
   * @param userId - The user ID
   * @param apiKeys - The API keys to store
   * @returns Promise resolving when the API keys are stored
   */
  async setApiKeys(userId: string, apiKeys: Record<string, string>): Promise<void> {
    return this.set(`apikeys:${userId}`, apiKeys);
  }

  /**
   * Retrieve API keys from KV
   * @param userId - The user ID
   * @returns Promise resolving to the API keys or null if not found
   */
  async getApiKeys(userId: string): Promise<Record<string, string> | null> {
    return this.get<Record<string, string>>(`apikeys:${userId}`);
  }

  /**
   * Generate a full key by combining the prefix with the provided key
   * @param key - The key to combine with the prefix
   * @returns The full key
   */
  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }
}
