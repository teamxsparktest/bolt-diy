import React, { useState, useEffect, useCallback } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import type { ProviderInfo } from '~/types/model';
import Cookies from 'js-cookie';
import { useCloudflareApiKeys } from '~/lib/hooks/useCloudflareApiKeys';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('APIKeyManager');

interface APIKeyManagerProps {
  provider: ProviderInfo;
  apiKey: string;
  setApiKey: (key: string) => void;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
}

// cache which stores whether the provider's API key is set via environment variable
const providerEnvKeyStatusCache: Record<string, boolean> = {};

const apiKeyMemoizeCache: { [k: string]: Record<string, string> } = {};

export function getApiKeysFromCookies() {
  const storedApiKeys = Cookies.get('apiKeys');
  let parsedKeys: Record<string, string> = {};

  if (storedApiKeys) {
    parsedKeys = apiKeyMemoizeCache[storedApiKeys];

    if (!parsedKeys) {
      parsedKeys = apiKeyMemoizeCache[storedApiKeys] = JSON.parse(storedApiKeys);
    }
  }

  return parsedKeys;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const APIKeyManager: React.FC<APIKeyManagerProps> = ({ provider, apiKey, setApiKey }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [isEnvKeySet, setIsEnvKeySet] = useState(false);
  const { getApiKeys, saveApiKey, isLoading } = useCloudflareApiKeys();
  const [isCloudflareMode, setIsCloudflareMode] = useState(false);

  // Reset states and load saved key when provider changes
  useEffect(() => {
    // Try to load from Cloudflare KV first, then fall back to cookies
    const loadApiKey = async () => {
      try {
        const cloudflareKeys = await getApiKeys();
        const cloudflareKey = cloudflareKeys.find(k => k.provider === provider.name);

        if (cloudflareKey) {
          logger.debug(`Found API key for ${provider.name} in Cloudflare KV`);
          setIsCloudflareMode(true);
          // We don't have the actual key, just a masked version
          // The actual key is stored server-side in Cloudflare KV
          // We'll use the existing apiKey if it's already set
          if (!apiKey) {
            // Let the user know we're using a key from Cloudflare KV
            setApiKey('CLOUDFLARE_STORED_KEY');
          }
          return;
        }
      } catch (error) {
        logger.debug('Cloudflare KV not available, falling back to cookies');
        setIsCloudflareMode(false);
      }

      // Fall back to cookies
      const savedKeys = getApiKeysFromCookies();
      const savedKey = savedKeys[provider.name] || '';

      setTempKey(savedKey);
      setApiKey(savedKey);
    };

    loadApiKey();
    setIsEditing(false);
  }, [provider.name]);

  const checkEnvApiKey = useCallback(async () => {
    // Check cache first
    if (providerEnvKeyStatusCache[provider.name] !== undefined) {
      setIsEnvKeySet(providerEnvKeyStatusCache[provider.name]);
      return;
    }

    try {
      const response = await fetch(`/api/check-env-key?provider=${encodeURIComponent(provider.name)}`);
      const data = await response.json();
      const isSet = (data as { isSet: boolean }).isSet;

      // Cache the result
      providerEnvKeyStatusCache[provider.name] = isSet;
      setIsEnvKeySet(isSet);
    } catch (error) {
      console.error('Failed to check environment API key:', error);
      setIsEnvKeySet(false);
    }
  }, [provider.name]);

  useEffect(() => {
    checkEnvApiKey();
  }, [checkEnvApiKey]);

  const handleSave = async () => {
    // Save to parent state
    setApiKey(tempKey);

    if (isCloudflareMode) {
      // Save to Cloudflare KV
      try {
        const success = await saveApiKey(provider.name, tempKey);
        if (success) {
          logger.debug(`Saved API key for ${provider.name} to Cloudflare KV`);
        } else {
          throw new Error('Failed to save API key to Cloudflare KV');
        }
      } catch (error) {
        logger.error('Error saving to Cloudflare KV, falling back to cookies', error);
        // Fall back to cookies
        const currentKeys = getApiKeysFromCookies();
        const newKeys = { ...currentKeys, [provider.name]: tempKey };
        Cookies.set('apiKeys', JSON.stringify(newKeys));
      }
    } else {
      // Save to cookies
      const currentKeys = getApiKeysFromCookies();
      const newKeys = { ...currentKeys, [provider.name]: tempKey };
      Cookies.set('apiKeys', JSON.stringify(newKeys));
    }

    setIsEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-bolt-elements-textSecondary">{provider?.name} API Key:</span>
          {!isEditing && (
            <div className="flex items-center gap-2">
              {apiKey ? (
                <>
                  <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                  <span className="text-xs text-green-500">
                    {apiKey === 'CLOUDFLARE_STORED_KEY'
                      ? 'Set via Cloudflare KV'
                      : 'Set via UI'}
                  </span>
                </>
              ) : isEnvKeySet ? (
                <>
                  <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                  <span className="text-xs text-green-500">Set via environment variable</span>
                </>
              ) : (
                <>
                  <div className="i-ph:x-circle-fill text-red-500 w-4 h-4" />
                  <span className="text-xs text-red-500">Not Set (Please set via UI or ENV_VAR)</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={tempKey}
              placeholder="Enter API Key"
              onChange={(e) => setTempKey(e.target.value)}
              className="w-[300px] px-3 py-1.5 text-sm rounded border border-bolt-elements-borderColor
                        bg-bolt-elements-prompt-background text-bolt-elements-textPrimary
                        focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
            />
            <IconButton
              onClick={handleSave}
              title="Save API Key"
              className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="i-svg-spinners:270-ring-with-bg w-4 h-4" />
              ) : (
                <div className="i-ph:check w-4 h-4" />
              )}
            </IconButton>
            <IconButton
              onClick={() => setIsEditing(false)}
              title="Cancel"
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
              disabled={isLoading}
            >
              <div className="i-ph:x w-4 h-4" />
            </IconButton>
          </div>
        ) : (
          <>
            {
              <IconButton
                onClick={() => setIsEditing(true)}
                title="Edit API Key"
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
              >
                <div className="i-ph:pencil-simple w-4 h-4" />
              </IconButton>
            }
            {provider?.getApiKeyLink && !apiKey && (
              <IconButton
                onClick={() => window.open(provider?.getApiKeyLink)}
                title="Get API Key"
                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 flex items-center gap-2"
              >
                <span className="text-xs whitespace-nowrap">{provider?.labelForGetApiKey || 'Get API Key'}</span>
                <div className={`${provider?.icon || 'i-ph:key'} w-4 h-4`} />
              </IconButton>
            )}
          </>
        )}
      </div>
    </div>
  );
};
