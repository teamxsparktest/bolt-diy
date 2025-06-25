import { useState } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useCloudflareApiKeys');

export interface ApiKeyInfo {
  provider: string;
  maskedKey: string;
}

export function useCloudflareApiKeys() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Get all API keys (masked)
   * @returns Array of API key info objects
   */
  const getApiKeys = async (): Promise<ApiKeyInfo[]> => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/api-keys');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get API keys');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get API keys');
      }

      // Convert to array of ApiKeyInfo objects
      return Object.entries(data.maskedKeys || {}).map(([provider, maskedKey]) => ({
        provider,
        maskedKey: maskedKey as string,
      }));
    } catch (error) {
      logger.error('Error getting API keys:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Save an API key
   * @param provider The provider name
   * @param apiKey The API key to save
   * @returns True if successful
   */
  const saveApiKey = async (provider: string, apiKey: string): Promise<boolean> => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, apiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save API key');
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      logger.error('Error saving API key:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Delete an API key
   * @param provider The provider name
   * @returns True if successful
   */
  const deleteApiKey = async (provider: string): Promise<boolean> => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete API key');
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      logger.error('Error deleting API key:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    getApiKeys,
    saveApiKey,
    deleteApiKey,
    isLoading,
    isSaving,
  };
}
