import axios from 'axios';
import logger from '../utils/logger.js';
import { isUsingCloudStorage } from './uploadService.js';
import { uploadFileToS3, isUsingS3 } from './s3Service.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class BlogImageService {
  constructor() {
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
    this.useUnsplash = !!this.unsplashAccessKey;
  }

  /**
   * Generate or fetch an image for the blog post
   * @param {string} imagePrompt - Description/prompt for the image
   * @param {Object} topic - Topic details for fallback search
   * @returns {Promise<string>} URL of the generated/fetched image
   */
  async generateImage(imagePrompt, topic) {
    try {
      if (this.useUnsplash) {
        return await this.fetchFromUnsplash(imagePrompt, topic);
      } else {
        // Fallback to a placeholder service
        return await this.fetchPlaceholder(topic);
      }
    } catch (error) {
      logger.error('Error generating blog image', { error: error.message });
      // Return a default placeholder on error
      return this.getDefaultPlaceholder(topic);
    }
  }

  /**
   * Fetch a relevant image from Unsplash
   * @param {string} query - Search query
   * @param {Object} topic - Topic details
   * @returns {Promise<string>} Image URL
   */
  async fetchFromUnsplash(query, topic) {
    try {
      const searchQuery = this.buildUnsplashQuery(query, topic);
      logger.info('Fetching image from Unsplash', { query: searchQuery });

      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: searchQuery,
          per_page: 10,
          orientation: 'landscape',
          content_filter: 'high'
        },
        headers: {
          Authorization: `Client-ID ${this.unsplashAccessKey}`
        }
      });

      if (response.data.results && response.data.results.length > 0) {
        // Pick a random image from the top results for variety
        const randomIndex = Math.floor(Math.random() * Math.min(5, response.data.results.length));
        const photo = response.data.results[randomIndex];

        // Download the image and upload to our storage
        const imageUrl = await this.downloadAndUpload(photo.urls.regular, photo.id);

        // Track the usage (Unsplash API guidelines)
        if (photo.links.download_location) {
          await this.trackUnsplashDownload(photo.links.download_location);
        }

        logger.info('Successfully fetched and uploaded Unsplash image', {
          photoId: photo.id,
          imageUrl
        });

        return imageUrl;
      }

      // No results, use placeholder
      return await this.fetchPlaceholder(topic);
    } catch (error) {
      logger.error('Error fetching from Unsplash', { error: error.message });
      return await this.fetchPlaceholder(topic);
    }
  }

  /**
   * Build Unsplash search query from prompt and topic
   * @param {string} prompt - Image prompt
   * @param {Object} topic - Topic details
   * @returns {string} Search query
   */
  buildUnsplashQuery(prompt, topic) {
    // Extract key visual terms from the prompt
    // Prioritize business/professional imagery
    const keywords = topic.keywords.slice(0, 3).join(' ');
    const category = topic.category || '';

    // Combine elements for a good search query
    return `${category} ${keywords} professional business`.trim();
  }

  /**
   * Track Unsplash download (required by API guidelines)
   * @param {string} downloadLocation - Download tracking URL
   */
  async trackUnsplashDownload(downloadLocation) {
    try {
      await axios.get(downloadLocation, {
        headers: {
          Authorization: `Client-ID ${this.unsplashAccessKey}`
        }
      });
    } catch (error) {
      logger.warn('Failed to track Unsplash download', { error: error.message });
    }
  }

  /**
   * Download image from URL and upload to our storage
   * @param {string} imageUrl - Source image URL
   * @param {string} imageId - Unique identifier for the image
   * @returns {Promise<string>} Uploaded image URL
   */
  async downloadAndUpload(imageUrl, imageId) {
    try {
      // Download the image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 seconds
      });

      // Create a temporary file
      const tempDir = '/tmp';
      const tempFileName = `blog-${imageId}-${uuidv4()}.jpg`;
      const tempFilePath = path.join(tempDir, tempFileName);

      // Write to temp file
      await fs.writeFile(tempFilePath, response.data);

      // Create a file object similar to multer
      const fileObject = {
        path: tempFilePath,
        filename: tempFileName,
        originalname: tempFileName,
        mimetype: 'image/jpeg',
        size: response.data.length
      };

      // Upload using existing upload service
      let uploadedUrl;
      if (isUsingCloudStorage()) {
        // Upload to S3
        const result = await uploadFileToS3('blog', tempFilePath, tempFileName, 'image/jpeg');
        uploadedUrl = result.url;
      } else {
        // Use local storage fallback
        const uploadsDir = path.join(process.cwd(), 'uploads/blog');
        await fs.mkdir(uploadsDir, { recursive: true });
        const localPath = path.join(uploadsDir, tempFileName);
        await fs.copyFile(tempFilePath, localPath);
        uploadedUrl = `/uploads/blog/${tempFileName}`;
      }

      // Clean up temp file
      await fs.unlink(tempFilePath).catch(() => {});

      return uploadedUrl;
    } catch (error) {
      logger.error('Error downloading and uploading image', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch a placeholder image
   * @param {Object} topic - Topic details
   * @returns {Promise<string>} Placeholder image URL
   */
  async fetchPlaceholder(topic) {
    // Use a placeholder service that generates nice images
    const width = 1200;
    const height = 630;
    const category = encodeURIComponent(topic.category || 'business');
    const seed = Math.random().toString(36).substring(7);

    // Using picsum.photos for high-quality placeholder images
    return `https://picsum.photos/seed/${seed}/${width}/${height}`;
  }

  /**
   * Get a default placeholder (no external service needed)
   * @param {Object} topic - Topic details
   * @returns {string} Default placeholder URL
   */
  getDefaultPlaceholder(topic) {
    const width = 1200;
    const height = 630;
    const text = encodeURIComponent(topic.title || 'Blog Post');
    const bgColor = this.getCategoryColor(topic.category);
    const textColor = 'ffffff';

    // Using placeholder.com as the most reliable fallback
    return `https://via.placeholder.com/${width}x${height}/${bgColor}/${textColor}?text=${text}`;
  }

  /**
   * Get a color based on category
   * @param {string} category - Blog category
   * @returns {string} Hex color (without #)
   */
  getCategoryColor(category) {
    const colors = {
      'Maintenance': '4A90E2',
      'Property Management': '7B68EE',
      'Technology': '50C878',
      'Compliance': 'E67E22',
      'Best Practices': '2ECC71',
      'Industry Trends': 'E74C3C',
      'Case Studies': '9B59B6',
      'default': '3498DB'
    };

    return colors[category] || colors.default;
  }

  /**
   * Generate alt text for the image based on topic
   * @param {Object} topic - Topic details
   * @returns {string} Alt text for accessibility
   */
  generateAltText(topic) {
    return `${topic.title} - Professional image for blog post about ${topic.category}`;
  }

  /**
   * Optimize image metadata for SEO
   * @param {Object} topic - Topic details
   * @param {string} imageUrl - Image URL
   * @returns {Object} Image metadata
   */
  generateImageMetadata(topic, imageUrl) {
    return {
      url: imageUrl,
      alt: this.generateAltText(topic),
      title: topic.title,
      caption: topic.excerpt,
      keywords: topic.keywords.join(', ')
    };
  }
}

export default new BlogImageService();
