/**
 * UploadDropzone Component
 * ========================
 *
 * A simple drag-and-drop file upload area that works with useUploader.
 *
 * USAGE:
 * ```jsx
 * const { addFiles } = useUploader({...});
 *
 * <UploadDropzone
 *   onFilesSelected={addFiles}
 *   accept="image/*"
 *   multiple
 * />
 * ```
 */

import React, { useState, useRef, useCallback } from 'react';

// ============================================================================
// STYLES (Tailwind classes)
// ============================================================================

const baseClass =
  'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200';
const defaultClass = 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100';
const activeClass = 'border-blue-500 bg-blue-50';
const disabledClass = 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60';

// ============================================================================
// ICONS
// ============================================================================

const UploadIcon = ({ className = 'h-12 w-12' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
    />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UploadDropzone({
  onFilesSelected,
  accept = 'image/*',
  multiple = true,
  disabled = false,
  maxFiles,
  title = 'Drop files here or click to browse',
  subtitle = 'PNG, JPG, WebP up to 10MB',
  className = '',
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef(null);

  // Handle drag events
  const handleDragEnter = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  // Handle drop
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length === 0) return;

      // Apply max files limit
      const filesToAdd = maxFiles ? files.slice(0, maxFiles) : files;
      onFilesSelected?.(filesToAdd);
    },
    [disabled, maxFiles, onFilesSelected]
  );

  // Handle click
  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  // Handle file input change
  const handleInputChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      // Apply max files limit
      const filesToAdd = maxFiles ? files.slice(0, maxFiles) : files;
      onFilesSelected?.(filesToAdd);

      // Reset input so same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [maxFiles, onFilesSelected]
  );

  // Determine class based on state
  const stateClass = disabled ? disabledClass : isDragActive ? activeClass : defaultClass;

  return (
    <div
      className={`${baseClass} ${stateClass} ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Content */}
      <div className="flex flex-col items-center gap-3">
        <UploadIcon className={`h-12 w-12 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />

        <div>
          <p className={`text-sm font-medium ${isDragActive ? 'text-blue-600' : 'text-gray-700'}`}>
            {title}
          </p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
