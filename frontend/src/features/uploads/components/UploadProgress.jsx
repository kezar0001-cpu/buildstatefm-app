/**
 * UploadProgress Component
 * ========================
 *
 * Displays upload progress for files being uploaded via useUploader.
 *
 * USAGE:
 * ```jsx
 * const { files, isPaused, pauseReason, removeFile, retryFile } = useUploader({...});
 *
 * <UploadProgress
 *   files={files}
 *   isPaused={isPaused}
 *   pauseReason={pauseReason}
 *   onRemove={removeFile}
 *   onRetry={retryFile}
 * />
 * ```
 */

import React from 'react';
import { FileStatus } from '../hooks/useUploader';

// ============================================================================
// STYLES (Tailwind classes)
// ============================================================================

const containerClass = 'space-y-2';
const pauseBannerClass = 'bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center gap-2';
const fileItemClass = 'flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg';
const thumbnailClass = 'w-12 h-12 rounded-md object-cover bg-gray-100 flex-shrink-0';
const fileInfoClass = 'flex-1 min-w-0';
const fileNameClass = 'text-sm font-medium text-gray-900 truncate';
const fileSizeClass = 'text-xs text-gray-500';
const progressBarContainerClass = 'mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden';
const progressBarClass = 'h-full bg-blue-600 transition-all duration-300';
const statusClass = 'text-xs';
const errorClass = 'text-red-600';
const successClass = 'text-green-600';
const buttonClass = 'p-1 text-gray-400 hover:text-gray-600 rounded';
const retryButtonClass = 'text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200';

// ============================================================================
// ICONS
// ============================================================================

const LoadingIcon = () => (
  <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PauseIcon = () => (
  <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// ============================================================================
// FILE ITEM COMPONENT
// ============================================================================

function FileItem({ file, onRemove, onRetry }) {
  const isImage = file.type?.startsWith('image/');
  const showProgress =
    file.status === FileStatus.UPLOADING || file.status === FileStatus.COMPRESSING;
  const showRemove = file.status !== FileStatus.UPLOADING;

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getStatusText = () => {
    switch (file.status) {
      case FileStatus.PENDING:
        return 'Waiting...';
      case FileStatus.COMPRESSING:
        return 'Compressing...';
      case FileStatus.UPLOADING:
        return `Uploading ${file.progress}%`;
      case FileStatus.SUCCESS:
        return 'Complete';
      case FileStatus.ERROR:
        return file.error || 'Failed';
      default:
        return '';
    }
  };

  return (
    <div className={fileItemClass}>
      {/* Thumbnail */}
      {isImage && file.previewUrl ? (
        <img src={file.previewUrl} alt={file.name} className={thumbnailClass} />
      ) : (
        <div className={`${thumbnailClass} flex items-center justify-center text-gray-400`}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      )}

      {/* File info */}
      <div className={fileInfoClass}>
        <div className={fileNameClass} title={file.name}>
          {file.name}
        </div>
        <div className={fileSizeClass}>{formatSize(file.size)}</div>

        {/* Progress bar */}
        {showProgress && (
          <div className={progressBarContainerClass}>
            <div className={progressBarClass} style={{ width: `${file.progress}%` }} />
          </div>
        )}

        {/* Status */}
        <div
          className={`${statusClass} ${
            file.status === FileStatus.ERROR ? errorClass : file.status === FileStatus.SUCCESS ? successClass : ''
          }`}
        >
          {getStatusText()}
        </div>
      </div>

      {/* Status icon / Actions */}
      <div className="flex items-center gap-2">
        {file.status === FileStatus.UPLOADING && <LoadingIcon />}
        {file.status === FileStatus.COMPRESSING && <LoadingIcon />}
        {file.status === FileStatus.SUCCESS && <CheckIcon />}
        {file.status === FileStatus.ERROR && (
          <>
            <ErrorIcon />
            <button onClick={() => onRetry?.(file.id)} className={retryButtonClass} title="Retry">
              Retry
            </button>
          </>
        )}

        {/* Remove button */}
        {showRemove && (
          <button onClick={() => onRemove?.(file.id)} className={buttonClass} title="Remove">
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UploadProgress({
  files = [],
  isPaused = false,
  pauseReason = null,
  onRemove,
  onRetry,
  showCompleted = true,
  className = '',
}) {
  // Filter files to show
  const filesToShow = showCompleted
    ? files
    : files.filter((f) => f.status !== FileStatus.SUCCESS);

  if (filesToShow.length === 0 && !isPaused) {
    return null;
  }

  return (
    <div className={`${containerClass} ${className}`}>
      {/* Pause banner */}
      {isPaused && pauseReason && (
        <div className={pauseBannerClass}>
          <PauseIcon />
          <span>{pauseReason}</span>
        </div>
      )}

      {/* File list */}
      {filesToShow.map((file) => (
        <FileItem key={file.id} file={file} onRemove={onRemove} onRetry={onRetry} />
      ))}
    </div>
  );
}
