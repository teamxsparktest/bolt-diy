-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  urlId TEXT UNIQUE,
  messages TEXT NOT NULL,
  description TEXT,
  timestamp TEXT NOT NULL,
  metadata TEXT
);

-- Create index on urlId for faster lookups
CREATE INDEX IF NOT EXISTS idx_chats_urlId ON chats(urlId);

-- Create snapshots table with foreign key reference to chats
CREATE TABLE IF NOT EXISTS snapshots (
  chatId TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
);

-- Create files table for tracking files stored in R2
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  chatId TEXT,
  path TEXT NOT NULL,
  contentType TEXT,
  size INTEGER,
  timestamp TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
);

-- Create index on chatId for faster lookups
CREATE INDEX IF NOT EXISTS idx_files_chatId ON files(chatId);

-- Create sessions table for user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  userId TEXT,
  data TEXT NOT NULL,
  expires INTEGER NOT NULL
);

-- Create users table for user management
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  createdAt TEXT NOT NULL,
  lastLogin TEXT,
  settings TEXT
);

-- Create api_keys table for storing user API keys
CREATE TABLE IF NOT EXISTS api_keys (
  userId TEXT NOT NULL,
  provider TEXT NOT NULL,
  apiKey TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (userId, provider),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default user for testing
INSERT OR IGNORE INTO users (id, username, email, createdAt, settings)
VALUES ('default', 'default', 'default@example.com', datetime('now'), '{}');
