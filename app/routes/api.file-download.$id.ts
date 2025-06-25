import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getCloudflareContext } from '~/root';
import { createScopedLogger } from '~/utils/logger';
import { createFileManager } from '~/lib/persistence/cloudflare-file-manager';

const logger = createScopedLogger('api.file-download');

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const fileId = params.id;

    if (!fileId) {
      return new Response('File ID is required', { status: 400 });
    }

    // Check if we're running on Cloudflare
    const fileManager = createFileManager();

    if (!fileManager) {
      return new Response('File storage not available', { status: 500 });
    }

    // Get file metadata
    const metadata = await fileManager.getFileMetadata(fileId);

    if (!metadata) {
      return new Response('File not found', { status: 404 });
    }

    // Get file content
    const fileData = await fileManager.getFile(fileId);

    if (!fileData) {
      return new Response('File content not found', { status: 404 });
    }

    // Set appropriate headers
    const headers = new Headers();

    if (metadata.contentType) {
      headers.set('Content-Type', metadata.contentType);
    }

    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(metadata.path)}"`);
    headers.set('Content-Length', metadata.size.toString());

    // Return the file
    return new Response(fileData, {
      status: 200,
      headers
    });
  } catch (error) {
    logger.error('Error downloading file:', error);
    return new Response('Failed to download file', { status: 500 });
  }
}
