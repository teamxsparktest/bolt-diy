import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useCloudflareStorage');

export interface FileUploadOptions {
  chatId?: string;
  onProgress?: (progress: number) => void;
}

export interface FileMetadata {
  id: string;
  chatId?: string;
  path: string;
  contentType?: string;
  size: number;
  timestamp: string;
  metadata?: Record<string, string>;
}

export function useCloudflareStorage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  /**
   * Upload a file to Cloudflare R2
   * @param file The file to upload
   * @param options Upload options
   * @returns The uploaded file metadata
   */
  const uploadFile = async (file: File, options?: FileUploadOptions): Promise<FileMetadata | null> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      if (options?.chatId) {
        formData.append('chatId', options.chatId);
      }

      const response = await fetch('/api/file-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      const data = await response.json();
      logger.debug('File uploaded successfully', data);

      return {
        id: data.fileId,
        path: data.fileName,
        contentType: data.contentType,
        size: data.size,
        chatId: data.chatId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error uploading file:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Download a file from Cloudflare R2
   * @param fileId The file ID to download
   * @param fileName Optional filename to use for the downloaded file
   */
  const downloadFile = async (fileId: string, fileName?: string): Promise<void> => {
    try {
      // Redirect to the file download endpoint
      window.open(`/api/file-download/${fileId}`, '_blank');
    } catch (error) {
      logger.error('Error downloading file:', error);
    }
  };

  /**
   * Get a list of files for a chat
   * @param chatId The chat ID
   * @returns Array of file metadata
   */
  const getFilesForChat = async (chatId: string): Promise<FileMetadata[]> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/files/${chatId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get files');
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      logger.error('Error getting files for chat:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Search for files by path pattern
   * @param query The search query
   * @returns Array of file metadata
   */
  const searchFiles = async (query: string): Promise<FileMetadata[]> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/search-files?query=${encodeURIComponent(query)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search files');
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      logger.error('Error searching files:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a file
   * @param fileId The file ID to delete
   * @returns True if successful
   */
  const deleteFile = async (fileId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/delete-file/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      logger.error('Error deleting file:', error);
      return false;
    }
  };

  return {
    uploadFile,
    downloadFile,
    getFilesForChat,
    searchFiles,
    deleteFile,
    isUploading,
    isLoading,
  };
}
