import React, { useState, useEffect } from 'react';
import { useCloudflareStorage, type FileMetadata } from '~/lib/hooks/useCloudflareStorage';
import { Button } from '../ui/Button';
import { createScopedLogger } from '~/utils/logger';
import { formatDistanceToNow } from 'date-fns';

const logger = createScopedLogger('FileList');

interface FileListProps {
  chatId: string;
  onFileClick?: (file: FileMetadata) => void;
  className?: string;
}

export function FileList({ chatId, onFileClick, className }: FileListProps) {
  const { getFilesForChat, downloadFile, deleteFile, isLoading } = useCloudflareStorage();
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chatId) {
      loadFiles();
    }
  }, [chatId]);

  const loadFiles = async () => {
    try {
      const fileList = await getFilesForChat(chatId);
      setFiles(fileList);
      setError(null);
    } catch (err) {
      logger.error('Error loading files:', err);
      setError('Failed to load files');
    }
  };

  const handleDownload = async (file: FileMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await downloadFile(file.id);
    } catch (err) {
      logger.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };

  const handleDelete = async (file: FileMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this file?')) {
      try {
        const success = await deleteFile(file.id);
        if (success) {
          setFiles(files.filter(f => f.id !== file.id));
        } else {
          throw new Error('Failed to delete file');
        }
      } catch (err) {
        logger.error('Error deleting file:', err);
        setError('Failed to delete file');
      }
    }
  };

  const getFileIcon = (file: FileMetadata) => {
    const contentType = file.contentType || '';

    if (contentType.startsWith('image/')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    } else if (contentType.startsWith('text/')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      );
    } else if (contentType.startsWith('application/pdf')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          <path d="M8 11a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
        </svg>
      );
    } else {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
  };

  const formatFileSize = (size: number): string => {
    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };

  if (isLoading) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <p>Loading files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-center text-red-500 ${className}`}>
        <p>{error}</p>
        <Button onClick={loadFiles} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        <p>No files available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-lg font-medium">Files</h3>
      <ul className="space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
            onClick={() => onFileClick?.(file)}
          >
            <div className="flex items-center space-x-3">
              <div className="text-gray-500 dark:text-gray-400">
                {getFileIcon(file)}
              </div>
              <div>
                <p className="font-medium">{file.path}</p>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex space-x-2">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(file.timestamp))} ago</span>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDownload(file, e)}
                title="Download"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDelete(file, e)}
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
