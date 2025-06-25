import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { getCloudflareContext } from '~/root';
import { createScopedLogger } from '~/utils/logger';
import { createFileManager } from '~/lib/persistence/cloudflare-file-manager';

const logger = createScopedLogger('api.file-upload');

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Check if we're running on Cloudflare
    const cfContext = getCloudflareContext();
    const fileManager = createFileManager();

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chatId = formData.get('chatId') as string;

    if (!file) {
      return json({ error: 'No file provided' }, { status: 400 });
    }

    // Get file data
    const fileData = await file.arrayBuffer();
    const fileName = file.name;
    const contentType = file.type;

    // Store the file
    let fileId: string;

    if (fileManager) {
      // Store in Cloudflare R2
      logger.debug(`Storing file in Cloudflare R2: ${fileName}`);
      fileId = await fileManager.storeFile(
        fileData,
        fileName,
        chatId || undefined,
        contentType
      );

      logger.debug(`File stored in Cloudflare R2 with ID: ${fileId}`);
    } else {
      // Fallback to local storage or other methods
      // For now, just return an error
      return json({ error: 'File storage not available' }, { status: 500 });
    }

    return json({
      success: true,
      fileId,
      fileName,
      contentType,
      size: fileData.byteLength,
      chatId: chatId || undefined
    });
  } catch (error) {
    logger.error('Error uploading file:', error);
    return json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

export async function loader() {
  // Return a 405 Method Not Allowed for GET requests
  return json({ error: 'Method not allowed' }, { status: 405 });
}
