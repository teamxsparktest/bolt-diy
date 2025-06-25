import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { getCloudflareContext } from '~/root';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.api-keys');

// Default user ID for now - in a real app, this would come from authentication
const DEFAULT_USER_ID = 'default';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Check if we're running on Cloudflare
    const cfContext = getCloudflareContext();

    if (!cfContext) {
      return json({ error: 'KV storage not available' }, { status: 500 });
    }

    // Get API keys for the user
    const apiKeys = await cfContext.getApiKeys(DEFAULT_USER_ID) || {};

    // Return masked API keys (only show first 4 and last 4 characters)
    const maskedKeys: Record<string, string> = {};

    for (const [provider, key] of Object.entries(apiKeys)) {
      if (key.length > 8) {
        maskedKeys[provider] = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
      } else {
        maskedKeys[provider] = '********';
      }
    }

    return json({
      success: true,
      providers: Object.keys(apiKeys),
      maskedKeys
    });
  } catch (error) {
    logger.error('Error retrieving API keys:', error);
    return json({ error: 'Failed to retrieve API keys' }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Check if we're running on Cloudflare
    const cfContext = getCloudflareContext();

    if (!cfContext) {
      return json({ error: 'KV storage not available' }, { status: 500 });
    }

    if (request.method === 'POST') {
      // Add or update API key
      const { provider, apiKey } = await request.json();

      if (!provider || !apiKey) {
        return json({ error: 'Provider and API key are required' }, { status: 400 });
      }

      // Get existing API keys
      const existingKeys = await cfContext.getApiKeys(DEFAULT_USER_ID) || {};

      // Update the key
      existingKeys[provider] = apiKey;

      // Save back to KV
      await cfContext.storeApiKeys(DEFAULT_USER_ID, existingKeys);

      return json({
        success: true,
        message: `API key for ${provider} saved successfully`
      });
    } else if (request.method === 'DELETE') {
      // Delete API key
      const { provider } = await request.json();

      if (!provider) {
        return json({ error: 'Provider is required' }, { status: 400 });
      }

      // Get existing API keys
      const existingKeys = await cfContext.getApiKeys(DEFAULT_USER_ID) || {};

      // Remove the key
      if (existingKeys[provider]) {
        delete existingKeys[provider];

        // Save back to KV
        await cfContext.storeApiKeys(DEFAULT_USER_ID, existingKeys);

        return json({
          success: true,
          message: `API key for ${provider} deleted successfully`
        });
      } else {
        return json({ error: `No API key found for ${provider}` }, { status: 404 });
      }
    }

    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    logger.error('Error managing API keys:', error);
    return json({ error: 'Failed to manage API keys' }, { status: 500 });
  }
}
