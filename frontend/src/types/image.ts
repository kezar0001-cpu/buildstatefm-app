/**
 * Canonical image data format matching the API format
 *
 * This interface defines the standard structure for image data
 * across the frontend application, ensuring consistency with the backend API.
 */
export interface ImageData {
  /** Unique identifier for the image */
  id?: string | number;

  /** URL of the image */
  imageUrl: string;

  /** Optional caption/alt text for the image */
  caption?: string | null;

  /** Whether this image is the primary/cover image */
  isPrimary: boolean;

  /** Display order/position of the image */
  displayOrder: number;
}

/**
 * Type for image data when creating new images (without ID)
 */
export type NewImageData = Omit<ImageData, 'id'>;
