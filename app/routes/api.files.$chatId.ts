import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { getCloudflareContext } from '~/root';
import { createScopedLogger } from '~/utils/logger';
import { createFileManager } from '~/lib/persistence/cloudflare-file-manager';

const logger = createScopedLogger('api.files');

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const chatId = params.chatId;

    if (!chatId) {
      return json({ error: 'Chat ID is required' }, { status: 400 });
    }

    // Check if we're running on Cloudflare
    const fileManager = createFileManager();

    if (!fileManager) {
      return json({ error: 'File storage not available' }, { status: 500 });
    }

    // Get files for the chat
    const files = await fileManager.listFilesForChat(chatId);

    return json({
      success: true,
      files,
      count: files.length
    });
  } catch (error) {
    logger.error('Error listing files:', error);
    return json({ error: 'Failed to list files' }, { status: 500 });
  }
}
