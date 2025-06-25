import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { getCloudflareContext } from '~/root';
import { createScopedLogger } from '~/utils/logger';
import { createFileManager } from '~/lib/persistence/cloudflare-file-manager';

const logger = createScopedLogger('api.search-files');

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (!query) {
      return json({ error: 'Search query is required' }, { status: 400 });
    }

    // Check if we're running on Cloudflare
    const fileManager = createFileManager();

    if (!fileManager) {
      return json({ error: 'File storage not available' }, { status: 500 });
    }

    // Search files by path pattern
    const files = await fileManager.searchFilesByPath(query);

    return json({
      success: true,
      query,
      files,
      count: files.length
    });
  } catch (error) {
    logger.error('Error searching files:', error);
    return json({ error: 'Failed to search files' }, { status: 500 });
  }
}
