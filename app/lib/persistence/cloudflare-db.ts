import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot } from './types';
import type { D1Database } from '@cloudflare/workers-types';

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

const logger = createScopedLogger('CloudflareDB');

// Initialize the database schema if needed
export async function initializeDatabase(db: D1Database): Promise<void> {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        urlId TEXT UNIQUE,
        messages TEXT NOT NULL,
        description TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        chatId TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
      );
    `);
    logger.debug('Database schema initialized');
  } catch (error) {
    logger.error('Failed to initialize database schema', error);
    throw error;
  }
}

export async function getAll(db: D1Database): Promise<ChatHistoryItem[]> {
  try {
    const { results } = await db.prepare('SELECT * FROM chats ORDER BY timestamp DESC').all();

    return results.map((row: any) => ({
      id: row.id,
      urlId: row.urlId,
      messages: JSON.parse(row.messages),
      description: row.description,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  } catch (error) {
    logger.error('Failed to get all chats', error);
    throw error;
  }
}

export async function setMessages(
  db: D1Database,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  try {
    if (timestamp && isNaN(Date.parse(timestamp))) {
      throw new Error('Invalid timestamp');
    }

    const finalTimestamp = timestamp ?? new Date().toISOString();
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    const messagesStr = JSON.stringify(messages);

    await db.prepare(`
      INSERT INTO chats (id, urlId, messages, description, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        messages = ?,
        urlId = COALESCE(?, urlId),
        description = COALESCE(?, description),
        timestamp = ?,
        metadata = COALESCE(?, metadata)
    `)
    .bind(
      id, urlId, messagesStr, description, finalTimestamp, metadataStr,
      messagesStr, urlId, description, finalTimestamp, metadataStr
    )
    .run();
  } catch (error) {
    logger.error('Failed to set messages', error);
    throw error;
  }
}

export async function getMessages(db: D1Database, id: string): Promise<ChatHistoryItem> {
  try {
    const byId = await getMessagesById(db, id);
    if (byId) return byId;

    return getMessagesByUrlId(db, id);
  } catch (error) {
    logger.error('Failed to get messages', error);
    throw error;
  }
}

export async function getMessagesByUrlId(db: D1Database, urlId: string): Promise<ChatHistoryItem> {
  try {
    const { results } = await db.prepare('SELECT * FROM chats WHERE urlId = ?').bind(urlId).all();

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    return {
      id: row.id,
      urlId: row.urlId,
      messages: JSON.parse(row.messages),
      description: row.description,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  } catch (error) {
    logger.error('Failed to get messages by URL ID', error);
    throw error;
  }
}

export async function getMessagesById(db: D1Database, id: string): Promise<ChatHistoryItem> {
  try {
    const { results } = await db.prepare('SELECT * FROM chats WHERE id = ?').bind(id).all();

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    return {
      id: row.id,
      urlId: row.urlId,
      messages: JSON.parse(row.messages),
      description: row.description,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  } catch (error) {
    logger.error('Failed to get messages by ID', error);
    throw error;
  }
}

export async function deleteById(db: D1Database, id: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM chats WHERE id = ?').bind(id).run();
    // Cascading delete will handle snapshot deletion
  } catch (error) {
    logger.error('Failed to delete chat', error);
    throw error;
  }
}

export async function getNextId(db: D1Database): Promise<string> {
  try {
    const { results } = await db.prepare('SELECT MAX(CAST(id AS INTEGER)) as maxId FROM chats').all();
    const highestId = results[0]?.maxId || 0;
    return String(+highestId + 1);
  } catch (error) {
    logger.error('Failed to get next ID', error);
    throw error;
  }
}

export async function getUrlId(db: D1Database, id: string): Promise<string> {
  try {
    const idList = await getUrlIds(db);

    if (!idList.includes(id)) {
      return id;
    } else {
      let i = 2;
      while (idList.includes(`${id}-${i}`)) {
        i++;
      }
      return `${id}-${i}`;
    }
  } catch (error) {
    logger.error('Failed to get URL ID', error);
    throw error;
  }
}

async function getUrlIds(db: D1Database): Promise<string[]> {
  try {
    const { results } = await db.prepare('SELECT urlId FROM chats WHERE urlId IS NOT NULL').all();
    return results.map((row: any) => row.urlId);
  } catch (error) {
    logger.error('Failed to get URL IDs', error);
    throw error;
  }
}

export async function forkChat(db: D1Database, chatId: string, messageId: string): Promise<string> {
  try {
    const chat = await getMessages(db, chatId);

    if (!chat) {
      throw new Error('Chat not found');
    }

    const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      throw new Error('Message not found');
    }

    const messages = chat.messages.slice(0, messageIndex + 1);

    return createChatFromMessages(
      db,
      chat.description ? `${chat.description} (fork)` : 'Forked chat',
      messages
    );
  } catch (error) {
    logger.error('Failed to fork chat', error);
    throw error;
  }
}

export async function duplicateChat(db: D1Database, id: string): Promise<string> {
  try {
    const chat = await getMessages(db, id);

    if (!chat) {
      throw new Error('Chat not found');
    }

    return createChatFromMessages(
      db,
      chat.description ? `${chat.description} (copy)` : 'Duplicated chat',
      chat.messages,
      chat.metadata
    );
  } catch (error) {
    logger.error('Failed to duplicate chat', error);
    throw error;
  }
}

export async function createChatFromMessages(
  db: D1Database,
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  try {
    const id = await getNextId(db);
    const urlId = await getUrlId(db, id);

    await setMessages(db, id, messages, urlId, description, undefined, metadata);

    return id;
  } catch (error) {
    logger.error('Failed to create chat from messages', error);
    throw error;
  }
}

export async function updateChatDescription(db: D1Database, id: string, description: string): Promise<void> {
  try {
    await db.prepare('UPDATE chats SET description = ? WHERE id = ?')
      .bind(description, id)
      .run();
  } catch (error) {
    logger.error('Failed to update chat description', error);
    throw error;
  }
}

export async function updateChatMetadata(
  db: D1Database,
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  try {
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    await db.prepare('UPDATE chats SET metadata = ? WHERE id = ?')
      .bind(metadataStr, id)
      .run();
  } catch (error) {
    logger.error('Failed to update chat metadata', error);
    throw error;
  }
}

export async function getSnapshot(db: D1Database, chatId: string): Promise<Snapshot | undefined> {
  try {
    const { results } = await db.prepare('SELECT data FROM snapshots WHERE chatId = ?')
      .bind(chatId)
      .all();

    if (results.length === 0) {
      return undefined;
    }

    return JSON.parse(results[0].data);
  } catch (error) {
    logger.error('Failed to get snapshot', error);
    throw error;
  }
}

export async function setSnapshot(db: D1Database, chatId: string, snapshot: Snapshot): Promise<void> {
  try {
    const snapshotStr = JSON.stringify(snapshot);

    await db.prepare(`
      INSERT INTO snapshots (chatId, data)
      VALUES (?, ?)
      ON CONFLICT (chatId) DO UPDATE SET data = ?
    `)
    .bind(chatId, snapshotStr, snapshotStr)
    .run();
  } catch (error) {
    logger.error('Failed to set snapshot', error);
    throw error;
  }
}

export async function deleteSnapshot(db: D1Database, chatId: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM snapshots WHERE chatId = ?')
      .bind(chatId)
      .run();
  } catch (error) {
    logger.error('Failed to delete snapshot', error);
    throw error;
  }
}
