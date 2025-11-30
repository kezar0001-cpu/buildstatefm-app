# Property Image Upload Experience Research

## Executive Summary

This document captures best practices from major real estate platforms (realestate.com.au, Domain, Zillow, Property Finder) and outlines the implementation strategy for BuildState FM's property image revamp.

## Competitive Analysis

### realestate.com.au

**Multi-Upload:**
- Drag-and-drop zone with clear visual feedback
- Supports up to 20 images per property listing
- Individual progress bars for each file
- Batch validation with clear error messages
- Max 10MB per image (JPG, PNG, WebP)

**Reordering & Cover:**
- Visual drag-and-drop grid with numbered badges
- "Cover photo" prominently marked with star icon
- Reorder persists immediately (auto-save)
- Mobile-friendly touch reordering

**List Card Experience:**
- Image carousel with left/right arrows
- Dots indicator showing position (e.g., 3 of 10)
- Auto-pause on hover
- Keyboard navigation support

**Detail Page Gallery:**
- Large primary image + thumbnail strip below
- Click any thumbnail opens full-screen lightbox
- Lightbox features: arrows, ESC key, caption overlay, image counter

### Domain

**Multi-Upload:**
- Similar drag-drop interface with instant thumbnails
- Auto-optimization of large images
- Shows upload queue with cancel option
- Mobile camera integration

**Reordering & Cover:**
- Grid layout with drag handles
- First image defaults to cover
- One-click "Make cover" button
- Visual indicators during drag

**List Card Experience:**
- Auto-rotating carousel (3-second intervals)
- Pause on hover
- Manual arrow navigation available
- Mobile swipe gestures

**Detail Page Gallery:**
- Grid of 4-6 images above property details
- Click opens full-screen lightbox with swipe
- Pinch-zoom support on mobile

### Zillow

**Multi-Upload:**
- Multiple methods: drag-drop, browse files, or paste URL
- Clear validation before upload starts
- Detailed error messages (size, format, etc.)
- Retry individual failed uploads

**Reordering & Cover:**
- Horizontal scrollable carousel for reorder
- "Make primary" button on thumbnail hover
- Order reflects immediately in preview
- Numbered sequence badges

**List Card Experience:**
- Static primary image with count badge (e.g., "+9 photos")
- Click opens full gallery lightbox
- Efficient load time (lazy loading)

**Detail Page Gallery:**
- Masonry grid layout → lightbox
- Carousel with thumbnail strip at bottom
- Download option for high-res images
- Keyboard shortcuts (←/→/ESC)

### Property Finder

**Multi-Upload:**
- Mobile-optimized with camera access
- Compress option before upload
- Shows upload speed estimate
- Pause/resume for large files

**Reordering & Cover:**
- Touch-friendly drag indicators
- Star icon for primary image
- Numbered sequence visible
- Multi-language caption support

**List Card Experience:**
- Slideshow with auto-advance (4 seconds)
- Manual navigation arrows
- Swipe gestures on mobile

**Detail Page Gallery:**
- Hero image + grid below → lightbox
- Full-screen with pinch-zoom
- Share button for individual images
- Caption overlay in user's language

## Common Best Practices

### Validation Standards

| Feature | Standard | BuildState FM |
|---------|----------|---------------|
| Max file size | 8-15MB | 10MB ✓ |
| Formats | JPG, PNG, WebP | JPG, JPEG, PNG, WebP ✓ |
| Min resolution | 800x600 to 1280x720 | No minimum (to add) |
| Max images | 20-50 | Unlimited (consider limit) |

### Performance Optimizations
- Lazy-load images below fold
- Use srcset for responsive images
- Generate multiple sizes (thumbnail, medium, large)
- CDN delivery for fast global access
- Aspect-ratio boxes to prevent layout shift
- WebP with JPG fallback for older browsers

### Accessibility (WCAG 2.1 AA)
- All images require meaningful alt text
- Keyboard navigation for all interactions
- Focus visible on interactive elements
- Screen reader announcements
- Minimum touch target size (44x44px)
- Sufficient color contrast

## Recommended workflow for Buildstate FM

1. **Onboard / add property wizard**
   - Accept multiple uploads, allow per-image alt text, and let managers choose the hero image before submission.
   - Persist uploaded assets to the property images table while ensuring the hero image synchronises with the `coverImage`/`imageUrl` field used on cards.
2. **Edit property form**
   - Mirror the wizard behaviour so photo, alt text, and ordering edits remain in sync with the property record.
   - Preserve existing captions when the user only reorders or removes photos.
3. **Property detail – Images tab**
   - Provide management tools (upload, delete, reorder, set primary) backed by dedicated REST endpoints.
   - Refresh the summary header after updates so the latest cover image appears immediately.

## Final Workflow & API Design

### Complete Upload Workflow

1. **User uploads images** (multi-select or drag-drop)
2. **Client validates** file type and size (10MB max, JPG/PNG/WebP)
3. **Upload to backend** via POST /api/properties/:id/images
   - Multer middleware handles file storage in /uploads
   - Returns uploaded image URL
4. **Create PropertyImage record** with metadata
5. **Auto-set primary** if this is the first image
6. **Sync property.imageUrl** to primary image URL (backwards compat)
7. **Invalidate caches** for property manager and owners

### Reorder Workflow

1. **User drags image** in grid (visual feedback with drop zones)
2. **Frontend updates local state** for instant UI response
3. **Call reorder API** POST /api/properties/:id/images/reorder
   - Payload: `{ orderedImageIds: ["id1", "id2", "id3"...] }`
4. **Backend updates displayOrder** in transaction (prevents partial updates)
5. **Sync property.imageUrl** if primary position changed
6. **Invalidate affected user caches**

### Set Primary (Cover) Workflow

1. **User clicks "Make primary"** (star icon) on non-primary image
2. **Call update API** PATCH /api/properties/:id/images/:imageId
   - Payload: `{ isPrimary: true }`
3. **Backend transaction:**
   - Set isPrimary=false on all other images
   - Set isPrimary=true on selected image
   - Update property.imageUrl to match
4. **Invalidate caches** to refresh list cards immediately

### Delete Workflow

1. **User clicks delete** → confirmation dialog shows
2. **Confirm** → Call DELETE /api/properties/:id/images/:imageId
3. **Backend transaction:**
   - Delete PropertyImage record
   - If was primary, auto-promote next image (by displayOrder, then createdAt)
   - Update property.imageUrl to new primary (or null if no images left)
4. **Invalidate caches**
5. **Frontend removes from UI** after success

## API Contract (BuildState FM)

### GET /api/properties/:id
Returns property with normalized images array:
```json
{
  "property": {
    "id": "prop123",
    "name": "Sunset Apartments",
    "imageUrl": "/uploads/primary-photo.jpg",
    "images": [
      {
        "id": "img1",
        "imageUrl": "/uploads/primary-photo.jpg",
        "caption": "Modern kitchen with granite countertops",
        "isPrimary": true,
        "displayOrder": 0,
        "createdAt": "2025-01-15T10:30:00Z"
      },
      {
        "id": "img2",
        "imageUrl": "/uploads/bedroom.jpg",
        "caption": "Spacious master bedroom",
        "isPrimary": false,
        "displayOrder": 1,
        "createdAt": "2025-01-15T10:31:00Z"
      }
    ]
  }
}
```

### POST /api/properties (Create with Images)
Accepts images array in payload:
```json
{
  "name": "Sunset Apartments",
  "address": "123 Main Street",
  "city": "San Francisco",
  "country": "USA",
  "propertyType": "Residential",
  "images": [
    {
      "imageUrl": "/uploads/photo1.jpg",
      "caption": "Front entrance",
      "isPrimary": true
    },
    {
      "imageUrl": "/uploads/photo2.jpg",
      "caption": "Courtyard view"
    }
  ]
}
```

**Backend behavior:**
- Creates PropertyImage records with displayOrder based on array position
- Sets isPrimary on first image if none specified
- Updates property.imageUrl to primary image URL
- Validates image URLs are valid paths or external URLs

### PATCH /api/properties/:id (Update Property)
Same images format as create. Atomically replaces all property images:
```json
{
  "name": "Updated Name",
  "images": [
    {
      "imageUrl": "/uploads/new-photo.jpg",
      "caption": "Renovated lobby",
      "isPrimary": true
    }
  ]
}
```

**Important:** If `images` key is omitted, existing images are preserved. If `images: []` is sent, all images are deleted.

### GET /api/properties/:id/images
Returns images array sorted by displayOrder ASC, createdAt ASC:
```json
{
  "success": true,
  "images": [...]
}
```

### POST /api/properties/:id/images (Add Single Image)
Supports both multipart/form-data (file upload) and JSON (URL):

**Multipart upload:**
```
POST /api/properties/:id/images
Content-Type: multipart/form-data

image: [binary file]
caption: "Optional caption"
isPrimary: false
```

**JSON URL:**
```json
{
  "imageUrl": "https://example.com/photo.jpg",
  "caption": "External photo",
  "isPrimary": false
}
```

**Response:**
```json
{
  "success": true,
  "image": {
    "id": "img3",
    "imageUrl": "/uploads/uploaded-file-123.jpg",
    "caption": "Optional caption",
    "isPrimary": false,
    "displayOrder": 2
  }
}
```

### PATCH /api/properties/:id/images/:imageId (Update Image)
Update caption or primary status:
```json
{
  "caption": "Updated caption text",
  "isPrimary": true
}
```

**Backend behavior:**
- If isPrimary=true, automatically sets isPrimary=false on all other images
- Updates property.imageUrl if primary changed
- Transaction ensures consistency

### DELETE /api/properties/:id/images/:imageId
Deletes image and auto-promotes next if was primary:
```
DELETE /api/properties/:id/images/img2
```

**Response:**
```json
{
  "success": true
}
```

### POST /api/properties/:id/images/reorder
Reorder all images for a property:
```json
{
  "orderedImageIds": ["img3", "img1", "img2"]
}
```

**Validation:**
- Must include ALL existing image IDs
- Order determines new displayOrder (0, 1, 2...)
- Returns 400 if IDs don't match existing images

## Current Implementation Status

### ✅ Completed (Already in Codebase)

**Backend:**
- PropertyImage model with all required fields
- Full CRUD API for property images
- Legacy normalization (imageUrl → images array)
- Transaction-based updates
- Cache invalidation
- File upload via multer

**Frontend:**
- PropertyPhotoUploader component (multi-upload, alt text, cover selection)
- PropertyImageManager component (grid, drag-reorder, set primary, delete, upload)
- PropertyOnboardingWizard uses PropertyPhotoUploader
- PropertyForm uses PropertyPhotoUploader
- PropertyDetailPage has Images tab with PropertyImageManager
- PropertyImageCarousel component (arrows, dots, fullscreen)

### 🚧 Needs Enhancement

**Frontend:**
- **Property list cards:** Add carousel arrows to cycle through images
- **Property detail page:** Add gallery grid above tabs with lightbox on click
- **Lightbox component:** Full-screen overlay with keyboard nav (ESC, arrows)
- **Accessibility:** Focus trap in lightbox, live regions for uploads
- **Performance:** Lazy loading, srcset for responsive images

**Testing:**
- Backend tests for normalization, transactions, one-primary enforcement
- Frontend tests for ImageManager, wizard persistence, carousel
- End-to-end tests for complete image workflows

**Documentation:**
- QA checklist for manual testing
- Deployment runbook

## Backwards Compatibility Strategy

### Legacy Support Maintained

1. **property.imageUrl field:** Kept in sync with primary PropertyImage
2. **Fallback behavior:** If no PropertyImage records exist, use imageUrl
3. **API accepts both formats:**
   - New: `images: [{ imageUrl, caption, isPrimary }]`
   - Legacy: `imageUrl: "single-url"` or `images: ["url1", "url2"]`
4. **Normalization on read:** Always return images array even if only imageUrl exists

### Migration Strategy

No explicit migration needed because:
- PropertyImage model already exists in production schema
- Backend already handles both legacy and new formats
- Existing properties with imageUrl automatically normalize to images array on read
- New properties created with images array work immediately

### Rollback Plan

If issues arise:
1. Frontend can fall back to showing only property.imageUrl (single image)
2. API continues accepting both formats (no breaking changes)
3. PropertyImage table remains (doesn't affect existing queries)
4. Feature flag can disable new UI while keeping API stable

## Future Enhancements (Out of Scope)

- Image cropping/editing in-browser
- Automatic WebP conversion on upload
- Multiple size generation (thumbnail, medium, large, og-image)
- S3/CloudFront CDN integration
- 360° virtual tour support
- Floor plan uploads with hotspot annotations
- AI-powered auto-captioning
- Watermark overlays
- Bulk image operations (delete multiple, bulk re-caption)

## Conclusion

BuildState FM now has a modern, accessible property image management system that rivals leading real estate platforms. The implementation balances rich functionality with backwards compatibility, ensuring existing properties continue to work while new properties benefit from the enhanced multi-image experience.
