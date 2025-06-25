import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { getCloudflareContext } from '~/root';
import { createScopedLogger } from '~/utils/logger';
import { createFileManager } from '~/lib/persistence/cloudflare-file-manager';

const logger = createScopedLogger('api.delete-file');

export async function action({ request, params }: ActionFunctionArgs) {
  // Only allow DELETE requests
  if (request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const fileId = params.id;

    if (!fileId) {
      return json({ error: 'File ID is required' }, { status: 400 });
    }

    // Check if we're running on Cloudflare
    const fileManager = createFileManager();

    if (!fileManager) {
      return json({ error: 'File storage not available' }, { status: 500 });
    }

    // Get file metadata to confirm it exists
    const metadata = await fileManager.getFileMetadata(fileId);

    if (!metadata) {
      return json({ error: 'File not found' }, { status: 404 });
    }

    // Delete the file
    await fileManager.deleteFile(fileId);

    return json({
      success: true,
      fileId,
      message: 'File deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting file:', error);
    return json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

export async function loader() {
  // Return a 405 Method Not Allowed for GET requests
  return json({ error: 'Method not allowed' }, { status: 405 });
}
