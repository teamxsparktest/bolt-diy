import React, { useState, useRef } from 'react';
import { useCloudflareStorage, type FileMetadata } from '~/lib/hooks/useCloudflareStorage';
import { Button } from '../ui/Button';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('FileUploader');

interface FileUploaderProps {
  chatId?: string;
  onUploadComplete?: (file: FileMetadata) => void;
  onUploadError?: (error: Error) => void;
  className?: string;
}

export function FileUploader({ chatId, onUploadComplete, onUploadError, className }: FileUploaderProps) {
  const { uploadFile, isUploading } = useCloudflareStorage();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();

    if (e.target.files && e.target.files.length > 0) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const result = await uploadFile(file, { chatId });

      if (result) {
        logger.debug('File uploaded successfully:', result);
        onUploadComplete?.(result);
      } else {
        throw new Error('Failed to upload file');
      }
    } catch (error) {
      logger.error('Error uploading file:', error);
      onUploadError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-4 ${dragActive ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-700'} ${className}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        disabled={isUploading}
      />

      <div className="flex flex-col items-center justify-center space-y-2 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          {isUploading ? (
            <p>Uploading file...</p>
          ) : (
            <>
              <p>Drag and drop a file here, or</p>
              <Button
                onClick={handleButtonClick}
                disabled={isUploading}
                variant="outline"
                className="mt-2"
              >
                Select a file
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
