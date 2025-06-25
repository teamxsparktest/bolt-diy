export * from './localStorage';
export * from './db';
export * from './useChatHistory';
export * from './types';

// Export Cloudflare-based persistence
export * from './cloudflare-context';
export * as CloudflareDB from './cloudflare-db';
export * from './cloudflare-kv';
export * from './cloudflare-storage';
export * from './cloudflare-file-manager';

// Helper function to determine if we're running on Cloudflare
export function isCloudflare(): boolean {
  return typeof globalThis.caches !== 'undefined' &&
         typeof (globalThis as any).BOLT_DB !== 'undefined' &&
         typeof (globalThis as any).BOLT_CACHE !== 'undefined' &&
         typeof (globalThis as any).BOLT_STORAGE !== 'undefined';
}
